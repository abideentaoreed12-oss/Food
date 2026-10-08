import type { Currency } from '../types/index.ts';

export const USD_TO_NGN_RATE = 1500;

export function formatCurrency(amount: number | string | undefined | null, currency: Currency = 'NGN'): string {
  const numeric = typeof amount === 'number' ? amount : Number(amount);
  const safeAmount = isNaN(numeric) ? 0 : numeric;
  if (currency === 'USD') {
    return `$${safeAmount.toFixed(2)}`;
  }
  return `₦${Math.round(safeAmount).toLocaleString('en-NG')}`;
}

/** Only return a virtual account when real fields exist (from Paystack / D1). Never invent numbers. */
export function getUserVirtualAccount(user: any) {
  if (!user) return null;

  const rawNum = user.virtualAccountNumber || user.virtual_account_number;
  const bank = user.virtualBankName || user.virtual_bank_name;
  if (!rawNum || !bank) return null;

  const raw = String(rawNum).replace(/[^0-9]/g, '');
  const formatted =
    raw.length === 10 ? `${raw.slice(0, 4)} ${raw.slice(4, 7)} ${raw.slice(7, 10)}` : raw;

  return {
    accountNumberFormatted: formatted,
    accountNumberRaw: raw,
    bankName: String(bank),
    accountName:
      user.virtualAccountName ||
      user.virtual_account_name ||
      `VeyraNG / ${user.name || user.email?.split('@')[0] || 'Customer'}`
  };
}

export interface ZoneConfig {
  id: string;
  name: string;
  city: string;
  defaultCurrency: Currency;
  deliveryFee: number;
  averageSpeedMin: number;
}

/** Deprecated local list — zones must come from D1 via deliveryService / admin API */
export const DELIVERY_ZONES: ZoneConfig[] = [];

export const VALID_PROMO_CODES: Record<
  string,
  { discountPercent?: number; flatDiscountNGN?: number; minOrderNGN: number; description: string }
> = {};

export function formatOrderTime(dateInput?: string | number | Date | null): string {
  if (!dateInput) return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return String(dateInput);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (isToday) return `Today, ${timeStr}`;
    return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${timeStr}`;
  } catch {
    return String(dateInput);
  }
}

export function formatOrderDate(dateInput?: string | number | Date | null): string {
  if (!dateInput) return new Date().toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return String(dateInput);
    return d.toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return String(dateInput);
  }
}
