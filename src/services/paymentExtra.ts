/** Extra payment helpers (virtual account) — no hardcoded account numbers */

export async function fetchVirtualAccount(): Promise<{
  accountNumber: string;
  bankName: string;
  accountName: string;
} | null> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('veyrang_jwt_token') : null;
  const res = await fetch('/api/payment/virtual-account', {
    credentials: 'include',
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to load virtual account');
  }
  const json = await res.json();
  return json.data || null;
}

export async function createVirtualAccount(): Promise<{
  accountNumber: string;
  bankName: string;
  accountName: string;
}> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('veyrang_jwt_token') : null;
  const res = await fetch('/api/payment/virtual-account', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: '{}'
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) {
    throw new Error(json.error || 'Could not create Paystack virtual account');
  }
  return json.data;
}
