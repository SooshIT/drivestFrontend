import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Card, Text, Button, Chip, IconButton, Divider } from 'react-native-paper';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { apiRoutes } from '../../api';
import { spacing, colors } from '../../styles/theme';
import { saveDownloadedRoute } from '../../db';
import { coordsFromGpx, metersToKm, secondsToMinutes } from '../../utils';
import MapboxGL from '../../lib/mapbox';
import { useEntitlements, hasAccessToCentre } from '../../hooks/useEntitlements';
import PaywallModal from '../../components/PaywallModal';
import { useAuth } from '../../context/AuthContext';

const RouteDetailScreen: React.FC<NativeStackScreenProps<any>> = ({ route, navigation }) => {
  const { guest } = useAuth();
  const initialRoute = route?.params?.route;
  const centre = route?.params?.centre;
  if (!initialRoute) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing(3), paddingBottom: spacing(4) }}>
        <View style={styles.headerRow}>
          <IconButton icon="arrow-left" onPress={() => navigation.goBack()} />
          <Text variant="titleLarge" style={{ flex: 1, textAlign: 'center', marginRight: spacing(6) }}>
            Route
          </Text>
        </View>
        <Card style={{ borderRadius: 16, marginTop: spacing(1) }}>
          <Card.Content>
            <Text variant="bodyLarge">Route details unavailable.</Text>
            <Text style={{ color: colors.muted, marginTop: spacing(0.5) }}>
              Please return to the centre and choose a route again.
            </Text>
          </Card.Content>
        </Card>
      </ScrollView>
    );
  }
  const entitlements = useEntitlements();
  const canAccess = hasAccessToCentre(entitlements.data, initialRoute.centreId);
  const [routeDto, setRouteDto] = useState(initialRoute);
  const [downloading, setDownloading] = useState(false);
  const isDownloaded = !!routeDto?.downloaded;
  const [paywall, setPaywall] = useState(false);

  const handleDownload = async () => {
    if (!canAccess) {
      setPaywall(true);
      return;
    }
    setDownloading(true);
    const res = await apiRoutes.detail(routeDto.id);
    const data = res.data.data || (res.data as any);
    setRouteDto({ ...data, downloaded: true });
    saveDownloadedRoute(data);
    setDownloading(false);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing(3), paddingBottom: spacing(4) }}>
      <View style={styles.headerRow}>
        <IconButton icon="arrow-left" onPress={() => navigation.goBack()} />
        <Text variant="titleLarge" style={{ flex: 1, textAlign: 'center', marginRight: spacing(6) }}>
          {routeDto.name}
        </Text>
      </View>

      <Card style={{ borderRadius: 16, marginTop: spacing(1) }}>
        <Card.Content>
          <Text style={{ color: colors.muted }}>
            {metersToKm(routeDto.distanceM)} • {secondsToMinutes(routeDto.durationEstS)}
          </Text>
          <View style={{ flexDirection: 'row', marginTop: spacing(1), flexWrap: 'wrap' }}>
            <Chip style={{ marginRight: spacing(1), marginBottom: spacing(1) }}>Version {routeDto.version}</Chip>
            <Chip style={{ marginRight: spacing(1), marginBottom: spacing(1) }}>Centre {routeDto.centreId}</Chip>
          </View>
          <Divider style={{ marginVertical: spacing(1) }} />
          <View style={{ height: 240, borderRadius: 12, overflow: 'hidden' }}>
            <MapboxGL.MapView style={StyleSheet.absoluteFill} styleURL="mapbox://styles/mapbox/navigation-day-v1">
              <MapboxGL.Camera
                bounds={routeDto.bbox ? bboxToBounds(routeDto.bbox) : undefined}
                zoomLevel={routeDto.bbox ? undefined : 13}
                centerCoordinate={
                  routeDto.bbox ? undefined : [routeDto.lng ?? routeDto.centre?.lng ?? 0, routeDto.lat ?? routeDto.centre?.lat ?? 0]
                }
              />
              <MapboxGL.ShapeSource id="preview-route" shape={lineString(routeDto.geojson || routeDto.polyline, routeDto)}>
                <MapboxGL.LineLayer id="preview-route-line" style={{ lineColor: colors.primary, lineWidth: 4 }} />
              </MapboxGL.ShapeSource>
            </MapboxGL.MapView>
          </View>
          <Text style={{ marginTop: spacing(1), color: colors.muted }}>
            Practice this DVSA-style route with turn-by-turn guidance, speed, and progress tracking.
          </Text>
          {!canAccess && !isDownloaded ? (
            <Button mode="contained" style={{ marginTop: spacing(2) }} onPress={() => setPaywall(true)}>
              Unlock this centre
            </Button>
          ) : (
            <>
              {!isDownloaded ? (
                <Button mode="contained" onPress={handleDownload} loading={downloading} style={{ marginTop: spacing(2) }}>
                  Download for offline
                </Button>
              ) : (
                <Chip style={{ marginTop: spacing(2), alignSelf: 'flex-start' }} icon="check">
                  Downloaded for offline
                </Chip>
              )}
              <Button
                mode="outlined"
                style={{ marginTop: spacing(1) }}
                onPress={async () => {
                  if (isDownloaded) {
                    navigation.navigate('Practice', { route: routeDto });
                    return;
                  }
                  // ensure we have full geojson/gpx before practice
                  try {
                    const res = await apiRoutes.detail(routeDto.id);
                    const data = res.data.data || (res.data as any);
                    setRouteDto(data);
                    navigation.navigate('Practice', { route: data });
                  } catch {
                    navigation.navigate('Practice', { route: routeDto });
                  }
                }}
              >
                Start practice
              </Button>
            </>
          )}
        </Card.Content>
      </Card>
      <PaywallModal
        visible={paywall}
        guest={guest}
        onLogin={() => navigation.navigate('Auth')}
        onClose={() => setPaywall(false)}
        onPurchase={() => {
          setPaywall(false);
          entitlements.refetch?.();
        }}
        onRestore={() => {
          entitlements.refetch?.();
        }}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
});

export default RouteDetailScreen;

const lineString = (geojsonOrPolyline: any, route: any) => {
  if (geojsonOrPolyline?.type === 'FeatureCollection' || geojsonOrPolyline?.type === 'Feature') {
    return geojsonOrPolyline;
  }
  if (route?.gpx) {
    const coords = coordsFromGpx(route.gpx);
    if (coords.length) {
      return {
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: coords.map((c) => [c.longitude, c.latitude]) },
      };
    }
  }
  // fallback to polyline coords array on route (already decoded)
  if (route?.bbox && Array.isArray(route.bbox) && route.bbox.length === 4) {
    // bbox stored as [minX,minY,maxX,maxY]
  }
  const coords = route?.polylineCoords || [];
  return {
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: coords.map((c: any) => [c.longitude, c.latitude]) },
  };
};

const bboxToBounds = (bbox: any) => {
  // bbox from backend stored as [minLng, minLat, maxLng, maxLat]
  if (!Array.isArray(bbox) || bbox.length !== 4) return undefined;
  const [minLng, minLat, maxLng, maxLat] = bbox;
  return { ne: [maxLng, maxLat] as [number, number], sw: [minLng, minLat] as [number, number], padding: 20 };
};
