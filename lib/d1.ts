// Unified Cloudflare D1 Production Client for Veyrang Food Delivery
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

export class D1Client {
  private accountId: string;
  private databaseId: string;
  private apiToken: string;
  private workerUrl: string;

  constructor() {
    this.accountId = process.env.CLOUDFLARE_ACCOUNT_ID || '661a09bca00f369ea7301c3b6c9e6b6b';
    this.databaseId = process.env.CLOUDFLARE_DATABASE_ID || 'bfaade8e-23b9-4678-a8b3-c4bd87d510ea';
    this.apiToken = process.env.CLOUDFLARE_API_TOKEN || 'cfut_vOu5Jq16qNQHqDQEWkP3zue6RafeGzQeMhNdd94M6b9c61f3';
    this.workerUrl = process.env.CLOUDFLARE_WORKER_URL || 'https://veyrang-api.abideentaoreed12.workers.dev';
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
    // Strategy 1: Direct Cloudflare D1 HTTP API
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
        }
      } catch (err: any) {
        console.warn('[D1 Direct API Exception]', err?.message || err);
      }
    }

    // Strategy 2: Cloudflare Worker Gateway fallback
    if (this.workerUrl) {
      const workerEndpoints = [
        `${this.workerUrl}/api/query`,
        `${this.workerUrl}/query`,
        `${this.workerUrl}/d1`
      ];

      for (const endpoint of workerEndpoints) {
        try {
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sql, params }),
            cache: 'no-store'
          });

          if (response.ok) {
            const data = await response.json();
            if (data.results) {
              return { results: data.results, success: true };
            }
            if (data.result && data.result.length > 0) {
              return data.result[0];
            }
            if (Array.isArray(data)) {
              return { results: data, success: true };
            }
          }
        } catch {}
      }
    }

    return { results: [], success: false };
  }
}

export const d1 = new D1Client();
