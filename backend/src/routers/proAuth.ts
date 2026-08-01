import { Router } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { z } from 'zod';
import { PRO_USERS } from '../utils/proUsers';
import { jwtSecret } from '../security/jwt';

const router = Router();

const loginSchema = z.object({
  code: z.string().min(3),
  password: z.string().min(3)
});

router.post('/login', (req, res) => {
  if (process.env.NODE_ENV === 'production' && process.env.ENABLE_LEGACY_PRO_LOGIN !== 'true') {
    return res.status(410).json({ detail: 'Connexion institutionnelle historique désactivée. Utilisez /auth/login.' });
  }
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ detail: parsed.error.issues[0]?.message || 'Payload invalide' });
  }

  const code = parsed.data.code.toUpperCase().trim();
  const user = PRO_USERS[code];

  if (!user) {
    return res.status(401).json({ detail: 'Code institutionnel invalide' });
  }

  const hash = crypto.createHash('sha256').update(parsed.data.password).digest('hex');
  if (hash !== user.passwordHash) {
    return res.status(401).json({ detail: 'Mot de passe incorrect' });
  }

  const token = jwt.sign(
    { sub: code, nom: user.nom, role: user.role },
    jwtSecret(),
    { expiresIn: '12h' }
  );

  return res.json({
    token,
    user: {
      code,
      nom: user.nom,
      role: user.role,
      unite: user.unite,
      institution: user.unite
    }
  });
});

export default router;
