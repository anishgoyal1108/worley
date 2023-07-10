import React, { useEffect, useState } from 'react';
import { StatusBar, View } from 'react-native';
import { Button, List, Surface, Switch, TextInput } from 'react-native-paper';
import tw from 'twrnc';

import { useSettings } from '@model';

export const Settings = () => {
  const [settings, setSettings] = useSettings();
  const [checkingServer, setCheckingServer] = useState(false);
  const [serverStatus, setServerStatus] = useState({
    status: 'disconnected',
    message: 'Server is not connected',
  });
  const controller = new AbortController();
  function abort() {
    if (serverStatus.status === 'connecting') {
      controller.abort();
      setServerStatus({
        status: 'disconnected',
        message: 'Check server timed out',
      });
    }
  }

  useEffect(() => {
    const signal = controller.signal;
    setServerStatus({
      status: 'connecting',
      message: 'Connecting to server...',
    });
    setCheckingServer(false);
    setTimeout(() => abort(), 1000);
    fetch(`http://${settings.server}/ping`, { signal })
      .then((response) => {
        if (response.ok) {
          setServerStatus({
            status: 'connected',
            message: 'Server is connected',
          });
        } else {
          try {
            response.json().then((json) => {
              setServerStatus({
                status: 'disconnected',
                message: json.message,
              });
            });
          } catch (error: any) {
            setServerStatus({
              status: 'disconnected',
              message:
                (error.hasOwnProperty('message') && error.message) ||
                'Internal server error',
            });
          }
        }
      })
      .catch((error) => {
        if (error.name === 'AbortError') return;
        let msg = error.message;
        if (error.message === 'Network request failed') {
          msg = 'Server is not connected';
        }
        setServerStatus({
          status: 'disconnected',
          message: msg,
        });
      });
  }, [checkingServer, settings.server]);

  return (
    <Surface
      style={tw`flex h-full justify-center items-center`}
      elevation={1}
      mode="flat"
    >
      <List.Section style={tw`w-full`}>
        <List.Subheader>Theme</List.Subheader>
        <List.Item
          title="Dark mode"
          right={() => (
            <Switch
              value={settings.theme === 'dark'}
              onValueChange={(value: boolean) => {
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
      </List.Section>
      <StatusBar />
    </Surface>
  );
};
