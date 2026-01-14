import React from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import { Card, Text, Button, IconButton } from 'react-native-paper';
import { colors, spacing } from '../../styles/theme';
import { useNavigation } from '@react-navigation/native';
import { maneuvers as interactiveManeuvers } from '../../content/maneuvers';

const ManeuversScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  return (
    <View style={styles.container}>
      <FlatList
        data={interactiveManeuvers}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing(3), paddingBottom: spacing(6) }}
        ListHeaderComponent={
          <View style={{ marginBottom: spacing(2) }}>
            <View style={styles.headerRow}>
              <IconButton icon="arrow-left" onPress={() => navigation.goBack()} />
              <Text variant="headlineSmall">Practice Modules</Text>
            </View>
            <Text style={{ color: colors.muted, marginTop: spacing(0.5) }}>
              Interactive practice cards plus guided walkthroughs.
            </Text>
            <View style={{ marginTop: spacing(2) }}>
              <Text variant="titleMedium">Interactive maneuvers</Text>
              <Text style={{ color: colors.muted, marginTop: spacing(0.5) }}>
                Tap a maneuver to open the animated practice view.
              </Text>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <Card.Content>
              <Text variant="titleMedium">{item.title}</Text>
              <Text style={{ color: colors.muted, marginTop: spacing(0.5) }}>{item.officialText}</Text>
              <Button
                mode="contained"
                style={{ marginTop: spacing(1) }}
                onPress={() => navigation.navigate('ManeuverDetail', { id: item.id })}
              >
                Open practice
              </Button>
            </Card.Content>
          </Card>
        )}
        ListFooterComponent={
          <View>
            <Card style={styles.card}>
              <Card.Content>
                <Text variant="titleMedium">Road Signs (Interactive)</Text>
                <Text style={{ color: colors.muted, marginTop: spacing(0.5) }}>
                  Swipe through UK signs and flip cards for explanations.
                </Text>
                <Button
                  mode="contained"
                  style={{ marginTop: spacing(1) }}
                  onPress={() => {
                    const parent = navigation.getParent();
                    const root = parent?.getParent?.();
                    if (root) {
                      root.navigate('RoadSigns');
                    } else if (parent) {
                      parent.navigate('RoadSigns');
                    } else {
                      navigation.navigate('RoadSigns');
                    }
                  }}
                >
                  Start road signs
                </Button>
              </Card.Content>
            </Card>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  card: { marginBottom: spacing(2), borderRadius: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
});

export default ManeuversScreen;
