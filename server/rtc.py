import asyncio
from collections.abc import Callable, Coroutine
from logging import getLogger

import numpy as np
import torch
from aiortc.mediastreams import MediaStreamError
from av import AudioResampler
from av.audio.frame import AudioFrame
from models import load_vad
from rich.logging import RichHandler

log = getLogger("rtc")
log.addHandler(RichHandler())
log.setLevel("INFO")


class VADTrack:
    vad_model, get_timestamps = load_vad()
    SAMPLE_RATE = 16000

    def __init__(
        self,
        track,
        buffer_size=4096,
        detection_window: int = 8,
        overlap: int = 4,
        min_speech_windows: int = 4,
        min_silence_windows: int = 2,
        confidence_threshold: float = 0.45,
        confidence_callback: Callable[[float], Coroutine[None, None, None]]
        | None = None,
        speech_callback: Callable[[np.ndarray], Coroutine[None, None, None]]
        | None = None,
    ):
        super().__init__()
        self.track = track
        self.buffer: list[AudioFrame] = list()

        self.buffer_size = buffer_size
        self.min_speech_windows = min_speech_windows
        self.speech_window_count = 0
        self.last_speech_window_count = 0
        self.min_silence_windows = min_silence_windows
        self.silence_window_count = 0
        self.confidence_threshold = confidence_threshold
        self.detection_window = detection_window
        self.speech_callback = speech_callback
        self.confidence_callback = confidence_callback

        self.speech_end = 0
        self.speech_start = 0
        self.overlap = overlap

        self.resampler = AudioResampler(
            format="s16",
            layout="mono",
            rate=self.SAMPLE_RATE,
        )

        self.running = False
        self.task: asyncio.Task | None = None
        self.callback_tasks: list[asyncio.Task] = []

    def start(self):
        self.running = True
        self.task = asyncio.ensure_future(self.run())

    async def run(self):
        while self.running:
            try:
                await self.__process_one()
            except Exception as e:
                if self.running:
                    log.exception(e)

    def stop(self):
        self.running = False
        if self.task is not None:
            try:
                self.task.cancel()
            except asyncio.CancelledError:
                pass
        self.task = None

    @staticmethod
    def __to_float(audio: np.ndarray) -> np.ndarray:
        max = np.abs(audio).max()
        audio = audio.astype(np.float32)
        if max > 0:
            audio *= 1 / 32768
        audio = audio.squeeze()
        return audio

    def __prepare_audio(self, start: int, end: int) -> np.ndarray:
        frames = self.buffer[start:end]
        audio = np.concatenate([f.to_ndarray().flatten() for f in frames])
        assert audio.dtype == np.int16
        audio = self.__to_float(audio)
        return audio

    def __run(self, coro: Coroutine[None, None, None]):
        task = asyncio.ensure_future(coro)
        task.add_done_callback(lambda _: self.callback_tasks.remove(task))
        self.callback_tasks.append(task)

    async def __process_one(self):
        try:
            frame: AudioFrame = await self.track.recv()
            log.debug(f"Received a {frame.pts * 1000 / frame.sample_rate}ms frame")
            self.buffer.append(self.resampler.resample(frame)[0])
        except MediaStreamError:
            return

        if len(self.buffer) > self.buffer_size:
            # TODO: Ring buffer
            self.buffer.pop(0)
            self.speech_end -= 1
            self.speech_start -= 1

        if len(self.buffer) - self.speech_end >= self.detection_window:
            start = self.speech_end
            end = self.speech_end + self.detection_window
            self.confidence = self.vad_model(
                torch.from_numpy(self.__prepare_audio(start, end)),
                self.SAMPLE_RATE,
            ).item()
            if self.confidence_callback is not None:
                log.debug(f"Confidence: {self.confidence}")
                self.__run(self.confidence_callback(self.confidence))
            self.speech_end += self.detection_window - self.overlap

            if self.confidence > self.confidence_threshold:
                if self.speech_window_count == 0:
                    self.speech_start = self.speech_end
                self.speech_window_count += 1
                self.silence_window_count = 0
            else:
                if (
                    self.last_speech_window_count > self.min_speech_windows
                    and self.silence_window_count > self.min_silence_windows
                ):
                    if self.speech_callback is not None:
                        log.info(f"Speech detected: [{self.speech_start, start})")
                        self.__run(
                            self.speech_callback(
                                self.__prepare_audio(
                                    self.speech_start,
                                    start,
                                )
                            )
                        )
                    self.last_speech_window_count = 0

                if self.silence_window_count == 0:
                    self.last_speech_window_count = self.speech_window_count
                self.speech_window_count = 0
                self.silence_window_count += 1
