// Cloudflare D1 Live Database Integration Client
// Direct HTTP REST API connector to Cloudflare D1 (SQLite at the edge)

import { CONFIG } from '../config';
import bcrypt from 'bcryptjs';

const CLOUDFLARE_ACCOUNT_ID = CONFIG.CLOUDFLARE_ACCOUNT_ID;
const CLOUDFLARE_DATABASE_ID = CONFIG.CLOUDFLARE_DATABASE_ID;
const CLOUDFLARE_API_TOKEN = CONFIG.CLOUDFLARE_D1_API_TOKEN || CONFIG.CLOUDFLARE_API_TOKEN;

export interface D1QueryResult<T = any> {
  results: T[];
  success: boolean;
  meta?: {
    duration?: number;
    rows_read?: number;
    rows_written?: number;
  };
}

export interface D1ApiResponse<T = any> {
  result: D1QueryResult<T>[] | null;
  success: boolean;
  errors: Array<{ code: number; message: string }>;
  messages: Array<{ code?: number; message?: string }>;
}

export class CloudflareD1Client {
  private accountId: string;
  private databaseId: string;
  private apiToken: string;
  private authEmail: string;
  private isSchemaInitialized: boolean = false;
  private isInitializing: boolean = false;

  constructor() {
    this.accountId = CLOUDFLARE_ACCOUNT_ID;
    this.databaseId = CLOUDFLARE_DATABASE_ID;
    this.apiToken = CLOUDFLARE_API_TOKEN;
    this.authEmail = process.env.CLOUDFLARE_AUTH_EMAIL || CONFIG.CLOUDFLARE_AUTH_EMAIL || 'abideentaoreed12@gmail.com';
  }

  public updateCredentials(accountId?: string, databaseId?: string, apiToken?: string) {
    if (accountId) this.accountId = accountId;
    if (databaseId) this.databaseId = databaseId;
    if (apiToken) this.apiToken = apiToken;
  }

  public async queryDirect<T = any>(sql: string, params: any[] = []): Promise<D1QueryResult<T>> {
    if (!this.accountId || !this.databaseId || !this.apiToken) {
      throw new Error('Cloudflare D1 is the single source of truth but credentials are not configured in environment variables.');
    }

    const url = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/d1/database/${this.databaseId}/query`;

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

    let response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ sql, params })
    });

    if (response.status === 401 && isKey) {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ sql, params })
      });
    } else if (response.status === 401 && !isKey) {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'X-Auth-Email': this.authEmail,
          'X-Auth-Key': this.apiToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ sql, params })
      });
    }

    const data = (await response.json()) as D1ApiResponse<T>;

    if (!response.ok || !data.success || !data.result || data.result.length === 0) {
      const errDetails = data.errors?.map((e) => e.message).join(', ') || `HTTP ${response.status}`;
      throw new Error(`Cloudflare D1 query failed: ${errDetails}`);
    }

    return data.result[0];
  }

  public async query<T = any>(sql: string, params: any[] = []): Promise<D1QueryResult<T>> {
    return await this.queryDirect<T>(sql, params);
  }

  public async testConnection(): Promise<{ connected: boolean; error?: string; details?: any }> {
    try {
      const res = await this.queryDirect(
        'SELECT 1 as live_status, CURRENT_TIMESTAMP as cf_timestamp;'
      );
      return { connected: true, details: res.results[0] };
    } catch (err: any) {
      return { connected: false, error: err.message || 'Unknown connection error' };
    }
  }

  public async initializeTables(): Promise<void> {
    if (this.isSchemaInitialized) return;
    if (this.isInitializing) throw new Error('D1 schema initialization is already in progress');
    this.isInitializing = true;

    const schemaStatements = [
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
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );`,
      `CREATE TABLE IF NOT EXISTS user_virtual_accounts (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL UNIQUE,
        account_number TEXT NOT NULL,
        bank_name TEXT NOT NULL,
        account_name TEXT,
        provider TEXT DEFAULT 'paystack',
        provider_customer_code TEXT,
        provider_dedicated_id TEXT,
        is_active INTEGER DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );`,
      `CREATE TABLE IF NOT EXISTS restaurants (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        cuisine TEXT,
        rating REAL,
        raw_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );`,
      `CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        short_id TEXT NOT NULL,
        customer_id TEXT,
        customer_name TEXT,
        customer_phone TEXT,
        customer_address TEXT,
        restaurant_id TEXT,
        restaurant_name TEXT,
        items TEXT NOT NULL,
        total REAL NOT NULL,
        currency TEXT DEFAULT 'NGN',
        payment_method TEXT,
        payment_status TEXT,
        status TEXT NOT NULL,
        raw_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );`,
      `CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        order_id TEXT,
        reference TEXT UNIQUE,
        amount REAL NOT NULL,
        currency TEXT DEFAULT 'NGN',
        status TEXT NOT NULL,
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
        ip TEXT,
        created_at TEXT NOT NULL
      );`,
      `CREATE TABLE IF NOT EXISTS menu_categories (
        id TEXT PRIMARY KEY,
        restaurant_id TEXT,
        name TEXT NOT NULL,
        description TEXT,
        sort_order INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        image_r2_url TEXT,
        created_at TEXT NOT NULL
      );`,
      `CREATE TABLE IF NOT EXISTS menu_items (
        id TEXT PRIMARY KEY,
        restaurant_id TEXT,
        category_id TEXT,
        name TEXT NOT NULL,
        description TEXT,
        price REAL NOT NULL,
        dietary_tags TEXT,
        popular INTEGER DEFAULT 0,
        calories INTEGER,
        prep_time_min INTEGER,
        is_available INTEGER DEFAULT 1,
        image_r2_url TEXT,
        created_at TEXT NOT NULL
      );`,
      `CREATE TABLE IF NOT EXISTS item_modifiers (
        id TEXT PRIMARY KEY,
        group_id TEXT,
        name TEXT NOT NULL,
        price REAL NOT NULL,
        is_available INTEGER DEFAULT 1,
        created_at TEXT NOT NULL
      );`,
      `CREATE TABLE IF NOT EXISTS courier_profiles (
        user_id TEXT PRIMARY KEY,
        vehicle_type TEXT,
        plate_number TEXT,
        license_number TEXT,
        rating REAL DEFAULT 5.0,
        verification_status TEXT DEFAULT 'verified',
        kyc_doc_r2_url TEXT,
        photo_r2_url TEXT,
        total_deliveries INTEGER DEFAULT 0,
        trips_completed INTEGER DEFAULT 0,
        is_online INTEGER DEFAULT 1,
        updated_at TEXT NOT NULL
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
        city TEXT,
        country TEXT,
        currency TEXT DEFAULT 'NGN',
        base_delivery_fee REAL DEFAULT 1000,
        per_km_fee REAL DEFAULT 200,
        max_radius_km REAL DEFAULT 15,
        surge_multiplier REAL DEFAULT 1.0,
        map_r2_url TEXT,
        center_lat REAL,
        center_lng REAL,
        is_active INTEGER DEFAULT 1,
        created_at TEXT NOT NULL
      );`,
      `CREATE TABLE IF NOT EXISTS reviews (
        id TEXT PRIMARY KEY,
        order_id TEXT,
        restaurant_id TEXT,
        courier_id TEXT,
        customer_id TEXT,
        customer_name TEXT,
        food_rating REAL,
        delivery_rating REAL,
        comment TEXT,
        photo_r2_url TEXT,
        merchant_reply TEXT,
        created_at TEXT NOT NULL
      );`,
      `CREATE TABLE IF NOT EXISTS support_tickets (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        user_email TEXT,
        customer_name TEXT,
        subject TEXT,
        message TEXT,
        status TEXT DEFAULT 'open',
        priority TEXT DEFAULT 'normal',
        admin_reply TEXT DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT
      );`
    ];

    // Backward-compatible support ticket migrations for existing D1 databases.
    const supportMigrations = [
      'ALTER TABLE support_tickets ADD COLUMN customer_name TEXT',
      "ALTER TABLE support_tickets ADD COLUMN admin_reply TEXT DEFAULT ''",
      'ALTER TABLE support_tickets ADD COLUMN updated_at TEXT'
    ];
    for (const sql of supportMigrations) {
      await this.query(sql).catch(() => {});
    }

    for (const sql of schemaStatements) {
      await this.query(sql).catch((err) => {
        console.warn('D1 schema statement note:', err.message);
      });
    }

    await this.query('ALTER TABLE promo_codes ADD COLUMN usage_limit INTEGER DEFAULT 1000;').catch(
      () => {}
    );
    await this.query('ALTER TABLE promo_codes ADD COLUMN times_used INTEGER DEFAULT 0;').catch(
      () => {}
    );
    await this.query('ALTER TABLE delivery_zones ADD COLUMN radius_km REAL DEFAULT 15;').catch(
      () => {}
    );
    await this.query('ALTER TABLE delivery_zones ADD COLUMN map_image_r2_url TEXT;').catch(() => {});
    await this.query('ALTER TABLE users ADD COLUMN virtual_account_number TEXT;').catch(() => {});
    await this.query('ALTER TABLE users ADD COLUMN virtual_bank_name TEXT;').catch(() => {});
    await this.query('ALTER TABLE users ADD COLUMN virtual_account_name TEXT;').catch(() => {});
    await this.query('ALTER TABLE courier_profiles ADD COLUMN total_deliveries INTEGER DEFAULT 0;').catch(() => {});
    await this.query('ALTER TABLE courier_profiles ADD COLUMN trips_completed INTEGER DEFAULT 0;').catch(() => {});

    // Admin seed: credentials from env only — zero balances, no fake phone/money
    try {
      const now = new Date().toISOString();
      if (CONFIG.ADMIN_EMAIL && CONFIG.ADMIN_PASSWORD) {
        const salt = bcrypt.genSaltSync(10);
        const adminEmail = CONFIG.ADMIN_EMAIL.toLowerCase().trim();
        const adminPasswordHash = bcrypt.hashSync(CONFIG.ADMIN_PASSWORD, salt);

        await this.query(
          `INSERT INTO users (id, email, password_hash, name, role, phone, wallet_balance_usd, wallet_balance_ngn, saved_addresses, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             email = excluded.email,
             password_hash = excluded.password_hash,
             role = excluded.role;`,
          [
            'usr-admin-1',
            adminEmail,
            adminPasswordHash,
            'System Administrator',
            'admin',
            null,
            0,
            0,
            '[]',
            now,
            now
          ]
        );
      }

      // Production schema initialization never imports mock restaurant records.
      this.isSchemaInitialized = true;
    } catch (e) {
      this.isSchemaInitialized = false;
      throw e;
    } finally {
      this.isInitializing = false;
    }
  }
}

export const d1Client = new CloudflareD1Client();
