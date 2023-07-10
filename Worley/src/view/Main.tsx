import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { IconButton, Surface } from 'react-native-paper';
import { RTCPeerConnection, RTCSessionDescription } from 'react-native-webrtc';
import tw from 'twrnc';

import { Audio } from 'expo-av';

import { useSettings } from '@model';

export function Main() {
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [pc, setPC] = useState<RTCPeerConnection | null>(null);
  const [settings, _] = useSettings();

  useEffect(() => {
    return () => {
      if (recording) {
        recording.stopAndUnloadAsync();
      }
    };
  }, [recording]);

  const startRecording = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        console.log('Permission to access audio was denied');
        return;
      }

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(
        Audio.RecordingOptionsPresets.HighQuality,
      );
      await recording.startAsync();
      setRecording(recording);
      setIsRecording(true);
    } catch (err) {
      console.error('Failed to start recording', err);
    }
  };

  const stopRecording = async () => {
    try {
      await recording?.stopAndUnloadAsync();
      setIsRecording(false);
    } catch (err) {
      console.error('Failed to stop recording', err);
    }
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
