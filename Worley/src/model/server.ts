import { useSettings } from './settings';
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
  const setStatus = (new_status: Omit<ServerStatus, 'last_connected'>) => {
    _setStatus({
      ...new_status,
      last_connected:
        new_status.status === 'connected' ? Date.now() : status.last_connected,
    });
  };
  return [status, setStatus] as const;
};

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
    const signal = controller.signal;
    const timeoutID = setTimeout(() => abort(), timeout);

    setServerStatus({
      status: 'connecting',
      message: 'Connecting to server...',
    });

    fetch(`http://${settings.server}/ping`, { signal })
      .then((response) => {
        clearTimeout(timeoutID);
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

    return timeoutID;
  }

  return [abort, updateServerStatus];
}
