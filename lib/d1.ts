import fs from 'node:fs';
import path from 'node:path';

// Unified Cloudflare D1 & Persistent SQLite Client for Veyrang Food Delivery
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

let localDbInstance: any = null;

function getLocalSQLite() {
  if (localDbInstance) return localDbInstance;
  try {
    const { DatabaseSync } = require('node:sqlite');
    const dataDir = path.resolve(process.cwd(), '.data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const dbPath = path.join(dataDir, 'veyrang.sqlite');
    localDbInstance = new DatabaseSync(dbPath);
    return localDbInstance;
  } catch (err) {
    console.warn('[Local SQLite Init Warning]:', err);
    return null;
  }
}

export class D1Client {
  private accountId: string;
  private databaseId: string;
  private apiToken: string;
  private workerUrl: string;

  constructor() {
    this.accountId = process.env.CLOUDFLARE_ACCOUNT_ID || '661a09bca00f369ea7301c3b6c9e6b6b';
    this.databaseId = process.env.CLOUDFLARE_DATABASE_ID || 'bfaade8e-23b9-4678-a8b3-c4bd87d510ea';
    this.apiToken = process.env.CLOUDFLARE_API_TOKEN || 'cfut_vOu5Jq16qNQHqDQEWkP3zue6RafeGzQeMhNdd94M6b9c61f3';
    this.workerUrl = (process.env.CLOUDFLARE_WORKER_URL || 'https://veyrang-api.abideentaoreed12.workers.dev').replace(/\/$/, '');
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

  public async ping(): Promise<{ connected: boolean; latencyMs: number; error?: string }> {
    const start = Date.now();
    try {
      const res = await this.query('SELECT 1 as alive');
      const latencyMs = Date.now() - start;
      if (res.success || (res.results && res.results.length > 0)) {
        return { connected: true, latencyMs };
      }
      return { connected: false, latencyMs, error: 'Query executed but no result returned' };
    } catch (err: any) {
      return { connected: false, latencyMs: Date.now() - start, error: err?.message || String(err) };
    }
  }

  public async query<T = any>(sql: string, params: any[] = []): Promise<D1QueryResult<T>> {
    const start = Date.now();

    // Live Cloudflare D1 HTTP API (Primary Authoritative Live Database)
    if (this.isConfigured()) {
      const directUrl = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/d1/database/${this.databaseId}/query`;
      try {
        const response = await fetch(directUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ sql, params }),
          cache: 'no-store'
        });

        if (response.ok) {
          const json: D1ApiResponse<T> = await response.json();
          if (json.success && json.result && json.result.length > 0) {
            return json.result[0];
          }
          if (json.errors && json.errors.length > 0) {
            console.error('[Cloudflare D1 Query Error]:', json.errors);
            return { results: [], success: false };
          }
        } else {
          const errBody = await response.text().catch(() => '');
          console.error('[Cloudflare D1 HTTP Error]:', response.status, errBody);
          return { results: [], success: false };
        }
      } catch (err: any) {
        console.error('[Cloudflare D1 Direct API Exception]:', err?.message || err);
        return { results: [], success: false };
      }
    }

    // Strategy 3: Local High-Performance Persistent SQLite Engine
    const localDb = getLocalSQLite();
    if (localDb) {
      try {
        const trimmed = sql.trim();
        const upper = trimmed.toUpperCase();

        // Multiple DDL statements or statements without parameters
        if (params.length === 0 && (upper.startsWith('CREATE') || upper.startsWith('DROP') || upper.startsWith('ALTER') || trimmed.includes(';'))) {
          localDb.exec(trimmed);
          return { results: [], success: true, meta: { duration: Date.now() - start } };
        }

        const stmt = localDb.prepare(trimmed);

        if (upper.startsWith('SELECT') || upper.startsWith('PRAGMA') || upper.startsWith('EXPLAIN')) {
          const rows = stmt.all(...params);
          // Convert row null-prototypes to clean JSON objects
          const cleanRows = (rows || []).map((r: any) => ({ ...r }));
          return { results: cleanRows, success: true, meta: { duration: Date.now() - start, rows_read: cleanRows.length } };
        } else {
          const info = stmt.run(...params);
          return {
            results: [],
            success: true,
            meta: {
              duration: Date.now() - start,
              changes: info.changes,
              last_row_id: Number(info.lastInsertRowid || 0)
            }
          };
        }
      } catch (err: any) {
        console.warn('[Local SQLite Query Warning]:', err?.message || err, 'SQL:', sql);
        return { results: [], success: false };
      }
    }

    return { results: [], success: false };
  }
}

export const d1 = new D1Client();
