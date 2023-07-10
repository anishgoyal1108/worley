import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { IconButton, Surface } from 'react-native-paper';
import {
  MediaStream,
  RTCPeerConnection,
  RTCSessionDescription,
  mediaDevices,
} from 'react-native-webrtc';
import { post_offer } from 'src/controller/server';
import tw from 'twrnc';

import { useSettings } from '@model';

export function Main() {
  const [isRecording, setIsRecording] = useState(false);
  const [pc, setPC] = useState<RTCPeerConnection | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [settings, _] = useSettings();

  const createPeerConnection = async () => {
    const pc = new RTCPeerConnection({
      iceServers: [
        {
          urls: 'stun:stun.l.google.com:19302',
        },
      ],
    });
    var offer = await pc.createOffer({
      ordered: true,
      offerToReceiveAudio: true,
    });
    await pc.setLocalDescription(offer);

    pc.onicecandidate = (event) => {
      const evt = event as RTCPeerConnectionIceEvent;
      if (evt.candidate) {
        console.log('candidate', evt.candidate);
      }
    };

    while (true) {
      if (pc.iceGatheringState === 'complete') {
        console.log('ICE gathering complete');
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    offer = pc.localDescription as RTCSessionDescription;
    var codec = offer.sdp?.match(/m=audio .*\r\n.*\r\n/);
    if (!codec) {
      throw new Error('No codec found');
    }

    const response = await post_offer({
      sdp: offer.sdp,
      type: offer.type,
    });

    const answer = new RTCSessionDescription({
      sdp: response.sdp,
      type: response.type,
    });
    await pc.setRemoteDescription(answer);

    setPC(pc);
  };

  const createAudioStream = async () => {
    try {
      const stream = await mediaDevices.getUserMedia({ audio: true });
      setLocalStream(stream);
    } catch (err) {
      console.error('Failed to create audio stream', err);
    }
  };

  const startAudioStream = async () => {
    const audioTracks = localStream?.getAudioTracks();
    if (audioTracks && audioTracks.length > 0 && localStream) {
      const sender = pc?.addTrack(audioTracks[0], localStream);
      if (sender) {
        console.log('Added audio track to peer connection');
      }
    }
  };

  const stopAudioStream = async () => {
    try {
      localStream?.getTracks().forEach((track) => track.stop());
      setLocalStream(null);
    } catch (err) {
      console.error('Failed to stop audio stream', err);
    }
  };

  const startRecording = async () => {
    await createAudioStream();
    await createPeerConnection();
    await startAudioStream();
    setIsRecording(true);
  };

  const stopRecording = async () => {
    await stopAudioStream();
    setIsRecording(false);
  };

  return (
    <Surface style={tw`flex h-full`} elevation={1} mode="flat">
      <Surface style={tw`h-16 justify-center px-4`}>
        <Text style={tw`text-2xl text-slate-600`}>Worley</Text>
      </Surface>
      <View style={tw`flex-1 justify-center items-center`}>
        <IconButton
          icon={isRecording ? 'stop' : 'microphone'}
          size={64}
          onPress={isRecording ? stopRecording : startRecording}
          mode="contained-tonal"
          animated={true}
          style={tw`w-28 h-28 rounded-full`}
        />
      </View>
    </Surface>
  );
}
