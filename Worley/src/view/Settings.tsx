import React, { useEffect, useState } from 'react';
import { StatusBar, View } from 'react-native';
import {
  Appbar,
  Button,
  List,
  Surface,
  Switch,
  TextInput,
} from 'react-native-paper';
import tw from 'twrnc';

import { useServerStatus, useServerStatusUpdater, useSettings } from '@model';

export const Settings = () => {
  const [checkingServer, setCheckingServer] = useState(false);
  const [settings, setSettings] = useSettings();
  const [serverStatus, _] = useServerStatus();
  const [abort, updateServerStatus] = useServerStatusUpdater();

  useEffect(() => {
    if (!checkingServer) return;
    setCheckingServer(false);
    const timeout = updateServerStatus();
    return () => {
      clearTimeout(timeout);
      abort();
    };
  }, [checkingServer, settings.server]);

  return (
    <Surface style={tw`flex h-full`} elevation={1} mode="flat">
      <Appbar.Header>
        <Appbar.Content title="Settings" />
      </Appbar.Header>
      <List.Section style={tw`w-full`}>
        <List.Subheader>Theme</List.Subheader>
        <List.Item
          title="Dark mode"
          right={() => (
            <Switch
              value={settings.theme === 'dark'}
              onValueChange={(value: boolean) => {
                setCheckingServer(true);
                setSettings({ ...settings, theme: value ? 'dark' : 'light' });
              }}
            />
          )}
        />
        <List.Subheader>Server</List.Subheader>
        <List.Item
          title="Server address"
          description="Enter the IP address of the server"
          right={() => (
            <TextInput
              value={settings.server}
              onChangeText={(value: string) => {
                setSettings({ ...settings, server: value });
              }}
            />
          )}
        />

        <List.Item
          title="Check server"
          description={serverStatus.message}
          right={() => (
            <View style={tw`flex flex-row items-center`}>
              <Button
                mode="outlined"
                onPress={() => {
                  setCheckingServer(true);
                }}
              >
                Check
              </Button>
              <View style={tw`w-4`} />
              <Button mode="outlined" onPress={() => abort()}>
                Stop
              </Button>
            </View>
          )}
        />

        <List.Subheader>WebRTC</List.Subheader>
        <List.Item
          title="Wait for ICE"
          description="Wait for ICE gathering complete before sending offer"
          right={() => (
            <Switch
              value={settings.rtc.waitForICEGathering}
              onValueChange={(value: boolean) => {
                setSettings({
                  ...settings,
                  rtc: { ...settings.rtc, waitForICEGathering: value },
                });
              }}
            />
          )}
        />
      </List.Section>
      <StatusBar />
    </Surface>
  );
};
