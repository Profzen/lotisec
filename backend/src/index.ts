import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import http from 'http';
import { WebSocketServer } from 'ws';
import { pool } from './database';
import authRouter from './routers/auth';
import profilRouter from './routers/profil';
import scanRouter from './routers/scan';
import accidentsRouter from './routers/accidents';
import proAuthRouter from './routers/proAuth';
import alertesRouter from './routers/alertes';
import geodecisionRouter from './routers/geodecision';
import roadReportsRouter from './routers/roadReports';
import respondersRouter from './routers/responders';
import { addClient, removeClient, connectedClientsCount } from './utils/wsManager';

dotenv.config();

const app = express();
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

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json({ limit: '2mb' }));

app.get('/', (_req, res) => {
  res.json({
    status: 'online',
    project: 'SafeLife Node API',
    websocket_clients: connectedClientsCount()
  });
});

app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, db: 'up' });
  } catch (error: any) {
    res.status(500).json({ ok: false, db: 'down', detail: error.message });
  }
});

app.use('/auth', authRouter);
app.use('/profil', profilRouter);
app.use('/scan', scanRouter);
app.use('/scans', scanRouter);
app.use('/accidents', accidentsRouter);
app.use('/pro', proAuthRouter);
app.use('/alertes', alertesRouter);
app.use('/geo', geodecisionRouter);
app.use('/road-reports', roadReportsRouter);
app.use('/responders', respondersRouter);

const port = Number(process.env.PORT || 8000);
server.listen(port, '0.0.0.0', () => {
  // eslint-disable-next-line no-console
  console.log(`SafeLife Node API running on :${port}`);
});
