import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Line, Rect, Circle, Path, G } from 'react-native-svg';
import { Button, Card, Chip, Text } from 'react-native-paper';
import * as Speech from 'expo-speech';
import { ManeuverStep } from '../screens/Practice/parallelParking.steps';
import { colors, spacing } from '../styles/theme';

type Props = {
  title: string;
  steps: ManeuverStep[];
  speed?: 'slow' | 'normal';
};

type Pose = { x: number; y: number; rotation: number };

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const ManoeuvrePracticePlayer: React.FC<Props> = ({ title, steps, speed = 'normal' }) => {
  const [idx, setIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const anim = useRef(new Animated.Value(0)).current;
  const [pose, setPose] = useState<Pose>(steps[0].startPose);

  const current = steps[idx];
  const duration = speed === 'slow' ? current.durationMs * 1.4 : current.durationMs;

  const playAudio = () => {
    if (current.audioText) Speech.speak(current.audioText, { language: 'en-GB' });
  };

  const interpolatePose = (t: number) => {
    if (current.pathType === 'straight') {
      return {
        x: lerp(current.startPose.x, current.endPose.x, t),
        y: lerp(current.startPose.y, current.endPose.y, t),
        rotation: lerp(current.startPose.rotation, current.endPose.rotation, t),
      };
    }
    if (current.arc) {
      const deg = lerp(current.arc.startAngle, current.arc.endAngle, t);
      const rad = (deg * Math.PI) / 180;
      const x = current.arc.cx + current.arc.radius * Math.cos(rad);
      const y = current.arc.cy + current.arc.radius * Math.sin(rad);
      // rotation follows tangent
      const rotation = deg + (current.arc.endAngle > current.arc.startAngle ? 90 : -90);
      return { x, y, rotation };
    }
    return current.startPose;
  };

  const startAnim = () => {
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();
  };

  useEffect(() => {
    const sub = anim.addListener(({ value }) => {
      setProgress(value);
      setPose(interpolatePose(value));
    });
    return () => anim.removeListener(sub);
  }, [anim, current]);

  useEffect(() => {
    playAudio();
    startAnim();
  }, [idx]);

  const next = () => {
    if (idx < steps.length - 1) {
      setIdx(idx + 1);
    }
  };
  const prev = () => {
    if (idx > 0) setIdx(idx - 1);
  };
  const replay = () => {
    playAudio();
    startAnim();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text variant="titleMedium">{title}</Text>
        <Chip>{`Step ${idx + 1}/${steps.length}`}</Chip>
      </View>

      <Card style={styles.sceneCard}>
        <Card.Content>
          <Svg width="100%" height="260" viewBox="0 0 100 60">
            {/* road background */}
            <Rect x={0} y={0} width={100} height={60} fill="#e9edf7" />
            <Rect x={25} y={0} width={30} height={60} fill="#cfd7e6" />
            {/* kerb line */}
            <Line x1={55} y1={0} x2={55} y2={60} stroke="#a0a8b8" strokeDasharray="4 2" strokeWidth={1} />
            {/* target parked car */}
            <Rect x={57} y={20} width={12} height={22} rx={2} fill="#7a869a" />
            {/* learner car */}
            <AnimatedCar pose={pose} />
            {/* markers */}
            {current.markers?.map((m) => {
              if (m.type === 'alignment') return <Circle key={m.type} cx={m.x * 100} cy={m.y * 60} r={1.2} fill="#43a047" />;
              if (m.type === 'clearance') return <Line key={m.type} x1={m.x * 100} y1={0} x2={m.x * 100} y2={60} stroke="#f39c12" strokeDasharray="3 2" />;
              if (m.type === 'parked') return <Circle key={m.type} cx={m.x * 100} cy={m.y * 60} r={1.6} fill="#43a047" />;
              return null;
            })}
            {/* direction arrow */}
            <DirectionArrow pose={pose} />
          </Svg>
        </Card.Content>
      </Card>

      <Card style={styles.infoCard}>
        <Card.Content>
          <Text variant="titleMedium">{current.title}</Text>
          <Text style={{ color: colors.muted, marginTop: spacing(0.5) }}>{current.description}</Text>
          <View style={styles.controlsRow}>
            <Button onPress={prev} disabled={idx === 0} mode="outlined">
              Back
            </Button>
            <Button onPress={replay} mode="outlined" icon="refresh">
              Replay
            </Button>
            <Button onPress={next} disabled={idx === steps.length - 1} mode="contained">
              Next
            </Button>
          </View>
          <View style={{ marginTop: spacing(1) }}>
            <Text style={{ fontWeight: '700' }}>Common mistakes</Text>
            {current.mistakes.map((m) => (
              <Text key={m} style={{ color: colors.muted, marginTop: spacing(0.25) }}>
                • {m}
              </Text>
            ))}
          </View>
        </Card.Content>
      </Card>
    </View>
  );
};

const AnimatedCar: React.FC<{ pose: Pose }> = ({ pose }) => {
  const cx = pose.x * 100;
  const cy = pose.y * 60;
  const transform = `rotate(${pose.rotation}, ${cx}, ${cy})`;
  return (
    <G>
      <Rect x={cx - 3.5} y={cy - 7} width={7} height={14} rx={1.4} fill="#1e88e5" transform={transform} />
      <Rect x={cx - 3} y={cy - 1} width={6} height={2} fill="#90caf9" transform={transform} />
    </G>
  );
};

const DirectionArrow: React.FC<{ pose: Pose }> = ({ pose }) => {
  const len = 6;
  const ang = (pose.rotation - 90) * (Math.PI / 180);
  const sx = pose.x * 100;
  const sy = pose.y * 60;
  const ex = sx + len * Math.cos(ang);
  const ey = sy + len * Math.sin(ang);
  const path = `M ${sx} ${sy} L ${ex} ${ey}`;
  return <Path d={path} stroke="#0f172a" strokeWidth={1.2} strokeLinecap="round" />;
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing(3), gap: spacing(1), backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sceneCard: { borderRadius: 16 },
  infoCard: { borderRadius: 16 },
  controlsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing(1) },
});

// Note: We use simple SVG primitives on a normalized 100x60 viewBox.
// Straight steps interpolate linearly between startPose and endPose.
// Arc steps interpolate along a circular arc defined by center (cx, cy), radius, and angles.
// Rotation for arcs follows the tangent to keep the car oriented along the path.

export default ManoeuvrePracticePlayer;
