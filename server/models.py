import contextlib
import os
from logging import getLogger

import numpy as np
import torch
from faster_whisper import WhisperModel
from rich.logging import RichHandler

log = getLogger("models")
log.addHandler(RichHandler())
log.setLevel("INFO")


def load_speech_to_text(model_size: str = "base"):
    log.info("Loading whisper...")
    device: str
    if torch.cuda.is_available():
        log.info("Using GPU.")
        device = "cuda"
    else:
        log.info("Using CPU.")
        device = "cpu"
    model = WhisperModel(
        model_size,
        device=device,
        compute_type="float16",
    )
    log.info("Whisper loaded.")

    def transcribe(audio: np.ndarray):
        segments, info = model.transcribe(
            audio,
            without_timestamps=True,
            language="en",
        )
        return " ".join([segment.text for segment in segments])

    return transcribe


def load_vad():
    log.info("Loading Sliero...")
    with open(os.devnull, "w") as devnull:
        with contextlib.redirect_stdout(devnull):
            model, utils = torch.hub.load(
                repo_or_dir="snakers4/silero-vad",
                model="silero_vad",
            )
    (get_speech_ts, *_) = utils
    log.info("Sliero loaded.")

    def vad(audio: np.ndarray):
        return get_speech_ts(audio, model=model, sampling_rate=16000)

    return model, vad
