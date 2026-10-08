import type { Currency, DeliveryZone } from '../types/index.ts';

export const USD_TO_NGN_RATE = 1500;

export function formatCurrency(amount: number | string | undefined | null, currency: Currency = 'NGN'): string {
  const numeric = typeof amount === 'number' ? amount : Number(amount);
  const safeAmount = isNaN(numeric) ? 0 : numeric;
  if (currency === 'USD') {
    return `$${safeAmount.toFixed(2)}`;
  }
  return `₦${Math.round(safeAmount).toLocaleString('en-NG')}`;
}

export function getUserVirtualAccount(user: any) {
  if (!user) {
    return {
      accountNumberFormatted: '9942 018 274',
      accountNumberRaw: '9942018274',
      bankName: 'Dedicated Virtual Bank'
    };
  }
  const cleanDigits = (user.phone || user.id || '1029384756').replace(/[^0-9]/g, '');
  const base = cleanDigits.length >= 8 ? cleanDigits.slice(-8) : String(cleanDigits + '10293847').slice(0, 8);
  const raw = `99${base}`;
  const formatted = `${raw.slice(0, 4)} ${raw.slice(4, 7)} ${raw.slice(7, 10)}`;
  return {
    accountNumberFormatted: formatted,
    accountNumberRaw: raw,
    bankName: 'Dedicated Virtual Bank'
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

export const DELIVERY_ZONES: ZoneConfig[] = [
  {
    id: 'DOWNTOWN',
    name: 'Downtown Core',
    city: 'Metropolitan Area',
    defaultCurrency: 'NGN',
    deliveryFee: 500,
    averageSpeedMin: 25
  },
  {
    id: 'MIDTOWN',
    name: 'Midtown District',
    city: 'Metropolitan Area',
    defaultCurrency: 'NGN',
    deliveryFee: 600,
    averageSpeedMin: 30
  },
  {
    id: 'UPTOWN',
    name: 'Uptown Heights',
    city: 'Metropolitan Area',
    defaultCurrency: 'NGN',
    deliveryFee: 700,
    averageSpeedMin: 28
  },
  {
    id: 'TECH_HUB',
    name: 'Innovation Hub',
    city: 'Metropolitan Area',
    defaultCurrency: 'NGN',
    deliveryFee: 650,
    averageSpeedMin: 32
  },
  {
    id: 'SUBURB',
    name: 'Suburban Residences',
    city: 'Metropolitan Area',
    defaultCurrency: 'NGN',
    deliveryFee: 800,
    averageSpeedMin: 35
  }
];

export const VALID_PROMO_CODES: Record<string, { discountPercent?: number; flatDiscountNGN?: number; minOrderNGN: number; description: string }> = {
  'WELCOME500': { flatDiscountNGN: 500, minOrderNGN: 1000, description: '₦500 off your first order' },
  'QUICK10': { discountPercent: 10, minOrderNGN: 2000, description: '10% off any meal' },
  'FREEDEL': { flatDiscountNGN: 500, minOrderNGN: 1500, description: 'Free delivery voucher' }
};

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

