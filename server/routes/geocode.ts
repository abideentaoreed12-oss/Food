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

    // Do not use a non-open-source third-party fallback. If OSM sources fail,
    // return an explicit unavailable result rather than inventing a verified address.
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

    // Only return a delivery address when the geocoder explicitly identifies Nigeria.
    if (!resolvedAddress || !/\\bnigeria\\b/i.test(resolvedCountry)) {
      return res.status(422).json({
        success: false,
        error: 'Live coordinates were captured, but a Nigerian street/area address could not be verified. Please enter the address manually.'
      });
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
 * Nigeria-only open-source address search.
 * Browser clients call this same-origin endpoint; no API key or client-side provider URL is needed.
 * Photon is based on OpenStreetMap data and is used for autocomplete (not public Nominatim autocomplete).
 */
router.get('/search', geocodeLimiter, async (req: Request, res: Response) => {
  try {
    const query = String(req.query.q || '').trim();
    if (query.length < 3 || query.length > 160) {
      return res.status(200).json({ success: true, data: [] });
    }
    const url = new URL('https://photon.komoot.io/api/');
    url.searchParams.set('q', /\\bnigeria\\b/i.test(query) ? query : query + ', Nigeria');
    url.searchParams.set('limit', '8');
    url.searchParams.set('lang', 'en');
    url.searchParams.set('lat', '9.0820');
    url.searchParams.set('lon', '8.6753');
    url.searchParams.set('zoom', '5');
    const upstream = await fetch(url, {
      headers: { 'User-Agent': 'VeyraNG-FoodDelivery/1.0', 'Accept': 'application/json' },
      signal: AbortSignal.timeout(5000)
    });
    if (!upstream.ok) return res.status(502).json({ success: false, error: 'Address search is temporarily unavailable.' });
    const body = await upstream.json();
    const features = Array.isArray(body.features) ? body.features : [];
    const data = features.flatMap((feature: any, index: number) => {
      const p = feature?.properties || {};
      const coords = feature?.geometry?.coordinates || [];
      const country = String(p.country || '');
      const lat = Number(coords[1]);
      const lng = Number(coords[0]);
      // Nigeria bounding box is a secondary safety check, not a substitute for country metadata.
      if (!/\\bnigeria\\b/i.test(country) || !Number.isFinite(lat) || !Number.isFinite(lng) ||
          lat < 4 || lat > 14 || lng < 2 || lng > 15) return [];
      const street = [p.housenumber, p.street || p.name].filter(Boolean).join(' ').trim();
      const area = [p.district, p.city || p.county, p.state, 'Nigeria'].filter(Boolean).join(', ');
      const label = [street || p.name, area].filter(Boolean).join(', ');
      if (!label) return [];
      return [{ id: String(p.osm_id || index), address: street || p.name, city: p.city || p.county || '', state: p.state || '', country: 'Nigeria', formattedAddress: label, latitude: lat, longitude: lng }];
    });
    return res.status(200).json({ success: true, data });
  } catch (err: any) {
    console.error('Backend address search notice:', err?.message || String(err));
    return res.status(502).json({ success: false, error: 'Address search is temporarily unavailable.' });
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
