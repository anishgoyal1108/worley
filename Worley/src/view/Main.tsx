import React, { useState } from 'react';
import { View } from 'react-native';
import {
  Appbar,
  IconButton,
  Surface,
  Text,
  useTheme,
} from 'react-native-paper';
import { RTCPeerConnection } from 'react-native-webrtc';
import tw from 'twrnc';

import { start, stop } from '@controller/rtc';
import { MaterialIcons } from '@expo/vector-icons';
import { useServerStatus, useSettings } from '@model';

type StatusBoxType = 'connected' | 'failed' | 'connecting';

function StatusBox({
  label,
  status,
  size = 24,
}: {
  label: string;
  status: StatusBoxType;
  size?: number;
}) {
  const theme = useTheme();
  const color = {
    connected: theme.colors.primary,
    failed: theme.colors.error,
    connecting: theme.colors.secondary,
  };
  const icon = {
    connected: 'check',
    failed: 'error',
    connecting: 'sync',
  };
  return (
    <View
      key={label}
      style={tw`flex flex-row gap-2 justify-center items-center`}
    >
      <Text variant="labelLarge">{label}</Text>
      {
        <MaterialIcons
          // TODO: Fix typing
          name={icon[status] as any}
          size={size}
          color={color[status]}
        />
      }
    </View>
  );
}

export function Main() {
  const [isRecording, setIsRecording] = useState(false);
  const serverStatus = useServerStatus()[0],
    settings = useSettings()[0],
    theme = useTheme();
  const [pc, setPC] = useState<RTCPeerConnection | null>(null);
  const [textDC, setTextDC] = useState<RTCDataChannel | null>(null);
  const [confidenceDC, setConfidenceDC] = useState<RTCDataChannel | null>(null);
  const [message, setMessage] = useState('');
  const [confidence, setConfidence] = useState(-1);

  const startRecording = () => {
    const [pc, textDC, confidenceDC] = start(settings);
    setPC(pc);
    setTextDC(textDC);
    setConfidenceDC(confidenceDC);

    textDC.onmessage = (e) => {
      setMessage(e.data);
    };

    confidenceDC.onmessage = (e) => {
      const data = parseFloat(e.data);
      setConfidence(data);
    };

    setIsRecording(true);
    setMessage('');
    setConfidence(-1);
  };

  const stopRecording = () => {
    stop(
      pc as RTCPeerConnection,
      textDC as RTCDataChannel,
      confidenceDC as RTCDataChannel,
    );
    setIsRecording(false);
    setConfidence(-1);
    setMessage('');
  };

  const recordingScreen = () => (
    <View style={tw`flex h-full justify-center items-center`}>
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
      {isRecording && message && (
        <Text variant="labelLarge" style={tw`text-center`}>
          {message}
        </Text>
      )}
      {isRecording && confidence != -1 && (
        <Text variant="labelLarge" style={tw`text-center`}>
          {confidence}
        </Text>
      )}
    </View>
  );

  const warningScreen = () => {
    return (
      <View style={tw`flex-1 justify-center items-center`}>
        <MaterialIcons name="error" size={64} color={theme.colors.error} />
        <Text
          style={{
            ...tw`text-lg`,
            color: theme.colors.error,
          }}
        >
          Server is not connected.
        </Text>
        <Text
          style={{
            ...tw`text-lg`,
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
      {(serverStatus.status === 'connected' && recordingScreen()) ||
        warningScreen()}
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
