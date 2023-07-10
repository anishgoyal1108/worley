from collections import deque
from logging import getLogger
from pathlib import Path

import numpy as np
from av import AudioFrame, AudioResampler
from rich.logging import RichHandler

from models import load_vad

ROOT = Path(__file__).resolve().parent
log = getLogger(__name__)
log.addHandler(RichHandler())
log.setLevel("DEBUG")


class VADTrack:
    MODEL, vad = load_vad()

    def __init__(self, track, overlap=10):
        super().__init__()
        self.track = track
        self.buffer = deque(maxlen=overlap)

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

        if len(self.buffer) == self.buffer.maxlen:
            audio = np.concatenate((self.buffer[: self.buffer.maxlen]), axis=0)
            self.buffer.popleft()
            confidence = self.MODEL(audio)
            log.debug(f"confidence: {confidence}")

        return frame
