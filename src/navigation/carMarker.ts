import { LatLng } from './navTypes';

export const normalizeDeg = (deg: number) => {
  const value = deg % 360;
  return value < 0 ? value + 360 : value;
};

export const shortestAngleDelta = (from: number, to: number) => {
  const delta = ((to - from + 540) % 360) - 180;
  return delta;
};

export const lerpAngleDeg = (from: number, to: number, alpha: number) => {
  const delta = shortestAngleDelta(from, to);
  return normalizeDeg(from + delta * alpha);
};

export const limitTurnRate = (from: number, to: number, maxDegPerSec: number, dtSec: number) => {
  if (!Number.isFinite(dtSec) || dtSec <= 0) return normalizeDeg(to);
  const delta = shortestAngleDelta(from, to);
  const maxDelta = maxDegPerSec * dtSec;
  const clamped = Math.max(-maxDelta, Math.min(maxDelta, delta));
  return normalizeDeg(from + clamped);
};

export const lerpCoord = (from: LatLng, to: LatLng, alpha: number): LatLng => ({
  latitude: from.latitude + (to.latitude - from.latitude) * alpha,
  longitude: from.longitude + (to.longitude - from.longitude) * alpha,
});

export const bearingDeg = (a: LatLng, b: LatLng) => {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const y = Math.sin(toRad(b.longitude - a.longitude)) * Math.cos(toRad(b.latitude));
  const x =
    Math.cos(toRad(a.latitude)) * Math.sin(toRad(b.latitude)) -
    Math.sin(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.cos(toRad(b.longitude - a.longitude));
  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return normalizeDeg(brng);
};

export const bearingAlongPolyline = (coords: LatLng[], segmentIndex: number, lookahead = 3) => {
  if (coords.length < 2) return 0;
  const clampedIdx = Math.max(0, Math.min(coords.length - 2, segmentIndex));
  const forwardIdx = Math.min(coords.length - 1, clampedIdx + lookahead);
  const backwardIdx = Math.max(0, clampedIdx - lookahead);
  const start = coords[clampedIdx];
  const end =
    forwardIdx !== clampedIdx
      ? coords[forwardIdx]
      : backwardIdx !== clampedIdx
        ? coords[backwardIdx]
        : coords[Math.min(coords.length - 1, clampedIdx + 1)];
  return bearingDeg(start, end);
};

const findSegmentIndex = (cumDist: number[], distance: number) => {
  if (!cumDist.length) return 0;
  let low = 0;
  let high = cumDist.length - 1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (cumDist[mid] <= distance) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return Math.max(0, Math.min(cumDist.length - 2, high));
};

const coordAtDistance = (coords: LatLng[], cumDist: number[], distance: number) => {
  if (coords.length < 2 || cumDist.length !== coords.length) return coords[0];
  const total = cumDist[cumDist.length - 1] || 0;
  const clamped = Math.max(0, Math.min(total, distance));
  const idx = findSegmentIndex(cumDist, clamped);
  const start = coords[idx];
  const end = coords[idx + 1] || coords[idx];
  const segmentLen = cumDist[idx + 1] - cumDist[idx] || 1;
  const t = Math.max(0, Math.min(1, (clamped - cumDist[idx]) / segmentLen));
  return {
    latitude: start.latitude + (end.latitude - start.latitude) * t,
    longitude: start.longitude + (end.longitude - start.longitude) * t,
  };
};

export const bearingAlongRouteS = (
  coords: LatLng[],
  cumDist: number[],
  currentS: number,
  lookaheadMeters = 8,
) => {
  if (coords.length < 2 || cumDist.length !== coords.length) return 0;
  const start = coordAtDistance(coords, cumDist, Math.max(0, currentS - 2));
  const end = coordAtDistance(coords, cumDist, currentS + lookaheadMeters);
  return bearingDeg(start, end);
};

export const offsetCoordByMeters = (origin: LatLng, bearing: number, distanceMeters: number): LatLng => {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;
  const brng = toRad(bearing);
  const lat1 = toRad(origin.latitude);
  const lon1 = toRad(origin.longitude);
  const delta = distanceMeters / R;

  const sinLat1 = Math.sin(lat1);
  const cosLat1 = Math.cos(lat1);
  const sinDelta = Math.sin(delta);
  const cosDelta = Math.cos(delta);

  const lat2 = Math.asin(sinLat1 * cosDelta + cosLat1 * sinDelta * Math.cos(brng));
  const lon2 =
    lon1 + Math.atan2(Math.sin(brng) * sinDelta * cosLat1, cosDelta - sinLat1 * Math.sin(lat2));

  return { latitude: toDeg(lat2), longitude: toDeg(lon2) };
};
