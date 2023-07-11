import { SettingsType, useSettings } from './settings';
import { useEffect } from 'react';
import { atom, useRecoilState } from 'recoil';

export type ServerStatus = {
  status: 'connected' | 'connecting' | 'disconnected';
  message?: string;
  last_connected?: number; // epoch time
};

const serverStatusState = atom<ServerStatus>({
  key: 'serverStatusState',
  default: {
    status: 'disconnected',
    message: 'Not connected to server',
    last_connected: 0,
  },
});

export const useServerStatus = () => {
  const [status, _setStatus] = useRecoilState(serverStatusState);
  const [settings, _] = useSettings();
  useEffect(() => {
    const [promise, id] = fetchServerStatus(settings);
    promise.then((status) => {
      if (status) _setStatus(status);
      else
        _setStatus({
          status: 'disconnected',
          message: 'Check server timed out',
        });
    });
    return () => clearTimeout(id);
  }, []);
  const setStatus = (new_status: Omit<ServerStatus, 'last_connected'>) => {
    _setStatus({
      ...new_status,
      last_connected:
        new_status.status === 'connected' ? Date.now() : status.last_connected,
    });
  };
  return [status, setStatus] as const;
};

function fetchServerStatus(
  settings: SettingsType,
  controller?: AbortController,
  timeout: number = 1000,
): [Promise<Omit<ServerStatus, 'last_connected'> | undefined>, NodeJS.Timeout] {
  if (!controller) controller = new AbortController();
  const signal = controller.signal;
  const timeoutID = setTimeout(() => controller?.abort(), timeout);

  const promise = fetch(`http://${settings.server}/ping`, { signal })
    .then((response) => {
      clearTimeout(timeoutID);
      if (response.ok) {
        return {
          status: 'connected',
          message: 'Server is connected',
        };
      } else {
        try {
          response.json().then((json) => {
            const msg = json.message as string;
            return {
              status: 'disconnected',
              message: msg,
            };
          });
        } catch (error: any) {
          const msg: string =
            (error.hasOwnProperty('message') && error.message) ||
            'Internal server error';
          return {
            status: 'disconnected',
            message: msg,
          };
        }
      }
    })
    .catch((error) => {
      if (error.name === 'AbortError') return;
      let msg = error.message as string;
      if (msg === 'Network request failed') msg = 'Server is not connected';
      return {
        status: 'disconnected',
        message: msg,
      };
    }) as Promise<Omit<ServerStatus, 'last_connected'> | undefined>;
  return [promise, timeoutID];
}

export function useServerStatusUpdater(
  timeout: number = 1000,
): [abort: () => void, updateServerStatus: () => NodeJS.Timeout] {
  const controller = new AbortController();
  const settings = useSettings()[0],
    [status, setServerStatus] = useServerStatus();

  function abort() {
    if (status.status === 'connected') return;
    if (status.status === 'connecting') {
      controller.abort();
      setServerStatus({
        status: 'disconnected',
        message: 'Check server timed out',
      });
    }
  }

  function updateServerStatus() {
    setServerStatus({
      status: 'connecting',
      message: 'Checking server status...',
    });
    const [promise, id] = fetchServerStatus(settings, controller, timeout);
    promise.then((status) => {
      if (status) setServerStatus(status);
      else
        setServerStatus({
          status: 'disconnected',
          message: 'Check server timed out',
        });
    });
    return id;
  }

  return [abort, updateServerStatus];
}
