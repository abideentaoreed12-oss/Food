// Cloudflare D1 Live Database Integration Client
// Direct HTTP REST API connector to Cloudflare D1 (SQLite at the edge)

import { CONFIG } from '../config.ts';
import bcrypt from 'bcryptjs';
import { INITIAL_RESTAURANTS } from '../../src/data/mockData.ts';

const CLOUDFLARE_ACCOUNT_ID = CONFIG.CLOUDFLARE_ACCOUNT_ID;
const CLOUDFLARE_DATABASE_ID = CONFIG.CLOUDFLARE_DATABASE_ID;
const CLOUDFLARE_DATABASE_NAME = CONFIG.CLOUDFLARE_DATABASE_NAME;
const CLOUDFLARE_API_TOKEN = CONFIG.CLOUDFLARE_API_TOKEN;

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
  private isSchemaInitialized: boolean = false;

  constructor() {
    this.accountId = CLOUDFLARE_ACCOUNT_ID;
    this.databaseId = CLOUDFLARE_DATABASE_ID;
    this.apiToken = CLOUDFLARE_API_TOKEN;
  }

  public updateCredentials(accountId?: string, databaseId?: string, apiToken?: string) {
    if (accountId) this.accountId = accountId;
    if (databaseId) this.databaseId = databaseId;
    if (apiToken) this.apiToken = apiToken;
  }

  public async query<T = any>(sql: string, params: any[] = []): Promise<D1QueryResult<T>> {
    if (!this.isSchemaInitialized && !sql.includes('CREATE TABLE') && !sql.includes('SELECT 1')) {
      try {
        await this.initializeTables();
      } catch (e) {
        // ignore init failure during offline fallback
      }
    }

    const url = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/d1/database/${this.databaseId}/query`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sql,
        params
      })
    });

    const data = (await response.json()) as D1ApiResponse<T>;

    if (!data.success || !data.result || data.result.length === 0) {
      const errMessage = (data.errors && data.errors.length > 0)
        ? data.errors.map((e) => `[Code ${e.code}] ${e.message}`).join(', ')
        : `D1 Query Failed with status ${response.status}`;
      throw new Error(`Cloudflare D1 Error: ${errMessage}`);
    }

    return data.result[0];
  }

  public async testConnection(): Promise<{
    connected: boolean;
    error?: string;
    details?: any;
  }> {
    try {
      const res = await this.query('SELECT 1 as live_status, CURRENT_TIMESTAMP as cf_timestamp;');
      return {
        connected: true,
        details: res.results[0]
      };
    } catch (err: any) {
      return {
        connected: false,
        error: err.message || 'Unknown connection error'
      };
    }
  }

  public async initializeTables(): Promise<void> {
    if (this.isSchemaInitialized) return;

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
        saved_addresses TEXT,
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
        subject TEXT,
        message TEXT,
        status TEXT DEFAULT 'open',
        priority TEXT DEFAULT 'normal',
        created_at TEXT NOT NULL
      );`
    ];

    for (const sql of schemaStatements) {
      await this.query(sql).catch((err) => {
        console.warn('D1 schema statement note:', err.message);
      });
    }

    // Dynamic database self-healing & migrations to align columns
    await this.query('ALTER TABLE promo_codes ADD COLUMN usage_limit INTEGER DEFAULT 1000;').catch(() => {});
    await this.query('ALTER TABLE promo_codes ADD COLUMN times_used INTEGER DEFAULT 0;').catch(() => {});
    await this.query('ALTER TABLE delivery_zones ADD COLUMN radius_km REAL DEFAULT 15;').catch(() => {});
    await this.query('ALTER TABLE delivery_zones ADD COLUMN map_image_r2_url TEXT;').catch(() => {});

    // Ensure default admin user and initial restaurants exist in D1
    try {
      const salt = bcrypt.genSaltSync(10);
      const adminEmail = CONFIG.ADMIN_EMAIL || 'abideentaoreed12@gmail.com';
      const adminPasswordHash = bcrypt.hashSync(CONFIG.ADMIN_PASSWORD || 'Teeplus1029', salt);
      const now = new Date().toISOString();

      await this.query(
        `INSERT INTO users (id, email, password_hash, name, role, phone, wallet_balance_usd, wallet_balance_ngn, saved_addresses, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           email = excluded.email,
           password_hash = excluded.password_hash,
           role = excluded.role;`,
        [
          'usr-admin-1',
          adminEmail.toLowerCase().trim(),
          adminPasswordHash,
          'System Administrator',
          'admin',
          '+1 (555) 900-0001',
          250.0,
          350000,
          '[]',
          now,
          now
        ]
      );

      for (const r of INITIAL_RESTAURANTS) {
        await this.query(
          `INSERT INTO restaurants (id, name, cuisine, rating, raw_json, created_at)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             name = excluded.name,
             cuisine = excluded.cuisine,
             raw_json = excluded.raw_json;`,
          [r.id, r.name, r.cuisine, r.rating, JSON.stringify(r), now]
        );
      }
    } catch (e) {
      console.warn('D1 auto-seed note:', e);
    }

    this.isSchemaInitialized = true;
  }
}

export const d1Client = new CloudflareD1Client();
