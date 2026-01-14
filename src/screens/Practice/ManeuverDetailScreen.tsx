import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { IconButton, Text } from 'react-native-paper';
import Svg, { Rect, Line, G, Circle, Text as SvgText } from 'react-native-svg';
import { useNavigation, useRoute } from '@react-navigation/native';
import { maneuvers } from '../../content/maneuvers';
import { colors, spacing } from '../../styles/theme';
import { Animated, Easing } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const ManeuverDetailScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { id } = route.params || {};
  const [svgKey, setSvgKey] = useState(0);

  const maneuver = useMemo(() => maneuvers.find((item) => item.id === id), [id]);
  const progress = useMemo(() => new Animated.Value(0), [svgKey]);
  const [pose, setPose] = useState({ x: 200, y: 320, rot: 0 });

  React.useEffect(() => {
    progress.stopAnimation();
    progress.setValue(0);
    if (!maneuver) return;
    const anim = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: maneuver.durationMs,
        easing: Easing.linear,
        useNativeDriver: false,
      }),
    );
    const id = progress.addListener(({ value }) => {
      const poses = maneuver.poses;
      const count = poses.length;
      if (count < 2) return;
      const maxIdx = count - 1;
      const t = value * maxIdx;
      const idx = Math.min(Math.floor(t), maxIdx - 1);
      const localT = t - idx;
      const from = poses[idx];
      const to = poses[idx + 1];
      const x = from.x + (to.x - from.x) * localT;
      const y = from.y + (to.y - from.y) * localT;
      const rot = from.rot + (to.rot - from.rot) * localT;
      setPose({ x, y, rot });
    });
    anim.start();
    return () => {
      progress.removeListener(id);
      progress.stopAnimation();
    };
  }, [maneuver, progress]);

  if (!maneuver) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <IconButton icon="arrow-left" onPress={() => navigation.goBack()} />
          <Text variant="titleMedium">Maneuver</Text>
        </View>
        <Text style={styles.muted}>This maneuver is not available.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <IconButton icon="arrow-left" onPress={() => navigation.goBack()} />
        <View style={styles.headerText}>
          <Text variant="headlineSmall">{maneuver.title}</Text>
          <Text style={styles.muted}>{maneuver.officialText}</Text>
        </View>
        <IconButton icon="refresh" onPress={() => setSvgKey((v) => v + 1)} />
      </View>
      <View style={styles.svgWrap}>
        <Svg key={svgKey} width="100%" height="100%" viewBox="0 0 400 400">
          <Rect width="400" height="400" fill="#c9d1d9" />
          {maneuver.road === 'vertical' ? (
            <>
              <Rect x="140" y="0" width="120" height="400" fill="#777" />
              <Line x1="200" y1="0" x2="200" y2="400" stroke="#fff" strokeWidth="2" strokeDasharray="10 5" />
            </>
          ) : (
            <>
              <Rect x="0" y="140" width="400" height="120" fill="#777" />
              <Line x1="0" y1="200" x2="400" y2="200" stroke="#fff" strokeWidth="2" strokeDasharray="10 5" />
              <Rect x="0" y="135" width="400" height="5" fill="#fff" />
            </>
          )}
          {renderScene(maneuver.id)}
          {renderGuideMarkers(maneuver.id)}
          <G x={pose.x} y={pose.y}>
            <G rotation={pose.rot + (maneuver.road === 'vertical' ? 90 : 0)} originX={0} originY={0}>
              <Rect x="-10" y="-20" width="20" height="40" rx="4" fill="#2c7" stroke="#000" />
              <Circle cx="-10" cy="-14" r="3" fill="#222" />
              <Circle cx="10" cy="-14" r="3" fill="#222" />
              <Circle cx="-10" cy="14" r="3" fill="#222" />
              <Circle cx="10" cy="14" r="3" fill="#222" />
              <Rect x="-13" y="-20" width="3" height="6" fill="#444" />
              <Rect x="10" y="-20" width="3" height="6" fill="#444" />
            </G>
          </G>
          {maneuver.id === 'emergency_stop' && (
            <G opacity={pose.y < 300 ? 1 : 0}>
              <Rect x="170" y="150" width="60" height="30" fill="#d00" rx="4" />
              <SvgText
                x="200"
                y="170"
                fill="#fff"
                fontSize="16"
                fontFamily="sans-serif"
                textAnchor="middle"
              >
                STOP
              </SvgText>
            </G>
          )}
        </Svg>
      </View>
      <ScrollView contentContainerStyle={styles.stepsWrap}>
        <Text variant="titleMedium" style={styles.sectionTitle}>
          Plain steps
        </Text>
        {maneuver.steps.map((step, idx) => (
          <View key={`${maneuver.id}-${idx}`} style={styles.stepRow}>
            <Text style={styles.stepIndex}>{idx + 1}.</Text>
            <Text style={styles.stepText}>{step}</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: spacing(2),
    paddingTop: spacing(1),
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerText: { flex: 1 },
  muted: { color: colors.muted, marginTop: spacing(0.5) },
  svgWrap: {
    marginHorizontal: spacing(3),
    marginTop: spacing(2),
    borderRadius: 20,
    backgroundColor: '#fff',
    overflow: 'hidden',
    height: 260,
  },
  stepsWrap: {
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2),
    gap: spacing(1),
  },
  sectionTitle: { marginBottom: spacing(1) },
  stepRow: { flexDirection: 'row', gap: spacing(1), alignItems: 'flex-start' },
  stepIndex: { color: colors.primary, fontWeight: '600' },
  stepText: { flex: 1, color: colors.text, lineHeight: 20 },
});

const renderScene = (id: string) => {
  switch (id) {
    case 'fwd_bay':
    case 'rev_bay':
      return (
        <>
          <Line x1="260" y1="120" x2="260" y2="210" stroke="#fff" strokeWidth="3" />
          <Line x1="220" y1="120" x2="220" y2="210" stroke="#fff" strokeWidth="3" />
          <Line x1="220" y1="120" x2="260" y2="120" stroke="#fff" strokeWidth="3" />
        </>
      );
    case 'parallel_left':
      return (
        <>
          <Rect x="0" y="135" width="400" height="5" fill="#fff" />
          <G x={140} y={135}>
            <Rect x="-10" y="-20" width="20" height="40" rx="4" fill="#444" stroke="#000" />
            <Circle cx="-10" cy="-14" r="3" fill="#222" />
            <Circle cx="10" cy="-14" r="3" fill="#222" />
            <Circle cx="-10" cy="14" r="3" fill="#222" />
            <Circle cx="10" cy="14" r="3" fill="#222" />
          </G>
        </>
      );
    case 'right_reverse':
      return (
        <>
          <Rect x="0" y="140" width="400" height="5" fill="#fff" />
          <Rect x="0" y="255" width="400" height="5" fill="#fff" />
        </>
      );
    case 'turn_in_road':
      return (
        <>
          <Rect x="120" y="0" width="5" height="400" fill="#fff" />
          <Rect x="275" y="0" width="5" height="400" fill="#fff" />
        </>
      );
    default:
      return null;
  }
};

const renderGuideMarkers = (id: string) => {
  switch (id) {
    case 'fwd_bay':
    case 'rev_bay':
      return <Circle cx="240" cy="200" r="6" fill="#fff" stroke="#0b6cfb" strokeWidth="2" />;
    case 'parallel_left':
      return <Circle cx="170" cy="160" r="6" fill="#fff" stroke="#0b6cfb" strokeWidth="2" />;
    case 'right_reverse':
      return <Circle cx="110" cy="160" r="6" fill="#fff" stroke="#0b6cfb" strokeWidth="2" />;
    case 'turn_in_road':
      return <Circle cx="240" cy="200" r="6" fill="#fff" stroke="#0b6cfb" strokeWidth="2" />;
    default:
      return null;
  }
};

export default ManeuverDetailScreen;
