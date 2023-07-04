import base64
import os
from logging import INFO, basicConfig, debug, info
from queue import Queue
from tempfile import TemporaryDirectory

import ffmpeg
import flask
import numpy as np
import torch
import whisper
from flask import Flask, jsonify, request

basicConfig(level=INFO)

app = flask.Flask(__name__)

info("Loading model...")
model = whisper.load_model("tiny")
model = model.to("cuda" if torch.cuda.is_available() else "cpu")


audio_queue = Queue()


def _load_audio(buffer, format: str):
    with TemporaryDirectory() as tmpdir:
        file_path = os.path.join(tmpdir, "audio." + format.lstrip("."))
        with open(buffer, "b") as f, open(file_path, "wb") as g:
            g.write(f.read())
        out, _ = (
            ffmpeg.input(file_path, threads=0)
            .output("-", format="s16le", acodec="pcm_s16le", ac=1, ar=16000)
            .run(cmd=["ffmpeg", "-nostdin"], capture_stdout=True, capture_stderr=True)
        )
        return np.frombuffer(out, np.int16).flatten().astype(np.float32) / 32768.0


@app.route("/asr/recognize", methods=["POST"])
def recognize():
    data = request.json
    audio = _load_audio(
        base64.b64decode(data["audio"]),
        data["format"],
    )
    audio_queue.put(audio)


@app.route("/s2t", methods=["POST"])
def s2t():
    mp3_base64 = request.json["base64"]
    mp3_bytes = base64.b64decode(mp3_base64)
    with TemporaryDirectory() as tmpdir:
        buffer = os.path.join(tmpdir, "audio.m4a")
        with open(buffer, "wb") as f:
            f.write(mp3_bytes)
        audio = whisper.load_audio(buffer)
        result = model.transcribe(audio)
        return jsonify({"result": result})


app.run(host="0.0.0.0", debug=True)
