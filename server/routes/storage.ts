import { Router, Request, Response } from 'express';
import { CONFIG } from '../config.ts';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth.ts';

const router = Router();

// 0. Test R2 Bucket Connection & Permissions (Admin only)
router.get('/status', requireAuth, requireRole(['admin', 'sub_admin']), async (_req: AuthRequest, res: Response) => {
  try {
    const url = `https://api.cloudflare.com/client/v4/accounts/${CONFIG.CLOUDFLARE_ACCOUNT_ID}/r2/buckets/${CONFIG.CLOUDFLARE_R2_BUCKET}`;
    const checkRes = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${CONFIG.CLOUDFLARE_API_TOKEN}`
      }
    });
    const data = (await checkRes.json().catch(() => null)) as any;
    const isOk = checkRes.ok && data?.success;

    return res.json({
      success: !!isOk,
      bucket: CONFIG.CLOUDFLARE_R2_BUCKET,
      accountId: CONFIG.CLOUDFLARE_ACCOUNT_ID,
      publicUrlConfigured: !!CONFIG.CLOUDFLARE_R2_PUBLIC_URL,
      details: data?.result || null,
      error: !isOk ? (data?.errors?.[0]?.message || `HTTP status ${checkRes.status}`) : null
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 1. Upload Asset directly to Cloudflare R2 Bucket (veyrang-production-storage)
router.post('/upload', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { key, contentType, dataBase64 } = req.body;
    if (!key || typeof key !== 'string' || !dataBase64 || typeof dataBase64 !== 'string') {
      return res.status(400).json({ success: false, error: 'Key and dataBase64 are required' });
    }

    // Clean key and sanitize
    const sanitizedKey = key.replace(/[^a-zA-Z0-9_\-\.\/]/g, '').replace(/^\/+/, '');
    if (!sanitizedKey || sanitizedKey.split('/').some((part: string) => !part || part === '.' || part === '..')) {
      return res.status(400).json({ success: false, error: 'A valid storage key is required' });
    }
    const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']);
    const mime = typeof contentType === 'string' ? contentType.toLowerCase() : '';
    if (!allowedMimeTypes.has(mime)) {
      return res.status(415).json({ success: false, error: 'Unsupported image type. Use JPEG, PNG, WebP, GIF, or AVIF.' });
    }
    const encoded = dataBase64.replace(/^data:[^;]+;base64,/, '');
    if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) {
      return res.status(400).json({ success: false, error: 'Image data is not valid base64' });
    }
    const buffer = Buffer.from(encoded, 'base64');
    const maxBytes = 10 * 1024 * 1024;
    if (buffer.length === 0 || buffer.length > maxBytes) {
      return res.status(413).json({ success: false, error: 'Image must be greater than 0 bytes and no larger than 10 MB' });
    }
    const expectedMagic: Record<string, (b: Buffer) => boolean> = {
      'image/jpeg': (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
      'image/png': (b) => b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
      'image/webp': (b) => b.length >= 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP',
      'image/gif': (b) => b.length >= 6 && ['GIF87a', 'GIF89a'].includes(b.toString('ascii', 0, 6)),
      'image/avif': (b) => b.length >= 12 && b.toString('ascii', 4, 8) === 'ftyp' && /avif|avis/.test(b.toString('ascii', 8, 16))
    };
    if (!expectedMagic[mime](buffer)) return res.status(415).json({ success: false, error: 'Image content does not match the declared image type' });

    // PUT to Cloudflare R2 REST API
    const r2Url = `https://api.cloudflare.com/client/v4/accounts/${CONFIG.CLOUDFLARE_ACCOUNT_ID}/r2/buckets/${CONFIG.CLOUDFLARE_R2_BUCKET}/objects/${sanitizedKey}`;
    const uploadRes = await fetch(r2Url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${CONFIG.CLOUDFLARE_API_TOKEN}`,
        'Content-Type': mime
      },
      body: buffer
    });

    const result = (await uploadRes.json().catch(() => null)) as any;
    if (!uploadRes.ok || !result?.success) {
      return res.status(502).json({
        success: false,
        error: result?.errors?.[0]?.message || 'Failed to upload asset to Cloudflare R2'
      });
    }

    // Form direct Edge CDN or Custom Domain URL
    const publicBase = CONFIG.CLOUDFLARE_R2_PUBLIC_URL || CONFIG.CLOUDFLARE_WORKER_URL;
    if (!publicBase) {
      return res.status(503).json({ success: false, error: 'Public image delivery is not configured' });
    }
    const cdnUrl = CONFIG.CLOUDFLARE_R2_PUBLIC_URL
      ? `${CONFIG.CLOUDFLARE_R2_PUBLIC_URL.replace(/\/+$/, '')}/${sanitizedKey.split('/').map(encodeURIComponent).join('/')}`
      : `${CONFIG.CLOUDFLARE_WORKER_URL.replace(/\/+$/, '')}/cdn/${sanitizedKey.split('/').map(encodeURIComponent).join('/')}`;

    return res.json({
      success: true,
      data: {
        key: sanitizedKey,
        bucket: CONFIG.CLOUDFLARE_R2_BUCKET,
        cdnUrl,
        sizeBytes: buffer.length,
        contentType: mime,
        uploadedAt: new Date().toISOString()
      }
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 2. Stream or Redirect to Edge CDN
router.get('/file/:key(*)', async (req: Request, res: Response) => {
  try {
    const key = req.params.key;
    if (!key) {
      return res.status(400).json({ success: false, error: 'Key is required' });
    }

    const sanitizedKey = key.replace(/[^a-zA-Z0-9_\-\.\/]/g, '').replace(/^\/+/, '');
    if (!sanitizedKey || sanitizedKey.split('/').some((part: string) => !part || part === '.' || part === '..')) {
      return res.status(400).json({ success: false, error: 'A valid storage key is required' });
    }
    if (!CONFIG.CLOUDFLARE_WORKER_URL) return res.status(503).json({ success: false, error: 'Image delivery is not configured' });
    const cdnUrl = `${CONFIG.CLOUDFLARE_WORKER_URL.replace(/\/+$/, '')}/cdn/${sanitizedKey.split('/').map(encodeURIComponent).join('/')}`;
    return res.redirect(cdnUrl);
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 3. Delete Asset directly from Cloudflare R2 Bucket
router.delete('/file/:key(*)', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const key = req.params.key;
    if (!key) {
      return res.status(400).json({ success: false, error: 'Key is required' });
    }

    const sanitizedKey = key.replace(/[^a-zA-Z0-9_\-\.\/]/g, '').replace(/^\/+/, '');
    const r2Url = `https://api.cloudflare.com/client/v4/accounts/${CONFIG.CLOUDFLARE_ACCOUNT_ID}/r2/buckets/${CONFIG.CLOUDFLARE_R2_BUCKET}/objects/${sanitizedKey}`;

    const delRes = await fetch(r2Url, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${CONFIG.CLOUDFLARE_API_TOKEN}`
      }
    });

    const result = await delRes.json().catch(() => null) as any;
    if (!delRes.ok || result?.success !== true) {
      return res.status(502).json({ success: false, error: result?.errors?.[0]?.message || `Cloudflare R2 deletion failed with HTTP ${delRes.status}` });
    }
    return res.json({ success: true, message: `File ${sanitizedKey} deleted from Cloudflare R2 bucket` });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;

