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
  private cacheTtlMs: number = 10000; // 10 seconds cache for SELECT queries to prevent rate limits

  constructor() {
    this.accountId = process.env.CLOUDFLARE_ACCOUNT_ID || CONFIG.CLOUDFLARE_ACCOUNT_ID || 'veyrang_account';
    this.databaseId = process.env.CLOUDFLARE_DATABASE_ID || CONFIG.CLOUDFLARE_DATABASE_ID || 'veyrang_db';
    this.apiToken = process.env.CLOUDFLARE_API_TOKEN || CONFIG.CLOUDFLARE_API_TOKEN || 'veyrang_token';
    this.authEmail = process.env.CLOUDFLARE_AUTH_EMAIL || CONFIG.CLOUDFLARE_AUTH_EMAIL || 'abideentaoreed12@gmail.com';
    this.workerUrl = (process.env.CLOUDFLARE_WORKER_URL || CONFIG.CLOUDFLARE_WORKER_URL || '').replace(/\/$/, '');
  }

  public isConfigured(): boolean {
    return Boolean(this.accountId && this.databaseId && this.apiToken);
  }

  public getDetails() {
    return {
      accountId: this.accountId,
      databaseId: this.databaseId,
      databaseName: process.env.CLOUDFLARE_DATABASE_NAME || 'veyrang_production',
      workerUrl: this.workerUrl,
      isConfigured: this.isConfigured()
    };
  }

  public clearCache(): void {
    this.queryCache.clear();
  }

  public async ping(): Promise<{ connected: boolean; latencyMs: number; error?: string }> {
    const start = Date.now();
    try {
      const res = await this.query('SELECT 1 as alive');
      const latencyMs = Date.now() - start;
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
          user_id TEXT,
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
          base_delivery_fee REAL DEFAULT 1000,
          per_km_fee REAL DEFAULT 200,
          is_active INTEGER DEFAULT 1,
          created_at TEXT NOT NULL
        );`,
        `CREATE TABLE IF NOT EXISTS reviews (
          id TEXT PRIMARY KEY,
          restaurant_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
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
        );`
      ];

      for (const sql of statements) {
        await this.queryDirect(sql, [], true).catch(() => {});
      }
      this.isSchemaInitialized = true;
    } catch (e) {
      console.warn('D1 schema init notice:', e);
    }
  }

  private async queryDirect<T = any>(sql: string, params: any[] = [], skipInitCheck: boolean = false): Promise<D1QueryResult<T>> {
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

    let maxRetries = 3;
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
        } else if (response.status === 401 && !isKey) {
          response = await fetch(directUrl, {
            method: 'POST',
            headers: {
              'X-Auth-Email': this.authEmail,
              'X-Auth-Key': this.apiToken,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ sql, params }),
            cache: 'no-store'
          });
        }

        // If rate limited (429 or rate exceeded), wait with exponential backoff and retry
        if (response.status === 429 || response.status === 503) {
          if (attempt < maxRetries) {
            const delay = attempt * 1000 + Math.random() * 500;
            await new Promise((resolve) => setTimeout(resolve, delay));
            continue;
          }
        }

        break;
      } catch (netErr) {
        if (attempt < maxRetries) {
          const delay = attempt * 1000;
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        throw netErr;
      }
    }

    if (!response) {
      throw new Error('Cloudflare D1 request failed after max retries.');
    }

    const json: D1ApiResponse<T> = await response.json().catch(() => null as any);
    if (!response.ok || !json?.success || !json.result || json.result.length === 0) {
      const errDetails = json?.errors?.map((e) => e.message).join(', ') || `HTTP ${response.status}`;
      if (errDetails.toLowerCase().includes('rate') || errDetails.toLowerCase().includes('exceeded') || response.status === 429) {
        throw new Error(`Cloudflare D1 Rate Limit Exceeded: ${errDetails}. Please try again shortly.`);
      }
      throw new Error(`Cloudflare D1 query failed: ${errDetails}`);
    }
    return json.result[0];
  }

  public async query<T = any>(sql: string, params: any[] = []): Promise<D1QueryResult<T>> {
    const trimmedSql = sql.trim().toUpperCase();
    const isSelect = trimmedSql.startsWith('SELECT');

    // If it's a write operation (INSERT, UPDATE, DELETE, REPLACE, etc.), instantly invalidate cache
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
      const result = await this.queryDirect<T>(sql, params);
      if (isSelect) {
        this.queryCache.set(cacheKey, { timestamp: Date.now(), data: result });
        // Clean cache if too large
        if (this.queryCache.size > 200) {
          const firstKey = this.queryCache.keys().next().value;
          if (firstKey) this.queryCache.delete(firstKey);
        }
      }
      return result;
    } catch (err: any) {
      if (err?.message?.includes('no such table')) {
        await this.initializeTables();
        return await this.queryDirect<T>(sql, params);
      }
      throw err;
    }
  }
}

export const d1 = new D1Client();
