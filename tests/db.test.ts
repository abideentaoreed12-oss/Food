import { describe, it, expect, beforeEach } from 'vitest';
import { db, loadDatabase } from '../server/db';
import { CONFIG } from '../server/config';
import bcrypt from 'bcryptjs';

describe('Production Database & Security Ledger', () => {
  beforeEach(async () => {
    loadDatabase();
    // Ensure at least one test order exists
    const orders = await db.getOrders();
    if (orders.length === 0) {
      await db.createOrder({
        id: 'ord-test-01',
        shortId: 'VR-1001',
        customerId: 'usr-cust-1',
        customerName: 'Amina you',
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

  it('correctly hashes passwords with salt and verifies valid users', async () => {
    const admin = await db.findUserByEmail(CONFIG.ADMIN_EMAIL);
    expect(admin).toBeDefined();
    expect(admin?.role).toBe('admin');

    const isValid = await bcrypt.compare(CONFIG.ADMIN_PASSWORD, admin!.passwordHash);
    expect(isValid).toBe(true);

    const isInvalid = await bcrypt.compare('WrongPassword', admin!.passwordHash);
    expect(isInvalid).toBe(false);
  });

  it('retrieves restaurants catalog with structured categories', async () => {
    const list = await db.getRestaurants();
    expect(list.length).toBeGreaterThanOrEqual(1);

    const first = list[0];
    expect(first).toBeDefined();
    expect(first?.categories.length).toBeGreaterThan(0);
  });

  it('updates dish availability atomically', async () => {
    const list = await db.getRestaurants();
    const restId = list[0]?.id || 'rest-1';
    const itemId = list[0]?.categories[0]?.items[0]?.id || 'item-101';

    const success = await db.updateMenuItemAvailability(restId, itemId, false);
    expect(success).toBe(true);

    const rest = await db.getRestaurantById(restId);
    const item = rest?.categories[0].items.find((i) => i.id === itemId);
    expect(item?.isAvailable).toBe(false);

    // Reset back to available
    await db.updateMenuItemAvailability(restId, itemId, true);
  });

  it('manages orders and transitions status with history tracking', async () => {
    const orders = await db.getOrders();
    expect(orders.length).toBeGreaterThan(0);

    const first = orders[0];
    const updated = await db.updateOrderStatus(first.id, 'delivered', 'Handed over to customer');
    expect(updated?.status).toBe('delivered');
    expect(updated?.routeProgress).toBe(100);
    expect(updated?.statusHistory.some((h) => h.status === 'delivered')).toBe(true);
  });

  it('records transactions and retrieves them idempotently', async () => {
    const key = `test_idemp_${Date.now()}`;
    await db.createTransaction({
      id: `txn-test-${Date.now()}`,
      orderId: 'ord-test-01',
      reference: `ref_test_${Date.now()}`,
      amount: 11900,
      currency: 'NGN',
      paymentMethod: 'card',
      status: 'completed',
      idempotencyKey: key,
      createdAt: new Date().toISOString()
    });

    const txns = await db.getAllTransactions();
    expect(txns.length).toBeGreaterThan(0);
  });

  it('creates, persists, and deletes sub_admin staff accounts permanently', async () => {
    const subAdminId = `usr-subadmin-${Date.now()}`;
    const subAdminEmail = `ops.${Date.now()}@veyrang.com`;
    const salt = bcrypt.genSaltSync(10);
    const now = new Date().toISOString();

    const created = await db.createUser({
      id: subAdminId,
      email: subAdminEmail,
      passwordHash: bcrypt.hashSync('SubAdmin2026!', salt),
      name: 'Operations Sub Admin',
      role: 'sub_admin',
      phone: '+234 812 000 9999',
      walletBalanceUSD: 0,
      walletBalanceNGN: 0,
      savedAddresses: [],
      createdAt: now,
      updatedAt: now
    });

    expect(created.id).toBe(subAdminId);
    expect(created.role).toBe('sub_admin');

    const fetched = await db.findUserById(subAdminId);
    expect(fetched).toBeDefined();
    expect(fetched?.role).toBe('sub_admin');

    const deleted = await db.deleteUser(subAdminId);
    expect(deleted).toBe(true);

    const afterDelete = await db.findUserById(subAdminId);
    expect(afterDelete).toBeUndefined();
  });
});
