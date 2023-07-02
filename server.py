import base64

import flask
import whisper
from tempfile import TemporaryDirectory
import os

from flask import jsonify, request

app = flask.Flask(__name__)

model = whisper.load_model("tiny")


@app.route("/s2t", methods=["POST"])
def s2t():
    mp3_base64 = request.json["base64"]
    mp3_bytes = base64.b64decode(mp3_base64)
    with TemporaryDirectory() as tmpdir:
        buffer = os.path.join(tmpdir, "audio.mp3")
        with open(buffer, "wb") as f:
            f.write(mp3_bytes)
        audio = whisper.load_audio(buffer)
        result = model.transcribe(audio)
        return jsonify({"result": result})


app.run(host="0.0.0.0", debug=True)
