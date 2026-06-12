import http from 'http';
import { WebSocketServer } from 'ws';
import app from './app';
import { addClient, removeClient, connectedClientsCount } from './utils/wsManager';
const server = http.createServer(app);

const wss = new WebSocketServer({ noServer: true });

wss.on('connection', (socket) => {
  addClient(socket);

  socket.on('message', (raw) => {
    const msg = raw.toString();
    if (msg === 'ping') {
      socket.send('pong');
    }
  });

  socket.on('close', () => {
    removeClient(socket);
  });
});

server.on('upgrade', (request, socket, head) => {
  if (request.url?.startsWith('/ws/alertes')) {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

app.get('/ws-status', (_req, res) => {
  res.json({ websocket_clients: connectedClientsCount() });
});

const port = Number(process.env.PORT || 8000);
server.listen(port, '0.0.0.0', () => {
  // eslint-disable-next-line no-console
  console.log(`118 Node API running on :${port}`);
});
