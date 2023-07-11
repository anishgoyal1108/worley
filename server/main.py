import asyncio
import socket
import uuid
from logging import getLogger
import numpy as np

from aiohttp import web
from aiortc import RTCPeerConnection, RTCSessionDescription
from aiortc.contrib.media import MediaRelay
from models import load_speech_to_text
from rtc import VADTrack
from rich import print
from rich.logging import RichHandler
from collections import deque

app = web.Application()
router = web.RouteTableDef()

log = getLogger(__name__)


def setup_logger(logger, quiet=False):
    if quiet:
        logger.setLevel("WARNING")
    else:
        logger.setLevel("DEBUG")
        logger.handlers.clear()
        logger.addHandler(RichHandler())


setup_logger(log)
setup_logger(getLogger("aiortc"), quiet=True)
setup_logger(getLogger("aioice"), quiet=True)

pcs = set()  # NOTE: Maintain reference to peer connections to avoid garbage collection
speech_to_text = load_speech_to_text()


class Ref:
    def __init__(self, value):
        self.value = value

    def set(self, value):
        self.value = value

    def get(self):
        return self.value


@router.get("/ping")
async def ping(request):
    log.info(f"ping from {request.remote}")
    return web.json_response({"message": "pong"})


@router.post("/offer")
async def offer(request):
    params = await request.json()
    offer = RTCSessionDescription(sdp=params["sdp"], type=params["type"])
    relay = MediaRelay()

    pc = RTCPeerConnection()
    pc_id = "PeerConnection(%s)" % uuid.uuid4()
    pcs.add(pc)

    def info(msg, *args):
        log.info(pc_id + " " + msg, *args)

    def debug(msg, *args):
        log.debug(pc_id + " " + msg, *args)

    info("Created for %s", request.remote)

    sr_dc = Ref(None)
    queue = deque()

    def send_text(text: str):
        debug(f"Sending text: {text}")
        if sr_dc.get() is not None:
            sr_dc.get().send(text)
            while len(queue):
                text = queue.popleft()
                sr_dc.send(text)
        else:
            debug(f"Queueing text: {text}")
            queue.append(text)

    vad_track: VADTrack | None = None
    vad_task: asyncio.Task | None = None

    @pc.on("datachannel")
    def on_datachannel(c):
        debug("Data channel created by remote party")
        if c.label == "speech_recognition":
            sr_dc.set(c)

        @c.on("message")
        def on_message(message):
            debug("Data channel message received: %s", message)

    @pc.on("connectionstatechange")
    async def on_connectionstatechange():
        info("Connection state is %s", pc.connectionState)
        if pc.connectionState == "failed":
            await pc.close()
            pcs.discard(pc)

    @pc.on("track")
    def on_track(track):
        nonlocal vad_task, vad_track
        info("Track %s received", track.kind)

        if track.kind == "audio":
            info("Adding VADTrack")

            async def vad_callback(audio: np.ndarray):
                log.debug(f"Received audio: {audio.shape}")
                result = speech_to_text(audio)
                send_text(result["text"])

            vad_track = VADTrack(
                relay.subscribe(track),
                speech_callback=vad_callback,
            )
            vad_track.start()

        @track.on("ended")
        async def on_ended():
            info("Track %s ended", track.kind)
            track.stop()
            vad_track.stop()

    # handle offer
    await pc.setRemoteDescription(offer)

    # send answer
    answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)  # type: ignore

    return web.json_response(
        {"sdp": pc.localDescription.sdp, "type": pc.localDescription.type}
    )


async def on_shutdown(app):
    coros = [pc.close() for pc in pcs]
    await asyncio.gather(*coros)
    pcs.clear()


if __name__ == "__main__":
    print(f"Server started at http://{socket.gethostbyname(socket.gethostname())}:8080")
    app.add_routes(router)
    app.on_shutdown.append(on_shutdown)
    web.run_app(app)
