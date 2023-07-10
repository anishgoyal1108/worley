import asyncio
import socket
import uuid
from logging import DEBUG, basicConfig, getLogger

from aiohttp import web
from aiortc import RTCPeerConnection, RTCSessionDescription
from aiortc.contrib.media import MediaRecorder, MediaRelay
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


pcs = set()


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

    def log_info(msg, *args):
        log.info(pc_id + " " + msg, *args)

    log_info("Created for %s", request.remote)

    # prepare local media
    recorder = MediaRecorder(str("./test.wav"))

    @pc.on("datachannel")
    def on_datachannel(channel):
        @channel.on("message")
        def on_message(message):
            if isinstance(message, str) and message.startswith("ping"):
                channel.send("pong" + message[4:])

    @pc.on("connectionstatechange")
    async def on_connectionstatechange():
        log_info("Connection state is %s", pc.connectionState)
        if pc.connectionState == "failed":
            await pc.close()
            pcs.discard(pc)

    @pc.on("track")
    def on_track(track):
        log_info("Track %s received", track.kind)

        if track.kind == "audio":
            log_info("Adding track to recorder")
            recorder.addTrack(track)

        @track.on("ended")
        async def on_ended():
            log_info("Track %s ended", track.kind)
            await recorder.stop()

    # handle offer
    await pc.setRemoteDescription(offer)
    await recorder.start()

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
