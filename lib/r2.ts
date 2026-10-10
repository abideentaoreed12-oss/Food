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
  private bucketName: string;
  private publicCdnUrl: string;
  private workerUrl: string;

  constructor() {
    this.accountId = process.env.CLOUDFLARE_ACCOUNT_ID || CONFIG.CLOUDFLARE_ACCOUNT_ID;
    this.apiToken = process.env.CLOUDFLARE_API_TOKEN || CONFIG.CLOUDFLARE_API_TOKEN;
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

    // Strategy 1: Cloudflare Worker R2 proxy upload endpoint
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
            headers: { 'Content-Type': 'application/json' },
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
        } catch {}
      }
    }

    // Strategy 2: Direct Cloudflare API R2 storage REST PUT request
    if (this.accountId && this.apiToken && this.bucketName) {
      try {
        const directR2Url = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/r2/buckets/${this.bucketName}/objects/${cleanKey}`;
        const binaryData = Buffer.from(dataBase64.replace(/^data:[^;]+;base64,/, ''), 'base64');
        const authEmail = process.env.CLOUDFLARE_AUTH_EMAIL || CONFIG.CLOUDFLARE_AUTH_EMAIL || 'abideentaoreed12@gmail.com';
        const isKey = this.apiToken.startsWith('cfk_') || this.apiToken.length < 55;

        const headers: Record<string, string> = isKey
          ? {
              'X-Auth-Email': authEmail,
              'X-Auth-Key': this.apiToken,
              'Content-Type': contentType
            }
          : {
              'Authorization': `Bearer ${this.apiToken}`,
              'Content-Type': contentType
            };

        const res = await fetch(directR2Url, {
          method: 'PUT',
          headers,
          body: binaryData,
          cache: 'no-store'
        });

        if (res.ok) {
          const resJson = await res.json().catch(() => ({}));
          if (resJson.success !== false) {
            return {
              success: true,
              key: cleanKey,
              cdnUrl: `/api/storage/file/${cleanKey}`
            };
          }
        }
      } catch (err: any) {
        console.warn('[R2 Direct Upload Exception]', err?.message || err);
      }
    }

    // Return failure when R2 is not configured or direct upload fails
    return {
      success: false,
      key: cleanKey,
      cdnUrl,
      error: 'R2 storage is not configured or upload failed.'
    };
  }

  public async getObject(key: string): Promise<{ data: Buffer; contentType: string } | null> {
    const cleanKey = key.replace(/^\//, '');
    if (!this.accountId || !this.apiToken || !this.bucketName) return null;
    try {
      const directR2Url = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/r2/buckets/${this.bucketName}/objects/${cleanKey}`;
      const authEmail = process.env.CLOUDFLARE_AUTH_EMAIL || CONFIG.CLOUDFLARE_AUTH_EMAIL || 'abideentaoreed12@gmail.com';
      const isKey = this.apiToken.startsWith('cfk_') || this.apiToken.length < 55;
      const headers: Record<string, string> = isKey
        ? { 'X-Auth-Email': authEmail, 'X-Auth-Key': this.apiToken }
        : { 'Authorization': `Bearer ${this.apiToken}` };

      const res = await fetch(directR2Url, { method: 'GET', headers, cache: 'no-store' });
      if (!res.ok) return null;
      const arrayBuf = await res.arrayBuffer();
      const contentType = res.headers.get('content-type') || 'application/octet-stream';
      return { data: Buffer.from(arrayBuf), contentType };
    } catch {
      return null;
    }
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
    if (this.accountId && this.apiToken && this.bucketName) {
      try {
        const directR2Url = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/r2/buckets/${this.bucketName}/objects/${cleanKey}`;
        const authEmail = process.env.CLOUDFLARE_AUTH_EMAIL || CONFIG.CLOUDFLARE_AUTH_EMAIL || 'abideentaoreed12@gmail.com';
        const isKey = this.apiToken.startsWith('cfk_') || this.apiToken.length < 55;
        const headers: Record<string, string> = isKey
          ? { 'X-Auth-Email': authEmail, 'X-Auth-Key': this.apiToken }
          : { 'Authorization': `Bearer ${this.apiToken}` };

        await fetch(directR2Url, { method: 'DELETE', headers, cache: 'no-store' });
      } catch {}
    }
    return { success: true };
  }
}

export const r2 = new R2Client();
