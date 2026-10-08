import { NextRequest, NextResponse } from 'next/server';
import { d1Client } from '../../../../server/db/d1Client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getBearerUserId(req: NextRequest): string | null {
  const auth = req.headers.get('authorization') || '';
  if (!auth.startsWith('Bearer ')) return null;
  try {
    const token = auth.slice(7);
    const payload = JSON.parse(
      Buffer.from(token.split('.')[1] || '', 'base64url').toString('utf8')
    );
    return payload?.id || null;
  } catch {
    return null;
  }
}

async function loadVa(userId: string) {
  const res = await d1Client
    .query(
      `SELECT account_number, bank_name, account_name
       FROM user_virtual_accounts
       WHERE user_id = ? AND is_active = 1
       LIMIT 1`,
      [userId]
    )
    .catch(() => ({ results: [] as any[] }));
  const row = res.results?.[0];
  if (!row?.account_number || !row?.bank_name) return null;
  return {
    accountNumber: String(row.account_number),
    bankName: String(row.bank_name),
    accountName: String(row.account_name || '')
  };
}

async function resolveUser(req: NextRequest) {
  const userId = getBearerUserId(req);
  if (!userId) return null;
  const u = await d1Client
    .query('SELECT id, email, name, phone FROM users WHERE id = ? LIMIT 1', [userId])
    .catch(() => ({ results: [] as any[] }));
  return u.results?.[0] || null;
}

export async function GET(req: NextRequest) {
  try {
    const user = await resolveUser(req);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }
    const va = await loadVa(user.id);
    if (!va) {
      return NextResponse.json(
        { success: false, error: 'No virtual account yet', data: null },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, data: va });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to load virtual account' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await resolveUser(req);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const existing = await loadVa(user.id);
    if (existing) {
      return NextResponse.json({ success: true, data: existing });
    }

    const secret =
      process.env.PAYSTACK_SECRET_KEY || process.env.PAYMENT_SECRET_KEY || '';
    if (!secret) {
      return NextResponse.json(
        { success: false, error: 'Payment gateway not configured' },
        { status: 503 }
      );
    }

    const customerRes = await fetch('https://api.paystack.co/customer', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: user.email,
        first_name: String(user.name || 'Customer').split(' ')[0],
        last_name:
          String(user.name || 'User').split(' ').slice(1).join(' ') || 'VeyraNG',
        phone: user.phone || undefined
      })
    });
    const customerJson: any = await customerRes.json().catch(() => ({}));
    let customerCode = customerJson?.data?.customer_code as string | undefined;
    if (!customerCode) {
      const getCust = await fetch(
        `https://api.paystack.co/customer/${encodeURIComponent(user.email)}`,
        { headers: { Authorization: `Bearer ${secret}` } }
      );
      const getJson: any = await getCust.json().catch(() => ({}));
      customerCode = getJson?.data?.customer_code;
    }
    if (!customerCode) {
      return NextResponse.json(
        {
          success: false,
          error: customerJson?.message || 'Could not create Paystack customer'
        },
        { status: 400 }
      );
    }

    const preferredBank = process.env.PAYSTACK_DVA_BANK || 'wema-bank';
    const dvaRes = await fetch('https://api.paystack.co/dedicated_account', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        customer: customerCode,
        preferred_bank: preferredBank
      })
    });
    const dvaJson: any = await dvaRes.json().catch(() => ({}));
    if (!dvaRes.ok || !dvaJson?.status || !dvaJson?.data?.account_number) {
      return NextResponse.json(
        {
          success: false,
          error:
            dvaJson?.message ||
            'Dedicated virtual account not available. Enable DVA on Paystack or use Online Payment.'
        },
        { status: 400 }
      );
    }

    const accountNumber = String(dvaJson.data.account_number);
    const bankName = dvaJson.data.bank?.name || 'Wema Bank';
    const accountName =
      dvaJson.data.account_name || `VeyraNG / ${user.name || 'Customer'}`;
    const dedicatedId =
      dvaJson.data.id != null ? String(dvaJson.data.id) : null;
    const nowIso = new Date().toISOString();
    const rowId = `uva-${user.id}`;

    await d1Client.query(
      `INSERT INTO user_virtual_accounts (
         id, user_id, account_number, bank_name, account_name, provider,
         provider_customer_code, provider_dedicated_id, is_active, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, 'paystack', ?, ?, 1, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         account_number = excluded.account_number,
         bank_name = excluded.bank_name,
         account_name = excluded.account_name,
         provider_customer_code = excluded.provider_customer_code,
         provider_dedicated_id = excluded.provider_dedicated_id,
         is_active = 1,
         updated_at = excluded.updated_at`,
      [
        rowId,
        user.id,
        accountNumber,
        bankName,
        accountName,
        customerCode,
        dedicatedId,
        nowIso,
        nowIso
      ]
    );

    await d1Client
      .query(
        `UPDATE users SET virtual_account_number = ?, virtual_bank_name = ?, virtual_account_name = ?, updated_at = ? WHERE id = ?`,
        [accountNumber, bankName, accountName, nowIso, user.id]
      )
      .catch(() => {});

    return NextResponse.json({
      success: true,
      data: { accountNumber, bankName, accountName }
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Virtual account error' },
      { status: 500 }
    );
  }
}
