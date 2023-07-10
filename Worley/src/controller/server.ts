import { useSettings } from '@model';

export function fetch_server(url: string, data: RequestInit) {
  const [settings, _] = useSettings();
  if (url[0] !== '/') {
    url = '/' + url;
  }
  return fetch(settings.server + url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
}

export function post_json(url: string, data: any) {
  return fetch_server(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
}

export type ServerOfferResponse = {
  sdp: string;
  type: string;
};

export type ServerOfferPayload = {
  sdp: string;
  type: string;
};

export async function post_offer(
  data: ServerOfferPayload,
): Promise<ServerOfferResponse> {
  const res = await post_json('offer', data);
  return await res.json();
}
