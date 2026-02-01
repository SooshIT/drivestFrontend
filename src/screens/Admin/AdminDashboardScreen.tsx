import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Text, RadioButton, Snackbar, Chip, Divider, TextInput } from 'react-native-paper';
import * as DocumentPicker from 'expo-document-picker';
import { apiAdmin, apiCentres } from '../../api';
import { spacing, colors } from '../../styles/theme';
import { useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapboxSearchBox from '../../components/MapboxSearchBox';
import { SearchResult } from '../../types/mapbox';
import { extractPostcode, isUKLocation } from '../../utils/mapbox';

const AdminDashboardScreen: React.FC = () => {
  const qc = useQueryClient();
  const [usersCount, setUsersCount] = useState<number>(0);
  const [centreId, setCentreId] = useState<string>('');
  const [centreName, setCentreName] = useState('');
  const [postcode, setPostcode] = useState('');
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [routeName, setRouteName] = useState('');
  const [centres, setCentres] = useState<any[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    apiAdmin
      .stats()
      .then((res) => setUsersCount(res.data.data.users))
      .catch(() => setUsersCount(0));
    apiCentres
      .search({})
      .then((res) => {
        const data = (res.data as any).data?.items || (res.data as any).items || (res.data as any);
        setCentres(data || []);
      })
      .catch(() => setCentres([]));
  }, []);
  const totalCentres = useMemo(() => centres.length, [centres]);

  const handleAddressSelect = (result: SearchResult) => {
    const [lng, lat] = result.center;
    
    // Validate UK location
    if (!isUKLocation(lng, lat)) {
      setToast('Please select a UK location.');
      return;
    }

    setSelectedAddress(result.place_name);
    setCoordinates({ lat, lng });
    
    // Extract postcode from result or address
    const extractedPostcode = result.context?.find((c) => c.id.startsWith('postcode'))?.text 
      || extractPostcode(result.place_name);
    
    if (extractedPostcode) {
      setPostcode(extractedPostcode);
    }
  };

  const pickAndUpload = async () => {
    if (!centreId && !centreName.trim()) {
      setToast('Select a test centre or enter a new centre name.');
      return;
    }
    if (!centreId && !postcode.trim()) {
      setToast('Postcode is required for a new test centre.');
      return;
    }
    if (!routeName.trim()) {
      setToast('Route name is required.');
      return;
    }
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/gpx+xml', 'application/xml', 'text/xml', '*/*'],
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const file = result.assets?.[0];
    if (!file?.uri) return;
    setUploading(true);
    try {
      await apiAdmin.uploadRoute(centreId || null, {
        uri: file.uri,
        name: file.name || 'route.gpx',
        type: file.mimeType || 'application/gpx+xml',
      }, {
        centreName: centreName.trim() || undefined,
        postcode: postcode.trim() || undefined,
        routeName: routeName.trim(),
      });
      setToast('Route uploaded and parsed.');
      setCentreName('');
      setPostcode('');
      setRouteName('');
      setSelectedAddress(null);
      setCoordinates(null);
      if (!centreId) setCentreId('');
      // refresh centre/route lists for Explore + Centre Detail screens
      qc.invalidateQueries({ queryKey: ['centres'] });
      if (centreId) {
        qc.invalidateQueries({ queryKey: ['centre-routes', centreId] });
      }
      // refresh centres list in admin view
      const res = await apiCentres.search({});
      const data = (res.data as any).data?.items || (res.data as any).items || (res.data as any);
      setCentres(data || []);
    } catch (e) {
      setToast('Upload failed. Check admin access.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: spacing(3), paddingBottom: spacing(6) }}>
        <Card style={styles.heroCard}>
        <Card.Content>
          <Text variant="headlineSmall" style={styles.heroTitle}>Admin Dashboard</Text>
          <Text style={styles.heroSubtitle}>Manage routes, centres, and uploads in one place.</Text>
          <View style={styles.heroStatsRow}>
            <Chip icon="account-group" style={styles.statChip}>Users {usersCount}</Chip>
            <Chip icon="map-marker" style={styles.statChip}>Centres {totalCentres}</Chip>
          </View>
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium">Upload GPX Route</Text>
          <Text style={{ color: colors.muted, marginTop: spacing(0.5) }}>
            Select the test centre, then upload a GPX file to create the next numbered route.
          </Text>
          <RadioButton.Group onValueChange={(v) => setCentreId(v)} value={centreId}>
            {centres.map((c: any) => (
              <View key={c.id} style={styles.radioRow}>
                <RadioButton value={c.id} />
                <Text style={styles.radioLabel}>{`${c.name} (${c.postcode})`}</Text>
              </View>
            ))}
          </RadioButton.Group>
          <Divider style={{ marginVertical: spacing(1.5) }} />
          <Text variant="titleSmall" style={{ marginBottom: spacing(1) }}>
            Or create a new test centre:
          </Text>
          <TextInput
            label="New centre name (required if not selected)"
            value={centreName}
            onChangeText={setCentreName}
            style={{ marginTop: spacing(1) }}
          />
          <View style={{ marginTop: spacing(1.5) }}>
            <Text variant="bodySmall" style={{ marginBottom: spacing(0.5), color: colors.muted }}>
              Search for centre address:
            </Text>
            <MapboxSearchBox
              placeholder="Search for test centre address"
              onSelectResult={handleAddressSelect}
            />
          </View>
          {selectedAddress && (
            <Chip
              icon="map-marker"
              onClose={() => {
                setSelectedAddress(null);
                setCoordinates(null);
                setPostcode('');
              }}
              style={{ marginTop: spacing(1), alignSelf: 'flex-start' }}
            >
              {selectedAddress}
            </Chip>
          )}
          <TextInput
            label="Postcode (auto-filled or enter manually)"
            value={postcode}
            onChangeText={setPostcode}
            style={{ marginTop: spacing(1) }}
          />
          <TextInput
            label="Route name (required)"
            value={routeName}
            onChangeText={setRouteName}
            style={{ marginTop: spacing(1) }}
          />
          <Divider style={{ marginVertical: spacing(1) }} />
          <Button mode="contained" onPress={pickAndUpload} loading={uploading} style={{ alignSelf: 'flex-start' }}>
            Upload GPX
          </Button>
        </Card.Content>
      </Card>

        <Snackbar visible={!!toast} onDismiss={() => setToast(null)} duration={2000} style={{ bottom: '40%' }}>
          {toast}
        </Snackbar>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  card: { marginBottom: spacing(2), borderRadius: 16 },
  heroCard: { marginBottom: spacing(2), borderRadius: 18, backgroundColor: '#13245a' },
  heroTitle: { color: '#fff', fontWeight: '800' },
  heroSubtitle: { color: '#c7d6ff', marginTop: spacing(0.5) },
  heroStatsRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing(1) },
  statChip: { marginRight: spacing(1), marginBottom: spacing(1), backgroundColor: 'rgba(255,255,255,0.12)' },
  row: {
    marginTop: spacing(1),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  radioRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing(0.5) },
  radioLabel: { flexShrink: 1 },
});

export default AdminDashboardScreen;
