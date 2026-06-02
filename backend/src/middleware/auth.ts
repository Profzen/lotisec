import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

type JwtPayload = {
  sub: string;
};

export interface AuthRequest extends Request {
  userId?: string;
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ detail: 'Token manquant' });
  }

  try {
    const secret = process.env.JWT_SECRET || 'lotisec_secret_2026';
    const decoded = jwt.verify(token, secret) as JwtPayload;
    req.userId = decoded.sub;
    return next();
  } catch {
    return res.status(401).json({ detail: 'Token invalide' });
  }
}
