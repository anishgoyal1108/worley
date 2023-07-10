import React from 'react';
import { StatusBar, Text, View } from 'react-native';
import tw from 'twrnc';

import { useSettings } from '@model';

export const Settings = () => {
  const [settings, setSettings] = useSettings();

  return (
    <View style={tw`flex h-full justify-center items-center mx-auto`}>
      <Text>Open up App.tsx to start working on your app!</Text>
      <StatusBar />
    </View>
  );
};
