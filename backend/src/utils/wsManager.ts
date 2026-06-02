import WebSocket from 'ws';

const clients = new Set<WebSocket>();

export function addClient(client: WebSocket) {
  clients.add(client);
}

export function removeClient(client: WebSocket) {
  clients.delete(client);
}

export function broadcast(payload: Record<string, unknown>) {
  const data = JSON.stringify(payload);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  }
}

export function connectedClientsCount() {
  return clients.size;
}
