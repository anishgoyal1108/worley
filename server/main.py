import asyncio
import uuid
from logging import getLogger, basicConfig, DEBUG

from aiohttp import web
from aiortc import RTCPeerConnection, RTCSessionDescription
from aiortc.contrib.media import MediaRelay
from rich.logging import RichHandler

app = web.Application()
router = web.RouteTableDef()

basicConfig(level=DEBUG)
log = getLogger(__name__)
log.addHandler(RichHandler())
log.setLevel("DEBUG")

RELAY = MediaRelay()
pcs = set()


@router.get("/ping")
async def ping(request):
    log.info(f"ping from {request.remote}")
    return web.json_response({"message": "pong"})


async def create_pc() -> tuple[RTCPeerConnection, str]:
    pc = RTCPeerConnection()
    pc_id = "PeerConnection(%s)" % uuid.uuid4()
    pcs.add(pc)
    return pc, pc_id


@router.post("/offer")
async def offer(request):
    param = await request.json()
    offer = RTCSessionDescription(sdp=param["sdp"], type=param["type"])

    pc, pc_id = await create_pc()

    def info(msg, *args):
        log.info(pc_id + " " + msg, *args)

    info("Created for %s", request.remote)

    @pc.on("datachannel")
    def on_datachannel(channel):
        @channel.on("message")
        def on_message(message):
            info("Data channel message: %s", message)
            channel.send("pong")

    @pc.on("iceconnectionstatechange")
    async def on_iceconnectionstatechange():
        info("ICE connection state is %s", pc.iceConnectionState)
        if pc.iceConnectionState == "failed":
            await pc.close()

    @pc.on("track")
    def on_track(track):
        info("Track %s received", track.kind)
        pc.addTrack(track)
        if track.kind != "audio":
            return

    await pc.setRemoteDescription(offer)
    answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)  # type: ignore

    return web.json_response(
        {
            "sdp": pc.localDescription.sdp,
            "type": pc.localDescription.type,
        }
    )


async def on_shutdown(app):
    coros = [pc.close() for pc in pcs]
    await asyncio.gather(*coros)
    pcs.clear()


if __name__ == "__main__":
    app.add_routes(router)
    app.on_shutdown.append(on_shutdown)
    web.run_app(app)
