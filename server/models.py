from logging import info

import numpy as np
import torch
import whisper


def load_speech_to_text(model_size: str = "tiny"):
    info("Loading whisper...")
    model = whisper.load_model(model_size)
    model = model.to("cuda" if torch.cuda.is_available() else "cpu")
    info("Whisper loaded.")

    def transcribe(audio: np.ndarray):
        return model.transcribe(audio)

    return transcribe


def load_vad():
    info("Loading Sliero...")
    model, utils = torch.hub.load(
        repo_or_dir="snakers4/silero-vad",
        model="silero_vad",
        force_reload=True,
    )
    (get_speech_ts, _, _, _, _, _) = utils
    info("Sliero loaded.")

    def vad(audio: np.ndarray):
        return get_speech_ts(audio, model=model, sampling_rate=16000)

    return model, vad
