from collections.abc import Callable
from logging import getLogger
from pathlib import Path

import numpy as np
from aiortc import MediaStreamTrack
from av import AudioFrame, AudioResampler
from rich.logging import RichHandler

from models import load_vad, load_speech_to_text

ROOT = Path(__file__).resolve().parent
log = getLogger(__name__)
log.addHandler(RichHandler())
log.setLevel("DEBUG")


class VADTrack(MediaStreamTrack):
    kind = "audio"

    vad_model, get_timestamps = load_vad()

    def __init__(
        self,
        track,
        buffer_size=2048,
        detection_window: int = 10,
        min_speech_samples: int = 10,
        confidence_threshold: float = 0.5,
        speech_callback: Callable[[np.ndarray], None] | None = None,
    ):
        super().__init__()
        self.track = track
        self.buffer = []

        self.buffer_size = buffer_size
        self.confidence_accumulate = 0
        self.min_speech_samples = min_speech_samples
        self.confidence_threshold = confidence_threshold
        self.detection_window = detection_window
        self.speech_callback = speech_callback

    async def recv(self):
        frame: AudioFrame = await self.track.recv()
        log.debug(f"frame: {frame!r}")
        with AudioResampler(
            format="s16",
            layout="mono",
            rate=16000,
        ) as resampler:
            frame = resampler.resample(frame)
        self.buffer.append(frame)
        if len(self.buffer) > self.buffer_size:
            self.buffer.pop(0)
        if len(self.buffer) == self.detection_window:
            audio = np.concatenate(self.buffer[-self.detection_window :])
            self.confidence = self.vad_model(audio)
            log.debug(f"confidence: {self.confidence}")
            if self.confidence > self.confidence_threshold:
                self.confidence_accumulate += 1
            else:
                if self.confidence_accumulate > self.min_speech_samples:
                    if self.speech_callback is not None:
                        self.speech_callback(audio)
                self.confidence_accumulate = 0
        return frame
