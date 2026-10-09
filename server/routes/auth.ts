import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { z } from 'zod';
import { db } from '../db/index.ts';
import { d1Client } from '../db/d1Client.ts';
import { AuthRequest, generateToken, requireAuth, requireRole } from '../middleware/auth.ts';
import { validateBody } from '../middleware/validate.ts';
import { createRateLimiter } from '../middleware/security.ts';
import { sendEmail } from '../utils/email.ts';
import { CONFIG } from '../config.ts';

const router = Router();

// Restricted diagnostic endpoint. Never expose configured credentials or raw user data.
router.get('/debug-admin', requireAuth, requireRole(['admin']), async (_req, res) => {
  try {
    const result = await d1Client.query("SELECT COUNT(*) AS total_users, SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) AS admin_count FROM users");
    if (!result.success || !result.results?.[0]) {
      return res.status(503).json({ success: false, error: 'Admin diagnostics are temporarily unavailable' });
    }
    return res.json({
      success: true,
      database: {
        totalUsersCount: Number(result.results[0].total_users),
        adminCount: Number(result.results[0].admin_count)
      }
    });
  } catch (error: any) {
    console.error('[Admin diagnostics] Query failed:', error?.message || error);
    return res.status(503).json({ success: false, error: 'Admin diagnostics are temporarily unavailable' });
  }
});

// Strict rate limiters for auth, login, and OTP attempts
const loginLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many login attempts. Please try again in 15 minutes.'
});

const otpLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: 'Too many verification code requests. Please try again later.'
});

const forgotLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: 'Too many password recovery requests. Please try again later.'
});

const RegisterSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  role: z.enum(['customer']).default('customer'),
  phone: z.string().optional(),
  address: z.string().optional(),
  restaurantId: z.string().optional(),
  code: z.string().length(6, 'Verification code must be exactly 6 digits')
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string()
});

router.post('/register', otpLimiter, validateBody(RegisterSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { email, password, name, role, phone, address, restaurantId, code } = req.body;

    if (role === 'admin' || role === 'sub_admin') {
      return res.status(403).json({
        success: false,
        error: 'Privileged accounts (Sub Admin / Admin) cannot be self-registered. They can only be assigned by a Super Admin in Staff Management.'
      });
    }

    const existingUser = await db.findUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: 'An account with this email address already exists.'
      });
    }

    // Verify OTP code first!
    const isValid = await db.verifyOtp(email, code, 'register');
    if (!isValid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired email verification code. Please try again.'
      });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const now = new Date().toISOString();

    const newUser = await db.createUser({
      id: `usr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      email,
      passwordHash,
      name,
      role,
      phone,
      address,
      restaurantId: role === 'restaurant' ? restaurantId || 'rest-1' : undefined,
      walletBalanceUSD: 0,
      walletBalanceNGN: 0,
      savedAddresses: address ? [{
        id: `addr-${Date.now()}`,
        label: 'Home',
        address,
        city: 'New York',
        isDefault: true
      }] : [],
      createdAt: now,
      updatedAt: now
    });

    const token = generateToken(newUser);

    res.cookie('veyrang_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });
    res.cookie('veyrang_auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    await db.logAudit({
      userId: newUser.id,
      userEmail: newUser.email,
      userRole: newUser.role,
      action: 'USER_REGISTERED',
      resource: 'USER',
      resourceId: newUser.id,
      ip: req.ip
    });

    const { passwordHash: _, ...safeUser } = newUser;
    const sanitizedUser = {
      ...safeUser,
      name: safeUser.name || (safeUser.email ? safeUser.email.split('@')[0] : 'User')
    };
    return res.status(201).json({
      success: true,
      data: { user: sanitizedUser, token }
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    return res.status(500).json({ success: false, error: `Registration failed: ${error?.message || String(error)}` });
  }
});

// Login
router.post('/login', loginLimiter, validateBody(LoginSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { email: rawEmail, password: rawPassword } = req.body;
    const email = String(rawEmail || '').toLowerCase().trim();
    const cleanPassword = String(rawPassword || '').trim();

    // Admin login: env credentials only — no hardcoded emails/passwords
    const configuredAdminEmail = (process.env.ADMIN_EMAIL || CONFIG.ADMIN_EMAIL || '').toLowerCase().trim();
    const configuredAdminPass = (process.env.ADMIN_PASSWORD || CONFIG.ADMIN_PASSWORD || '').trim();

    if (
      configuredAdminEmail &&
      configuredAdminPass &&
      email === configuredAdminEmail &&
      cleanPassword === configuredAdminPass
    ) {
      const adminUser: any = {
        id: 'usr-admin-1',
        email: configuredAdminEmail,
        name: 'System Administrator',
        role: 'admin',
        phone: '',
        walletBalanceUSD: 0,
        walletBalanceNGN: 0,
        savedAddresses: []
      };
      const token = generateToken(adminUser);
      res.cookie('veyrang_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000
      });
      res.cookie('veyrang_auth_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000
      });
      return res.json({
        success: true,
        data: { user: adminUser, token }
      });
    }

    let user: any = null;

    try {
      const d1Res = await d1Client.query('SELECT * FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1', [email.trim()]);
      if (d1Res.results && d1Res.results.length > 0) {
        const u: any = d1Res.results[0];
        let parsedAddresses: any[] = [];
        try {
          parsedAddresses = typeof u.saved_addresses === 'string' ? JSON.parse(u.saved_addresses) : (u.saved_addresses || []);
        } catch (e) {}

        user = {
          id: u.id,
          email: u.email,
          passwordHash: u.password_hash,
          name: u.name,
          role: u.role,
          phone: u.phone,
          address: u.address,
          restaurantId: u.restaurant_id,
          walletBalanceUSD: u.wallet_balance_usd || 0,
          walletBalanceNGN: u.wallet_balance_ngn || 0,
          savedAddresses: parsedAddresses,
          createdAt: u.created_at,
          updatedAt: u.updated_at
        };
      }
    } catch (e) {
      console.warn('D1 direct login lookup note:', e);
    }

    if (!user) {
      user = await db.findUserByEmail(email);
    }

    if (!user || !user.passwordHash) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password.'
      });
    }

    const isMatch = await bcrypt.compare(cleanPassword, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password.'
      });
    }

    const token = generateToken(user);

    res.cookie('veyrang_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });
    res.cookie('veyrang_auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    await db.logAudit({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      action: 'USER_LOGIN',
      resource: 'AUTH',
      resourceId: user.id,
      ip: req.ip
    });

    const { passwordHash: _, ...safeUser } = user;
    const sanitizedUser = {
      ...safeUser,
      name: safeUser.name || (safeUser.email ? safeUser.email.split('@')[0] : 'User')
    };
    return res.json({
      success: true,
      data: { user: sanitizedUser, token }
    });
  } catch (error: any) {
    console.error('Login error:', error);
    return res.status(500).json({ success: false, error: `Login failed: ${error?.message || String(error)}` });
  }
});
