import fs from 'fs';
import path from 'path';
import os from 'os';
import { DatabaseSync } from 'node:sqlite';
import bcrypt from 'bcryptjs';
import { CONFIG } from '../server/config';

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
          usage_limit INTEGER DEFAULT 1000,
          times_used INTEGER DEFAULT 0,
          is_active INTEGER DEFAULT 1,
          expires_at TEXT,
          description TEXT DEFAULT '',
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
        // Required schema creation must fail visibly; never mark a partially migrated DB healthy.
        if (this.isConfigured()) await this.queryDirect(sql, [], true);
        this.executeLocal(sql);
      }

      // Backward-compatible handover/review migrations. Inspect columns before ALTER TABLE:
      // older SQLite/D1 engines don't support ADD COLUMN IF NOT EXISTS consistently.
      const ensureColumn = async (table: string, column: string, definition: string) => {
        const sql = `PRAGMA table_info(${table})`;
        if (this.isConfigured()) {
          const remote = await this.queryDirect(sql, [], true);
          const cols = (remote.results || []).map((row: any) => String(row.name));
          if (!cols.includes(column)) await this.queryDirect(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`, [], true);
        }
        const local = this.executeLocal(sql, []);
        const cols = (local.results || []).map((row: any) => String(row.name));
        if (!cols.includes(column)) this.executeLocal(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`, []);
      };
      const handoverTable = `CREATE TABLE IF NOT EXISTS handover_qr_tokens (
        id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        expires_at TEXT NOT NULL,
        consumed_at TEXT,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL
      )`;
      if (this.isConfigured()) await this.queryDirect(handoverTable, [], true);
      this.executeLocal(handoverTable);
      if (this.isConfigured()) await this.queryDirect('CREATE INDEX IF NOT EXISTS idx_handover_qr_order ON handover_qr_tokens (order_id, consumed_at)', [], true);
      this.executeLocal('CREATE INDEX IF NOT EXISTS idx_handover_qr_order ON handover_qr_tokens (order_id, consumed_at)');
      for (const [column, definition] of [
        ['order_id', 'TEXT'], ['courier_id', 'TEXT'], ['customer_name', 'TEXT'],
        ['food_rating', 'INTEGER'], ['delivery_rating', 'INTEGER'], ['photo_r2_url', 'TEXT']
      ] as const) await ensureColumn('reviews', column, definition);
      // Enforce one review per order/customer at the database layer, including concurrent requests.
      // If legacy duplicate data exists, fail migration visibly so it can be reconciled before rollout.
      const reviewUniqueIndex = 'CREATE UNIQUE INDEX IF NOT EXISTS uq_reviews_order_customer ON reviews (order_id, customer_id)';
      if (this.isConfigured()) await this.queryDirect(reviewUniqueIndex, [], true);
      this.executeLocal(reviewUniqueIndex);

      // Migrate older promo_codes tables in both authoritative D1 and local development SQLite.
      // CREATE TABLE IF NOT EXISTS does not add columns to tables that already exist.
      const promoColumnMigrations = [
        'ALTER TABLE promo_codes ADD COLUMN usage_limit INTEGER DEFAULT 1000',
        "ALTER TABLE promo_codes ADD COLUMN expires_at TEXT",
        "ALTER TABLE promo_codes ADD COLUMN description TEXT DEFAULT ''"
      ];
      for (const migration of promoColumnMigrations) {
        const column = migration.match(/ADD COLUMN\s+([a-z_]+)/i)?.[1];
        if (!column) throw new Error(`Invalid promo-code migration: ${migration}`);
        const ensurePromoColumn = async (remote: boolean) => {
          const pragma = 'PRAGMA table_info(promo_codes)';
          const result = remote ? await this.queryDirect(pragma, [], true) : this.executeLocal(pragma, []);
          const exists = (result.results || []).some((row: any) => String(row.name) === column);
          if (exists) return;
          if (remote) await this.queryDirect(migration, [], true);
          else this.executeLocal(migration, []);
        };
        if (this.isConfigured()) await ensurePromoColumn(true);
        await ensurePromoColumn(false);
      }

      const now = new Date().toISOString();

      // Ensure Administrator Account Exists
      const adminCount = this.executeLocal('SELECT count(*) as c FROM users WHERE role = ?', ['admin']);
      const hasAdmin = Number(adminCount.results?.[0]?.c || 0) > 0;
      if (!hasAdmin) {
        const adminEmail = (CONFIG.ADMIN_EMAIL || process.env.ADMIN_EMAIL || '').toLowerCase().trim();
        const adminPass = (CONFIG.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || '').trim();
        // Seed admin only when env credentials are present — never invent Admin123! or similar.
        if (adminEmail && adminPass) {
          const passHash = bcrypt.hashSync(adminPass, 10);
          this.executeLocal(
            `INSERT OR IGNORE INTO users (id, email, password_hash, name, role, phone, address, wallet_balance_usd, wallet_balance_ngn, saved_addresses, is_approved, created_at, updated_at)
             VALUES ('usr-admin-1', ?, ?, 'System Administrator', 'admin', '', '', 0, 0, '[]', 1, ?, ?)`,
            [adminEmail, passHash, now, now]
          );
        }
      }

        // Never seed database tables from a checked-in snapshot. Production data must come from
        // the authoritative configured database or explicit admin-created records.

      this.isSchemaInitialized = true;
    } catch (e) {
      // Keep initialization retryable and surface the failure to the request/CI caller.
      this.isSchemaInitialized = false;
      console.error('D1 schema initialization failed:', e);
      throw e;
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
      if (process.env.NODE_ENV === 'production') {
        const errorText = (await response?.text().catch(() => '')) || 'Network error';
        throw new Error(`Cloudflare D1 query failed (HTTP ${response?.status || 'ERR'}): ${errorText}`);
      }
      return this.executeLocal<T>(sql, params);
    }

    const json: D1ApiResponse<T> = await response.json().catch(() => null as any);
    if (!json?.success || !json.result || json.result.length === 0) {
      if (process.env.NODE_ENV === 'production') {
        const msg = json?.errors?.[0]?.message || 'Cloudflare D1 returned unsuccessful response';
        throw new Error(`Cloudflare D1 error: ${msg}`);
      }
      return this.executeLocal<T>(sql, params);
    }
    return json.result[0];
  }

  public async query<T = any>(
    sql: string,
    params: any[] = [],
    options: { cache?: boolean } = {}
  ): Promise<D1QueryResult<T>> {
    const trimmedSql = sql.trim().toUpperCase();
    const isSelect = trimmedSql.startsWith('SELECT');
    const useCache = options.cache !== false;

    if (!isSelect) {
      this.clearCache();
    }

    const cacheKey = `${sql}:${JSON.stringify(params)}`;

    if (isSelect && useCache) {
      const cached = this.queryCache.get(cacheKey);
      const now = Date.now();
      if (cached && now - cached.timestamp < this.cacheTtlMs) {
        return cached.data;
      }
    }

    if (!this.isSchemaInitialized && !trimmedSql.startsWith('CREATE TABLE')) {
      await this.initializeTables();
    }

    // Production must never silently switch to ephemeral SQLite. That can make the
    // application appear healthy while reading/writing a different, empty database.
    if (process.env.NODE_ENV === 'production' && !this.isConfigured()) {
      throw new Error('Cloudflare D1 is not configured; refusing to use local SQLite in production.');
    }

    try {
      let result: D1QueryResult<T>;
      if (this.isConfigured()) {
        try {
          result = await this.queryDirect<T>(sql, params);
        } catch (err: any) {
          if (process.env.NODE_ENV === 'production') {
            throw new Error(`Cloudflare D1 query failed; local fallback is disabled in production: ${err?.message || 'unknown error'}`);
          }
          result = this.executeLocal<T>(sql, params);
        }
      } else {
        result = this.executeLocal<T>(sql, params);
      }

      if (isSelect && useCache) {
        this.queryCache.set(cacheKey, { timestamp: Date.now(), data: result });
        if (this.queryCache.size > 200) {
          const firstKey = this.queryCache.keys().next().value;
          if (firstKey) this.queryCache.delete(firstKey);
        }
      }
      return result;
    } catch (err: any) {
      if (err?.message?.includes('no such table') && process.env.NODE_ENV !== 'production') {
        await this.initializeTables();
        return this.executeLocal<T>(sql, params);
      }
      throw err;
    }
  }
}

export const d1 = new D1Client();
