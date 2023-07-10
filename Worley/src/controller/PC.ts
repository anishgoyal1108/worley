import { RTCPeerConnection, RTCSessionDescription } from 'react-native-webrtc';

export class S2TConnection {
  static config = {
    sdpSemantics: 'unified-plan',
    iceServers: [
      {
        urls: 'stun:stun.l.google.com:19302',
      },
    ],
  };

  private _pc: RTCPeerConnection;
  private _dc: RTCDataChannel;
  private _dcInterval: NodeJS.Timeout | null = null;

  constructor(
    onTrack: (track: MediaStreamTrack) => void,
    debug: boolean = true,
    dcParameters: RTCDataChannelInit = { ordered: true },
  ) {
    this._pc = this._create_pc(debug);
    this._dc = this._create_dc(dcParameters);

    this._pc.addEventListener('track', (event) => {
      const evt = event as RTCTrackEvent;
      onTrack(evt.track);
    });
  }

  get connectionState() {
    return this._pc.connectionState;
  }

  get pc() {
    return this._pc;
  }

  async negotiate() {
    const offer = await this._pc.createOffer({});
    await this._pc.setLocalDescription(offer);
  }

  private _create_pc(debug: boolean) {
    const _pc = new RTCPeerConnection(S2TConnection.config);
    if (debug) {
      _pc.addEventListener('icecandidate', (e) => {
        console.log('icecandidate', this._pc.iceGatheringState);
      });
      _pc.addEventListener('iceconnectionstatechange', (e) => {
        console.log('iceconnectionstatechange', this._pc.iceConnectionState);
      });
      _pc.addEventListener('signalingstatechange', (e) => {
        console.log('signalingstatechange', this._pc.signalingState);
      });
    }
    return _pc;
  }

  private _create_dc(parameters: RTCDataChannelInit = { ordered: true }) {
    const _dc = this._pc.createDataChannel('data', parameters) as any;
    _dc.onopen = () => {
      console.log('data channel open');
      this._dcInterval = setInterval(() => {
        this._dc.send('ping');
      }, 1000);
    };
    _dc.onclose = () => {
      console.log('data channel close');
      if (this._dcInterval) {
        clearInterval(this._dcInterval);
        this._dcInterval = null;
      }
    };
    _dc.onmessage = (e: MessageEvent) => {
      console.log('data channel message', e.data);
    };
    return _dc;
  }
}
