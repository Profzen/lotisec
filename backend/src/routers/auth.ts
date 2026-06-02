import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { query } from '../database';

const router = Router();

const registerSchema = z.object({
  phone: z.string().min(6),
  password: z.string().min(4)
});

const loginSchema = z.object({
  phone: z.string().min(6),
  password: z.string().min(4)
});

function signToken(userId: string) {
  const secret = process.env.JWT_SECRET || 'lotisec_secret_2026';
  return jwt.sign({ sub: userId }, secret, { expiresIn: '7d' });
}

router.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ detail: parsed.error.issues[0]?.message || 'Payload invalide' });
  }

  const { phone, password } = parsed.data;
  const existing = await query<{ id: string }>('SELECT id FROM users WHERE phone = $1 LIMIT 1', [phone]);
  if (existing.rows.length > 0) {
    return res.status(400).json({ detail: 'Ce numero de telephone est deja enregistre.' });
  }

  const userId = uuidv4();
  const profileId = uuidv4();
  const qrToken = uuidv4().slice(0, 8).toUpperCase();
  const passwordHash = await bcrypt.hash(password, 10);

  await query(
    'INSERT INTO users (id, phone, password) VALUES ($1, $2, $3)',
    [userId, phone, passwordHash]
  );

  await query(
    `INSERT INTO profiles (
      id, user_id, qr_token, profile_type, first_name, last_name, birth_date,
      gender, nationality, blood_type, access_code, has_vehicle
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [
      profileId,
      userId,
      qrToken,
      'CITIZEN',
      'Utilisateur',
      'SafeLife',
      '01/01/2000',
      'M',
      'Togo',
      'NC',
      '1234',
      false
    ]
  );

  return res.json({
    status: 'success',
    token: signToken(userId),
    user: { id: userId, phone, qr_token: qrToken }
  });
});

router.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ detail: parsed.error.issues[0]?.message || 'Payload invalide' });
  }

  const { phone, password } = parsed.data;
  const result = await query<{
    id: string;
    phone: string;
    password: string;
    qr_token: string | null;
  }>(
    `SELECT u.id, u.phone, u.password, p.qr_token
     FROM users u
     LEFT JOIN profiles p ON p.user_id = u.id
     WHERE u.phone = $1
     LIMIT 1`,
    [phone]
  );

  const user = result.rows[0];
  if (!user) {
    return res.status(401).json({ detail: 'Numero ou mot de passe incorrect.' });
  }

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) {
    return res.status(401).json({ detail: 'Numero ou mot de passe incorrect.' });
  }

  return res.json({
    status: 'success',
    token: signToken(user.id),
    user: {
      id: user.id,
      phone: user.phone,
      qr_token: user.qr_token
    }
  });
});

export default router;
