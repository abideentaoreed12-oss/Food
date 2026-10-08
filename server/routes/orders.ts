import { Router, Response } from 'express';
import { z } from 'zod';
import { db } from '../db/index.ts';
import { d1Client } from '../db/d1Client.ts';
import { AuthRequest, requireAuth } from '../middleware/auth.ts';
import { validateBody } from '../middleware/validate.ts';
import { calculateRestaurantDistanceMetrics } from '../utils/distance.ts';

const router = Router();
router.use(requireAuth);

const CreateOrderSchema = z.object({
  restaurantId: z.string(),
  items: z.array(
    z.object({
      menuItemId: z.string(),
      quantity: z.number().int().positive(),
      selectedOptions: z.array(
        z.object({
          groupId: z.string(),
          groupName: z.string(),
          optionId: z.string(),
          optionName: z.string(),
          price: z.number().nonnegative()
        })
      ),
      specialInstructions: z.string().max(250).optional()
    })
  ).min(1),
  customerName: z.string().min(2),
  customerPhone: z.string().min(6),
  customerAddress: z.string().min(5),
  customerApartment: z.string().optional(),
  deliveryNotes: z.string().optional(),
  tip: z.number().nonnegative().default(5.0),
  paymentMethod: z.string().default('Digital Card'),
  currency: z.enum(['USD', 'NGN']).default('NGN'),
  fulfillmentType: z.enum(['delivery', 'pickup', 'scheduled']).default('delivery'),
  scheduledSlot: z.string().optional(),
  isContactless: z.boolean().default(false),
  promoCode: z.string().optional(),
  walletDeduction: z.number().nonnegative().default(0),
  idempotencyKey: z.string().optional()
});

router.post('/', validateBody(CreateOrderSchema), async (req: AuthRequest, res: Response) => {
  try {
    const {
      restaurantId, items: rawItems, customerName, customerPhone, customerAddress,
      customerApartment, deliveryNotes, tip, paymentMethod, currency, fulfillmentType,
      scheduledSlot, isContactless, promoCode, walletDeduction, idempotencyKey
    } = req.body;

    if (idempotencyKey) {
      const existingTxn = await db.getTransactionByIdempotencyKey(idempotencyKey);
      if (existingTxn) {
        const existingOrder = await db.getOrderById(existingTxn.orderId);
        if (existingOrder) {
          return res.status(200).json({ success: true, data: existingOrder, message: 'Order retrieved via idempotency key.' });
        }
      }
    }

    const restaurant = await db.getRestaurantById(restaurantId);
    if (!restaurant) return res.status(404).json({ success: false, error: 'Restaurant not found' });
    if (restaurant.isBusyPaused) {
      return res.status(400).json({ success: false, error: `${restaurant.name} is currently in Busy Mode.` });
    }

    let verifiedSubtotal = 0;
    const validatedItems: any[] = [];
    for (const rawItem of rawItems) {
      let matchedItem: any = null;
      for (const cat of restaurant.categories || []) {
        const found = (cat.items || []).find((it: any) => it.id === rawItem.menuItemId);
        if (found) { matchedItem = found; break; }
      }
      if (!matchedItem) return res.status(400).json({ success: false, error: `Item ${rawItem.menuItemId} not found` });
      if (matchedItem.isAvailable === false) return res.status(400).json({ success: false, error: `Item unavailable` });

      let verifiedOptionsTotal = 0;
      for (const opt of rawItem.selectedOptions || []) {
        let trusted = Number(opt.price) || 0;
        for (const g of matchedItem.customizations || matchedItem.optionGroups || []) {
          const found = (g.options || []).find((o: any) => o.id === opt.optionId || o.name === opt.optionName);
          if (found && found.price != null) { trusted = Number(found.price) || 0; break; }
        }
        verifiedOptionsTotal += trusted;
      }
      const itemTotal = (Number(matchedItem.price) + verifiedOptionsTotal) * rawItem.quantity;
      verifiedSubtotal += itemTotal;
      validatedItems.push({
        cartItemId: `c-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        menuItemId: matchedItem.id,
        name: matchedItem.name,
        price: matchedItem.price,
        quantity: rawItem.quantity,
        selectedOptions: rawItem.selectedOptions,
        specialInstructions: rawItem.specialInstructions,
        itemTotal: Math.round(itemTotal * 100) / 100
      });
    }
    verifiedSubtotal = Math.round(verifiedSubtotal * 100) / 100;

    let deliveryFee = 0;
    let estimatedArrivalMinutes = (restaurant.deliveryTimeMin || 25) + 5;
    let distanceMetrics: any = null;
    if (fulfillmentType === 'pickup') {
      deliveryFee = 0;
    } else {
      try {
        distanceMetrics = await calculateRestaurantDistanceMetrics(restaurant, customerAddress);
        deliveryFee = distanceMetrics.estimatedDeliveryFee;
        estimatedArrivalMinutes = Math.max(15, (restaurant.deliveryTimeMin || 20) + distanceMetrics.durationMinutes);
      } catch (error) {
        console.error('[Order pricing] Delivery fee calculation failed:', error);
        return res.status(503).json({ success: false, error: 'Delivery pricing is temporarily unavailable. Please try again.' });
      }
    }

    const serviceFee = currency === 'USD' ? Math.round(verifiedSubtotal * 0.08 * 100) / 100 : 200;
    let discountAmount = 0;
    if (promoCode) {
      const codeUpper = String(promoCode).trim().toUpperCase();
      let d1Promo;
      try {
        d1Promo = await d1Client.query('SELECT * FROM promo_codes WHERE UPPER(code) = ? AND is_active = 1 LIMIT 1', [codeUpper]);
      } catch (error) {
        console.error('[Order pricing] Promo lookup failed:', error);
        return res.status(503).json({ success: false, error: 'Promo service is temporarily unavailable. Please try again.' });
      }
      if (!d1Promo.results?.length) return res.status(400).json({ success: false, error: 'Promo code is invalid or inactive' });
      const promo = d1Promo.results[0];
      if (promo.expires_at && !Number.isNaN(new Date(promo.expires_at).getTime()) && new Date(promo.expires_at).getTime() < Date.now()) {
        return res.status(400).json({ success: false, error: 'Promo code has expired' });
      }
      if (promo.usage_limit != null && Number(promo.times_used || 0) >= Number(promo.usage_limit)) {
        return res.status(400).json({ success: false, error: 'Promo code usage limit reached' });
      }
      if (verifiedSubtotal < Number(promo.min_order_amount || 0)) {
        return res.status(400).json({ success: false, error: 'Order does not meet the promo minimum amount' });
      }
      const val = Number(promo.value);
      if (!Number.isFinite(val) || val <= 0 || !['percentage', 'fixed'].includes(promo.discount_type)) {
        return res.status(500).json({ success: false, error: 'Promo configuration is invalid' });
      }
      const cap = promo.max_discount_cap == null || promo.max_discount_cap === '' ? null : Number(promo.max_discount_cap);
      if (cap !== null && (!Number.isFinite(cap) || cap < 0)) return res.status(500).json({ success: false, error: 'Promo discount cap is invalid' });
      const rawDiscount = promo.discount_type === 'percentage' ? Math.round(verifiedSubtotal * (val / 100)) : val;
      discountAmount = cap === null ? rawDiscount : Math.min(cap, rawDiscount);
      const usageUpdate = await d1Client.query('UPDATE promo_codes SET times_used = times_used + 1 WHERE id = ? AND is_active = 1 AND (usage_limit IS NULL OR times_used < usage_limit)', [promo.id]);
      if (usageUpdate.meta?.changes === 0) return res.status(409).json({ success: false, error: 'Promo usage limit reached; please try again' });
    }
    const preWalletTotal = Math.max(0, Math.round((verifiedSubtotal + deliveryFee + serviceFee + (tip || 0) - discountAmount) * 100) / 100);
    const verifiedWalletDeduction = Math.min(preWalletTotal, Math.max(0, walletDeduction || 0));
    const fullyWalletPaid = verifiedWalletDeduction >= preWalletTotal;

    const shortNum = Math.floor(1000 + Math.random() * 9000);
    const orderId = `ord-${shortNum}`;
    const transactionRef = `txn_${Date.now()}_${shortNum}`;
    const nowIso = new Date().toISOString();
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const handoverPin = String(Math.floor(1000 + Math.random() * 9000));

    const newOrder: any = {
      id: orderId,
      shortId: `#${shortNum}`,
      createdAt: nowIso,
      customerId: req.user?.id,
      customerName,
      customerPhone,
      customerAddress,
      customerApartment,
      deliveryNotes,
      restaurantId: restaurant.id,
      restaurantName: restaurant.name,
      restaurantAddress: restaurant.address,
      items: validatedItems,
      subtotal: verifiedSubtotal,
      deliveryFee,
      serviceFee,
      tip: tip || 0,
      discountAmount,
      walletDeduction: verifiedWalletDeduction,
      total: preWalletTotal,
      currency: currency || 'NGN',
      fulfillmentType: fulfillmentType || 'delivery',
      scheduledSlot,
      isContactless: Boolean(isContactless),
      promoCode,
      handoverPin,
      prepTimeAdjustmentMin: 0,
      paymentMethod: fullyWalletPaid ? 'Wallet Balance' : paymentMethod,
      paymentStatus: fullyWalletPaid ? 'paid' : 'pending',
      transactionRef,
      status: 'placed',
      statusHistory: [{ status: 'placed', timestamp: timeStr, note: 'Order received' }],
      routeProgress: 0,
      estimatedArrivalMinutes,
      distanceKm: distanceMetrics?.distanceKm ?? restaurant.distanceKm ?? 2.4,
      courier: undefined,
      messages: [{ id: `msg-${Date.now()}`, sender: 'system', senderName: 'System', text: `Order #${shortNum} placed. Handover PIN: ${handoverPin}.`, timestamp: timeStr }],
      updatedAt: nowIso
    };

    await db.createOrder(newOrder);

    if (verifiedWalletDeduction > 0 && req.user?.id) {
      await d1Client.query(
        'UPDATE users SET wallet_balance_ngn = MAX(0, COALESCE(wallet_balance_ngn, 0) - ?), updated_at = ? WHERE id = ?',
        [verifiedWalletDeduction, nowIso, req.user.id]
      ).catch(() => {});
    }

    await db.createTransaction({
      id: `txn-${Date.now()}`,
      orderId: newOrder.id,
      reference: transactionRef,
      amount: preWalletTotal,
      currency: currency || 'NGN',
      status: fullyWalletPaid ? 'completed' : 'pending',
      paymentMethod: newOrder.paymentMethod,
      idempotencyKey: idempotencyKey || `auto_${orderId}`,
      createdAt: nowIso
    });

    return res.status(201).json({ success: true, data: newOrder });
  } catch (error) {
    console.error('Order creation error:', error);
    return res.status(500).json({ success: false, error: 'Failed to create order.' });
  }
});

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    let allOrders: any[] = [];
    try {
      const ordersRes = await d1Client.query('SELECT * FROM orders ORDER BY created_at DESC');
      if (ordersRes?.results) {
        allOrders = ordersRes.results.map((o: any) => {
          let parsed: any = null;
          try { if (o.raw_json) parsed = JSON.parse(o.raw_json); } catch {}
          return {
            ...(parsed || {}),
            id: o.id,
            customerId: o.customer_id || parsed?.customerId,
            total: o.total ?? parsed?.total,
            paymentStatus: o.payment_status || parsed?.paymentStatus,
            status: o.status || parsed?.status,
            createdAt: o.created_at || parsed?.createdAt
          };
        });
      }
    } catch {
      allOrders = await db.getOrders();
    }
    const role = req.user?.role;
    const userId = req.user?.id;
    if (role === 'admin' || role === 'sub_admin') {
      if (req.query.scope === 'all') return res.json({ success: true, data: allOrders });
      return res.json({ success: true, data: allOrders.filter((o) => o.customerId === userId) });
    }
    return res.json({ success: true, data: allOrders.filter((o) => o.customerId === userId) });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/quote', async (req: AuthRequest, res: Response) => {
  try {
    const { restaurantId, customerAddress, fulfillmentType } = req.body;
    const restaurant = await db.getRestaurantById(restaurantId);
    if (!restaurant) return res.status(404).json({ success: false, error: 'Restaurant not found' });
    let deliveryFee = 0;
    let distanceMetrics: any = null;
    if (fulfillmentType !== 'pickup') {
      try {
        distanceMetrics = await calculateRestaurantDistanceMetrics(restaurant, customerAddress);
        deliveryFee = distanceMetrics.estimatedDeliveryFee;
      } catch {
        deliveryFee = restaurant.deliveryFee || 500;
      }
    }
    return res.json({
      success: true,
      data: {
        deliveryFee,
        distanceKm: distanceMetrics?.distanceKm ?? restaurant.distanceKm,
        isLiveGoogleMaps: Boolean(distanceMetrics?.isLiveGoogleMaps)
      }
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/validate-promo', async (req: AuthRequest, res: Response) => {
  try {
    const codeUpper = String(req.body.code || '').trim().toUpperCase();
    const cleanSubtotal = Number(req.body.subtotal) || 0;
    const d1Res = await d1Client.query('SELECT * FROM promo_codes WHERE UPPER(code) = ? AND is_active = 1 LIMIT 1', [codeUpper]);
    if (!d1Res.results?.length) return res.status(404).json({ success: false, error: 'Invalid promo' });
    const p = d1Res.results[0];
    if (cleanSubtotal < Number(p.min_order_amount || 0)) {
      return res.status(400).json({ success: false, error: 'Minimum order not met' });
    }
    const val = Number(p.value || 0);
    const cap = Number(p.max_discount_cap || 2500);
    const discountAmount = p.discount_type === 'percentage'
      ? Math.min(cap, Math.round(cleanSubtotal * (val / 100)))
      : Math.min(cap, val);
    return res.json({ success: true, valid: true, code: codeUpper, discountAmount });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
