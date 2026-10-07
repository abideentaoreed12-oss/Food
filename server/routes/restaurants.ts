import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../db/index.ts';
import { d1Client } from '../db/d1Client.ts';
import { AuthRequest, requireAuth, requireRole } from '../middleware/auth.ts';
import { validateBody } from '../middleware/validate.ts';
import {
  calculateRestaurantDistanceMetrics,
  calculateDistanceAndDuration,
  calculateBatchRestaurantDistanceMetrics,
  geocodeAddress
} from '../utils/distance.ts';

const router = Router();

// Public: Get all restaurants with optional filtering and automatic distance calculation
router.get('/', async (req: Request, res: Response) => {
  try {
    const cuisine = req.query.cuisine as string | undefined;
    const search = req.query.search as string | undefined;
    const dietary = req.query.dietary as string | undefined;
    const userAddress = req.query.address as string | undefined;
    const userLat = req.query.lat ? parseFloat(req.query.lat as string) : undefined;
    const userLng = req.query.lng ? parseFloat(req.query.lng as string) : undefined;

    let list: any[] = [];
    try {
      const d1Res = await d1Client.query('SELECT * FROM restaurants ORDER BY rating DESC');
      list = d1Res.results.map((r: any) => {
        if (r.raw_json) {
          try {
            const parsed = JSON.parse(r.raw_json);
            return {
              ...parsed,
              id: r.id,
              name: r.name || parsed.name,
              cuisine: r.cuisine || parsed.cuisine,
              rating: r.rating ?? parsed.rating,
              reviewCount: r.review_count ?? parsed.reviewCount,
              deliveryTimeMin: r.delivery_time_min ?? parsed.deliveryTimeMin,
              deliveryTimeMax: r.delivery_time_max ?? parsed.deliveryTimeMax,
              deliveryFee: r.delivery_fee ?? parsed.deliveryFee,
              isOpen: r.is_open === 1,
              isBusyPaused: r.is_busy_paused === 1
            };
          } catch (e) {}
        }
        return r;
      });
    } catch (e) {
      list = await db.getRestaurants();
    }

    if (cuisine && cuisine !== 'All') {
      list = list.filter((r) => r.cuisine?.toLowerCase() === cuisine.toLowerCase());
    }

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (r) =>
          r.name?.toLowerCase().includes(q) ||
          r.tagline?.toLowerCase().includes(q) ||
          (r.tags && r.tags.some((t: string) => t.toLowerCase().includes(q)))
      );
    }

    if (dietary) {
      const tags = dietary.split(',');
      list = list.filter((r) =>
        r.categories?.some((cat: any) =>
          cat.items?.some((item: any) => tags.every((t) => item.dietary?.includes(t as any)))
        )
      );
    }

    // Determine target location for live road distance calculation
    const userLocation =
      userLat !== undefined && userLng !== undefined && !isNaN(userLat) && !isNaN(userLng)
        ? { lat: userLat, lng: userLng }
        : userAddress && userAddress.trim()
        ? userAddress.trim()
        : { lat: 6.4474, lng: 3.4735 }; // Central Lagos / Lekki Hub default

    list = await calculateBatchRestaurantDistanceMetrics(list, userLocation);

    const publicList = list.map((r) => {
      const { commissionPercent, ...publicRest } = r;
      return publicRest;
    });

    return res.json({ success: true, data: publicList });
  } catch (error) {
    console.error('Fetch restaurants error:', error);
    return res.status(500).json({ success: false, error: 'Could not fetch restaurants' });
  }
});

// Calculate distance endpoint for single restaurant or arbitrary addresses
const CalculateDistanceSchema = z.object({
  restaurantId: z.string().optional(),
  restaurantAddress: z.string().optional(),
  restaurantLat: z.number().optional(),
  restaurantLng: z.number().optional(),
  userAddress: z.string().optional(),
  userLat: z.number().optional(),
  userLng: z.number().optional()
});

router.post('/calculate-distance', validateBody(CalculateDistanceSchema), async (req: Request, res: Response) => {
  try {
    const {
      restaurantId,
      restaurantAddress,
      restaurantLat,
      restaurantLng,
      userAddress,
      userLat,
      userLng
    } = req.body;

    let targetRestaurant: any = null;
    if (restaurantId) {
      targetRestaurant = await db.getRestaurantById(restaurantId);
      if (!targetRestaurant) {
        try {
          const d1Res = await d1Client.query('SELECT * FROM restaurants WHERE id = ?', [restaurantId]);
          if (d1Res.results && d1Res.results.length > 0) {
            const r: any = d1Res.results[0];
            targetRestaurant = r.raw_json ? JSON.parse(r.raw_json) : r;
          }
        } catch (e) {}
      }
    }

    const restLat = restaurantLat ?? targetRestaurant?.lat ?? 6.4474;
    const restLng = restaurantLng ?? targetRestaurant?.lng ?? 3.4735;
    const restAddr = restaurantAddress ?? targetRestaurant?.address ?? 'Restaurant Location';

    const userLoc =
      userLat !== undefined && userLng !== undefined
        ? { lat: userLat, lng: userLng }
        : userAddress || 'Lekki Phase 1, Lagos';

    const metrics = await calculateRestaurantDistanceMetrics(
      {
        lat: restLat,
        lng: restLng,
        address: restAddr,
        deliveryFee: targetRestaurant?.deliveryFee ?? 500
      },
      userLoc
    );

    return res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    console.error('Calculate distance error:', error);
    return res.status(500).json({ success: false, error: 'Failed to calculate distance' });
  }
});

// Public: Get specific restaurant by ID (with optional address distance calculation)
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userAddress = req.query.address as string | undefined;
    const userLat = req.query.lat ? parseFloat(req.query.lat as string) : undefined;
    const userLng = req.query.lng ? parseFloat(req.query.lng as string) : undefined;

    let restaurant: any = null;
    try {
      const d1Res = await d1Client.query('SELECT * FROM restaurants WHERE id = ?', [id]);
      if (d1Res.results && d1Res.results.length > 0) {
        const r: any = d1Res.results[0];
        if (r.raw_json) {
          try {
            restaurant = JSON.parse(r.raw_json);
            restaurant.id = r.id;
            restaurant.name = r.name || restaurant.name;
            restaurant.cuisine = r.cuisine || restaurant.cuisine;
            restaurant.rating = r.rating ?? restaurant.rating;
            restaurant.isOpen = r.is_open === 1;
            restaurant.isBusyPaused = r.is_busy_paused === 1;
          } catch (e) {}
        }
      }
    } catch (e) {}

    if (!restaurant) {
      restaurant = await db.getRestaurantById(id);
    }

    if (!restaurant) {
      return res.status(404).json({ success: false, error: 'Restaurant not found' });
    }

    // Attach distance metrics if location provided
    const userLocation =
      userLat !== undefined && userLng !== undefined
        ? { lat: userLat, lng: userLng }
        : userAddress
        ? userAddress
        : null;

    if (userLocation) {
      try {
        const distanceMetrics = await calculateRestaurantDistanceMetrics(restaurant, userLocation);
        restaurant = {
          ...restaurant,
          distanceKm: distanceMetrics.distanceKm,
          distanceText: distanceMetrics.distanceText,
          durationMinutes: distanceMetrics.durationMinutes,
          durationText: distanceMetrics.durationText,
          calculatedDeliveryFee: distanceMetrics.estimatedDeliveryFee,
          inDeliveryRadius: distanceMetrics.inDeliveryRadius
        };
      } catch (err) {}
    }

    const { commissionPercent, bankAccount, ownerEmail, ...publicRestaurant } = restaurant;

    return res.json({ success: true, data: publicRestaurant });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Could not fetch restaurant' });
  }
});

// Merchant / Admin: Toggle dish availability (86-list)
const AvailabilitySchema = z.object({
  isAvailable: z.boolean()
});

router.patch(
  '/:id/items/:itemId',
  requireAuth,
  requireRole(['restaurant', 'admin']),
  validateBody(AvailabilitySchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id: restaurantId, itemId } = req.params;
      const { isAvailable } = req.body;

      // Ensure merchant owns this restaurant if not admin
      if (req.user!.role === 'restaurant' && req.user!.restaurantId && req.user!.restaurantId !== restaurantId) {
        return res.status(403).json({
          success: false,
          error: 'You can only update menu items for your designated kitchen.'
        });
      }

      const success = await db.updateMenuItemAvailability(restaurantId, itemId, isAvailable);
      if (!success) {
        return res.status(404).json({ success: false, error: 'Item or restaurant not found' });
      }

      await db.logAudit({
        userId: req.user!.id,
        userEmail: req.user!.email,
        userRole: req.user!.role,
        action: isAvailable ? 'MENU_ITEM_AVAILABLE' : 'MENU_ITEM_86',
        resource: 'MENU_ITEM',
        resourceId: itemId,
        details: { restaurantId, isAvailable },
        ip: req.ip
      });

      return res.json({
        success: true,
        message: `Dish availability updated to ${isAvailable ? 'available' : 'sold out'}.`
      });
    } catch (error) {
      console.error('Menu availability update error:', error);
      return res.status(500).json({ success: false, error: 'Failed to update item availability' });
    }
  }
);

// Merchant / Admin: Toggle Kitchen Busy Mode (pause new orders)
const BusyModeSchema = z.object({
  isBusyPaused: z.boolean()
});

router.patch(
  '/:id/busy-mode',
  requireAuth,
  requireRole(['restaurant', 'admin']),
  validateBody(BusyModeSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id: restaurantId } = req.params;
      const { isBusyPaused } = req.body;

      if (req.user!.role === 'restaurant' && req.user!.restaurantId && req.user!.restaurantId !== restaurantId) {
        return res.status(403).json({
          success: false,
          error: 'You can only update busy mode for your designated kitchen.'
        });
      }

      const rest = await db.updateRestaurantBusyMode(restaurantId, isBusyPaused);
      if (!rest) {
        return res.status(404).json({ success: false, error: 'Restaurant not found' });
      }

      await db.logAudit({
        userId: req.user!.id,
        userEmail: req.user!.email,
        userRole: req.user!.role,
        action: isBusyPaused ? 'KITCHEN_BUSY_MODE_ENABLED' : 'KITCHEN_BUSY_MODE_DISABLED',
        resource: 'RESTAURANT',
        resourceId: restaurantId,
        details: { isBusyPaused },
        ip: req.ip
      });

      return res.json({
        success: true,
        message: `Kitchen busy mode ${isBusyPaused ? 'enabled (orders paused)' : 'disabled (accepting orders)'}.`,
        data: rest
      });
    } catch (error) {
      return res.status(500).json({ success: false, error: 'Failed to update busy mode' });
    }
  }
);

// Admin & Merchant: Update Restaurant Profile & Branding in Cloudflare D1
const handleUpdateRestaurant = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    if (req.user!.role === 'restaurant' && req.user!.restaurantId && req.user!.restaurantId !== id) {
      return res.status(403).json({
        success: false,
        error: 'You can only update details for your designated kitchen.'
      });
    }

    // 1. Fetch current D1 restaurant record
    const existingRes = await d1Client.query('SELECT * FROM restaurants WHERE id = ? LIMIT 1', [id]);
    if (!existingRes.results || existingRes.results.length === 0) {
      return res.status(404).json({ success: false, error: 'Restaurant not found in D1' });
    }

    const current = existingRes.results[0];
    let rawData: any = {};
    if (current.raw_json) {
      try {
        rawData = JSON.parse(current.raw_json);
      } catch (e) {
        rawData = {};
      }
    }

    // 2. Merge updates into raw_json
    const mergedData = {
      ...rawData,
      id,
      name: updates.name !== undefined ? updates.name : (rawData.name || current.name),
      cuisine: updates.cuisine !== undefined ? updates.cuisine : (rawData.cuisine || current.cuisine),
      address: updates.address !== undefined ? updates.address : (rawData.address || current.address),
      tagline: updates.tagline !== undefined ? updates.tagline : (rawData.tagline || ''),
      deliveryFee: updates.deliveryFee !== undefined ? Number(updates.deliveryFee) : (rawData.deliveryFee ?? current.delivery_fee ?? 1000),
      deliveryTimeMin: updates.deliveryTimeMin !== undefined ? Number(updates.deliveryTimeMin) : (rawData.deliveryTimeMin ?? current.delivery_time_min ?? 20),
      deliveryTimeMax: updates.deliveryTimeMax !== undefined ? Number(updates.deliveryTimeMax) : (rawData.deliveryTimeMax ?? current.delivery_time_max ?? 40),
      rating: updates.rating !== undefined ? Number(updates.rating) : (rawData.rating ?? current.rating ?? 4.8),
      bannerUrl: updates.bannerUrl !== undefined ? updates.bannerUrl : (updates.banner_r2_url || rawData.bannerUrl || rawData.banner_r2_url || current.banner_r2_url || ''),
      logoUrl: updates.logoUrl !== undefined ? updates.logoUrl : (rawData.logoUrl || ''),
      isOpen: updates.isOpen !== undefined ? Boolean(updates.isOpen) : (rawData.isOpen ?? (current.is_open === 1)),
      isBusyPaused: updates.isBusyPaused !== undefined ? Boolean(updates.isBusyPaused) : (rawData.isBusyPaused ?? (current.is_busy_paused === 1)),
      zone: updates.zone !== undefined ? updates.zone : (rawData.zone || current.zone || 'Lekki Phase 1')
    };

    // 3. Update D1 restaurants table
    await d1Client.query(
      `UPDATE restaurants SET
        name = ?,
        cuisine = ?,
        rating = ?,
        raw_json = ?
       WHERE id = ?`,
      [
        mergedData.name,
        mergedData.cuisine,
        mergedData.rating,
        JSON.stringify(mergedData),
        id
      ]
    );

    // Optional column sync in D1 if columns exist
    await d1Client.query(
      `UPDATE restaurants SET
        delivery_fee = ?,
        delivery_time_min = ?,
        delivery_time_max = ?,
        address = ?,
        banner_r2_url = ?,
        is_open = ?
       WHERE id = ?`,
      [
        mergedData.deliveryFee,
        mergedData.deliveryTimeMin,
        mergedData.deliveryTimeMax,
        mergedData.address,
        mergedData.bannerUrl,
        mergedData.isOpen ? 1 : 0,
        id
      ]
    ).catch(() => {});

    await db.logAudit({
      userId: req.user!.id,
      userEmail: req.user!.email,
      userRole: req.user!.role,
      action: 'RESTAURANT_UPDATED',
      resource: 'RESTAURANT',
      resourceId: id,
      details: updates,
      ip: req.ip
    });

    return res.json({
      success: true,
      message: `Restaurant "${mergedData.name}" updated successfully in Cloudflare D1`,
      data: mergedData
    });
  } catch (error: any) {
    console.error('Restaurant update error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Failed to update restaurant' });
  }
};

router.put('/:id', requireAuth, requireRole(['restaurant', 'admin']), handleUpdateRestaurant);
router.patch('/:id', requireAuth, requireRole(['restaurant', 'admin']), handleUpdateRestaurant);

export default router;
