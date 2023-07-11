import asyncio
import socket
import uuid
from logging import DEBUG, basicConfig, getLogger
import numpy as np

from aiohttp import web
from aiortc import RTCPeerConnection, RTCSessionDescription
from aiortc.contrib.media import MediaRelay
from models import load_speech_to_text
from rtc import VADTrack
from rich import print
from rich.logging import RichHandler

app = web.Application()
router = web.RouteTableDef()

basicConfig(level=DEBUG)
log = getLogger(__name__)


def setup_logger(logger, quiet=False):
    if quiet:
        logger.setLevel("WARNING")
    else:
        logger.setLevel("INFO")
        logger.handlers.clear()
        logger.addHandler(RichHandler())


setup_logger(log)
setup_logger(getLogger("aiortc"), quiet=True)
setup_logger(getLogger("aioice"), quiet=True)

pcs = set()  # NOTE: Maintain reference to peer connections to avoid garbage collection
speech_to_text = load_speech_to_text()


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

    info("Created for %s", request.remote)

    channel = pc.createDataChannel("speech_recognition")

    @pc.on("datachannel")
    def on_datachannel(channel):
        @channel.on("message")
        def on_message(message):
            info("Data channel message received: %s", message)

    @pc.on("connectionstatechange")
    async def on_connectionstatechange():
        info("Connection state is %s", pc.connectionState)
        if pc.connectionState == "failed":
            await pc.close()
            pcs.discard(pc)

    @pc.on("track")
    def on_track(track):
        info("Track %s received", track.kind)

        if track.kind == "audio":
            info("Adding VADTrack")

            def vad_callback(audio: np.ndarray):
                text = speech_to_text(audio)
                print(text)
                channel.send(text["text"])

            # TODO: find a less hacky way to subscribe to the audio stream
            vad_track = VADTrack(relay.subscribe(track), speech_callback=vad_callback)
            pc.addTrack(vad_track)

        @track.on("ended")
        async def on_ended():
            info("Track %s ended", track.kind)
            track.stop()

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
