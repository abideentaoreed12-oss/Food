import { api } from './api';
import { ZoneConfig } from '../types';

export const deliveryService = {
  /**
   * Fetches all delivery zones live from Veyrang Cloud Database table `delivery_zones`.
   * Never hardcoded — all updates made in Admin portal reflect immediately across the app.
   */
  getDeliveryZones: async (): Promise<ZoneConfig[]> => {
    try {
      const res = await api.settings.getZones();
      const rawZones = res?.data || res?.zones || (Array.isArray(res) ? res : []);
      if (Array.isArray(rawZones) && rawZones.length > 0) {
        return rawZones.map((z: any) => ({
          id: String(z.id || ''),
          name: String(z.name || ''),
          code: String(z.code || z.id || '').toUpperCase(),
          city: String(z.city || ''),
          country: String(z.country || ''),
          currency: (z.currency || z.defaultCurrency || '') as any,
          defaultCurrency: (z.currency || z.defaultCurrency || '') as any,
          baseFee: Number(z.base_delivery_fee ?? z.baseFee ?? z.deliveryFee),
          deliveryFee: Number(z.base_delivery_fee ?? z.baseFee ?? z.deliveryFee),
          perKmFee: Number(z.per_km_fee ?? z.perKmFee),
          radiusKm: Number(z.radius_km ?? z.radiusKm ?? z.max_radius_km),
          surgeMultiplier: Number(z.surge_multiplier ?? z.surgeMultiplier),
          centerLat: Number(z.center_lat ?? z.centerLat),
          centerLng: Number(z.center_lng ?? z.centerLng),
          averageSpeedMin: Number.isFinite(Number(z.average_speed_min ?? z.averageSpeedMin)) ? Number(z.average_speed_min ?? z.averageSpeedMin) : undefined,
          isActive: Number(z.is_active ?? z.isActive) === 1,
          mapImageR2Url: z.map_image_r2_url || z.mapImageR2Url || undefined
        })).filter((z: ZoneConfig) =>
          !!z.id && !!z.name && !!z.city &&
          typeof z.baseFee === 'number' && Number.isFinite(z.baseFee) && z.baseFee >= 0 &&
          typeof z.perKmFee === 'number' && Number.isFinite(z.perKmFee) && z.perKmFee >= 0 &&
          typeof z.radiusKm === 'number' && Number.isFinite(z.radiusKm) && z.radiusKm > 0 &&
          typeof z.centerLat === 'number' && Number.isFinite(z.centerLat) && z.centerLat >= -90 && z.centerLat <= 90 &&
          typeof z.centerLng === 'number' && Number.isFinite(z.centerLng) && z.centerLng >= -180 && z.centerLng <= 180 &&
          typeof z.surgeMultiplier === 'number' && Number.isFinite(z.surgeMultiplier) && z.surgeMultiplier >= 0
        );
      }
    } catch (err) {
      console.warn('deliveryService: Failed to fetch live D1 delivery zones:', err);
    }
    return [];
  },

  /**
   * Creates a new delivery zone in Veyrang Cloud Database.
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
   * Updates an existing zone in Veyrang Cloud Database.
   */
  updateZone: async (id: string, updates: any) => {
    return api.admin.updateDeliveryZone(id, updates);
  },

  /**
   * Toggles active status of a zone in Veyrang Cloud Database.
   */
  toggleZoneStatus: async (id: string) => {
    return api.admin.toggleDeliveryZone(id);
  },

  /**
   * Deletes a zone permanently from Veyrang Cloud Database.
   */
  deleteZone: async (id: string) => {
    return api.admin.deleteDeliveryZone(id);
  }
};
