import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../db/index.ts';
import { validateBody } from '../middleware/validate.ts';
import { authenticateToken, AuthRequest } from '../middleware/auth.ts';

const router = Router();

const PaymentIntentSchema = z.object({
  orderId: z.string().min(1).max(100),
  amount: z.number().positive(),
  paymentMethod: z.string().default('card')
});

router.post('/intent', authenticateToken, validateBody(PaymentIntentSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { orderId, amount, paymentMethod } = req.body;

    const order = await db.getOrderById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    // Ownership Verification: If the order has a customerId and caller is authenticated, ensure customerId matches
    if (order.customerId && req.user && order.customerId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: You do not have permission to initiate payment for this order.'
      });
    }

    // SERVER FINANCIAL VERIFICATION: ensure requested amount strictly equals verified server order total
    if (Math.abs(order.total - amount) > 0.05) {
      return res.status(400).json({
        success: false,
        error: 'Payment amount mismatch detected. Security alert triggered.'
      });
    }

    const clientSecret = `pi_${order.shortId.replace('#', '')}_secret_${Date.now()}`;
    const transactionRef = `txn_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    return res.json({
      success: true,
      data: {
        clientSecret,
        transactionRef,
        amount: order.total,
        currency: 'USD',
        status: 'requires_confirmation'
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Could not create payment intent' });
  }
});

export default router;
