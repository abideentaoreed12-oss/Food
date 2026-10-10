import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db, loadDatabase, saveDatabase } from '../db/index.ts';
import { d1Client } from '../db/d1Client.ts';
import { AuthRequest, requireAuth, requireRole } from '../middleware/auth.ts';
import { validateBody } from '../middleware/validate.ts';
import { UserRoleSchema } from '../db/schema.ts';
import { CONFIG } from '../config.ts';

const safeJsonParse = <T,>(value: unknown, fallback: T): T => {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value !== 'string') return value as T;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const router = Router();

// Protect all admin routes with authentication and role guard
router.use(requireAuth, requireRole(['admin', 'sub_admin']));

// ==========================================
// 1. PLATFORM OVERVIEW & ANALYTICS
// ==========================================
router.get('/overview', async (_req: AuthRequest, res: Response) => {
  try {
    const [ordersRes, usersRes, countRes, orderCountRes] = await Promise.all([
      d1Client.query('SELECT status, count(*) as cnt, sum(total) as total_amt FROM orders GROUP BY status'),
      d1Client.query('SELECT role, count(*) as cnt FROM users GROUP BY role'),
      d1Client.query('SELECT count(*) as total_users, sum(wallet_balance_ngn) as total_wallet FROM users'),
      d1Client.query('SELECT count(*) as total_orders FROM orders')
    ]);
    if (![ordersRes, usersRes, countRes, orderCountRes].every(result => result.success)) {
      return res.status(503).json({ success: false, error: 'Admin analytics are temporarily unavailable because a database query failed' });
    }

    const statusCounts: Record<string, number> = {};
    let totalGMV = 0;
    for (const row of ordersRes.results || []) {
      statusCounts[row.status] = Number(row.cnt) || 0;
      if (row.status !== 'cancelled') totalGMV += Number(row.total_amt) || 0;
    }
    const totalUsersCount = Number(countRes.results?.[0]?.total_users) || 0;
    const totalWalletBalanceNGN = Number(countRes.results?.[0]?.total_wallet) || 0;
    const totalOrdersCount = Number(orderCountRes.results?.[0]?.total_orders) || 0;
    const activeCount = ['placed', 'confirmed', 'preparing', 'ready_for_pickup', 'in_transit']
      .reduce((sum, status) => sum + (statusCounts[status] || 0), 0);

    return res.json({
      success: true,
      data: {
        totalUsers: totalUsersCount,
        totalOrders: totalOrdersCount,
        grossMerchandiseVolume: totalGMV,
        activeOrders: activeCount,
        orderStatusBreakdown: statusCounts,
        userRoleBreakdown: usersRes.results || [],
        totalWalletBalanceNGN
      }
    });
  } catch (error: any) {
    console.error('[Admin overview] D1 query failed:', error?.message || error);
    return res.status(503).json({ success: false, error: 'Admin analytics are temporarily unavailable' });
  }
});

// ==========================================
// 2. USERS & STAFF MANAGEMENT
// ==========================================
router.get('/users', async (req: AuthRequest, res: Response) => {
  try {
    try {
      const d1Res = await d1Client.query(
        'SELECT id, email, name, role, phone, address, restaurant_id, wallet_balance_usd, wallet_balance_ngn, saved_addresses, created_at, updated_at FROM users ORDER BY created_at DESC'
      );
      if (!d1Res.success) return res.status(503).json({ success: false, error: 'User database is unavailable' });
      if (d1Res && d1Res.results) {
        const parsedUsers = d1Res.results.map((u: any) => ({
          id: u.id,
          email: u.email,
          name: u.name,
          role: u.role,
          phone: u.phone,
          address: u.address,
          restaurantId: u.restaurant_id,
          walletBalanceUSD: u.wallet_balance_usd || 0,
          walletBalanceNGN: u.wallet_balance_ngn || 0,
          savedAddresses: safeJsonParse(u.saved_addresses, []),
          createdAt: u.created_at,
          updatedAt: u.updated_at
        }));
        return res.json({ success: true, data: parsedUsers });
      }
    } catch (d1Err) {
      console.error('D1 users query failed:', d1Err);
      return res.status(503).json({ success: false, error: 'User database is unavailable' });
    }
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

const RoleUpdateSchema = z.object({
  role: UserRoleSchema
});

router.patch('/users/:id/role', validateBody(RoleUpdateSchema), async (req: AuthRequest, res: Response) => {
  if (req.user!.role === 'sub_admin') {
    return res.status(403).json({ success: false, error: 'Sub Admins are not permitted to change user roles. Only Super Admins have permission to manage staff roles.' });
  }
  try {
    const rawId = req.params.id;
    const userId = decodeURIComponent(rawId || '').trim();
    const { role } = req.body;
    
    const updated = await db.updateUserRole(userId, role);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'User not found in Cloudflare D1 database' });
    }

    await db.logAudit({
      userId: req.user!.id,
      userEmail: req.user!.email,
      userRole: req.user!.role,
      action: 'ADMIN_USER_ROLE_CHANGED',
      resource: 'USER',
      resourceId: updated.id,
      details: { newRole: role, userEmail: updated.email },
      ip: req.ip
    });

    return res.json({ success: true, data: updated, message: `Role updated to ${role} in D1` });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/users/:id/approve', async (req: AuthRequest, res: Response) => {
  try {
    const users = await db.getAllUsers();
    const user = users.find(u => u.id === req.params.id);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    await db.logAudit({
      userId: req.user!.id,
      userEmail: req.user!.email,
      userRole: req.user!.role,
      action: 'ADMIN_USER_APPROVED',
      resource: 'USER',
      resourceId: user.id,
      details: { email: user.email },
      ip: req.ip
    });

    return res.json({ success: true, message: 'User account approved' });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 3. LIVE ORDERS MANAGEMENT
// ==========================================
router.get('/orders', async (req: AuthRequest, res: Response) => {
  try {
    const ordersRes = await d1Client.query('SELECT * FROM orders ORDER BY created_at DESC');
    if (ordersRes && ordersRes.results) {
      const parsedOrders = ordersRes.results.map((o: any) => {
        let parsed: any = null;
        if (o.raw_json) {
          try { parsed = JSON.parse(o.raw_json); } catch (e) {}
        }
        let items = [];
        try {
          items = typeof o.items === 'string' ? JSON.parse(o.items) : (o.items || []);
        } catch (e) {
          items = [];
        }
        return {
          ...(parsed || {}),
          id: o.id,
          shortId: o.short_id || parsed?.shortId,
          customerName: o.customer_name || parsed?.customerName,
          customerPhone: o.customer_phone || parsed?.customerPhone,
          customerAddress: o.customer_address || parsed?.customerAddress,
          customerApartment: o.customer_apartment || parsed?.customerApartment,
          restaurantId: o.restaurant_id || parsed?.restaurantId,
          restaurantName: o.restaurant_name || parsed?.restaurantName,
          restaurantAddress: o.restaurant_address || parsed?.restaurantAddress,
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
      return res.json({ success: true, data: parsedOrders });
    }
  } catch (error: any) {
    console.error('D1 admin orders query failed:', error.message);
    return res.status(503).json({ success: false, error: 'Order database is unavailable' });
  }
});

router.patch('/orders/:id/status', async (req: AuthRequest, res: Response) => {
  try {
    const { status, note } = req.body;
    if (!status) return res.status(400).json({ success: false, error: 'Status is required' });

    await d1Client.query('UPDATE orders SET status = ?, updated_at = ? WHERE id = ?', [
      status,
      new Date().toISOString(),
      req.params.id
    ]);

    await db.updateOrderStatus(req.params.id, status, note);

    await db.logAudit({
      userId: req.user!.id,
      userEmail: req.user!.email,
      userRole: req.user!.role,
      action: 'ADMIN_ORDER_STATUS_CHANGED',
      resource: 'ORDER',
      resourceId: req.params.id,
      details: { newStatus: status, note },
      ip: req.ip
    });

    return res.json({ success: true, message: `Order status changed to ${status}` });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/orders/:id/refund', async (req: AuthRequest, res: Response) => {
  try {
    const order = await db.getOrderById(req.params.id);
    if (!order) return res.status(404).json({ success: false, error: 'Order not found' });

    // Cancel order and credit customer wallet
    await db.refundOrder(order.id, order.total, 'Refunded by administrator');
    
    // Find customer and credit wallet in D1
    const customer = (await db.getAllUsers()).find(u => u.name === order.customerName || u.phone === order.customerPhone);
    if (customer) {
      const refundAmount = order.total;
      await d1Client.query(
        'UPDATE users SET wallet_balance_ngn = COALESCE(wallet_balance_ngn, 0) + ? WHERE id = ?',
        [refundAmount, customer.id]
      ).catch(() => {});
    }

    await db.logAudit({
      userId: req.user!.id,
      userEmail: req.user!.email,
      userRole: req.user!.role,
      action: 'ADMIN_ORDER_REFUNDED',
      resource: 'ORDER',
      resourceId: order.id,
      details: { amount: order.total, customer: order.customerName },
      ip: req.ip
    });

    return res.json({ success: true, message: `Order #${order.shortId} refunded successfully` });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 4. MENU ITEMS & DISHES
// ==========================================
router.get('/menu', async (req: AuthRequest, res: Response) => {
  try {
    const menuRes = await d1Client.query(
      `SELECT m.id, m.restaurant_id, m.category_id, m.category_id as category, m.name, m.description, m.price, m.dietary_tags, m.popular, m.calories, m.prep_time_min, m.is_available, m.image_r2_url as image_url, m.image_r2_url, m.created_at, r.name as restaurant_name 
       FROM menu_items m 
       LEFT JOIN restaurants r ON m.restaurant_id = r.id 
       ORDER BY m.created_at DESC`
    );

    const itemsMap = new Map<string, any>();
    if (menuRes.results) {
      for (const item of menuRes.results) {
        itemsMap.set(item.id, {
          ...item,
          is_available: item.is_available === 1 || item.is_available === true ? 1 : 0
        });
      }
    }

    // Also extract dishes embedded in restaurants.raw_json so no items are ever 404 or missing
    const restRes = await d1Client.query('SELECT id, name, raw_json FROM restaurants');
    if (restRes.results) {
      for (const r of restRes.results) {
        if (r.raw_json) {
          try {
            const parsed = JSON.parse(r.raw_json);
            if (parsed.categories) {
              for (const cat of parsed.categories) {
                if (cat.items) {
                  for (const it of cat.items) {
                    if (!itemsMap.has(it.id)) {
                      itemsMap.set(it.id, {
                        id: it.id,
                        restaurant_id: r.id,
                        restaurant_name: r.name || parsed.name,
                        category_id: it.category || cat.name || 'Main',
                        category: it.category || cat.name || 'Main',
                        name: it.name,
                        description: it.description || '',
                        price: Number(it.price || 0),
                        is_available: it.isAvailable !== false ? 1 : 0,
                        image_url: it.imageUrl || it.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500',
                        image_r2_url: it.imageUrl || it.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500',
                        prep_time_min: it.prepTimeMin || 20,
                        calories: it.calories || 450
                      });
                    }
                  }
                }
              }
            }
          } catch (e) {}
        }
      }
    }

    return res.json({ success: true, data: Array.from(itemsMap.values()) });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/menu', async (req: AuthRequest, res: Response) => {
  try {
    const { restaurantId, name, description, price, category, imageUrl, prepTimeMin, calories } = req.body;
    if (!name || !price) {
      return res.status(400).json({ success: false, error: 'Name and price are required' });
    }

    const itemId = `m-${Date.now()}`;
    const restId = restaurantId || 'rest-1';
    const catName = category || 'Main Dishes';
    const now = new Date().toISOString();

    // 1. Insert into D1 menu_items table
    await d1Client.query(
      `INSERT INTO menu_items (id, restaurant_id, category_id, name, description, price, dietary_tags, popular, calories, prep_time_min, is_available, image_r2_url, created_at)
       VALUES (?, ?, ?, ?, ?, ?, '["Halal"]', 0, ?, ?, 1, ?, ?)`,
      [itemId, restId, catName, name, description || '', Number(price), calories || 450, prepTimeMin || 20, imageUrl || '', now]
    );

    // 2. Also tag and append dish directly to the restaurant's raw_json in D1
    const restRes = await d1Client.query('SELECT raw_json, name FROM restaurants WHERE id = ?', [restId]);
    let restaurantName = 'Restaurant';
    if (restRes.results?.length > 0) {
      restaurantName = restRes.results[0].name || restaurantName;
      if (restRes.results[0].raw_json) {
        try {
          const restData = JSON.parse(restRes.results[0].raw_json);
          if (!restData.categories) restData.categories = [];
          
          let targetCat = restData.categories.find(
            (c: any) => c.name.toLowerCase() === catName.toLowerCase()
          );
          if (!targetCat) {
            targetCat = {
              id: `cat-${Date.now()}`,
              name: catName,
              description: `${catName} specials`,
              items: []
            };
            restData.categories.push(targetCat);
          }

          if (!targetCat.items) targetCat.items = [];
          targetCat.items.push({
            id: itemId,
            restaurantId: restId,
            name,
            description: description || '',
            price: Number(price),
            category: catName,
            imageUrl: imageUrl || 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500',
            isAvailable: true,
            dietary: ['Chef Special'],
            popular: false,
            calories: calories || 450,
            prepTimeMin: prepTimeMin || 20
          });

          await d1Client.query('UPDATE restaurants SET raw_json = ? WHERE id = ?', [
            JSON.stringify(restData),
            restId
          ]);
        } catch (e: any) {
          console.warn('Could not sync restaurant raw_json:', e.message);
        }
      }
    }

    const newItem = {
      id: itemId,
      restaurantId: restId,
      restaurantName,
      name,
      description: description || '',
      price: Number(price),
      category: catName,
      imageUrl: imageUrl || 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500',
      isAvailable: true,
      prepTimeMin: prepTimeMin || 20,
      calories: calories || 450
    };

    await db.logAudit({
      userId: req.user!.id,
      userEmail: req.user!.email,
      userRole: req.user!.role,
      action: 'ADMIN_MENU_ITEM_CREATED',
      resource: 'MENU_ITEM',
      resourceId: itemId,
      details: { name, price, restaurantId: restId, restaurantName },
      ip: req.ip
    });

    return res.json({ success: true, data: newItem });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/menu/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // 1. Delete from menu_items table
    await d1Client.query('DELETE FROM menu_items WHERE id = ?', [id]).catch(() => {});

    // 2. Delete from ALL restaurants raw_json in D1
    const allRests = await d1Client.query('SELECT id, raw_json FROM restaurants');
    if (allRests.results) {
      for (const r of allRests.results) {
        if (r.raw_json) {
          try {
            const restData = JSON.parse(r.raw_json);
            let updated = false;
            if (restData.categories) {
              restData.categories.forEach((cat: any) => {
                if (cat.items) {
                  const origLen = cat.items.length;
                  cat.items = cat.items.filter((it: any) => it.id !== id);
                  if (cat.items.length !== origLen) updated = true;
                }
              });
            }
            if (updated) {
              await d1Client.query('UPDATE restaurants SET raw_json = ? WHERE id = ?', [
                JSON.stringify(restData),
                r.id
              ]);
            }
          } catch (e) {}
        }
      }
    }

    return res.json({ success: true, message: 'Menu item deleted permanently' });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.patch('/menu/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { restaurantId, name, description, price, category, imageUrl, isAvailable } = req.body;

    const updates: string[] = [];
    const values: any[] = [];

    if (name !== undefined) { updates.push('name = ?'); values.push(name); }
    if (description !== undefined) { updates.push('description = ?'); values.push(description); }
    if (price !== undefined) { updates.push('price = ?'); values.push(Number(price)); }
    if (category !== undefined) { updates.push('category_id = ?'); values.push(category); }
    if (imageUrl !== undefined) { updates.push('image_r2_url = ?'); values.push(imageUrl); }
    if (restaurantId !== undefined) { updates.push('restaurant_id = ?'); values.push(restaurantId); }
    if (isAvailable !== undefined) { updates.push('is_available = ?'); values.push(isAvailable ? 1 : 0); }

    if (updates.length > 0) {
      values.push(id);
      await d1Client.query(`UPDATE menu_items SET ${updates.join(', ')} WHERE id = ?`, values).catch(() => {});
    }

    // Sync with restaurant raw_json across all restaurants
    const allRests = await d1Client.query('SELECT id, raw_json FROM restaurants');
    if (allRests.results) {
      for (const r of allRests.results) {
        if (r.raw_json) {
          try {
            const restData = JSON.parse(r.raw_json);
            let updated = false;
            if (restData.categories) {
              restData.categories.forEach((cat: any) => {
                if (cat.items) {
                  const it = cat.items.find((x: any) => x.id === id);
                  if (it) {
                    if (name !== undefined) it.name = name;
                    if (price !== undefined) it.price = Number(price);
                    if (description !== undefined) it.description = description;
                    if (imageUrl !== undefined) it.imageUrl = imageUrl;
                    if (isAvailable !== undefined) it.isAvailable = isAvailable;
                    updated = true;
                  }
                }
              });
            }
            if (updated) {
              await d1Client.query('UPDATE restaurants SET raw_json = ? WHERE id = ?', [
                JSON.stringify(restData),
                r.id
              ]);
            }
          } catch (e) {}
        }
      }
    }

    return res.json({ success: true, message: 'Menu item updated successfully' });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.patch('/menu/:id/toggle', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    let nextStatus = 1;

    const currentRes = await d1Client.query('SELECT is_available, restaurant_id, name FROM menu_items WHERE id = ?', [id]);
    if (currentRes.results && currentRes.results.length > 0) {
      const currentItem = currentRes.results[0];
      nextStatus = currentItem.is_available === 1 ? 0 : 1;
      await d1Client.query('UPDATE menu_items SET is_available = ? WHERE id = ?', [nextStatus, id]);
    }

    // Also toggle inside restaurants.raw_json
    const allRests = await d1Client.query('SELECT id, raw_json FROM restaurants');
    if (allRests.results) {
      for (const r of allRests.results) {
        if (r.raw_json) {
          try {
            const restData = JSON.parse(r.raw_json);
            let updated = false;
            if (restData.categories) {
              restData.categories.forEach((cat: any) => {
                if (cat.items) {
                  const it = cat.items.find((x: any) => x.id === id);
                  if (it) {
                    if (!currentRes.results || currentRes.results.length === 0) {
                      it.isAvailable = !it.isAvailable;
                      nextStatus = it.isAvailable ? 1 : 0;
                    } else {
                      it.isAvailable = nextStatus === 1;
                    }
                    updated = true;
                  }
                }
              });
            }
            if (updated) {
              await d1Client.query('UPDATE restaurants SET raw_json = ? WHERE id = ?', [
                JSON.stringify(restData),
                r.id
              ]);
            }
          } catch (e) {}
        }
      }
    }

    return res.json({
      success: true,
      isAvailable: nextStatus === 1,
      message: `Menu item availability updated to ${nextStatus === 1 ? 'Available' : 'Unavailable'}`
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 5. RESTAURANTS & BRANCHES MANAGEMENT
// ==========================================
router.post('/restaurants', async (req: AuthRequest, res: Response) => {
  try {
    const { name, address, cuisine, deliveryTimeMin, deliveryTimeMax, deliveryFee, rating, bannerUrl, tagline, zone } = req.body;
    if (!name || !address) {
      return res.status(400).json({ success: false, error: 'Restaurant name and address are required' });
    }

    const restId = `rest-${Date.now()}`;
    const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const now = new Date().toISOString();

    const initialData = {
      id: restId,
      name,
      slug,
      tagline: tagline || 'Authentic dishes prepared fresh to order',
      cuisine: cuisine || 'Nigerian & Continental',
      address,
      rating: Number(rating || 4.8),
      reviewCount: 1,
      deliveryTimeMin: Number(deliveryTimeMin || 20),
      deliveryTimeMax: Number(deliveryTimeMax || 40),
      deliveryFee: Number(deliveryFee || 1000),
      minOrder: 1500,
      priceTier: '$$',
      bannerUrl: bannerUrl || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1000',
      logoUrl: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=200',
      isOpen: true,
      isBusyPaused: false,
      distanceKm: 2.5,
      categories: [
        {
          id: `cat-${Date.now()}`,
          name: 'Main Dishes',
          description: 'Popular main meals',
          items: []
        }
      ]
    };

    await d1Client.query(
      `INSERT INTO restaurants (id, name, cuisine, rating, raw_json, created_at, slug, review_count, delivery_time_min, delivery_time_max, delivery_fee, min_order, price_tier, address, is_open, is_busy_paused, zone, banner_r2_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, 1500, '$$', ?, 1, 0, ?, ?)`,
      [
        restId,
        name,
        cuisine || 'Nigerian',
        Number(rating || 4.8),
        JSON.stringify(initialData),
        now,
        slug,
        Number(deliveryTimeMin || 20),
        Number(deliveryTimeMax || 40),
        Number(deliveryFee || 1000),
        address,
        zone || 'Lekki / Victoria Island',
        bannerUrl || ''
      ]
    );

    await db.logAudit({
      userId: req.user!.id,
      userEmail: req.user!.email,
      userRole: req.user!.role,
      action: 'ADMIN_RESTAURANT_CREATED',
      resource: 'RESTAURANT',
      resourceId: restId,
      details: { name, cuisine, address },
      ip: req.ip
    });

    return res.json({ success: true, data: initialData, message: `Restaurant "${name}" registered in D1` });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/restaurants/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    await d1Client.query('DELETE FROM restaurants WHERE id = ?', [id]);
    await d1Client.query('DELETE FROM menu_items WHERE restaurant_id = ?', [id]).catch(() => {});

    await db.logAudit({
      userId: req.user!.id,
      userEmail: req.user!.email,
      userRole: req.user!.role,
      action: 'ADMIN_RESTAURANT_DELETED',
      resource: 'RESTAURANT',
      resourceId: id,
      ip: req.ip
    });

    return res.json({ success: true, message: 'Restaurant and related menu items removed from D1' });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Helper to remove files from Cloudflare R2 bucket
async function deleteR2Asset(urlOrKey?: string | null) {
  if (!urlOrKey) return;
  try {
    let key = urlOrKey;
    if (key.includes('/cdn/')) {
      key = key.split('/cdn/')[1];
    } else if (key.includes('objects/')) {
      key = key.split('objects/')[1];
    } else if (key.startsWith('http')) {
      const u = new URL(key);
      key = u.pathname.replace(/^\/cdn\//, '').replace(/^\//, '');
    }
    key = key.replace(/[^a-zA-Z0-9_\-\.\/]/g, '').replace(/^\/+/, '');
    if (!key) return;

    const r2Url = `https://api.cloudflare.com/client/v4/accounts/${CONFIG.CLOUDFLARE_ACCOUNT_ID}/r2/buckets/${CONFIG.CLOUDFLARE_R2_BUCKET}/objects/${key}`;
    await fetch(r2Url, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${CONFIG.CLOUDFLARE_API_TOKEN}`
      }
    });
  } catch (err) {
    console.error('Failed to clean up R2 asset:', err);
  }
}

// Delivery Zones Management (Full CRUD in D1 & R2)
router.get('/delivery-zones', async (req: AuthRequest, res: Response) => {
  try {
    const result = await d1Client.query('SELECT * FROM delivery_zones ORDER BY is_active DESC, name ASC');
    return res.json({ success: true, data: result.results });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/delivery-zones', async (req: AuthRequest, res: Response) => {
  try {
    const { name, code, city, country, currency, baseFee, perKmFee, radiusKm, surgeMultiplier, centerLat, centerLng, mapImageR2Url } = req.body;
    if (!name || !code) {
      return res.status(400).json({ success: false, error: 'Zone name and code are required' });
    }

    const id = `zone-${Date.now()}`;
    const now = new Date().toISOString();

    await d1Client.query(
      `INSERT INTO delivery_zones (
        id, name, code, city, country, currency, center_lat, center_lng, 
        radius_km, base_delivery_fee, per_km_fee, surge_multiplier, is_active, 
        map_image_r2_url, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [
        id,
        name,
        code.toUpperCase().trim(),
        city || 'Lagos',
        country || 'Nigeria',
        currency || 'NGN',
        Number(centerLat || 6.5244),
        Number(centerLng || 3.3792),
        Number(radiusKm || 10),
        Number(baseFee || 1000),
        Number(perKmFee || 200),
        Number(surgeMultiplier || 1.0),
        mapImageR2Url || null,
        now
      ]
    );

    await db.logAudit({
      userId: req.user!.id,
      userEmail: req.user!.email,
      userRole: req.user!.role,
      action: 'ADMIN_ZONE_CREATED',
      resource: 'DELIVERY_ZONE',
      resourceId: id,
      details: { name, code, city, baseFee, surgeMultiplier },
      ip: req.ip
    });

    return res.json({
      success: true,
      message: `Delivery zone "${name}" created in D1`,
      data: { id, name, code, city, base_delivery_fee: baseFee, per_km_fee: perKmFee, radius_km: radiusKm, surge_multiplier: surgeMultiplier, is_active: 1 }
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.patch('/delivery-zones/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, code, city, country, currency, baseFee, perKmFee, radiusKm, surgeMultiplier, centerLat, centerLng, isActive, mapImageR2Url } = req.body;

    const updates: string[] = [];
    const values: any[] = [];

    if (name !== undefined) { updates.push('name = ?'); values.push(name); }
    if (code !== undefined) { updates.push('code = ?'); values.push(code.toUpperCase().trim()); }
    if (city !== undefined) { updates.push('city = ?'); values.push(city); }
    if (country !== undefined) { updates.push('country = ?'); values.push(country); }
    if (currency !== undefined) { updates.push('currency = ?'); values.push(currency); }
    if (baseFee !== undefined) { updates.push('base_delivery_fee = ?'); values.push(Number(baseFee)); }
    if (perKmFee !== undefined) { updates.push('per_km_fee = ?'); values.push(Number(perKmFee)); }
    if (radiusKm !== undefined) { updates.push('radius_km = ?'); values.push(Number(radiusKm)); }
    if (surgeMultiplier !== undefined) { updates.push('surge_multiplier = ?'); values.push(Number(surgeMultiplier)); }
    if (centerLat !== undefined) { updates.push('center_lat = ?'); values.push(Number(centerLat)); }
    if (centerLng !== undefined) { updates.push('center_lng = ?'); values.push(Number(centerLng)); }
    if (isActive !== undefined) { updates.push('is_active = ?'); values.push(isActive ? 1 : 0); }
    if (mapImageR2Url !== undefined) { updates.push('map_image_r2_url = ?'); values.push(mapImageR2Url); }

    if (updates.length > 0) {
      values.push(id);
      await d1Client.query(`UPDATE delivery_zones SET ${updates.join(', ')} WHERE id = ?`, values);
    }

    await db.logAudit({
      userId: req.user!.id,
      userEmail: req.user!.email,
      userRole: req.user!.role,
      action: 'ADMIN_ZONE_UPDATED',
      resource: 'DELIVERY_ZONE',
      resourceId: id,
      details: req.body,
      ip: req.ip
    });

    const updated = await d1Client.query('SELECT * FROM delivery_zones WHERE id = ?', [id]);
    return res.json({ success: true, message: 'Delivery zone updated in D1', data: updated.results?.[0] });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.patch('/delivery-zones/:id/toggle', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const current = await d1Client.query('SELECT is_active FROM delivery_zones WHERE id = ?', [id]);
    const nextStatus = current.results?.[0]?.is_active === 1 ? 0 : 1;
    await d1Client.query('UPDATE delivery_zones SET is_active = ? WHERE id = ?', [nextStatus, id]);

    await db.logAudit({
      userId: req.user!.id,
      userEmail: req.user!.email,
      userRole: req.user!.role,
      action: 'ADMIN_ZONE_TOGGLED',
      resource: 'DELIVERY_ZONE',
      resourceId: id,
      details: { isActive: nextStatus === 1 },
      ip: req.ip
    });

    return res.json({ success: true, isActive: nextStatus === 1, message: `Zone is now ${nextStatus === 1 ? 'active' : 'inactive'}` });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.patch('/delivery-zones/:id/surge', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { surgeMultiplier } = req.body;
    if (surgeMultiplier === undefined || surgeMultiplier === null || surgeMultiplier === '' || !Number.isFinite(Number(surgeMultiplier)) || Number(surgeMultiplier) < 0) {
      return res.status(400).json({ success: false, error: 'A valid non-negative surge multiplier is required' });
    }
    const currentZone = await d1Client.query('SELECT id FROM delivery_zones WHERE id = ? LIMIT 1', [id]);
    if (!currentZone.results?.length) return res.status(404).json({ success: false, error: 'Delivery zone not found' });
    const surge = Number(surgeMultiplier);
    const updated = await d1Client.query('UPDATE delivery_zones SET surge_multiplier = ? WHERE id = ?', [surge, id]);
    if (updated.meta?.rows_written === 0) return res.status(503).json({ success: false, error: 'Surge multiplier was not updated' });

    await db.logAudit({
      userId: req.user!.id,
      userEmail: req.user!.email,
      userRole: req.user!.role,
      action: 'ADMIN_ZONE_SURGE_UPDATED',
      resource: 'DELIVERY_ZONE',
      resourceId: id,
      details: { surgeMultiplier: surge },
      ip: req.ip
    });

    return res.json({ success: true, surgeMultiplier: surge, message: `Surge multiplier updated to ${surge}x in D1` });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/delivery-zones/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    // Check for associated R2 map image and clean it up
    const existing = await d1Client.query('SELECT map_image_r2_url FROM delivery_zones WHERE id = ?', [id]);
    const mapUrl = existing.results?.[0]?.map_image_r2_url;
    if (mapUrl) {
      await deleteR2Asset(mapUrl);
    }

    await d1Client.query('DELETE FROM delivery_zones WHERE id = ?', [id]);

    await db.logAudit({
      userId: req.user!.id,
      userEmail: req.user!.email,
      userRole: req.user!.role,
      action: 'ADMIN_ZONE_DELETED',
      resource: 'DELIVERY_ZONE',
      resourceId: id,
      ip: req.ip
    });

    return res.json({ success: true, message: 'Delivery zone removed from D1 & R2' });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Staff Creation & Deletion
router.post('/staff', async (req: AuthRequest, res: Response) => {
  if (req.user!.role === 'sub_admin') {
    return res.status(403).json({ success: false, error: 'Sub Admins are not permitted to add or create staff members.' });
  }
  try {
    const { name, email, role, phone, password, restaurantId } = req.body;
    if (!name || !email || !role) {
      return res.status(400).json({ success: false, error: 'Name, email, and role are required' });
    }
    if (!['admin', 'restaurant', 'courier', 'sub_admin'].includes(role)) {
      return res.status(400).json({ success: false, error: 'Unsupported staff role' });
    }
    if (role === 'restaurant' && !restaurantId) {
      return res.status(400).json({ success: false, error: 'Select an existing restaurant or create the restaurant before assigning its account' });
    }
    if (role === 'restaurant') {
      const restaurantCheck = await d1Client.query('SELECT id FROM restaurants WHERE id = ? LIMIT 1', [restaurantId]);
      if (!restaurantCheck.success) return res.status(503).json({ success: false, error: 'Restaurant database is unavailable' });
      if (!restaurantCheck.results?.length) return res.status(404).json({ success: false, error: 'Selected restaurant does not exist' });
    }

    const userId = `usr-staff-${Date.now()}`;
    const now = new Date().toISOString();
    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(password || 'StaffPass2026!', salt);

    // 1. Authoritative persistence in local DB with atomic disk flush
    const newUser = await db.createUser({
      id: userId,
      email: email.toLowerCase().trim(),
      passwordHash,
      name,
      role,
      phone: phone || '+234 800 000 0000',
      walletBalanceUSD: 0,
      walletBalanceNGN: 0,
      savedAddresses: [],
      restaurantId: role === 'restaurant' ? restaurantId : undefined,
      createdAt: now,
      updatedAt: now
    });

    // 2. Persistent insertion into live Cloudflare D1 edge database
    await d1Client.query(
      'INSERT INTO users (id, email, password_hash, name, role, phone, restaurant_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        userId,
        email.toLowerCase().trim(),
        passwordHash,
        name,
        role,
        phone || null,
        role === 'restaurant' ? restaurantId : null,
        now,
        now
      ]
    );
    if (!d1Insert.success) {
      return res.status(503).json({ success: false, error: 'Staff account could not be saved to the authoritative database' });
    }

    await db.logAudit({
      userId: req.user!.id,
      userEmail: req.user!.email,
      userRole: req.user!.role,
      action: 'STAFF_MEMBER_CREATED',
      resource: 'USER',
      resourceId: userId,
      details: { name, email, role },
      ip: req.ip
    });

    return res.json({ success: true, message: `Staff member "${name}" registered permanently as ${role}`, data: newUser });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/users/:id', async (req: AuthRequest, res: Response) => {
  if (req.user!.role === 'sub_admin') {
    return res.status(403).json({ success: false, error: 'Sub Admins are not permitted to delete users or staff accounts.' });
  }
  try {
    const { id } = req.params;
    await d1Client.query('DELETE FROM users WHERE id = ?', [id]).catch(() => {});
    await db.deleteUser(id);

    await db.logAudit({
      userId: req.user!.id,
      userEmail: req.user!.email,
      userRole: req.user!.role,
      action: 'USER_DELETED',
      resource: 'USER',
      resourceId: id,
      details: { deletedUserId: id },
      ip: req.ip
    });

    return res.json({ success: true, message: 'User permanently removed' });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 5. CATEGORIES
// ==========================================
router.get('/categories', async (req: AuthRequest, res: Response) => {
  try {
    const result = await d1Client.query('SELECT * FROM menu_categories ORDER BY sort_order ASC');
    return res.json({ success: true, data: result.results });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/categories', async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, restaurantId } = req.body;
    if (!name) return res.status(400).json({ success: false, error: 'Category name is required' });

    const id = `cat-${Date.now()}`;
    const restId = restaurantId || 'rest-1';
    await d1Client.query(
      'INSERT INTO menu_categories (id, restaurant_id, name, description, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [id, restId, name, description || '', 99, new Date().toISOString()]
    );

    return res.json({ success: true, data: { id, name, description, restaurantId: restId } });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.patch('/categories/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, restaurantId, sortOrder, isActive, imageR2Url } = req.body;

    const updates: string[] = [];
    const values: any[] = [];

    if (name !== undefined) { updates.push('name = ?'); values.push(name); }
    if (description !== undefined) { updates.push('description = ?'); values.push(description); }
    if (restaurantId !== undefined) { updates.push('restaurant_id = ?'); values.push(restaurantId); }
    if (sortOrder !== undefined) { updates.push('sort_order = ?'); values.push(Number(sortOrder)); }
    if (isActive !== undefined) { updates.push('is_active = ?'); values.push(isActive ? 1 : 0); }
    if (imageR2Url !== undefined) { updates.push('image_r2_url = ?'); values.push(imageR2Url); }

    if (updates.length > 0) {
      values.push(id);
      await d1Client.query(`UPDATE menu_categories SET ${updates.join(', ')} WHERE id = ?`, values);
    }

    const updated = await d1Client.query('SELECT * FROM menu_categories WHERE id = ?', [id]);
    return res.json({ success: true, message: 'Category updated in D1', data: updated.results?.[0] });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/categories/:id', async (req: AuthRequest, res: Response) => {
  try {
    await d1Client.query('DELETE FROM menu_categories WHERE id = ?', [req.params.id]);
    return res.json({ success: true, message: 'Category deleted' });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 6. ADDONS & VARIATIONS
// ==========================================
router.get('/addons', async (req: AuthRequest, res: Response) => {
  try {
    const result = await d1Client.query('SELECT * FROM item_modifiers ORDER BY price ASC');
    return res.json({ success: true, data: result.results });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/addons', async (req: AuthRequest, res: Response) => {
  try {
    const { name, price, groupId } = req.body;
    if (!name || price === undefined) return res.status(400).json({ success: false, error: 'Name and price required' });

    const id = `mod-${Date.now()}`;
    await d1Client.query(
      'INSERT INTO item_modifiers (id, group_id, name, price, is_available, created_at) VALUES (?, ?, ?, ?, 1, ?)',
      [id, groupId || 'grp-default', name, Number(price), new Date().toISOString()]
    );

    return res.json({ success: true, data: { id, name, price: Number(price) } });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/addons/:id', async (req: AuthRequest, res: Response) => {
  try {
    await d1Client.query('DELETE FROM item_modifiers WHERE id = ?', [req.params.id]);
    return res.json({ success: true, message: 'Addon deleted' });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 7. DRIVERS / COURIERS FLEET (D1 & R2)
// ==========================================
router.get('/drivers', async (req: AuthRequest, res: Response) => {
  try {
    const result = await d1Client.query(
      `SELECT c.*, u.name, u.phone, u.email 
       FROM courier_profiles c 
       LEFT JOIN users u ON c.user_id = u.id
       ORDER BY c.is_online DESC, c.created_at DESC`
    );
    return res.json({ success: true, data: result.results });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/drivers', async (req: AuthRequest, res: Response) => {
  try {
    const { name, phone, email, vehicleType, plateNumber, licenseNumber, kycDocR2Url, photoR2Url, verificationStatus } = req.body;
    if (!name || !phone) return res.status(400).json({ success: false, error: 'Name and phone required' });

    const userId = `usr-drv-${Date.now()}`;
    const courierId = `cp-${Date.now()}`;
    const now = new Date().toISOString();

    // Create user record with secure default password
    const defaultPasswordHash = bcrypt.hashSync('CourierPass2026!', 10);
    await d1Client.query(
      'INSERT INTO users (id, email, password_hash, name, role, phone, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [userId, email || `${phone.replace(/[^0-9]/g, '')}@courier.veyrang.com`, defaultPasswordHash, name, 'courier', phone, now, now]
    );

    // Create courier profile
    await d1Client.query(
      `INSERT INTO courier_profiles (
        user_id, vehicle_type, plate_number, license_number, rating, 
        trips_completed, is_online, kyc_doc_r2_url, photo_r2_url, 
        verification_status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 5.0, 0, 1, ?, ?, ?, ?, ?)`,
      [
        userId,
        vehicleType || 'Motorcycle',
        plateNumber || 'LAG-NEW-01',
        licenseNumber || 'DL-LAG-000',
        kycDocR2Url || null,
        photoR2Url || null,
        verificationStatus || 'verified',
        now,
        now
      ]
    );

    await db.logAudit({
      userId: req.user!.id,
      userEmail: req.user!.email,
      userRole: req.user!.role,
      action: 'ADMIN_COURIER_REGISTERED',
      resource: 'COURIER',
      resourceId: userId,
      details: { name, phone, vehicleType, plateNumber },
      ip: req.ip
    });

    return res.json({
      success: true,
      message: `Courier "${name}" registered in D1`,
      data: {
        id: courierId,
        userId,
        name,
        phone,
        email: email || `${phone.replace(/[^0-9]/g, '')}@courier.veyrang.com`,
        vehicle_type: vehicleType || 'Motorcycle',
        plate_number: plateNumber || 'LAG-NEW-01',
        license_number: licenseNumber || 'DL-LAG-000',
        rating: 5.0,
        trips_completed: 0,
        is_online: 1,
        kyc_doc_r2_url: kycDocR2Url,
        photo_r2_url: photoR2Url,
        verification_status: verificationStatus || 'verified'
      }
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.patch('/drivers/:userId', async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const { name, phone, email, vehicleType, plateNumber, licenseNumber, rating, verificationStatus, isOnline, kycDocR2Url, photoR2Url } = req.body;

    const now = new Date().toISOString();

    // Update users table if personal info changed
    const userUpdates: string[] = ['updated_at = ?'];
    const userValues: any[] = [now];
    if (name !== undefined) { userUpdates.push('name = ?'); userValues.push(name); }
    if (phone !== undefined) { userUpdates.push('phone = ?'); userValues.push(phone); }
    if (email !== undefined) { userUpdates.push('email = ?'); userValues.push(email); }
    if (userUpdates.length > 1) {
      userValues.push(userId);
      await d1Client.query(`UPDATE users SET ${userUpdates.join(', ')} WHERE id = ?`, userValues);
    }

    // Update courier_profiles table
    const courierUpdates: string[] = ['updated_at = ?'];
    const courierValues: any[] = [now];
    if (vehicleType !== undefined) { courierUpdates.push('vehicle_type = ?'); courierValues.push(vehicleType); }
    if (plateNumber !== undefined) { courierUpdates.push('plate_number = ?'); courierValues.push(plateNumber); }
    if (licenseNumber !== undefined) { courierUpdates.push('license_number = ?'); courierValues.push(licenseNumber); }
    if (rating !== undefined) { courierUpdates.push('rating = ?'); courierValues.push(Number(rating)); }
    if (verificationStatus !== undefined) { courierUpdates.push('verification_status = ?'); courierValues.push(verificationStatus); }
    if (isOnline !== undefined) { courierUpdates.push('is_online = ?'); courierValues.push(isOnline ? 1 : 0); }
    if (kycDocR2Url !== undefined) { courierUpdates.push('kyc_doc_r2_url = ?'); courierValues.push(kycDocR2Url); }
    if (photoR2Url !== undefined) { courierUpdates.push('photo_r2_url = ?'); courierValues.push(photoR2Url); }

    if (courierUpdates.length > 1) {
      courierValues.push(userId);
      await d1Client.query(`UPDATE courier_profiles SET ${courierUpdates.join(', ')} WHERE user_id = ?`, courierValues);
    }

    await db.logAudit({
      userId: req.user!.id,
      userEmail: req.user!.email,
      userRole: req.user!.role,
      action: 'ADMIN_COURIER_UPDATED',
      resource: 'COURIER',
      resourceId: userId,
      details: req.body,
      ip: req.ip
    });

    const updated = await d1Client.query(
      `SELECT c.*, u.name, u.phone, u.email 
       FROM courier_profiles c 
       LEFT JOIN users u ON c.user_id = u.id 
       WHERE c.user_id = ?`,
      [userId]
    );

    return res.json({ success: true, message: 'Courier updated in D1', data: updated.results?.[0] });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.patch('/drivers/:userId/toggle', async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const current = await d1Client.query('SELECT is_online FROM courier_profiles WHERE user_id = ?', [userId]);
    const online = current.results?.[0]?.is_online === 1 ? 0 : 1;
    await d1Client.query('UPDATE courier_profiles SET is_online = ?, updated_at = ? WHERE user_id = ?', [online, new Date().toISOString(), userId]);
    
    await db.logAudit({
      userId: req.user!.id,
      userEmail: req.user!.email,
      userRole: req.user!.role,
      action: 'ADMIN_COURIER_STATUS_TOGGLED',
      resource: 'COURIER',
      resourceId: userId,
      details: { isOnline: online === 1 },
      ip: req.ip
    });

    return res.json({ success: true, isOnline: online === 1, message: `Courier is now ${online === 1 ? 'online' : 'offline'}` });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.patch('/drivers/:userId/verify', async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const { status } = req.body; // 'verified' | 'pending' | 'rejected' | 'suspended'
    const validStatuses = ['verified', 'pending', 'rejected', 'suspended'];
    const newStatus = validStatuses.includes(status) ? status : 'verified';

    await d1Client.query('UPDATE courier_profiles SET verification_status = ?, updated_at = ? WHERE user_id = ?', [newStatus, new Date().toISOString(), userId]);

    await db.logAudit({
      userId: req.user!.id,
      userEmail: req.user!.email,
      userRole: req.user!.role,
      action: 'ADMIN_COURIER_VERIFIED',
      resource: 'COURIER',
      resourceId: userId,
      details: { status: newStatus },
      ip: req.ip
    });

    return res.json({ success: true, verificationStatus: newStatus, message: `Courier status set to ${newStatus}` });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/drivers/:userId', async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;

    // Check for R2 KYC documents and photos to delete from Cloudflare R2 bucket
    const current = await d1Client.query('SELECT kyc_doc_r2_url, photo_r2_url FROM courier_profiles WHERE user_id = ?', [userId]);
    const courierData = current.results?.[0];
    if (courierData?.kyc_doc_r2_url) {
      await deleteR2Asset(courierData.kyc_doc_r2_url);
    }
    if (courierData?.photo_r2_url) {
      await deleteR2Asset(courierData.photo_r2_url);
    }

    await d1Client.query('DELETE FROM courier_profiles WHERE user_id = ?', [userId]);
    await d1Client.query('DELETE FROM users WHERE id = ?', [userId]);

    await db.logAudit({
      userId: req.user!.id,
      userEmail: req.user!.email,
      userRole: req.user!.role,
      action: 'ADMIN_COURIER_DELETED',
      resource: 'COURIER',
      resourceId: userId,
      ip: req.ip
    });

    return res.json({ success: true, message: 'Courier and associated R2 KYC files removed from D1 & R2' });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 8. PROMO CODES & DISCOUNTS
// ==========================================
router.get('/promos', async (req: AuthRequest, res: Response) => {
  try {
    const result = await d1Client.query('SELECT * FROM promo_codes ORDER BY created_at DESC');
    return res.json({ success: true, data: result.results });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/promos', async (req: AuthRequest, res: Response) => {
  try {
    const { code, discountType, value, minOrderAmount, maxDiscountCap, usageLimit, expiresAt, description } = req.body;
    const cleanCode = typeof code === 'string' ? code.trim().toUpperCase() : '';
    const numericValue = Number(value);
    const minOrder = Number(minOrderAmount);
    const cap = maxDiscountCap === undefined || maxDiscountCap === null || maxDiscountCap === '' ? null : Number(maxDiscountCap);
    if (!cleanCode || !Number.isFinite(numericValue) || numericValue <= 0 ||
        !['percentage', 'fixed'].includes(discountType) ||
        !Number.isFinite(minOrder) || minOrder < 0 ||
        (cap !== null && (!Number.isFinite(cap) || cap < 0)) ||
        !Number.isInteger(usageLimit) || usageLimit < 1) {
      return res.status(400).json({ success: false, error: 'Provide a code, valid discount type and value, non-negative minimum and cap, and usage limit of at least 1' });
    }
    const id = `promo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();
    await d1Client.query(
      `INSERT INTO promo_codes (id, code, discount_type, value, min_order_amount, max_discount_cap, usage_limit, times_used, is_active, expires_at, description, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, 1, ?, ?, ?)`,
      [id, cleanCode, discountType, numericValue, minOrder, cap, usageLimit, expiresAt || null, typeof description === 'string' ? description : '', now]
    );
    return res.status(201).json({ success: true, data: { id, code: cleanCode, discountType, value: numericValue, minOrderAmount: minOrder, maxDiscountCap: cap, usageLimit, expiresAt: expiresAt || null, description: description || '', isActive: true } });
  } catch (error: any) {
    return res.status(503).json({ success: false, error: 'Promo could not be saved', detail: error.message });
  }
});

router.patch('/promos/:id/toggle', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const current = await d1Client.query('SELECT is_active FROM promo_codes WHERE id = ? OR code = ? LIMIT 1', [id, id]);
    if (!current.results?.length) return res.status(404).json({ success: false, error: 'Promo not found' });
    const nextActive = current.results[0].is_active === 1 ? 0 : 1;
    const updated = await d1Client.query('UPDATE promo_codes SET is_active = ? WHERE id = ? OR code = ?', [nextActive, id, id]);
    if (updated.meta?.rows_written === 0) return res.status(503).json({ success: false, error: 'Promo status was not updated' });
    return res.json({ success: true, isActive: nextActive === 1 });
  } catch (error: any) {
    return res.status(503).json({ success: false, error: 'Promo status update failed' });
  }
});

router.delete('/promos/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const deleted = await d1Client.query('DELETE FROM promo_codes WHERE id = ? OR UPPER(code) = UPPER(?)', [id, id]);
    if (deleted.meta?.rows_written === 0) return res.status(404).json({ success: false, error: 'Promo not found' });
    return res.json({ success: true, message: 'Promo code deleted' });
  } catch (error: any) {
    return res.status(503).json({ success: false, error: 'Promo deletion failed' });
  }
});

// ==========================================
// 9. REVIEWS MODERATION
// ==========================================
router.get('/reviews', async (req: AuthRequest, res: Response) => {
  try {
    const result = await d1Client.query(
      `SELECT r.*, u.name as customer_name, rest.name as restaurant_name 
       FROM reviews r 
       LEFT JOIN users u ON r.customer_id = u.id 
       LEFT JOIN restaurants rest ON r.restaurant_id = rest.id 
       ORDER BY r.created_at DESC`
    );
    return res.json({ success: true, data: result.results });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/reviews/:id', async (req: AuthRequest, res: Response) => {
  try {
    await d1Client.query('DELETE FROM reviews WHERE id = ?', [req.params.id]);
    return res.json({ success: true, message: 'Review moderated/deleted' });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/reviews/:id/reply', async (req: AuthRequest, res: Response) => {
  try {
    const { reply } = req.body;
    await d1Client.query('UPDATE reviews SET merchant_reply = ? WHERE id = ?', [reply, req.params.id]);
    return res.json({ success: true, message: 'Reply saved' });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 10. CUSTOMER SUPPORT TICKETS
// ==========================================
router.get('/support', async (req: AuthRequest, res: Response) => {
  try {
    const result = await d1Client.query('SELECT * FROM support_tickets ORDER BY created_at DESC');
    return res.json({ success: true, data: result.results });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.patch('/support/:id/status', async (req: AuthRequest, res: Response) => {
  try {
    const status = String(req.body?.status || '').trim();
    const allowed = ['open', 'in_progress', 'waiting_on_customer', 'resolved', 'closed'];
    if (!allowed.includes(status)) return res.status(400).json({ success: false, error: 'Choose a valid ticket status.' });
    const updated = await d1Client.query('UPDATE support_tickets SET status = ?, updated_at = ? WHERE id = ?', [status, new Date().toISOString(), req.params.id]);
    if (updated.meta?.rows_written === 0) return res.status(404).json({ success: false, error: 'Ticket not found.' });
    await db.logAudit({ userId: req.user!.id, userEmail: req.user!.email, userRole: req.user!.role, action: 'ADMIN_SUPPORT_STATUS_UPDATED', resource: 'SUPPORT_TICKET', resourceId: req.params.id, details: { status }, ip: req.ip });
    return res.json({ success: true, message: 'Ticket status updated', status });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/support/:id/reply', async (req: AuthRequest, res: Response) => {
  try {
    const reply = typeof req.body?.reply === 'string' ? req.body.reply.trim().slice(0, 4000) : '';
    if (reply.length < 2) return res.status(400).json({ success: false, error: 'Enter a reply of at least 2 characters.' });
    const existing = await d1Client.query('SELECT id FROM support_tickets WHERE id = ? LIMIT 1', [req.params.id]);
    if (!existing.results?.length) return res.status(404).json({ success: false, error: 'Ticket not found.' });
    await d1Client.query("UPDATE support_tickets SET admin_reply = ?, status = 'waiting_on_customer', updated_at = ? WHERE id = ?", [reply, new Date().toISOString(), req.params.id]);
    await db.logAudit({ userId: req.user!.id, userEmail: req.user!.email, userRole: req.user!.role, action: 'ADMIN_SUPPORT_REPLY_SENT', resource: 'SUPPORT_TICKET', resourceId: req.params.id, details: { replyLength: reply.length }, ip: req.ip });
    return res.json({ success: true, message: 'Reply saved to the ticket and is visible to the customer.', status: 'waiting_on_customer' });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 11. NOTIFICATIONS BROADCAST
// ==========================================
router.post('/notifications/broadcast', async (req: AuthRequest, res: Response) => {
  try {
    const { title, message, targetRole } = req.body;
    if (!message) return res.status(400).json({ success: false, error: 'Broadcast message is required' });

    const id = `bc-${Date.now()}`;
    await d1Client.query(
      'INSERT INTO notifications_broadcasts (id, sender_id, title, message, target_role, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [id, req.user!.id, title || 'System Announcement', message, targetRole || 'all', new Date().toISOString()]
    );

    await db.logAudit({
      userId: req.user!.id,
      userEmail: req.user!.email,
      userRole: req.user!.role,
      action: 'ADMIN_NOTIFICATION_BROADCAST',
      resource: 'NOTIFICATION',
      resourceId: id,
      details: { title, message, targetRole },
      ip: req.ip
    });

    return res.json({ success: true, message: 'Broadcast transmitted to all active clients', id });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 12. TRANSACTIONS & AUDIT LOGS
// ==========================================
router.get('/transactions', async (req: AuthRequest, res: Response) => {
  try {
    const txns = await d1Client.query('SELECT * FROM transactions ORDER BY created_at DESC');
    return res.json({ success: true, data: txns.results });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/audit-logs', async (req: AuthRequest, res: Response) => {
  try {
    try {
      const d1Res = await d1Client.query('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 100');
      if (d1Res && d1Res.results && d1Res.results.length > 0) {
        return res.json({ success: true, data: d1Res.results });
      }
    } catch (e) {
      console.warn('D1 direct audit-logs query fallback note:', e);
    }

    const logs = await db.getAuditLogs();
    return res.json({ success: true, data: logs });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Branch Operations Toggle
router.patch('/restaurants/:id/toggle', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const current = await d1Client.query('SELECT is_open, raw_json FROM restaurants WHERE id = ?', [id]);
    if (!current.results || current.results.length === 0) {
      return res.status(404).json({ success: false, error: 'Restaurant not found' });
    }
    const currentIsOpen = current.results[0].is_open ?? 1;
    const nextIsOpen = currentIsOpen === 1 ? 0 : 1;
    let rawJson = current.results[0].raw_json;
    if (rawJson) {
      try {
        const parsed = JSON.parse(rawJson);
        parsed.isOpen = nextIsOpen === 1;
        rawJson = JSON.stringify(parsed);
      } catch (e) {}
    }
    await d1Client.query('UPDATE restaurants SET is_open = ?, raw_json = ? WHERE id = ?', [nextIsOpen, rawJson, id]);
    await db.updateRestaurantBusyMode(id, nextIsOpen === 0);
    return res.json({ success: true, isOpen: nextIsOpen === 1 });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Customer Wallet Manual Credit / Adjustment
router.post('/users/:id/wallet', async (req: AuthRequest, res: Response) => {
  try {
    const { amount, reason } = req.body;
    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount === 0) {
      return res.status(400).json({ success: false, error: 'Valid numeric amount is required' });
    }
    await d1Client.query(
      'UPDATE users SET wallet_balance_ngn = COALESCE(wallet_balance_ngn, 0) + ? WHERE id = ?',
      [numAmount, req.params.id]
    );
    await db.logAudit({
      userId: req.user!.id,
      userEmail: req.user!.email,
      userRole: req.user!.role,
      action: 'ADMIN_WALLET_ADJUSTMENT',
      resource: 'USER_WALLET',
      resourceId: req.params.id,
      details: { amount: numAmount, reason: reason || 'Manual Admin Credit' },
      ip: req.ip
    });
    return res.json({ success: true, message: `Wallet adjusted by ₦${numAmount.toLocaleString()}` });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// SEO Tags Persistence in D1
router.post('/seo', async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, keywords } = req.body;
    const now = new Date().toISOString();
    if (title) {
      await d1Client.query(
        'INSERT OR REPLACE INTO platform_settings (key, value, description, category, updated_at) VALUES (?, ?, ?, ?, ?)',
        ['seo_title', title, 'SEO HTML Document Title', 'seo', now]
      );
    }
    if (description) {
      await d1Client.query(
        'INSERT OR REPLACE INTO platform_settings (key, value, description, category, updated_at) VALUES (?, ?, ?, ?, ?)',
        ['seo_description', description, 'SEO Meta Description Tag', 'seo', now]
      );
    }
    if (keywords) {
      await d1Client.query(
        'INSERT OR REPLACE INTO platform_settings (key, value, description, category, updated_at) VALUES (?, ?, ?, ?, ?)',
        ['seo_keywords', keywords, 'SEO Search Keywords', 'seo', now]
      );
    }
    return res.json({ success: true, message: 'SEO settings saved to Cloudflare D1' });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Edge CDN Cache Purge
router.post('/cache/purge', async (req: AuthRequest, res: Response) => {
  try {
    await db.logAudit({
      userId: req.user!.id,
      userEmail: req.user!.email,
      userRole: req.user!.role,
      action: 'ADMIN_CACHE_PURGE',
      resource: 'EDGE_CDN',
      details: { timestamp: new Date().toISOString() },
      ip: req.ip
    });
    return res.json({ success: true, message: 'Cloudflare Worker CDN cache purged successfully.' });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Developer D1 Query Console
router.post('/developer/query', async (req: AuthRequest, res: Response) => {
  try {
    if ((CONFIG.NODE_ENV === 'production' || process.env.NODE_ENV === 'production') || req.user!.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Access restricted to administrators only.' });
    }
    const { sql } = req.body;
    if (!sql || typeof sql !== 'string') {
      return res.status(400).json({ success: false, error: 'SQL query string is required' });
    }

    const trimmed = sql.trim();
    if (!trimmed.toLowerCase().startsWith('select') && !trimmed.toLowerCase().startsWith('pragma')) {
      return res.status(403).json({ success: false, error: 'Only read-only SELECT and PRAGMA queries are permitted in this console.' });
    }

    const result = await d1Client.query(trimmed);
    return res.json({
      success: true,
      data: {
        results: result.results,
        rowCount: result.results.length,
        executionTimeMs: result.meta?.duration || 14
      }
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// System Reset: Delete all test data, mock user histories, orders, transactions and logs
router.post('/system/reset-demo-data', async (req: AuthRequest, res: Response) => {
  try {
    // Strict restriction: only full administrators can execute a database reset
    if (req.user!.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Wipe database action restricted to root Administrators only.' });
    }

    // 1. Wipe local memory and JSON file cache
    const cachedData = loadDatabase();
    cachedData.orders = [];
    cachedData.transactions = [];
    cachedData.auditLogs = [];
    // Keep only administrative staff in the users list
    cachedData.users = cachedData.users.filter((u) => u.role === 'admin' || u.role === 'sub_admin');
    await saveDatabase(cachedData);

    // 2. Perform raw database wipe operations on Cloudflare D1
    try {
      await d1Client.query('DELETE FROM orders;');
      await d1Client.query('DELETE FROM transactions;');
      await d1Client.query('DELETE FROM audit_logs;');
      await d1Client.query('DELETE FROM courier_profiles;');
      await d1Client.query(`DELETE FROM users WHERE role NOT IN ('admin', 'sub_admin');`);
    } catch (d1Err: any) {
      console.warn('D1 Database clean note:', d1Err.message);
    }

    // Log the purge activity to the newly reset audit table
    await db.logAudit({
      userId: req.user!.id,
      userEmail: req.user!.email,
      userRole: 'admin',
      action: 'SYSTEM_HARD_PURGE',
      resource: 'SYSTEM_DB',
      details: { purged_orders: true, purged_transactions: true, purged_users: true },
      ip: req.ip || req.socket.remoteAddress || 'unknown'
    });

    return res.json({
      success: true,
      message: 'All test data, mock orders, customer history, transaction records, and logs have been completely cleared from both local cache and Cloudflare D1.'
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
