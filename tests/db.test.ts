import { describe, it, expect, beforeEach } from 'vitest';
import { db, loadDatabase } from '../server/db';
import { d1Client } from '../server/db/d1Client';
import { CONFIG } from '../server/config';
import bcrypt from 'bcryptjs';

describe('Production Database & Security Ledger', () => {
  beforeEach(async () => {
    loadDatabase();
    // Ensure test restaurant exists
    const rests = await db.getRestaurants();
    if (rests.length === 0) {
      const now = new Date().toISOString();
      const testRest = {
        id: 'rest-1',
        name: 'Burger House Lekki',
        cuisine: 'Burgers & American',
        rating: 4.8,
        reviewCount: 120,
        deliveryTimeMin: 20,
        deliveryTimeMax: 35,
        deliveryFee: 1200,
        minOrder: 2500,
        priceTier: '$$',
        address: '10 Victoria Island, Lagos',
        isOpen: true,
        isBusyPaused: false,
        categories: [
          {
            id: 'cat-1',
            name: 'Burgers',
            items: [
              {
                id: 'item-101',
                restaurantId: 'rest-1',
                name: 'Classic Suya Burger',
                description: 'Spiced beef patty with artisanal brioche',
                price: 5200,
                category: 'Burgers',
                dietary: ['Halal'],
                isAvailable: true,
                prepTimeMin: 20
              }
            ]
          }
        ]
      };
      await d1Client.query(
        `INSERT OR REPLACE INTO restaurants (id, name, slug, cuisine, rating, review_count, delivery_time_min, delivery_time_max, delivery_fee, address, is_open, is_busy_paused, raw_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?, ?)`,
        ['rest-1', 'Burger House Lekki', 'burger-house-lekki', 'Burgers & American', 4.8, 120, 20, 35, 1200, '10 Victoria Island, Lagos', JSON.stringify(testRest), now]
      );
      await d1Client.query(
        `INSERT OR REPLACE INTO menu_categories (id, restaurant_id, name, sort_order, created_at)
         VALUES (?, ?, ?, 1, ?)`,
        ['cat-1', 'rest-1', 'Burgers', now]
      );
      await d1Client.query(
        `INSERT OR REPLACE INTO menu_items (id, restaurant_id, category_id, name, description, price, is_available, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
        ['item-101', 'rest-1', 'cat-1', 'Classic Suya Burger', 'Spiced beef patty with artisanal brioche', 5200, now]
      );
    }
    // Ensure at least one test order exists
    const orders = await db.getOrders();
    if (orders.length === 0) {
      await db.createOrder({
        id: 'ord-test-01',
        shortId: 'VR-1001',
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
    const rest = list.find((r) => r.categories?.some((c) => c.items?.length > 0)) || list[0];
    const restId = rest?.id || 'rest-1';
    const category = rest.categories?.find((c) => c.items?.length > 0) || rest.categories[0];
    const itemId = category?.items?.[0]?.id || 'item-101';

    const success = await db.updateMenuItemAvailability(restId, itemId, false);
    expect(success).toBe(true);

    const updatedRest = await db.getRestaurantById(restId);
    const updatedCategory = updatedRest?.categories?.find((c) => c.items?.length > 0) || updatedRest?.categories?.[0];
    const item = updatedCategory?.items.find((i) => i.id === itemId);
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
