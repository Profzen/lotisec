import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { query } from '../database';
import { AuthRequest, requireAuth } from '../middleware/auth';
import { permissionsFor, rolesForOrganization } from '../security/rbac';
import { jwtSecret } from '../security/jwt';

const router = Router();

const registerSchema = z.object({
  phone: z.string().min(6),
  password: z.string().min(8),
  account_type: z.enum(['citizen', 'zem_driver']).optional().default('citizen'),
  zem_application: z.object({
    identity_document: z.string().min(2),
    license_number: z.string().min(2),
    motorcycle_make: z.string().min(1),
    motorcycle_model: z.string().optional(),
    plate: z.string().min(2),
    work_zone: z.string().min(1)
  }).optional()
});

const loginSchema = z.object({
  phone: z.string().min(6),
  password: z.string().min(8)
});

async function sessionFor(userId: string, requestedOrganizationId?: string | null) {
  const memberships = await query<any>(
    `SELECT ur.role_key, ur.organization_id, o.name AS organization_name, o.type AS organization_type
     FROM user_roles ur
     LEFT JOIN organizations o ON o.id = ur.organization_id
     LEFT JOIN organization_members om ON om.organization_id=ur.organization_id AND om.user_id=ur.user_id
     WHERE ur.user_id = $1 AND (ur.organization_id IS NULL OR (om.status='active' AND o.active=true))
     ORDER BY ur.created_at ASC`, [userId]
  );
  const organizationRows = memberships.rows.filter((row: any) => row.organization_id);
  const activeOrganization = requestedOrganizationId
    ? organizationRows.find((row: any) => row.organization_id === requestedOrganizationId)
    : organizationRows[0] || null;
  if (requestedOrganizationId && !activeOrganization) throw new Error('Organisation non autorisée');
  const roles = rolesForOrganization(memberships.rows,activeOrganization?.organization_id);
  if (roles.length === 0) roles.push('citizen');
  return {
    roles: [...new Set(roles)],
    permissions: permissionsFor(roles),
    organizationId: activeOrganization?.organization_id || null,
    organization: activeOrganization ? {
      id: activeOrganization.organization_id,
      name: activeOrganization.organization_name,
      type: activeOrganization.organization_type
    } : null,
    organizations: [...new Map(organizationRows.map((row: any) => [row.organization_id, {
      id:row.organization_id,name:row.organization_name,type:row.organization_type
    }])).values()]
  };
}

function signToken(userId: string, session: Awaited<ReturnType<typeof sessionFor>>) {
  return jwt.sign({ sub: userId, roles: session.roles, permissions: session.permissions, organizationId: session.organizationId }, jwtSecret(), { expiresIn: '12h' });
}

function signRealtimeToken(userId: string, session: Awaited<ReturnType<typeof sessionFor>>) {
  if (!process.env.SUPABASE_JWT_SECRET) return null;
  return jwt.sign({ sub:userId, role:'authenticated', app_user_id:userId, organization_id:session.organizationId, roles:session.roles }, process.env.SUPABASE_JWT_SECRET, { expiresIn:'1h' });
}

async function ensureProfile(userId: string) {
  const existing = await query<any>('SELECT id,qr_token,first_name,last_name FROM profiles WHERE user_id=$1 LIMIT 1',[userId]);
  if (existing.rows[0]?.qr_token) return existing.rows[0];
  const qrToken=uuidv4().slice(0,8).toUpperCase();
  if(existing.rows[0]){
    const repaired=await query<any>('UPDATE profiles SET qr_token=$1 WHERE id=$2 RETURNING id,qr_token,first_name,last_name',[qrToken,existing.rows[0].id]);
    return repaired.rows[0];
  }
  const created=await query<any>(`INSERT INTO profiles(id,user_id,qr_token,profile_type,first_name,last_name,birth_date,gender,nationality,blood_type,access_code,has_vehicle)
    VALUES($1,$2,$3,'CITIZEN','Utilisateur','LOTISEC','01/01/2000','NC','Togo','NC',$4,false)
    RETURNING id,qr_token,first_name,last_name`,[uuidv4(),userId,qrToken,uuidv4().slice(0,8)]);
  return created.rows[0];
}

router.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ detail: parsed.error.issues[0]?.message || 'Payload invalide' });
  }

  const { phone, password, account_type, zem_application } = parsed.data;
  if (account_type === 'zem_driver' && !zem_application) {
    return res.status(400).json({ detail: 'Les informations d’accréditation Zem sont requises.' });
  }
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
      '118',
      '01/01/2000',
      'M',
      'Togo',
      'NC',
      '1234',
      false
    ]
  );

  await query(
    `INSERT INTO user_roles (user_id, role_key, organization_id)
     VALUES ($1, 'citizen', NULL) ON CONFLICT DO NOTHING`, [userId]
  );

  if (account_type === 'zem_driver' && zem_application) {
    await query(
      `INSERT INTO zem_driver_applications
       (user_id, identity_document, license_number, motorcycle_make, motorcycle_model, plate, work_zone)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [userId, zem_application.identity_document || null, zem_application.license_number,
       zem_application.motorcycle_make, zem_application.motorcycle_model || null,
       zem_application.plate, zem_application.work_zone]
    );
  }

  const session = await sessionFor(userId);

  return res.json({
    status: 'success',
    token: signToken(userId, session),
    realtime_token: signRealtimeToken(userId, session),
    user: { id: userId, phone, qr_token: qrToken, ...session, is_zem:session.roles.includes('zem_driver') },
    zem_application_status: account_type === 'zem_driver' ? 'pending' : null
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

  const profile=await ensureProfile(user.id);
  const session = await sessionFor(user.id);
  return res.json({
    status: 'success',
    token: signToken(user.id, session),
    realtime_token: signRealtimeToken(user.id, session),
    user: {
      id: user.id,
      phone: user.phone,
      qr_token: profile.qr_token,
      ...session,
      is_zem:session.roles.includes('zem_driver')
    }
  });
});

router.get('/me', requireAuth, async (req: AuthRequest, res) => {
  await ensureProfile(req.userId as string);
  const result = await query<any>(
    `SELECT u.id, u.phone, p.qr_token, p.first_name, p.last_name
     FROM users u LEFT JOIN profiles p ON p.user_id = u.id WHERE u.id = $1 LIMIT 1`,
    [req.userId]
  );
  if (!result.rows[0]) return res.status(404).json({ detail: 'Utilisateur introuvable' });
  const session = await sessionFor(req.userId as string, req.organizationId);
  return res.json({ user: { ...result.rows[0], ...session, is_zem:session.roles.includes('zem_driver') } });
});

router.post('/realtime-token', requireAuth, async (req: AuthRequest, res) => {
  const session = await sessionFor(req.userId as string, req.organizationId);
  const token = signRealtimeToken(req.userId as string, session);
  if (!token) return res.status(503).json({ detail: 'Supabase Realtime non configuré' });
  return res.json({ token, expires_in: 3600 });
});

router.post('/switch-organization', requireAuth, async (req: AuthRequest, res) => {
  const parsed = z.object({ organization_id:z.string().uuid() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ detail:'Organisation invalide' });
  try {
    const session = await sessionFor(req.userId as string, parsed.data.organization_id);
    return res.json({ token:signToken(req.userId as string,session), realtime_token:signRealtimeToken(req.userId as string,session), session });
  } catch {
    return res.status(403).json({ detail:'Organisation non autorisée' });
  }
});

export default router;
