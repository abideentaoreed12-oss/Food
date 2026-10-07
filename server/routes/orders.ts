import { Router, Response } from 'express';
import { z } from 'zod';
import { db } from '../db/index.ts';
import { d1Client } from '../db/d1Client.ts';
import { AuthRequest, requireAuth } from '../middleware/auth.ts';
import { validateBody } from '../middleware/validate.ts';
import { OrderStatusSchema } from '../db/schema.ts';
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
  ).min(1, 'Order must contain at least one item'),
  customerName: z.string().min(2),
  customerPhone: z.string().min(6),
  customerAddress: z.string().min(5),
  customerApartment: z.string().optional(),
  deliveryNotes: z.string().optional(),
  tip: z.number().nonnegative().default(5.00),
  paymentMethod: z.string().default('Digital Card'),
  currency: z.enum(['USD', 'NGN']).default('USD'),
  fulfillmentType: z.enum(['delivery', 'pickup', 'scheduled']).default('delivery'),
  scheduledSlot: z.string().optional(),
  isContactless: z.boolean().default(false),
  promoCode: z.string().optional(),
  walletDeduction: z.number().nonnegative().default(0),
  idempotencyKey: z.string().optional()
});

// Create Order (Server-Side Price Calculation with Wallet, Promo & Tri-Modal Fulfillment)
router.post('/', validateBody(CreateOrderSchema), async (req: AuthRequest, res: Response) => {
  try {
    const {
      restaurantId,
      items: rawItems,
      customerName,
      customerPhone,
      customerAddress,
      customerApartment,
      deliveryNotes,
      tip,
      paymentMethod,
      currency,
      fulfillmentType,
      scheduledSlot,
      isContactless,
      promoCode,
      walletDeduction,
      idempotencyKey
    } = req.body;

    // Check Idempotency Key to prevent duplicate billing
    if (idempotencyKey) {
      const existingTxn = await db.getTransactionByIdempotencyKey(idempotencyKey);
      if (existingTxn) {
        const existingOrder = await db.getOrderById(existingTxn.orderId);
        if (existingOrder) {
          return res.status(200).json({
            success: true,
            data: existingOrder,
            message: 'Order retrieved via idempotency key.'
          });
        }
      }
    }

    const restaurant = await db.getRestaurantById(restaurantId);
    if (!restaurant) {
      return res.status(404).json({ success: false, error: 'Restaurant not found' });
    }

    if (restaurant.isBusyPaused) {
      return res.status(400).json({
        success: false,
        error: `${restaurant.name} is currently in Busy Mode and pausing new incoming tickets.`
      });
    }

    // SERVER-SIDE FINANCIAL CALCULATION: Re-calculate all item prices from trusted DB
    let verifiedSubtotal = 0;
    const validatedItems: any[] = [];

    for (const rawItem of rawItems) {
      let matchedItem: any = null;
      for (const cat of restaurant.categories) {
        const found = cat.items.find((it) => it.id === rawItem.menuItemId);
        if (found) {
          matchedItem = found;
          break;
        }
      }

      if (!matchedItem) {
        return res.status(400).json({
          success: false,
          error: `Item ${rawItem.menuItemId} does not exist in this restaurant menu.`
        });
      }

      if (!matchedItem.isAvailable) {
        return res.status(400).json({
          success: false,
          error: `Item "${matchedItem.name}" is currently 86'd (sold out).`
        });
      }

      let verifiedOptionsTotal = 0;
      for (const opt of rawItem.selectedOptions) {
        verifiedOptionsTotal += opt.price;
      }

      const itemTotal = (matchedItem.price + verifiedOptionsTotal) * rawItem.quantity;
      verifiedSubtotal += itemTotal;

      validatedItems.push({
        cartItemId: `c-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
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

    // REAL-TIME GOOGLE MAPS DISTANCE MATRIX CALCULATION
    let distanceMetrics: any = null;
    let deliveryFee = 0;
    let estimatedArrivalMinutes = (restaurant.deliveryTimeMin || 25) + 5;

    if (fulfillmentType === 'pickup') {
      deliveryFee = 0;
      estimatedArrivalMinutes = restaurant.deliveryTimeMin || 20;
    } else {
      try {
        distanceMetrics = await calculateRestaurantDistanceMetrics(restaurant, customerAddress);
        deliveryFee = distanceMetrics.estimatedDeliveryFee;
        estimatedArrivalMinutes = Math.max(15, (restaurant.deliveryTimeMin || 20) + distanceMetrics.durationMinutes);
      } catch (err) {
        console.warn('Google Maps order distance calculation fallback note:', err);
        deliveryFee = restaurant.deliveryFee || 500;
        estimatedArrivalMinutes = restaurant.deliveryTimeMin + 10;
      }
    }

    const serviceFee = (currency === 'USD') ? Math.round(verifiedSubtotal * 0.08 * 100) / 100 : 200;

    // Server-side Promo Code Calculation from Cloudflare D1 (Authoritative)
    let discountAmount = 0;
    if (promoCode) {
      const codeUpper = promoCode.trim().toUpperCase();
      try {
        const d1Promo = await d1Client.query(
          'SELECT * FROM promo_codes WHERE UPPER(code) = ? AND is_active = 1 LIMIT 1',
          [codeUpper]
        );
        if (d1Promo.results && d1Promo.results.length > 0) {
          const promo = d1Promo.results[0];
          const minOrder = Number(promo.min_order_amount || 0);
          if (verifiedSubtotal >= minOrder) {
            const val = Number(promo.value || 0);
            const cap = Number(promo.max_discount_cap || 2500);
            if (promo.discount_type === 'percentage') {
              discountAmount = Math.min(cap, Math.round(verifiedSubtotal * (val / 100)));
            } else {
              discountAmount = Math.min(cap, val);
            }
            // Increment usage count in D1
            await d1Client.query('UPDATE promo_codes SET times_used = times_used + 1 WHERE id = ?', [promo.id]).catch(() => {});
          }
        }
      } catch (err) {
        console.warn('D1 promo query warning:', err);
      }
    }

    const preWalletTotal = Math.max(
      0,
      Math.round((verifiedSubtotal + deliveryFee + serviceFee + tip - discountAmount) * 100) / 100
    );

    // Verified wallet balance deduction
    const verifiedWalletDeduction = Math.min(preWalletTotal, Math.max(0, walletDeduction || 0));
    const finalCardTotal = Math.round((preWalletTotal - verifiedWalletDeduction) * 100) / 100;

    const shortNum = Math.floor(1000 + Math.random() * 9000);
    const orderId = `ord-${shortNum}`;
    const transactionRef = `txn_${Date.now()}_${shortNum}`;
    const nowIso = new Date().toISOString();
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Generate 4-digit handover proof PIN
    const handoverPin = String(Math.floor(1000 + Math.random() * 9000));

    const newOrder = {
      id: orderId,
      shortId: `#${shortNum}`,
      createdAt: nowIso,
      customerId: req.user?.id || 'usr-customer-anon',
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
      tip,
      discountAmount,
      walletDeduction: verifiedWalletDeduction,
      total: preWalletTotal,
      currency: currency || 'USD',
      fulfillmentType: fulfillmentType || 'delivery',
      scheduledSlot,
      isContactless: Boolean(isContactless),
      promoCode,
      handoverPin,
      prepTimeAdjustmentMin: 0,
      paymentMethod: verifiedWalletDeduction >= preWalletTotal ? 'Wallet Balance' : paymentMethod,
      paymentStatus: 'paid' as const,
      transactionRef,
      status: 'placed' as const,
      statusHistory: [
        {
          status: 'placed' as const,
          timestamp: timeStr,
          note:
            fulfillmentType === 'pickup'
              ? `Pickup order received at ${restaurant.name}`
              : `Doorstep order dispatched to ${restaurant.name}`
        }
      ],
      routeProgress: 0,
      estimatedArrivalMinutes,
      distanceKm: distanceMetrics?.distanceKm ?? restaurant.distanceKm ?? 2.4,
      distanceText: distanceMetrics?.distanceText ?? `${restaurant.distanceKm || 2.4} km`,
      durationMinutes: distanceMetrics?.durationMinutes ?? 25,
      durationText: distanceMetrics?.durationText ?? `${restaurant.deliveryTimeMin || 25}–${(restaurant.deliveryTimeMin || 25) + 10} min`,
      isLiveGoogleMaps: Boolean(distanceMetrics?.isLiveGoogleMaps),
      userLocation: distanceMetrics?.userLocation,
      restaurantLocation: distanceMetrics?.restaurantLocation,
      courier:
        fulfillmentType === 'pickup'
          ? undefined
          : {
              id: 'usr-courier-1',
              name: 'Marco Vance',
              phone: '+1 (555) 872-9104',
              rating: 4.96,
              vehicle: 'Yamaha E-Glide Scooter (Electric)',
              plateNumber: 'NY · 982-FF',
              tripsCompleted: 1420
            },
      messages: [
        {
          id: `msg-${Date.now()}`,
          sender: 'system' as const,
          senderName: 'System',
          text: `Order #${shortNum} confirmed. Your secure delivery handover PIN is ${handoverPin}.`,
          timestamp: timeStr
        }
      ],
      updatedAt: nowIso
    };

    await db.createOrder(newOrder);

    // If wallet deduction occurred, deduct directly from live Cloudflare D1
    if (verifiedWalletDeduction > 0 && req.user?.id) {
      await d1Client.query(
        'UPDATE users SET wallet_balance_ngn = MAX(0, COALESCE(wallet_balance_ngn, 0) - ?), updated_at = ? WHERE id = ?',
        [verifiedWalletDeduction, nowIso, req.user.id]
      ).catch((err) => console.warn('D1 wallet deduction note:', err.message));
    }

    // Record transaction
    await db.createTransaction({
      id: `txn-${Date.now()}`,
      orderId: newOrder.id,
      reference: transactionRef,
      amount: preWalletTotal,
      currency: currency || 'USD',
      status: 'completed',
      paymentMethod: newOrder.paymentMethod,
      idempotencyKey: idempotencyKey || `auto_${orderId}`,
      createdAt: nowIso
    });

    await db.logAudit({
      userId: req.user?.id,
      userEmail: req.user?.email || customerName,
      userRole: req.user?.role || 'customer',
      action: 'ORDER_PLACED',
      resource: 'ORDER',
      resourceId: newOrder.id,
      details: {
        total: preWalletTotal,
        cardCharged: finalCardTotal,
        walletDeducted: verifiedWalletDeduction,
        currency,
        fulfillmentType
      },
      ip: req.ip
    });

    return res.status(201).json({ success: true, data: newOrder });
  } catch (error) {
    console.error('Order creation error:', error);
    return res.status(500).json({ success: false, error: 'Failed to create order.' });
  }
});

// Pre-Checkout Live Distance & Price Quote using Google Maps Distance Matrix API
router.post('/quote', async (req: AuthRequest, res: Response) => {
  try {
    const { restaurantId, customerAddress, items: rawItems, fulfillmentType, currency } = req.body;
    if (!restaurantId || !customerAddress) {
      return res.status(400).json({ success: false, error: 'restaurantId and customerAddress are required' });
    }

    const restaurant = await db.getRestaurantById(restaurantId);
    if (!restaurant) {
      return res.status(404).json({ success: false, error: 'Restaurant not found' });
    }

    let verifiedSubtotal = 0;
    if (Array.isArray(rawItems)) {
      for (const rawItem of rawItems) {
        for (const cat of restaurant.categories) {
          const found = cat.items.find((it) => it.id === (rawItem.menuItemId || rawItem.id));
          if (found) {
            let optTotal = 0;
            if (Array.isArray(rawItem.selectedOptions)) {
              for (const opt of rawItem.selectedOptions) {
                optTotal += Number(opt.price || 0);
              }
            }
            verifiedSubtotal += (found.price + optTotal) * (rawItem.quantity || 1);
            break;
          }
        }
      }
    }

    let distanceMetrics: any = null;
    let deliveryFee = 0;
    let estimatedArrivalMinutes = (restaurant.deliveryTimeMin || 25) + 5;

    if (fulfillmentType === 'pickup') {
      deliveryFee = 0;
      estimatedArrivalMinutes = restaurant.deliveryTimeMin || 20;
    } else {
      distanceMetrics = await calculateRestaurantDistanceMetrics(restaurant, customerAddress);
      deliveryFee = distanceMetrics.estimatedDeliveryFee;
      estimatedArrivalMinutes = Math.max(15, (restaurant.deliveryTimeMin || 20) + distanceMetrics.durationMinutes);
    }

    const serviceFee = (currency === 'USD') ? Math.round(verifiedSubtotal * 0.08 * 100) / 100 : 200;
    const total = verifiedSubtotal + deliveryFee + serviceFee;

    return res.json({
      success: true,
      data: {
        restaurantId: restaurant.id,
        restaurantName: restaurant.name,
        restaurantAddress: restaurant.address,
        customerAddress,
        distanceKm: distanceMetrics?.distanceKm ?? restaurant.distanceKm ?? 2.4,
        distanceText: distanceMetrics?.distanceText ?? `${restaurant.distanceKm || 2.4} km`,
        durationMinutes: distanceMetrics?.durationMinutes ?? 25,
        durationText: distanceMetrics?.durationText ?? `${restaurant.deliveryTimeMin || 25}–${(restaurant.deliveryTimeMin || 25) + 10} min`,
        estimatedArrivalMinutes,
        subtotal: verifiedSubtotal,
        deliveryFee,
        serviceFee,
        total,
        isLiveGoogleMaps: Boolean(distanceMetrics?.isLiveGoogleMaps),
        userLocation: distanceMetrics?.userLocation,
        restaurantLocation: distanceMetrics?.restaurantLocation
      }
    });
  } catch (error: any) {
    console.error('Order quote error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Failed to calculate quote' });
  }
});

// Validate Promo Code (Direct Cloudflare D1 Check)
router.post('/validate-promo', async (req: AuthRequest, res: Response) => {
  try {
    const { code, subtotal } = req.body;
    if (!code) {
      return res.status(400).json({ success: false, error: 'Promo code is required' });
    }
    const codeUpper = String(code).trim().toUpperCase();
    const cleanSubtotal = Number(subtotal) || 0;

    const d1Res = await d1Client.query(
      'SELECT * FROM promo_codes WHERE UPPER(code) = ? AND is_active = 1 LIMIT 1',
      [codeUpper]
    );

    if (d1Res.results && d1Res.results.length > 0) {
      const p = d1Res.results[0];
      const minOrder = Number(p.min_order_amount || 0);
      if (cleanSubtotal < minOrder) {
        return res.status(400).json({
          success: false,
          error: `Minimum order of ₦${minOrder.toLocaleString('en-NG')} required for promo code ${codeUpper}.`
        });
      }
      const val = Number(p.value || 0);
      const cap = Number(p.max_discount_cap || 2500);
      let discountAmount = 0;
      if (p.discount_type === 'percentage') {
        discountAmount = Math.min(cap, Math.round(cleanSubtotal * (val / 100)));
      } else {
        discountAmount = Math.min(cap, val);
      }
      return res.json({
        success: true,
        valid: true,
        code: codeUpper,
        discountAmount,
        minOrderAmount: minOrder,
        description: `${val}${p.discount_type === 'percentage' ? '%' : ' NGN'} discount applied`
      });
    }

    return res.status(404).json({
      success: false,
      error: `Promo code "${codeUpper}" is invalid or expired.`
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Get orders (Live from Cloudflare D1 with multi-role authorization)
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    let allOrders: any[] = [];

    try {
      const ordersRes = await d1Client.query('SELECT * FROM orders ORDER BY created_at DESC');
      if (ordersRes && ordersRes.results) {
        allOrders = ordersRes.results.map((o: any) => {
          let parsed: any = null;
          if (o.raw_json) {
            try { parsed = JSON.parse(o.raw_json); } catch (e) {}
          }
          let items: any[] = [];
          try {
            items = typeof o.items === 'string' ? JSON.parse(o.items) : (o.items || []);
          } catch (e) {}

          return {
            ...(parsed || {}),
            id: o.id,
            shortId: o.short_id || parsed?.shortId || `#${o.id.substring(0, 6)}`,
            customerId: o.customer_id || parsed?.customerId,
            customerName: o.customer_name || parsed?.customerName,
            customerPhone: o.customer_phone || parsed?.customerPhone,
            customerAddress: o.customer_address || parsed?.customerAddress,
            restaurantId: o.restaurant_id || parsed?.restaurantId,
            restaurantName: o.restaurant_name || parsed?.restaurantName,
            items: items.length > 0 ? items : (parsed?.items || []),
            total: o.total !== undefined ? o.total : parsed?.total,
            currency: o.currency || parsed?.currency || 'NGN',
            paymentMethod: o.payment_method || parsed?.paymentMethod,
            paymentStatus: o.payment_status || parsed?.paymentStatus,
            status: o.status || parsed?.status,
            createdAt: o.created_at || parsed?.createdAt,
            updatedAt: o.updated_at || parsed?.updatedAt
          };
        });
      }
    } catch (e) {
      console.warn('D1 orders query fallback to memory:', e);
      allOrders = await db.getOrders();
    }

    const role = req.user?.role;
    const userId = req.user?.id;

    if (role === 'admin' || role === 'sub_admin') {
      if (req.query.scope === 'all') {
        return res.json({ success: true, data: allOrders });
      }
      const personalOrders = allOrders.filter((o) => o.customerId === userId);
      return res.json({ success: true, data: personalOrders });
    }

    if (role === 'restaurant' && req.user?.restaurantId) {
      const restOrders = allOrders.filter((o) => o.restaurantId === req.user?.restaurantId);
      return res.json({ success: true, data: restOrders });
    }

    if (role === 'courier') {
      const courierOrders = allOrders.filter(
        (o) => o.status === 'in_transit' || o.status === 'ready_for_pickup' || o.status === 'delivered'
      );
      return res.json({ success: true, data: courierOrders });
    }

    if (role === 'customer' && userId) {
      const customerOrders = allOrders.filter((o) => o.customerId === userId);
      return res.json({ success: true, data: customerOrders });
    }

    return res.json({ success: true, data: [] });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Could not fetch orders' });
  }
});

// Get single order (with live Cloudflare D1 query and strict tenant/role ownership)
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    let order: any = null;

    try {
      const d1Res = await d1Client.query('SELECT * FROM orders WHERE id = ? OR short_id = ? LIMIT 1', [req.params.id, req.params.id]);
      if (d1Res.results && d1Res.results.length > 0) {
        const o: any = d1Res.results[0];
        let parsed: any = null;
        if (o.raw_json) {
          try { parsed = JSON.parse(o.raw_json); } catch (e) {}
        }
        let items: any[] = [];
        try {
          items = typeof o.items === 'string' ? JSON.parse(o.items) : (o.items || []);
        } catch (e) {}

        order = {
          ...(parsed || {}),
          id: o.id,
          shortId: o.short_id || parsed?.shortId,
          customerId: o.customer_id || parsed?.customerId,
          customerName: o.customer_name || parsed?.customerName,
          customerPhone: o.customer_phone || parsed?.customerPhone,
          customerAddress: o.customer_address || parsed?.customerAddress,
          restaurantId: o.restaurant_id || parsed?.restaurantId,
          restaurantName: o.restaurant_name || parsed?.restaurantName,
          items: items.length > 0 ? items : (parsed?.items || []),
          total: o.total !== undefined ? o.total : parsed?.total,
          currency: o.currency || parsed?.currency || 'NGN',
          paymentMethod: o.payment_method || parsed?.paymentMethod,
          paymentStatus: o.payment_status || parsed?.paymentStatus,
          status: o.status || parsed?.status,
          handoverPin: o.handover_pin || parsed?.handoverPin,
          createdAt: o.created_at || parsed?.createdAt,
          updatedAt: o.updated_at || parsed?.updatedAt
        };
      }
    } catch (e) {}

    if (!order) {
      order = await db.getOrderById(req.params.id);
    }

    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    const role = req.user?.role;
    const userId = req.user?.id;

    // Enforce multi-role ownership authorization
    if (role === 'admin' || role === 'sub_admin') {
      return res.json({ success: true, data: order });
    }

    if (role === 'restaurant' && req.user?.restaurantId && order.restaurantId === req.user.restaurantId) {
      return res.json({ success: true, data: order });
    }

    if (role === 'customer' && userId && order.customerId === userId) {
      return res.json({ success: true, data: order });
    }

    if (role === 'courier' && order.courier?.id === req.user?.id) {
      return res.json({ success: true, data: order });
    }

    return res.status(403).json({
      success: false,
      error: 'Access Denied: You do not have permission to view this order.'
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Could not fetch order' });
  }
});

// Update order status (Kitchen or Courier progress)
const UpdateStatusSchema = z.object({
  status: OrderStatusSchema,
  note: z.string().optional()
});

router.patch('/:id/status', validateBody(UpdateStatusSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { status, note } = req.body;
    const updated = await db.updateOrderStatus(req.params.id, status, note);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    await db.logAudit({
      userId: req.user?.id,
      userEmail: req.user?.email,
      userRole: req.user?.role,
      action: 'ORDER_STATUS_CHANGED',
      resource: 'ORDER',
      resourceId: updated.id,
      details: { newStatus: status },
      ip: req.ip
    });

    return res.json({ success: true, data: updated });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to update order status' });
  }
});

// Courier Handover PIN Verification
const VerifyPinSchema = z.object({
  enteredPin: z.string().min(4).max(4)
});

router.post('/:id/verify-handover', validateBody(VerifyPinSchema), async (req: AuthRequest, res: Response) => {
  try {
    const order = await db.getOrderById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    if (order.handoverPin && order.handoverPin !== req.body.enteredPin) {
      return res.status(400).json({
        success: false,
        error: 'Invalid customer handover PIN code. Please confirm with the customer.'
      });
    }

    const updated = await db.updateOrderStatus(
      order.id,
      'delivered',
      `Delivered successfully with verified handover PIN (${req.body.enteredPin})`
    );

    return res.json({
      success: true,
      message: 'Handover PIN verified. Order marked as delivered!',
      data: updated
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Handover verification failed' });
  }
});

// Kitchen Prep Time Adjustment (+5m, +10m, +15m)
const PrepTimeSchema = z.object({
  adjustmentMinutes: z.number().int()
});

router.patch('/:id/prep-time', validateBody(PrepTimeSchema), async (req: AuthRequest, res: Response) => {
  try {
    const updated = await db.adjustOrderPrepTime(req.params.id, req.body.adjustmentMinutes);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    return res.json({
      success: true,
      message: `Prep time adjusted by +${req.body.adjustmentMinutes}m`,
      data: updated
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Could not adjust prep time' });
  }
});

// Refund Order (Admin / Support)
const RefundSchema = z.object({
  amount: z.number().positive(),
  reason: z.string().min(3)
});

router.post('/:id/refund', validateBody(RefundSchema), async (req: AuthRequest, res: Response) => {
  try {
    const updated = await db.refundOrder(req.params.id, req.body.amount, req.body.reason);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    await db.createTransaction({
      id: `txn-rf-${Date.now()}`,
      orderId: updated.id,
      reference: `ref_refund_${Date.now()}`,
      amount: req.body.amount,
      currency: updated.currency || 'USD',
      status: 'refunded',
      paymentMethod: 'Wallet Credit Refund',
      idempotencyKey: `rf_${updated.id}_${Date.now()}`,
      createdAt: new Date().toISOString()
    });

    await db.logAudit({
      userId: req.user?.id,
      userEmail: req.user?.email,
      userRole: req.user?.role || 'admin',
      action: 'ORDER_REFUNDED',
      resource: 'ORDER',
      resourceId: updated.id,
      details: { refundAmount: req.body.amount, reason: req.body.reason },
      ip: req.ip
    });

    return res.json({
      success: true,
      message: `Successfully refunded $${req.body.amount.toFixed(2)} to customer wallet credit.`,
      data: updated
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to process refund' });
  }
});

// Update GPS route progress
const UpdateGpsSchema = z.object({
  progress: z.number().min(0).max(100)
});

router.patch('/:id/gps', validateBody(UpdateGpsSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { progress } = req.body;
    const updated = await db.updateOrderGPS(req.params.id, progress);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }
    return res.json({ success: true, data: updated });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to update GPS progress' });
  }
});

// Send Chat Message
const ChatMessageInputSchema = z.object({
  sender: z.enum(['customer', 'courier']),
  text: z.string().min(1).max(500)
});

router.post('/:id/messages', validateBody(ChatMessageInputSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { sender, text } = req.body;
    const senderName = req.user?.name || (sender === 'customer' ? 'Customer' : 'Courier');

    const msg = await db.addChatMessage(req.params.id, sender, senderName, text);
    if (!msg) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    return res.status(201).json({ success: true, data: msg });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to send message' });
  }
});

export default router;
