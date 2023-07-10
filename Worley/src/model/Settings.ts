import { atom, useRecoilState } from 'recoil';

import AsyncStorage from '@react-native-async-storage/async-storage';

export type SettingsType = {
  theme: string;
  server: string;
};

const Settings = atom<SettingsType>({
  key: 'Settings',
  default: {
    theme: 'light',
    server: '192.168.6.1',
  },
});

async function setLocalSettings(newSettings: SettingsType) {
  const storedSettings = await AsyncStorage.getItem('settings');
  const parsedSettings = storedSettings ? JSON.parse(storedSettings) : {};
  const mergedSettings = { ...parsedSettings, ...newSettings };
  await AsyncStorage.setItem('settings', JSON.stringify(mergedSettings));
}

export function useSettings() {
  const [settings, _setSettings] = useRecoilState(Settings);
  const setSettings = (newSettings: SettingsType) =>
    (async () => {
      setLocalSettings(newSettings);
      setLocalSettings(newSettings);
      _setSettings({
        ...settings,
        ...newSettings,
      });
    })();
  return [settings, setSettings] as const;
}
