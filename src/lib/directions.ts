import { decodePolyline } from '../utils';

export type LatLng = { latitude: number; longitude: number };

const GOOGLE_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

// Request a road-snapped path from Google Directions (driving) using the provided coordinates.
export async function snapToRoads(coords: LatLng[]): Promise<LatLng[] | null> {
  if (!GOOGLE_KEY || !coords || coords.length < 2) return null;

  // Google Directions allows up to 23 waypoints on free tier. We include start and end separately.
  const [first, ...rest] = coords;
  const last = rest.pop() ?? first;
  const waypointStr = rest
    .slice(0, 23) // clamp to avoid exceeding limits
    .map((c) => `${c.latitude},${c.longitude}`)
    .join('|');

  const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${first.latitude},${first.longitude}&destination=${last.latitude},${last.longitude}${
    waypointStr ? `&waypoints=${waypointStr}` : ''
  }&mode=driving&key=${GOOGLE_KEY}`;

  try {
    const res = await fetch(url);
    const json = await res.json();
    const poly = json?.routes?.[0]?.overview_polyline?.points;
    if (poly) {
      return decodePolyline(poly);
    }
  } catch (e) {
    console.warn('snapToRoads failed', e);
  }
  return null;
}
