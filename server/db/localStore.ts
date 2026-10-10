import fs from 'fs';
import path from 'path';
import os from 'os';
import bcrypt from 'bcryptjs';
import { User, Restaurant, Order, Transaction, AuditLog } from './schema';
import { CONFIG } from '../config';
import { siteDataManager } from '../../lib/siteDataSnapshot';

export interface PromoCodeRecord {
  id: string;
  code: string;
  discount_type: string;
  value: number;
  min_order_amount: number;
  max_discount_cap?: number;
  usage_limit: number;
  times_used: number;
  is_active: number;
  expires_at?: string;
  description: string;
  created_at: string;
}

export interface DeliveryZoneRecord {
  id: string;
  name: string;
  code: string;
  base_fee: number;
  is_active: number;
  created_at: string;
}

export interface DatabaseSchema {
  users: User[];
  restaurants: Restaurant[];
  orders: Order[];
  transactions: Transaction[];
  auditLogs: AuditLog[];
  promoCodes: PromoCodeRecord[];
  deliveryZones: DeliveryZoneRecord[];
  platformSettings: Record<string, string>;
  systemConfig: {
    platformFeePercent: number;
    baseDeliveryFee: number;
    driverPayoutPercent: number;
    maintenanceMode: boolean;
  };
}

const isServerless = Boolean(
  process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT
);
const DATA_DIR = isServerless
  ? path.resolve(os.tmpdir(), 'veyrang_data')
  : path.resolve(process.cwd(), '.data');
const DB_FILE = path.resolve(DATA_DIR, 'veyrang_db.json');

let dbCache: DatabaseSchema | null = null;

function ensureDataDir() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch {
    // Read-only filesystem fallback: memory cache will be used
  }
}

export function seedInitialData(): DatabaseSchema {
  const salt = bcrypt.genSaltSync(10);
  const now = new Date().toISOString();

  const adminEmail = (CONFIG.ADMIN_EMAIL || process.env.ADMIN_EMAIL || 'admin@veyrang.com').toLowerCase().trim();
  const adminPassword = CONFIG.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || 'Admin123!';

  const users: User[] = [
    {
      id: 'usr-admin-1',
      email: adminEmail,
      passwordHash: bcrypt.hashSync(adminPassword, salt),
      name: 'System Administrator',
      role: 'admin',
      phone: '+234 801 234 5678',
      walletBalanceUSD: 250.0,
      walletBalanceNGN: 350000,
      savedAddresses: [
        {
          id: 'addr-admin-1',
          label: 'Work',
          address: 'Admiralty Way, Lekki Phase 1',
          city: 'Lagos',
          isDefault: true
        }
      ],
      createdAt: now,
      updatedAt: now
    }
  ];

  // Preserves verified restaurants without injecting demo seed data
  const restaurants: Restaurant[] = [];

  const promoCodes: PromoCodeRecord[] = [
    {
      id: 'promo-1',
      code: 'VEYRA10',
      discount_type: 'percent',
      value: 10,
      min_order_amount: 3000,
      max_discount_cap: 2000,
      usage_limit: 1000,
      times_used: 12,
      is_active: 1,
      description: '10% off entire order for all dishes',
      created_at: now
    },
    {
      id: 'promo-2',
      code: 'FREESHIP',
      discount_type: 'fixed',
      value: 800,
      min_order_amount: 5000,
      max_discount_cap: 800,
      usage_limit: 500,
      times_used: 28,
      is_active: 1,
      description: 'Free doorstep delivery on orders above ₦5,000',
      created_at: now
    },
    {
      id: 'promo-3',
      code: 'FIRST50',
      discount_type: 'percent',
      value: 50,
      min_order_amount: 4000,
      max_discount_cap: 2500,
      usage_limit: 1000,
      times_used: 41,
      is_active: 1,
      description: '50% off on your first order up to ₦2,500',
      created_at: now
    },
    {
      id: 'promo-4',
      code: 'WELCOME20',
      discount_type: 'percent',
      value: 20,
      min_order_amount: 3500,
      max_discount_cap: 1500,
      usage_limit: 1000,
      times_used: 19,
      is_active: 1,
      description: '20% welcome discount for new food lovers',
      created_at: now
    }
  ];

  const deliveryZones: DeliveryZoneRecord[] = [
    { id: 'zone-1', name: 'Lekki Phase 1', code: 'LEKKI', base_fee: 800, is_active: 1, created_at: now },
    { id: 'zone-2', name: 'Victoria Island', code: 'VI', base_fee: 1000, is_active: 1, created_at: now },
    { id: 'zone-3', name: 'Ikoyi', code: 'IKOYI', base_fee: 900, is_active: 1, created_at: now },
    { id: 'zone-4', name: 'Ikeja GRA', code: 'IKEJA', base_fee: 1200, is_active: 1, created_at: now },
    { id: 'zone-5', name: 'Maitama, Abuja', code: 'MAITAMA', base_fee: 1000, is_active: 1, created_at: now }
  ];

  const platformSettings: Record<string, string> = {
    currency_ngn_usd_rate: '1400',
    platform_commission_percent: '15',
    base_service_fee_ngn: '500',
    base_service_fee_usd: '1.99',
    minimum_order_ngn: '2500',
    minimum_order_usd: '10.00'
  };

  const auditLogs: AuditLog[] = [
    {
      id: 'audit-1',
      userId: 'usr-admin-1',
      userEmail: adminEmail,
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
    orders: [],
    transactions: [],
    auditLogs,
    promoCodes,
    deliveryZones,
    platformSettings,
    systemConfig: {
      platformFeePercent: 8,
      baseDeliveryFee: 800,
      driverPayoutPercent: 85,
      maintenanceMode: false
    }
  };
}

export function loadDatabase(): DatabaseSchema {
  if (dbCache) {
    return dbCache;
  }

  try {
    ensureDataDir();
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.restaurants) && parsed.restaurants.length > 0) {
        dbCache = {
          ...seedInitialData(),
          ...parsed
        };
        // Ensure admin users from environment secrets exist with valid password hashes and admin role
        const initialUsers = seedInitialData().users;
        if (!Array.isArray(dbCache!.users)) {
          dbCache!.users = initialUsers;
        } else {
          for (const initU of initialUsers) {
            const idx = dbCache!.users.findIndex(
              (u) => (u.email && u.email.toLowerCase() === initU.email.toLowerCase()) || u.id === initU.id
            );
            if (idx >= 0) {
              dbCache!.users[idx].role = 'admin';
              dbCache!.users[idx].passwordHash = initU.passwordHash;
            } else {
              dbCache!.users.push(initU);
            }
          }
        }
        // Ensure sub-arrays exist
        if (!Array.isArray(dbCache!.restaurants) || dbCache!.restaurants.length === 0) {
          dbCache!.restaurants = seedInitialData().restaurants;
        }
        if (!Array.isArray(dbCache!.promoCodes) || dbCache!.promoCodes.length === 0) {
          dbCache!.promoCodes = seedInitialData().promoCodes;
        }
        if (!Array.isArray(dbCache!.deliveryZones) || dbCache!.deliveryZones.length === 0) {
          dbCache!.deliveryZones = seedInitialData().deliveryZones;
        }
        if (!dbCache!.platformSettings) {
          dbCache!.platformSettings = seedInitialData().platformSettings;
        }
        return dbCache!;
      }
    }
  } catch (e) {
    console.warn('Database load fallback to seed:', e);
  }

  const seeded = seedInitialData();
  dbCache = seeded;
  try {
    ensureDataDir();
    fs.writeFileSync(DB_FILE, JSON.stringify(seeded, null, 2), 'utf-8');
  } catch {
    // Memory mode fallback
  }
  return dbCache;
}

export function saveDatabaseSync(data: DatabaseSchema) {
  dbCache = data;
  try {
    ensureDataDir();
    const tmpFile = `${DB_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tmpFile, DB_FILE);
  } catch {
    // Memory cache remains authoritative
  }
}

export async function saveDatabase(data: DatabaseSchema): Promise<void> {
  saveDatabaseSync(data);
}

function restaurantToRow(r: Restaurant): any {
  return {
    id: r.id,
    name: r.name,
    cuisine: r.cuisine,
    rating: r.rating,
    review_count: r.reviewCount || 0,
    delivery_time_min: r.deliveryTimeMin || 25,
    delivery_time_max: r.deliveryTimeMax || 40,
    delivery_fee: r.deliveryFee ?? 800,
    min_order: r.minOrder ?? 2500,
    address: r.address || '',
    city: (r as any).city || 'Lagos',
    zone: r.zone || 'LEKKI',
    is_open: r.isOpen ? 1 : 0,
    is_busy_paused: r.isBusyPaused ? 1 : 0,
    tags: JSON.stringify(r.tags || []),
    raw_json: JSON.stringify(r)
  };
}

function orderToRow(o: Order): any {
  return {
    id: o.id,
    short_id: o.shortId || o.id.slice(-6),
    customer_id: o.customerId,
    customer_name: o.customerName,
    customer_phone: o.customerPhone,
    customer_address: o.customerAddress,
    restaurant_id: o.restaurantId,
    restaurant_name: o.restaurantName,
    items: typeof o.items === 'string' ? o.items : JSON.stringify(o.items || []),
    total: o.total,
    currency: o.currency || 'NGN',
    payment_method: o.paymentMethod || 'card',
    payment_status: o.paymentStatus || 'paid',
    status: o.status,
    raw_json: JSON.stringify(o),
    created_at: o.createdAt || new Date().toISOString(),
    updated_at: o.updatedAt || new Date().toISOString()
  };
}

function userToRow(u: User): any {
  return {
    id: u.id,
    email: u.email,
    password_hash: u.passwordHash,
    name: u.name,
    role: u.role || 'customer',
    phone: u.phone || '',
    address: u.address || '',
    wallet_balance_ngn: u.walletBalanceNGN || 0,
    wallet_balance_usd: u.walletBalanceUSD || 0,
    saved_addresses: typeof u.savedAddresses === 'string' ? u.savedAddresses : JSON.stringify(u.savedAddresses || []),
    created_at: u.createdAt || new Date().toISOString(),
    updated_at: u.updatedAt || new Date().toISOString()
  };
}

/**
 * Executes a SQL-like statement against the persistent local database.
 * Provides identical shape to Cloudflare D1 query results.
 */
export async function localD1Query<T = any>(
  sql: string,
  params: any[] = []
): Promise<{ results: T[]; success: boolean; meta?: any }> {
  const db = loadDatabase();
  const trimmed = sql.trim();
  const upper = trimmed.toUpperCase();

  // Ping / health
  if (upper.startsWith('SELECT 1')) {
    return { results: [{ alive: 1, live_status: 1 } as any], success: true };
  }

  // DDL statements are no-ops on local JSON store
  if (
    upper.startsWith('CREATE TABLE') ||
    upper.startsWith('ALTER TABLE') ||
    upper.startsWith('CREATE INDEX') ||
    upper.startsWith('PRAGMA')
  ) {
    return { results: [], success: true };
  }

  // platform_settings
  if (upper.includes('FROM PLATFORM_SETTINGS')) {
    const list = Object.entries(db.platformSettings || {}).map(([key, value]) => ({ key, value }));
    return { results: list as any, success: true };
  }

  // delivery_zones
  if (upper.includes('FROM DELIVERY_ZONES')) {
    return { results: (db.deliveryZones || []) as any, success: true };
  }

  // promo_codes
  if (upper.includes('PROMO_CODES')) {
    if (upper.startsWith('SELECT')) {
      if (upper.includes('WHERE CODE =') || upper.includes('WHERE LOWER(CODE) =')) {
        const targetCode = String(params[0] || '').toLowerCase().trim();
        const promo = (db.promoCodes || []).find((p) => p.code.toLowerCase().trim() === targetCode);
        return { results: promo ? ([promo] as any) : [], success: true };
      }
      if (upper.includes('WHERE ID =')) {
        const targetId = String(params[0] || '');
        const promo = (db.promoCodes || []).find((p) => p.id === targetId);
        return { results: promo ? ([promo] as any) : [], success: true };
      }
      return { results: (db.promoCodes || []) as any, success: true };
    }
    if (upper.startsWith('UPDATE')) {
      if (upper.includes('TIMES_USED = TIMES_USED + 1') && upper.includes('WHERE ID =')) {
        const targetId = String(params[params.length - 1] || '');
        const p = (db.promoCodes || []).find((x) => x.id === targetId);
        if (p) p.times_used = (p.times_used || 0) + 1;
        saveDatabaseSync(db);
        return { results: [], success: true };
      }
      if (upper.includes('IS_ACTIVE = ?') && upper.includes('WHERE ID =')) {
        const active = Number(params[0]) || 0;
        const targetId = String(params[1] || '');
        const p = (db.promoCodes || []).find((x) => x.id === targetId);
        if (p) p.is_active = active;
        saveDatabaseSync(db);
        return { results: [], success: true };
      }
      return { results: [], success: true };
    }
    if (upper.startsWith('INSERT INTO PROMO_CODES')) {
      const newPromo: PromoCodeRecord = {
        id: params[0] || `promo-${Date.now()}`,
        code: params[1],
        discount_type: params[2],
        value: Number(params[3]),
        min_order_amount: Number(params[4] || 0),
        max_discount_cap: params[5] ? Number(params[5]) : undefined,
        usage_limit: Number(params[6] || 1000),
        times_used: Number(params[7] || 0),
        is_active: params[8] === undefined ? 1 : Number(params[8]),
        expires_at: params[9] || undefined,
        description: params[10] || '',
        created_at: params[11] || new Date().toISOString()
      };
      db.promoCodes = db.promoCodes || [];
      db.promoCodes.unshift(newPromo);
      saveDatabaseSync(db);
      return { results: [newPromo as any], success: true };
    }
    if (upper.startsWith('DELETE FROM PROMO_CODES')) {
      const targetId = String(params[0] || '');
      db.promoCodes = (db.promoCodes || []).filter((p) => p.id !== targetId);
      saveDatabaseSync(db);
      return { results: [], success: true };
    }
  }

  // restaurants
  if (upper.includes('FROM RESTAURANTS') || upper.startsWith('UPDATE RESTAURANTS')) {
    if (upper.startsWith('SELECT')) {
      if (upper.includes('WHERE ID =')) {
        const targetId = String(params[0] || '');
        const found = db.restaurants.find((r) => r.id === targetId);
        return { results: found ? ([restaurantToRow(found)] as any) : [], success: true };
      }
      // List all
      const rows = db.restaurants.map(restaurantToRow);
      return { results: rows as any, success: true };
    }
    if (upper.startsWith('UPDATE RESTAURANTS')) {
      const targetId = String(params[params.length - 1] || '');
      const idx = db.restaurants.findIndex((r) => r.id === targetId);
      if (idx !== -1 && params[0] !== undefined) {
        if (typeof params[0] === 'number') {
          // e.g. UPDATE restaurants SET is_open = ? WHERE id = ?
          db.restaurants[idx].isOpen = Boolean(params[0]);
        }
        saveDatabaseSync(db);
      }
      return { results: [], success: true };
    }
  }

  // orders
  if (upper.includes('FROM ORDERS') || upper.startsWith('INSERT INTO ORDERS') || upper.startsWith('UPDATE ORDERS')) {
    if (upper.startsWith('SELECT')) {
      if (upper.includes('COUNT(*)') && upper.includes('SUM(TOTAL)')) {
        const total = db.orders.reduce((acc, o) => acc + (Number(o.total) || 0), 0);
        return { results: [{ c: db.orders.length, gmv: total } as any], success: true };
      }
      if (upper.includes('COUNT(*)')) {
        return { results: [{ c: db.orders.length } as any], success: true };
      }
      if (upper.includes('WHERE ID =')) {
        const targetId = String(params[0] || '');
        const found = db.orders.find((o) => o.id === targetId);
        return { results: found ? ([orderToRow(found)] as any) : [], success: true };
      }
      if (upper.includes('WHERE CUSTOMER_ID =')) {
        const custId = String(params[0] || '');
        const list = db.orders.filter((o) => o.customerId === custId).map(orderToRow);
        return { results: list as any, success: true };
      }
      // List all orders
      const list = db.orders.map(orderToRow);
      return { results: list as any, success: true };
    }

    if (upper.startsWith('INSERT INTO ORDERS')) {
      try {
        const orderId = params[0] || `ord-${Date.now()}`;
        const rawJsonIdx = params.findIndex((p) => typeof p === 'string' && p.startsWith('{') && p.includes('"items"'));
        let parsedOrder: any = null;
        if (rawJsonIdx !== -1) {
          try {
            parsedOrder = JSON.parse(params[rawJsonIdx]);
          } catch {}
        }
        const newOrder: Order = parsedOrder || {
          id: orderId,
          shortId: params[1] || orderId.slice(-6),
          customerId: params[2],
          customerName: params[3],
          customerPhone: params[4],
          customerAddress: params[5],
          restaurantId: params[6],
          restaurantName: params[7],
          items: typeof params[8] === 'string' ? JSON.parse(params[8]) : params[8] || [],
          total: Number(params[9] || 0),
          currency: params[10] || 'NGN',
          paymentMethod: params[11] || 'card',
          paymentStatus: params[12] || 'paid',
          status: params[13] || 'placed',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          subtotal: Number(params[9] || 0),
          deliveryFee: 800,
          serviceFee: 500,
          tip: 0
        };
        db.orders.unshift(newOrder);
        saveDatabaseSync(db);
        return { results: [orderToRow(newOrder) as any], success: true };
      } catch (err: any) {
        console.error('Local order insert error:', err);
        return { results: [], success: false };
      }
    }

    if (upper.startsWith('UPDATE ORDERS')) {
      const targetId = String(params[params.length - 1] || '');
      const idx = db.orders.findIndex((o) => o.id === targetId);
      if (idx !== -1) {
        if (upper.includes("PAYMENT_STATUS = 'PAID'")) {
          db.orders[idx].paymentStatus = 'paid';
          db.orders[idx].status = 'placed';
        } else if (upper.includes('STATUS = ?')) {
          db.orders[idx].status = params[0];
          if (params[2] && typeof params[2] === 'string' && params[2].startsWith('{')) {
            try {
              const fullObj = JSON.parse(params[2]);
              db.orders[idx] = { ...db.orders[idx], ...fullObj };
            } catch {}
          }
        }
        db.orders[idx].updatedAt = new Date().toISOString();
        saveDatabaseSync(db);
        return { results: [orderToRow(db.orders[idx]) as any], success: true };
      }
      return { results: [], success: true };
    }
  }

  // users
  if (upper.includes('FROM USERS') || upper.startsWith('INSERT INTO USERS') || upper.startsWith('UPDATE USERS')) {
    if (upper.startsWith('SELECT')) {
      if (upper.includes('COUNT(*)')) {
        return { results: [{ c: db.users.length } as any], success: true };
      }
      if (upper.includes('WHERE ID =')) {
        const targetId = String(params[0] || '');
        const found = db.users.find((u) => u.id === targetId);
        return { results: found ? ([userToRow(found)] as any) : [], success: true };
      }
      if (upper.includes('EMAIL) =') || upper.includes('WHERE EMAIL =')) {
        const targetEmail = String(params[0] || '').toLowerCase().trim();
        const found = db.users.find((u) => (u.email || '').toLowerCase().trim() === targetEmail);
        return { results: found ? ([userToRow(found)] as any) : [], success: true };
      }
      // List all users
      const list = db.users.map(userToRow);
      return { results: list as any, success: true };
    }

    if (upper.startsWith('INSERT INTO USERS')) {
      const newUser: User = {
        id: params[0] || `usr-${Date.now()}`,
        email: (params[1] || '').toLowerCase().trim(),
        passwordHash: params[2],
        name: params[3],
        role: params[4] || 'customer',
        phone: params[5] || '',
        walletBalanceUSD: Number(params[6] || 0),
        walletBalanceNGN: Number(params[7] || 0),
        savedAddresses: params[8] ? (typeof params[8] === 'string' ? JSON.parse(params[8]) : params[8]) : [],
        createdAt: params[9] || new Date().toISOString(),
        updatedAt: params[10] || new Date().toISOString()
      };
      db.users.push(newUser);
      saveDatabaseSync(db);
      return { results: [userToRow(newUser) as any], success: true };
    }

    if (upper.startsWith('UPDATE USERS')) {
      const targetId = String(params[params.length - 1] || '');
      const idx = db.users.findIndex((u) => u.id === targetId);
      if (idx !== -1) {
        if (upper.includes('SET ROLE =')) {
          db.users[idx].role = params[0];
        }
        db.users[idx].updatedAt = new Date().toISOString();
        saveDatabaseSync(db);
        return { results: [userToRow(db.users[idx]) as any], success: true };
      }
      return { results: [], success: true };
    }
  }

  // transactions / wallet_transactions
  if (upper.includes('TRANSACTIONS')) {
    if (upper.startsWith('SELECT')) {
      if (upper.includes('WHERE REFERENCE =')) {
        const ref = String(params[0] || '');
        const found = db.transactions.find((t) => t.id === ref || (t as any).reference === ref);
        return { results: found ? ([found] as any) : [], success: true };
      }
      if (upper.includes('WHERE USER_ID =')) {
        const uId = String(params[0] || '');
        const list = db.transactions.filter((t: any) => t.userId === uId || t.user_id === uId);
        return { results: list as any, success: true };
      }
      return { results: (db.transactions || []) as any, success: true };
    }
    if (upper.startsWith('INSERT INTO TRANSACTIONS')) {
      const tx: any = {
        id: params[0] || `tx-${Date.now()}`,
        order_id: params[1],
        reference: params[2] || params[0],
        amount: Number(params[3] || 0),
        currency: params[4] || 'NGN',
        status: params[5] || 'pending',
        payment_method: params[6] || 'card',
        created_at: params[7] || new Date().toISOString()
      };
      db.transactions = db.transactions || [];
      db.transactions.unshift(tx);
      saveDatabaseSync(db);
      return { results: [tx as any], success: true };
    }
    if (upper.startsWith('UPDATE TRANSACTIONS')) {
      const ref = String(params[params.length - 1] || params[0] || '');
      const t = db.transactions.find((x) => x.id === ref || (x as any).reference === ref);
      if (t) {
        t.status = 'completed';
        saveDatabaseSync(db);
      }
      return { results: [], success: true };
    }
  }

  // Fallback for unhandled queries
  return { results: [], success: true };
}
