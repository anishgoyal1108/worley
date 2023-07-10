import React from "react";
import { Text, View } from "react-native";
import tw from "twrnc";
import { StatusBar } from "expo-status-bar";

export function Main() {
  return (
    <View style={tw`flex h-full justify-center items-center mx-auto`}>
      <Text>Open up App.tsx to start working on your app!</Text>
      <StatusBar style="auto" />
    </View>
  );
}
