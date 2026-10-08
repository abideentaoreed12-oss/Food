// Pure Cloudflare D1 HTTP client (Live-Only) - Zero hardcoded fallbacks
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
  private workerUrl: string;

  constructor() {
    this.accountId = process.env.CLOUDFLARE_ACCOUNT_ID || '';
    this.databaseId = process.env.CLOUDFLARE_DATABASE_ID || '';
    this.apiToken = process.env.CLOUDFLARE_API_TOKEN || '';
    this.workerUrl = (process.env.CLOUDFLARE_WORKER_URL || '').replace(/\/$/, '');
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
    if (!this.isConfigured()) {
      console.error('[Cloudflare D1 Config Error]: Missing environment credentials.');
      return { results: [], success: false };
    }

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

    return { results: [], success: false };
  }
}

export const d1 = new D1Client();
