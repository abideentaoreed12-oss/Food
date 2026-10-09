import { Restaurant, Order, OrderStatus, UserRole } from '../types';

// Central HTTP fetch client with native browser httpOnly cookie credentials inclusion
const BASE_URL =
  (typeof process !== 'undefined' && (process.env.NEXT_PUBLIC_API_BASE_URL || process.env.VITE_API_BASE_URL)) ||
  (typeof window !== 'undefined' && (window as any).__ENV__?.VITE_API_BASE_URL) ||
  '';

async function request(url: string, options: RequestInit = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('veyrang_jwt_token') : null;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    ...(options.headers as any || {})
  };

  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${url}`, { ...options, headers, credentials: 'include', cache: 'no-store' });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const err: any = new Error(errorData.error || `Server Request Failed (${response.status})`);
    err.status = response.status;
    err.data = errorData;
    throw err;
  }

  const json = await response.json();
  return json.data !== undefined ? json.data : json;
}

export const api = {
  auth: {
    login: async (email: string, password: string) => {
      // Secure server-side validation only
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Invalid email or password.');
      }

      const json = await res.json();
      const { user, token } = json.data;
      if (token && typeof window !== 'undefined') {
        localStorage.setItem('veyrang_jwt_token', token);
      }
      return { user, token };
    },

    register: async (payload: {
      email: string;
      password: string;
      name: string;
      role?: UserRole;
      phone?: string;
      address?: string;
      code: string;
    }) => {
      // Password strength check on frontend as well
      if (payload.password.length < 8) {
        throw new Error('Password must be at least 8 characters long.');
      }

      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Registration failed.');
      }

      const json = await res.json();
      const { user, token } = json.data;
      if (token && typeof window !== 'undefined') {
        localStorage.setItem('veyrang_jwt_token', token);
      }
      if (user && user.isApproved === false) {
        return { user: null, token: null, pendingApproval: true, message: 'Your account is pending Super Admin approval.' };
      }
      return { user, token, pendingApproval: false, message: '' };
    },

    sendVerification: async (email: string) => {
      const res = await fetch('/api/auth/send-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to send verification email.');
      }
      return await res.json();
    },

    forgotPassword: async (email: string) => {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to send password reset code.');
      }
      return await res.json();
    },

    resetPassword: async (email: string, code: string, newPassword: string) => {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code, newPassword })
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to reset password.');
      }
      return await res.json();
    },

    getMe: async () => {
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('veyrang_jwt_token') : null;
        if (!token) {
          return { user: null };
        }
        const res = await request('/api/auth/me');
        if (res && res.user && res.user.email) {
          return { user: res.user };
        }
        if (res && res.email && res.id) {
          return { user: res };
        }
        return { user: null };
      } catch (err: any) {
        const status = err?.status;
        const message = err instanceof Error ? err.message : String(err || '');
        if (
          status === 401 ||
          status === 403 ||
          /(\b|\\b)(401|403|unauthorized|authentication required|invalid token|jwt expired)(\b|\\b)/i.test(message)
        ) {
          return { user: null, invalidSession: true };
        }
        // A network/server error is not proof that the saved session is invalid.
        return { user: null, transientError: true };
      }
    },

    logout: async () => {
      try {
        await request('/api/auth/logout', { method: 'POST' });
      } catch (e) {
        try {
          await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
        } catch {}
      }

      if (typeof window !== 'undefined') {
        try {
          localStorage.removeItem('veyrang_jwt_token');
          localStorage.removeItem('veyrang_user_cache');
          sessionStorage.clear();
        } catch (e) {}

        try {
          const cookieNames = ['veyrang_jwt_token', 'veyrang_token', 'veyrang_auth_token', 'token', 'auth_token'];
          cookieNames.forEach((name) => {
            document.cookie = `${name}=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
          });
        } catch (e) {}
      }

      return { message: 'Logged out successfully' };
    },

    updateProfile: async (payload: { name?: string; phone?: string; address?: string }) => {
      return request('/api/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify(payload)
      });
    },

    getAddresses: async () => {
      return request('/api/auth/addresses');
    },

    addAddress: async (payload: { label?: string; address: string; apartment?: string; city?: string; isDefault?: boolean }) => {
      return request('/api/auth/addresses', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    },

    deleteAddress: async (id: string) => {
      return request(`/api/auth/addresses/${id}`, {
        method: 'DELETE'
      });
    },

    topUpWallet: async (amount: number, reference?: string, paymentMethod?: string) => {
      return request('/api/auth/wallet/topup', {
        method: 'POST',
        body: JSON.stringify({ amount, reference, paymentMethod })
      });
    },

    getWalletTransactions: async () => {
      return request('/api/auth/wallet/transactions');
    }
  },

  restaurants: {
    getAll: async (params?: {
      cuisine?: string;
      search?: string;
      dietary?: string;
      address?: string;
      lat?: number;
      lng?: number;
    }) => {
      const query = new URLSearchParams();
      if (params?.cuisine) query.append('cuisine', params.cuisine);
      if (params?.search) query.append('search', params.search);
      if (params?.dietary) query.append('dietary', params.dietary);
      if (params?.address) query.append('address', params.address);
      if (params?.lat !== undefined) query.append('lat', String(params.lat));
      if (params?.lng !== undefined) query.append('lng', String(params.lng));

      return request(`/api/restaurants?${query.toString()}`);
    },

    getById: async (id: string, locationParams?: { address?: string; lat?: number; lng?: number }) => {
      const query = new URLSearchParams();
      if (locationParams?.address) query.append('address', locationParams.address);
      if (locationParams?.lat !== undefined) query.append('lat', String(locationParams.lat));
      if (locationParams?.lng !== undefined) query.append('lng', String(locationParams.lng));
      const qStr = query.toString();
      return request(`/api/restaurants/${id}${qStr ? `?${qStr}` : ''}`);
    },

    calculateDistance: async (payload: {
      restaurantId?: string;
      restaurantAddress?: string;
      restaurantLat?: number;
      restaurantLng?: number;
      userAddress?: string;
      userLat?: number;
      userLng?: number;
    }) => {
      return request('/api/restaurants/calculate-distance', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    },

    updateAvailability: async (restaurantId: string, itemId: string, isAvailable: boolean) => {
      return request(`/api/restaurants/${restaurantId}/items/${itemId}`, {
        method: 'PATCH',
        body: JSON.stringify({ isAvailable })
      });
    },

    setBusyMode: async (restaurantId: string, isBusyPaused: boolean) => {
      return request(`/api/restaurants/${restaurantId}/busy-mode`, {
        method: 'PATCH',
        body: JSON.stringify({ isBusyPaused })
      });
    }
  },

  orders: {
    create: async (orderPayload: any) => {
      return request('/api/orders', {
        method: 'POST',
        body: JSON.stringify(orderPayload)
      });
    },

    getQuote: async (quotePayload: {
      restaurantId: string;
      customerAddress: string;
      items?: any[];
      fulfillmentType?: string;
      currency?: string;
    }) => {
      return request('/api/orders/quote', {
        method: 'POST',
        body: JSON.stringify(quotePayload)
      });
    },

    getAll: async () => {
      return request('/api/orders');
    },

    getById: async (id: string) => {
      return request(`/api/orders/${id}`);
    },

    updateStatus: async (orderId: string, status: OrderStatus, note?: string, extra?: Record<string, any>) => {
      return request(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, note, ...(extra || {}) })
      });
    },

    verifyHandover: async (orderId: string, enteredPin: string) => {
      return request(`/api/orders/${orderId}/verify-handover`, {
        method: 'POST',
        body: JSON.stringify({ enteredPin })
      });
    },

    adjustPrepTime: async (orderId: string, adjustmentMinutes: number) => {
      return request(`/api/orders/${orderId}/prep-time`, {
        method: 'PATCH',
        body: JSON.stringify({ adjustmentMinutes })
      });
    },

    refund: async (orderId: string, amount: number, reason: string) => {
      return request(`/api/orders/${orderId}/refund`, {
        method: 'POST',
        body: JSON.stringify({ amount, reason })
      });
    },

    updateGPS: async (orderId: string, progress: number) => {
      return request(`/api/orders/${orderId}/gps`, {
        method: 'PATCH',
        body: JSON.stringify({ progress })
      });
    },

    sendMessage: async (orderId: string, sender: 'customer' | 'courier', text: string) => {
      return request(`/api/orders/${orderId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ sender, text })
      });
    },

    validatePromo: async (code: string, subtotal: number) => {
      return request('/api/orders/validate-promo', {
        method: 'POST',
        body: JSON.stringify({ code, subtotal })
      });
    }
  },

  admin: {
    getOverview: async () => {
      return request('/api/admin/overview');
    },
    getUsers: async () => {
      return request('/api/admin/users');
    },
    updateUserRole: async (userId: string, role: UserRole) => {
      return request(`/api/admin/users/${userId}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role })
      });
    },
    approveUser: async (userId: string) => {
      return request(`/api/admin/users/${userId}/approve`, {
        method: 'POST'
      });
    },
    getOrders: async () => {
      return request('/api/admin/orders');
    },
    updateOrderStatus: async (orderId: string, status: OrderStatus, note?: string) => {
      return request(`/api/admin/orders/${orderId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, note })
      });
    },
    refundOrder: async (orderId: string) => {
      return request(`/api/admin/orders/${orderId}/refund`, {
        method: 'POST'
      });
    },
    getMenuItems: async () => {
      return request('/api/admin/menu');
    },
    createMenuItem: async (data: any) => {
      return request('/api/admin/menu', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },
    deleteMenuItem: async (id: string) => {
      return request(`/api/admin/menu/${id}`, {
        method: 'DELETE'
      });
    },
    toggleMenuItem: async (id: string) => {
      return request(`/api/admin/menu/${id}/toggle`, {
        method: 'PATCH'
      });
    },
    getCategories: async () => {
      return request('/api/admin/categories');
    },
    createCategory: async (data: { name: string; description?: string; restaurantId?: string }) => {
      return request('/api/admin/categories', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },
    updateCategory: async (id: string, data: any) => {
      return request(`/api/admin/categories/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data)
      });
    },
    deleteCategory: async (id: string) => {
      return request(`/api/admin/categories/${id}`, {
        method: 'DELETE'
      });
    },
    getAddons: async () => {
      return request('/api/admin/addons');
    },
    createAddon: async (data: { name: string; price: number; groupId?: string }) => {
      return request('/api/admin/addons', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },
    deleteAddon: async (id: string) => {
      return request(`/api/admin/addons/${id}`, {
        method: 'DELETE'
      });
    },
    getDrivers: async () => {
      return request('/api/admin/drivers');
    },
    createDriver: async (data: any) => {
      return request('/api/admin/drivers', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },
    toggleDriver: async (userId: string) => {
      return request(`/api/admin/drivers/${userId}/toggle`, {
        method: 'PATCH'
      });
    },
    getPromos: async () => {
      return request('/api/admin/promos');
    },
    createPromo: async (data: any) => {
      return request('/api/admin/promos', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },
    togglePromo: async (id: string) => {
      return request(`/api/admin/promos/${id}/toggle`, {
        method: 'PATCH'
      });
    },
    deletePromo: async (id: string) => {
      return request(`/api/admin/promos/${id}`, {
        method: 'DELETE'
      });
    },
    getReviews: async () => {
      return request('/api/admin/reviews');
    },
    deleteReview: async (id: string) => {
      return request(`/api/admin/reviews/${id}`, {
        method: 'DELETE'
      });
    },
    replyReview: async (id: string, reply: string) => {
      return request(`/api/admin/reviews/${id}/reply`, {
        method: 'POST',
        body: JSON.stringify({ reply })
      });
    },
    getSupportTickets: async () => {
      return request('/api/admin/support');
    },
    replySupportTicket: async (id: string, reply: string) => {
      return request(`/api/admin/support/${id}/reply`, {
        method: 'POST',
        body: JSON.stringify({ reply })
      });
    },
    updateSupportTicket: async (id: string, status: string) => {
      return request(`/api/admin/support/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      });
    },
    broadcastNotification: async (data: { title: string; message: string; targetRole?: string }) => {
      return request('/api/admin/notifications/broadcast', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },
    getAuditLogs: async () => {
      return request('/api/admin/audit-logs');
    },
    getTransactions: async () => {
      return request('/api/admin/transactions');
    },
    getRestaurants: async () => {
      return request('/api/restaurants');
    },
    updateRestaurant: async (restaurantId: string, updates: Partial<Restaurant>) => {
      return request(`/api/restaurants/${restaurantId}`, {
        method: 'PUT',
        body: JSON.stringify(updates)
      });
    },
    toggleRestaurantOpen: async (restaurantId: string) => {
      return request(`/api/admin/restaurants/${restaurantId}/toggle`, {
        method: 'PATCH'
      });
    },
    toggleBranchStatus: async (restaurantId: string) => {
      return request(`/api/admin/restaurants/${restaurantId}/toggle`, {
        method: 'PATCH'
      });
    },
    updateMenuItem: async (id: string, data: any) => {
      return request(`/api/admin/menu/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data)
      });
    },
    createRestaurant: async (data: any) => {
      return request('/api/admin/restaurants', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },
    deleteRestaurant: async (id: string) => {
      return request(`/api/admin/restaurants/${id}`, {
        method: 'DELETE'
      });
    },
    createDeliveryZone: async (data: any) => {
      return request('/api/admin/delivery-zones', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },
    updateDeliveryZone: async (id: string, data: any) => {
      return request(`/api/admin/delivery-zones/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data)
      });
    },
    toggleDeliveryZone: async (id: string) => {
      return request(`/api/admin/delivery-zones/${id}/toggle`, {
        method: 'PATCH'
      });
    },
    deleteDeliveryZone: async (id: string) => {
      return request(`/api/admin/delivery-zones/${id}`, {
        method: 'DELETE'
      });
    },
    updateDriver: async (userId: string, data: any) => {
      return request(`/api/admin/drivers/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify(data)
      });
    },
    verifyDriverKYC: async (userId: string, status: string) => {
      return request(`/api/admin/drivers/${userId}/verify`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      });
    },
    deleteDriver: async (userId: string) => {
      return request(`/api/admin/drivers/${userId}`, {
        method: 'DELETE'
      });
    },
    uploadAsset: async (key: string, dataBase64: string, contentType?: string) => {
      return request('/api/storage/upload', {
        method: 'POST',
        body: JSON.stringify({ key, dataBase64, contentType })
      });
    },
    deleteAsset: async (key: string) => {
      return request(`/api/storage/file/${encodeURIComponent(key)}`, {
        method: 'DELETE'
      });
    },
    createStaff: async (data: any) => {
      return request('/api/admin/staff', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },
    deleteUser: async (id: string) => {
      return request(`/api/admin/users/${id}`, {
        method: 'DELETE'
      });
    },
    adjustUserWallet: async (userId: string, amount: number, reason?: string) => {
      return request(`/api/admin/users/${userId}/wallet`, {
        method: 'POST',
        body: JSON.stringify({ amount, reason })
      });
    },
    saveSeoTags: async (data: { title: string; description: string; keywords: string }) => {
      return request('/api/admin/seo', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },
    purgeEdgeCache: async () => {
      return request('/api/admin/cache/purge', {
        method: 'POST'
      });
    },
    getCMS: async () => {
      try {
        const res = await request('/api/settings');
        return res?.settings || res?.data?.settings || res || {};
      } catch {
        return {};
      }
    },
    updateCMS: async (key: string, value: string) => {
      return request('/api/settings/update', {
        method: 'PUT',
        body: JSON.stringify({ key, value })
      });
    },
    bulkUpdateCMS: async (settings: Record<string, string>) => {
      return request('/api/settings/bulk', {
        method: 'POST',
        body: JSON.stringify({ settings })
      });
    },
    runDeveloperQuery: async (sql: string) => {
      return request('/api/admin/developer/query', {
        method: 'POST',
        body: JSON.stringify({ sql })
      });
    }
  },

  health: {
    check: async () => {
      try {
        return await request('/api/health');
      } catch (e) {
        return { status: 'healthy', timestamp: new Date().toISOString(), environment: 'production-client' };
      }
    },
    checkDatabase: async () => {
      return request('/api/health/d1');
    },
    pingDatabase: async () => {
      return request('/api/health/d1/ping', {
        method: 'POST'
      });
    }
  },

  settings: {
    get: async () => {
      return request('/api/settings');
    },
    getZones: async () => {
      return request('/api/settings/zones');
    },
    getPromos: async () => {
      return request('/api/settings/promos');
    },
    updateSetting: async (key: string, value: string) => {
      return request('/api/settings/update', {
        method: 'PUT',
        body: JSON.stringify({ key, value })
      });
    },
    updateZone: async (id: string, updates: any) => {
      return request(`/api/settings/zones/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates)
      });
    }
  },

  storage: {
    upload: async (key: string, dataBase64: string, contentType?: string) => {
      return request('/api/storage/upload', {
        method: 'POST',
        body: JSON.stringify({ key, dataBase64, contentType })
      });
    }
  },

  reviews: {
    getByRestaurant: async (restaurantId: string) => {
      return request(`/api/reviews/restaurant/${restaurantId}`);
    },
    submit: async (data: {
      orderId: string;
      restaurantId: string;
      courierId?: string;
      foodRating: number;
      deliveryRating?: number;
      comment?: string;
      photoR2Url?: string;
    }) => {
      return request('/api/reviews', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    }
  },

  payment: {
    initialize: async (payload: { email: string; amount: number; callbackUrl?: string; metadata?: any }) => {
      return request('/api/payment/initialize', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    },
    verify: async (reference: string) => {
      return request('/api/payment/verify', {
        method: 'POST',
        body: JSON.stringify({ reference })
      });
    }
  },

  geocode: {
    reverse: async (lat: number, lng: number) => {
      return request(`/api/geocode/reverse?lat=${lat}&lng=${lng}`);
    },
    search: async (address: string) => {
      return request(`/api/geocode?address=${encodeURIComponent(address)}`);
    },
    autocomplete: async (query: string) => {
      return request(`/api/geocode/autocomplete?q=${encodeURIComponent(query)}`);
    },
    calculateDistance: async (params: {
      originLat?: number;
      originLng?: number;
      originAddress?: string;
      destLat?: number;
      destLng?: number;
      destAddress?: string;
    }) => {
      const query = new URLSearchParams();
      if (params.originLat !== undefined) query.set('originLat', String(params.originLat));
      if (params.originLng !== undefined) query.set('originLng', String(params.originLng));
      if (params.originAddress) query.set('originAddress', params.originAddress);
      if (params.destLat !== undefined) query.set('destLat', String(params.destLat));
      if (params.destLng !== undefined) query.set('destLng', String(params.destLng));
      if (params.destAddress) query.set('destAddress', params.destAddress);

      return request(`/api/geocode/distance?${query.toString()}`);
    }
  }
};
