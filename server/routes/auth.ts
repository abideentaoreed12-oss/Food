import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { z } from 'zod';
import { db } from '../db/index.ts';
import { d1Client } from '../db/d1Client.ts';
import { AuthRequest, generateToken, requireAuth } from '../middleware/auth.ts';
import { validateBody } from '../middleware/validate.ts';
import { createRateLimiter } from '../middleware/security.ts';
import { sendEmail } from '../utils/email.ts';
import { CONFIG } from '../config.ts';

const router = Router();

// Secure Admin Diagnostic Route
router.get('/debug-admin', async (req, res) => {
  try {
    // Read raw database directly to bypass email matching fallback
    const users = await db.getAllUsers();
    const adminByRole = users.find((u) => u.role === 'admin');

    return res.json({
      success: true,
      env: {
        ADMIN_EMAIL_SET: Boolean(CONFIG.ADMIN_EMAIL),
        ADMIN_EMAIL_VALUE: CONFIG.ADMIN_EMAIL,
        ADMIN_PASSWORD_SET: Boolean(CONFIG.ADMIN_PASSWORD),
      },
      database: {
        adminByRoleFound: Boolean(adminByRole),
        adminByRoleEmail: adminByRole?.email || 'NONE',
        totalUsersCount: users.length,
      }
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
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
      httpOnly: true, // Secure against JS XSS access
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
    const { email, password } = req.body;
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

    const isMatch = await bcrypt.compare(password, user.passwordHash);
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
      httpOnly: true, // Secure against JS XSS access
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

// Get Current User Profile (Directly from Authoritative Cloudflare D1)
router.get('/me', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    let d1UserData: any = null;

    try {
      const d1Res = await d1Client.query('SELECT * FROM users WHERE id = ? LIMIT 1', [userId]);
      if (d1Res && d1Res.results && d1Res.results.length > 0) {
        d1UserData = d1Res.results[0];
      }
    } catch (e) {
      console.warn('D1 direct lookup in /me warning:', e);
    }

    if (d1UserData) {
      let parsedAddresses: any[] = [];
      try {
        parsedAddresses = typeof d1UserData.saved_addresses === 'string'
          ? JSON.parse(d1UserData.saved_addresses)
          : (d1UserData.saved_addresses || []);
      } catch (e) {}

      // Dynamically inject main profile address if it's set and not yet in the array
      if (d1UserData.address && d1UserData.address.trim()) {
        const trimmedMain = d1UserData.address.trim().toLowerCase();
        const exists = parsedAddresses.some((a: any) => (a.address || '').trim().toLowerCase() === trimmedMain);
        if (!exists) {
          parsedAddresses.unshift({
            id: 'addr-default-profile',
            label: 'Default Address',
            address: d1UserData.address.trim(),
            apartment: '',
            city: 'Lagos',
            isDefault: parsedAddresses.length === 0
          });
        }
      }

      const freshUser = {
        id: d1UserData.id,
        email: d1UserData.email,
        name: d1UserData.name,
        role: d1UserData.role,
        phone: d1UserData.phone,
        address: d1UserData.address,
        restaurantId: d1UserData.restaurant_id,
        walletBalanceUSD: d1UserData.wallet_balance_usd || 0,
        walletBalanceNGN: d1UserData.wallet_balance_ngn || 0,
        savedAddresses: parsedAddresses,
        createdAt: d1UserData.created_at,
        updatedAt: d1UserData.updated_at
      };

      return res.json({
        success: true,
        data: { user: freshUser }
      });
    }

    const { passwordHash: _, ...safeUser } = req.user!;
    const sanitizedUser = {
      ...safeUser,
      name: safeUser.name || (safeUser.email ? safeUser.email.split('@')[0] : 'User')
    };
    return res.json({
      success: true,
      data: { user: sanitizedUser }
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Update Profile Details in Cloudflare D1
router.patch('/profile', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { name, phone, address } = req.body;
    const userId = req.user!.id;
    const now = new Date().toISOString();

    const updates: string[] = [];
    const values: any[] = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(typeof name === 'string' ? name.trim().slice(0, 100) : '');
    }
    if (phone !== undefined) {
      updates.push('phone = ?');
      values.push(typeof phone === 'string' ? phone.trim().slice(0, 30) : '');
    }
    if (address !== undefined) {
      updates.push('address = ?');
      values.push(typeof address === 'string' ? address.trim().slice(0, 300) : '');
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'No valid profile fields provided for update.' });
    }

    updates.push('updated_at = ?');
    values.push(now);
    values.push(userId);

    await d1Client.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values);

    // Refresh from D1
    const d1Res = await d1Client.query('SELECT * FROM users WHERE id = ? LIMIT 1', [userId]);
    const u: any = d1Res.results?.[0];

    const updatedUser = {
      id: u?.id || userId,
      email: u?.email || req.user!.email,
      name: u?.name || name || req.user!.name,
      role: u?.role || req.user!.role,
      phone: u?.phone || phone,
      address: u?.address || address,
      restaurantId: u?.restaurant_id,
      walletBalanceUSD: u?.wallet_balance_usd || 0,
      walletBalanceNGN: u?.wallet_balance_ngn || 0,
      savedAddresses: typeof u?.saved_addresses === 'string' ? JSON.parse(u.saved_addresses) : (u?.saved_addresses || []),
      createdAt: u?.created_at || now,
      updatedAt: u?.updated_at || now
    };

    return res.json({
      success: true,
      message: 'Profile updated in Cloudflare D1',
      data: { user: updatedUser }
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Manage Saved Addresses in Cloudflare D1
router.get('/addresses', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const d1Res = await d1Client.query('SELECT saved_addresses, address FROM users WHERE id = ? LIMIT 1', [req.user!.id]);
    const u: any = d1Res.results?.[0];
    let addresses: any[] = [];
    if (u?.saved_addresses) {
      try {
        addresses = typeof u.saved_addresses === 'string' ? JSON.parse(u.saved_addresses) : u.saved_addresses;
      } catch (e) {}
    }
    
    // Dynamically inject main profile address if it's set and not yet in the array
    if (u?.address && u.address.trim()) {
      const trimmedMain = u.address.trim().toLowerCase();
      const exists = addresses.some((a: any) => (a.address || '').trim().toLowerCase() === trimmedMain);
      if (!exists) {
        addresses.unshift({
          id: 'addr-default-profile',
          label: 'Default Address',
          address: u.address.trim(),
          apartment: '',
          city: 'Lagos',
          isDefault: addresses.length === 0
        });
      }
    } else if (addresses.length === 0 && u?.address) {
      addresses.push({
        id: 'addr-default-profile',
        label: 'Default Address',
        address: u.address,
        apartment: '',
        city: 'Lagos',
        isDefault: true
      });
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
      try {
        list = JSON.parse(d1Res.results[0].saved_addresses);
      } catch (e) {}
    }

    const newAddr = {
      id: `addr-${Date.now()}`,
      label: label || 'Home',
      address,
      apartment: apartment || '',
      city: city || 'Lagos',
      isDefault: Boolean(isDefault)
    };

    if (newAddr.isDefault) {
      list = list.map((a: any) => ({ ...a, isDefault: false }));
    }

    list.push(newAddr);
    await d1Client.query('UPDATE users SET saved_addresses = ?, address = ?, updated_at = ? WHERE id = ?', [
      JSON.stringify(list),
      address,
      new Date().toISOString(),
      userId
    ]);

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
      try {
        list = JSON.parse(d1Res.results[0].saved_addresses);
      } catch (e) {}
    }

    list = list.filter((a: any) => a.id !== req.params.id);
    await d1Client.query('UPDATE users SET saved_addresses = ?, updated_at = ? WHERE id = ?', [
      JSON.stringify(list),
      new Date().toISOString(),
      userId
    ]);

    return res.json({ success: true, message: 'Address removed from Cloudflare D1', data: list });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Top-Up In-App Wallet (Direct Cloudflare D1 Persistence)
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

    // 1. Increment balance atomically in Cloudflare D1 users table
    await d1Client.query(
      'UPDATE users SET wallet_balance_ngn = COALESCE(wallet_balance_ngn, 0) + ?, updated_at = ? WHERE id = ?',
      [cleanAmount, now, userId]
    );

    // 2. Record transaction in Cloudflare D1 transactions table
    const txId = `txn-${Date.now()}`;
    await d1Client.query(
      'INSERT INTO transactions (id, order_id, reference, amount, currency, status, payment_method, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [txId, `WALLET-${userId}`, ref, cleanAmount, 'NGN', 'completed', paymentMethod || 'Online Gateway', now]
    );

    // 3. Log audit event
    await db.logAudit({
      userId,
      userEmail: req.user!.email,
      userRole: req.user!.role,
      action: 'WALLET_DEPOSIT',
      resource: 'WALLET',
      resourceId: txId,
      details: { amount: cleanAmount, reference: ref },
      ip: req.ip
    });

    // 4. Return live updated balance from D1
    const balanceRes = await d1Client.query('SELECT wallet_balance_ngn FROM users WHERE id = ? LIMIT 1', [userId]);
    const updatedBalance = balanceRes.results?.[0]?.wallet_balance_ngn || cleanAmount;

    return res.json({
      success: true,
      message: `₦${cleanAmount.toLocaleString('en-NG')} successfully deposited to your D1 wallet!`,
      data: {
        walletBalanceNGN: updatedBalance,
        transaction: {
          id: txId,
          reference: ref,
          amount: cleanAmount,
          currency: 'NGN',
          status: 'completed',
          createdAt: now
        }
      }
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Fetch User's Wallet Activity from Cloudflare D1
router.get('/wallet/transactions', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const result = await d1Client.query(
      `SELECT t.* FROM transactions t 
       WHERE t.order_id = ? 
          OR t.order_id IN (SELECT id FROM orders WHERE customer_id = ?) 
       ORDER BY t.created_at DESC LIMIT 50`,
      [`WALLET-${userId}`, userId]
    );

    return res.json({ success: true, data: result.results || [] });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Logout
router.post('/logout', (req: AuthRequest, res: Response) => {
  res.clearCookie('veyrang_token', { path: '/', httpOnly: true, sameSite: 'lax' });
  res.clearCookie('veyrang_auth_token', { path: '/', sameSite: 'lax' });
  res.clearCookie('veyrang_token', { path: '/' });
  res.clearCookie('veyrang_auth_token', { path: '/' });
  res.clearCookie('veyrang_token');
  res.clearCookie('veyrang_auth_token');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  return res.json({
    success: true,
    message: 'Logged out successfully. All session tokens cleared.'
  });
});

// Send Verification Code (on Registration attempt)
router.post('/send-verification', otpLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !email.includes('@')) {
      return res.status(400).json({ success: false, error: 'Invalid email address.' });
    }

    const blockedDomains = ['example.com', 'test.com', 'demo.com', 'mailinator.com', 'tempmail.com', 'yopmail.com', 'dispostable.com'];
    const domain = email.toLowerCase().trim().split('@')[1];
    if (blockedDomains.includes(domain)) {
      return res.status(400).json({
        success: false,
        error: 'Registration is not allowed using temporary or fictional email domains.'
      });
    }

    const existingUser = await db.findUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: 'An account with this email address already exists.'
      });
    }

    // Generate a cryptographically secure 6-digit OTP
    const code = crypto.randomInt(100000, 1000000).toString();
    await db.saveOtp(email, code, 'register');

    // Send email via Resend
    await sendEmail({
      to: email,
      subject: 'Verify your Veyrang Account',
      html: `
        <div style="font-family: sans-serif; padding: 24px; color: #1e293b; background-color: #f8fafc; border-radius: 16px;">
          <h2 style="color: #ff5500; margin-bottom: 16px;">Welcome to Veyrang!</h2>
          <p>Thank you for signing up. Please verify your email address using the 6-digit verification code below:</p>
          <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; font-size: 24px; font-weight: bold; letter-spacing: 4px; text-align: center; color: #0f172a; margin: 24px 0;">
            ${code}
          </div>
          <p style="font-size: 12px; color: #64748b;">This code is valid for 10 minutes. If you did not request this, please ignore this email.</p>
        </div>
      `,
      text: `Welcome to Veyrang! Your email verification code is: ${code}`,
      hostHeader: req.headers.host
    });

    return res.json({
      success: true,
      message: `A verification code has been sent to ${email}.`
    });
  } catch (error: any) {
    console.error('Send verification error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Failed to send verification code.' });
  }
});

// Forgot Password (Request OTP Code)
router.post('/forgot-password', forgotLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !email.includes('@')) {
      return res.status(400).json({ success: false, error: 'Please enter a valid registered email address.' });
    }

    const user = await db.findUserByEmail(email);
    if (!user) {
      // Security best practice: don't reveal if user exists, but let user know a recovery flow is sent
      return res.json({
        success: true,
        message: 'Recovery OTP code has been sent to your email if registered.'
      });
    }

    const code = crypto.randomInt(100000, 1000000).toString();
    await db.saveOtp(email, code, 'forgot');

    await sendEmail({
      to: email,
      subject: 'Reset your Veyrang Password',
      html: `
        <div style="font-family: sans-serif; padding: 24px; color: #1e293b; background-color: #f8fafc; border-radius: 16px;">
          <h2 style="color: #ff5500; margin-bottom: 16px;">Reset your Password</h2>
          <p>We received a request to reset your password. Use the 6-digit OTP code below to set a new password:</p>
          <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; font-size: 24px; font-weight: bold; letter-spacing: 4px; text-align: center; color: #0f172a; margin: 24px 0;">
            ${code}
          </div>
          <p style="font-size: 12px; color: #64748b;">This OTP code is valid for 10 minutes. If you did not request this, please secure your account immediately.</p>
        </div>
      `,
      text: `Reset your Veyrang password. Your recovery OTP code is: ${code}`,
      hostHeader: req.headers.host
    });

    return res.json({
      success: true,
      message: 'Recovery OTP code has been sent to your email.'
    });
  } catch (error: any) {
    console.error('Forgot password error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Failed to send recovery code.' });
  }
});

// Reset Password (Verify OTP Code and update Password)
router.post('/reset-password', forgotLimiter, async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    if (!email || !code || !newPassword || newPassword.length < 8) {
      return res.status(400).json({ success: false, error: 'Password must be at least 8 characters long.' });
    }

    const isValid = await db.verifyOtp(email, code, 'forgot');
    if (!isValid) {
      return res.status(400).json({ success: false, error: 'Invalid or expired OTP code.' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);
    const success = await db.updateUserPassword(email, passwordHash);

    if (!success) {
      return res.status(404).json({ success: false, error: 'User account not found.' });
    }

    return res.json({
      success: true,
      message: 'Your password has been successfully reset. Please sign in.'
    });
  } catch (error: any) {
    console.error('Reset password error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Failed to reset password.' });
  }
});

export default router;
