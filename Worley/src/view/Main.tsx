import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { Appbar, IconButton, Surface, useTheme } from 'react-native-paper';
import {
  MediaStream,
  RTCPeerConnection,
  RTCSessionDescription,
  mediaDevices,
} from 'react-native-webrtc';
import tw from 'twrnc';

import { post_offer } from '@controller';
import { MaterialIcons } from '@expo/vector-icons';
import { useServerStatus, useSettings } from '@model';

export function Main() {
  const [isRecording, setIsRecording] = useState(false);
  const [PC, setPC] = useState<RTCPeerConnection | null>(null);
  const [textDC, setTextDC] = useState<RTCDataChannel | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const settings = useSettings()[0],
    status = useServerStatus()[0],
    theme = useTheme();

  const createPeerConnection = async () => {
    const pc = new RTCPeerConnection({
      iceServers: [
        {
          urls: 'stun:stun.l.google.com:19302',
        },
      ],
    });
    console.debug('Creating offer...');
    var offer = await pc.createOffer({
      ordered: true,
      offerToReceiveAudio: true,
    });
    await pc.setLocalDescription(offer);

    pc.onicecandidate = (event) => {
      const evt = event as RTCPeerConnectionIceEvent;
      if (evt.candidate) {
        console.debug('Find ICE candidate...', evt.candidate);
      }
    };

    if (settings.rtc.waitForICEGathering) {
      await waitForICEGathering(pc);
    }

    console.debug('Figure out codec...');
    offer = pc.localDescription as RTCSessionDescription;
    var codec = offer.sdp?.match(/m=audio .*\r\n.*\r\n/);
    codec = codec ? codec[0] : 'default';
    console.debug('Codec:', codec);

    console.debug('Send offer to server...');
    const response = await post_offer(settings.server, {
      sdp: offer.sdp,
      type: offer.type,
    });

    console.debug('Received answer from server...');
    const answer = new RTCSessionDescription({
      sdp: response.sdp,
      type: response.type,
    });
    await pc.setRemoteDescription(answer);

    return pc;
  };

  const stopPeerConnection = async (PC: RTCPeerConnection) => {
    try {
      PC.close();
      setPC(null);
    } catch (err) {
      console.error('Failed to stop peer connection', err);
    }
  };

  const createAudioStream = async () => {
    try {
      const mediaStream = await mediaDevices.getUserMedia({ audio: true });
      const tracks = mediaStream.getVideoTracks();
      tracks.forEach((track) => {
        track.enabled = false;
      });
      return mediaStream;
    } catch (err) {
      console.error('Failed to create audio stream', err);
    }
  };

  const createTextDC = async (PC: RTCPeerConnection) => {
    const dc = PC.createDataChannel('text', {
      ordered: true,
    }) as unknown as RTCDataChannel;
    if (dc === null) {
      console.error('Failed to create text data channel');
      return;
    }
    dc.addEventListener('open', () => {
      console.debug('Text data channel opened');
    });
    dc.addEventListener('message', (event) => {
      const evt = event as MessageEvent;
      console.debug('Text data channel message received', evt.data);
    });
    dc.addEventListener('close', () => {
      console.debug('Text data channel closed');
    });
    dc.addEventListener('error', (err) => {
      console.error('Text data channel error', err);
    });
    return dc;
  };

  const stopTextDC = async (textDC: RTCDataChannel) => {
    try {
      textDC?.close();
      setTextDC(null);
    } catch (err) {
      console.error('Failed to stop text data channel', err);
    }
  };

  const startAudioStream = async (
    PC: RTCPeerConnection,
    localStream: MediaStream,
  ) => {
    const audioTracks = localStream?.getAudioTracks();
    audioTracks?.forEach((track) => {
      PC?.addTrack(track, localStream as MediaStream);
    });
  };

  const stopAudioStream = async (localStream: MediaStream) => {
    try {
      localStream?.getTracks().forEach((track) => track.stop());
      setLocalStream(null);
    } catch (err) {
      console.error('Failed to stop audio stream', err);
    }
  };

  const startRecording = async () => {
    setIsRecording(true);
    const stream = (await createAudioStream())!!;
    setLocalStream(stream);
    const pc = await createPeerConnection();
    setPC(pc);
    const tdc = (await createTextDC(pc))!!;
    setTextDC(tdc);
    await startAudioStream(pc, stream);
    textDC?.send('Hello world!');
  };

  const stopRecording = async (
    PC: RTCPeerConnection,
    localStream: MediaStream,
    textDC: RTCDataChannel,
  ) => {
    await stopAudioStream(localStream);
    await stopTextDC(textDC);
    await stopPeerConnection(PC);
    setIsRecording(false);
  };

  const recordingScreen = () => (
    <View style={tw`flex-1 justify-center items-center`}>
      <IconButton
        icon={isRecording ? 'stop' : 'microphone'}
        size={64}
        onPress={
          isRecording
            ? () => stopRecording(PC!!, localStream!!, textDC!!)
            : startRecording
        }
        mode="contained-tonal"
        animated={true}
        style={tw`w-28 h-28 rounded-full`}
      />
    </View>
  );

  const warningScreen = () => {
    return (
      <View style={tw`flex-1 justify-center items-center`}>
        <MaterialIcons name="error" size={64} color={theme.colors.error} />
        <Text
          style={{
            ...tw`text-xl`,
            color: theme.colors.error,
          }}
        >
          Server is not connected.
        </Text>
        <Text
          style={{
            ...tw`text-xl`,
            color: theme.colors.error,
          }}
        >
          Please check your settings.
        </Text>
      </View>
    );
  };

  return (
    <Surface style={tw`flex h-full`} elevation={1} mode="flat">
      <Appbar.Header>
        <Appbar.Content title="Worley" />
      </Appbar.Header>
      {(status.status === 'connected' && recordingScreen()) || warningScreen()}
    </Surface>
  );
}
async function waitForICEGathering(pc: RTCPeerConnection) {
  console.debug('Wait for ICE gathering complete...');
  while (true) {
    if (pc.iceGatheringState === 'complete') {
      console.debug('ICE gathering complete');
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}
