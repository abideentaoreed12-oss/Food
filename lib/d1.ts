// Unified Cloudflare D1 Client for Next.js
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

  constructor() {
    this.accountId = process.env.CLOUDFLARE_ACCOUNT_ID || '';
    this.databaseId = process.env.CLOUDFLARE_DATABASE_ID || '';
    this.apiToken = process.env.CLOUDFLARE_API_TOKEN || '';
  }

  public isConfigured(): boolean {
    return Boolean(this.accountId && this.databaseId && this.apiToken);
  }

  public async query<T = any>(sql: string, params: any[] = []): Promise<D1QueryResult<T>> {
    if (!this.isConfigured()) {
      return { results: [], success: false };
    }

    const url = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/d1/database/${this.databaseId}/query`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ sql, params }),
        cache: 'no-store'
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn('D1 Query HTTP Error:', response.status, errorText);
        return { results: [], success: false };
      }

      const json: D1ApiResponse<T> = await response.json();
      if (!json.success || !json.result || json.result.length === 0) {
        return { results: [], success: false };
      }

      return json.result[0];
    } catch (err: any) {
      console.warn('D1 fetch exception:', err?.message || err);
      return { results: [], success: false };
    }
  }
}

export const d1 = new D1Client();
