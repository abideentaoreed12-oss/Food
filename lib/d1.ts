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

export class D1Client {
  private accountId: string;
  private databaseId: string;
  private apiToken: string;
  private authEmail: string;
  private workerUrl: string;

  constructor() {
    this.accountId = process.env.CLOUDFLARE_ACCOUNT_ID || CONFIG.CLOUDFLARE_ACCOUNT_ID;
    this.databaseId = process.env.CLOUDFLARE_DATABASE_ID || CONFIG.CLOUDFLARE_DATABASE_ID;
    this.apiToken = process.env.CLOUDFLARE_API_TOKEN || CONFIG.CLOUDFLARE_API_TOKEN;
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

  public async query<T = any>(sql: string, params: any[] = []): Promise<D1QueryResult<T>> {
    if (!this.isConfigured()) {
      throw new Error('Cloudflare D1 is the single source of truth but credentials are not configured in environment variables.');
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

    let response = await fetch(directUrl, {
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

    const json: D1ApiResponse<T> = await response.json().catch(() => null as any);
    if (!response.ok || !json?.success || !json.result || json.result.length === 0) {
      const errDetails = json?.errors?.map((e) => e.message).join(', ') || `HTTP ${response.status}`;
      throw new Error(`Cloudflare D1 query failed: ${errDetails}`);
    }
    return json.result[0];
  }
}

export const d1 = new D1Client();
