import MapboxGL from '@rnmapbox/maps';

const token = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;
if (token) {
  MapboxGL.setAccessToken(token);
}

export default MapboxGL;
