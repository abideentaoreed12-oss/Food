import { calculateDistanceAndDuration } from '../server/utils/distance';

export interface RouteCoordinates { lat: number; lng: number; }
export interface RouteResult {
  distanceMeters: number;
  durationSeconds: number;
  provider: 'valhalla' | 'osrm' | 'openstreetmap-routing';
  status: 'success';
  latencyMs: number;
  points: RouteCoordinates[];
}

/** Compatibility adapter. All routing delegates to the strict free open-source provider chain. */
export class RoutingManager {
  async calculateRoute(origin: RouteCoordinates, destination: RouteCoordinates): Promise<RouteResult> {
    const start = Date.now();
    const result = await calculateDistanceAndDuration(origin, destination);
    const providerMap: Record<string, RouteResult['provider']> = {
      Valhalla: 'valhalla',
      OSRM: 'osrm',
      'OpenStreetMap Routing': 'openstreetmap-routing'
    };
    const provider = providerMap[result.routingEngine];
    if (!provider) throw new Error('Unsupported road-routing provider.');
    return {
      distanceMeters: Math.round(result.distanceKm * 1000),
      durationSeconds: Math.round(result.durationMinutes * 60),
      provider,
      status: 'success',
      latencyMs: Date.now() - start,
      points: result.points
    };
  }
}
export const routingManager = new RoutingManager();
