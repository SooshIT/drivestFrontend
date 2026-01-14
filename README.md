# Route Master Mobile (React Native / Expo)

Duolingo-style progress + Waze-style navigation for driving test routes. Connects to the NestJS backend in `../backend`.

## Stack
- Expo SDK 54 (TypeScript)
- React Navigation (native stack + bottom tabs)
- React Query for server state
- react-hook-form + zod for forms
- AsyncStorage + expo-sqlite for auth token & offline cache
- react-native-maps for map UI (Mapbox plugin configured, but maps fallback works without offline packs)
- RevenueCat purchases via `react-native-purchases`
- Expo Location for tracking

## Setup
1. Install deps
   ```bash
   cd frontend
   npm install
   ```
2. Copy env
   ```bash
   cp .env.example .env
   # Set EXPO_PUBLIC_API_URL to your backend (e.g., http://localhost:3000)
   # Add Mapbox tokens if using Mapbox, else leave blank for react-native-maps
   # Set EXPO_PUBLIC_REVCAT_API_KEY from RevenueCat
   ```
3. Start dev server
   ```bash
   npx expo start
   ```
4. iOS/Android: open Expo Go or simulator. Location permissions are required for "Near me", practice, and cashback.

## Permissions
- Foreground location (practice, cashback, near-me search)
- Background location if you enable background tracking (Expo Location configured).

## Key Flows
- **Splash**: boots auth token, init RevenueCat, creates SQLite tables.
- **Auth**: email/password login + register. JWT stored in AsyncStorage.
- **Explore**: search centres, near-me, weekly goal cards. Open centre to see routes and buy centre pack.
- **Centre Detail**: map preview, buy/restore purchases, list routes with lock badges.
- **Route Detail**: download for offline (SQLite) and start practice.
- **Practice**: map-first, route polyline, live position, start/pause/finish; saves stats cache + posts finish to backend.
- **My Routes**: grouped by centre, filters for downloaded/active access, shows stats and offline badge.
- **Cashback**: once-per-lifetime flow with tracking + submit to backend.
- **Settings**: profile edit, entitlements list, restore purchases, delete account (calls backend).

## Offline
- Downloaded routes stored in `downloaded_routes` SQLite table.
- Route stats and queued sessions cached; practice can be started offline and synced later (basic queue storage).

## Testing
```bash
npm test
```
(Jest + jest-expo; includes util + screen smoke tests.)

## Mapbox
App config reads `EXPO_PUBLIC_MAPBOX_TOKEN` (public) and `EXPO_PUBLIC_MAPBOX_DOWNLOAD_TOKEN` (secret) from `.env`. If you add a Mapbox build/native module later, these will be available via `Constants.expoConfig?.extra`. Without Mapbox the app falls back to `react-native-maps` polylines.

### Map Matching Fallback Navigation
When the native Mapbox Navigation SDK UI is unavailable, the app uses a JS fallback that:
- Calls the Mapbox Map Matching API for GPX routes. We always set `waypoints=0;{lastIndex}` so only the start/finish are treated as waypoints (otherwise every coordinate becomes a waypoint and causes repeated arrivals).
- Downsamples GPX points by distance, chunks to respect the 100-coordinate limit, and stitches geometries/steps into a single NavPackage.
- Uses a forward-only localizer and instruction engine to keep voice/banner instructions aligned on looped routes.

Tuning knobs live in `frontend/src/navigation/mapboxMatching.ts` (downsample meters, radiuses, chunk overlap) and `frontend/src/navigation/routeLocalization.ts` (window sizes, off-route threshold).
Map Matching is billable per request; caching is enabled to reduce calls.

### CarPuck (Fallback JS Only)
The fallback navigation uses a Waze-style car puck that follows the snapped route position and a stabilized route bearing.
- **3D model (preferred):** place a GLB at `frontend/assets/models/car.glb`
- **2D fallback:** icon at `frontend/assets/icons/Car.png`
- The puck uses a ModelLayer if supported; otherwise it falls back to a SymbolLayer.
- Bearing comes from route geometry (not device compass) and is smoothed for stability.
- Toggle 3D in `frontend/src/screens/Practice/PracticeScreen.tsx` via `use3DCar`.

Performance tips: keep the GLB low poly, small textures, and avoid complex animations.

## Assumptions
- Backend JWT auth endpoints from the provided NestJS app.
- RevenueCat products configured with same IDs as backend products.
- Expo Go acceptable for dev; production build should use EAS with native modules for purchases/maps.
