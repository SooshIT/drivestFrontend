import { buildDirectionsUrl, decodePolyline } from '../src/lib/mapboxNavigation';

type LatLng = { latitude: number; longitude: number };

const encodeValue = (value: number) => {
  let v = value < 0 ? ~(value << 1) : value << 1;
  let encoded = '';
  while (v >= 0x20) {
    encoded += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
    v >>= 5;
  }
  encoded += String.fromCharCode(v + 63);
  return encoded;
};

const encodePolyline = (coords: LatLng[], precision = 6) => {
  const factor = Math.pow(10, precision);
  let lastLat = 0;
  let lastLng = 0;
  return coords
    .map((coord) => {
      const lat = Math.round(coord.latitude * factor);
      const lng = Math.round(coord.longitude * factor);
      const dLat = lat - lastLat;
      const dLng = lng - lastLng;
      lastLat = lat;
      lastLng = lng;
      return encodeValue(dLat) + encodeValue(dLng);
    })
    .join('');
};

describe('mapboxNavigation', () => {
  it('buildDirectionsUrl includes navigation-grade params and bearings', () => {
    const coords = [
      { latitude: 51.5, longitude: -0.1 },
      { latitude: 51.52, longitude: -0.12 },
    ];
    const url = buildDirectionsUrl(coords, {
      accessToken: 'token',
      useTraffic: true,
      bearing: { angle: 120, tolerance: 60 },
    });
    const parsed = new URL(url);
    expect(parsed.pathname).toContain('/mapbox/driving-traffic/');
    expect(parsed.searchParams.get('geometries')).toBe('polyline6');
    expect(parsed.searchParams.get('overview')).toBe('full');
    expect(parsed.searchParams.get('steps')).toBe('true');
    expect(parsed.searchParams.get('banner_instructions')).toBe('true');
    expect(parsed.searchParams.get('voice_instructions')).toBe('true');
    expect(parsed.searchParams.get('roundabout_exits')).toBe('true');
    expect(parsed.searchParams.get('bearings')).toBe('120,60;');
    expect(parsed.searchParams.get('radiuses')).toBe('25;unlimited');
    expect(parsed.searchParams.get('annotations')).toBe('duration,distance,speed,congestion');
  });

  it('decodes polyline6 coordinates', () => {
    const coords = [
      { latitude: 38.5, longitude: -120.2 },
      { latitude: 40.7, longitude: -120.95 },
      { latitude: 43.252, longitude: -126.453 },
    ];
    const encoded = encodePolyline(coords, 6);
    const decoded = decodePolyline(encoded, 6);
    expect(decoded).toHaveLength(coords.length);
    decoded.forEach((point, index) => {
      expect(point.latitude).toBeCloseTo(coords[index].latitude, 5);
      expect(point.longitude).toBeCloseTo(coords[index].longitude, 5);
    });
  });
});
