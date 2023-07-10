export function fetch_server(server: string, url: string, data: RequestInit) {
  if (url[0] !== '/') {
    url = '/' + url;
  }
  return fetch(server + url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
}

export function post_json(server: string, url: string, data: any) {
  return fetch_server(server, url, {
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
  server: string,
  data: ServerOfferPayload,
): Promise<ServerOfferResponse> {
  const res = await post_json(server, 'offer', data);
  return await res.json();
}
