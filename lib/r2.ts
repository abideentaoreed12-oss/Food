import { CONFIG } from '../server/config';

// Unified Cloudflare R2 Bucket Client for Veyrang Food Delivery
export interface R2UploadResult {
  success: boolean;
  key: string;
  cdnUrl: string;
  error?: string;
}

export class R2Client {
  private accountId: string;
  private apiToken: string;
  private authEmail: string;
  private bucketName: string;
  private publicCdnUrl: string;
  private workerUrl: string;

  constructor() {
    this.accountId = process.env.CLOUDFLARE_ACCOUNT_ID || CONFIG.CLOUDFLARE_ACCOUNT_ID || '';
    this.apiToken =
      process.env.CLOUDFLARE_R2_API_TOKEN ||
      CONFIG.CLOUDFLARE_R2_API_TOKEN ||
      process.env.CLOUDFLARE_API_TOKEN ||
      CONFIG.CLOUDFLARE_API_TOKEN ||
      '';
    this.authEmail =
      process.env.CLOUDFLARE_AUTH_EMAIL ||
      CONFIG.CLOUDFLARE_AUTH_EMAIL ||
      process.env.ADMIN_EMAIL ||
      CONFIG.ADMIN_EMAIL ||
      '';
    this.bucketName = process.env.CLOUDFLARE_R2_BUCKET || CONFIG.CLOUDFLARE_R2_BUCKET || '';
    this.publicCdnUrl = (process.env.CLOUDFLARE_R2_PUBLIC_URL || CONFIG.CLOUDFLARE_R2_PUBLIC_URL || '').replace(/\/$/, '');
    this.workerUrl = (process.env.CLOUDFLARE_WORKER_URL || CONFIG.CLOUDFLARE_WORKER_URL || '').replace(/\/$/, '');
  }

  public isConfigured(): boolean {
    const hasAccount = Boolean(this.accountId && !this.accountId.includes('veyrang_account'));
    const hasBucket = Boolean(this.bucketName && !this.bucketName.includes('veyrang_bucket'));
    const hasToken = Boolean(this.apiToken && !this.apiToken.includes('veyrang_token') && this.apiToken.length > 20);
    return hasAccount && hasBucket && hasToken;
  }

  public getDetails() {
    return {
      bucketName: this.bucketName,
      publicCdnUrl: this.publicCdnUrl,
      workerUrl: this.workerUrl,
      isConfigured: this.isConfigured(),
      engine: this.isConfigured() ? 'Cloudflare R2 Native Edge API' : 'Unconfigured'
    };
  }

  public getCdnUrl(key: string): string {
    const cleanKey = key.replace(/^\//, '');
    return `/api/storage/file/${cleanKey}`;
  }

  private getAuthHeaders(contentType?: string): Record<string, string> {
    const isKey = this.apiToken.startsWith('cfk_') || this.apiToken.length < 55;
    const headers: Record<string, string> = isKey
      ? {
          'X-Auth-Email': this.authEmail,
          'X-Auth-Key': this.apiToken,
        }
      : {
          Authorization: `Bearer ${this.apiToken}`,
        };
    if (contentType) {
      headers['Content-Type'] = contentType;
    }
    return headers;
  }

  private getDirectObjectUrl(cleanKey: string): string {
    return `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/r2/buckets/${this.bucketName}/objects/${cleanKey}`;
  }

  public async ping(): Promise<{ connected: boolean; latencyMs: number; error?: string }> {
    if (!this.isConfigured()) {
      return { connected: false, latencyMs: 0, error: 'Cloudflare R2 is not configured' };
    }
    const start = Date.now();
    try {
      const url = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/r2/buckets/${this.bucketName}`;
      const res = await fetch(url, { headers: this.getAuthHeaders(), cache: 'no-store' });
      const latencyMs = Math.max(1, Date.now() - start);
      if (res.ok) {
        return { connected: true, latencyMs };
      }
      return { connected: false, latencyMs, error: `Cloudflare R2 returned HTTP ${res.status}` };
    } catch (err: any) {
      return { connected: false, latencyMs: Date.now() - start, error: err?.message || String(err) };
    }
  }

  public async upload(key: string, dataBase64: string, contentType: string = 'image/jpeg'): Promise<R2UploadResult> {
    const cleanKey = key.replace(/^\//, '');
    const cdnUrl = this.getCdnUrl(cleanKey);

    if (!this.isConfigured()) {
      return {
        success: false,
        key: cleanKey,
        cdnUrl,
        error: 'Cloudflare R2 durable storage is not configured; missing credentials or bucket.'
      };
    }

    try {
      const binaryData = Buffer.from(dataBase64.replace(/^data:[^;]+;base64,/, ''), 'base64');
      const url = this.getDirectObjectUrl(cleanKey);
      const headers = this.getAuthHeaders(contentType);

      const res = await fetch(url, {
        method: 'PUT',
        headers,
        body: binaryData,
        cache: 'no-store'
      });

      if (res.ok) {
        return {
          success: true,
          key: cleanKey,
          cdnUrl
        };
      }

      const errText = await res.text().catch(() => '');
      return {
        success: false,
        key: cleanKey,
        cdnUrl,
        error: `Cloudflare R2 upload failed (HTTP ${res.status}): ${errText}`
      };
    } catch (err: any) {
      return {
        success: false,
        key: cleanKey,
        cdnUrl,
        error: `Cloudflare R2 upload network error: ${err?.message || err}`
      };
    }
  }

  public async getObject(key: string): Promise<{ data: Buffer; contentType: string } | null> {
    const cleanKey = key.replace(/^\//, '');
    if (!this.isConfigured()) return null;

    try {
      const url = this.getDirectObjectUrl(cleanKey);
      const headers = this.getAuthHeaders();

      const res = await fetch(url, {
        method: 'GET',
        headers,
        cache: 'no-store'
      });

      if (res.ok) {
        const arrayBuf = await res.arrayBuffer();
        const contentType = res.headers.get('content-type') || 'application/octet-stream';
        return { data: Buffer.from(arrayBuf), contentType };
      }
    } catch (err: any) {
      console.warn('[R2 GetObject]', err?.message || err);
    }

    return null;
  }

  public async uploadJson(key: string, data: any): Promise<R2UploadResult> {
    const jsonStr = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    const base64 = Buffer.from(jsonStr, 'utf-8').toString('base64');
    return this.upload(key, base64, 'application/json');
  }

  public async getJson<T = any>(key: string): Promise<T | null> {
    const obj = await this.getObject(key);
    if (!obj || !obj.data) return null;
    try {
      return JSON.parse(obj.data.toString('utf-8')) as T;
    } catch {
      return null;
    }
  }

  public async delete(key: string): Promise<{ success: boolean }> {
    const cleanKey = key.replace(/^\//, '');
    if (!cleanKey || cleanKey.split('/').some((part) => part === '..' || part === '.')) {
      return { success: false };
    }
    if (!this.isConfigured()) return { success: false };

    try {
      const url = this.getDirectObjectUrl(cleanKey);
      const headers = this.getAuthHeaders();
      const res = await fetch(url, {
        method: 'DELETE',
        headers,
        cache: 'no-store'
      });
      return { success: res.ok };
    } catch {
      return { success: false };
    }
  }
}

export const r2 = new R2Client();
