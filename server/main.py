import base64
from logging import INFO, basicConfig, debug, info

from flask import Flask, jsonify, request
from models import load_speech_to_text, load_vad

basicConfig(level=INFO)

app = Flask(__name__)
speech_to_text = load_speech_to_text()
vad = load_vad()


@app.route("/asr/handshake", methods=["POST"])
def session():
    data = request.json
    if not data:
        return jsonify({"error": "No data"}), 400
    session_id = str(len(sessions))
    sessions[session_id] = {"interval": data.get("interval", 500)}
    return jsonify({"session_id": session_id})


@app.route("/asr/recognize", methods=["POST"])
def recognize():
    data = request.json
    if not data or "audio" not in data:
        return jsonify({"error": "No audio data"}), 400

    audio = _load_audio(
        base64.b64decode(data["audio"]),
        data["format"],
    )
    audio_queue.put(audio)


app.run(host="0.0.0.0", debug=True)
