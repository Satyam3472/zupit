import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'zupit_super_secret_jwt_key_jamui_bihar_2026_secure'
);

export interface AdminJwtPayload extends JWTPayload {
  userId: string;
  email: string;
  role: 'owner' | 'ops';
  type: 'admin';
}

export interface RiderAccessJwtPayload extends JWTPayload {
  userId: string;
  phone: string;
  name: string;
  type: 'rider_access';
}

export interface RiderRefreshJwtPayload extends JWTPayload {
  userId: string;
  phone: string;
  type: 'rider_refresh';
}

/**
 * Creates an admin JWT valid for 8 hours
 */
export async function createAdminToken(admin: {
  id: string;
  email: string;
  role: 'owner' | 'ops';
}): Promise<string> {
  return new SignJWT({
    userId: admin.id,
    email: admin.email,
    role: admin.role,
    type: 'admin',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(JWT_SECRET);
}

/**
 * Creates rider tokens:
 * - Access token: valid for 15 minutes
 * - Refresh token: valid for 30 days
 */
export async function createRiderTokens(rider: {
  id: string;
  phone: string;
  name: string;
}): Promise<{ accessToken: string; refreshToken: string }> {
  const accessToken = await new SignJWT({
    userId: rider.id,
    phone: rider.phone,
    name: rider.name,
    type: 'rider_access',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(JWT_SECRET);

  const refreshToken = await new SignJWT({
    userId: rider.id,
    phone: rider.phone,
    type: 'rider_refresh',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(JWT_SECRET);

  return { accessToken, refreshToken };
}

/**
 * Verifies any token with type checking
 */
export async function verifyToken<T extends JWTPayload>(token: string): Promise<T | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as T;
  } catch {
    return null;
  }
}

export async function verifyAdminToken(token: string): Promise<AdminJwtPayload | null> {
  const payload = await verifyToken<AdminJwtPayload>(token);
  if (payload && payload.type === 'admin') {
    return payload;
  }
  return null;
}

export async function verifyRiderAccessToken(token: string): Promise<RiderAccessJwtPayload | null> {
  const payload = await verifyToken<RiderAccessJwtPayload>(token);
  if (payload && payload.type === 'rider_access') {
    return payload;
  }
  return null;
}

export async function verifyRiderRefreshToken(token: string): Promise<RiderRefreshJwtPayload | null> {
  const payload = await verifyToken<RiderRefreshJwtPayload>(token);
  if (payload && payload.type === 'rider_refresh') {
    return payload;
  }
  return null;
}
