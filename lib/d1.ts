import fs from 'fs';
import path from 'path';
import os from 'os';
import { DatabaseSync } from 'node:sqlite';
import bcrypt from 'bcryptjs';
import { CONFIG } from '../server/config';
import { siteDataManager } from './siteDataSnapshot';

export interface D1QueryResult<T = any> {
  results: T[];
  success: boolean;
  meta?: {
    duration?: number;
    rows_read?: number;
    rows_written?: number;
    changes?: number;
    last_row_id?: number;
  };
}

export interface D1ApiResponse<T = any> {
  result: D1QueryResult<T>[] | null;
  success: boolean;
  errors: Array<{ code: number; message: string }>;
  messages: Array<{ code?: number; message?: string }>;
}

interface CacheItem {
  timestamp: number;
  data: D1QueryResult<any>;
}

export class D1Client {
  private accountId: string;
  private databaseId: string;
  private apiToken: string;
  private authEmail: string;
  private workerUrl: string;
  private isSchemaInitialized: boolean = false;
  private queryCache: Map<string, CacheItem> = new Map();
  private cacheTtlMs: number = 10000;
  private localDbInstance: any = null;

  constructor() {
    this.accountId = process.env.CLOUDFLARE_ACCOUNT_ID || CONFIG.CLOUDFLARE_ACCOUNT_ID || '';
    this.databaseId = process.env.CLOUDFLARE_DATABASE_ID || CONFIG.CLOUDFLARE_DATABASE_ID || '';
    this.apiToken = process.env.CLOUDFLARE_API_TOKEN || CONFIG.CLOUDFLARE_API_TOKEN || '';
    this.authEmail =
      process.env.CLOUDFLARE_AUTH_EMAIL ||
      CONFIG.CLOUDFLARE_AUTH_EMAIL ||
      process.env.ADMIN_EMAIL ||
      CONFIG.ADMIN_EMAIL ||
      'abideentaoreed12@gmail.com';
    this.workerUrl = (process.env.CLOUDFLARE_WORKER_URL || CONFIG.CLOUDFLARE_WORKER_URL || '').replace(/\/$/, '');
  }

  public isConfigured(): boolean {
    const hasAccount = Boolean(this.accountId && !this.accountId.includes('veyrang_account'));
    const hasDb = Boolean(this.databaseId && !this.databaseId.includes('veyrang_db'));
    const hasToken = Boolean(this.apiToken && !this.apiToken.includes('veyrang_token') && this.apiToken.length > 20);
    return hasAccount && hasDb && hasToken;
  }

  public getDetails() {
    return {
      accountId: this.accountId,
      databaseId: this.databaseId,
      databaseName: process.env.CLOUDFLARE_DATABASE_NAME || 'veyrang_production',
      workerUrl: this.workerUrl,
      isConfigured: this.isConfigured(),
      engine: this.isConfigured() ? 'Cloudflare D1 Edge' : 'SQLite Local Embedded Engine'
    };
  }

  public clearCache(): void {
    this.queryCache.clear();
  }

  private getLocalSqlite(): any {
    if (this.localDbInstance) return this.localDbInstance;
    try {
      const dbPath = path.resolve(os.tmpdir(), 'veyrang_d1.sqlite');
      this.localDbInstance = new DatabaseSync(dbPath);
    } catch {
      try {
        this.localDbInstance = new DatabaseSync(':memory:');
      } catch (err: any) {
        console.error('DatabaseSync initialization error:', err?.message);
        this.localDbInstance = null;
      }
    }
    return this.localDbInstance;
  }

  private executeLocal<T = any>(sql: string, params: any[] = []): D1QueryResult<T> {
    const db = this.getLocalSqlite();
    if (!db) {
      throw new Error('Local SQLite database engine could not be initialized.');
    }

    const trimmed = sql.trim().toUpperCase();
    if (trimmed.startsWith('SELECT') || trimmed.startsWith('PRAGMA') || trimmed.startsWith('EXPLAIN')) {
      const stmt = db.prepare(sql);
      const rows = stmt.all(...params);
      return { results: rows as T[], success: true };
    } else {
      if (sql.includes(';') && (trimmed.startsWith('CREATE') || trimmed.startsWith('INSERT'))) {
        const parts = sql.split(';').map((s) => s.trim()).filter(Boolean);
        if (parts.length > 1) {
          db.exec(sql);
          return { results: [], success: true, meta: { changes: 1 } };
        }
      }
      const stmt = db.prepare(sql);
      const info = stmt.run(...params);
      return {
        results: [],
        success: true,
        meta: { changes: Number(info.changes || 0), last_row_id: Number(info.lastInsertRowid || 0) }
      };
    }
  }

  public async ping(): Promise<{ connected: boolean; latencyMs: number; error?: string }> {
    const start = Date.now();
    try {
      const res = await this.query('SELECT 1 as alive');
      const latencyMs = Math.max(1, Date.now() - start);
      if (res.success) {
        return { connected: true, latencyMs };
      }
      return { connected: false, latencyMs, error: 'Query executed but no result returned' };
    } catch (err: any) {
      return { connected: false, latencyMs: Date.now() - start, error: err?.message || String(err) };
    }
  }

  public async initializeTables(): Promise<void> {
    if (this.isSchemaInitialized) return;
    try {
      const statements = [
        `CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          name TEXT NOT NULL,
          role TEXT NOT NULL,
          phone TEXT,
          address TEXT,
          restaurant_id TEXT,
          wallet_balance_usd REAL DEFAULT 0,
          wallet_balance_ngn REAL DEFAULT 0,
          virtual_account_number TEXT,
          virtual_bank_name TEXT,
          virtual_account_name TEXT,
          saved_addresses TEXT,
          is_approved INTEGER DEFAULT 1,
          vehicle_type TEXT,
          license_number TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );`,
        `CREATE TABLE IF NOT EXISTS restaurants (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          slug TEXT,
          cuisine TEXT,
          rating REAL,
          review_count INTEGER DEFAULT 0,
          delivery_time_min INTEGER DEFAULT 25,
          delivery_time_max INTEGER DEFAULT 35,
          delivery_fee REAL DEFAULT 500,
          min_order REAL DEFAULT 2500,
          price_tier TEXT DEFAULT '$$',
          address TEXT DEFAULT '',
          distance_km REAL DEFAULT 2.0,
          tags TEXT DEFAULT '[]',
          badge TEXT,
          accent_color TEXT DEFAULT '#FF5500',
          is_open INTEGER DEFAULT 1,
          is_busy_paused INTEGER DEFAULT 0,
          commission_percent REAL DEFAULT 15.0,
          zone TEXT DEFAULT 'LAGOS',
          raw_json TEXT NOT NULL,
          created_at TEXT NOT NULL
        );`,
        `CREATE TABLE IF NOT EXISTS menu_categories (
          id TEXT PRIMARY KEY,
          restaurant_id TEXT NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          sort_order INTEGER DEFAULT 0,
          created_at TEXT NOT NULL
        );`,
        `CREATE TABLE IF NOT EXISTS menu_items (
          id TEXT PRIMARY KEY,
          restaurant_id TEXT NOT NULL,
          category_id TEXT,
          name TEXT NOT NULL,
          description TEXT,
          price REAL NOT NULL,
          dietary_tags TEXT DEFAULT '[]',
          popular INTEGER DEFAULT 0,
          calories INTEGER,
          prep_time_min INTEGER DEFAULT 15,
          is_available INTEGER DEFAULT 1,
          image_r2_url TEXT,
          created_at TEXT NOT NULL
        );`,
        `CREATE TABLE IF NOT EXISTS orders (
          id TEXT PRIMARY KEY,
          short_id TEXT NOT NULL,
          customer_id TEXT,
          customer_name TEXT,
          customer_phone TEXT,
          customer_address TEXT,
          customer_apartment TEXT,
          delivery_notes TEXT,
          restaurant_id TEXT,
          restaurant_name TEXT,
          restaurant_address TEXT,
          items TEXT NOT NULL,
          total REAL NOT NULL,
          subtotal REAL,
          delivery_fee REAL,
          service_fee REAL,
          tip REAL DEFAULT 0,
          discount_amount REAL DEFAULT 0,
          wallet_deduction REAL DEFAULT 0,
          currency TEXT DEFAULT 'NGN',
          fulfillment_type TEXT DEFAULT 'delivery',
          scheduled_slot TEXT,
          is_contactless INTEGER DEFAULT 0,
          promo_code TEXT,
          handover_pin TEXT,
          status TEXT NOT NULL,
          payment_method TEXT,
          payment_status TEXT,
          transaction_ref TEXT,
          courier_id TEXT,
          prep_time_adjustment_min INTEGER DEFAULT 0,
          route_progress INTEGER DEFAULT 0,
          estimated_arrival_minutes INTEGER DEFAULT 25,
          raw_json TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );`,
        `CREATE TABLE IF NOT EXISTS courier_locations (
          order_id TEXT PRIMARY KEY,
          lat REAL NOT NULL,
          lng REAL NOT NULL,
          heading REAL DEFAULT 0,
          speed REAL DEFAULT 0,
          updated_at TEXT NOT NULL
        );`,
        `CREATE TABLE IF NOT EXISTS courier_profiles (
          user_id TEXT PRIMARY KEY,
          vehicle_type TEXT DEFAULT 'Motorcycle',
          vehicle_plate TEXT DEFAULT '',
          plate_number TEXT DEFAULT '',
          license_number TEXT DEFAULT '',
          is_verified INTEGER DEFAULT 1,
          verification_status TEXT DEFAULT 'verified',
          is_online INTEGER DEFAULT 1,
          rating REAL DEFAULT 5.0,
          trips_completed INTEGER DEFAULT 0,
          total_deliveries INTEGER DEFAULT 0,
          kyc_doc_r2_url TEXT,
          photo_r2_url TEXT,
          created_at TEXT,
          updated_at TEXT
        );`,
        `CREATE TABLE IF NOT EXISTS order_chats (
          id TEXT PRIMARY KEY,
          order_id TEXT NOT NULL,
          sender TEXT NOT NULL,
          text TEXT NOT NULL,
          created_at TEXT NOT NULL
        );`,
        `CREATE TABLE IF NOT EXISTS transactions (
          id TEXT PRIMARY KEY,
          user_id TEXT,
          order_id TEXT,
          reference TEXT UNIQUE,
          amount REAL NOT NULL,
          currency TEXT DEFAULT 'NGN',
          status TEXT NOT NULL,
          payment_method TEXT,
          created_at TEXT NOT NULL
        );`,
        `CREATE TABLE IF NOT EXISTS wallet_transactions (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          type TEXT NOT NULL,
          amount REAL NOT NULL,
          currency TEXT DEFAULT 'NGN',
          description TEXT,
          status TEXT DEFAULT 'completed',
          reference TEXT,
          payment_method TEXT,
          created_at TEXT NOT NULL
        );`,
        `CREATE TABLE IF NOT EXISTS audit_logs (
          id TEXT PRIMARY KEY,
          user_id TEXT,
          user_email TEXT,
          user_role TEXT,
          action TEXT NOT NULL,
          resource TEXT,
          resource_id TEXT,
          created_at TEXT NOT NULL
        );`,
        `CREATE TABLE IF NOT EXISTS saved_addresses (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          label TEXT NOT NULL,
          address TEXT NOT NULL,
          apartment TEXT,
          city TEXT NOT NULL,
          latitude REAL,
          longitude REAL,
          delivery_instructions TEXT,
          is_default INTEGER DEFAULT 0,
          created_at TEXT NOT NULL
        );`,
        `CREATE TABLE IF NOT EXISTS promo_codes (
          id TEXT PRIMARY KEY,
          code TEXT UNIQUE NOT NULL,
          discount_type TEXT NOT NULL,
          value REAL NOT NULL,
          min_order_amount REAL DEFAULT 0,
          max_discount_cap REAL,
          times_used INTEGER DEFAULT 0,
          is_active INTEGER DEFAULT 1,
          created_at TEXT NOT NULL
        );`,
        `CREATE TABLE IF NOT EXISTS platform_settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          description TEXT,
          category TEXT,
          updated_at TEXT NOT NULL
        );`,
        `CREATE TABLE IF NOT EXISTS delivery_zones (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          code TEXT,
          currency TEXT DEFAULT 'NGN',
          base_delivery_fee REAL DEFAULT 800,
          per_km_fee REAL DEFAULT 200,
          is_active INTEGER DEFAULT 1,
          created_at TEXT NOT NULL
        );`,
        `CREATE TABLE IF NOT EXISTS reviews (
          id TEXT PRIMARY KEY,
          restaurant_id TEXT NOT NULL,
          customer_id TEXT,
          user_id TEXT,
          user_name TEXT,
          rating INTEGER NOT NULL,
          comment TEXT,
          created_at TEXT NOT NULL
        );`,
        `CREATE TABLE IF NOT EXISTS support_tickets (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          user_email TEXT NOT NULL,
          subject TEXT NOT NULL,
          message TEXT NOT NULL,
          status TEXT DEFAULT 'open',
          admin_reply TEXT,
          created_at TEXT NOT NULL
        );`,
        `CREATE TABLE IF NOT EXISTS addons (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          price REAL NOT NULL DEFAULT 0,
          group_id TEXT,
          created_at TEXT NOT NULL
        );`,
        `CREATE TABLE IF NOT EXISTS otps (
          id TEXT PRIMARY KEY,
          email TEXT NOT NULL,
          code TEXT NOT NULL,
          purpose TEXT NOT NULL,
          expires_at INTEGER NOT NULL,
          is_used INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL
        );`
      ];

      for (const sql of statements) {
        if (this.isConfigured()) {
          await this.queryDirect(sql, [], true).catch(() => {});
        }
        this.executeLocal(sql);
      }

      const now = new Date().toISOString();

      // Provision initial administrator if not present in users table
      const adminCount = this.executeLocal("SELECT count(*) as c FROM users WHERE role = 'admin'");
      const hasAdmin = Number(adminCount.results?.[0]?.c || 0) > 0;
      if (!hasAdmin) {
        const adminEmail = (CONFIG.ADMIN_EMAIL || process.env.ADMIN_EMAIL || 'admin@veyrang.com').toLowerCase().trim();
        const adminPassword = CONFIG.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || 'Admin123!';
        const passHash = bcrypt.hashSync(adminPassword, 10);
        this.executeLocal(
          `INSERT OR IGNORE INTO users (id, email, password_hash, name, role, phone, address, wallet_balance_usd, wallet_balance_ngn, saved_addresses, is_approved, created_at, updated_at)
           VALUES ('usr-admin-1', ?, ?, 'System Administrator', 'admin', '+234 801 234 5678', 'Lekki Phase 1, Lagos', 0, 0, '[]', 1, ?, ?)`,
          [adminEmail, passHash, now, now]
        );
      }

      // Initialize default Delivery Zones if table is empty
      const zoneCount = this.executeLocal('SELECT count(*) as c FROM delivery_zones');
      if (Number(zoneCount.results?.[0]?.c || 0) === 0) {
        const zones = [
          ['zone-1', 'Lekki Phase 1', 'LEKKI', 'NGN', 800, 200, 1],
          ['zone-2', 'Victoria Island', 'VI', 'NGN', 1000, 250, 1],
          ['zone-3', 'Ikoyi', 'IKOYI', 'NGN', 900, 220, 1],
          ['zone-4', 'Ikeja GRA', 'IKEJA', 'NGN', 1200, 300, 1],
          ['zone-5', 'Maitama, Abuja', 'MAITAMA', 'NGN', 1000, 250, 1]
        ];
        for (const z of zones) {
          this.executeLocal(
            `INSERT INTO delivery_zones (id, name, code, currency, base_delivery_fee, per_km_fee, is_active, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [...z, now]
          );
        }
      }

      // Initialize default Promo Codes if table is empty
      const promoCount = this.executeLocal('SELECT count(*) as c FROM promo_codes');
      if (Number(promoCount.results?.[0]?.c || 0) === 0) {
        const promos = [
          ['promo-1', 'VEYRA10', 'percentage', 10, 3000, 2000, 1],
          ['promo-2', 'FREESHIP', 'fixed', 800, 5000, 800, 1],
          ['promo-3', 'FIRST50', 'percentage', 50, 4000, 2500, 1],
          ['promo-4', 'WELCOME20', 'percentage', 20, 3500, 1500, 1]
        ];
        for (const p of promos) {
          this.executeLocal(
            `INSERT INTO promo_codes (id, code, discount_type, value, min_order_amount, max_discount_cap, is_active, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [...p, now]
          );
        }
      }

      // Initialize baseline Platform Settings if table is empty
      const settingsCount = this.executeLocal('SELECT count(*) as c FROM platform_settings');
      if (Number(settingsCount.results?.[0]?.c || 0) === 0) {
        const settings = [
          ['currency_ngn_usd_rate', '1400', 'Exchange Rate NGN to USD'],
          ['base_service_fee_ngn', '500', 'Base Service Fee in NGN'],
          ['base_service_fee_usd', '1.99', 'Base Service Fee in USD'],
          ['minimum_order_ngn', '2500', 'Minimum Order Amount in NGN'],
          ['minimum_order_usd', '10.00', 'Minimum Order Amount in USD'],
          ['platform_commission_percent', '15', 'Platform Commission Percentage'],
          ['support_phone', '+234 800 839 7264', 'Customer Support Helpline'],
          ['support_email', 'support@veyrang.com', 'Official Support Email']
        ];
        for (const [k, v, desc] of settings) {
          this.executeLocal(
            `INSERT INTO platform_settings (key, value, description, updated_at)
             VALUES (?, ?, ?, ?)`,
            [k, v, desc, now]
          );
        }
      }

      this.isSchemaInitialized = true;
    } catch (e) {
      console.warn('D1 schema init notice:', e);
    }
  }

  private async queryDirect<T = any>(sql: string, params: any[] = [], skipInitCheck: boolean = false): Promise<D1QueryResult<T>> {
    if (!this.isConfigured()) {
      return this.executeLocal<T>(sql, params);
    }

    const directUrl = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/d1/database/${this.databaseId}/query`;
    const isKey = this.apiToken.startsWith('cfk_') || this.apiToken.length < 55;
    const headers: Record<string, string> = isKey
      ? {
          'X-Auth-Email': this.authEmail,
          'X-Auth-Key': this.apiToken,
          'Content-Type': 'application/json'
        }
      : {
          Authorization: `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json'
        };

    let maxRetries = 2;
    let attempt = 0;
    let response: Response | null = null;

    while (attempt < maxRetries) {
      attempt++;
      try {
        response = await fetch(directUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({ sql, params }),
          cache: 'no-store'
        });

        if (response.status === 401 && isKey) {
          response = await fetch(directUrl, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${this.apiToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ sql, params }),
            cache: 'no-store'
          });
        }
        break;
      } catch (netErr) {
        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, 500));
          continue;
        }
        throw netErr;
      }
    }

    if (!response || !response.ok) {
      // Fallback to local SQLite if Cloudflare network/auth fails
      return this.executeLocal<T>(sql, params);
    }

    const json: D1ApiResponse<T> = await response.json().catch(() => null as any);
    if (!json?.success || !json.result || json.result.length === 0) {
      return this.executeLocal<T>(sql, params);
    }
    return json.result[0];
  }

  public async query<T = any>(sql: string, params: any[] = []): Promise<D1QueryResult<T>> {
    const trimmedSql = sql.trim().toUpperCase();
    const isSelect = trimmedSql.startsWith('SELECT');

    if (!isSelect) {
      this.clearCache();
    }

    const cacheKey = `${sql}:${JSON.stringify(params)}`;

    if (isSelect) {
      const cached = this.queryCache.get(cacheKey);
      const now = Date.now();
      if (cached && now - cached.timestamp < this.cacheTtlMs) {
        return cached.data;
      }
    }

    if (!this.isSchemaInitialized && !trimmedSql.startsWith('CREATE TABLE')) {
      await this.initializeTables();
    }

    try {
      let result: D1QueryResult<T>;
      if (this.isConfigured()) {
        try {
          result = await this.queryDirect<T>(sql, params);
        } catch {
          result = this.executeLocal<T>(sql, params);
        }
      } else {
        result = this.executeLocal<T>(sql, params);
      }

      if (isSelect) {
        this.queryCache.set(cacheKey, { timestamp: Date.now(), data: result });
        if (this.queryCache.size > 200) {
          const firstKey = this.queryCache.keys().next().value;
          if (firstKey) this.queryCache.delete(firstKey);
        }
      }
      return result;
    } catch (err: any) {
      if (err?.message?.includes('no such table')) {
        await this.initializeTables();
        return this.executeLocal<T>(sql, params);
      }
      throw err;
    }
  }
}

export const d1 = new D1Client();
