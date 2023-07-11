from logging import info

import numpy as np
import torch
import whisper


def load_speech_to_text(model_size: str = "base"):
    info("Loading whisper...")
    model = whisper.load_model(model_size)
    if torch.cuda.is_available():
        model = model.to("cuda")
        info("Using GPU.")
    else:
        info("Using CPU.")
    info("Whisper loaded.")

    def transcribe(audio: np.ndarray):
        return model.transcribe(audio)

    return transcribe


def load_vad():
    info("Loading Sliero...")
    model, utils = torch.hub.load(repo_or_dir="snakers4/silero-vad", model="silero_vad")
    (get_speech_ts, *_) = utils
    info("Sliero loaded.")

    def vad(audio: np.ndarray):
        return get_speech_ts(audio, model=model, sampling_rate=16000)

    return model, vad
