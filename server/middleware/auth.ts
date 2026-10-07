import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../db/index.ts';
import { User, UserRole } from '../db/schema.ts';

import { CONFIG } from '../config.ts';

const JWT_SECRET = CONFIG.JWT_SECRET;
const TOKEN_EXPIRY = '7d';

export interface AuthRequest extends Request {
  user?: User;
}

export function generateToken(user: User): string {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      restaurantId: user.restaurantId
    },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  );
}

export async function authenticateToken(req: AuthRequest, res: Response, next: NextFunction) {
  let token: string | undefined;

  // 1. Check HTTP-Only Cookie (supports both veyrang_token and veyrang_auth_token for Safari/browser compatibility)
  if (req.cookies) {
    if (req.cookies.veyrang_token) {
      token = req.cookies.veyrang_token;
    } else if (req.cookies.veyrang_auth_token) {
      token = req.cookies.veyrang_auth_token;
    }
  }

  // 2. Check Authorization Header Bearer token
  if (!token && req.headers.authorization) {
    const parts = req.headers.authorization.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
      token = parts[1];
    }
  }

  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; email: string };
    let user = await db.findUserById(decoded.id);
    if (!user) {
      const { d1Client } = await import('../db/d1Client.ts');
      const d1User = await d1Client.query('SELECT * FROM users WHERE id = ? OR email = ?', [decoded.id, decoded.email]);
      if (d1User.results?.length > 0) {
        const u: any = d1User.results[0];
        user = {
          id: u.id,
          email: u.email,
          passwordHash: u.password_hash || '',
          name: u.name,
          role: u.role,
          phone: u.phone,
          address: u.address,
          restaurantId: u.restaurant_id,
          walletBalanceUSD: u.wallet_balance_usd || 0,
          walletBalanceNGN: u.wallet_balance_ngn || 0,
          savedAddresses: [],
          createdAt: u.created_at,
          updatedAt: u.updated_at
        };
      }
    }
    if (user) {
      req.user = user;
    }
  } catch (err) {
    // Expired or invalid token: user remains undefined
  }

  next();
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required. Please sign in.'
    });
  }
  next();
}

export function requireRole(allowedRoles: UserRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required.'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `Access denied. Requires one of roles: [${allowedRoles.join(', ')}]`
      });
    }

    next();
  };
}
