import { LatLng, NavPackage } from './navTypes';

export type RouteLocalizationOptions = {
  behindWindow?: number;
  headingWeight?: number;
  backtrackWeight?: number;
  offRouteDistance?: number;
  offRouteDurationMs?: number;
  rejoinAheadMeters?: number;
};

export type LocalizationResult = {
  currentS: number;
  currentSegIdx: number;
  segmentIndex: number;
  distanceToRoute: number;
  snappedLocation: LatLng;
  rawLocation: LatLng;
  segmentHeading: number;
  offRoute: boolean;
  candidateCount: number;
  windowStart: number;
  windowEnd: number;
  rejoinTarget?: LatLng;
};

type LocalizerState = {
  currentS: number;
  currentSegIdx: number;
  lastUpdateTs: number;
  lastDistanceToRoute: number;
  offRouteSince: number | null;
};

const DEFAULTS: Required<RouteLocalizationOptions> = {
  behindWindow: 50,
  headingWeight: 0.6,
  backtrackWeight: 3,
  offRouteDistance: 30,
  offRouteDurationMs: 5000,
  rejoinAheadMeters: 50,
};

export const createRouteLocalizer = (navPackage: NavPackage, options: RouteLocalizationOptions = {}) => {
  const settings = { ...DEFAULTS, ...options };
  const polyline = navPackage.matchedPolyline;
  const cumDist = navPackage.cumDist;
  const total = cumDist.length ? cumDist[cumDist.length - 1] : 0;
  const state: LocalizerState = {
    currentS: 0,
    currentSegIdx: 0,
    lastUpdateTs: 0,
    lastDistanceToRoute: Infinity,
    offRouteSince: null,
  };

  const update = (
    gps: LatLng,
    heading?: number,
    speed = 0,
    timestamp = Date.now(),
  ): LocalizationResult => {
    const dt = state.lastUpdateTs ? Math.max(0.5, (timestamp - state.lastUpdateTs) / 1000) : 1;
    const aheadWindow = Math.max(200, speed * dt + 120);
    const startDist = Math.max(0, state.currentS - settings.behindWindow);
    const endDist = Math.min(total, state.currentS + aheadWindow);
    const startIdx = Math.max(0, findSegmentIndex(cumDist, startDist) - 1);
    const endIdx = Math.min(polyline.length - 2, findSegmentIndex(cumDist, endDist));

    let bestScore = Infinity;
    let bestDistance = Infinity;
    let bestAlong = state.currentS;
    let bestPoint = polyline[Math.max(0, Math.min(polyline.length - 1, state.currentSegIdx))] || gps;
    let bestHeading = heading || 0;
    let candidateCount = 0;
    let bestSegIdx = state.currentSegIdx;

    for (let i = startIdx; i <= endIdx; i += 1) {
      const projection = projectPointToSegment(gps, polyline[i], polyline[i + 1]);
      const along = cumDist[i] + projection.distanceAlongSegment;
      const segmentHeading = bearingDegrees(polyline[i], polyline[i + 1]);
      const headingMismatch = Number.isFinite(heading) ? angleDelta(heading as number, segmentHeading) : 0;
      const headingPenalty =
        headingMismatch > 90
          ? headingMismatch * settings.headingWeight * 2
          : headingMismatch * settings.headingWeight;
      const backtrack = along < state.currentS - 10 ? (state.currentS - along) * settings.backtrackWeight : 0;
      const score = projection.distanceToRoute + headingPenalty + backtrack;
      candidateCount += 1;
      if (score < bestScore) {
        bestScore = score;
        bestDistance = projection.distanceToRoute;
        bestAlong = along;
        bestPoint = projection.projectedPoint;
        bestHeading = segmentHeading;
        bestSegIdx = i;
      }
    }

    let nextS = bestAlong;
    if (speed > 0.5 && nextS < state.currentS - 10) {
      nextS = state.currentS - 10;
    }

    if (speed < 1 && Math.abs(nextS - state.currentS) < 5 && bestDistance > state.lastDistanceToRoute + 2) {
      nextS = state.currentS;
    }
    if (bestDistance > state.lastDistanceToRoute + 8 && Math.abs(nextS - state.currentS) < 3) {
      nextS = state.currentS;
    }

    const instantOffRoute = bestDistance > Math.max(40, settings.offRouteDistance + 10);
    if (bestDistance > settings.offRouteDistance) {
      if (!state.offRouteSince) state.offRouteSince = timestamp;
    } else {
      state.offRouteSince = null;
    }
    const durationOffRoute =
      state.offRouteSince && timestamp - state.offRouteSince >= settings.offRouteDurationMs;
    const offRoute = instantOffRoute || !!durationOffRoute;

    let rejoinTarget: LatLng | undefined;
    if (offRoute) {
      let bestAheadDistance = Infinity;
      for (let i = startIdx; i <= endIdx; i += 1) {
        const projection = projectPointToSegment(gps, polyline[i], polyline[i + 1]);
        const along = cumDist[i] + projection.distanceAlongSegment;
        if (along < state.currentS + settings.rejoinAheadMeters) continue;
        if (projection.distanceToRoute < bestAheadDistance) {
          bestAheadDistance = projection.distanceToRoute;
          rejoinTarget = projection.projectedPoint;
        }
      }
    }

    state.currentS = Math.max(0, Math.min(total, nextS));
    state.currentSegIdx = bestSegIdx;
    state.lastUpdateTs = timestamp;
    state.lastDistanceToRoute = bestDistance;

    return {
      currentS: state.currentS,
      currentSegIdx: state.currentSegIdx,
      segmentIndex: state.currentSegIdx,
      distanceToRoute: bestDistance,
      snappedLocation: bestPoint,
      rawLocation: gps,
      segmentHeading: bestHeading,
      offRoute,
      candidateCount,
      windowStart: startDist,
      windowEnd: endDist,
      rejoinTarget,
    };
  };

  return { update };
};

export const buildCumulativeDistances = (coords: LatLng[]) => {
  if (coords.length < 2) return [];
  const distances = [0];
  let total = 0;
  for (let i = 1; i < coords.length; i += 1) {
    total += distanceMeters(coords[i - 1], coords[i]);
    distances.push(total);
  }
  return distances;
};

export const projectPointToPolyline = (point: LatLng, polyline: LatLng[], cumDist: number[]) => {
  if (polyline.length < 2 || cumDist.length !== polyline.length) return null;
  let bestDistance = Infinity;
  let bestAlong = 0;
  for (let i = 0; i < polyline.length - 1; i += 1) {
    const projection = projectPointToSegment(point, polyline[i], polyline[i + 1]);
    if (projection.distanceToRoute < bestDistance) {
      bestDistance = projection.distanceToRoute;
      bestAlong = cumDist[i] + projection.distanceAlongSegment;
    }
  }
  return bestAlong;
};

const findSegmentIndex = (cumDist: number[], distance: number) => {
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

const projectPointToSegment = (p: LatLng, v: LatLng, w: LatLng) => {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toXY = (coord: LatLng) => {
    const lat = toRad(coord.latitude);
    const lon = toRad(coord.longitude);
    return { x: lon * Math.cos(lat), y: lat };
  };
  const pv = toXY(v);
  const pw = toXY(w);
  const pp = toXY(p);
  const vx = pw.x - pv.x;
  const vy = pw.y - pv.y;
  const denom = vx * vx + vy * vy || 1;
  const t = Math.max(0, Math.min(1, ((pp.x - pv.x) * vx + (pp.y - pv.y) * vy) / denom));
  const proj = {
    latitude: v.latitude + (w.latitude - v.latitude) * t,
    longitude: v.longitude + (w.longitude - v.longitude) * t,
  };
  return {
    distanceToRoute: distanceMeters(p, proj),
    distanceAlongSegment: distanceMeters(v, proj),
    projectedPoint: proj,
  };
};

const distanceMeters = (a: LatLng, b: LatLng) => {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const c =
    2 * Math.atan2(
      Math.sqrt(sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon),
      Math.sqrt(1 - (sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon)),
    );
  return R * c;
};

const bearingDegrees = (a: LatLng, b: LatLng) => {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const y = Math.sin(toRad(b.longitude - a.longitude)) * Math.cos(toRad(b.latitude));
  const x =
    Math.cos(toRad(a.latitude)) * Math.sin(toRad(b.latitude)) -
    Math.sin(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.cos(toRad(b.longitude - a.longitude));
  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return (brng + 360) % 360;
};

const angleDelta = (a: number, b: number) => {
  let d = Math.abs(a - b) % 360;
  if (d > 180) d = 360 - d;
  return d;
};
