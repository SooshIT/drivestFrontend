/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
let imageSize;
let usePathInput = false;
try {
  // Use Metro's image-size to match bundler behavior.
  const metroImageSizePath = path.join(process.cwd(), 'node_modules', 'metro', 'node_modules', 'image-size');
  if (fs.existsSync(metroImageSizePath)) {
    // eslint-disable-next-line global-require
    const metroImageSize = require(metroImageSizePath);
    imageSize = metroImageSize.default || metroImageSize.imageSize;
    usePathInput = true;
  } else {
    throw new Error('Metro image-size not found');
  }
} catch (err) {
  // eslint-disable-next-line global-require
  ({ imageSize } = require('image-size'));
}

const ROOT = path.join(__dirname, '..');
const ASSETS_DIR = path.join(ROOT, 'assets', 'traffic-signs');
const XLS_PATH = path.join(ASSETS_DIR, 'traffic-signs-images-image-details.xls');
const OUT_PATH = path.join(ROOT, 'src', 'content', 'roadSigns.ts');

const CATEGORY_META = {
  'warning-signs-jpg': { key: 'warning', label: 'Warning' },
  'regulatory-signs-jpg': { key: 'regulatory', label: 'Regulatory' },
  'traffic-calming-jpg': { key: 'traffic-calming', label: 'Traffic calming' },
  'direction-and-tourist-signs-jpg': { key: 'direction', label: 'Direction & tourist' },
  'signs-for-cyclists-and-pedestrians-jpg': { key: 'cyclist-pedestrian', label: 'Cyclist & pedestrian' },
  'information-signs-jpg': { key: 'information', label: 'Information' },
  'motorway-signs-jpg': { key: 'motorway', label: 'Motorway' },
  'tidal-flow-lane-control-jpg': { key: 'tidal-flow', label: 'Tidal flow' },
  'pedestrian,-cycle,-equestrian-jpg': { key: 'shared-use', label: 'Shared use' },
  'road-works-and-temporary-jpg': { key: 'road-works', label: 'Road works' },
  'miscellaneous-jpg': { key: 'misc', label: 'Other' },
};

const getCategoryMeta = (relativePath) => {
  const folder = String(relativePath || '').split('/')[0];
  return CATEGORY_META[folder] || { key: 'misc', label: 'Other' };
};

const buildDescription = (title, categoryKey) => {
  const base = String(title || 'This sign').trim().replace(/\.$/, '');
  switch (categoryKey) {
    case 'warning':
      return `${base}. Reduce speed, scan ahead, and be ready to slow or stop.`;
    case 'regulatory':
      return `${base}. This is a legal requirement. Follow the instruction and watch for enforcement.`;
    case 'traffic-calming':
      return `${base}. Expect speed-reducing measures and adjust speed early.`;
    case 'direction':
      return `${base}. Use this to plan your route and choose the correct lane in good time.`;
    case 'cyclist-pedestrian':
      return `${base}. Watch for cyclists or pedestrians and give extra space.`;
    case 'information':
      return `${base}. Provides guidance or facilities ahead; stay alert for follow-on signs.`;
    case 'motorway':
      return `${base}. Follow lane guidance early and check mirrors before changing lanes.`;
    case 'tidal-flow':
      return `${base}. Lane directions may change; obey signals and stay in your lane.`;
    case 'shared-use':
      return `${base}. Shared-use area ahead; be prepared to slow and give way.`;
    case 'road-works':
      return `${base}. Expect temporary layouts, lower limits, and workers. Proceed with extra caution.`;
    default:
      return `${base}. Follow the instruction and watch for related markings or signs.`;
  }
};

const walk = (dir, files = []) => {
  for (const entry of fs.readdirSync(dir)) {
    if (entry.startsWith('.')) continue;
    const full = path.join(dir, entry);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      walk(full, files);
    } else if (stat.isFile() && entry.toLowerCase().endsWith('.jpg')) {
      files.push(full);
    }
  }
  return files;
};

const escapeText = (text) =>
  String(text || '')
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$/g, '\\$')
    .replace(/\r?\n/g, ' ')
    .trim();

const jpgFiles = walk(ASSETS_DIR);
const jpgMap = new Map();
for (const file of jpgFiles) {
  jpgMap.set(path.basename(file), file);
}

const wb = xlsx.readFile(XLS_PATH);
const sheet = wb.Sheets[wb.SheetNames[0]];
const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });

const entries = [];
for (let i = 1; i < rows.length; i += 1) {
  const row = rows[i];
  if (!row || row.length < 11) continue;
  const description = row[1];
  const caption = row[2];
  const jpgName = row[10];
  if (!jpgName || typeof jpgName !== 'string') continue;
  const fullPath = jpgMap.get(jpgName);
  if (!fullPath) continue;
  try {
    if (usePathInput) {
      imageSize(fullPath);
    } else {
      imageSize(fs.readFileSync(fullPath));
    }
  } catch (err) {
    console.warn(`Skipping invalid JPG: ${jpgName}`);
    continue;
  }
  const relFromAssets = path.relative(ASSETS_DIR, fullPath).replace(/\\/g, '/');
  const categoryMeta = getCategoryMeta(relFromAssets);
  const title = caption || description || jpgName;
  entries.push({
    id: jpgName.replace(/\.jpg$/i, ''),
    title,
    description: buildDescription(title, categoryMeta.key),
    category: categoryMeta.key,
    imagePath: relFromAssets,
  });
}

const header = `// AUTO-GENERATED by scripts/generate-road-signs.js
// Source: assets/traffic-signs/traffic-signs-images-image-details.xls
/* eslint-disable quotes */
export type RoadSign = {
  id: string;
  title: string;
  description: string;
  category: string;
  imagePath: string;
};

export const roadSigns: RoadSign[] = [
`;

const body = entries
  .map(
    (entry) =>
      `  {\n    id: '${escapeText(entry.id)}',\n    title: \`${escapeText(entry.title)}\`,\n    description: \`${escapeText(entry.description)}\`,\n    category: '${escapeText(entry.category)}',\n    imagePath: '${escapeText(entry.imagePath)}',\n  }`,
  )
  .join(',\n');

const footer = '\n];\n';

fs.writeFileSync(OUT_PATH, `${header}${body}${footer}`, 'utf8');
console.log(`Wrote ${entries.length} road signs to ${OUT_PATH}`);
