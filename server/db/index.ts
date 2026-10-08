import fs from 'fs';
import path from 'path';
import os from 'os';
import bcrypt from 'bcryptjs';
import { User, Restaurant, Order, Transaction, AuditLog, OrderStatus } from './schema';
import { INITIAL_RESTAURANTS } from '../../src/data/mockData';
import { d1Client } from './d1Client';
import { CONFIG } from '../config';
interface OtpEntry {
  code: string;
  purpose: 'register' | 'forgot';
  expiresAt: number;
}
const otpStore = new Map<string, OtpEntry>();


interface DatabaseSchema {
  users: User[];
  restaurants: Restaurant[];
  orders: Order[];
  transactions: Transaction[];
  auditLogs: AuditLog[];
  systemConfig: {
    platformFeePercent: number;
    baseDeliveryFee: number;
    driverPayoutPercent: number;
    maintenanceMode: boolean;
  };
}

// In Vercel serverless environment, use writable /tmp directory
const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT);
const DATA_DIR = isServerless
  ? path.resolve(os.tmpdir(), 'veyrang_data')
  : path.resolve(process.cwd(), '.data');
const DB_FILE = path.resolve(DATA_DIR, 'veyrang_db.json');

// Memory cache with disk flush
let dbCache: DatabaseSchema | null = null;
let writeQueue = Promise.resolve();

function ensureDataDir() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch (err) {
    // Read-only filesystem fallback: memory cache will be used
  }
}

function seedInitialData(): DatabaseSchema {
  const salt = bcrypt.genSaltSync(10);
  const now = new Date().toISOString();

  const adminEmail = CONFIG.ADMIN_EMAIL;
  const adminPassword = CONFIG.ADMIN_PASSWORD;

  const users: User[] = [
    {
      id: 'usr-admin-1',
      email: adminEmail,
      passwordHash: bcrypt.hashSync(adminPassword, salt),
      name: 'System Administrator',
      role: 'admin',
      phone: '+1 (555) 900-0001',
      walletBalanceUSD: 250.0,
      walletBalanceNGN: 350000,
      savedAddresses: [],
      createdAt: now,
      updatedAt: now
    }
  ];

  // Convert initial mock restaurants into real DB records
  const restaurants: Restaurant[] = INITIAL_RESTAURANTS.map((r) => ({
    ...r,
    isBusyPaused: false,
    commissionPercent: 15,
    zone: 'NYC',
    createdAt: now
  }));

  const initialOrders: Order[] = [];
  const transactions: Transaction[] = [];

  const auditLogs: AuditLog[] = [
    {
      id: 'audit-1',
      userId: 'usr-admin-1',
      userEmail: CONFIG.ADMIN_EMAIL,
      userRole: 'admin',
      action: 'SYSTEM_INITIALIZATION',
      resource: 'SYSTEM',
      details: { environment: 'production-ready', seeded: true },
      timestamp: now
    }
  ];

  return {
    users,
    restaurants,
    orders: initialOrders,
    transactions,
    auditLogs,
    systemConfig: {
      platformFeePercent: 8,
      baseDeliveryFee: 1.99,
      driverPayoutPercent: 85,
      maintenanceMode: false
    }
  };
}

export function loadDatabase(): DatabaseSchema {
  if (dbCache) {
    // Filter out demo/test users
    dbCache.users = (dbCache.users || []).filter((u) => {
      const email = (u?.email || '').toLowerCase();
      return !['customer@veyrang.com', 'merchant@fiorella.com', 'courier@veyrang.com'].includes(email);
    });

    // Dynamic Admin Environment synchronization on every single access, even if cached in serverless memory!
    const salt = bcrypt.genSaltSync(10);
    const adminEmail = CONFIG.ADMIN_EMAIL;
    const adminPassword = CONFIG.ADMIN_PASSWORD;
    const adminUser = dbCache.users.find((u) => u.role === 'admin' || u.id === 'usr-admin-1');
    if (adminUser) {
      adminUser.email = adminEmail;
      adminUser.passwordHash = bcrypt.hashSync(adminPassword, salt);
      console.log("Database hot-sync loaded. Active Admin email is set to: " + adminEmail);
    }
    return dbCache;
  }

  try {
    ensureDataDir();
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.users)) {
        dbCache = parsed;
        
        // Filter out demo/test users
        dbCache!.users = dbCache!.users.filter((u) => {
          const email = (u?.email || '').toLowerCase();
          return !['customer@veyrang.com', 'merchant@fiorella.com', 'courier@veyrang.com'].includes(email);
        });

        dbCache!.orders = (dbCache!.orders || []).map((o: any) => {
          if (!o.handoverPin) o.handoverPin = '4821';
          if (o.discountAmount === undefined) o.discountAmount = 0;
          if (o.walletDeduction === undefined) o.walletDeduction = 0;
          if (!o.currency) o.currency = 'USD';
          if (!o.fulfillmentType) o.fulfillmentType = 'delivery';
          if (o.isContactless === undefined) o.isContactless = false;
          if (o.prepTimeAdjustmentMin === undefined) o.prepTimeAdjustmentMin = 0;
          return o;
        });
        const salt = bcrypt.genSaltSync(10);
        const defaultHash = bcrypt.hashSync('Customer123!', salt);
        dbCache!.users = (dbCache!.users || []).map((u: any) => {
          if (!u.passwordHash) u.passwordHash = defaultHash;
          if (u.walletBalanceUSD === undefined) u.walletBalanceUSD = 0;
          if (u.walletBalanceNGN === undefined) u.walletBalanceNGN = 0;
          if (!u.savedAddresses) u.savedAddresses = [];
          if (!u.email) u.email = 'user@veyrang.com';
          if (!u.name) u.name = 'Veyrang User';
          if (!u.role) u.role = 'customer';
          return u;
        });

        // Dynamic Admin Environment synchronization on every DB boot
        const adminEmail = CONFIG.ADMIN_EMAIL;
        const adminPassword = CONFIG.ADMIN_PASSWORD;
        const adminUser = dbCache!.users.find((u) => u.role === 'admin' || u.id === 'usr-admin-1');
        if (adminUser) {
          adminUser.email = adminEmail;
          adminUser.passwordHash = bcrypt.hashSync(adminPassword, salt);
          console.log("Database cold-boot loaded. Active Admin email is set to: " + adminEmail);
        }

        // Async Purge of demo accounts from live Cloudflare D1 database
        d1Client.query(
          `DELETE FROM users WHERE email IN ('customer@veyrang.com', 'merchant@fiorella.com', 'courier@veyrang.com')`
        ).catch((err) => console.warn('D1 demo user purge note:', err.message));

        return dbCache!;
      }
    }
  } catch (e) {
    console.warn('Database load fallback to seed:', e);
  }

  const seeded = seedInitialData();
  dbCache = seeded;
  try {
    saveDatabaseSync(seeded);
  } catch (err) {
    // Graceful fallback to memory
  }
  return dbCache;
}

function saveDatabaseSync(data: DatabaseSchema) {
  try {
    ensureDataDir();
    const tmpFile = `${DB_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tmpFile, DB_FILE);
  } catch (err) {
    // Running in memory mode
  }
}

export async function saveDatabase(data: DatabaseSchema): Promise<void> {
  dbCache = data;
  try {
    ensureDataDir();
    const tmpFile = `${DB_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tmpFile, DB_FILE);
  } catch (err) {
    // Memory cache remains authoritative
  }
}

function safeJsonParse<T>(val: any, fallback: T): T {
  if (!val) return fallback;
  if (typeof val !== 'string') return val as T;
  try {
    const trimmed = val.trim();
    if (!trimmed || trimmed === 'undefined' || trimmed === 'null') return fallback;
    return JSON.parse(trimmed) as T;
  } catch (e) {
    return fallback;
  }
}

// Data Access API
export const db = {
  // Users
  findUserByEmail: async (email: string): Promise<User | undefined> => {
    const data = loadDatabase();
    const normEmail = (email || '').toLowerCase().trim();
    const localUser = data.users.find((u) => (u.email || '').toLowerCase().trim() === normEmail);
    if (localUser) return localUser;

    try {
      const d1Res = await d1Client.query('SELECT * FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1', [normEmail]);
      if (d1Res && d1Res.results && d1Res.results.length > 0) {
        const u: any = d1Res.results[0];
        const userObj: User = {
          id: u.id,
          email: u.email,
          passwordHash: u.password_hash || '',
          name: u.name,
          role: u.role,
          phone: u.phone || undefined,
          address: u.address || undefined,
          restaurantId: u.restaurant_id || undefined,
          walletBalanceUSD: u.wallet_balance_usd || 0,
          walletBalanceNGN: u.wallet_balance_ngn || 0,
          savedAddresses: safeJsonParse(u.saved_addresses, []),
          createdAt: u.created_at || new Date().toISOString(),
          updatedAt: u.updated_at || new Date().toISOString()
        };
        data.users.push(userObj);
        await saveDatabase(data);
        return userObj;
      }
    } catch (e) {
      // D1 lookup fallback
    }

    return undefined;
  },

  findUserById: async (id: string): Promise<User | undefined> => {
    const data = loadDatabase();
    const localUser = data.users.find((u) => u.id === id);
    if (localUser) return localUser;

    try {
      const d1Res = await d1Client.query('SELECT * FROM users WHERE id = ? LIMIT 1', [id]);
      if (d1Res && d1Res.results && d1Res.results.length > 0) {
        const u: any = d1Res.results[0];
        const userObj: User = {
          id: u.id,
          email: u.email,
          passwordHash: u.password_hash || '',
          name: u.name,
          role: u.role,
          phone: u.phone || undefined,
          address: u.address || undefined,
          restaurantId: u.restaurant_id || undefined,
          walletBalanceUSD: u.wallet_balance_usd || 0,
          walletBalanceNGN: u.wallet_balance_ngn || 0,
          savedAddresses: safeJsonParse(u.saved_addresses, []),
          createdAt: u.created_at || new Date().toISOString(),
          updatedAt: u.updated_at || new Date().toISOString()
        };
        data.users.push(userObj);
        await saveDatabase(data);
        return userObj;
      }
    } catch (e) {
      // D1 lookup fallback
    }

    return undefined;
  },

  createUser: async (user: User): Promise<User> => {
    const data = loadDatabase();
    const existingIdx = data.users.findIndex((u) => (u.email || '').toLowerCase() === (user.email || '').toLowerCase() || u.id === user.id);
    if (existingIdx >= 0) {
      data.users[existingIdx] = user;
    } else {
      data.users.push(user);
    }
    await saveDatabase(data);

    // Replicate directly to Live Cloudflare D1 with conflict resolution
    try {
      await d1Client.query(
        `INSERT INTO users (id, email, password_hash, name, role, phone, address, restaurant_id, wallet_balance_usd, wallet_balance_ngn, saved_addresses, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           email = excluded.email,
           password_hash = excluded.password_hash,
           name = excluded.name,
           role = excluded.role,
           phone = excluded.phone,
           wallet_balance_usd = excluded.wallet_balance_usd,
           wallet_balance_ngn = excluded.wallet_balance_ngn,
           updated_at = excluded.updated_at;`,
        [
          user.id,
          user.email.toLowerCase().trim(),
          user.passwordHash,
          user.name,
          user.role,
          user.phone || null,
          user.address || null,
          user.restaurantId || null,
          user.walletBalanceUSD || 0,
          user.walletBalanceNGN || 0,
          JSON.stringify(user.savedAddresses || []),
          user.createdAt,
          user.updatedAt
        ]
      );
    } catch (err: any) {
      console.warn('D1 user sync note:', err.message);
    }

    return user;
  },

  deleteUser: async (userId: string): Promise<boolean> => {
    const data = loadDatabase();
    const initialLen = data.users.length;
    data.users = data.users.filter((u) => u.id !== userId);
    if (data.users.length !== initialLen) {
      await saveDatabase(data);
    }
    try {
      await d1Client.query('DELETE FROM users WHERE id = ?', [userId]);
    } catch (e) {}
    return true;
  },

  getAllUsers: async (): Promise<User[]> => {
    const data = loadDatabase();
    const userMap = new Map<string, User>();

    // 1. Seed from local database
    for (const u of data.users) {
      if (u && u.email) {
        userMap.set(u.email.toLowerCase().trim(), { ...u });
      }
    }

    // 2. Query and merge from live Cloudflare D1
    try {
      const d1Res = await d1Client.query('SELECT * FROM users');
      if (d1Res && d1Res.results && Array.isArray(d1Res.results)) {
        for (const u of d1Res.results) {
          const email = (u.email || '').toLowerCase().trim();
          if (!email) continue;

          const existing = userMap.get(email);
          const merged: User = {
            id: u.id || existing?.id || `usr-${Date.now()}`,
            email: u.email,
            passwordHash: u.password_hash || existing?.passwordHash || '',
            name: u.name || existing?.name || 'Staff Member',
            role: u.role || existing?.role || 'customer',
            phone: u.phone || existing?.phone || undefined,
            address: u.address || existing?.address || undefined,
            restaurantId: u.restaurant_id || existing?.restaurantId || undefined,
            walletBalanceUSD: u.wallet_balance_usd !== undefined ? u.wallet_balance_usd : (existing?.walletBalanceUSD || 0),
            walletBalanceNGN: u.wallet_balance_ngn !== undefined ? u.wallet_balance_ngn : (existing?.walletBalanceNGN || 0),
            savedAddresses: safeJsonParse(u.saved_addresses, existing?.savedAddresses || []),
            createdAt: u.created_at || existing?.createdAt || new Date().toISOString(),
            updatedAt: u.updated_at || existing?.updatedAt || new Date().toISOString()
          };
          userMap.set(email, merged);
        }
      }
    } catch (e) {
      console.warn('D1 fetch note in getAllUsers:', e);
    }

    // Update memory and disk with unified users array
    const mergedList = Array.from(userMap.values());
    data.users = mergedList;
    saveDatabaseSync(data);

    return mergedList.map(({ passwordHash, ...rest }) => rest as User);
  },

  updateUserRole: async (userId: string, role: User['role']): Promise<User | null> => {
    const data = loadDatabase();
    const now = new Date().toISOString();
    let localUser = data.users.find((u) => u.id === userId);

    try {
      // 1. Update Cloudflare D1 users table directly (by id or email)
      const d1Res = await d1Client.query('SELECT * FROM users WHERE id = ? OR LOWER(email) = LOWER(?) LIMIT 1', [userId, userId]);
      if (d1Res && d1Res.results && d1Res.results.length > 0) {
        const u = d1Res.results[0];
        await d1Client.query('UPDATE users SET role = ?, updated_at = ? WHERE id = ?', [role, now, u.id]);

        const userObj: User = {
          id: u.id,
          email: u.email,
          passwordHash: u.password_hash || '',
          name: u.name,
          role: role,
          phone: u.phone || undefined,
          address: u.address || undefined,
          restaurantId: u.restaurant_id || undefined,
          walletBalanceUSD: u.wallet_balance_usd || 0,
          walletBalanceNGN: u.wallet_balance_ngn || 0,
          savedAddresses: safeJsonParse(u.saved_addresses, []),
          createdAt: u.created_at || now,
          updatedAt: now
        };

        const existingIdx = data.users.findIndex((x) => x.id === u.id || (x.email || '').toLowerCase() === (u.email || '').toLowerCase());
        if (existingIdx >= 0) {
          data.users[existingIdx] = { ...data.users[existingIdx], role, updatedAt: now };
        } else {
          data.users.push(userObj);
        }
        await saveDatabase(data);
        return userObj;
      }
    } catch (e) {
      console.warn('D1 updateUserRole note:', e);
    }

    if (localUser) {
      localUser.role = role;
      localUser.updatedAt = now;
      await saveDatabase(data);
      try {
        await d1Client.query('UPDATE users SET role = ?, updated_at = ? WHERE id = ?', [role, now, userId]);
      } catch (e) {}
      return localUser;
    }

    return null;
  },

  updateUserPassword: async (email: string, passwordHash: string): Promise<boolean> => {
    const data = loadDatabase();
    const norm = (email || '').toLowerCase().trim();
    const user = data.users.find((u) => (u.email || '').toLowerCase().trim() === norm);
    if (user) {
      user.passwordHash = passwordHash;
      user.updatedAt = new Date().toISOString();
      await saveDatabase(data);
    }
    try {
      await d1Client.query('UPDATE users SET password_hash = ?, updated_at = ? WHERE LOWER(email) = LOWER(?)', [passwordHash, new Date().toISOString(), norm]);
    } catch (e) {}
    return true;
  },

  // Restaurants (Cloudflare D1 Single Source of Truth)
  getRestaurants: async (): Promise<Restaurant[]> => {
    try {
      const d1Res = await d1Client.query('SELECT * FROM restaurants ORDER BY rating DESC');
      if (d1Res && d1Res.results && d1Res.results.length > 0) {
        return d1Res.results.map((r: any) => {
          if (r.raw_json) {
            try {
              const obj = JSON.parse(r.raw_json);
              return {
                ...obj,
                id: r.id,
                name: r.name || obj.name,
                cuisine: r.cuisine || obj.cuisine,
                rating: r.rating ?? obj.rating,
                isOpen: r.is_open === 1,
                isBusyPaused: r.is_busy_paused === 1
              };
            } catch (e) {}
          }
          return r;
        });
      }
    } catch (e) {
      console.warn('D1 getRestaurants note:', e);
    }
    const data = loadDatabase();
    return data.restaurants;
  },

  getRestaurantById: async (id: string): Promise<Restaurant | undefined> => {
    try {
      const d1Res = await d1Client.query('SELECT * FROM restaurants WHERE id = ? LIMIT 1', [id]);
      if (d1Res && d1Res.results && d1Res.results.length > 0) {
        const r: any = d1Res.results[0];
        if (r.raw_json) {
          try {
            const obj = JSON.parse(r.raw_json);
            return {
              ...obj,
              id: r.id,
              name: r.name || obj.name,
              cuisine: r.cuisine || obj.cuisine,
              rating: r.rating ?? obj.rating,
              isOpen: r.is_open === 1,
              isBusyPaused: r.is_busy_paused === 1
            };
          } catch (e) {}
        }
        return r;
      }
    } catch (e) {
      console.warn('D1 getRestaurantById note:', e);
    }
    const data = loadDatabase();
    return data.restaurants.find((r) => r.id === id);
  },

  updateMenuItemAvailability: async (restaurantId: string, itemId: string, isAvailable: boolean): Promise<boolean> => {
    const data = loadDatabase();
    let rest = data.restaurants.find((r) => r.id === restaurantId);
    if (!rest) return false;

    let found = false;
    for (const cat of rest.categories) {
      for (const item of cat.items) {
        if (item.id === itemId) {
          item.isAvailable = isAvailable;
          found = true;
          break;
        }
      }
    }
    if (found) {
      await saveDatabase(data);
      try {
        await d1Client.query('UPDATE restaurants SET raw_json = ? WHERE id = ?', [JSON.stringify(rest), restaurantId]);
      } catch (e) {}
    }
    return found;
  },

  updateRestaurantBusyMode: async (restaurantId: string, isBusyPaused: boolean): Promise<Restaurant | null> => {
    const data = loadDatabase();
    const rest = data.restaurants.find((r) => r.id === restaurantId);
    if (!rest) return null;
    rest.isBusyPaused = isBusyPaused;
    await saveDatabase(data);
    try {
      await d1Client.query('UPDATE restaurants SET is_busy_paused = ?, raw_json = ? WHERE id = ?', [isBusyPaused ? 1 : 0, JSON.stringify(rest), restaurantId]);
    } catch (e) {}
    return rest;
  },

  // Orders (Live Cloudflare D1 Connection)
  getOrders: async (): Promise<Order[]> => {
    try {
      const ordersRes = await d1Client.query('SELECT * FROM orders ORDER BY created_at DESC');
      if (ordersRes && ordersRes.results && ordersRes.results.length > 0) {
        const d1Orders = ordersRes.results.map((o: any) => {
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
            handoverPin: parsed?.handoverPin || o.handover_pin || '4821',
            prepTimeAdjustmentMin: parsed?.prepTimeAdjustmentMin ?? 0,
            isContactless: parsed?.isContactless ?? false,
            fulfillmentType: parsed?.fulfillmentType || 'delivery',
            deliveryNotes: parsed?.deliveryNotes || '',
            routeProgress: parsed?.routeProgress ?? (o.status === 'delivered' ? 100 : 0),
            estimatedArrivalMinutes: parsed?.estimatedArrivalMinutes ?? 0,
            statusHistory: parsed?.statusHistory || [
              {
                status: o.status || 'placed',
                timestamp: o.created_at || new Date().toISOString(),
                note: 'Order recorded'
              }
            ],
            createdAt: o.created_at || parsed?.createdAt,
            updatedAt: o.updated_at || parsed?.updatedAt
          };
        });

        const data = loadDatabase();
        data.orders = d1Orders;
        saveDatabaseSync(data);

        return d1Orders;
      }
    } catch (e) {
      console.warn('D1 getOrders query note:', e);
    }
    const data = loadDatabase();
    return data.orders;
  },

  getOrderById: async (id: string): Promise<Order | undefined> => {
    try {
      const d1Res = await d1Client.query('SELECT * FROM orders WHERE id = ? OR short_id = ? LIMIT 1', [id, id]);
      if (d1Res && d1Res.results && d1Res.results.length > 0) {
        const o: any = d1Res.results[0];
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
          handoverPin: parsed?.handoverPin || o.handover_pin || '4821',
          prepTimeAdjustmentMin: parsed?.prepTimeAdjustmentMin ?? 0,
          isContactless: parsed?.isContactless ?? false,
          fulfillmentType: parsed?.fulfillmentType || 'delivery',
          deliveryNotes: parsed?.deliveryNotes || '',
          routeProgress: parsed?.routeProgress ?? (o.status === 'delivered' ? 100 : 0),
          estimatedArrivalMinutes: parsed?.estimatedArrivalMinutes ?? 0,
          statusHistory: parsed?.statusHistory || [
            {
              status: o.status || 'placed',
              timestamp: o.created_at || new Date().toISOString(),
              note: 'Order recorded'
            }
          ],
          createdAt: o.created_at || parsed?.createdAt,
          updatedAt: o.updated_at || parsed?.updatedAt
        };
      }
    } catch (e) {
      console.warn('D1 getOrderById note:', e);
    }
    const data = loadDatabase();
    return data.orders.find((o) => o.id === id || o.shortId === id);
  },

  createOrder: async (order: Order): Promise<Order> => {
    const data = loadDatabase();
    data.orders.unshift(order);
    await saveDatabase(data);

    // Replicate to Live Cloudflare D1
    try {
      await d1Client.query(
        `INSERT INTO orders (id, short_id, customer_id, customer_name, customer_phone, customer_address, restaurant_id, restaurant_name, items, total, currency, payment_method, payment_status, status, raw_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           status = excluded.status,
           raw_json = excluded.raw_json,
           updated_at = excluded.updated_at;`,
        [
          order.id,
          order.shortId,
          order.customerId || null,
          order.customerName,
          order.customerPhone,
          order.customerAddress,
          order.restaurantId,
          order.restaurantName,
          JSON.stringify(order.items),
          order.total,
          order.currency || 'NGN',
          order.paymentMethod,
          order.paymentStatus || 'paid',
          order.status,
          JSON.stringify(order),
          order.createdAt,
          order.updatedAt
        ]
      );
    } catch (err: any) {
      console.warn('D1 order sync note:', err.message);
    }

    return order;
  },

  updateOrderStatus: async (orderId: string, status: OrderStatus, note?: string): Promise<Order | null> => {
    const data = loadDatabase();
    const order = data.orders.find((o) => o.id === orderId);
    if (!order) return null;

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    order.status = status;
    order.updatedAt = new Date().toISOString();

    if (status === 'in_transit' && order.routeProgress === 0) {
      order.routeProgress = 20;
    } else if (status === 'delivered') {
      order.routeProgress = 100;
      order.estimatedArrivalMinutes = 0;
    }

    order.statusHistory.push({
      status,
      timestamp: timeStr,
      note: note || `Status updated to ${status}`
    });

    await saveDatabase(data);

    try {
      await d1Client.query(
        'UPDATE orders SET status = ?, raw_json = ?, updated_at = ? WHERE id = ?',
        [status, JSON.stringify(order), order.updatedAt, orderId]
      );
    } catch (e) {}

    return order;
  },

  updateOrderGPS: async (orderId: string, progress: number): Promise<Order | null> => {
    const data = loadDatabase();
    const order = data.orders.find((o) => o.id === orderId);
    if (!order) return null;

    const clamped = Math.max(0, Math.min(100, progress));
    order.routeProgress = clamped;
    order.estimatedArrivalMinutes = Math.max(0, Math.round(((100 - clamped) / 100) * 14));
    order.updatedAt = new Date().toISOString();

    if (clamped >= 100 && order.status === 'in_transit') {
      order.status = 'delivered';
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      order.statusHistory.push({
        status: 'delivered',
        timestamp: timeStr,
        note: 'Courier arrived at doorstep and completed delivery'
      });
    }

    await saveDatabase(data);

    try {
      await d1Client.query(
        'UPDATE orders SET status = ?, raw_json = ?, updated_at = ? WHERE id = ?',
        [order.status, JSON.stringify(order), order.updatedAt, orderId]
      );
    } catch (e) {}

    return order;
  },

  adjustOrderPrepTime: async (orderId: string, adjustmentMinutes: number): Promise<Order | null> => {
    const data = loadDatabase();
    const order = data.orders.find((o) => o.id === orderId);
    if (!order) return null;

    order.prepTimeAdjustmentMin = (order.prepTimeAdjustmentMin || 0) + adjustmentMinutes;
    order.estimatedArrivalMinutes = Math.max(1, order.estimatedArrivalMinutes + adjustmentMinutes);
    order.statusHistory.push({
      status: order.status,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      note: `Kitchen adjusted prep time by +${adjustmentMinutes} min`
    });
    order.updatedAt = new Date().toISOString();
    await saveDatabase(data);
    return order;
  },

  refundOrder: async (orderId: string, amount: number, reason: string): Promise<Order | null> => {
    const data = loadDatabase();
    const order = data.orders.find((o) => o.id === orderId);
    if (!order) return null;

    order.paymentStatus = 'refunded';
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    order.statusHistory.push({
      status: order.status,
      timestamp: timeStr,
      note: `Refund of $${amount.toFixed(2)} processed. Reason: ${reason}`
    });
    order.updatedAt = new Date().toISOString();
    await saveDatabase(data);
    return order;
  },

  addChatMessage: async (orderId: string, sender: 'customer' | 'courier' | 'system', senderName: string, text: string) => {
    const data = loadDatabase();
    const order = data.orders.find((o) => o.id === orderId);
    if (!order) return null;

    const newMsg = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      sender,
      senderName,
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    order.messages.push(newMsg);
    order.updatedAt = new Date().toISOString();
    await saveDatabase(data);

    try {
      await d1Client.query(
        'UPDATE orders SET raw_json = ?, updated_at = ? WHERE id = ?',
        [JSON.stringify(order), order.updatedAt, orderId]
      );
      await d1Client.query(
        'INSERT INTO order_chats (id, order_id, sender_id, sender_role, message, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [newMsg.id, orderId, sender, sender, text, new Date().toISOString()]
      ).catch(() => {});
    } catch (e) {}

    return newMsg;
  },

  // Transactions & Webhooks
  createTransaction: async (tx: Transaction): Promise<Transaction> => {
    const data = loadDatabase();
    data.transactions.unshift(tx);
    await saveDatabase(data);

    // Replicate to Live Cloudflare D1
    d1Client.query(
      `INSERT INTO transactions (id, order_id, reference, amount, currency, status, payment_method, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         status = excluded.status;`,
      [
        tx.id,
        tx.orderId,
        tx.reference,
        tx.amount,
        tx.currency,
        tx.status,
        tx.paymentMethod,
        tx.createdAt
      ]
    ).catch((err) => console.warn('D1 tx sync note:', err.message));

    return tx;
  },

  getTransactionByIdempotencyKey: async (key: string): Promise<Transaction | undefined> => {
    const data = loadDatabase();
    return data.transactions.find((t) => t.idempotencyKey === key);
  },

  getAllTransactions: async (): Promise<Transaction[]> => {
    const data = loadDatabase();
    return data.transactions;
  },

  // Audit Logs
  logAudit: async (entry: Omit<AuditLog, 'id' | 'timestamp'>): Promise<AuditLog> => {
    const data = loadDatabase();
    const log: AuditLog = {
      ...entry,
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString()
    };
    data.auditLogs.unshift(log);
    // Keep max 500 audit logs
    if (data.auditLogs.length > 500) {
      data.auditLogs = data.auditLogs.slice(0, 500);
    }
    await saveDatabase(data);

    // Replicate to Live Cloudflare D1
    d1Client.query(
      `INSERT INTO audit_logs (id, user_id, user_email, user_role, action, resource, resource_id, ip, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        log.id,
        log.userId,
        log.userEmail,
        log.userRole,
        log.action,
        log.resource,
        log.resourceId || null,
        log.ip || null,
        log.timestamp
      ]
    ).catch((err) => console.warn('D1 audit sync note:', err.message));

    return log;
  },

  getAuditLogs: async (): Promise<AuditLog[]> => {
    const data = loadDatabase();
    return data.auditLogs;
  },

  // Platform Analytics
  getAnalytics: async () => {
    const data = loadDatabase();
    const totalVolume = data.orders.reduce((sum, o) => sum + o.total, 0);
    const platformRevenue = data.orders.reduce((sum, o) => sum + o.serviceFee, 0);
    const deliveredCount = data.orders.filter((o) => o.status === 'delivered').length;
    const activeCount = data.orders.filter((o) => o.status !== 'delivered' && o.status !== 'cancelled').length;

    return {
      totalOrders: data.orders.length,
      deliveredOrders: deliveredCount,
      activeOrders: activeCount,
      grossMerchandiseVolume: Math.round(totalVolume * 100) / 100,
      platformNetRevenue: Math.round(platformRevenue * 100) / 100,
      activeRestaurantsCount: data.restaurants.length,
      registeredUsersCount: data.users.length,
      activeCouriersCount: data.users.filter((u) => u.role === 'courier').length
    };
  },

  saveOtp: async (email: string, code: string, purpose: 'register' | 'forgot'): Promise<void> => {
    otpStore.set(email.toLowerCase(), {
      code,
      purpose,
      expiresAt: Date.now() + 10 * 60 * 1000 // 10 minutes expiry
    });
  },

  verifyOtp: async (email: string, code: string, purpose: 'register' | 'forgot'): Promise<boolean> => {
    const entry = otpStore.get(email.toLowerCase());
    if (!entry) return false;
    if (entry.purpose !== purpose) return false;
    if (Date.now() > entry.expiresAt) {
      otpStore.delete(email.toLowerCase());
      return false;
    }
    const isMatch = entry.code === code;
    if (isMatch) {
      otpStore.delete(email.toLowerCase()); // single-use OTP
    }
    return isMatch;
  }
};
