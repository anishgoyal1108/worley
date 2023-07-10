import React from 'react';

import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { Main, Settings } from '@view';

const { Navigator, Screen } = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Navigator>
        <Screen name="Main" component={Main} />
        <Screen name="Settings" component={Settings} />
      </Navigator>
    </NavigationContainer>
  );
}
