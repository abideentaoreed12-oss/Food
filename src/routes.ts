/**
 * Single source of truth for all application routes.
 * No file may hardcode route strings directly.
 */
export const ROUTES = {
  HOME: '/',
  RESTAURANTS: '/restaurants',
  RESTAURANT_DETAIL: (id: string) => `/restaurants/${encodeURIComponent(id)}`,
  SEARCH: '/search',
  OFFERS: '/offers',
  ORDERS: '/orders',
  CART: '/cart',
  FAVOURITES: '/favourites',
  ACCOUNT: '/account',
  HELP: '/help',
  CONTACT: '/contact',
  PARTNER: '/partner',
  TERMS: '/terms',
  PRIVACY: '/privacy',
  RESTAURANT_PORTAL: '/restaurant',
  COURIER_PORTAL: '/courier',
  ADMIN_PORTAL: '/admin',
  ADMIN_HERO: '/admin/hero',
  HANDOVER: (token: string) => `/handover/${encodeURIComponent(token)}`,
  PAYMENT_CALLBACK: '/payment/callback',
} as const;

export type AppRoute = typeof ROUTES[keyof typeof ROUTES];
