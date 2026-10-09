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
        error: 'Privileged accounts cannot be self-registered.'
      });
    }
    const existingUser = await db.findUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({ success: false, error: 'An account with this email address already exists.' });
    }
    const isValid = await db.verifyOtp(email, code, 'register');
    if (!isValid) {
      return res.status(400).json({ success: false, error: 'Invalid or expired email verification code.' });
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
      savedAddresses: address ? [{ id: `addr-${Date.now()}`, label: 'Home', address, city: 'Lagos', isDefault: true }] : [],
      createdAt: now,
      updatedAt: now
    });
    const token = generateToken(newUser);
    res.cookie('veyrang_token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 });
    res.cookie('veyrang_auth_token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 });
    await db.logAudit({ userId: newUser.id, userEmail: newUser.email, userRole: newUser.role, action: 'USER_REGISTERED', resource: 'USER', resourceId: newUser.id, ip: req.ip });
    const { passwordHash: _, ...safeUser } = newUser;
    return res.status(201).json({ success: true, data: { user: { ...safeUser, name: safeUser.name || (safeUser.email ? safeUser.email.split('@')[0] : 'User') }, token } });
  } catch (error: any) {
    console.error('Registration error:', error);
    return res.status(500).json({ success: false, error: `Registration failed: ${error?.message || String(error)}` });
  }
});

router.post('/login', loginLimiter, validateBody(LoginSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { email: rawEmail, password: rawPassword } = req.body;
    const email = String(rawEmail || '').toLowerCase().trim();
    const cleanPassword = String(rawPassword || '').trim();

    const configuredAdminEmail = (process.env.ADMIN_EMAIL || CONFIG.ADMIN_EMAIL || '').toLowerCase().trim();
    const configuredAdminPass = (process.env.ADMIN_PASSWORD || CONFIG.ADMIN_PASSWORD || '').trim();

    if (configuredAdminEmail && configuredAdminPass && email === configuredAdminEmail && cleanPassword === configuredAdminPass) {
      const adminUser: any = { id: 'usr-admin-1', email: configuredAdminEmail, name: 'System Administrator', role: 'admin', phone: '', walletBalanceUSD: 0, walletBalanceNGN: 0, savedAddresses: [] };
      const token = generateToken(adminUser);
      res.cookie('veyrang_token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 });
      res.cookie('veyrang_auth_token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 });
      return res.json({ success: true, data: { user: adminUser, token } });
    }

    let user: any = null;
    try {
      const d1Res = await d1Client.query('SELECT * FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1', [email.trim()]);
      if (d1Res.results && d1Res.results.length > 0) {
        const u: any = d1Res.results[0];
        let parsedAddresses: any[] = [];
        try { parsedAddresses = typeof u.saved_addresses === 'string' ? JSON.parse(u.saved_addresses) : (u.saved_addresses || []); } catch (e) {}
        user = {
          id: u.id, email: u.email, passwordHash: u.password_hash, name: u.name, role: u.role,
          phone: u.phone, address: u.address, restaurantId: u.restaurant_id,
          walletBalanceUSD: u.wallet_balance_usd || 0, walletBalanceNGN: u.wallet_balance_ngn || 0,
          savedAddresses: parsedAddresses, createdAt: u.created_at, updatedAt: u.updated_at
        };
      }
    } catch (e) {
      console.warn('D1 direct login lookup note:', e);
    }

    if (!user) user = await db.findUserByEmail(email);
    if (!user || !user.passwordHash) {
      return res.status(401).json({ success: false, error: 'Invalid email or password.' });
    }

    const isMatch = await bcrypt.compare(cleanPassword, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Invalid email or password.' });
    }

    const token = generateToken(user);
    res.cookie('veyrang_token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 });
    res.cookie('veyrang_auth_token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 });
    await db.logAudit({ userId: user.id, userEmail: user.email, userRole: user.role, action: 'USER_LOGIN', resource: 'AUTH', resourceId: user.id, ip: req.ip });
    const { passwordHash: _, ...safeUser } = user;
    return res.json({ success: true, data: { user: { ...safeUser, name: safeUser.name || (safeUser.email ? safeUser.email.split('@')[0] : 'User') }, token } });
  } catch (error: any) {
    console.error('Login error:', error);
    return res.status(500).json({ success: false, error: `Login failed: ${error?.message || String(error)}` });
  }
});

router.get('/me', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    let d1UserData: any = null;
    try {
      const d1Res = await d1Client.query('SELECT * FROM users WHERE id = ? LIMIT 1', [userId]);
      if (d1Res?.results?.length > 0) d1UserData = d1Res.results[0];
    } catch (e) {
      console.warn('D1 direct lookup in /me warning:', e);
    }
    if (d1UserData) {
      let parsedAddresses: any[] = [];
      try {
        parsedAddresses = typeof d1UserData.saved_addresses === 'string' ? JSON.parse(d1UserData.saved_addresses) : (d1UserData.saved_addresses || []);
      } catch (e) {}
      if (d1UserData.address && d1UserData.address.trim()) {
        const trimmedMain = d1UserData.address.trim().toLowerCase();
        if (!parsedAddresses.some((a: any) => (a.address || '').trim().toLowerCase() === trimmedMain)) {
          parsedAddresses.unshift({ id: 'addr-default-profile', label: 'Default Address', address: d1UserData.address.trim(), apartment: '', city: 'Lagos', isDefault: parsedAddresses.length === 0 });
        }
      }
      return res.json({
        success: true,
        data: {
          user: {
            id: d1UserData.id, email: d1UserData.email, name: d1UserData.name, role: d1UserData.role,
            phone: d1UserData.phone, address: d1UserData.address, restaurantId: d1UserData.restaurant_id,
            walletBalanceUSD: d1UserData.wallet_balance_usd || 0, walletBalanceNGN: d1UserData.wallet_balance_ngn || 0,
            savedAddresses: parsedAddresses, createdAt: d1UserData.created_at, updatedAt: d1UserData.updated_at
          }
        }
      });
    }
    const { passwordHash: _, ...safeUser } = req.user!;
    return res.json({ success: true, data: { user: { ...safeUser, name: safeUser.name || (safeUser.email ? safeUser.email.split('@')[0] : 'User') } } });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.patch('/profile', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { name, phone, address } = req.body;
    const userId = req.user!.id;
    const now = new Date().toISOString();
    const updates: string[] = [];
    const values: any[] = [];
    if (name !== undefined) { updates.push('name = ?'); values.push(typeof name === 'string' ? name.trim().slice(0, 100) : ''); }
    if (phone !== undefined) { updates.push('phone = ?'); values.push(typeof phone === 'string' ? phone.trim().slice(0, 30) : ''); }
    if (address !== undefined) { updates.push('address = ?'); values.push(typeof address === 'string' ? address.trim().slice(0, 300) : ''); }
    if (updates.length === 0) return res.status(400).json({ success: false, error: 'No valid profile fields provided for update.' });
    updates.push('updated_at = ?');
    values.push(now);
    values.push(userId);
    await d1Client.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values);
    const d1Res = await d1Client.query('SELECT * FROM users WHERE id = ? LIMIT 1', [userId]);
    const u: any = d1Res.results?.[0];
    return res.json({
      success: true,
      message: 'Profile updated in Cloudflare D1',
      data: {
        user: {
          id: u?.id || userId, email: u?.email || req.user!.email, name: u?.name || name || req.user!.name,
          role: u?.role || req.user!.role, phone: u?.phone || phone, address: u?.address || address,
          restaurantId: u?.restaurant_id, walletBalanceUSD: u?.wallet_balance_usd || 0, walletBalanceNGN: u?.wallet_balance_ngn || 0,
          savedAddresses: typeof u?.saved_addresses === 'string' ? JSON.parse(u.saved_addresses) : (u?.saved_addresses || []),
          createdAt: u?.created_at || now, updatedAt: u?.updated_at || now
        }
      }
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/addresses', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const d1Res = await d1Client.query('SELECT saved_addresses, address FROM users WHERE id = ? LIMIT 1', [req.user!.id]);
    const u: any = d1Res.results?.[0];
    let addresses: any[] = [];
    if (u?.saved_addresses) {
      try { addresses = typeof u.saved_addresses === 'string' ? JSON.parse(u.saved_addresses) : u.saved_addresses; } catch (e) {}
    }
    if (u?.address && u.address.trim()) {
      const trimmedMain = u.address.trim().toLowerCase();
      if (!addresses.some((a: any) => (a.address || '').trim().toLowerCase() === trimmedMain)) {
        addresses.unshift({ id: 'addr-default-profile', label: 'Default Address', address: u.address.trim(), apartment: '', city: 'Lagos', isDefault: addresses.length === 0 });
      }
    }
    return res.json({ success: true, data: addresses });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/addresses', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { label, address, apartment, city, isDefault } = req.body;
    if (!address) return res.status(400).json({ success: false, error: 'Address is required' });
    const userId = req.user!.id;
    const d1Res = await d1Client.query('SELECT saved_addresses FROM users WHERE id = ? LIMIT 1', [userId]);
    let list: any[] = [];
    if (d1Res.results?.[0]?.saved_addresses) {
      try { list = JSON.parse(d1Res.results[0].saved_addresses); } catch (e) {}
    }
    const newAddr = { id: `addr-${Date.now()}`, label: label || 'Home', address, apartment: apartment || '', city: city || 'Lagos', isDefault: Boolean(isDefault) };
    if (newAddr.isDefault) list = list.map((a: any) => ({ ...a, isDefault: false }));
    list.push(newAddr);
    await d1Client.query('UPDATE users SET saved_addresses = ?, address = ?, updated_at = ? WHERE id = ?', [JSON.stringify(list), address, new Date().toISOString(), userId]);
    return res.json({ success: true, message: 'Address saved to Cloudflare D1', data: list });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/addresses/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const d1Res = await d1Client.query('SELECT saved_addresses FROM users WHERE id = ? LIMIT 1', [userId]);
    let list: any[] = [];
    if (d1Res.results?.[0]?.saved_addresses) {
      try { list = JSON.parse(d1Res.results[0].saved_addresses); } catch (e) {}
    }
    list = list.filter((a: any) => a.id !== req.params.id);
    await d1Client.query('UPDATE users SET saved_addresses = ?, updated_at = ? WHERE id = ?', [JSON.stringify(list), new Date().toISOString(), userId]);
    return res.json({ success: true, message: 'Address removed from Cloudflare D1', data: list });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/wallet/topup', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { amount, reference, paymentMethod } = req.body;
    const cleanAmount = Number(amount);
    if (!cleanAmount || cleanAmount <= 0) {
      return res.status(400).json({ success: false, error: 'Valid top-up amount is required' });
    }
    const userId = req.user!.id;
    const now = new Date().toISOString();
    const ref = reference || `QB-WAL-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    await d1Client.query('UPDATE users SET wallet_balance_ngn = wallet_balance_ngn + ?, updated_at = ? WHERE id = ?', [cleanAmount, now, userId]);
    await d1Client.query(
      `INSERT INTO wallet_transactions (id, user_id, type, amount, currency, description, reference, payment_method, status, created_at)
       VALUES (?, ?, 'deposit', ?, 'NGN', 'Wallet top-up', ?, ?, 'completed', ?)`,
      [`tx-${Date.now()}`, userId, cleanAmount, ref, paymentMethod || 'manual', now]
    ).catch(() => {});
    const u = await d1Client.query('SELECT wallet_balance_ngn, wallet_balance_usd FROM users WHERE id = ? LIMIT 1', [userId]);
    return res.json({
      success: true,
      data: {
        walletBalanceNGN: Number(u.results?.[0]?.wallet_balance_ngn || 0),
        walletBalanceUSD: Number(u.results?.[0]?.wallet_balance_usd || 0),
        reference: ref
      }
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/forgot-password', forgotLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, error: 'Email is required' });
    const code = String(Math.floor(100000 + Math.random() * 900000));
    await db.createOtp(email, code, 'forgot');
    await sendEmail({
      to: email,
      subject: 'Reset your Veyrang Password',
      html: `<p>Your recovery OTP code is: <strong>${code}</strong></p>`,
      text: `Your recovery OTP code is: ${code}`,
      hostHeader: req.headers.host
    });
    return res.json({ success: true, message: 'Recovery OTP code has been sent to your email.' });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || 'Failed to send recovery code.' });
  }
});

router.post('/reset-password', forgotLimiter, async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    if (!email || !code || !newPassword || newPassword.length < 8) {
      return res.status(400).json({ success: false, error: 'Password must be at least 8 characters long.' });
    }
    const isValid = await db.verifyOtp(email, code, 'forgot');
    if (!isValid) return res.status(400).json({ success: false, error: 'Invalid or expired OTP code.' });
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);
    const success = await db.updateUserPassword(email, passwordHash);
    if (!success) return res.status(404).json({ success: false, error: 'User account not found.' });
    return res.json({ success: true, message: 'Your password has been successfully reset. Please sign in.' });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || 'Failed to reset password.' });
  }
});

export default router;
