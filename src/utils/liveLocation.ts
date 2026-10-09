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

  // Reverse geocoding is handled by our backend only. This avoids exposing provider
  // URLs in the browser and prevents third-party non-open-source fallback services.
  if (!resolvedAddress || !/\\bnigeria\\b/i.test(resolvedCountry)) {
    throw new Error('Your live coordinates were captured, but we could not verify a Nigerian street or area address. Please enter your address manually or try again.');
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
