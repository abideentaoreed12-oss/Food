import { Router, Response } from 'express';
import { randomUUID } from 'crypto';
import { d1Client } from '../db/d1Client.ts';
import { AuthRequest } from '../middleware/auth.ts';

const router = Router();

const clean = (value: unknown, max: number) => String(value ?? '').trim().slice(0, max);

// Public ticket submission; only allowlisted fields are persisted.
router.post('/tickets', async (req: AuthRequest, res: Response) => {
  try {
    const name = clean(req.body?.name, 120);
    const email = clean(req.body?.email || req.user?.email, 254).toLowerCase();
    const phone = clean(req.body?.phone, 40);
    const subject = clean(req.body?.subject, 160);
    const message = clean(req.body?.message, 6000);
    const category = clean(req.body?.category || 'general', 60);
    if (!name || !email || !subject || message.length < 10) {
      return res.status(400).json({ success: false, error: 'Name, valid email, subject and a message of at least 10 characters are required.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, error: 'Enter a valid email address so you can follow up on your ticket.' });
    }

    const id = `VYR-${randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase()}`;
    const now = new Date().toISOString();
    const issueText = `${subject}: ${message}`.slice(0, 2000);
    const result = await d1Client.query(
      'INSERT INTO support_tickets (id, customer_id, customer_name, customer_email, order_id, issue, priority, status, assigned_to, created_at, user_id, user_email, subject, message, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, req.user?.id || null, name, email, null, issueText, 'medium', 'open', null, now, req.user?.id || null, email, subject, message, now]
    );
    if (!result.success) {
      return res.status(503).json({ success: false, error: 'Your ticket could not be saved. Please try again.' });
    }
    return res.status(201).json({ success: true, data: { id, status: 'open', createdAt: now }, message: 'Your support ticket has been received.' });
  } catch (error: any) {
    console.error('Support ticket submission failed:', error?.message || error);
    return res.status(500).json({ success: false, error: 'Support is temporarily unavailable. Please try again shortly.' });
  }
});

// A ticket can be viewed using its unique reference.
router.get('/tickets/:id', async (req: AuthRequest, res: Response) => {
  try {
    const id = clean(req.params.id, 40);
    if (!id) return res.status(400).json({ success: false, error: 'Ticket reference is required.' });
    const result = await d1Client.query(
      'SELECT id, customer_name, customer_email, issue, priority, status, assigned_to, user_id, user_email, subject, message, created_at, updated_at FROM support_tickets WHERE id = ? LIMIT 1',
      [id]
    );
    if (!result.results?.length) return res.status(404).json({ success: false, error: 'Ticket not found. Check your reference.' });
    return res.json({ success: true, data: result.results[0] });
  } catch (error: any) {
    console.error('Support ticket lookup failed:', error?.message || error);
    return res.status(500).json({ success: false, error: 'Unable to load this ticket right now.' });
  }
});

export default router;
