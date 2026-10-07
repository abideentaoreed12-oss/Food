export interface LiveLocationResult {
  latitude: number;
  longitude: number;
  accuracy?: number;
  source: 'Device GPS';
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  formattedAddress?: string;
}

/**
 * Acquires STRICT LIVE device location ONLY via HTML5 Geolocation (`navigator.geolocation`).
 * STRICT COMMAND REQUIREMENT:
 * - NO IP location fallback.
 * - NO mock/hardcoded coordinates.
 * - Device sensor/hardware GPS ONLY.
 */
export async function acquireLiveLocation(
  timeoutMs: number = 12000
): Promise<LiveLocationResult> {
  if (!('geolocation' in navigator)) {
    throw new Error('Device GPS is not supported by your browser.');
  }

  let lat: number | null = null;
  let lng: number | null = null;
  let accuracy: number | undefined = undefined;
  let lastErrorMsg = '';

  // Attempt HTML5 Geolocation with watchPosition + getCurrentPosition concurrently for maximum device sensor response
  try {
    const gpsResult = await new Promise<{ lat: number; lng: number; accuracy?: number }>((resolve, reject) => {
      let watchId: number | null = null;
      let completed = false;

      const timer = setTimeout(() => {
        if (!completed) {
          completed = true;
          if (watchId !== null) {
            try { navigator.geolocation.clearWatch(watchId); } catch (_) {}
          }
          reject(new Error('Device GPS timeout. Please make sure location access is enabled on your device.'));
        }
      }, timeoutMs);

      const handlePosition = (pos: GeolocationPosition) => {
        if (!completed && pos.coords && typeof pos.coords.latitude === 'number') {
          completed = true;
          clearTimeout(timer);
          if (watchId !== null) {
            try { navigator.geolocation.clearWatch(watchId); } catch (_) {}
          }
          resolve({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy
          });
        }
      };

      const handleError = (err: GeolocationPositionError) => {
        if (err.code === 1) { // PERMISSION_DENIED
          lastErrorMsg = 'Device location permission denied. Please grant location access in your browser or device settings.';
        } else if (err.code === 2) { // POSITION_UNAVAILABLE
          lastErrorMsg = 'Device GPS position is unavailable. Please turn on Location/GPS on your device.';
        } else if (err.code === 3) { // TIMEOUT
          lastErrorMsg = 'Device GPS request timed out. Please try again.';
        } else {
          lastErrorMsg = err.message || 'Could not acquire device location.';
        }
      };

      try {
        // High accuracy device sensor tracking
        watchId = navigator.geolocation.watchPosition(handlePosition, handleError, {
          enableHighAccuracy: true,
          timeout: timeoutMs,
          maximumAge: 0
        });
      } catch (e) {
        console.warn('watchPosition error:', e);
      }

      // Concurrently call getCurrentPosition with high accuracy
      navigator.geolocation.getCurrentPosition(handlePosition, handleError, {
        enableHighAccuracy: true,
        timeout: timeoutMs,
        maximumAge: 0
      });
    });

    lat = gpsResult.lat;
    lng = gpsResult.lng;
    accuracy = gpsResult.accuracy;
  } catch (gpsErr: any) {
    throw new Error(lastErrorMsg || gpsErr.message || 'Device location request failed. Please allow location permissions.');
  }

  if (lat === null || lng === null) {
    throw new Error(lastErrorMsg || 'Could not acquire live device GPS location. Please allow location access.');
  }

  // Reverse Geocode the acquired LIVE DEVICE coordinates
  let resolvedAddress = '';
  let resolvedCity = '';
  let resolvedState = '';
  let resolvedCountry = '';
  let formattedAddress = '';

  // Reverse Tier 0: Dedicated Backend Reverse Geocoding Proxy Route (/api/geocode/reverse)
  try {
    const bResp = await fetch(`/api/geocode/reverse?lat=${lat}&lng=${lng}`);
    if (bResp.ok) {
      const bData = await bResp.json();
      if (bData && bData.success && bData.data) {
        resolvedAddress = bData.data.address;
        resolvedCity = bData.data.city;
        resolvedState = bData.data.state;
        resolvedCountry = bData.data.country;
        formattedAddress = bData.data.formattedAddress;
      }
    }
  } catch (backendErr) {
    console.warn('Backend geocode API note:', backendErr);
  }

  // Reverse Tier 1: Google Maps Geocoder if available
  if (!resolvedAddress && window.google?.maps?.Geocoder) {
    try {
      const geocoder = new window.google.maps.Geocoder();
      const res = await geocoder.geocode({ location: { lat, lng } });
      if (res.results && res.results[0]) {
        formattedAddress = res.results[0].formatted_address;
        resolvedAddress = formattedAddress.split(',')[0] || formattedAddress;
        for (const comp of res.results[0].address_components) {
          if (comp.types.includes('locality')) resolvedCity = comp.long_name;
          if (comp.types.includes('administrative_area_level_1')) resolvedState = comp.long_name;
          if (comp.types.includes('country')) resolvedCountry = comp.long_name;
        }
      }
    } catch (gErr) {
      console.warn('Google reverse geocode note:', gErr);
    }
  }

  // Reverse Tier 2: OpenStreetMap Reverse Geocoding
  if (!resolvedAddress) {
    try {
      const resp = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
        { headers: { 'Accept': 'application/json' } }
      );
      if (resp.ok) {
        const data = await resp.json();
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
    } catch (osmErr) {
      console.warn('OSM reverse geocode note:', osmErr);
    }
  }

  // Reverse Tier 3: Photon Komoot Reverse Geocoding
  if (!resolvedAddress) {
    try {
      const pResp = await fetch(`https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}`);
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
    } catch (pErr) {
      console.warn('Photon reverse geocode note:', pErr);
    }
  }

  // Reverse Tier 4: BigDataCloud Reverse Geocoding
  if (!resolvedAddress) {
    try {
      const bResp = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`);
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
    } catch (bErr) {
      console.warn('BigDataCloud reverse geocode note:', bErr);
    }
  }

  if (!resolvedAddress) {
    resolvedAddress = `Device GPS Location (${lat.toFixed(5)}, ${lng.toFixed(5)})`;
    formattedAddress = resolvedAddress;
  }

  return {
    latitude: lat,
    longitude: lng,
    accuracy,
    source: 'Device GPS',
    address: resolvedAddress,
    city: resolvedCity,
    state: resolvedState,
    country: resolvedCountry,
    formattedAddress: formattedAddress || resolvedAddress
  };
}
