import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Text, ProgressBar, IconButton, Portal, Modal } from 'react-native-paper';
import * as Location from 'expo-location';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { RouteDto, apiRoutes } from '../../api';
import { getRouteCoords, metersToKm } from '../../utils';
import { spacing, colors } from '../../styles/theme';
import { queuePracticeSession, upsertRouteStat } from '../../db';
import { snapToRoads } from '../../lib/directions';
import {
  getDirections,
  NavStep,
  LatLng,
  BannerInstruction as DirectionsBannerInstruction,
  BannerText as DirectionsBannerText,
  BannerComponent as DirectionsBannerComponent,
} from '../../lib/mapboxNavigation';
import { buildNavPackage } from '../../navigation/mapboxMatching';
import {
  NavPackage,
  Step as MatchingStep,
  BannerInstruction as MatchingBannerInstruction,
  BannerText as MatchingBannerText,
  BannerComponent as MatchingBannerComponent,
} from '../../navigation/navTypes';
import {
  createRouteLocalizer,
  buildCumulativeDistances,
  projectPointToPolyline,
  LocalizationResult,
} from '../../navigation/routeLocalization';
import {
  lerpAngleDeg,
  lerpCoord,
  offsetCoordByMeters,
  shortestAngleDelta,
} from '../../navigation/carMarker';
import { createInstructionEngine, InstructionUpdate } from '../../navigation/instructionEngine';
import MapboxGL from '../../lib/mapbox';
import MapboxNavigationSdkView, { isMapboxNavSdkAvailable } from '../../components/MapboxNavigationSdkView';
import * as Speech from 'expo-speech';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { CONSENT_KEYS, consentNow, getConsentValue, setConsentValue } from '../../utils/consent';
import LocationConsentModal from '../../components/LocationConsentModal';
import { apiAuth } from '../../api';
import { formatDistanceDisplayUK } from '../../navigation/units';

const haversine = (a: LatLng, b: LatLng) => {
  const toRad = (d: number) => (d * Math.PI) / 180;
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

const ROUTE_LINE_WIDTH = 14;
const ROUTE_LINE_WIDTH_ALT = 10;
const START_ENTER_RADIUS_M = 40;
const START_ENTER_BEARING_DEG = 45;
const START_ENTER_MAX_S = 50;
const FINISH_REMAINING_M = 30;

const bearingBetween = (a: LatLng, b: LatLng) => {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const y = Math.sin(toRad(b.longitude - a.longitude)) * Math.cos(toRad(b.latitude));
  const x =
    Math.cos(toRad(a.latitude)) * Math.sin(toRad(b.latitude)) -
    Math.sin(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.cos(toRad(b.longitude - a.longitude));
  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return (brng + 360) % 360;
};

type CarMarkerState = {
  coord: LatLng;
  heading: number;
  rawHeading: number | null;
  routeHeading: number | null;
  markerMode: 'SNAPPED' | 'RAW';
  speedMps: number;
  headingFrozen: boolean;
  distanceToRoute: number | null;
  segmentIndex: number | null;
  s: number | null;
};

const PracticeScreen: React.FC<NativeStackScreenProps<any>> = ({ route, navigation }) => {
  const insets = useSafeAreaInsets();
  const initialRoute = route?.params?.route as RouteDto | undefined;
  const simulateRoute = route?.params?.simulateRoute === true;
  const [routeDto, setRouteDto] = useState<RouteDto | undefined>(initialRoute);
  const [polyline, setPolyline] = useState<LatLng[]>(
    initialRoute ? sanitizeCoords(getRouteCoords(initialRoute)) : [],
  );

  const [speedLimits, setSpeedLimits] = useState<Array<{lat: number, lon: number, speed: number}>>([]);
  const [trafficControls, setTrafficControls] = useState<Array<{lat: number, lon: number, type: string}>>([]);

  // Fetch route details if payload is missing
  useEffect(() => {
    if (routeDto && !routeDto.payload && routeDto.id) {
      apiRoutes.detail(routeDto.id).then((res) => {
        const data = res.data.data || res.data;
        const updated = { ...routeDto, ...data };
        setRouteDto(updated);
        setPolyline(sanitizeCoords(getRouteCoords(updated)));
        
        // Extract speed limits and controls from instructions
        if (updated.payload?.instructions) {
          const speeds: Array<{lat: number, lon: number, speed: number}> = [];
          const controls: Array<{lat: number, lon: number, type: string}> = [];
          
          updated.payload.instructions.forEach((ins: any) => {
            if (ins.speed_limit_mph_final && ins.location) {
              speeds.push({
                lat: ins.location.lat,
                lon: ins.location.lon,
                speed: ins.speed_limit_mph_final
              });
            }
            if (ins.traffic_signals && Array.isArray(ins.traffic_signals) && ins.location) {
              ins.traffic_signals.forEach(() => {
                controls.push({
                  lat: ins.location.lat,
                  lon: ins.location.lon,
                  type: 'traffic_signals'
                });
              });
            }
            if (ins.stop && Array.isArray(ins.stop) && ins.location) {
              ins.stop.forEach(() => {
                controls.push({
                  lat: ins.location.lat,
                  lon: ins.location.lon,
                  type: 'stop'
                });
              });
            }
            if (ins.give_way && Array.isArray(ins.give_way) && ins.location) {
              ins.give_way.forEach(() => {
                controls.push({
                  lat: ins.location.lat,
                  lon: ins.location.lon,
                  type: 'give_way'
                });
              });
            }
            if (ins.crossing && Array.isArray(ins.crossing) && ins.location) {
              ins.crossing.forEach(() => {
                controls.push({
                  lat: ins.location.lat,
                  lon: ins.location.lon,
                  type: 'crossing'
                });
              });
            }
          });
          
          setSpeedLimits(speeds);
          setTrafficControls(controls);
        }
      }).catch((err) => {
        console.warn('Failed to fetch route details:', err);
      });
    }
  }, [routeDto?.id, routeDto?.payload]);
  const [tracking, setTracking] = useState(false);
  const [navPhase, setNavPhase] = useState<'TO_START' | 'ON_GPX' | 'FINISHED'>('TO_START');
  const navPhaseRef = useRef<'TO_START' | 'ON_GPX' | 'FINISHED'>('TO_START');
  const hasStartedGpxRef = useRef(false);
  const [cameraMode, setCameraMode] = useState<'FOLLOW' | 'FREE' | 'OVERVIEW'>('FOLLOW');
  const [positions, setPositions] = useState<LatLng[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [distanceM, setDistanceM] = useState(0);
  const distanceMRef = useRef(0);
  const [speedMps, setSpeedMps] = useState(0);
  const [onRoute, setOnRoute] = useState(false);
  // Extract speed limits and controls from route payload
  useEffect(() => {
    if (routeDto?.payload?.instructions) {
      const speeds: Array<{lat: number, lon: number, speed: number}> = [];
      const controls: Array<{lat: number, lon: number, type: string}> = [];
      
      routeDto.payload.instructions.forEach((ins: any) => {
        if (ins.speed_limit_mph_final && ins.location) {
          speeds.push({
            lat: ins.location.lat,
            lon: ins.location.lon,
            speed: ins.speed_limit_mph_final
          });
        }
        if (ins.traffic_signals && Array.isArray(ins.traffic_signals) && ins.location) {
          ins.traffic_signals.forEach(() => {
            controls.push({
              lat: ins.location.lat,
              lon: ins.location.lon,
              type: 'traffic_signals'
            });
          });
        }
        if (ins.stop && Array.isArray(ins.stop) && ins.location) {
          ins.stop.forEach(() => {
            controls.push({
              lat: ins.location.lat,
              lon: ins.location.lon,
              type: 'stop'
            });
          });
        }
        if (ins.give_way && Array.isArray(ins.give_way) && ins.location) {
          ins.give_way.forEach(() => {
            controls.push({
              lat: ins.location.lat,
              lon: ins.location.lon,
              type: 'give_way'
            });
          });
        }
        if (ins.crossing && Array.isArray(ins.crossing) && ins.location) {
          ins.crossing.forEach(() => {
            controls.push({
              lat: ins.location.lat,
              lon: ins.location.lon,
              type: 'crossing'
            });
          });
        }
      });
      
      setSpeedLimits(speeds);
      setTrafficControls(controls);
    }
  }, [routeDto?.payload]);
  const onRouteRef = useRef(false);
  const [initialCentered, setInitialCentered] = useState(false);
  const [navToStart, setNavToStart] = useState<LatLng[]>([]);
  const [navToStartSteps, setNavToStartSteps] = useState<NavStep[]>([]);
  const [navToStartStepIdx, setNavToStartStepIdx] = useState(0);
  const [followUser, setFollowUser] = useState(true);
  const [followZoom, setFollowZoom] = useState(18);
  const [toast, setToast] = useState<string | null>(null);
  const [navRoute, setNavRoute] = useState<LatLng[]>([]);
  const [navSteps, setNavSteps] = useState<NavStep[]>([]);
  const [navPackage, setNavPackage] = useState<NavPackage | null>(null);
  const [navPackageStatus, setNavPackageStatus] = useState<
    'idle' | 'loading' | 'matching' | 'directions' | 'enriched'
  >('idle');
  const [navPackageError, setNavPackageError] = useState<string | null>(null);
  const [routeLocalization, setRouteLocalization] = useState<LocalizationResult | null>(null);
  const [instructionState, setInstructionState] = useState<InstructionUpdate | null>(null);
  const [carMarker, setCarMarker] = useState<CarMarkerState | null>(null);
  const carMarkerRef = useRef<CarMarkerState | null>(null);
  const filteredCoordRef = useRef<LatLng | null>(null);
  const filteredHeadingRef = useRef<number | null>(null);
  const lastMarkerTsRef = useRef<number>(0);
  const lastStableHeadingRef = useRef<number | null>(null);
  const headingFrozenRef = useRef(false);
  const offRouteSinceTsRef = useRef<number | null>(null);
  const [rejoinRoute, setRejoinRoute] = useState<LatLng[]>([]);
  const [showRejoinHint, setShowRejoinHint] = useState(false);
  const [showNavDebug, setShowNavDebug] = useState(false);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [navOrigin, setNavOrigin] = useState<LatLng | null>(null);
  const [navDestination, setNavDestination] = useState<LatLng | null>(null);
  const navOriginRef = useRef<LatLng | null>(null);
  const navDestinationRef = useRef<LatLng | null>(null);
  const navPackageRef = useRef<NavPackage | null>(null);
  const routeLocalizerRef = useRef<ReturnType<typeof createRouteLocalizer> | null>(null);
  const instructionEngineRef = useRef<ReturnType<typeof createInstructionEngine> | null>(null);
  const rejoinTargetRef = useRef<LatLng | null>(null);
  const [nativeInstruction, setNativeInstruction] = useState<string | null>(null);
  const [nativeDistanceToInstruction, setNativeDistanceToInstruction] = useState<number | null>(null);
  const [nativeDistanceRemaining, setNativeDistanceRemaining] = useState<number | null>(null);
  const [nativeDurationRemaining, setNativeDurationRemaining] = useState<number | null>(null);
  const [progressLine, setProgressLine] = useState<LatLng[]>([]);
  const [navDistanceM, setNavDistanceM] = useState<number | null>(null);
  const [navDurationS, setNavDurationS] = useState<number | null>(null);
  const [showSafety, setShowSafety] = useState(false);
  const [showLocationPrompt, setShowLocationPrompt] = useState(false);
  const cameraRef = useRef<MapboxGL.Camera | null>(null);
  const [cameraBounds, setCameraBounds] = useState<{ ne: [number, number]; sw: [number, number] } | null>(null);
  const watchSub = useRef<Location.LocationSubscription | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const simRef = useRef<NodeJS.Timeout | null>(null);
  const lastLocation = useRef<LatLng | null>(null);
  const avgSpeed = useRef<number>(0);
  const headingRef = useRef<number>(0);
  const lastSpokenRef = useRef<string | null>(null);
  const offRouteRef = useRef(false);
  const completedCountRef = useRef(0);
  const finishingRef = useRef(false);
  const rerouteInFlightRef = useRef(false);
  const lastRerouteAtRef = useRef(0);
  const [voiceMuted, setVoiceMuted] = useState(false);
  const [isRerouting, setIsRerouting] = useState(false);
  const [rewardVisible, setRewardVisible] = useState(false);
  const pendingStartRef = useRef(false);
  const routeProgressRef = useRef(0);
  const startProgressRef = useRef(0);

  const setNavOriginSafe = (value: LatLng | null) => {
    navOriginRef.current = value;
    setNavOrigin(value);
  };

  const setNavDestinationSafe = (value: LatLng | null) => {
    navDestinationRef.current = value;
    setNavDestination(value);
  };

  const applyNavPackage = (pkg: NavPackage, status: 'matching' | 'directions' | 'enriched') => {
    const normalizedSteps = normalizeStepRanges(pkg.steps);
    const normalizedPackage = { ...pkg, steps: normalizedSteps };
    navPackageRef.current = normalizedPackage;
    setNavPackage(normalizedPackage);
    setNavPackageStatus(status);
    setNavPackageError(null);
    setNavRoute(normalizedPackage.matchedPolyline);
    setNavSteps(buildNavStepsFromMatching(normalizedPackage.steps));
    const total = normalizedPackage.routeLengthM ??
      (normalizedPackage.cumDist.length ? normalizedPackage.cumDist[normalizedPackage.cumDist.length - 1] : null);
    setNavDistanceM(Number.isFinite(total) ? total : null);
    setNavDurationS(null);
    routeLocalizerRef.current = createRouteLocalizer(normalizedPackage);
    instructionEngineRef.current = createInstructionEngine(normalizedPackage.steps, total || 0);
  };

  const ensurePackageSteps = (pkg: NavPackage) => {
    if (pkg.steps.length) return pkg;
    const fallbackSteps = buildStepsFromPolyline(pkg.matchedPolyline);
    const cumDist = pkg.cumDist.length ? pkg.cumDist : buildCumulativeDistances(pkg.matchedPolyline);
    const filledSteps = buildMatchingStepsFromNavSteps(fallbackSteps, pkg.matchedPolyline, cumDist);
    return { ...pkg, cumDist, steps: filledSteps };
  };
  const startAnnouncedRef = useRef(false);
  const navToStartRequestedRef = useRef(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const finishAnnouncedRef = useRef(false);
  const hasMapboxToken = !!process.env.EXPO_PUBLIC_MAPBOX_TOKEN;
  const useNativeNav = hasMapboxToken && isMapboxNavSdkAvailable && !!navOrigin && !!navDestination;
  const routeLine =
    navPackageStatus === 'matching' && navPackage?.matchedPolyline?.length
      ? navPackage.matchedPolyline
      : navRoute.length > 1
        ? navRoute
        : navPackage?.matchedPolyline?.length
          ? navPackage.matchedPolyline
          : polyline;
  const navReady = navPackageStatus !== 'loading' && navPackage !== null;
  const navSourceLabel =
    navPackageStatus === 'enriched'
      ? 'Using Enriched Instructions'
      : navPackageStatus === 'matching'
        ? 'Using Map Matching'
        : navRoute.length > 1 || navPackageStatus === 'directions'
          ? 'Using Directions'
          : 'Using raw GPX (no snap)';
  const routeDistances = useMemo(
    () => (navPackage?.cumDist?.length ? navPackage.cumDist : buildRouteDistances(routeLine)),
    [navPackage, routeLine],
  );
  const navToStartDistances = useMemo(() => buildRouteDistances(navToStart), [navToStart]);
  const navToStartStepDistances = useMemo(
    () => buildStepRouteDistances(navToStartSteps, navToStart, navToStartDistances),
    [navToStartSteps, navToStart, navToStartDistances],
  );
  const routeProgress = routeLocalization;
  const startProgress = useMemo(() => {
    if (!lastLocation.current || navToStart.length < 2) return null;
    return getRouteProgress(lastLocation.current, navToStart, navToStartDistances, startProgressRef.current);
  }, [positions, navToStart, navToStartDistances]);
  useEffect(() => {
    if (routeProgress) routeProgressRef.current = routeProgress.currentS;
  }, [routeProgress]);

  useEffect(() => {
    if (startProgress) startProgressRef.current = startProgress.distanceAlong;
  }, [startProgress]);

  const setPhase = (phase: 'TO_START' | 'ON_GPX' | 'FINISHED') => {
    navPhaseRef.current = phase;
    setNavPhase(phase);
  };

  const enterOnGpx = () => {
    if (navPhaseRef.current === 'ON_GPX') return;
    setPhase('ON_GPX');
    hasStartedGpxRef.current = true;
    setOnRoute(true);
    onRouteRef.current = true;
    setNavToStart([]);
    setNavToStartSteps([]);
    setNavToStartStepIdx(0);
    navToStartRequestedRef.current = false;
    if (navPackageRef.current) {
      routeLocalizerRef.current = createRouteLocalizer(navPackageRef.current);
      instructionEngineRef.current?.reset();
      setRouteLocalization(null);
      setInstructionState(null);
      setRejoinRoute([]);
    }
    if (!startAnnouncedRef.current) {
      startAnnouncedRef.current = true;
      setToast('You are at the start. Navigation begins.');
      speak('You are now at the starting point. Your training route has started.');
    }
    if (isMapboxNavSdkAvailable && navEndPoint) {
      setNavOriginSafe({ ...routeLine[0] });
      setNavDestinationSafe({ ...navEndPoint });
    }
    if (!isMapboxNavSdkAvailable && !navSteps.length) {
      setNavSteps(buildStepsFromPolyline(routeLine));
      setCurrentStepIdx(0);
    }
  };

  useEffect(() => {
    if (!onRoute) {
      setInstructionState(null);
      setRouteLocalization(null);
      setRejoinRoute([]);
      setShowRejoinHint(false);
      rejoinTargetRef.current = null;
    }
  }, [onRoute]);

  const OFF_ROUTE_THRESHOLD = 60;

  useFocusEffect(
    React.useCallback(() => {
      // reset session state whenever the screen is opened
      setTracking(false);
      setPositions([]);
      setProgressLine([]);
      setDistanceM(0);
      distanceMRef.current = 0;
      setElapsed(0);
      setOnRoute(false);
      onRouteRef.current = false;
      setNavToStart([]);
      setNavToStartSteps([]);
      setNavToStartStepIdx(0);
      setNavRoute([]);
      setNavSteps([]);
      setNavPackage(null);
      setNavPackageStatus('idle');
      setNavPackageError(null);
      setRouteLocalization(null);
      setInstructionState(null);
      setCarMarker(null);
      carMarkerRef.current = null;
      filteredCoordRef.current = null;
      filteredHeadingRef.current = null;
      lastMarkerTsRef.current = 0;
      lastStableHeadingRef.current = null;
      headingFrozenRef.current = false;
      setRejoinRoute([]);
      setShowRejoinHint(false);
      setCurrentStepIdx(0);
      setNavDistanceM(null);
      setNavDurationS(null);
      setNavOriginSafe(null);
      setNavDestinationSafe(null);
      setFollowUser(true);
      setFollowZoom(18);
      finishingRef.current = false;
      offRouteRef.current = false;
      rerouteInFlightRef.current = false;
      lastRerouteAtRef.current = 0;
      navPackageRef.current = null;
      routeLocalizerRef.current = null;
      instructionEngineRef.current = null;
      navToStartRequestedRef.current = false;
      startAnnouncedRef.current = false;
      finishAnnouncedRef.current = false;
      routeProgressRef.current = 0;
      startProgressRef.current = 0;
      setNavPhase('TO_START');
      navPhaseRef.current = 'TO_START';
      hasStartedGpxRef.current = false;
      setIsSpeaking(false);
      setIsRerouting(false);
      if (simRef.current) {
        clearInterval(simRef.current);
        simRef.current = null;
      }
      return () => {};
    }, []),
  );

  useEffect(() => {
    (async () => {
      const safety = await getConsentValue(CONSENT_KEYS.safetyAcceptedAt);
      if (!safety) setShowSafety(true);
      const choice = await getConsentValue(CONSENT_KEYS.locationChoice);
      if (choice !== 'allow') return;
      const perm = await Location.getForegroundPermissionsAsync();
      if (perm.status !== 'granted') return;
      try {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
        const current: LatLng = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
        lastLocation.current = current;
        if (cameraRef.current) {
          cameraRef.current.setCamera({
            centerCoordinate: [current.longitude, current.latitude],
            zoomLevel: 15,
            pitch: 30,
            animationDuration: 500,
          });
          setInitialCentered(true);
        }
      } catch (e) {
        // ignore prefetch errors
      }
    })();
  }, []);

  useEffect(() => {
    if (!hasMapboxToken || !isMapboxNavSdkAvailable) return;
    if (!routeLine.length || !lastLocation.current) return;
    if (navOriginRef.current && navDestinationRef.current) return;
    setNavOriginSafe({ ...lastLocation.current });
    setNavDestinationSafe({ ...routeLine[0] });
  }, [hasMapboxToken, isMapboxNavSdkAvailable, routeLine.length]);

  useEffect(() => {
    // fetch full route (with geojson/gpx) for navigation fidelity
    if (!routeDto) return;
    apiRoutes
      .detail(routeDto.id)
      .then((res) => {
        const full = res.data.data || (res.data as any);
        setRouteDto(full);
        const coords = sanitizeCoords(getRouteCoords(full));
        setPolyline(coords);
      })
      .catch(() => {
        // fall back to existing
        const coords = sanitizeCoords(getRouteCoords(routeDto));
        setPolyline(coords);
      });
  }, [routeDto?.id]);

  useEffect(() => {
    if (polyline.length) {
      const lats = polyline.map((p) => p.latitude);
      const lngs = polyline.map((p) => p.longitude);
      setCameraBounds({
        ne: [Math.max(...lngs), Math.max(...lats)],
        sw: [Math.min(...lngs), Math.min(...lats)],
      });
      // reset nav route/steps when route changes
      setNavRoute([]);
      setNavSteps([]);
      setNavPackage(null);
      setNavPackageStatus('idle');
      setNavPackageError(null);
      setRouteLocalization(null);
      setInstructionState(null);
      setRejoinRoute([]);
      setShowRejoinHint(false);
      setCurrentStepIdx(0);
      setNavDistanceM(null);
      setNavDurationS(null);
      setNavToStart([]);
      setNavToStartSteps([]);
      setNavToStartStepIdx(0);
      navToStartRequestedRef.current = false;
      routeProgressRef.current = 0;
      startProgressRef.current = 0;
      finishAnnouncedRef.current = false;
    }
  }, [polyline]);

  useEffect(() => {
    if (!tracking && !initialCentered && cameraBounds && cameraRef.current) {
      cameraRef.current.fitBounds(cameraBounds.ne, cameraBounds.sw, 80, 600);
      setInitialCentered(true);
    }
  }, [tracking, initialCentered, cameraBounds]);

  useEffect(() => {
    return () => {
      watchSub.current?.remove();
      if (timerRef.current) clearInterval(timerRef.current);
      if (simRef.current) clearInterval(simRef.current);
    };
  }, []);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 2000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  useEffect(() => {
    if (
      useNativeNav ||
      !tracking ||
      onRoute ||
      !navToStartSteps.length ||
      !startProgress ||
      !navToStartStepDistances.length
    )
      return;
    const stepDistance = navToStartStepDistances[Math.min(navToStartStepIdx, navToStartStepDistances.length - 1)];
    if (!Number.isFinite(stepDistance)) return;
    if (startProgress.distanceAlong >= stepDistance - 15 && navToStartStepIdx < navToStartSteps.length - 1) {
      const nextIdx = navToStartStepIdx + 1;
      setNavToStartStepIdx(nextIdx);
    }
  }, [
    positions,
    navToStartSteps,
    navToStartStepDistances,
    navToStartStepIdx,
    tracking,
    onRoute,
    useNativeNav,
    startProgress,
  ]);


  const currentStep = useMemo(() => {
    if (!navSteps.length) return null;
    return navSteps[Math.min(currentStepIdx, navSteps.length - 1)];
  }, [navSteps, currentStepIdx]);

  const currentStartStep = useMemo(() => {
    if (!navToStartSteps.length) return null;
    return navToStartSteps[Math.min(navToStartStepIdx, navToStartSteps.length - 1)];
  }, [navToStartSteps, navToStartStepIdx]);

  const distanceToInstruction = useMemo(() => {
    if (!onRoute) return null;
    if (instructionState?.distanceToManeuver == null) return null;
    return Math.max(instructionState.distanceToManeuver, 0);
  }, [onRoute, instructionState]);

  const distanceToStartInstruction = useMemo(() => {
    if (!currentStartStep || !startProgress || !navToStartStepDistances.length) return null;
    const stepDistance = navToStartStepDistances[Math.min(navToStartStepIdx, navToStartStepDistances.length - 1)];
    if (!Number.isFinite(stepDistance)) return null;
    return Math.max(stepDistance - startProgress.distanceAlong, 0);
  }, [currentStartStep, navToStartStepIdx, startProgress, navToStartStepDistances]);

  useEffect(() => {
    if (useNativeNav || !tracking || voiceMuted || !onRoute || !instructionState) return;
    if (instructionState.startAnnouncement && !startAnnouncedRef.current) {
      startAnnouncedRef.current = true;
      speak(instructionState.startAnnouncement);
    }
    if (instructionState.voiceToSpeak) {
      speak(instructionState.voiceToSpeak);
    }
    if (instructionState.arrivalAnnouncement && !finishAnnouncedRef.current) {
      finishAnnouncedRef.current = true;
      speak(instructionState.arrivalAnnouncement);
    }
  }, [instructionState, voiceMuted, useNativeNav, tracking, onRoute]);

  const sampledWaypoints = useMemo(() => {
    if (!polyline.length) return [];
    const maxPoints = 23;
    if (polyline.length <= maxPoints) return polyline;
    const step = Math.ceil(polyline.length / maxPoints);
    const sampled: LatLng[] = [];
    for (let i = 0; i < polyline.length; i += step) {
      sampled.push(polyline[i]);
    }
    if (sampled[sampled.length - 1] !== polyline[polyline.length - 1]) {
      sampled.push(polyline[polyline.length - 1]);
    }
    return sampled;
  }, [polyline]);

  const nativeNavWaypoints = useMemo(() => {
    if (!onRoute || sampledWaypoints.length <= 2) return undefined;
    return sampledWaypoints.slice(1, -1).map((p) => [p.longitude, p.latitude] as [number, number]);
  }, [onRoute, sampledWaypoints]);

  useEffect(() => {
    let cancelled = false;
    if (!polyline.length || useNativeNav) return () => {};
    setNavPackageStatus('loading');
    setNavPackageError(null);
    setNavPackage(null);
    navPackageRef.current = null;
    routeLocalizerRef.current = null;
    instructionEngineRef.current = null;
    setInstructionState(null);
    setRouteLocalization(null);
    setRejoinRoute([]);
    // Use enriched instructions if available
    if (routeDto?.payload?.instructions?.length) {
      const enrichedPackage = buildNavPackageFromInstructions(polyline, routeDto.payload.instructions, 'enriched');
      applyNavPackage(enrichedPackage, 'enriched');
      return () => {};
    }
    if (!hasMapboxToken) {
      const fallbackSteps = buildStepsFromPolyline(polyline);
      const fallbackPackage = buildNavPackageFromDirections(polyline, fallbackSteps, 'local');
      applyNavPackage(fallbackPackage, 'directions');
      return () => {};
    }
    (async () => {
      const matched = await buildNavPackage(polyline, {
        accessToken: process.env.EXPO_PUBLIC_MAPBOX_TOKEN,
        voiceUnits: 'british_imperial',
        language: 'en',
        waypointNames: ['Start', 'Finish'],
      });
      if (cancelled) return;
      if (matched.navPackage) {
        const sourcePackage = matched.navPackage;
        const pkg = sourcePackage.steps.length ? sourcePackage : ensurePackageSteps(sourcePackage);
        applyNavPackage(pkg, 'matching');
        return;
      }
      if (matched.error) {
        setNavPackageError(matched.error.message);
      }
      const start = polyline[0];
      const end = polyline[polyline.length - 1];
      const via = sampledWaypoints.slice(1, -1);
      const res = await getDirections(start, end, via, {
        useTraffic: true,
        annotations: true,
      });
      if (cancelled) return;
      if (res?.coords?.length) {
        const fallbackSteps = res.steps?.length ? res.steps : buildStepsFromPolyline(res.coords);
        const fallbackPackage = buildNavPackageFromDirections(sanitizeCoords(res.coords), fallbackSteps, 'directions');
        applyNavPackage(fallbackPackage, 'directions');
        setNavDistanceM(typeof res.distance === 'number' ? res.distance : null);
        setNavDurationS(typeof res.duration === 'number' ? res.duration : null);
      } else {
        const fallbackSteps = buildStepsFromPolyline(polyline);
        const fallbackPackage = buildNavPackageFromDirections(polyline, fallbackSteps, 'polyline');
        applyNavPackage(fallbackPackage, 'directions');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [polyline, sampledWaypoints, hasMapboxToken, useNativeNav]);

  const instructionIcon = useMemo((): keyof typeof MaterialCommunityIcons.glyphMap => {
    const step = onRoute ? currentStep : currentStartStep;
    const text = (useNativeNav ? nativeInstruction : step?.instruction)?.toLowerCase() || '';
    return getManeuverIconName(step, text);
  }, [currentStep, currentStartStep, onRoute, nativeInstruction, useNativeNav]);

  const routeLengthM = useMemo(() => {
    if (navDistanceM && navDistanceM > 0) return navDistanceM;
    if (routeLine.length < 2) return 0;
    let total = 0;
    for (let i = 0; i < routeLine.length - 1; i++) {
      total += haversine(routeLine[i], routeLine[i + 1]);
    }
    return total;
  }, [routeLine, navDistanceM]);

  const isLoopRoute = useMemo(() => {
    if (routeLine.length < 2) return false;
    return haversine(routeLine[0], routeLine[routeLine.length - 1]) < 20;
  }, [routeLine]);

  const navEndPoint = useMemo(() => {
    if (routeLine.length < 2) return null;
    if (!isLoopRoute) return routeLine[routeLine.length - 1];
    return routeLine[Math.max(routeLine.length - 2, 1)];
  }, [routeLine, isLoopRoute]);

  const finishPoint = useMemo(() => {
    if (routeLine.length < 2) return null;
    return isLoopRoute ? routeLine[0] : routeLine[routeLine.length - 1];
  }, [routeLine, isLoopRoute]);

  const mph = (mps: number) => (mps * 2.23694).toFixed(1);
  const distToStart = useMemo(() => {
    if (!lastLocation.current || !routeLine.length) return 0;
    return haversine(lastLocation.current, routeLine[0]);
  }, [routeLine]);
  const distToFinish = useMemo(() => {
    if (!lastLocation.current || !finishPoint) return 0;
    return haversine(lastLocation.current, finishPoint);
  }, [finishPoint, positions]);
  const distanceRemaining = useMemo(() => {
    if (!lastLocation.current || !routeLine.length) return 0;
    if (onRoute && instructionState?.remainingDistance != null) {
      return Math.max(instructionState.remainingDistance, 0);
    }
    if (isLoopRoute && routeLengthM > 0) {
      return Math.max(routeLengthM - distanceMRef.current, 0);
    }
    if (routeProgress && routeLengthM > 0) {
      return Math.max(routeLengthM - routeProgress.currentS, 0);
    }
    let closestIdx = 0;
    let closest = Infinity;
    routeLine.forEach((p, idx) => {
      const d = haversine(p, lastLocation.current!);
      if (d < closest) {
        closest = d;
        closestIdx = idx;
      }
    });
    let rem = closest;
    for (let i = closestIdx; i < routeLine.length - 1; i++) {
      rem += haversine(routeLine[i], routeLine[i + 1]);
    }
    return rem;
  }, [routeLine, positions, isLoopRoute, routeLengthM, routeProgress, instructionState, onRoute]);

  useEffect(() => {
    if (!routeLine.length) return;
    if (onRoute && routeProgress && routeDistances.length) {
      const idx = findSegmentIndex(routeDistances, routeProgress.currentS);
      setProgressLine(routeLine.slice(0, Math.max(idx + 1, 1)));
      return;
    }
    if (!lastLocation.current) return;
    let closestIdx = 0;
    let closest = Infinity;
    routeLine.forEach((p, idx) => {
      const d = haversine(p, lastLocation.current!);
      if (d < closest) {
        closest = d;
        closestIdx = idx;
      }
    });
    setProgressLine(routeLine.slice(0, Math.max(closestIdx + 1, 1)));
  }, [positions, routeLine, routeProgress, routeDistances, onRoute]);

  const etaMinutes = useMemo(() => {
    const targetSpeed = Math.max(avgSpeed.current || speedMps || 0, 5); // at least ~18 km/h
    if (navDurationS && navDistanceM && distanceRemaining > 0) {
      return (distanceRemaining / navDistanceM) * (navDurationS / 60);
    }
    return distanceRemaining / targetSpeed / 60;
  }, [distanceRemaining, speedMps, navDurationS, navDistanceM]);

  const bannerStep = useMemo(() => (onRoute ? currentStep : currentStartStep), [onRoute, currentStep, currentStartStep]);
  const activeBanner = useMemo(() => {
    if (!onRoute) return bannerStep?.banner || null;
    return instructionState?.banner || bannerStep?.banner || null;
  }, [onRoute, instructionState, bannerStep]);
  const bannerPrimaryText = useMemo(() => {
    if (useNativeNav) return nativeInstruction || '';
    if (isRerouting) return 'Rerouting...';
    if (onRoute && instructionState?.primaryText) return instructionState.primaryText;
    return activeBanner?.primary?.text || bannerStep?.instruction || '';
  }, [useNativeNav, nativeInstruction, bannerStep, isRerouting, activeBanner, onRoute, instructionState]);
  const bannerSecondaryText = useMemo(() => {
    if (useNativeNav) return '';
    if (isRerouting) return 'Updating route';
    if (onRoute && instructionState?.secondaryText) return instructionState.secondaryText;
    const secondary = activeBanner?.secondary?.text || activeBanner?.sub?.text;
    if (secondary) return secondary;
    return formatManeuverSubtitle(bannerStep, onRoute);
  }, [useNativeNav, bannerStep, onRoute, isRerouting, activeBanner, instructionState]);
  const bannerDistanceM = useMemo(() => {
    if (isRerouting) return null;
    if (useNativeNav) return nativeDistanceToInstruction;
    return onRoute ? distanceToInstruction : distanceToStartInstruction;
  }, [useNativeNav, nativeDistanceToInstruction, onRoute, distanceToInstruction, distanceToStartInstruction, isRerouting]);
  const bannerTitle = formatDistanceNav(bannerDistanceM);
  const laneGuidance = useMemo(() => {
    if (useNativeNav) return [];
    const components = activeBanner?.primary?.components || activeBanner?.sub?.components || [];
    return components
      .filter((component) => component.type === 'lane' && component.directions?.length)
      .map((component) => ({
        directions: component.directions || [],
        active: !!component.active || !!component.active_direction,
      }));
  }, [useNativeNav, activeBanner]);

  const ensureSafetyAccepted = async () => {
    const safety = await getConsentValue(CONSENT_KEYS.safetyAcceptedAt);
    if (safety) return true;
    setShowSafety(true);
    return false;
  };

  const ensureLocationAllowed = async () => {
    const choice = await getConsentValue(CONSENT_KEYS.locationChoice);
    if (choice === 'allow') return true;
    setShowLocationPrompt(true);
    return false;
  };

  const speak = (text: string) => {
    const cleaned = text?.trim();
    if (!cleaned) return;
    if (voiceMuted) return;
    if (lastSpokenRef.current === cleaned && isSpeaking) return;
    lastSpokenRef.current = cleaned;
    Speech.stop();
    setIsSpeaking(true);
    Speech.speak(cleaned, {
      language: 'en-GB',
      pitch: 1.0,
      rate: 0.95,
      onDone: () => setIsSpeaking(false),
      onStopped: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false),
    });
  };

  const requestReroute = async (from: LatLng, destination: LatLng, mode: 'route' | 'rejoin' = 'route') => {
    if (useNativeNav || !hasMapboxToken || rerouteInFlightRef.current) return;
    const now = Date.now();
    if (now - lastRerouteAtRef.current < 8000) return;
    rerouteInFlightRef.current = true;
    lastRerouteAtRef.current = now;
    setIsRerouting(true);
    try {
      const bearingAngle = Number.isFinite(headingRef.current) ? headingRef.current : undefined;
      const res = await getDirections(from, destination, [], {
        useTraffic: true,
        annotations: true,
        bearing: bearingAngle !== undefined ? { angle: bearingAngle, tolerance: 45 } : null,
        radiuses: [25],
        avoidManeuverRadius: 200,
      });
      if (res?.coords?.length) {
        const coords = sanitizeCoords(res.coords);
        if (mode === 'rejoin') {
          setRejoinRoute(coords);
        } else {
          setNavRoute(coords);
          setNavSteps(res.steps?.length ? res.steps : buildStepsFromPolyline(res.coords));
          setCurrentStepIdx(0);
          setNavDistanceM(typeof res.distance === 'number' ? res.distance : null);
          setNavDurationS(typeof res.duration === 'number' ? res.duration : null);
        }
      }
    } catch {
      // ignore reroute errors
    } finally {
      rerouteInFlightRef.current = false;
      setIsRerouting(false);
    }
  };

  const updateCarMarker = (
    rawCoord: LatLng,
    rawHeading: number | null,
    speed: number,
    localization: LocalizationResult | null,
    startProgressLocal: ReturnType<typeof getRouteProgress> | null,
    timestamp: number,
  ) => {
    const HARD_RAW_DISTANCE_M = 100;
    const SOFT_RAW_DISTANCE_M = 60;
    const OFF_ROUTE_STABLE_MS = 4000;
    const hasRoute = routeLine.length > 1;
    const hasStartRoute = navToStart.length > 1;
    const speedValue = Number.isFinite(speed) ? speed : 0;
    const isOnRoute = onRouteRef.current;
    const offRouteDistance = localization?.distanceToRoute ?? null;
    const startOffRoute =
      !isOnRoute && startProgressLocal ? startProgressLocal.distanceToRoute > OFF_ROUTE_THRESHOLD : false;
    const isOffRoute = isOnRoute ? localization?.offRoute ?? false : startOffRoute;

    let targetCoord = rawCoord;
    let routeHeading: number | null = null;
    let segmentIndex: number | null = null;
    let currentS: number | null = null;
    let distanceToRoute: number | null = null;
    let snappedCandidate: LatLng | null = null;
    let snappedOnLine: LatLng | null = null;

    if (isOnRoute && localization && hasRoute) {
      segmentIndex = localization.currentSegIdx;
      currentS = localization.currentS;
      distanceToRoute = localization.distanceToRoute;
      routeHeading = bearingFromRouteDistance(routeLine, routeDistances, currentS, 5, 15);
      snappedCandidate = localization.snappedLocation;
      if (routeDistances.length === routeLine.length) {
        snappedOnLine = coordAtDistance(routeLine, routeDistances, currentS);
      }
    } else if (!isOnRoute && startProgressLocal && hasStartRoute) {
      segmentIndex = startProgressLocal.segmentIndex ?? null;
      currentS = startProgressLocal.distanceAlong;
      distanceToRoute = startProgressLocal.distanceToRoute;
      routeHeading = bearingFromRouteDistance(navToStart, navToStartDistances, currentS, 5, 15);
      snappedCandidate = startProgressLocal.snappedPoint ?? null;
      if (navToStartDistances.length === navToStart.length) {
        snappedOnLine = coordAtDistance(navToStart, navToStartDistances, currentS);
      }
    }

    const candidateDistance = distanceToRoute ?? offRouteDistance ?? Infinity;
    if (snappedCandidate && candidateDistance <= SOFT_RAW_DISTANCE_M) {
      targetCoord = snappedOnLine ?? snappedCandidate;
      offRouteSinceTsRef.current = null;
    } else if (snappedCandidate) {
      if (offRouteSinceTsRef.current == null) {
        offRouteSinceTsRef.current = timestamp;
      }
      const offRouteDuration = timestamp - (offRouteSinceTsRef.current || timestamp);
      if (offRouteDuration >= OFF_ROUTE_STABLE_MS || candidateDistance >= HARD_RAW_DISTANCE_M) {
        targetCoord = rawCoord;
      } else {
        targetCoord = snappedOnLine ?? snappedCandidate;
      }
    } else {
      targetCoord = rawCoord;
    }
    const markerMode: 'SNAPPED' | 'RAW' =
      snappedCandidate && candidateDistance <= SOFT_RAW_DISTANCE_M
        ? 'SNAPPED'
        : snappedCandidate && targetCoord !== rawCoord
          ? 'SNAPPED'
          : 'RAW';

    let targetHeading = Number.isFinite(rawHeading) ? (rawHeading as number) : filteredHeadingRef.current ?? 0;
    let headingFrozen = false;

    if (speedValue < 1) {
      headingFrozen = true;
      if (lastStableHeadingRef.current != null) {
        targetHeading = lastStableHeadingRef.current;
      } else if (routeHeading != null) {
        targetHeading = routeHeading;
      }
    } else if (routeHeading != null) {
      targetHeading = routeHeading;
      lastStableHeadingRef.current = routeHeading;
    } else if (Number.isFinite(rawHeading)) {
      targetHeading = rawHeading as number;
      lastStableHeadingRef.current = targetHeading;
    }

    if (isOffRoute && lastStableHeadingRef.current != null) {
      if (markerMode === 'RAW') {
        targetHeading = lastStableHeadingRef.current;
      }
    }

    const alphaPosition = speedValue < 3 ? 0.15 : speedValue < 10 ? 0.25 : 0.35;
    const previousCoord = filteredCoordRef.current || targetCoord;
    const shouldStickToLine = markerMode === 'SNAPPED' && snappedOnLine != null;
    const filteredCoord = shouldStickToLine ? targetCoord : lerpCoord(previousCoord, targetCoord, alphaPosition);
    const prevHeading = filteredHeadingRef.current ?? targetHeading;
    const filteredHeading = lerpAngleDeg(prevHeading, targetHeading, 0.15);

    filteredCoordRef.current = filteredCoord;
    filteredHeadingRef.current = filteredHeading;
    lastMarkerTsRef.current = timestamp;
    headingFrozenRef.current = headingFrozen;

    const nextMarker: CarMarkerState = {
      coord: filteredCoord,
      heading: filteredHeading,
      rawHeading: Number.isFinite(rawHeading) ? (rawHeading as number) : null,
      routeHeading,
      markerMode,
      speedMps: speedValue,
      headingFrozen,
      distanceToRoute: distanceToRoute ?? offRouteDistance,
      segmentIndex,
      s: currentS,
    };
    carMarkerRef.current = nextMarker;
    setCarMarker(nextMarker);
  };

  const handleLocationUpdate = (loc: Location.LocationObject) => {
    setPositions((prev) => {
      const next: LatLng[] = [...prev, { latitude: loc.coords.latitude, longitude: loc.coords.longitude }];
      if (next.length > 1) {
        const delta = haversine(next[next.length - 2], next[next.length - 1]);
        const nextDistance = distanceMRef.current + delta;
        distanceMRef.current = nextDistance;
        setDistanceM(nextDistance);
        setSpeedMps(loc.coords.speed ?? 0);
        avgSpeed.current = avgSpeed.current
          ? avgSpeed.current * 0.8 + (loc.coords.speed ?? 0) * 0.2
          : loc.coords.speed ?? 0;
      }
      lastLocation.current = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      const heading =
        typeof loc.coords.heading === 'number'
          ? loc.coords.heading
          : next.length > 1
            ? bearingBetween(next[next.length - 2], next[next.length - 1])
            : undefined;
      if (heading !== undefined) headingRef.current = heading;
      let localization: LocalizationResult | null = null;
      if (onRouteRef.current && navPackageRef.current && routeLocalizerRef.current && lastLocation.current) {
        localization = routeLocalizerRef.current.update(
          lastLocation.current,
          headingRef.current,
          loc.coords.speed ?? 0,
          loc.timestamp ?? Date.now(),
        );
        setRouteLocalization(localization);
        routeProgressRef.current = localization.currentS;
        if (instructionEngineRef.current) {
          const startCoord = navPackageRef.current?.startCoord || routeLine[0];
          const endCoord =
            navPackageRef.current?.endCoord || navEndPoint || routeLine[routeLine.length - 1];
          const distanceToStart = startCoord ? haversine(localization.snappedLocation, startCoord) : null;
          const distanceToEnd = endCoord ? haversine(localization.snappedLocation, endCoord) : null;
          const update = instructionEngineRef.current.update(localization.currentS, loc.coords.speed ?? 0, {
            distanceToStart,
            distanceToEnd,
            hasStartedGpx: hasStartedGpxRef.current,
          });
          setInstructionState(update);
          setCurrentStepIdx(update.stepIdx);
        }
        if (localization.offRoute) {
          if (!offRouteRef.current) {
            setToast('Off route. Return to the route ahead.');
          }
          offRouteRef.current = true;
          if (localization.rejoinTarget) {
            rejoinTargetRef.current = localization.rejoinTarget;
            setShowRejoinHint(true);
          }
        } else {
          offRouteRef.current = false;
          setRejoinRoute((prev) => (prev.length ? [] : prev));
          setShowRejoinHint(false);
          rejoinTargetRef.current = null;
        }
      }
      const startProgressLocal =
        !onRouteRef.current && lastLocation.current && navToStart.length > 1
          ? getRouteProgress(lastLocation.current, navToStart, navToStartDistances, startProgressRef.current)
          : null;
      if (startProgressLocal) startProgressRef.current = startProgressLocal.distanceAlong;
      updateCarMarker(
        lastLocation.current,
        Number.isFinite(headingRef.current) ? headingRef.current : null,
        loc.coords.speed ?? 0,
        localization,
        startProgressLocal,
        loc.timestamp ?? Date.now(),
      );
      if (isMapboxNavSdkAvailable && routeLine.length) {
        if (!onRouteRef.current && !navOriginRef.current) {
          setNavOriginSafe({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
          setNavDestinationSafe({ ...routeLine[0] });
        } else if (onRouteRef.current && !navDestinationRef.current && navEndPoint) {
          setNavOriginSafe({ ...routeLine[0] });
          setNavDestinationSafe({ ...navEndPoint });
        }
      }
      if (navPhaseRef.current === 'TO_START' && routeLine.length > 1 && lastLocation.current) {
        const startCoord = routeLine[0];
        const dStart = haversine(lastLocation.current, startCoord);
        const firstBearing =
          routeLine.length > 1 ? bearingBetween(routeLine[0], routeLine[1]) : null;
        const headingDelta =
          Number.isFinite(headingRef.current) && firstBearing !== null
            ? Math.abs(shortestAngleDelta(headingRef.current, firstBearing))
            : Infinity;
        const sCandidate =
          routeDistances.length === routeLine.length
            ? projectPointToPolyline(lastLocation.current, routeLine, routeDistances)
            : null;
        const sOk = sCandidate != null && sCandidate >= 0 && sCandidate <= START_ENTER_MAX_S;
        if (dStart <= START_ENTER_RADIUS_M && headingDelta <= START_ENTER_BEARING_DEG && sOk) {
          enterOnGpx();
        } else {
          // build a nav line + steps from user to start once
          if (!isMapboxNavSdkAvailable && !navToStartRequestedRef.current && lastLocation.current) {
            navToStartRequestedRef.current = true;
            getDirections(lastLocation.current, routeLine[0], [], { useTraffic: true, annotations: true })
              .then((res) => {
                if (res && res.coords.length > 1) {
                  setNavToStart(sanitizeCoords(res.coords));
                  setNavToStartSteps(
                    res.steps?.length ? res.steps : buildStepsFromPolyline([lastLocation.current!, routeLine[0]]),
                  );
                  setNavToStartStepIdx(0);
                  return;
                }
                return snapToRoads([lastLocation.current!, routeLine[0]]).then((snap) => {
                  setNavToStart(snap || [lastLocation.current!, routeLine[0]]);
                });
              })
              .catch(() => {
                snapToRoads([lastLocation.current!, routeLine[0]])
                  .then((snap) => setNavToStart(snap || [lastLocation.current!, routeLine[0]]))
                  .catch(() => setNavToStart([lastLocation.current!, routeLine[0]]));
              });
          }
        }
      }
      // auto-finish when close to end
      if (tracking && navPhaseRef.current === 'ON_GPX' && routeLengthM > 0 && !finishingRef.current) {
        const progressDistance = routeProgressRef.current || distanceMRef.current;
        const remainingDistance = Math.max(routeLengthM - progressDistance, 0);
        if (remainingDistance <= FINISH_REMAINING_M && progressDistance > routeLengthM * 0.9) {
          finishingRef.current = true;
          setPhase('FINISHED');
          finishTracking(true);
        }
      }
      if (followUser) {
        const speed = loc.coords.speed ?? 0;
        const targetZoom = speed < 2 ? 18.5 : speed < 6 ? 18 : speed < 12 ? 17.5 : 17;
        if (Math.abs(targetZoom - followZoom) > 0.1) {
          setFollowZoom(targetZoom);
        }
        if (!useNativeNav && cameraRef.current && carMarkerRef.current) {
          const marker = carMarkerRef.current;
          const leadMeters = speed < 3 ? 25 : speed < 10 ? 45 : 70;
          const target = offsetCoordByMeters(marker.coord, marker.heading, leadMeters);
          cameraRef.current.setCamera({
            centerCoordinate: [target.longitude, target.latitude],
            heading: marker.heading,
            pitch: 55,
            zoomLevel: targetZoom,
            animationDuration: 350,
            animationMode: 'easeTo',
          });
        }
        if (!initialCentered) setInitialCentered(true);
      }

      // off-route detection for start path
      if (lastLocation.current && !onRouteRef.current && navToStart.length > 1) {
        const nearest = closestDistanceToRoute(lastLocation.current, navToStart);
        const off = nearest > OFF_ROUTE_THRESHOLD;
        if (off) {
          if (!offRouteRef.current) {
            setToast('Off route. Head back to the start path.');
          }
          offRouteRef.current = true;
        } else {
          offRouteRef.current = false;
        }
      }
      return next;
    });
  };

  const startTracking = async (skipPrompt = false) => {
    if (!useNativeNav && !navReady) {
      setToast('Preparing navigation...');
      return;
    }
    const okSafety = await ensureSafetyAccepted();
    if (!okSafety) return;
    if (!simulateRoute) {
      if (!skipPrompt) {
        const okLocation = await ensureLocationAllowed();
        if (!okLocation) {
          pendingStartRef.current = true;
          return;
        }
      }
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') return;
    }
    if (routeLine.length < 2) {
      setToast('Route data is incomplete. Please try again later.');
      return;
    }
    // Announce distance to start if we have a fix and a route
    if (lastLocation.current && routeLine.length) {
      const dStart = haversine(lastLocation.current, routeLine[0]);
      if (dStart <= 40) {
        setToast('You are at the start. Navigation begins.');
      } else {
        setToast(`You are ${formatDistanceShort(dStart)} from start. Head there to begin.`);
      }
      if (isMapboxNavSdkAvailable) {
        setNavOriginSafe({ ...lastLocation.current });
        setNavDestinationSafe({ ...routeLine[0] });
      }
    } else {
      setToast('Starting navigation...');
    }
    setTracking(true);
    setFollowUser(true);
    setOnRoute(false);
    onRouteRef.current = false;
    setPhase('TO_START');
    navPhaseRef.current = 'TO_START';
    hasStartedGpxRef.current = false;
    finishingRef.current = false;
    startAnnouncedRef.current = false;
    finishAnnouncedRef.current = false;
    lastSpokenRef.current = null;
    if (simulateRoute) {
      if (simRef.current) clearInterval(simRef.current);
      const simLine =
        navPackageRef.current?.matchedPolyline?.length ? navPackageRef.current.matchedPolyline : routeLine;
      const simDistances =
        navPackageRef.current?.cumDist?.length ? navPackageRef.current.cumDist : buildCumulativeDistances(simLine);
      const total = simDistances[simDistances.length - 1] || 0;
      const speed = 8;
      let simS = 0;
      if (simLine.length > 1) {
        handleLocationUpdate({
          coords: {
            latitude: simLine[0].latitude,
            longitude: simLine[0].longitude,
            speed,
            heading: bearingBetween(simLine[0], simLine[1]),
          },
          timestamp: Date.now(),
        } as Location.LocationObject);
      }
      simRef.current = setInterval(() => {
        if (simLine.length < 2 || total <= 0) return;
        simS = Math.min(simS + speed, total);
        const idx = findSegmentIndex(simDistances, simS);
        const start = simLine[idx];
        const end = simLine[idx + 1] || simLine[idx];
        const segmentDistance = simDistances[idx + 1] - simDistances[idx] || 1;
        const t = Math.max(0, Math.min(1, (simS - simDistances[idx]) / segmentDistance));
        const lat = start.latitude + (end.latitude - start.latitude) * t;
        const lon = start.longitude + (end.longitude - start.longitude) * t;
        handleLocationUpdate({
          coords: { latitude: lat, longitude: lon, speed, heading: bearingBetween(start, end) },
          timestamp: Date.now(),
        } as Location.LocationObject);
      }, 1000);
    } else {
      watchSub.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Highest, distanceInterval: 2, timeInterval: 1000 },
        handleLocationUpdate,
      );
    }

    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    if (routeDto) {
      try {
        await apiRoutes.startPractice(routeDto.id);
      } catch {
        // ignore start errors to avoid crashing the session
      }
    }
  };

  const finishTracking = async (completed: boolean, goBack = false) => {
    watchSub.current?.remove();
    if (timerRef.current) clearInterval(timerRef.current);
    if (simRef.current) clearInterval(simRef.current);
    simRef.current = null;
    setTracking(false);
    setPositions([]);
    setProgressLine([]);
    setDistanceM(0);
    distanceMRef.current = 0;
    routeProgressRef.current = 0;
    startProgressRef.current = 0;
    setRouteLocalization(null);
    setInstructionState(null);
    setRejoinRoute([]);
    setShowRejoinHint(false);
    setElapsed(0);
    if (isMapboxNavSdkAvailable && lastLocation.current && routeLine.length) {
      setNavOriginSafe({ ...lastLocation.current });
      setNavDestinationSafe({ ...routeLine[0] });
    } else {
      setNavOriginSafe(null);
      setNavDestinationSafe(null);
    }
    if (routeDto) {
      try {
        await apiRoutes.finishPractice(routeDto.id, { completed, distanceM, durationS: elapsed });
      } catch {
        // ignore finish errors; local stats still update
      }
      if (completed) {
        if (!finishAnnouncedRef.current) {
          finishAnnouncedRef.current = true;
          speak('Route completed. Great job! Try another route to keep progressing.');
        }
        upsertRouteStat(routeDto.id, { timesCompleted: 1, lastCompletedAt: Date.now() });
        completedCountRef.current += 1;
        setRewardVisible(true);
      }
      queuePracticeSession({
        id: `${Date.now()}`,
        routeId: routeDto.id,
        startedAt: Date.now() - elapsed * 1000,
        endedAt: Date.now(),
        completed,
        distanceM,
        durationS: elapsed,
      });
    }
    if (!completed) {
      setToast('Session stopped. Progress reset.');
    }
    if (goBack) {
      navigation.goBack();
    }
  };

  if (!routeDto) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          <Card style={styles.bottomSheet}>
            <Card.Content>
              <Text variant="titleMedium">No route provided</Text>
              <Text style={{ color: colors.muted, marginVertical: spacing(1) }}>
                Go back and select a route to practice.
              </Text>
              <Button mode="contained" onPress={() => navigation.goBack()}>
                Back
              </Button>
            </Card.Content>
          </Card>
        </View>
      </SafeAreaView>
    );
  }

  const startPoint = routeLine[0];
  const endPoint = navEndPoint ?? routeLine[routeLine.length - 1];

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {!tracking && (
          <IconButton
            icon="arrow-left"
            onPress={() => navigation.goBack()}
            style={[styles.backButton, { top: insets.top + spacing(1) }]}
            iconColor="#111"
            containerColor="#fff"
          />
        )}
        {useNativeNav ? (
          <MapboxNavigationSdkView
            style={StyleSheet.absoluteFill}
            accessToken={process.env.EXPO_PUBLIC_MAPBOX_TOKEN}
            origin={[navOrigin!.longitude, navOrigin!.latitude]}
            destination={[navDestination!.longitude, navDestination!.latitude]}
            waypoints={nativeNavWaypoints}
            shouldSimulateRoute={false}
            isMuted={!tracking}
            rerouteEnabled
            onProgressChange={({ nativeEvent }) => {
              if (typeof nativeEvent.latitude === 'number' && typeof nativeEvent.longitude === 'number') {
                lastLocation.current = { latitude: nativeEvent.latitude, longitude: nativeEvent.longitude };
              }
              setNativeInstruction(nativeEvent.instruction ?? null);
              setNativeDistanceToInstruction(
                typeof nativeEvent.distanceToInstruction === 'number' ? nativeEvent.distanceToInstruction : null,
              );
              setNativeDistanceRemaining(
                typeof nativeEvent.distanceRemaining === 'number' ? nativeEvent.distanceRemaining : null,
              );
              setNativeDurationRemaining(
                typeof nativeEvent.durationRemaining === 'number' ? nativeEvent.durationRemaining : null,
              );
            }}
          />
        ) : (
          <MapboxGL.MapView
            style={StyleSheet.absoluteFill}
            styleURL="mapbox://styles/mapbox/navigation-night-v1"
            compassEnabled={false}
            rotateEnabled
            onRegionWillChange={(feature) => {
              if (feature?.properties?.isUserInteraction) {
                setFollowUser(false);
                setCameraMode('FREE');
              }
            }}
            onCameraChanged={(state) => {
              if (state?.gestures?.isGestureActive) {
                setFollowUser(false);
                setCameraMode('FREE');
              }
            }}
          >
            <MapboxGL.Camera
              ref={cameraRef}
              pitch={55}
              zoomLevel={followZoom}
            />
            <MapboxGL.UserLocation visible={false} showsUserHeadingIndicator={false} />

            {routeLine.length > 0 && (
              <MapboxGL.ShapeSource id="mainRoute" shape={lineString(routeLine)}>
                <MapboxGL.LineLayer
                  id="mainRouteLine"
                  style={{ lineColor: '#21c7ff', lineWidth: ROUTE_LINE_WIDTH, lineCap: 'round', lineJoin: 'round' }}
                />
              </MapboxGL.ShapeSource>
            )}
            {navToStart.length > 1 && (
              <MapboxGL.ShapeSource id="navToStart" shape={lineString(navToStart)}>
                <MapboxGL.LineLayer
                  id="navToStartLine"
                  style={{
                    lineColor: '#6aa9ff',
                    lineWidth: ROUTE_LINE_WIDTH_ALT,
                    lineDasharray: [2, 2],
                    lineCap: 'round',
                    lineJoin: 'round',
                  }}
                />
              </MapboxGL.ShapeSource>
            )}
            {rejoinRoute.length > 1 && (
              <MapboxGL.ShapeSource id="rejoinRoute" shape={lineString(rejoinRoute)}>
                <MapboxGL.LineLayer
                  id="rejoinRouteLine"
                  style={{
                    lineColor: '#fb923c',
                    lineWidth: ROUTE_LINE_WIDTH_ALT,
                    lineDasharray: [1.5, 1.5],
                    lineCap: 'round',
                    lineJoin: 'round',
                  }}
                />
              </MapboxGL.ShapeSource>
            )}
            {progressLine.length > 1 && (
              <MapboxGL.ShapeSource id="progressLine" shape={lineString(progressLine)}>
                <MapboxGL.LineLayer
                  id="progressLineLayer"
                  style={{
                    lineColor: '#22c55e',
                    lineWidth: ROUTE_LINE_WIDTH,
                    lineOpacity: 0.85,
                    lineCap: 'round',
                    lineJoin: 'round',
                  }}
                />
              </MapboxGL.ShapeSource>
            )}
            {carMarker && (
              <MapboxGL.ShapeSource
                id="carPuck"
                shape={{
                  type: 'Feature',
                  properties: {},
                  geometry: {
                    type: 'Point',
                    coordinates: [carMarker.coord.longitude, carMarker.coord.latitude],
                  },
                }}
              >
                <MapboxGL.CircleLayer
                  id="carPuckOuter"
                  style={{
                    circleRadius: 20,
                    circleColor: '#ffffff',
                    circleOpacity: 0.95,
                    circleStrokeColor: 'rgba(0,0,0,0.15)',
                    circleStrokeWidth: 4,
                  }}
                />
                <MapboxGL.CircleLayer
                  id="carPuckInner"
                  style={{
                    circleRadius: 9,
                    circleColor: '#2563eb',
                    circleOpacity: 1,
                  }}
                />
              </MapboxGL.ShapeSource>
            )}
            {routeLine.length > 0 && (
              <>
                <MapboxGL.PointAnnotation id="start" coordinate={[startPoint.longitude, startPoint.latitude]}>
                  <View style={styles.startMarker} />
                </MapboxGL.PointAnnotation>
                <MapboxGL.PointAnnotation id="finish" coordinate={[endPoint.longitude, endPoint.latitude]}>
                  <View style={styles.finishMarker} />
                </MapboxGL.PointAnnotation>
                {speedLimits.map((sl, idx) => (
                  <MapboxGL.PointAnnotation key={`speed-${idx}`} id={`speed-${idx}`} coordinate={[sl.lon, sl.lat]}>
                    <View style={styles.speedLimitMarker}>
                      <Text style={styles.speedLimitText}>{sl.speed}</Text>
                    </View>
                  </MapboxGL.PointAnnotation>
                ))}
                {trafficControls.map((tc, idx) => (
                  <MapboxGL.PointAnnotation key={`control-${idx}`} id={`control-${idx}`} coordinate={[tc.lon, tc.lat]}>
                    <View style={styles.controlMarker}>
                      <MaterialCommunityIcons 
                        name={tc.type === 'traffic_signals' ? 'traffic-light' : 
                              tc.type === 'stop' ? 'stop' : 
                              tc.type === 'give_way' ? 'arrow-up' : 
                              tc.type === 'crossing' ? 'walk' : 'map-marker'}
                        size={20} 
                        color="#fff" 
                      />
                    </View>
                  </MapboxGL.PointAnnotation>
                ))}
              </>
            )}
          </MapboxGL.MapView>
        )}

      {tracking && !useNativeNav && (
        <Pressable
          onLongPress={() => {
            if (__DEV__) setShowNavDebug((prev) => !prev);
          }}
          style={[
            styles.topBanner,
            { paddingTop: insets.top + spacing(1) },
          ]}
        >
          <View style={styles.topBannerRow}>
            <MaterialCommunityIcons name={instructionIcon} size={24} color="#fff" style={styles.bannerIcon} />
            <View style={styles.bannerTextWrap}>
              <Text style={styles.bannerDistance}>{bannerTitle || '—'}</Text>
              <Text style={styles.bannerPrimary} numberOfLines={1}>
                {bannerPrimaryText || '—'}
              </Text>
              {!!bannerSecondaryText && (
                <Text style={styles.bannerSecondary} numberOfLines={1}>
                  {bannerSecondaryText}
                </Text>
              )}
            </View>
            <IconButton
              icon={voiceMuted ? 'volume-off' : 'volume-high'}
              size={18}
              onPress={() => {
                setVoiceMuted((prev) => !prev);
                if (!voiceMuted) Speech.stop();
              }}
              style={styles.bannerMuteButton}
              iconColor="#fff"
            />
          </View>
          {!!laneGuidance.length && (
            <View style={styles.laneContainer}>
              {laneGuidance.map((lane, idx) => (
                <View
                  key={`lane-${idx}-${lane.directions.join('-')}`}
                  style={[styles.laneBox, lane.active && styles.laneBoxActive]}
                >
                  <View style={styles.laneArrows}>
                    {lane.directions.map((direction, dirIdx) => (
                      <MaterialCommunityIcons
                        key={`arrow-${dirIdx}`}
                        name={getLaneArrowIcon(direction)}
                        size={16}
                        color={lane.active ? '#fff' : '#94a3b8'}
                        style={styles.laneArrow}
                      />
                    ))}
                  </View>
                </View>
              ))}
            </View>
          )}
        </Pressable>
      )}
      {tracking && !useNativeNav && showRejoinHint && (
        <View style={[styles.rejoinHint, { top: insets.top + spacing(9) }]}>
          <Text style={styles.rejoinText}>Off route</Text>
          <Button
            mode="contained"
            compact
            onPress={() => {
              if (lastLocation.current && rejoinTargetRef.current) {
                requestReroute(lastLocation.current, rejoinTargetRef.current, 'rejoin');
              }
            }}
          >
            Rejoin
          </Button>
        </View>
      )}

      {!!toast && (
        <View style={[styles.toastBanner, { top: insets.top + spacing(12) }]}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}
      {__DEV__ && showNavDebug && !useNativeNav && (
        <View style={[styles.debugOverlay, { top: insets.top + spacing(12) }]}>
          <Text style={styles.debugText}>
            {`phase=${navPhase}  s=${routeProgress?.currentS?.toFixed(1) ?? '—'}m  step=${instructionState?.stepIdx ?? '—'}  mode=${navPackageStatus}`}
          </Text>
          <Text style={styles.debugText}>
            {`toManeuver=${instructionState?.distanceToManeuver?.toFixed(1) ?? '—'}m  distToRoute=${routeProgress?.distanceToRoute?.toFixed(1) ?? '—'}m`}
          </Text>
          <Text style={styles.debugText}>
            {`remaining=${routeLengthM ? Math.max(routeLengthM - (routeProgress?.currentS ?? 0), 0).toFixed(1) : '—'}m  started=${hasStartedGpxRef.current ? 'yes' : 'no'}`}
          </Text>
          <Text style={styles.debugText}>
            {`heading raw=${carMarker?.rawHeading?.toFixed(0) ?? '—'} route=${carMarker?.routeHeading?.toFixed(0) ?? '—'} filtered=${carMarker?.heading?.toFixed(0) ?? '—'} frozen=${carMarker?.headingFrozen ? 'yes' : 'no'}`}
          </Text>
          <Text style={styles.debugText}>
            {`mode=${carMarker?.markerMode ?? '—'}  distToRoute=${carMarker?.distanceToRoute?.toFixed(1) ?? '—'}m  offRoute=${routeProgress?.offRoute ? 'yes' : 'no'}  s=${carMarker?.s?.toFixed(1) ?? '—'}m`}
          </Text>
          <Text style={styles.debugText}>
            {`window=${routeProgress ? `${routeProgress.windowStart.toFixed(0)}-${routeProgress.windowEnd.toFixed(0)}m` : '—'}`}
          </Text>
          <Text style={styles.debugText}>
            {`offRoute=${routeProgress?.offRoute ? 'yes' : 'no'}  candidates=${routeProgress?.candidateCount ?? '—'}`}
          </Text>
          {!!navPackageError && <Text style={styles.debugText}>{`matchingErr=${navPackageError}`}</Text>}
        </View>
      )}

      {tracking && !useNativeNav && (
        <View style={styles.speedBubble}>
          <Text style={styles.speedValue}>{mph(speedMps)}</Text>
          <Text style={styles.speedUnit}>mph</Text>
        </View>
      )}

      {!useNativeNav && (
        <View style={[styles.controls, { top: insets.top + spacing(10) }]}>
          <IconButton
            mode="contained"
            icon="compass-outline"
            onPress={() => {
              const target = carMarkerRef.current?.coord || lastLocation.current;
              if (target && cameraRef.current) {
                setFollowUser(true);
                setCameraMode('FOLLOW');
                cameraRef.current.setCamera({
                  centerCoordinate: [target.longitude, target.latitude],
                  pitch: 45,
                  heading: 0,
                  zoomLevel: followZoom,
                  animationDuration: 300,
                  animationMode: 'easeTo',
                });
              }
            }}
            style={styles.controlButton}
            iconColor="#fff"
            size={20}
          />
          <IconButton
            mode="contained"
            icon="crosshairs-gps"
            onPress={() => {
              const target = carMarkerRef.current?.coord || lastLocation.current;
              if (target && cameraRef.current) {
                setFollowUser(true);
                setCameraMode('FOLLOW');
                cameraRef.current.setCamera({
                  centerCoordinate: [target.longitude, target.latitude],
                  pitch: 45,
                  heading: carMarkerRef.current?.heading ?? headingRef.current,
                  zoomLevel: followZoom,
                  animationDuration: 400,
                  animationMode: 'easeTo',
                });
              } else if (cameraBounds && cameraRef.current) {
                cameraRef.current.fitBounds(cameraBounds.ne, cameraBounds.sw, 80, 500);
              }
            }}
            style={styles.controlButton}
            iconColor="#fff"
            size={20}
          />
          <IconButton
            mode="contained"
            icon="map-outline"
            onPress={() => {
              if (cameraBounds && cameraRef.current) {
                setFollowUser(false);
                setCameraMode('OVERVIEW');
                cameraRef.current.fitBounds(cameraBounds.ne, cameraBounds.sw, 80, 600);
              }
            }}
            style={styles.controlButton}
            iconColor="#fff"
            size={20}
          />
        </View>
      )}

      {useNativeNav && (
        <View style={[styles.nativeControls, { bottom: insets.bottom + spacing(2) }]}>
          {!tracking ? (
            <Button
              mode="contained"
              onPress={() => {
                const dist = Math.round(distToStart);
                setToast(`You are ${formatDistanceShort(dist)} from start. Head there to begin.`);
                startTracking();
              }}
            >
              Start
            </Button>
          ) : (
            <View style={styles.nativeControlsRow}>
              <Button mode="outlined" onPress={() => finishTracking(false)}>
                Stop
              </Button>
              <Button
                mode="contained"
                onPress={() => {
                  if (distanceRemaining > 120) {
                    setToast('You have not finished yet. Session reset.');
                    finishTracking(false, true);
                  } else {
                    finishTracking(true);
                  }
                }}
              >
                Finish
              </Button>
            </View>
          )}
        </View>
      )}

      {!useNativeNav && (
        <View style={styles.bottomSheet}>
          <View style={styles.bottomSheetContent}>
            <View style={styles.bottomInfo}>
              <Text style={styles.bottomTime}>
                {etaMinutes > 0 ? `${etaMinutes.toFixed(0)} min` : '--'}
              </Text>
              <Text style={styles.bottomDistance}>
                {formatDistanceShort(
                  useNativeNav && nativeDistanceRemaining !== null ? nativeDistanceRemaining : distanceRemaining,
                )}
              </Text>
            </View>
            <View style={styles.bottomControls}>
              <Button 
                mode="outlined" 
                onPress={() => finishTracking(false)} 
                disabled={!tracking}
                style={{ borderColor: '#666', borderRadius: 20 }}
                labelStyle={{ color: '#fff' }}
                contentStyle={{ paddingHorizontal: spacing(1) }}
              >
                Stop
              </Button>
              {!tracking ? (
                <Button
                  mode="contained"
                  disabled={!navReady}
                  onPress={() => {
                    const dist = Math.round(distToStart);
                    setToast(`You are ${formatDistanceShort(dist)} from start. Head there to begin.`);
                    startTracking();
                  }}
                  style={{ borderRadius: 20, backgroundColor: '#1e88e5' }}
                  contentStyle={{ paddingHorizontal: spacing(1.5) }}
                >
                  {navReady ? 'Start' : '...'}
                </Button>
              ) : (
                <Button
                  mode="contained"
                  onPress={() => {
                    if (distanceRemaining > 120) {
                      setToast('You have not finished yet. Session reset.');
                      finishTracking(false, true);
                    } else {
                      finishTracking(true);
                    }
                  }}
                  style={{ borderRadius: 20, backgroundColor: '#1e88e5' }}
                  contentStyle={{ paddingHorizontal: spacing(1.5) }}
                >
                  Finish
                </Button>
              )}
            </View>
          </View>
          <Text style={{ color: '#888', fontSize: 12, textAlign: 'center', marginTop: spacing(0.5) }}>
            {routeDto.name}
          </Text>
        </View>
      )}

      <Portal>
        <Modal visible={showSafety} onDismiss={() => {}} contentContainerStyle={styles.noticeModal}>
          <Text variant="titleLarge">Important Safety Notice</Text>
          <Text style={styles.noticeText}>
            Drivest routes are provided for learning and practice only.
          </Text>
          <Text style={styles.noticeText}>
            • Routes are reconstructed and not official test routes
          </Text>
          <Text style={styles.noticeText}>
            • Examiners may change routes at any time
          </Text>
          <Text style={styles.noticeText}>
            • Do not rely on the app during a live driving test
          </Text>
          <Text style={styles.noticeText}>
            • Always follow road signs, traffic laws, and examiner instructions
          </Text>
          <Text style={styles.noticeText}>
            You remain fully responsible for safe driving and legal compliance.
          </Text>
          <View style={{ marginTop: spacing(2), gap: spacing(1) }}>
            <Button
              mode="contained"
              onPress={async () => {
                const ts = consentNow();
                await setConsentValue(CONSENT_KEYS.safetyAcceptedAt, ts);
                await apiAuth.updateConsents({ safetyAcceptedAt: ts });
                setShowSafety(false);
              }}
            >
              I Understand and Continue
            </Button>
            <Button mode="outlined" onPress={() => navigation.goBack()}>
              Cancel
            </Button>
          </View>
        </Modal>
        <Modal visible={rewardVisible} onDismiss={() => setRewardVisible(false)} contentContainerStyle={styles.debriefModal}>
          <Text variant="headlineSmall">Route complete!</Text>
          <Text variant="bodyMedium">Time: {formatTime(elapsed)}</Text>
          <Text variant="bodyMedium">Distance: {metersToKm(distanceM)}</Text>
          <Button mode="contained" style={{ marginTop: spacing(2) }} onPress={() => setRewardVisible(false)}>
            Done
          </Button>
        </Modal>
      </Portal>
      <LocationConsentModal
        visible={showLocationPrompt}
        onAllow={async () => {
          const perm = await Location.requestForegroundPermissionsAsync();
          const choice = perm.status === 'granted' ? 'allow' : 'deny';
          await setConsentValue(CONSENT_KEYS.locationChoice, choice);
          await setConsentValue(CONSENT_KEYS.locationAt, consentNow());
          setShowLocationPrompt(false);
          if (choice === 'allow' && pendingStartRef.current) {
            pendingStartRef.current = false;
            startTracking(true);
          }
        }}
        onSkip={async () => {
          await setConsentValue(CONSENT_KEYS.locationChoice, 'skip');
          await setConsentValue(CONSENT_KEYS.locationAt, consentNow());
          setShowLocationPrompt(false);
          pendingStartRef.current = false;
        }}
      />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000' },
  container: { flex: 1, backgroundColor: '#000' },
  speedBubble: {
    position: 'absolute',
    bottom: spacing(18),
    left: spacing(2),
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1e1e1e',
    borderWidth: 3,
    borderColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  speedValue: { 
    color: '#fff', 
    fontSize: 22, 
    fontWeight: '900',
    textAlign: 'center'
  },
  speedUnit: { 
    color: '#b0b0b0', 
    fontSize: 12, 
    fontWeight: '600',
    marginTop: -2,
    textAlign: 'center'
  },
  controls: {
    position: 'absolute',
    right: spacing(1.5),
    top: spacing(10),
    alignItems: 'flex-end',
  },
  controlButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 20,
    marginBottom: spacing(1),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  nativeControls: {
    position: 'absolute',
    left: spacing(2),
    right: spacing(2),
    padding: spacing(1),
    borderRadius: 18,
    backgroundColor: 'rgba(10, 10, 10, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
  },
  nativeControlsRow: {
    flexDirection: 'row',
    gap: spacing(1),
  },
  backButton: {
    position: 'absolute',
    top: spacing(1),
    left: spacing(1.5),
    zIndex: 20,
    elevation: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    elevation: 15,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: -5 },
    paddingTop: spacing(1.5),
    paddingBottom: spacing(1),
    paddingHorizontal: spacing(2),
  },
  bottomSheetContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing(1.5),
  },
  bottomInfo: {
    flex: 1,
    alignItems: 'center',
  },
  bottomTime: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '900',
  },
  bottomDistance: {
    color: '#b0b0b0',
    fontSize: 14,
    fontWeight: '600',
    marginTop: spacing(0.25),
  },
  bottomControls: {
    flexDirection: 'row',
    gap: spacing(1),
  },
  topBanner: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    paddingTop: spacing(1),
    paddingBottom: spacing(1.5),
    paddingHorizontal: spacing(2),
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
  },
  topBannerRow: { 
    flexDirection: 'row', 
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  bannerIcon: { 
    marginRight: spacing(1.5),
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    padding: spacing(0.5)
  },
  bannerTextWrap: { flex: 1 },
  bannerDistance: { 
    color: '#fff', 
    fontSize: 24, 
    fontWeight: '900',
    textAlign: 'center'
  },
  bannerPrimary: { 
    color: '#fff', 
    fontSize: 16, 
    fontWeight: '700', 
    marginTop: spacing(0.25),
    textAlign: 'center'
  },
  bannerSecondary: { 
    color: '#4ade80', 
    fontSize: 14, 
    fontWeight: '600',
    textAlign: 'center'
  },
  bannerMuteButton: { 
    marginLeft: spacing(1),
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20
  },
  laneContainer: { 
    flexDirection: 'row', 
    justifyContent: 'center', 
    marginTop: spacing(0.5),
    paddingHorizontal: spacing(2)
  },
  laneBox: {
    width: 40,
    height: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    marginHorizontal: spacing(0.5),
    justifyContent: 'center',
    alignItems: 'center',
  },
  laneBoxActive: {
    backgroundColor: '#1e88e5',
    borderColor: '#1e88e5',
  },
  laneArrows: {
    alignItems: 'center',
  },
  laneArrow: {
    marginVertical: 1,
  },
  toastBanner: {
    position: 'absolute',
    left: spacing(2),
    right: spacing(2),
    top: spacing(12),
    backgroundColor: 'rgba(30, 30, 30, 0.95)',
    borderRadius: 20,
    paddingVertical: spacing(1),
    paddingHorizontal: spacing(1.5),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    zIndex: 6,
  },
  toastText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: '700',
    fontSize: 14,
  },
  rejoinHint: {
    position: 'absolute',
    left: spacing(2),
    right: spacing(2),
    top: spacing(9),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(239, 68, 68, 0.95)',
    borderRadius: 20,
    paddingHorizontal: spacing(1.5),
    paddingVertical: spacing(1),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    zIndex: 8,
  },
  rejoinText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 16,
  },
  debugOverlay: {
    position: 'absolute',
    left: spacing(2),
    right: spacing(2),
    backgroundColor: 'rgba(2, 6, 23, 0.85)',
    borderRadius: 12,
    paddingVertical: spacing(1),
    paddingHorizontal: spacing(1.5),
    zIndex: 7,
  },
  debugText: {
    color: '#e2e8f0',
    fontSize: 12,
    fontWeight: '600',
  },
  startMarker: { width: 12, height: 12, borderRadius: 6, backgroundColor: 'green', borderWidth: 2, borderColor: '#fff' },
  finishMarker: { width: 12, height: 12, borderRadius: 6, backgroundColor: 'red', borderWidth: 2, borderColor: '#fff' },
  speedLimitMarker: { 
    width: 30, 
    height: 30, 
    borderRadius: 15, 
    backgroundColor: '#2563eb', 
    borderWidth: 2, 
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center'
  },
  speedLimitText: { 
    color: '#fff', 
    fontSize: 12, 
    fontWeight: 'bold' 
  },
  controlMarker: { 
    width: 24, 
    height: 24, 
    borderRadius: 12, 
    backgroundColor: '#dc2626', 
    borderWidth: 2, 
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center'
  },
  rewardModal: {
    backgroundColor: '#fff',
    marginHorizontal: spacing(3),
    padding: spacing(3),
    borderRadius: 16,
  },
  noticeModal: {
    backgroundColor: '#fff',
    marginHorizontal: spacing(3),
    padding: spacing(3),
    borderRadius: 16,
  },
  debriefModal: {
    backgroundColor: '#fff',
    marginHorizontal: spacing(3),
    padding: spacing(3),
    borderRadius: 16,
  },
  noticeText: {
    color: colors.muted,
    marginTop: spacing(0.5),
  },
});

export default PracticeScreen;

const formatDistanceShort = (meters?: number | null) => {
  if (meters === null || meters === undefined || Number.isNaN(meters)) return '';
  if (meters < 950) return `${Math.round(meters)} m`;
  const km = meters / 1000;
  return `${km.toFixed(km < 10 ? 1 : 0)} km`;
};

const formatDistanceNav = (meters?: number | null) => {
  if (meters === null || meters === undefined || Number.isNaN(meters)) return '';
  return formatDistanceDisplayUK(meters);
};

const formatOrdinal = (n: number) => {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n}st`;
  if (mod10 === 2 && mod100 !== 12) return `${n}nd`;
  if (mod10 === 3 && mod100 !== 13) return `${n}rd`;
  return `${n}th`;
};

const extractRoadName = (instruction?: string, roadName?: string) => {
  if (roadName) return roadName;
  if (!instruction) return '';
  const ontoMatch = instruction.match(/(?:onto|on to)\s+(.+)$/i);
  if (ontoMatch?.[1]) return ontoMatch[1];
  const viaMatch = instruction.match(/(?:toward|towards|via)\s+(.+)$/i);
  if (viaMatch?.[1]) return viaMatch[1];
  return instruction;
};

const formatManeuverSubtitle = (step?: NavStep | null, onRoute = false) => {
  const bannerSecondary = step?.banner?.secondary?.text || step?.banner?.sub?.text;
  if (bannerSecondary) return bannerSecondary;
  if (step?.maneuverType === 'roundabout' || step?.maneuverType === 'rotary') {
    if (step.roundaboutExit) {
      const exit = formatOrdinal(step.roundaboutExit);
      return step.roadName ? `${exit} exit • ${step.roadName}` : `${exit} exit`;
    }
  }
  const road = extractRoadName(step?.instruction, step?.roadName);
  if (road) return road;
  return onRoute ? 'Follow the route' : 'Head to start';
};

const getLaneArrowIcon = (direction: string): keyof typeof MaterialCommunityIcons.glyphMap => {
  const normalized = direction.toLowerCase();
  if (normalized === 'straight' || normalized === 'straight-ahead') return 'arrow-up';
  if (normalized === 'left') return 'arrow-left';
  if (normalized === 'right') return 'arrow-right';
  if (normalized === 'slight left') return 'arrow-top-left';
  if (normalized === 'slight right') return 'arrow-top-right';
  if (normalized === 'sharp left') return 'arrow-left';
  if (normalized === 'sharp right') return 'arrow-right';
  if (normalized === 'uturn') return 'rotate-3d-variant';
  return 'arrow-up';
};

const getManeuverIconName = (
  step?: NavStep | null,
  instructionText?: string,
): keyof typeof MaterialCommunityIcons.glyphMap => {
  const text = instructionText?.toLowerCase() || '';
  const key = step?.maneuverIconKey?.toLowerCase() || '';
  const type = step?.maneuverType?.toLowerCase() || '';
  const modifier = step?.maneuverModifier?.toLowerCase() || '';
  const hasLeft = key.includes('left') || modifier === 'left' || text.includes('left');
  const hasRight = key.includes('right') || modifier === 'right' || text.includes('right');
  const hasSlight = key.includes('slight') || modifier === 'slight' || text.includes('slight');
  const hasSharp = key.includes('sharp') || modifier === 'sharp' || text.includes('sharp');
  if (key.includes('roundabout') || type === 'roundabout' || type === 'rotary' || text.includes('roundabout')) {
    return 'rotate-3d-variant';
  }
  if (key.includes('uturn') || modifier === 'uturn' || text.includes('u-turn')) {
    return 'rotate-3d-variant';
  }
  if (key.includes('merge') || type === 'merge') return 'call-merge';
  if (key.includes('fork') || type === 'fork') return 'directions-fork';
  if (key.includes('exit') || type === 'exit') return 'exit-to-app';
  if (key.includes('ramp') || type.includes('ramp')) return 'call-split';
  if (key.includes('arrive') || type === 'arrive') return 'flag-checkered';
  if (hasSlight && hasLeft) return 'arrow-top-left';
  if (hasSlight && hasRight) return 'arrow-top-right';
  if (hasSharp && hasLeft) return 'arrow-left-bold';
  if (hasSharp && hasRight) return 'arrow-right-bold';
  if (hasLeft) return 'arrow-left-bold';
  if (hasRight) return 'arrow-right-bold';
  if (key.includes('straight') || modifier === 'straight' || text.includes('straight')) return 'arrow-up-bold';
  return 'arrow-up-bold';
};

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const sanitizeCoords = (coords: LatLng[]) => {
  const cleaned: LatLng[] = [];
  for (const c of coords) {
    if (!c || !Number.isFinite(c.latitude) || !Number.isFinite(c.longitude)) continue;
    if (cleaned.length) {
      const last = cleaned[cleaned.length - 1];
      if (Math.abs(last.latitude - c.latitude) < 1e-6 && Math.abs(last.longitude - c.longitude) < 1e-6) {
        continue;
      }
    }
    cleaned.push(c);
  }
  return cleaned;
};

const lineString = (coords: LatLng[]) => ({
  type: 'Feature' as const,
  properties: {},
  geometry: {
    type: 'LineString' as const,
    coordinates: coords.map((c) => [c.longitude, c.latitude]),
  },
});

const buildRouteDistances = (route: LatLng[]) => {
  if (route.length < 2) return [];
  const distances = [0];
  let total = 0;
  for (let i = 1; i < route.length; i++) {
    total += haversineInline(route[i - 1], route[i]);
    distances.push(total);
  }
  return distances;
};

const coordAtDistance = (route: LatLng[], distances: number[], distance: number) => {
  if (route.length < 2 || distances.length !== route.length) return route[0];
  const total = distances[distances.length - 1] || 0;
  const clamped = Math.max(0, Math.min(total, distance));
  const idx = findSegmentIndex(distances, clamped);
  const start = route[idx];
  const end = route[idx + 1] || route[idx];
  const segmentDistance = distances[idx + 1] - distances[idx] || 1;
  const t = Math.max(0, Math.min(1, (clamped - distances[idx]) / segmentDistance));
  return {
    latitude: start.latitude + (end.latitude - start.latitude) * t,
    longitude: start.longitude + (end.longitude - start.longitude) * t,
  };
};

const bearingFromRouteDistance = (
  route: LatLng[],
  distances: number[],
  currentS: number,
  aheadA = 5,
  aheadB = 15,
) => {
  if (!route.length || distances.length !== route.length) return null;
  const p1 = coordAtDistance(route, distances, currentS + aheadA);
  const p2 = coordAtDistance(route, distances, currentS + aheadB);
  return bearingBetween(p1, p2);
};

const buildArrowFeature = (coord: LatLng, bearing: number) => {
  const tip = offsetCoordByMeters(coord, bearing, 18);
  const baseCenter = offsetCoordByMeters(coord, bearing + 180, 10);
  const left = offsetCoordByMeters(baseCenter, bearing - 90, 7);
  const right = offsetCoordByMeters(baseCenter, bearing + 90, 7);
  return {
    type: 'Feature' as const,
    properties: { bearing },
    geometry: {
      type: 'Polygon' as const,
      coordinates: [
        [
          [tip.longitude, tip.latitude],
          [right.longitude, right.latitude],
          [left.longitude, left.latitude],
          [tip.longitude, tip.latitude],
        ],
      ],
    },
  };
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
    distanceToRoute: haversineInline(p, proj),
    distanceAlongSegment: haversineInline(v, proj),
    projectedPoint: proj,
  };
};

const getRouteProgress = (
  point: LatLng,
  route: LatLng[],
  distances: number[],
  lastDistance?: number,
) => {
  if (route.length < 2 || distances.length !== route.length) return null;
  let bestScore = Infinity;
  let bestDistance = Infinity;
  let bestAlong = 0;
  let bestPoint: LatLng | null = null;
  let bestHeading: number | null = null;
  let bestSegIdx = 0;
  const useLast = Number.isFinite(lastDistance);
  for (let i = 0; i < route.length - 1; i++) {
    const projection = projectPointToSegment(point, route[i], route[i + 1]);
    const along = distances[i] + projection.distanceAlongSegment;
    let penalty = 0;
    if (useLast) {
      const delta = along - (lastDistance as number);
      if (delta < -30) penalty += Math.abs(delta) * 2.5;
      penalty += Math.abs(delta) * 0.15;
    }
    const score = projection.distanceToRoute + penalty;
    if (score < bestScore) {
      bestScore = score;
      bestDistance = projection.distanceToRoute;
      bestAlong = along;
      bestPoint = projection.projectedPoint;
      bestHeading = bearing(route[i], route[i + 1]);
      bestSegIdx = i;
    }
  }
  if (!Number.isFinite(bestDistance)) return null;
  return {
    distanceAlong: bestAlong,
    distanceToRoute: bestDistance,
    snappedPoint: bestPoint,
    segmentHeading: bestHeading,
    segmentIndex: bestSegIdx,
  };
};

const buildStepRouteDistances = (steps: NavStep[], route: LatLng[], distances: number[]) => {
  if (!steps.length || route.length < 2) return [];
  return steps.map((step) => {
    const progress = getRouteProgress(step.location, route, distances);
    return progress ? progress.distanceAlong : Number.NaN;
  });
};

const closestDistanceToRoute = (point: LatLng, route: LatLng[]) => {
  if (!route.length) return Infinity;
  let min = Infinity;
  for (let i = 0; i < route.length - 1; i++) {
    min = Math.min(min, distanceToSegment(point, route[i], route[i + 1]));
  }
  return min;
};

const distanceToSegment = (p: LatLng, v: LatLng, w: LatLng) => {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371000;
  const lat1 = toRad(v.latitude);
  const lat2 = toRad(w.latitude);
  const lon1 = toRad(v.longitude);
  const lon2 = toRad(w.longitude);
  const latp = toRad(p.latitude);
  const lonp = toRad(p.longitude);

  const dLon = lon2 - lon1;
  const dLat = lat2 - lat1;
  const t =
    ((latp - lat1) * dLat + (lonp - lon1) * dLon) /
    (dLat * dLat + dLon * dLon || 1);
  const tClamped = Math.max(0, Math.min(1, t));
  const projLat = lat1 + tClamped * dLat;
  const projLon = lon1 + tClamped * dLon;

  const cosVal =
    Math.sin(latp) * Math.sin(projLat) + Math.cos(latp) * Math.cos(projLat) * Math.cos(projLon - lonp);
  const safeCos = Math.max(-1, Math.min(1, cosVal));
  return R * Math.acos(safeCos);
};

const buildStepsFromPolyline = (coords: LatLng[]): NavStep[] => {
  if (coords.length < 2) return [];
  const steps: NavStep[] = [];
  const every = Math.max(5, Math.round(coords.length / 8));
  for (let i = 1; i < coords.length; i += every) {
    const prev = coords[Math.max(0, i - every)];
    const curr = coords[i];
    const next = coords[Math.min(coords.length - 1, i + every)];
    const inBrng = bearing(prev, curr);
    const outBrng = bearing(curr, next);
    const delta = angleDiff(inBrng, outBrng);
    let instruction = 'Continue straight';
    let maneuverIconKey = 'straight';
    if (Math.abs(delta) > 20 && Math.abs(delta) <= 140) {
      instruction = delta > 0 ? 'Turn right' : 'Turn left';
      maneuverIconKey = delta > 0 ? 'right' : 'left';
    } else if (Math.abs(delta) > 140) {
      instruction = delta > 0 ? 'Make a U-turn right' : 'Make a U-turn left';
      maneuverIconKey = 'uturn';
    }
    steps.push({
      instruction,
      location: curr,
      distance: haversineInline(prev, curr),
      maneuverIconKey,
    });
  }
  if (!steps.length) {
    steps.push({
      instruction: 'Continue to destination',
      location: coords[coords.length - 1],
      distance: 0,
    });
  }
  return steps;
};

const buildNavStepsFromMatching = (steps: MatchingStep[]): NavStep[] => {
  if (!steps.length) return [];
  return steps
    .filter((step) => step.maneuver?.location)
    .map((step) => {
      const banner = normalizeBannerInstruction(step.bannerInstructions?.[0]);
      const instruction = banner?.primary?.text || buildFallbackInstructionFromMatching(step);
      return {
        distance: step.distance || 0,
        instruction,
        location: step.maneuver.location || { latitude: 0, longitude: 0 },
        roadName: step.name,
        maneuverType: step.maneuver?.type,
        maneuverModifier: step.maneuver?.modifier,
        roundaboutExit: step.exit,
        banner,
        bannerInstructions: step.bannerInstructions?.map(normalizeBannerInstruction).filter(Boolean) as
          | DirectionsBannerInstruction[]
          | undefined,
        voiceInstructions: step.voiceInstructions,
        maneuverIconKey: getManeuverIconKey(banner?.primary, step.maneuver),
      };
    });
};

const normalizeBannerInstruction = (
  banner?: MatchingBannerInstruction | null,
): DirectionsBannerInstruction | undefined => {
  if (!banner) return undefined;
  return {
    distanceAlongGeometry: banner.distanceAlongGeometry,
    primary: normalizeBannerText(banner.primary),
    secondary: banner.secondary ? normalizeBannerText(banner.secondary) : undefined,
    sub: banner.sub ? normalizeBannerText(banner.sub) : undefined,
  };
};

const normalizeBannerText = (text?: MatchingBannerText | null): DirectionsBannerText => {
  const components = text?.components?.map(normalizeBannerComponent);
  return {
    text: text?.text,
    type: text?.type,
    modifier: text?.modifier,
    components: components?.length ? components : undefined,
  };
};

const normalizeBannerComponent = (component: MatchingBannerComponent): DirectionsBannerComponent => ({
  type: component.type || 'unknown',
  text: component.text,
  directions: component.directions,
  active: component.active,
  active_direction: component.active_direction,
  imageBaseURL: component.imageBaseURL,
  abbr: component.abbr,
  abbr_priority: component.abbr_priority,
});

const buildMatchingStepsFromNavSteps = (steps: NavStep[], routeLine: LatLng[], cumDist: number[]) => {
  if (!steps.length || !routeLine.length) return [];
  let running = 0;
  const converted = steps
    .map((step, idx) => {
      const location = step.location;
      if (!location) return null;
      const distance = Number.isFinite(step.distance) ? step.distance : 0;
      const stepStartS = running;
      const stepEndS = stepStartS + distance;
      running = stepEndS;
      return {
        stepIndexGlobal: idx,
        maneuver: {
          type: step.maneuverType,
          modifier: step.maneuverModifier,
          location,
          exit: step.roundaboutExit,
        },
        bannerInstructions: step.bannerInstructions || (step.banner ? [step.banner] : undefined),
        voiceInstructions: step.voiceInstructions,
        distanceAlongRoute: stepEndS,
        stepStartS,
        stepEndS,
        distance,
        name: step.roadName,
        exit: step.roundaboutExit,
      } as MatchingStep;
    })
    .filter(Boolean) as MatchingStep[];

  return converted.map((step, index) => ({
    ...step,
    stepIndexGlobal: index,
  }));
};

const normalizeStepRanges = (steps: MatchingStep[]) => {
  let running = 0;
  return steps.map((step, index) => {
    const distance = Number.isFinite(step.distance) ? step.distance : 0;
    const hasStart = Number.isFinite(step.stepStartS);
    const hasEnd = Number.isFinite(step.stepEndS);
    const stepStartS = hasStart ? (step.stepStartS as number) : running;
    const stepEndS = hasEnd ? (step.stepEndS as number) : stepStartS + distance;
    running = Math.max(running, stepEndS);
    return {
      ...step,
      stepIndexGlobal: index,
      stepStartS,
      stepEndS,
      distanceAlongRoute: Number.isFinite(step.distanceAlongRoute) && step.distanceAlongRoute > 0
        ? step.distanceAlongRoute
        : stepEndS,
    };
  });
};

const buildNavPackageFromDirections = (routeLine: LatLng[], steps: NavStep[], source: string): NavPackage => {
  const matchedPolyline = routeLine;
  const cumDist = buildCumulativeDistances(matchedPolyline);
  const total = cumDist.length ? cumDist[cumDist.length - 1] : 0;
  const convertedSteps = buildMatchingStepsFromNavSteps(steps, matchedPolyline, cumDist);
  return {
    id: `fallback_${source}_${hashString(JSON.stringify(matchedPolyline.map((c) => [roundCoord(c.latitude), roundCoord(c.longitude)])))}`,
    originalPolyline: matchedPolyline,
    matchedPolyline,
    cumDist,
    steps: convertedSteps,
    routeLengthM: total,
    startCoord: matchedPolyline[0],
    endCoord: matchedPolyline[matchedPolyline.length - 1],
    meta: {
      createdAt: Date.now(),
      profile: 'driving',
      radiusesUsed: 0,
      chunks: 1,
      warnings: [`fallback:${source}`],
    },
  };
};

const buildNavPackageFromInstructions = (routeLine: LatLng[], instructions: any[], source: string): NavPackage => {
  const matchedPolyline = routeLine;
  const cumDist = buildCumulativeDistances(matchedPolyline);
  const total = cumDist.length ? cumDist[cumDist.length - 1] : 0;
  const steps: MatchingStep[] = instructions.map((ins, idx) => {
    const location = ins.location || { lat: ins.lat, lon: ins.lon };
    const distanceAlongRoute = idx === 0 ? 0 : cumDist[Math.min(idx * Math.floor(cumDist.length / instructions.length), cumDist.length - 1)] || 0;

    // Enhanced instruction text building
    let instructionText = ins.direction || 'Continue';
    let voiceAnnouncement = ins.direction || 'Continue';

    if (ins.action_type === 'roundabout' && ins.roundabout_exit_number_inferred) {
      const exitNum = ins.roundabout_exit_number_inferred;
      instructionText = `At the roundabout, take the ${formatOrdinal(exitNum)} exit`;
      voiceAnnouncement = `At the roundabout, take the ${formatOrdinal(exitNum)} exit`;
      if (ins.road) {
        instructionText += ` onto ${ins.road}`;
        voiceAnnouncement += ` onto ${ins.road}`;
      }
    } else if (ins.road && ins.direction) {
      instructionText = `${ins.direction} onto ${ins.road}`;
      voiceAnnouncement = `${ins.direction} onto ${ins.road}`;
    }

    return {
      stepIndexGlobal: idx,
      maneuver: {
        type: ins.action_type === 'roundabout' ? 'roundabout' : (ins.direction?.includes('straight') ? 'continue' : ins.direction?.includes('left') || ins.direction?.includes('right') ? 'turn' : 'continue'),
        modifier: ins.action_type === 'roundabout' ? undefined : (ins.direction?.includes('left') ? 'left' : ins.direction?.includes('right') ? 'right' : undefined),
        location: { latitude: location.lat, longitude: location.lon },
        exit: ins.roundabout_exit_number_inferred || undefined,
      },
      bannerInstructions: [{
        distanceAlongGeometry: 0,
        primary: {
          text: instructionText,
          components: [{ text: instructionText }],
        },
      }],
      voiceInstructions: [{
        distanceAlongGeometry: 0,
        announcement: voiceAnnouncement,
      }],
      distanceAlongRoute,
      distance: ins.distance || 0,
      name: ins.road || ins.road_name || '',
    };
  });
  return {
    id: `enriched_${source}_${hashString(JSON.stringify(matchedPolyline.map((c) => [roundCoord(c.latitude), roundCoord(c.longitude)])))}`,
    originalPolyline: matchedPolyline,
    matchedPolyline,
    cumDist,
    steps,
    routeLengthM: total,
    startCoord: matchedPolyline[0],
    endCoord: matchedPolyline[matchedPolyline.length - 1],
    meta: {
      createdAt: Date.now(),
      profile: 'driving',
      radiusesUsed: 0,
      chunks: 1,
      warnings: [`enriched:${source}`],
    },
  };
};

const buildFallbackInstructionFromMatching = (step: MatchingStep) => {
  const type = step.maneuver?.type || '';
  const modifier = step.maneuver?.modifier || '';
  const road = step.name || '';
  if (type === 'arrive') return 'You have arrived at your destination';
  if (type === 'depart') return road ? `Head ${modifier || 'straight'} on ${road}` : 'Head straight';
  if (type === 'roundabout' || type === 'rotary') {
    if (step.exit) return `At the roundabout, take the ${formatOrdinal(step.exit)} exit`;
    return 'Enter the roundabout';
  }
  if (modifier) return road ? `Turn ${modifier} onto ${road}` : `Turn ${modifier}`;
  if (road) return `Continue on ${road}`;
  return 'Continue';
};

const getManeuverIconKey = (primary?: { type?: string; modifier?: string }, maneuver?: MatchingStep['maneuver']) => {
  const type = (primary?.type || maneuver?.type || '').toLowerCase();
  const modifier = (primary?.modifier || maneuver?.modifier || '').toLowerCase();
  if (type === 'roundabout' || type === 'rotary') return 'roundabout';
  if (type === 'arrive') return 'arrive';
  if (type === 'depart') return modifier || 'straight';
  if (type === 'merge') return `merge_${modifier || 'straight'}`;
  if (type === 'fork') return `fork_${modifier || 'straight'}`;
  if (type === 'off ramp' || type === 'on ramp' || type === 'ramp') return `ramp_${modifier || 'straight'}`;
  if (type === 'exit') return `exit_${modifier || 'straight'}`;
  if (modifier) return modifier;
  return type || 'straight';
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

const hashString = (input: string) => {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = (hash * 16777619) >>> 0;
  }
  return hash.toString(16);
};

const roundCoord = (value: number) => Math.round(value * 1e6) / 1e6;

const bearing = (a: LatLng, b: LatLng) => {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const y = Math.sin(toRad(b.longitude - a.longitude)) * Math.cos(toRad(b.latitude));
  const x =
    Math.cos(toRad(a.latitude)) * Math.sin(toRad(b.latitude)) -
    Math.sin(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.cos(toRad(b.longitude - a.longitude));
  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return (brng + 360) % 360;
};

const angleDiff = (a: number, b: number) => {
  let d = b - a;
  while (d > 180) d -= 360;
  while (d < -180) d += 360;
  return d;
};

const haversineInline = (a: LatLng, b: LatLng) => {
  const toRad = (d: number) => (d * Math.PI) / 180;
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
