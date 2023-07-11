import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { Appbar, IconButton, Surface, useTheme } from 'react-native-paper';
import { RTCPeerConnection, mediaDevices } from 'react-native-webrtc';
import tw from 'twrnc';

import { post_offer } from '@controller';
import { MaterialIcons } from '@expo/vector-icons';
import { SettingsType, useServerStatus, useSettings } from '@model';

function createPeerConnection() {
  const pc = new RTCPeerConnection({
    sdpSemantics: 'unified-plan',
    iceServers: [{ urls: ['stun:stun.l.google.com:19302'] }],
  });

  return pc;
}

function negotiate(
  pc: RTCPeerConnection,
  server: string,
  skip_ice: boolean = false,
) {
  console.log(`Negotiating with ${server}...`);
  return pc
    .createOffer(null)
    .then(function (offer) {
      return pc.setLocalDescription(offer);
    })
    .then(() => {
      if (skip_ice) {
        console.warn('Skipping ICE gathering');
        return null;
      }
      new Promise(function (resolve) {
        if (pc.iceGatheringState === 'complete') {
          resolve(null);
        } else {
          function checkState() {
            if (pc.iceGatheringState === 'complete') {
              pc.removeEventListener('icegatheringstatechange', checkState);
              resolve(null);
            }
          }
          pc.addEventListener('icegatheringstatechange', checkState);
        }
      });
    })
    .then(function () {
      var offer = pc.localDescription!!;

      return post_offer(server, {
        sdp: offer.sdp,
        type: offer.type!!,
      });
    })
    .then(function (answer) {
      return pc.setRemoteDescription(answer);
    })
    .catch(function (e) {
      alert(e);
    });
}

function start(settings: SettingsType): [RTCPeerConnection, RTCDataChannel] {
  const pc: RTCPeerConnection = createPeerConnection();

  const server = settings.server;
  const wait_ice = !settings.rtc.waitForICEGathering;

  console.log('Created local peer connection object pc');

  var parameters = { ordered: true };

  const dc = pc.createDataChannel(
    'text',
    parameters,
  ) as unknown as RTCDataChannel;

  dc.onopen = function () {
    console.log('Data channel is open and ready to be used.');
  };

  dc.onmessage = function (evt) {
    console.log('Received message: ' + evt.data);
  };

  var constraints = {
    audio: true,
    video: false,
  };

  mediaDevices.getUserMedia(constraints).then(
    (stream) => {
      stream.getTracks().forEach(function (track) {
        pc.addTrack(track, stream);
      });
      return negotiate(pc, server, wait_ice);
    },
    function (err) {
      alert('Could not acquire media: ' + err);
    },
  );

  return [pc, dc];
}

function stop(pc?: RTCPeerConnection, dc?: RTCDataChannel) {
  dc?.close();
  if (pc?.getReceivers()) {
    pc?.getReceivers().forEach(function (receiver) {
      receiver.track?.stop();
    });
  }
  if (pc?.getSenders()) {
    pc?.getSenders().forEach(function (sender) {
      sender.track?.stop();
    });
  }
  setTimeout(() => pc?.close(), 500);
}

export function Main() {
  const [isRecording, setIsRecording] = useState(false);
  const status = useServerStatus()[0],
    settings = useSettings()[0],
    theme = useTheme();
  const [pc, setPC] = useState<RTCPeerConnection | null>(null);
  const [dc, setDC] = useState<RTCDataChannel | null>(null);

  const startRecording = () => {
    const [pc, dc] = start(settings);
    setPC(pc);
    setDC(dc);
    setIsRecording(true);
  };

  const stopRecording = () => {
    stop(pc as RTCPeerConnection, dc as RTCDataChannel);
    setIsRecording(false);
  };

  const recordingScreen = () => (
    <View style={tw`flex-1 justify-center items-center`}>
      <IconButton
        icon={isRecording ? 'stop' : 'microphone'}
        size={64}
        onPress={() => {
          if (isRecording) stopRecording();
          else startRecording();
        }}
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

function waitForICEGathering(pc: RTCPeerConnection) {
  console.debug('Wait for ICE gathering complete...');
  return new Promise((resolve) => {
    if (pc.iceGatheringState === 'complete') {
      resolve(null);
    } else {
      function checkState() {
        if (pc.iceGatheringState === 'complete') {
          pc.removeEventListener('icegatheringstatechange', checkState);
          resolve(null);
        }
      }
      pc.addEventListener('icegatheringstatechange', checkState);
    }
  });
}
