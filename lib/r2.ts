import { CONFIG } from '../server/config';

// Unified Cloudflare R2 Bucket Client for Veyrang Food Delivery
export interface R2UploadResult {
  success: boolean;
  key: string;
  cdnUrl: string;
  error?: string;
}

// In-memory mock store for environments without configured external R2 storage
const inMemoryStore = new Map<string, { data: Buffer; contentType: string }>();

export class R2Client {
  private accountId: string;
  private apiToken: string;
  private bucketName: string;
  private publicCdnUrl: string;
  private workerUrl: string;

  constructor() {
    this.accountId = process.env.CLOUDFLARE_ACCOUNT_ID || CONFIG.CLOUDFLARE_ACCOUNT_ID;
    this.apiToken = process.env.CLOUDFLARE_R2_API_TOKEN || CONFIG.CLOUDFLARE_R2_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN || CONFIG.CLOUDFLARE_API_TOKEN;
    this.bucketName = process.env.CLOUDFLARE_R2_BUCKET || CONFIG.CLOUDFLARE_R2_BUCKET;
    this.publicCdnUrl = (process.env.CLOUDFLARE_R2_PUBLIC_URL || CONFIG.CLOUDFLARE_R2_PUBLIC_URL || '').replace(/\/$/, '');
    this.workerUrl = (process.env.CLOUDFLARE_WORKER_URL || CONFIG.CLOUDFLARE_WORKER_URL || '').replace(/\/$/, '');
  }

  public isConfigured(): boolean {
    return Boolean(this.bucketName && (this.apiToken || this.workerUrl));
  }

  public getDetails() {
    return {
      bucketName: this.bucketName,
      publicCdnUrl: this.publicCdnUrl,
      workerUrl: this.workerUrl,
      isConfigured: this.isConfigured()
    };
  }

  public getCdnUrl(key: string): string {
    const cleanKey = key.replace(/^\//, '');
    return `${this.publicCdnUrl}/${cleanKey}`;
  }

  public async upload(key: string, dataBase64: string, contentType: string = 'image/jpeg'): Promise<R2UploadResult> {
    const cleanKey = key.replace(/^\//, '');
    const cdnUrl = this.getCdnUrl(cleanKey);

    // Strategy 1: Cloudflare Worker R2 proxy upload endpoint (Authoritative R2 bridge in Cloudflare architecture)
    if (this.workerUrl) {
      const workerUploadEndpoints = [
        `${this.workerUrl}/storage/upload`,
        `${this.workerUrl}/upload`,
        `${this.workerUrl}/api/storage/upload`
      ];

      for (const endpoint of workerUploadEndpoints) {
        try {
          const res = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(this.apiToken ? { Authorization: `Bearer ${this.apiToken}` } : {})
            },
            body: JSON.stringify({ key: cleanKey, dataBase64, contentType, bucket: this.bucketName }),
            cache: 'no-store'
          });

          if (res.ok) {
            const json = await res.json().catch(() => ({}));
            if (json.cdnUrl || json.url || json.success) {
              return {
                success: true,
                key: cleanKey,
                cdnUrl: json.cdnUrl || json.url || cdnUrl
              };
            }
          }
        } catch (err: any) {
          console.warn('[R2 Worker Upload Notice]', err?.message || err);
        }
      }
    }

    // In production, do not falsely report durable persistence if Cloudflare R2 worker/storage is unavailable
    if (process.env.NODE_ENV === 'production') {
      return {
        success: false,
        key: cleanKey,
        cdnUrl,
        error: 'Cloudflare R2 durable storage is not configured or worker endpoint is unreachable.'
      };
    }

    // Development & Test Environment fallback (clearly identified as local non-durable)
    try {
      const binaryData = Buffer.from(dataBase64.replace(/^data:[^;]+;base64,/, ''), 'base64');
      inMemoryStore.set(cleanKey, { data: binaryData, contentType });
      return {
        success: true,
        key: cleanKey,
        cdnUrl: `/api/storage/file/${cleanKey}`
      };
    } catch {
      return {
        success: false,
        key: cleanKey,
        cdnUrl,
        error: 'In-memory test storage failed to buffer file.'
      };
    }
  }

  public async getObject(key: string): Promise<{ data: Buffer; contentType: string } | null> {
    const cleanKey = key.replace(/^\//, '');
    if (process.env.NODE_ENV !== 'production' && inMemoryStore.has(cleanKey)) {
      return inMemoryStore.get(cleanKey)!;
    }

    // Try Worker endpoint
    if (this.workerUrl) {
      const endpoints = [
        `${this.workerUrl}/storage/file/${encodeURIComponent(cleanKey)}`,
        `${this.workerUrl}/${cleanKey}`
      ];
      for (const ep of endpoints) {
        try {
          const res = await fetch(ep, {
            method: 'GET',
            headers: this.apiToken ? { Authorization: `Bearer ${this.apiToken}` } : {},
            cache: 'no-store'
          });
          if (res.ok) {
            const arrayBuf = await res.arrayBuffer();
            const contentType = res.headers.get('content-type') || 'application/octet-stream';
            return { data: Buffer.from(arrayBuf), contentType };
          }
        } catch {}
      }
    }

    // Try public CDN endpoint if configured
    if (this.publicCdnUrl) {
      try {
        const res = await fetch(`${this.publicCdnUrl}/${cleanKey}`, { method: 'GET', cache: 'no-store' });
        if (res.ok) {
          const arrayBuf = await res.arrayBuffer();
          const contentType = res.headers.get('content-type') || 'application/octet-stream';
          return { data: Buffer.from(arrayBuf), contentType };
        }
      } catch {}
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
    inMemoryStore.delete(cleanKey);

    if (this.workerUrl) {
      try {
        await fetch(`${this.workerUrl}/storage/file/${encodeURIComponent(cleanKey)}`, {
          method: 'DELETE',
          headers: this.apiToken ? { Authorization: `Bearer ${this.apiToken}` } : {},
          cache: 'no-store'
        });
      } catch {}
    }
    return { success: true };
  }
}

export const r2 = new R2Client();
