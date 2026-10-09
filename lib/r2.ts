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
    this.apiToken = process.env.CLOUDFLARE_R2_API_TOKEN || CONFIG.CLOUDFLARE_R2_API_TOKEN;
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
    const baseUrl = this.publicCdnUrl || (this.workerUrl ? `${this.workerUrl}/cdn` : '');
    if (!baseUrl) return '';
    return `${baseUrl}/${cleanKey.split('/').map(encodeURIComponent).join('/')}`;
  }

  public async upload(key: string, dataBase64: string, contentType: string = 'image/jpeg'): Promise<R2UploadResult> {
    const cleanKey = key.replace(/^\//, '');
    const cdnUrl = this.getCdnUrl(cleanKey);
    if (!this.isConfigured()) return { success: false, key: cleanKey, cdnUrl, error: 'R2 credentials or bucket configuration are missing.' };
    if (!cdnUrl && !this.workerUrl) return { success: false, key: cleanKey, cdnUrl, error: 'R2 public delivery URL is not configured.' };

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
        const encodedKey = cleanKey.split('/').map(encodeURIComponent).join('/');
        const directR2Url = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/r2/buckets/${this.bucketName}/objects/${encodedKey}`;
        const binaryData = Buffer.from(dataBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64');

        const res = await fetch(directR2Url, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': contentType
          },
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

  public async delete(key: string): Promise<{ success: boolean; error?: string }> {
    const cleanKey = key.replace(/^\/+/, '');
    if (!cleanKey || cleanKey.split('/').some(part => !part || part === '.' || part === '..')) {
      return { success: false, error: 'Invalid R2 object key.' };
    }

    // Try the configured Worker first, but never report success unless it confirms success.
    if (this.workerUrl) {
      try {
        const response = await fetch(`${this.workerUrl}/storage/file/${cleanKey.split('/').map(encodeURIComponent).join('/')}`, {
          method: 'DELETE',
          cache: 'no-store'
        });
        if (response.ok) {
          const result = await response.json().catch(() => null) as any;
          if (result?.success === true) return { success: true };
        }
      } catch {
        // Fall through to the direct R2 API.
      }
    }

    if (!this.accountId || !this.apiToken || !this.bucketName) {
      return { success: false, error: 'R2 account, bucket, or scoped API token is not configured.' };
    }
    try {
      const url = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/r2/buckets/${this.bucketName}/objects/${cleanKey.split('/').map(encodeURIComponent).join('/')}`;
      const response = await fetch(url, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${this.apiToken}` },
        cache: 'no-store'
      });
      const result = await response.json().catch(() => null) as any;
      if (!response.ok || result?.success !== true) {
        return { success: false, error: result?.errors?.[0]?.message || `Cloudflare R2 deletion failed (HTTP ${response.status}).` };
      }
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error?.message || 'Cloudflare R2 deletion failed.' };
    }
  }
}

export const r2 = new R2Client();
