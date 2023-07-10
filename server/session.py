import base64
import os
from queue import Queue
from tempfile import TemporaryDirectory

import ffmpeg
import numpy as np


class Session:
    SESSIONS = {}

    def __init__(self, interval: int, last_recognized: int = 0):
        self.interval = interval
        self.last_recognized = last_recognized
        self.queue = Queue()
        self.id = str(len(self.SESSIONS))

    @staticmethod
    def get(session_id: str):
        return Session.SESSIONS.get(session_id)

    def put(self, audio: np.ndarray | str):
        match audio:
            case np.ndarray():
                self.queue.put(audio)
            case str():
                with TemporaryDirectory() as tmpdir:
                    file_path = os.path.join(tmpdir, "audio." + format.lstrip("."))
                    audio_bytes = base64.b64decode(audio)
                    with open(file_path, "wb") as f:
                        f.write(audio_bytes)
                    out, _ = (
                        ffmpeg.input(file_path, threads=0)
                        .output("-", format="s16le", acodec="pcm_s16le", ac=1, ar=16000)
                        .run(
                            cmd=["ffmpeg", "-nostdin"],
                            capture_stdout=True,
                            capture_stderr=True,
                        )
                    )
                    return (
                        np.frombuffer(out, np.int16).flatten().astype(np.float32)
                        / 32768.0
                    )

    def recognize(self):
        audio = []
        while not self.queue.empty():
            audio.append(self.queue.get())
        if not audio:
            return None
        audio = np.concatenate(audio)

    def __eq__(self, other):
        if not isinstance(other, Session):
            return False
        return self.id == getattr(other, "id", None)

    def __hash__(self):
        return hash(self.id)
