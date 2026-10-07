import { Currency, DeliveryZone } from '../types';

export const USD_TO_NGN_RATE = 1500;

export function formatCurrency(amount: number | string | undefined | null, currency: Currency = 'NGN'): string {
  const numeric = typeof amount === 'number' ? amount : Number(amount);
  const safeAmount = isNaN(numeric) ? 0 : numeric;
  if (currency === 'USD') {
    return `$${safeAmount.toFixed(2)}`;
  }
  return `₦${Math.round(safeAmount).toLocaleString('en-NG')}`;
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
