import 'express-async-errors';
import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import authRouter from './routers/auth';
import profilRouter from './routers/profil';
import scanRouter from './routers/scan';
import accidentsRouter from './routers/accidents';
import proAuthRouter from './routers/proAuth';
import alertesRouter from './routers/alertes';
import geodecisionRouter from './routers/geodecision';
import roadReportsRouter from './routers/roadReports';
import respondersRouter from './routers/responders';
import zemRouter from './routers/zem';
import operationsRouter from './routers/operations';
import aiRouter from './routers/ai';
import { pool } from './database';

dotenv.config();

const app = express();

const corsFallback = process.env.NODE_ENV === 'production'
  ? 'https://lotisec-frontend.vercel.app,https://lotisec-console.vercel.app'
  : '*';
const allowedOrigins = (process.env.CORS_ORIGINS || process.env.CORS_ORIGIN || corsFallback).split(',').map((value) => value.trim());
app.use(cors({ origin: (origin, callback) => {
  const isLocalDevelopment = Boolean(origin && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin));
  if (!origin || isLocalDevelopment || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) return callback(null, true);
  return callback(new Error('Origin not allowed by CORS'));
}, credentials: true }));
app.use(express.json({ limit: '2mb' }));

app.get('/', (_req, res) => {
  res.json({
    status: 'online',
    project: '118 Node API',
    db_configured: Boolean(process.env.DATABASE_URL)
  });
});

app.get('/health', async (_req, res) => {
  try {
    if (!pool) {
      return res.status(500).json({ ok: false, db: 'missing-config', detail: 'DATABASE_URL is not configured' });
    }
    await pool.query('SELECT 1');
    return res.json({ ok: true, db: 'up' });
  } catch (error: any) {
    return res.status(500).json({ ok: false, db: 'down', detail: error.message });
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
app.use('/zem', zemRouter);
app.use('/api/v1', operationsRouter);
app.use('/ai', aiRouter);

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  // Keep backend errors explicit in JSON to simplify frontend diagnosis.
  const detail = err?.message || 'Internal server error';
  // eslint-disable-next-line no-console
  console.error('Unhandled API error:', err);
  res.status(500).json({ detail });
});

export default app;
