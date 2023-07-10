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
