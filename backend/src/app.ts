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
import { pool } from './database';

dotenv.config();

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json({ limit: '2mb' }));

app.get('/', (_req, res) => {
  res.json({
    status: 'online',
    project: 'SafeLife Node API',
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

export default app;
