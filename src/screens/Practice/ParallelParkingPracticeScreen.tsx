import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView } from 'react-native';
import { Text } from 'react-native-paper';
import ManoeuvrePracticePlayer from '../../components/ManoeuvrePracticePlayer';
import { parallelParkingSteps } from './parallelParking.steps';
import { spacing, colors } from '../../styles/theme';

const ParallelParkingPracticeScreen: React.FC = () => {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: spacing(2), paddingBottom: spacing(4) }}>
        <Text variant="headlineSmall" style={{ marginBottom: spacing(1) }}>
          Parallel Parking
        </Text>
        <Text style={{ color: colors.muted, marginBottom: spacing(2) }}>
          Follow the UK DVSA-style manoeuvre with step-by-step animation and audio guidance.
        </Text>
        <ManoeuvrePracticePlayer title="Parallel Parking" steps={parallelParkingSteps} />
      </ScrollView>
    </SafeAreaView>
  );
};

export default ParallelParkingPracticeScreen;
