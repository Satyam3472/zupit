import type { Request, Response, NextFunction } from 'express';
import {
  verifyAdminToken,
  verifyRiderAccessToken,
  type AdminJwtPayload,
  type RiderAccessJwtPayload,
} from '../auth/jwt.js';

// Extend Express Request interface to include admin and rider
declare global {
  namespace Express {
    interface Request {
      admin?: AdminJwtPayload;
      rider?: RiderAccessJwtPayload;
    }
  }
}

/**
 * Extracts bearer token from Authorization header or cookie
 */
function extractToken(req: Request, cookieName: string): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  if (req.cookies && req.cookies[cookieName]) {
    return req.cookies[cookieName];
  }
  return null;
}

/**
 * Protects Admin API routes
 */
export async function requireAdminApi(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const token = extractToken(req, 'admin_token');
  if (!token) {
    res.status(401).json({
      success: false,
      error: 'UNAUTHORIZED',
      message: 'Authentication required. Please log in as an administrator.',
    });
    return;
  }

  const payload = await verifyAdminToken(token);
  if (!payload) {
    res.status(401).json({
      success: false,
      error: 'INVALID_TOKEN',
      message: 'Admin session expired or invalid. Please log in again.',
    });
    return;
  }

  req.admin = payload;
  next();
}

/**
 * Protects Rider API routes
 */
export async function requireRiderApi(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const token = extractToken(req, 'rider_access_token');
  if (!token) {
    res.status(401).json({
      success: false,
      error: 'UNAUTHORIZED',
      message: 'Rider authentication required.',
    });
    return;
  }

  const payload = await verifyRiderAccessToken(token);
  if (!payload) {
    res.status(401).json({
      success: false,
      error: 'INVALID_TOKEN',
      message: 'Rider session expired or invalid.',
    });
    return;
  }

  req.rider = payload;
  next();
}

/**
 * Role-based access control guard for admins
 */
export function requireRole(allowedRoles: ('owner' | 'ops')[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.admin) {
      res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Authentication required.',
      });
      return;
    }

    if (!allowedRoles.includes(req.admin.role)) {
      res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: `Forbidden: role '${req.admin.role}' cannot perform this action. Required: ${allowedRoles.join(', ')}`,
      });
      return;
    }

    next();
  };
}

/**
 * Protects /admin/** HTML pages
 */
export async function protectAdminPages(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Allow login page and assets
  if (req.path === '/admin/login' || req.path === '/admin/login/' || req.path.startsWith('/admin/static')) {
    next();
    return;
  }

  const token = extractToken(req, 'admin_token');
  if (!token) {
    res.redirect('/admin/login');
    return;
  }

  const payload = await verifyAdminToken(token);
  if (!payload) {
    res.clearCookie('admin_token');
    res.redirect('/admin/login');
    return;
  }

  req.admin = payload;
  next();
}

/**
 * Protects /rider/** HTML pages
 */
export async function protectRiderPages(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Allow login page and assets
  if (req.path === '/rider/login' || req.path === '/rider/login/' || req.path.startsWith('/rider/static')) {
    next();
    return;
  }

  const token = extractToken(req, 'rider_access_token');
  if (!token) {
    res.redirect('/rider/login');
    return;
  }

  const payload = await verifyRiderAccessToken(token);
  if (!payload) {
    res.clearCookie('rider_access_token');
    res.redirect('/rider/login');
    return;
  }

  req.rider = payload;
  next();
}
