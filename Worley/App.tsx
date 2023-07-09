import React from 'react';
import { Text, View } from 'react-native';
import tw from 'twrnc';

import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { StatusBar } from 'expo-status-bar';

function Main() {
  return (
    <View style={tw`flex h-full justify-center items-center mx-auto`}>
      <Text>Open up App.tsx to start working on your app!</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const { Navigator, Screen } = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Navigator>
        <Screen name="Main" component={Main} />
      </Navigator>
    </NavigationContainer>
  );
}
