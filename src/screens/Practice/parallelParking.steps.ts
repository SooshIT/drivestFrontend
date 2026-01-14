export type Pose = { x: number; y: number; rotation: number };

export type ManeuverStep = {
  id: string;
  title: string;
  description: string;
  audioText: string;
  mistakes: string[];
  pathType: 'straight' | 'arc';
  startPose: Pose;
  endPose: Pose;
  arc?: {
    cx: number;
    cy: number;
    radius: number;
    startAngle: number; // degrees
    endAngle: number; // degrees
  };
  durationMs: number;
  markers?: { type: 'alignment' | 'clearance' | 'parked'; x: number; y: number }[];
  steering: 'left' | 'right' | 'full-left' | 'full-right' | 'straight';
  showMirrorFlash?: boolean;
};

export const parallelParkingSteps: ManeuverStep[] = [
  {
    id: 'step1',
    title: 'Pull up parallel',
    description: 'Stop level with the parked car, about one metre away.',
    audioText: 'Pull up parallel to the parked car, leaving about one metre of space.',
    mistakes: ['Stopping too far back', 'Being too close to the parked car'],
    pathType: 'straight',
    startPose: { x: 0.65, y: 0.7, rotation: 0 },
    endPose: { x: 0.65, y: 0.55, rotation: 0 },
    durationMs: 1500,
    markers: [{ type: 'alignment', x: 0.5, y: 0.55 }],
    steering: 'straight',
  },
  {
    id: 'step2',
    title: 'Select reverse & observe',
    description: 'Select reverse gear and complete all-round observation.',
    audioText: 'Select reverse gear. Check all around for pedestrians and traffic.',
    mistakes: ['Skipping blind spot check', 'Not signalling when necessary'],
    pathType: 'straight',
    startPose: { x: 0.65, y: 0.55, rotation: 0 },
    endPose: { x: 0.65, y: 0.55, rotation: 0 },
    durationMs: 1200,
    steering: 'straight',
    showMirrorFlash: true,
  },
  {
    id: 'step3',
    title: 'Reverse straight',
    description: 'Reverse slowly with wheels straight.',
    audioText: 'Reverse slowly, keeping the wheels straight.',
    mistakes: ['Reversing too fast', 'Drifting away from the kerb'],
    pathType: 'straight',
    startPose: { x: 0.65, y: 0.55, rotation: 0 },
    endPose: { x: 0.65, y: 0.65, rotation: 0 },
    durationMs: 1800,
    steering: 'straight',
  },
  {
    id: 'step4',
    title: 'Full lock left',
    description: 'When rear windows align, full lock left.',
    audioText: 'When the rear windows align, turn the steering wheel fully to the left.',
    mistakes: ['Turning too early', 'Not enough steering input'],
    pathType: 'arc',
    startPose: { x: 0.65, y: 0.65, rotation: 0 },
    endPose: { x: 0.58, y: 0.72, rotation: -35 },
    arc: { cx: 0.55, cy: 0.65, radius: 0.12, startAngle: 90, endAngle: 200 },
    durationMs: 1800,
    markers: [{ type: 'alignment', x: 0.5, y: 0.7 }],
    steering: 'full-left',
  },
  {
    id: 'step5',
    title: 'Straighten at 45°',
    description: 'At about 45 degrees, straighten the wheels.',
    audioText: 'As the car reaches a forty five degree angle, straighten the wheels.',
    mistakes: ['Over-rotating beyond 45 degrees'],
    pathType: 'straight',
    startPose: { x: 0.58, y: 0.72, rotation: -35 },
    endPose: { x: 0.55, y: 0.76, rotation: -35 },
    durationMs: 1400,
    steering: 'straight',
  },
  {
    id: 'step6',
    title: 'Clear the parked car',
    description: 'Continue reversing until your front clears the parked car.',
    audioText: 'Continue reversing slowly until the front clears the parked car.',
    mistakes: ['Stopping too early', 'Not checking front clearance'],
    pathType: 'straight',
    startPose: { x: 0.55, y: 0.76, rotation: -35 },
    endPose: { x: 0.5, y: 0.82, rotation: -35 },
    durationMs: 1400,
    markers: [{ type: 'clearance', x: 0.52, y: 0.65 }],
    steering: 'straight',
  },
  {
    id: 'step7',
    title: 'Full lock right',
    description: 'Turn fully right to straighten into the space.',
    audioText: 'Turn the steering wheel fully to the right to straighten the car.',
    mistakes: ['Not steering enough', 'Reversing too fast'],
    pathType: 'arc',
    startPose: { x: 0.5, y: 0.82, rotation: -35 },
    endPose: { x: 0.48, y: 0.9, rotation: 0 },
    arc: { cx: 0.52, cy: 0.86, radius: 0.08, startAngle: 305, endAngle: 360 },
    durationMs: 1800,
    steering: 'full-right',
  },
  {
    id: 'step8',
    title: 'Park and secure',
    description: 'Stop safely, handbrake, neutral.',
    audioText: 'Stop safely. Apply the handbrake and select neutral.',
    mistakes: ['Forgetting handbrake', 'Not ending parallel'],
    pathType: 'straight',
    startPose: { x: 0.48, y: 0.9, rotation: 0 },
    endPose: { x: 0.48, y: 0.9, rotation: 0 },
    durationMs: 1000,
    markers: [{ type: 'parked', x: 0.48, y: 0.9 }],
    steering: 'straight',
  },
];
