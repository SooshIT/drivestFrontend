import { BannerInstruction, Step } from './navTypes';
import { formatDistanceVoiceUK } from './units';

export type InstructionUpdate = {
  stepIdx: number;
  step: Step | null;
  banner: BannerInstruction | null;
  distanceToManeuver: number | null;
  remainingDistance: number;
  primaryText?: string | null;
  secondaryText?: string | null;
  voiceToSpeak: string | null;
  startAnnouncement: string | null;
  arrivalAnnouncement: string | null;
};

export type InstructionEngineOptions = {
  startMeters?: number;
  arrivalMeters?: number;
};

export const createInstructionEngine = (
  steps: Step[],
  routeLength: number,
  options: InstructionEngineOptions = {},
) => {
  const settings = {
    startMeters: options.startMeters ?? 5,
    arrivalMeters: options.arrivalMeters ?? 35,
  };
  const BACKTRACK_TOL_M = 25;

  let stepIdx = 0;
  let startAnnounced = false;
  let arrivalAnnounced = false;
  let hasDeparted = false;
  const fired = new Set<string>();
  const lastDistanceByStep = new Map<number, number>();

  const normalizedSteps = normalizeSteps(steps);

  const reset = () => {
    stepIdx = 0;
    startAnnounced = false;
    arrivalAnnounced = false;
    hasDeparted = false;
    fired.clear();
    lastDistanceByStep.clear();
  };

  const update = (
    currentS: number,
    speed = 0,
    context: { distanceToStart?: number | null; distanceToEnd?: number | null; hasStartedGpx?: boolean } = {},
  ): InstructionUpdate => {
    if (!normalizedSteps.length) {
      return {
        stepIdx: 0,
        step: null,
        banner: null,
        distanceToManeuver: null,
        remainingDistance: Math.max(routeLength - currentS, 0),
        voiceToSpeak: null,
        startAnnouncement: null,
        arrivalAnnouncement: null,
      };
    }

    if (!hasDeparted && context.hasStartedGpx) {
      hasDeparted = true;
    }

    const candidateIdx = findStepIndexByS(normalizedSteps, currentS);
    const currentStep = normalizedSteps[Math.min(stepIdx, normalizedSteps.length - 1)];
    if (candidateIdx < stepIdx) {
      const allowBacktrack = currentS < (currentStep.stepStartS ?? 0) - BACKTRACK_TOL_M;
      if (allowBacktrack) {
        stepIdx = candidateIdx;
      }
    } else if (candidateIdx !== stepIdx) {
      stepIdx = candidateIdx;
    }

    const remainingDistance = Math.max(routeLength - currentS, 0);

    const arrivalReady =
      hasDeparted &&
      remainingDistance <= settings.arrivalMeters &&
      currentS > routeLength * 0.9 &&
      context.hasStartedGpx;

    let step = normalizedSteps[Math.min(stepIdx, normalizedSteps.length - 1)];
    if (step.maneuver?.type === 'arrive' && !arrivalReady && stepIdx > 0) {
      stepIdx = stepIdx - 1;
      step = normalizedSteps[stepIdx];
    }

    const stepStart = step.stepStartS ?? 0;
    const stepEnd = step.stepEndS ?? step.distanceAlongRoute;
    const distanceAlongStep = currentS - stepStart;
    const distanceToManeuver = Math.max(stepEnd - currentS, 0);

    const banner = pickBanner(step, distanceAlongStep);
    let primaryText = buildPrimaryText(step);
    let secondaryText = buildSecondaryText(step);

    let voiceToSpeak: string | null = null;
    const voiceInstructions = (step.voiceInstructions || [])
      .filter((item) => Number.isFinite(item.distanceAlongGeometry))
      .sort((a, b) => a.distanceAlongGeometry - b.distanceAlongGeometry);
    for (const instruction of voiceInstructions) {
      if (distanceAlongStep < instruction.distanceAlongGeometry) continue;
      const key = `voice:${stepIdx}:${instruction.distanceAlongGeometry}`;
      if (fired.has(key)) continue;
      fired.add(key);
      voiceToSpeak =
        instruction.announcement ||
        instruction.ssmlAnnouncement ||
        buildVoiceText(step, primaryText, distanceToManeuver, false);
      break;
    }
    if (!voiceToSpeak) {
      const thresholds = buildThresholds(step);
      const lastDistance = lastDistanceByStep.get(stepIdx);
      for (const threshold of thresholds) {
        if (distanceToManeuver > threshold.distance) continue;
        if (lastDistance !== undefined && lastDistance <= threshold.distance) continue;
        const key = `fallback:${stepIdx}:${threshold.id}`;
        if (fired.has(key)) continue;
        fired.add(key);
        voiceToSpeak = buildVoiceText(step, primaryText, distanceToManeuver, threshold.now);
        break;
      }
      lastDistanceByStep.set(stepIdx, distanceToManeuver);
    }

    if (step.maneuver?.type === 'arrive' && !arrivalReady) {
      voiceToSpeak = null;
      primaryText = 'Continue on the route';
      secondaryText = null;
    }

    let startAnnouncement: string | null = null;
    if (!startAnnounced && currentS > settings.startMeters) {
      startAnnounced = true;
      startAnnouncement = 'You are now at the starting point. Your training route has started.';
    }

    let arrivalAnnouncement: string | null = null;
    if (!arrivalAnnounced && arrivalReady) {
      arrivalAnnounced = true;
      arrivalAnnouncement = 'Route completed. Great job! Try another route to keep progressing.';
    }

    return {
      stepIdx,
      step,
      banner,
      distanceToManeuver,
      remainingDistance,
      primaryText,
      secondaryText,
      voiceToSpeak,
      startAnnouncement,
      arrivalAnnouncement,
    };
  };

  return { update, reset };
};

const pickBanner = (step: Step, distanceAlongStep: number) => {
  const instructions = step.bannerInstructions || [];
  if (!instructions.length) return null;
  const ordered = [...instructions].sort(
    (a, b) => (a.distanceAlongGeometry || 0) - (b.distanceAlongGeometry || 0),
  );
  let selected = ordered[0];
  for (const instruction of ordered) {
    if (distanceAlongStep >= instruction.distanceAlongGeometry) {
      selected = instruction;
    } else {
      break;
    }
  }
  return selected;
};

const normalizeSteps = (steps: Step[]) => {
  if (!steps.length) return [];
  const ordered = steps.slice().sort((a, b) => (a.stepEndS ?? a.distanceAlongRoute) - (b.stepEndS ?? b.distanceAlongRoute));
  return ordered.map((step, index) => {
    const prevEnd = index > 0 ? ordered[index - 1].stepEndS ?? ordered[index - 1].distanceAlongRoute : 0;
    const stepEnd = step.stepEndS ?? step.distanceAlongRoute;
    return {
      ...step,
      stepIndexGlobal: index,
      stepStartS: Number.isFinite(step.stepStartS) ? step.stepStartS : prevEnd,
      stepEndS: stepEnd,
    };
  });
};

const findStepIndexByS = (steps: Step[], currentS: number) => {
  if (!steps.length) return 0;
  const idx = steps.findIndex((step) => currentS <= (step.stepEndS ?? step.distanceAlongRoute));
  return idx === -1 ? steps.length - 1 : idx;
};

const buildPrimaryText = (step: Step) => {
  const primary = step.bannerInstructions?.[0]?.primary?.text;
  if (primary) {
    const enriched = enrichRoundabout(primary, step.exit);
    if (isRoundaboutStep(step) && step.name && !enriched.includes(step.name)) {
      return `${enriched} onto ${step.name}`;
    }
    return enriched;
  }
  return buildFallbackInstruction(step);
};

const buildSecondaryText = (step: Step) => {
  const secondary = step.bannerInstructions?.[0]?.secondary?.text || step.bannerInstructions?.[0]?.sub?.text;
  return secondary || null;
};

const buildVoiceText = (step: Step, baseInstruction: string, thresholdDistance: number, isNow: boolean) => {
  if (!baseInstruction) return null;
  if (isNow || thresholdDistance <= 15) return `Now, ${baseInstruction}`;
  const distanceText = formatDistanceVoiceUK(thresholdDistance);
  return `In ${distanceText}, ${baseInstruction}`;
};

const buildThresholds = (step: Step) => {
  const maneuverType = (step.maneuver?.type || '').toLowerCase();
  if (maneuverType === 'arrive') return [];
  const isRoundabout = isRoundaboutStep(step);

  const thresholds = isRoundabout
    ? [
        { id: 'r1', distance: 200, now: false },
        { id: 'r2', distance: 80, now: false },
        { id: 'r3', distance: 20, now: true },
      ]
    : [
        { id: 't1', distance: 320, now: false },
        { id: 't2', distance: 120, now: false },
        { id: 't3', distance: 40, now: false },
        { id: 't4', distance: 15, now: true },
      ];
  return thresholds;
};

const buildFallbackInstruction = (step: Step) => {
  const type = step.maneuver?.type || '';
  const modifier = step.maneuver?.modifier || '';
  const road = step.name || '';
  const roadSuffix = road ? ` onto ${road}` : '';
  if (type === 'arrive') return 'You have arrived at your destination';
  if (type === 'depart') return road ? `Head ${modifier || 'straight'} on ${road}` : 'Head straight';
  if (type === 'roundabout' || type === 'rotary') {
    if (step.exit) return `Take the ${formatOrdinal(step.exit)} exit at the roundabout${roadSuffix}`;
    return `At the roundabout, continue${roadSuffix}`;
  }
  if (modifier) return road ? `Turn ${modifier} onto ${road}` : `Turn ${modifier}`;
  if (road) return `Continue on ${road}`;
  return 'Continue';
};

const enrichRoundabout = (text: string, exit?: number) => {
  if (!exit) return text;
  if (/exit/i.test(text)) return text;
  return `${text}. Take the ${formatOrdinal(exit)} exit`;
};

const isRoundaboutStep = (step: Step) => {
  const type = step.maneuver?.type || step.bannerInstructions?.[0]?.primary?.type || '';
  return ['roundabout', 'rotary'].includes(type.toLowerCase());
};

const formatOrdinal = (n: number) => {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n}st`;
  if (mod10 === 2 && mod100 !== 12) return `${n}nd`;
  if (mod10 === 3 && mod100 !== 13) return `${n}rd`;
  return `${n}th`;
};
