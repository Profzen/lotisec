import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { jwtSecret } from '../security/jwt';

type JwtPayload = {
  sub: string;
  roles?: string[];
  permissions?: string[];
  organizationId?: string | null;
};

export interface AuthRequest extends Request {
  userId?: string;
  roles?: string[];
  permissions?: string[];
  organizationId?: string | null;
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ detail: 'Token manquant' });
  }

  try {
    const decoded = jwt.verify(token, jwtSecret()) as JwtPayload;
    req.userId = decoded.sub;
    req.roles = decoded.roles || [];
    req.permissions = decoded.permissions || [];
    req.organizationId = decoded.organizationId || null;
    return next();
  } catch {
    return res.status(401).json({ detail: 'Token invalide' });
  }
}

export function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction) {
  const token = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null;
  if (!token) return next();
  try {
    const decoded = jwt.verify(token, jwtSecret()) as JwtPayload;
    req.userId=decoded.sub; req.roles=decoded.roles||[]; req.permissions=decoded.permissions||[]; req.organizationId=decoded.organizationId||null;
  } catch { /* Une route publique ne fait pas confiance à un jeton invalide. */ }
  return next();
}

export function requirePermission(permission: string) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const granted = req.permissions || [];
    if (!granted.includes('*') && !granted.includes(permission)) {
      return res.status(403).json({ detail: 'Permission insuffisante', permission });
    }
    return next();
  };
}
