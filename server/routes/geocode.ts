import { Router, Request, Response } from 'express';
import { createRateLimiter } from '../middleware/security.ts';

const router = Router();
const geocodeLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 10, message: 'Too many geocode requests. Please slow down.' });

/**
 * Reverse Geocode Endpoint (Backend Proxy Server)
 * Converts live device coordinates (lat, lng) into street address, city, state & country.
 * Uses server-side User-Agent headers to bypass browser CORS restrictions.
 */
router.get('/reverse', geocodeLimiter, async (req: Request, res: Response) => {
  try {
    const latStr = req.query.lat as string;
    const lngStr = req.query.lng as string;

    if (!latStr || !lngStr) {
      return res.status(400).json({
        success: false,
        error: 'Missing required query parameters: lat and lng'
      });
    }

    const lat = parseFloat(latStr);
    const lng = parseFloat(lngStr);

    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({
        success: false,
        error: 'Invalid latitude or longitude coordinates. Latitude must be between -90 and 90, and longitude between -180 and 180.'
      });
    }

    let resolvedAddress = '';
    let resolvedCity = '';
    let resolvedState = '';
    let resolvedCountry = '';
    let formattedAddress = '';

    // Tier 1: OpenStreetMap Nominatim Server-Side Call
    try {
      const osmResp = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
        {
          headers: {
            'User-Agent': 'VeyraNG-FoodDelivery-Server/1.0 (contact: support@veyrang.app)',
            'Accept': 'application/json'
          },
          signal: AbortSignal.timeout(2500)
        }
      );

      if (osmResp.ok) {
        const data = await osmResp.json();
        if (data && data.address) {
          const addr = data.address;
          const road = addr.road || addr.pedestrian || addr.suburb || addr.neighbourhood || addr.amenity || 'Current Location';
          const house = addr.house_number ? `${addr.house_number} ` : '';
          resolvedAddress = `${house}${road}`.trim();
          resolvedCity = addr.city || addr.town || addr.county || addr.state || '';
          resolvedState = addr.state || '';
          resolvedCountry = addr.country || '';
          formattedAddress = data.display_name || [resolvedAddress, resolvedCity, resolvedState, resolvedCountry].filter(Boolean).join(', ');
        }
      }
    } catch (e: any) {
      console.log('Backend OSM geocode note:', e?.message || String(e));
    }

    // Tier 2: Photon Komoot Server-Side Call
    if (!resolvedAddress) {
      try {
        const pResp = await fetch(`https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}`, {
          headers: { 'User-Agent': 'VeyraNG-FoodDelivery-Server/1.0' },
          signal: AbortSignal.timeout(2500)
        });
        if (pResp.ok) {
          const pData = await pResp.json();
          const props = pData.features?.[0]?.properties;
          if (props) {
            resolvedAddress = [props.housenumber, props.street || props.name].filter(Boolean).join(' ') || props.name || 'Current Location';
            resolvedCity = props.city || props.county || props.state || '';
            resolvedState = props.state || '';
            resolvedCountry = props.country || '';
            formattedAddress = [resolvedAddress, resolvedCity, resolvedCountry].filter(Boolean).join(', ');
          }
        }
      } catch (e: any) {
        console.log('Backend Photon geocode note:', e?.message || String(e));
      }
    }

    // Tier 3: BigDataCloud Server-Side Call
    if (!resolvedAddress) {
      try {
        const bResp = await fetch(
          `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`,
          { signal: AbortSignal.timeout(2500) }
        );
        if (bResp.ok) {
          const bData = await bResp.json();
          if (bData) {
            resolvedAddress = [bData.locality, bData.principalSubdivision].filter(Boolean).join(', ') || 'Current Location';
            resolvedCity = bData.city || bData.locality || bData.principalSubdivision || '';
            resolvedState = bData.principalSubdivision || '';
            resolvedCountry = bData.countryName || '';
            formattedAddress = [resolvedAddress, resolvedCountry].filter(Boolean).join(', ');
          }
        }
      } catch (e: any) {
        console.log('Backend BigDataCloud geocode note:', e?.message || String(e));
      }
    }

    if (!resolvedAddress) {
      resolvedAddress = `Device GPS (${lat.toFixed(5)}, ${lng.toFixed(5)})`;
      formattedAddress = resolvedAddress;
    }

    return res.status(200).json({
      success: true,
      data: {
        latitude: lat,
        longitude: lng,
        address: resolvedAddress,
        city: resolvedCity,
        state: resolvedState,
        country: resolvedCountry,
        formattedAddress: formattedAddress || resolvedAddress
      }
    });
  } catch (err: any) {
    console.error('Backend geocode error:', err);
    return res.status(500).json({
      success: false,
      error: err?.message || 'Failed to reverse geocode coordinates.'
    });
  }
});

/**
 * Live Distance & Duration Calculation Endpoint
 * Calculates precise driving distance, traffic duration, and routing provider via Valhalla / OSRM / OpenRouteService / Google Maps.
 */
router.get('/distance', async (req: Request, res: Response) => {
  try {
    const originLat = req.query.originLat ? parseFloat(req.query.originLat as string) : null;
    const originLng = req.query.originLng ? parseFloat(req.query.originLng as string) : null;
    const originAddr = req.query.originAddress as string;

    const destLat = req.query.destLat ? parseFloat(req.query.destLat as string) : null;
    const destLng = req.query.destLng ? parseFloat(req.query.destLng as string) : null;
    const destAddr = req.query.destAddress as string;

    const origin = (originLat !== null && originLng !== null && !isNaN(originLat) && !isNaN(originLng))
      ? { lat: originLat, lng: originLng }
      : (originAddr || 'Lekki Phase 1, Lagos');

    const destination = (destLat !== null && destLng !== null && !isNaN(destLat) && !isNaN(destLng))
      ? { lat: destLat, lng: destLng }
      : (destAddr || 'Victoria Island, Lagos');

    const { calculateDistanceAndDuration } = await import('../utils/distance');
    const result = await calculateDistanceAndDuration(origin, destination);

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (err: any) {
    console.error('Backend distance calculation error:', err);
    return res.status(500).json({
      success: false,
      error: err?.message || 'Failed to calculate distance and duration.'
    });
  }
});

export default router;
