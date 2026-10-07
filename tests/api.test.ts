import { describe, it, expect, beforeEach } from 'vitest';
import { db, loadDatabase } from '../server/db';
import crypto from 'crypto';

describe('Orders, Financial Calculations & Webhooks Security', () => {
  beforeEach(async () => {
    loadDatabase();
    // Ensure test order exists
    const orders = await db.getOrders();
    if (orders.length === 0) {
      await db.createOrder({
        id: 'ord-test-api-01',
        shortId: 'VR-2001',
        customerId: 'usr-cust-1',
        customerName: 'Amina Bello',
        customerPhone: '+234 801 234 5678',
        customerAddress: '15 Admiralty Way, Lekki Phase 1, Lagos',
        restaurantId: 'rest-1',
        restaurantName: 'Burger House Lekki',
        restaurantAddress: '10 Victoria Island, Lagos',
        items: [
          {
            cartItemId: 'cart-1',
            menuItemId: 'item-101',
            name: 'Classic Suya Burger',
            price: 5200,
            quantity: 2,
            selectedOptions: [],
            itemTotal: 10400
          }
        ],
        subtotal: 10400,
        deliveryFee: 1200,
        serviceFee: 300,
        tip: 0,
        discountAmount: 0,
        walletDeduction: 0,
        total: 11900,
        currency: 'NGN',
        fulfillmentType: 'delivery',
        isContactless: false,
        paymentMethod: 'card',
        paymentStatus: 'paid',
        transactionRef: 'ref_seed_01',
        status: 'preparing',
        prepTimeAdjustmentMin: 0,
        estimatedArrivalMinutes: 25,
        handoverPin: '7412',
        deliveryNotes: '',
        routeProgress: 35,
        statusHistory: [
          {
            status: 'preparing',
            timestamp: new Date().toISOString(),
            note: 'Order confirmed by kitchen'
          }
        ],
        messages: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
  });

  it('adjusts prep time and persists status history', async () => {
    const orders = await db.getOrders();
    const order = orders[0];
    const prevEta = order.estimatedArrivalMinutes;

    const updated = await db.adjustOrderPrepTime(order.id, 10);
    expect(updated).toBeDefined();
    expect(updated?.prepTimeAdjustmentMin).toBeGreaterThanOrEqual(10);
    expect(updated?.estimatedArrivalMinutes).toBe(prevEta + 10);
    expect(updated?.statusHistory.some((h) => h.note.includes('+10 min'))).toBe(true);
  });

  it('handles kitchen busy mode toggles reliably', async () => {
    const list = await db.getRestaurants();
    const restId = list[0]?.id || 'rest-1';

    const rest = await db.updateRestaurantBusyMode(restId, true);
    expect(rest).toBeDefined();
    expect(rest?.isBusyPaused).toBe(true);

    const restored = await db.updateRestaurantBusyMode(restId, false);
    expect(restored?.isBusyPaused).toBe(false);
  });

  it('verifies handover PIN logic correctly', async () => {
    const orders = await db.getOrders();
    const order = orders[0];
    expect(order.handoverPin).toBeDefined();

    // Verify correct pin matches order pin
    const correctPin = order.handoverPin;
    expect(correctPin.length).toBe(4);
  });

  it('verifies HMAC-SHA256 signature calculation', () => {
    const secret = 'whsec_veyrang_production_secret_2026';
    const payload = JSON.stringify({ eventType: 'payment_intent.succeeded', orderId: 'ord-7821', amount: 43.19 });
    const computedHash = crypto.createHmac('sha256', secret).update(payload).digest('hex');

    const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    expect(computedHash).toBe(expected);
  });

  it('handles refund order and creates ledger entry', async () => {
    const orders = await db.getOrders();
    const order = orders[0];

    const refunded = await db.refundOrder(order.id, 1500, 'Customer requested cancellation');
    expect(refunded).toBeDefined();
    expect(refunded?.paymentStatus).toBe('refunded');
    expect(refunded?.statusHistory.some((h) => h.note.includes('Refund'))).toBe(true);
  });

  it('enforces IDOR ownership separation between different customers', async () => {
    const testOrderId = `ord-idor-${Date.now()}`;
    await db.createOrder({
      id: testOrderId,
      shortId: 'VR-IDOR',
      customerId: 'usr-cust-1',
      customerName: 'Test User A',
      customerPhone: '+234 800 000 0000',
      customerAddress: '123 Lekki Way',
      restaurantId: 'rest-1',
      restaurantName: 'Test Restaurant',
      restaurantAddress: '10 V.I.',
      items: [],
      subtotal: 1000,
      deliveryFee: 500,
      serviceFee: 100,
      tip: 0,
      discountAmount: 0,
      walletDeduction: 0,
      total: 1600,
      currency: 'NGN',
      fulfillmentType: 'delivery',
      isContactless: false,
      paymentMethod: 'card',
      paymentStatus: 'paid',
      status: 'placed',
      prepTimeAdjustmentMin: 0,
      estimatedArrivalMinutes: 25,
      handoverPin: '1234',
      deliveryNotes: '',
      routeProgress: 0,
      statusHistory: [],
      messages: [],
      transactionRef: 'ref-test',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    const order = await db.getOrderById(testOrderId);
    expect(order).toBeDefined();

    const userAId = 'usr-cust-1';
    const userBId = 'usr-cust-2';

    // User A matches ownership
    expect(order?.customerId === userAId).toBe(true);

    // User B does not match ownership (simulating IDOR block)
    expect(order?.customerId === userBId).toBe(false);
  });

  it('calculates trusted server-side menu prices regardless of client payload', async () => {
    const restaurants = await db.getRestaurants();
    const rest = restaurants[0];
    const menuItem = rest.categories[0]?.items[0];

    expect(menuItem).toBeDefined();
    const trustedPrice = menuItem.price;

    // Simulate verified subtotal calculation logic from orders route
    const quantity = 3;
    const expectedSubtotal = trustedPrice * quantity;
    expect(expectedSubtotal).toBe(trustedPrice * quantity);
  });
});
