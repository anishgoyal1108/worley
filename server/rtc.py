import asyncio
from collections.abc import Callable
from logging import getLogger
from pathlib import Path

import numpy as np
import torch
from aiortc.mediastreams import MediaStreamError
from av import AudioResampler
from av.audio.frame import AudioFrame
from rich.logging import RichHandler

from models import load_vad

ROOT = Path(__file__).resolve().parent
log = getLogger(__name__)
log.addHandler(RichHandler())
log.setLevel("DEBUG")


class VADTrack:
    vad_model, get_timestamps = load_vad()
    SAMPLE_RATE = 16000

    def __init__(
        self,
        track,
        buffer_size=4096,
        detection_window: int = 16,
        overlap: int = 8,
        min_speech_windows: int = 4,
        confidence_threshold: float = 0.45,
        speech_callback: Callable[[np.ndarray], None] | None = None,
    ):
        super().__init__()
        self.track = track
        self.buffer: list[AudioFrame] = []

        self.buffer_size = buffer_size
        self.speech_window = 0
        self.min_speech_windows = min_speech_windows
        self.confidence_threshold = confidence_threshold
        self.detection_window = detection_window
        self.speech_callback = speech_callback

        self.confidence_pointer = 0
        self.speech_pointer = 0
        self.overlap = overlap

        self.resampler = AudioResampler(
            format="s16",
            layout="mono",
            rate=self.SAMPLE_RATE,
        )

        self.running = False
        self.task: asyncio.Task | None = None

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

    async def __process_one(self):
        try:
            frame: AudioFrame = await self.track.recv()
            self.buffer.append(self.resampler.resample(frame)[0])
        except MediaStreamError as e:
            return

        if len(self.buffer) > self.buffer_size:
            self.buffer.pop(0)
        if len(self.buffer) - self.confidence_pointer >= self.detection_window:
            start = self.confidence_pointer
            end = self.confidence_pointer + self.detection_window
            self.confidence = self.vad_model(
                torch.from_numpy(self.__prepare_audio(start, end)),
                self.SAMPLE_RATE,
            ).item()
            self.confidence_pointer += self.detection_window - self.overlap

            if self.confidence > self.confidence_threshold:
                self.speech_window += 1
            else:
                if self.speech_window > self.min_speech_windows:
                    if self.speech_callback is not None:
                        log.debug(f"Speech detected: [{self.speech_pointer, start})")
                        self.speech_callback(
                            self.__prepare_audio(
                                self.speech_pointer,
                                start,
                            )
                        )
                self.speech_window = 0
                self.speech_pointer = self.confidence_pointer
