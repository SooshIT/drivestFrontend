import { __test__ as matchingTest } from '../src/navigation/mapboxMatching';
import { buildCumulativeDistances, createRouteLocalizer } from '../src/navigation/routeLocalization';
import { NavPackage } from '../src/navigation/navTypes';
import { createInstructionEngine } from '../src/navigation/instructionEngine';

describe('navigation utilities', () => {
  test('downsample keeps start/end and preserves turn points', () => {
    const coords = [
      { latitude: 0, longitude: 0 },
      { latitude: 0, longitude: 0.001 },
      { latitude: 0, longitude: 0.002 },
      { latitude: 0.001, longitude: 0.002 },
      { latitude: 0.002, longitude: 0.002 },
    ];
    const sampled = matchingTest.downsampleRoute(coords, 10, 15);
    expect(sampled[0]).toEqual(coords[0]);
    expect(sampled[sampled.length - 1]).toEqual(coords[coords.length - 1]);
    const hasTurn = sampled.some((p) => p.latitude === 0.001 && p.longitude === 0.002);
    expect(hasTurn).toBe(true);
  });

  test('stitchPolylines removes overlap duplicates', () => {
    const a = { latitude: 0, longitude: 0 };
    const b = { latitude: 0, longitude: 0.001 };
    const c = { latitude: 0, longitude: 0.002 };
    const d = { latitude: 0, longitude: 0.003 };
    const e = { latitude: 0, longitude: 0.004 };
    const stitched = matchingTest.stitchPolylines([
      [a, b, c],
      [c, d, e],
    ]);
    expect(stitched.length).toBe(5);
    expect(stitched[0]).toEqual(a);
    expect(stitched[stitched.length - 1]).toEqual(e);
  });

  test('chunking respects 100-point limit', () => {
    const coords = Array.from({ length: 220 }, (_, idx) => ({
      latitude: 0,
      longitude: idx * 0.00001,
    }));
    const cleaned = matchingTest.removeDuplicateCoords(coords, 1);
    const sampled = matchingTest.downsampleRoute(cleaned, 0.5, 10);
    const chunks = matchingTest.createChunks(sampled, 100, 4);
    expect(chunks.every((chunk) => chunk.length <= 100)).toBe(true);
  });

  test('stitchSteps keeps stepEndS monotonic across overlaps', () => {
    const stepsA = [
      {
        stepIndexGlobal: 0,
        maneuver: { type: 'depart', location: { latitude: 0, longitude: 0 } },
        distanceAlongRoute: 0,
        distance: 100,
      },
      {
        stepIndexGlobal: 1,
        maneuver: { type: 'turn', location: { latitude: 0, longitude: 0.001 } },
        distanceAlongRoute: 0,
        distance: 120,
      },
    ];
    const stepsB = [
      {
        stepIndexGlobal: 0,
        maneuver: { type: 'depart', location: { latitude: 0, longitude: 0.001 } },
        distanceAlongRoute: 0,
        distance: 80,
      },
      {
        stepIndexGlobal: 1,
        maneuver: { type: 'turn', location: { latitude: 0, longitude: 0.002 } },
        distanceAlongRoute: 0,
        distance: 90,
      },
    ];
    const stitched = matchingTest.stitchSteps([stepsA, stepsB], 2);
    for (let i = 1; i < stitched.length; i += 1) {
      expect(stitched[i].stepEndS).toBeGreaterThan(stitched[i - 1].stepEndS as number);
    }
  });

  test('route localization avoids large backward jumps on overlaps', () => {
    const route = [
      { latitude: 0, longitude: 0 },
      { latitude: 0, longitude: 0.001 },
      { latitude: 0.001, longitude: 0.001 },
      { latitude: 0, longitude: 0.001 },
      { latitude: 0, longitude: 0.002 },
    ];
    const navPackage: NavPackage = {
      id: 'test',
      originalPolyline: route,
      matchedPolyline: route,
      cumDist: buildCumulativeDistances(route),
      steps: [],
      meta: { createdAt: Date.now(), profile: 'driving', radiusesUsed: 15, chunks: 1, warnings: [] },
    };
    const localizer = createRouteLocalizer(navPackage);
    const first = localizer.update({ latitude: 0.001, longitude: 0.001 }, 0, 6, Date.now());
    const second = localizer.update({ latitude: 0, longitude: 0.001 }, 90, 6, Date.now() + 1000);
    expect(second.currentS).toBeGreaterThanOrEqual(first.currentS - 10);
  });

  test('localization respects bearing on crossing segments', () => {
    const route = [
      { latitude: 0, longitude: -0.001 },
      { latitude: 0, longitude: 0.001 },
      { latitude: 0.001, longitude: 0.001 },
      { latitude: 0.001, longitude: -0.001 },
      { latitude: 0, longitude: -0.001 },
      { latitude: 0, longitude: 0.001 },
    ];
    const navPackage: NavPackage = {
      id: 'test',
      originalPolyline: route,
      matchedPolyline: route,
      cumDist: buildCumulativeDistances(route),
      steps: [],
      meta: { createdAt: Date.now(), profile: 'driving', radiusesUsed: 15, chunks: 1, warnings: [] },
    };
    const localizer = createRouteLocalizer(navPackage);
    localizer.update({ latitude: 0, longitude: -0.001 }, 90, 6, Date.now());
    const mid = localizer.update({ latitude: 0, longitude: 0 }, 90, 6, Date.now() + 1000);
    const forward = localizer.update({ latitude: 0, longitude: 0.0009 }, 90, 6, Date.now() + 2000);
    expect(forward.currentS).toBeGreaterThanOrEqual(mid.currentS - 10);
  });

  test('instruction engine announces voice once per instruction', () => {
    const steps = [
      {
        stepIndexGlobal: 0,
        maneuver: { type: 'depart', location: { latitude: 0, longitude: 0 } },
        bannerInstructions: [],
        voiceInstructions: [
          { distanceAlongGeometry: 10, announcement: 'In 10 meters, turn right' },
        ],
        distanceAlongRoute: 20,
        distance: 20,
      },
    ];
    const engine = createInstructionEngine(steps, 100);
    const first = engine.update(15, 5, { distanceToStart: 50, distanceToEnd: 80, hasStartedGpx: true });
    const second = engine.update(16, 5, { distanceToStart: 50, distanceToEnd: 79, hasStartedGpx: true });
    expect(first.voiceToSpeak).toBe('In 10 meters, turn right');
    expect(second.voiceToSpeak).toBe(null);
  });

  test('instruction engine advances steps when skipping ahead', () => {
    const steps = [
      {
        stepIndexGlobal: 0,
        maneuver: { type: 'turn', location: { latitude: 0, longitude: 0 } },
        distanceAlongRoute: 20,
        distance: 20,
      },
      {
        stepIndexGlobal: 1,
        maneuver: { type: 'turn', location: { latitude: 0, longitude: 0 } },
        distanceAlongRoute: 40,
        distance: 20,
      },
    ];
    const engine = createInstructionEngine(steps, 100);
    const update = engine.update(55, 5, { distanceToStart: 100, distanceToEnd: 40, hasStartedGpx: true });
    expect(update.stepIdx).toBe(1);
  });

  test('arrival does not fire before departure', () => {
    const steps = [
      {
        stepIndexGlobal: 0,
        maneuver: { type: 'turn', location: { latitude: 0, longitude: 0 } },
        distanceAlongRoute: 20,
        distance: 20,
      },
    ];
    const engine = createInstructionEngine(steps, 100);
    const early = engine.update(5, 0, { distanceToStart: 10, distanceToEnd: 15, hasStartedGpx: false });
    expect(early.arrivalAnnouncement).toBe(null);
    const later = engine.update(90, 3, { distanceToStart: 120, distanceToEnd: 10, hasStartedGpx: true });
    expect(later.arrivalAnnouncement).not.toBe(null);
  });

  test('roundabout exit included in instruction text', () => {
    const steps = [
      {
        stepIndexGlobal: 0,
        maneuver: { type: 'roundabout', location: { latitude: 0, longitude: 0 } },
        distanceAlongRoute: 120,
        distance: 120,
        exit: 2,
        name: 'High Street',
      },
    ];
    const engine = createInstructionEngine(steps, 200);
    const update = engine.update(30, 5, { distanceToStart: 100, distanceToEnd: 150, hasStartedGpx: true });
    expect(update.primaryText).toContain('2nd');
  });

  test('arrival does not fire early on loop routes', () => {
    const steps = [
      {
        stepIndexGlobal: 0,
        maneuver: { type: 'turn', location: { latitude: 0, longitude: 0 } },
        distanceAlongRoute: 60,
        distance: 60,
      },
    ];
    const engine = createInstructionEngine(steps, 500);
    const early = engine.update(80, 3, { hasStartedGpx: true });
    expect(early.arrivalAnnouncement).toBe(null);
  });

  test('voice does not repeat on identical updates', () => {
    const steps = [
      {
        stepIndexGlobal: 0,
        maneuver: { type: 'depart', location: { latitude: 0, longitude: 0 } },
        bannerInstructions: [],
        voiceInstructions: [
          { distanceAlongGeometry: 10, announcement: 'In 10 meters, turn right' },
        ],
        distanceAlongRoute: 20,
        distance: 20,
      },
    ];
    const engine = createInstructionEngine(steps, 100);
    const first = engine.update(15, 5, { hasStartedGpx: true });
    const second = engine.update(15, 5, { hasStartedGpx: true });
    expect(first.voiceToSpeak).toBe('In 10 meters, turn right');
    expect(second.voiceToSpeak).toBe(null);
  });
});
