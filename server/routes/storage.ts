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
    const { key, contentType, dataBase64, filename } = req.body;
    if (!key || !dataBase64) {
      return res.status(400).json({ success: false, error: 'Key and dataBase64 are required' });
    }

    // Clean key and sanitize
    const sanitizedKey = key.replace(/[^a-zA-Z0-9_\-\.\/]/g, '').replace(/^\/+/, '');
    const mime = contentType || 'image/jpeg';
    const buffer = Buffer.from(dataBase64.replace(/^data:[^;]+;base64,/, ''), 'base64');

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
    const cdnUrl = CONFIG.CLOUDFLARE_R2_PUBLIC_URL
      ? `${CONFIG.CLOUDFLARE_R2_PUBLIC_URL.replace(/\/+$/, '')}/${sanitizedKey}`
      : `${CONFIG.CLOUDFLARE_WORKER_URL}/cdn/${sanitizedKey}`;

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

    const cdnUrl = `${CONFIG.CLOUDFLARE_WORKER_URL}/cdn/${key}`;
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

    const result = await delRes.json().catch(() => null);
    return res.json({
      success: true,
      message: `File ${sanitizedKey} deleted from Cloudflare R2 bucket`,
      r2Response: result
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;

