import { Router, Request, Response } from 'express';
import { createRateLimiter } from '../middleware/security.ts';
import { CONFIG } from '../config.ts';

const router = Router();
const geocodeLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 20, message: 'Too many geocode requests. Please slow down.' });

export interface ReverseGeocodeResult {
  latitude: number;
  longitude: number;
  address: string;
  city: string;
  state: string;
  country: string;
  formattedAddress: string;
}

/**
 * Reverse geocodes coordinates using open-source failover chain:
 * Tier 1: Nominatim (CONFIG.NOMINATIM_BASE_URL, default https://nominatim.openstreetmap.org)
 * Tier 2: Photon Komoot (CONFIG.PHOTON_BASE_URL, default https://photon.komoot.io)
 * Tier 3: BigDataCloud client fallback
 */
export async function reverseGeocodeCoordinates(lat: number, lng: number): Promise<ReverseGeocodeResult> {
  let resolvedAddress = '';
  let resolvedCity = '';
  let resolvedState = '';
  let resolvedCountry = '';
  let formattedAddress = '';

  // Tier 1: OpenStreetMap Nominatim Server-Side Call
  try {
    const nominatimBase = (CONFIG.NOMINATIM_BASE_URL || 'https://nominatim.openstreetmap.org').replace(/\/+$/, '');
    const osmResp = await fetch(
      `${nominatimBase}/reverse?lat=${lat}&lon=${lng}&format=json`,
      {
        headers: {
          'User-Agent': 'VeyraNG-FoodDelivery-Server/1.0 (contact: support@veyrang.app)',
          'Accept': 'application/json'
        },
        signal: AbortSignal.timeout(3000)
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
    } else if (osmResp.status === 429) {
      console.warn('[Geocode Reverse] Nominatim rate limit (429) - falling back to Photon');
    }
  } catch (e: any) {
    console.warn('[Geocode Reverse] Nominatim note:', e?.message || String(e));
  }

  // Tier 2: Photon Komoot Server-Side Call
  if (!resolvedAddress) {
    try {
      const photonBase = (CONFIG.PHOTON_BASE_URL || 'https://photon.komoot.io').replace(/\/+$/, '').replace(/\/reverse$/, '').replace(/\/api$/, '');
      const pResp = await fetch(`${photonBase}/reverse?lat=${lat}&lon=${lng}`, {
        headers: { 'User-Agent': 'VeyraNG-FoodDelivery-Server/1.0' },
        signal: AbortSignal.timeout(3000)
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
      } else if (pResp.status === 429) {
        console.warn('[Geocode Reverse] Photon rate limit (429) - falling back to BigDataCloud');
      }
    } catch (e: any) {
      console.warn('[Geocode Reverse] Photon note:', e?.message || String(e));
    }
  }

  // Tier 3: BigDataCloud Server-Side Call
  if (!resolvedAddress) {
    try {
      const bResp = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`,
        { signal: AbortSignal.timeout(3000) }
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
      console.warn('[Geocode Reverse] BigDataCloud note:', e?.message || String(e));
    }
  }

  if (!resolvedAddress) {
    resolvedAddress = `Device Location (${lat.toFixed(5)}, ${lng.toFixed(5)})`;
    formattedAddress = resolvedAddress;
  }

  return {
    latitude: lat,
    longitude: lng,
    address: resolvedAddress,
    city: resolvedCity,
    state: resolvedState,
    country: resolvedCountry,
    formattedAddress: formattedAddress || resolvedAddress
  };
}

/**
 * Forward Geocode Endpoint (Backend Proxy Server)
 * Resolves address text to coordinates using Google / Photon / Nominatim / Pelias chain.
 */
router.get(['/', '/search'], geocodeLimiter, async (req: Request, res: Response) => {
  try {
    const address = ((req.query.address || req.query.q) as string || '').trim();
    if (!address) {
      return res.status(400).json({
        success: false,
        error: 'Missing required query parameter: address or q'
      });
    }

    const { geocodeAddress } = await import('../utils/distance');
    const data = await geocodeAddress(address);
    return res.status(200).json({ success: true, data });
  } catch (err: any) {
    const isNotFound = /could not locate|enter a delivery address/i.test(err?.message || '');
    return res.status(isNotFound ? 404 : 500).json({
      success: false,
      error: err?.message || 'Failed to geocode address.'
    });
  }
});

/**
 * Autocomplete suggestions endpoint via configured Photon Komoot / open-source geocoders
 */
router.get('/autocomplete', geocodeLimiter, async (req: Request, res: Response) => {
  try {
    const query = ((req.query.q || req.query.query || req.query.input) as string || '').trim();
    if (!query) {
      return res.status(200).json({ success: true, data: [] });
    }

    const photonBase = (CONFIG.PHOTON_BASE_URL || 'https://photon.komoot.io').replace(/\/+$/, '').replace(/\/api$/, '');
    const searchParams = new URLSearchParams({
      q: /\b(nigeria|lagos|ibadan|abuja|oyo|ogun|rivers|enugu|kano)\b/i.test(query) ? query : `${query}, Nigeria`,
      limit: '5',
      lang: 'en',
      countrycode: 'ng'
    });

    const resp = await fetch(`${photonBase}/api/?${searchParams.toString()}`, {
      headers: { 'User-Agent': 'VeyraNG-FoodDelivery-Server/1.0 (address autocomplete)' },
      signal: AbortSignal.timeout(3500)
    });

    if (resp.ok) {
      const data = await resp.json();
      const features = Array.isArray(data?.features) ? data.features : [];
      const suggestions = features
        .filter((f: any) => {
          const coords = f?.geometry?.coordinates || [];
          return (
            Number.isFinite(coords[0]) &&
            Number.isFinite(coords[1]) &&
            coords[1] >= 4 &&
            coords[1] <= 14 &&
            coords[0] >= 2 &&
            coords[0] <= 15
          );
        })
        .map((f: any, idx: number) => {
          const props = f.properties || {};
          const main = [props.housenumber, props.street || props.name].filter(Boolean).join(' ') || props.name || query;
          const sec = [props.district, props.city, props.state, props.country || 'Nigeria'].filter(Boolean).join(', ');
          return {
            id: `photon-${idx}-${props.osm_id || Math.random()}`,
            mainText: main,
            secondaryText: sec,
            fullText: [main, sec].filter(Boolean).join(', '),
            lat: f.geometry?.coordinates?.[1],
            lng: f.geometry?.coordinates?.[0],
            source: 'photon'
          };
        });

      return res.status(200).json({ success: true, data: suggestions });
    }

    return res.status(200).json({ success: true, data: [] });
  } catch (err: any) {
    console.warn('[Geocode Autocomplete] Note:', err?.message || String(err));
    return res.status(200).json({ success: true, data: [] });
  }
});

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

    const data = await reverseGeocodeCoordinates(lat, lng);
    return res.status(200).json({ success: true, data });
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
