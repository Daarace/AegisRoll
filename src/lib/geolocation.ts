/**
 * AegisRoll High-Accuracy Geolocation Client Utility
 * Implements W3C Geolocation API with high accuracy options and Haversine distance computation.
 */

export interface GeoPositionResult {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

export interface GeoErrorResult {
  code: number;
  message: string;
  userHint: string;
}

/**
 * Calculates distance between two coordinates in meters using the Haversine formula
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth's mean radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Requests high accuracy GPS coordinates from the device
 */
export function getHighAccuracyLocation(): Promise<GeoPositionResult> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject({
        code: 0,
        message: 'Geolocation is not supported by your browser.',
        userHint: 'Please open AegisRoll in a modern mobile browser (Safari, Chrome, or Firefox).'
      } as GeoErrorResult);
      return;
    }

    const options: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0
    };

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const accuracy = pos.coords.accuracy;
        const coords: GeoPositionResult = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: accuracy,
          timestamp: pos.timestamp
        };

        // Reject if accuracy is worse than 100m
        if (accuracy > 100) {
          reject({
            code: 4,
            message: `GPS accuracy is insufficient (±${Math.round(accuracy)}m). High precision required (<100m).`,
            userHint: 'GPS accuracy is low. Turn on Wi-Fi without connecting, step closer to an exterior window, or enable Location Precision in your phone settings.'
          } as GeoErrorResult);
          return;
        }

        resolve(coords);
      },
      (err) => {
        let hint = 'Unable to acquire location.';
        switch (err.code) {
          case err.PERMISSION_DENIED:
            hint = 'Location permission was denied. Tap the lock/info icon in your browser URL bar, set Location to "Allow", and try again.';
            break;
          case err.POSITION_UNAVAILABLE:
            hint = 'GPS signal is currently unavailable. Ensure Device Location / GPS is turned ON and try stepping outdoors or near a window.';
            break;
          case err.TIMEOUT:
            hint = 'GPS acquisition timed out. Ensure Wi-Fi is enabled (for cellular/Wi-Fi assisted triangulation) and try again.';
            break;
        }

        reject({
          code: err.code,
          message: err.message || 'Location error occurred.',
          userHint: hint
        } as GeoErrorResult);
      },
      options
    );
  });
}
