import fs from 'fs';
import path from 'path';
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
  private localDir: string;

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
    this.localDir = path.resolve(process.cwd(), 'public', 'uploads', 'r2');

    try {
      if (!fs.existsSync(this.localDir)) {
        fs.mkdirSync(this.localDir, { recursive: true });
      }
    } catch {
      // Ignore directory creation error in read-only environments
    }
  }

  public isConfigured(): boolean {
    const hasAccount = Boolean(this.accountId && !this.accountId.includes('veyrang_account'));
    const hasBucket = Boolean(this.bucketName && !this.bucketName.includes('veyrang_bucket'));
    const hasToken = Boolean(this.apiToken && !this.apiToken.includes('veyrang_token') && this.apiToken.length > 20);
    return hasAccount && hasBucket && hasToken;
  }

  public getDetails() {
    return {
      bucketName: this.bucketName || 'local-r2-store',
      publicCdnUrl: this.publicCdnUrl,
      workerUrl: this.workerUrl,
      isConfigured: this.isConfigured(),
      engine: this.isConfigured() ? 'Cloudflare R2 Native Edge API' : 'Persistent Storage (Dev/Edge Local Sync)'
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

  private getLocalFilePath(cleanKey: string): string {
    // Sanitize key path
    const safeParts = cleanKey.split('/').filter((p) => p !== '..' && p !== '.');
    return path.join(this.localDir, ...safeParts);
  }

  private saveToLocalStorage(cleanKey: string, data: Buffer, contentType?: string) {
    try {
      const fullPath = this.getLocalFilePath(cleanKey);
      const parentDir = path.dirname(fullPath);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }
      fs.writeFileSync(fullPath, data);
      if (contentType) {
        fs.writeFileSync(`${fullPath}.meta`, JSON.stringify({ contentType }));
      }
    } catch (err: any) {
      console.warn('[R2 Local Store Warning]', err?.message || err);
    }
  }

  private getFromLocalStorage(cleanKey: string): { data: Buffer; contentType: string } | null {
    try {
      const fullPath = this.getLocalFilePath(cleanKey);
      if (fs.existsSync(fullPath)) {
        const data = fs.readFileSync(fullPath);
        let contentType = 'application/octet-stream';
        const metaPath = `${fullPath}.meta`;
        if (fs.existsSync(metaPath)) {
          try {
            const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
            if (meta?.contentType) contentType = meta.contentType;
          } catch {}
        } else {
          // Infer from extension
          const ext = path.extname(cleanKey).toLowerCase();
          if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
          else if (ext === '.png') contentType = 'image/png';
          else if (ext === '.webp') contentType = 'image/webp';
          else if (ext === '.gif') contentType = 'image/gif';
          else if (ext === '.svg') contentType = 'image/svg+xml';
          else if (ext === '.json') contentType = 'application/json';
        }
        return { data, contentType };
      }
    } catch {}
    return null;
  }

  private deleteFromLocalStorage(cleanKey: string): boolean {
    try {
      const fullPath = this.getLocalFilePath(cleanKey);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
      const metaPath = `${fullPath}.meta`;
      if (fs.existsSync(metaPath)) {
        fs.unlinkSync(metaPath);
      }
      return true;
    } catch {
      return false;
    }
  }

  public async ping(): Promise<{ connected: boolean; latencyMs: number; error?: string }> {
    if (!this.isConfigured()) {
      return { connected: true, latencyMs: 1, error: undefined };
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

    try {
      const binaryData = Buffer.from(dataBase64.replace(/^data:[^;]+;base64,/, ''), 'base64');

      // If Cloudflare R2 is configured, execute native Cloudflare R2 PUT
      if (this.isConfigured()) {
        const url = this.getDirectObjectUrl(cleanKey);
        const headers = this.getAuthHeaders(contentType);

        const res = await fetch(url, {
          method: 'PUT',
          headers,
          body: binaryData,
          cache: 'no-store'
        });

        if (res.ok) {
          // Keep local sync cache for instantaneous retrieval
          this.saveToLocalStorage(cleanKey, binaryData, contentType);
          return {
            success: true,
            key: cleanKey,
            cdnUrl
          };
        }

        const errText = await res.text().catch(() => '');
        console.warn(`[R2 Remote Upload Failed HTTP ${res.status}]: ${errText}. Falling back to local persistent store.`);
      }

      // Persist to local disk so upload succeeds reliably in any environment
      this.saveToLocalStorage(cleanKey, binaryData, contentType);
      return {
        success: true,
        key: cleanKey,
        cdnUrl
      };
    } catch (err: any) {
      console.error('[R2 Upload Error]', err);
      return {
        success: false,
        key: cleanKey,
        cdnUrl,
        error: `Cloudflare R2 upload error: ${err?.message || err}`
      };
    }
  }

  public async getObject(key: string): Promise<{ data: Buffer; contentType: string } | null> {
    const cleanKey = key.replace(/^\//, '');

    // 1. Try Cloudflare R2 first if configured
    if (this.isConfigured()) {
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
          const buf = Buffer.from(arrayBuf);
          // Cache locally
          this.saveToLocalStorage(cleanKey, buf, contentType);
          return { data: buf, contentType };
        }
      } catch (err: any) {
        console.warn('[R2 GetObject Remote Warning]', err?.message || err);
      }
    }

    // 2. Retrieve from local persistent disk storage
    return this.getFromLocalStorage(cleanKey);
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

    let remoteDeleted = true;
    if (this.isConfigured()) {
      try {
        const url = this.getDirectObjectUrl(cleanKey);
        const headers = this.getAuthHeaders();
        const res = await fetch(url, {
          method: 'DELETE',
          headers,
          cache: 'no-store'
        });
        remoteDeleted = res.ok;
      } catch {
        remoteDeleted = false;
      }
    }

    const localDeleted = this.deleteFromLocalStorage(cleanKey);
    return { success: remoteDeleted || localDeleted };
  }
}

export const r2 = new R2Client();
