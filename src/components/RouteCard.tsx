import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Button, Card, Text, Badge } from 'react-native-paper';
import { RouteDto } from '../api';
import { colors, spacing } from '../styles/theme';
import { metersToKm, secondsToMinutes } from '../utils';

interface Props {
  route: RouteDto;
  locked: boolean;
  downloaded?: boolean;
  stats?: { timesCompleted?: number; lastCompletedAt?: number };
  onPress: () => void;
  onDownload?: () => void;
}

const RouteCard: React.FC<Props> = ({ route, locked, downloaded, stats, onPress, onDownload }) => {
  return (
    <Card style={styles.card} onPress={onPress}>
      <Card.Content>
        <View style={styles.header}>
          <Text variant="titleMedium" style={styles.title} numberOfLines={2}>
            {route.name}
          </Text>
          <View style={styles.badgesRow}>
            {locked && <Badge style={[styles.badge, { backgroundColor: colors.danger }]}>Locked</Badge>}
            {downloaded && <Badge style={[styles.badge, { backgroundColor: colors.primary }]}>Offline</Badge>}
          </View>
        </View>
        <Text style={{ color: colors.muted }}>
          {metersToKm(route.distanceM)} • {secondsToMinutes(route.durationEstS)}
        </Text>
        {stats && (
          <Text style={{ marginTop: spacing(1), color: colors.text }}>
            Completed {stats.timesCompleted || 0}×{stats.lastCompletedAt ? ` • Last ${new Date(stats.lastCompletedAt).toLocaleDateString()}` : ''}
          </Text>
        )}
      </Card.Content>
      <Card.Actions>
        {onDownload && (
          <Button mode="outlined" onPress={onDownload} disabled={locked || downloaded}>
            {downloaded ? 'Downloaded' : 'Download'}
          </Button>
        )}
        <Button mode="contained" onPress={onPress} disabled={locked}>
          {locked ? 'Unlock' : 'Start'}
        </Button>
      </Card.Actions>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing(2),
    borderRadius: 14,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' },
  title: { flex: 1, paddingRight: spacing(1) },
  badgesRow: { flexDirection: 'row', alignItems: 'center', flexShrink: 0 },
  badge: { marginLeft: spacing(0.5), marginTop: spacing(0.5) },
});

export default RouteCard;
