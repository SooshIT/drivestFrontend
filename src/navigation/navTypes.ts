export type LatLng = { latitude: number; longitude: number };

export type BannerComponent = {
  type?: string;
  text?: string;
  directions?: string[];
  active?: boolean;
  active_direction?: string;
  imageBaseURL?: string;
  abbr?: string;
  abbr_priority?: number;
};

export type BannerText = {
  text?: string;
  type?: string;
  modifier?: string;
  components?: BannerComponent[];
};

export type BannerInstruction = {
  distanceAlongGeometry: number;
  primary: BannerText;
  secondary?: BannerText | null;
  sub?: BannerText | null;
};

export type VoiceInstruction = {
  distanceAlongGeometry: number;
  announcement?: string;
  ssmlAnnouncement?: string;
};

export type StepManeuver = {
  type?: string;
  modifier?: string;
  bearing_before?: number;
  bearing_after?: number;
  location?: LatLng;
  exit?: number;
};

export type Step = {
  stepIndexGlobal: number;
  maneuver: StepManeuver;
  bannerInstructions?: BannerInstruction[];
  voiceInstructions?: VoiceInstruction[];
  distanceAlongRoute: number;
  stepStartS?: number;
  stepEndS?: number;
  distance: number;
  name?: string;
  destinations?: string;
  rotary_name?: string;
  exit?: number;
};

export type NavPackage = {
  id: string;
  originalPolyline: LatLng[];
  matchedPolyline: LatLng[];
  cumDist: number[];
  steps: Step[];
  routeLengthM?: number;
  startCoord?: LatLng;
  endCoord?: LatLng;
  meta: {
    createdAt: number;
    profile: string;
    radiusesUsed: number;
    chunks: number;
    warnings: string[];
  };
};
