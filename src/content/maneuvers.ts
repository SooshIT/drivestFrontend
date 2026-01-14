export type ManeuverInfo = {
  id: string;
  title: string;
  officialText: string;
  steps: string[];
  svg: string;
  road: 'vertical' | 'horizontal';
  poses: { x: number; y: number; rot: number }[];
  durationMs: number;
};

export const maneuvers: ManeuverInfo[] = [
  {
    id: 'fwd_bay',
    title: 'Forward Bay Park (Right Bay)',
    officialText: 'Drive forward into a parking bay on the right-hand side of the road, then reverse out safely.',
    steps: [
      'Check mirrors, signal right if anyone benefits.',
      'Position just left of the centreline so you can enter at 90 degrees.',
      'Creep in slowly; stop once fully inside the bay, parallel to the lines.',
      'Select reverse, observe 360 degrees, reverse straight back until your wheels are just outside the bay lines.',
      'Stop, select 1st, move off smoothly when clear.',
    ],
    svg: `<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
  <rect width="400" height="400" fill="#c9d1d9"/>
  <rect x="140" y="0" width="120" height="400" fill="#777"/>
  <line x1="200" x2="200" y1="0" y2="400" stroke="#fff" stroke-width="2" stroke-dasharray="10 5"/>
  <line x1="220" y1="120" x2="220" y2="200" stroke="#fff" stroke-width="3"/>
  <line x1="260" y1="120" x2="260" y2="200" stroke="#fff" stroke-width="3"/>
  <line x1="220" y1="120" x2="260" y2="120" stroke="#fff" stroke-width="3"/>
  <g id="car">
    <rect x="-20" y="-10" width="40" height="20" rx="4" fill="#2c7" stroke="#000"/>
    <circle cx="-12" cy="-10" r="3" fill="#222"/>
    <circle cx="-12" cy="10" r="3" fill="#222"/>
    <circle cx="12" cy="-10" r="3" fill="#222"/>
    <circle cx="12" cy="10" r="3" fill="#222"/>
  </g>
  <animateTransform xlink:href="#car" attributeName="transform" type="translate"
    values="200,320;200,220;200,160;240,140;240,140;240,200;200,320"
    keyTimes="0;0.2;0.4;0.6;0.7;0.8;1" dur="10s" repeatCount="indefinite"/>
  <animateTransform xlink:href="#car" attributeName="transform" type="rotate"
    values="0;0;0;90;90;90;0" keyTimes="0;0.2;0.4;0.6;0.7;0.8;1"
    dur="10s" repeatCount="indefinite" additive="sum"/>
</svg>`,
    road: 'vertical',
    poses: [
      { x: 200, y: 320, rot: 0 },
      { x: 200, y: 220, rot: 0 },
      { x: 200, y: 160, rot: 0 },
      { x: 240, y: 140, rot: 90 },
      { x: 240, y: 140, rot: 90 },
      { x: 240, y: 200, rot: 90 },
      { x: 200, y: 320, rot: 0 },
    ],
    durationMs: 10000,
  },
  {
    id: 'rev_bay',
    title: 'Reverse Bay Park (Right Bay)',
    officialText: 'Reverse into a parking bay on the right, then drive out.',
    steps: [
      'Pull up two car-lengths past the bay, about half a metre from the white line.',
      'POM: reverse gear, 360 degrees check, signal if useful.',
      'Reverse slowly until the 3rd white line disappears in your side-window, then full right lock.',
      'When the car is 45 degrees inside the bay, straighten.',
      'Keep going until fully in, parallel, stop.',
      'Observe, select 1st, drive out.',
    ],
    svg: `<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
  <rect width="400" height="400" fill="#c9d1d9"/>
  <rect x="140" y="0" width="120" height="400" fill="#777"/>
  <line x1="200" x2="200" y1="0" y2="400" stroke="#fff" stroke-width="2" stroke-dasharray="10 5"/>
  <line x1="220" y1="120" x2="220" y2="200" stroke="#fff" stroke-width="3"/>
  <line x1="260" y1="120" x2="260" y2="200" stroke="#fff" stroke-width="3"/>
  <line x1="220" y1="120" x2="260" y2="120" stroke="#fff" stroke-width="3"/>
  <g id="car">
    <rect x="-20" y="-10" width="40" height="20" rx="4" fill="#2c7" stroke="#000"/>
    <circle cx="-12" cy="-10" r="3" fill="#222"/>
    <circle cx="-12" cy="10" r="3" fill="#222"/>
    <circle cx="12" cy="-10" r="3" fill="#222"/>
    <circle cx="12" cy="10" r="3" fill="#222"/>
  </g>
  <animateTransform xlink:href="#car" attributeName="transform" type="translate"
    values="200,320;200,220;200,180;240,160;240,160;240,220;200,320"
    keyTimes="0;0.2;0.4;0.6;0.7;0.8;1" dur="10s" repeatCount="indefinite"/>
  <animateTransform xlink:href="#car" attributeName="transform" type="rotate"
    values="0;0;0;-90;-90;-90;0" keyTimes="0;0.2;0.4;0.6;0.7;0.8;1"
    dur="10s" repeatCount="indefinite" additive="sum"/>
</svg>`,
    road: 'vertical',
    poses: [
      { x: 200, y: 320, rot: 0 },
      { x: 200, y: 220, rot: 0 },
      { x: 200, y: 180, rot: 0 },
      { x: 240, y: 160, rot: -90 },
      { x: 240, y: 160, rot: -90 },
      { x: 240, y: 220, rot: -90 },
      { x: 200, y: 320, rot: 0 },
    ],
    durationMs: 10000,
  },
  {
    id: 'parallel_left',
    title: 'Parallel Park (Left Kerb)',
    officialText: 'Parallel park on the left-hand side of the road.',
    steps: [
      'Stop level with the target car, 0.5-0.75 m out, handbrake on.',
      'Reverse gear, 360 degrees check, signal left.',
      'Reverse until your side-window lines up with the target car rear bumper, full left lock.',
      'When your right door mirror is level with the target car left tail-light, straighten.',
      'Once clear of the target car, full right lock to swing in.',
      'When parallel and 20-30 cm from kerb, straighten and stop.',
    ],
    svg: `<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
  <rect width="400" height="400" fill="#c9d1d9"/>
  <rect x="0" y="140" width="400" height="120" fill="#777"/>
  <line x1="0" x2="400" y1="200" y2="200" stroke="#fff" stroke-width="2" stroke-dasharray="10 5"/>
  <rect x="0" y="135" width="400" height="5" fill="#fff"/>
  <rect x="250" y="155" width="60" height="30" rx="4" fill="#bbb" stroke="#000"/>
  <circle cx="260" cy="155" r="3" fill="#222"/><circle cx="260" cy="185" r="3" fill="#222"/>
  <circle cx="300" cy="155" r="3" fill="#222"/><circle cx="300" cy="185" r="3" fill="#222"/>
  <g id="car">
    <rect x="-30" y="-15" width="60" height="30" rx="4" fill="#2c7" stroke="#000"/>
    <circle cx="-18" cy="-15" r="3" fill="#222"/><circle cx="-18" cy="15" r="3" fill="#222"/>
    <circle cx="18" cy="-15" r="3" fill="#222"/><circle cx="18" cy="15" r="3" fill="#222"/>
  </g>
  <animateTransform xlink:href="#car" attributeName="transform" type="translate"
    values="320,200;280,200;240,200;210,180;180,160;200,160;260,200;320,200"
    keyTimes="0;0.15;0.3;0.5;0.7;0.8;0.9;1" dur="12s" repeatCount="indefinite"/>
  <animateTransform xlink:href="#car" attributeName="transform" type="rotate"
    values="0;0;-30;-30;30;0;0;0" keyTimes="0;0.15;0.3;0.5;0.7;0.8;0.9;1"
    dur="12s" repeatCount="indefinite" additive="sum"/>
</svg>`,
    road: 'horizontal',
    poses: [
      { x: 320, y: 200, rot: 0 },
      { x: 280, y: 200, rot: 0 },
      { x: 240, y: 200, rot: -30 },
      { x: 210, y: 180, rot: -30 },
      { x: 180, y: 160, rot: 30 },
      { x: 200, y: 160, rot: 0 },
      { x: 260, y: 200, rot: 0 },
      { x: 320, y: 200, rot: 0 },
    ],
    durationMs: 12000,
  },
  {
    id: 'right_reverse',
    title: 'Pull Up Right, Reverse, Rejoin',
    officialText: 'Pull up on the right-hand side of the road, reverse in a straight line for 2 car lengths, then rejoin traffic on the left.',
    steps: [
      'Check mirrors, signal right, pull up straight and parallel, 20-30 cm from kerb.',
      'Handbrake on, select reverse, 360 degrees check.',
      'Reverse straight back for about 2 car lengths, keep slow and steady.',
      'Stop, select 1st, observe (blind spots especially), signal left.',
      'Move off when safe, cross the road to regain normal driving side.',
    ],
    svg: `<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
  <rect width="400" height="400" fill="#c9d1d9"/>
  <rect x="0" y="140" width="400" height="120" fill="#777"/>
  <line x1="0" x2="400" y1="200" y2="200" stroke="#fff" stroke-width="2" stroke-dasharray="10 5"/>
  <g id="car">
    <rect x="-20" y="-10" width="40" height="20" rx="4" fill="#2c7" stroke="#000"/>
    <circle cx="-12" cy="-10" r="3" fill="#222"/>
    <circle cx="-12" cy="10" r="3" fill="#222"/>
    <circle cx="12" cy="-10" r="3" fill="#222"/>
    <circle cx="12" cy="10" r="3" fill="#222"/>
  </g>
  <animateTransform xlink:href="#car" attributeName="transform" type="translate"
    values="200,320;150,160;110,160;110,160;150,200;220,200"
    keyTimes="0;0.3;0.5;0.6;0.8;1" dur="10s" repeatCount="indefinite"/>
  <animateTransform xlink:href="#car" attributeName="transform" type="rotate"
    values="0;180;180;180;0;0" keyTimes="0;0.3;0.5;0.6;0.8;1"
    dur="10s" repeatCount="indefinite" additive="sum"/>
</svg>`,
    road: 'horizontal',
    poses: [
      { x: 200, y: 320, rot: 0 },
      { x: 150, y: 160, rot: 180 },
      { x: 110, y: 160, rot: 180 },
      { x: 110, y: 160, rot: 180 },
      { x: 150, y: 200, rot: 0 },
      { x: 220, y: 200, rot: 0 },
    ],
    durationMs: 10000,
  },
  {
    id: 'turn_in_road',
    title: 'Turn in the Road (3-Point)',
    officialText: 'Turn the car around to face the opposite direction, using forward and reverse gears.',
    steps: [
      'Pull up on the left, 20-30 cm from kerb, handbrake on.',
      '1st gear, full right lock, move slowly forward until close to opposite kerb.',
      'Stop, select reverse, full left lock, 360 degrees check.',
      'Reverse slowly back toward the original kerb.',
      'Stop, select 1st, straighten wheels, move off smoothly.',
      'If road is narrow you may need 5 points; still pass if safe and controlled.',
    ],
    svg: `<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
  <rect width="400" height="400" fill="#c9d1d9"/>
  <rect x="140" y="0" width="120" height="400" fill="#777"/>
  <line x1="200" x2="200" y1="0" y2="400" stroke="#fff" stroke-width="2" stroke-dasharray="10 5"/>
  <g id="car">
    <rect x="-20" y="-10" width="40" height="20" rx="4" fill="#2c7" stroke="#000"/>
    <circle cx="-12" cy="-10" r="3" fill="#222"/>
    <circle cx="-12" cy="10" r="3" fill="#222"/>
    <circle cx="12" cy="-10" r="3" fill="#222"/>
    <circle cx="12" cy="10" r="3" fill="#222"/>
  </g>
  <animateTransform xlink:href="#car" attributeName="transform" type="translate"
    values="200,320;200,300;220,250;240,200;200,160;160,240;200,320"
    keyTimes="0;0.15;0.3;0.5;0.7;0.85;1" dur="12s" repeatCount="indefinite"/>
  <animateTransform xlink:href="#car" attributeName="transform" type="rotate"
    values="0;0;-35;-35;35;0;0" keyTimes="0;0.15;0.3;0.5;0.7;0.85;1"
    dur="12s" repeatCount="indefinite" additive="sum"/>
</svg>`,
    road: 'vertical',
    poses: [
      { x: 200, y: 320, rot: 0 },
      { x: 200, y: 300, rot: 0 },
      { x: 220, y: 250, rot: -35 },
      { x: 240, y: 200, rot: -35 },
      { x: 200, y: 160, rot: 35 },
      { x: 160, y: 240, rot: 0 },
      { x: 200, y: 320, rot: 0 },
    ],
    durationMs: 12000,
  },
  {
    id: 'emergency_stop',
    title: 'Emergency Stop',
    officialText: 'Stop the car as quickly and safely as possible when I give the signal.',
    steps: [
      'Drive at 30 mph (or appropriate) in a straight line.',
      'When the examiner raises the clipboard and says STOP, clutch + brake hard immediately.',
      'Keep both hands on wheel; do not check mirrors.',
      'Once stopped, apply handbrake, select neutral.',
      'When examiner says drive on, observe, select 1st, move off.',
    ],
    svg: `<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
  <rect width="400" height="400" fill="#c9d1d9"/>
  <rect x="140" y="0" width="120" height="400" fill="#777"/>
  <line x1="200" x2="200" y1="0" y2="400" stroke="#fff" stroke-width="2" stroke-dasharray="10 5"/>
  <g id="stop" opacity="0">
    <rect x="170" y="150" width="60" height="30" fill="#d00" rx="4"/>
    <text x="200" y="170" text-anchor="middle" fill="#fff" font-size="16" font-family="sans-serif">STOP</text>
  </g>
  <g id="car">
    <rect x="-20" y="-10" width="40" height="20" rx="4" fill="#2c7" stroke="#000"/>
    <circle cx="-12" cy="-10" r="3" fill="#222"/>
    <circle cx="-12" cy="10" r="3" fill="#222"/>
    <circle cx="12" cy="-10" r="3" fill="#222"/>
    <circle cx="12" cy="10" r="3" fill="#222"/>
  </g>
  <animateTransform xlink:href="#car" attributeName="transform" type="translate"
    values="200,320;200,280" keyTimes="0;0.7" dur="1.5s" repeatCount="indefinite"/>
  <animate xlink:href="#stop" attributeName="opacity" values="0;1;1;0" dur="1.5s" repeatCount="indefinite"/>
</svg>`,
    road: 'vertical',
    poses: [
      { x: 200, y: 320, rot: 0 },
      { x: 200, y: 280, rot: 0 },
    ],
    durationMs: 1500,
  },
];