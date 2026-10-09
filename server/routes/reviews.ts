import { Router, Request, Response } from 'express';
import { d1Client } from '../db/d1Client.ts';
import { requireAuth, AuthRequest } from '../middleware/auth.ts';

const router = Router();

// 1. Get Reviews for a Restaurant (Public)
router.get('/restaurant/:restaurantId', async (req: Request, res: Response) => {
  try {
    const { restaurantId } = req.params;
    const results = await d1Client.query(
      `SELECT r.id, u.name as customer_name,
              r.food_rating, r.delivery_rating, r.comment, r.photo_r2_url, r.merchant_reply, r.created_at
       FROM reviews r
       LEFT JOIN users u ON r.customer_id = u.id
       WHERE r.restaurant_id = ?
       ORDER BY r.created_at DESC LIMIT 50`,
      [restaurantId]
    );

    return res.json({
      success: true,
      data: results.results
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 2. Submit a Review (Customer Guarded)
router.post('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { orderId, restaurantId, foodRating, deliveryRating, comment, photoR2Url } = req.body;
    const validRating = (v: unknown) => Number.isInteger(v) && Number(v) >= 1 && Number(v) <= 5;
    if (typeof orderId !== 'string' || !orderId.trim() ||
        typeof restaurantId !== 'string' || !restaurantId.trim() ||
        !validRating(foodRating) ||
        (deliveryRating != null && !validRating(deliveryRating)) ||
        (comment != null && (typeof comment !== 'string' || comment.length > 2000)) ||
        (photoR2Url != null && typeof photoR2Url !== 'string')) {
      return res.status(400).json({ success: false, error: 'Valid order, restaurant, rating (1–5), and review details are required' });
    }
    const orderResult = await d1Client.query(
      'SELECT id, customer_id, restaurant_id, status FROM orders WHERE id = ? LIMIT 1', [orderId]
    );
    if (!orderResult.success) return res.status(503).json({ success: false, error: 'Could not verify order for review' });
    const order = orderResult.results?.[0];
    if (!order || order.customer_id !== req.user!.id || order.restaurant_id !== restaurantId)
      return res.status(403).json({ success: false, error: 'You can only review your own order for its restaurant' });
    if (String(order.status).toLowerCase() !== 'delivered')
      return res.status(409).json({ success: false, error: 'You can review an order only after it has been delivered' });

    const reviewId = `rev-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    const existing = await d1Client.query(
      `SELECT id FROM reviews WHERE order_id = ? AND customer_id = ? LIMIT 1`,
      [orderId, req.user!.id]
    );

    if (existing && existing.results && existing.results.length > 0) {
      const updateResult = await d1Client.query(
        `UPDATE reviews SET food_rating = ?, delivery_rating = ?, comment = ?, photo_r2_url = ?
         WHERE order_id = ? AND customer_id = ?`,
        [foodRating, deliveryRating ?? null, comment || '', photoR2Url || null, orderId, req.user!.id]
      );
      if (!updateResult.success) throw new Error('Review update failed');
    } else {
      const insertResult = await d1Client.query(
        `INSERT INTO reviews (id, order_id, customer_id, restaurant_id, courier_id, food_rating, delivery_rating, comment, photo_r2_url, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [reviewId, orderId, req.user!.id, restaurantId, null, foodRating, deliveryRating ?? null, comment || '', photoR2Url || null, now]
      );
      if (!insertResult.success) throw new Error('Review insert failed');
    }

    // Recalculate restaurant's average rating & review count in D1
    const agg = await d1Client.query(
      `SELECT AVG(food_rating) as avg_rating, COUNT(*) as total_reviews
       FROM reviews WHERE restaurant_id = ?`,
      [restaurantId]
    );

    if (agg.results && agg.results[0]) {
      const avg = Math.round((agg.results[0].avg_rating || 5.0) * 10) / 10;
      const count = agg.results[0].total_reviews || 1;
      await d1Client.query(
        `UPDATE restaurants SET rating = ?, review_count = ? WHERE id = ?`,
        [avg, count, restaurantId]
      );
    }

    return res.json({
      success: true,
      message: 'Review submitted successfully',
      data: { reviewId, foodRating, createdAt: now }
    });
  } catch {
    return res.status(500).json({ success: false, error: 'Unable to process review right now' });
  }
});

export default router;
