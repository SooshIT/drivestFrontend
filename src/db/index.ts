import { openDatabaseAsync } from 'expo-sqlite';

// Keep a single DB handle
const dbPromise = openDatabaseAsync('routemaster.db');
let initPromise: Promise<void> | null = null;

const ensureDbReady = async () => {
  if (!initPromise) {
    initPromise = (async () => {
      const db = await dbPromise;
      // Run table creation in a single exec for speed
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS downloaded_routes (
          id TEXT PRIMARY KEY NOT NULL,
          centreId TEXT,
          name TEXT,
          distanceM INTEGER,
          durationEstS INTEGER,
          difficulty TEXT,
          polyline TEXT,
          geojson TEXT,
          gpx TEXT,
          bbox TEXT,
          payload TEXT,
          version INTEGER,
          updatedAt INTEGER
        );
        CREATE TABLE IF NOT EXISTS route_stats_cache (
          routeId TEXT PRIMARY KEY NOT NULL,
          timesCompleted INTEGER DEFAULT 0,
          lastCompletedAt INTEGER
        );
        CREATE TABLE IF NOT EXISTS practice_sessions_cache (
          id TEXT PRIMARY KEY NOT NULL,
          routeId TEXT,
          startedAt INTEGER,
          endedAt INTEGER,
          completed INTEGER,
          distanceM INTEGER,
          durationS INTEGER
        );
      `);
    })().catch((err) => {
      initPromise = null;
      throw err;
    });
  }
  await initPromise;
};

export const initDb = async () => {
  await ensureDbReady();
};

export const saveDownloadedRoute = async (route: any) => {
  await ensureDbReady();
  const db = await dbPromise;
  await db.runAsync(
    `INSERT OR REPLACE INTO downloaded_routes (id, centreId, name, distanceM, durationEstS, difficulty, polyline, geojson, gpx, bbox, payload, version, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      route.id,
      route.centreId,
      route.name,
      route.distanceM,
      route.durationEstS,
      route.difficulty,
      route.polyline,
      JSON.stringify(route.geojson || null),
      route.gpx || null,
      JSON.stringify(route.bbox || {}),
      JSON.stringify(route.payload || null),
      route.version,
      Date.now(),
    ],
  );
};

export const getDownloadedRoutes = async (): Promise<any[]> => {
  await ensureDbReady();
  const db = await dbPromise;
  const rows = await db.getAllAsync('SELECT * FROM downloaded_routes');
  return rows.map((r: any) => ({
    ...r,
    bbox: r.bbox ? JSON.parse(r.bbox) : null,
    geojson: r.geojson ? JSON.parse(r.geojson) : null,
    downloaded: true,
  }));
};

export const upsertRouteStat = async (routeId: string, update: { timesCompleted?: number; lastCompletedAt?: number }) => {
  await ensureDbReady();
  const db = await dbPromise;
  await db.runAsync(
    `INSERT OR IGNORE INTO route_stats_cache (routeId, timesCompleted, lastCompletedAt) VALUES (?, 0, NULL);`,
    [routeId],
  );
  await db.runAsync(
    `UPDATE route_stats_cache SET timesCompleted = COALESCE(timesCompleted,0) + ?, lastCompletedAt = ? WHERE routeId = ?;`,
    [update.timesCompleted || 0, update.lastCompletedAt || Date.now(), routeId],
  );
};

export const getRouteStats = async (): Promise<any[]> => {
  await ensureDbReady();
  const db = await dbPromise;
  return db.getAllAsync('SELECT * FROM route_stats_cache');
};

export const queuePracticeSession = async (session: any) => {
  await ensureDbReady();
  const db = await dbPromise;
  await db.runAsync(
    `INSERT OR REPLACE INTO practice_sessions_cache (id, routeId, startedAt, endedAt, completed, distanceM, durationS)
     VALUES (?, ?, ?, ?, ?, ?, ?);`,
    [
      session.id,
      session.routeId,
      session.startedAt,
      session.endedAt || null,
      session.completed ? 1 : 0,
      session.distanceM || 0,
      session.durationS || 0,
    ],
  );
};

export const getCachedSessions = async (): Promise<any[]> => {
  await ensureDbReady();
  const db = await dbPromise;
  return db.getAllAsync('SELECT * FROM practice_sessions_cache');
};

export const getDb = () => dbPromise;

export default dbPromise;
