import { api } from './api';
import { ZoneConfig } from '../types';

export const deliveryService = {
  /**
   * Fetches all delivery zones live from Cloudflare D1 database table `delivery_zones`.
   * Never hardcoded — all updates made in Admin portal reflect immediately in D1 and across the app.
   */
  getDeliveryZones: async (): Promise<ZoneConfig[]> => {
    try {
      const res = await api.settings.getZones();
      const rawZones = res?.data || res?.zones || (Array.isArray(res) ? res : []);
      if (Array.isArray(rawZones) && rawZones.length > 0) {
        return rawZones.map((z: any) => ({
          id: String(z.id || `zone-${z.code || Date.now()}`),
          name: String(z.name || 'Delivery Zone'),
          code: String(z.code || z.id || 'ZONE').toUpperCase(),
          city: String(z.city || 'Lagos'),
          country: String(z.country || 'Nigeria'),
          currency: (z.currency || z.defaultCurrency || 'NGN') as any,
          defaultCurrency: (z.currency || z.defaultCurrency || 'NGN') as any,
          baseFee: Number(z.base_delivery_fee ?? z.baseFee ?? z.deliveryFee ?? 500),
          deliveryFee: Number(z.base_delivery_fee ?? z.baseFee ?? z.deliveryFee ?? 500),
          perKmFee: Number(z.per_km_fee ?? z.perKmFee ?? 150),
          radiusKm: Number(z.radius_km ?? z.radiusKm ?? 10),
          surgeMultiplier: Number(z.surge_multiplier ?? z.surgeMultiplier ?? 1.0),
          centerLat: Number(z.center_lat ?? z.centerLat ?? 6.5244),
          centerLng: Number(z.center_lng ?? z.centerLng ?? 3.3792),
          averageSpeedMin: Number(z.average_speed_min ?? z.averageSpeedMin ?? 25),
          isActive: Boolean(z.is_active === undefined ? true : Number(z.is_active) === 1),
          mapImageR2Url: z.map_image_r2_url || z.mapImageR2Url || undefined
        }));
      }
    } catch (err) {
      console.warn('deliveryService: Failed to fetch live D1 delivery zones:', err);
    }
    return [];
  },

  /**
   * Creates a new delivery zone in Cloudflare D1.
   */
  createZone: async (zoneData: {
    name: string;
    code: string;
    city: string;
    country?: string;
    currency?: string;
    baseFee: number;
    perKmFee: number;
    radiusKm?: number;
    surgeMultiplier?: number;
    centerLat?: number;
    centerLng?: number;
    mapImageR2Url?: string;
  }) => {
    return api.admin.createDeliveryZone(zoneData);
  },

  /**
   * Updates an existing zone in Cloudflare D1.
   */
  updateZone: async (id: string, updates: any) => {
    return api.admin.updateDeliveryZone(id, updates);
  },

  /**
   * Toggles active status of a zone in Cloudflare D1.
   */
  toggleZoneStatus: async (id: string) => {
    return api.admin.toggleDeliveryZone(id);
  },

  /**
   * Deletes a zone permanently from Cloudflare D1.
   */
  deleteZone: async (id: string) => {
    return api.admin.deleteDeliveryZone(id);
  }
};
