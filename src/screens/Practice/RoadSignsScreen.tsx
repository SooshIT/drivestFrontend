import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Dimensions, FlatList, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Card, IconButton, Text } from 'react-native-paper';
import { roadSigns } from '../../content/roadSigns';
import { colors, spacing } from '../../styles/theme';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');
const CARD_WIDTH = Math.min(width - spacing(4), 420);
const CARD_HEIGHT = Math.min(width * 0.9, 520);
const CARD_GUTTER = spacing(2);
const SIDE_PADDING = Math.max((width - CARD_WIDTH) / 2, spacing(2));
const ROAD_SIGNS_BASE_URL = (process.env.EXPO_PUBLIC_ROADSIGNS_BASE_URL || '').replace(/\/$/, '');

const CATEGORY_META: Record<
  string,
  { label: string; color: string; accent: string; action: string; tips: string[] }
> = {
  warning: {
    label: 'Warning',
    color: '#fef3c7',
    accent: '#b45309',
    action: 'Slow down and scan for hazards ahead.',
    tips: ['Reduce speed early', 'Be ready to stop if needed'],
  },
  regulatory: {
    label: 'Regulatory',
    color: '#fee2e2',
    accent: '#b91c1c',
    action: 'Obey the rule shown. It is legally enforceable.',
    tips: ['Follow the instruction', 'Look for repeat signs'],
  },
  'traffic-calming': {
    label: 'Traffic calming',
    color: '#e0f2fe',
    accent: '#0369a1',
    action: 'Expect speed-reducing measures and adjust early.',
    tips: ['Check mirrors', 'Keep a steady speed'],
  },
  direction: {
    label: 'Direction & tourist',
    color: '#dbeafe',
    accent: '#1d4ed8',
    action: 'Plan your route and lane position in advance.',
    tips: ['Choose lane early', 'Follow arrows and symbols'],
  },
  'cyclist-pedestrian': {
    label: 'Cyclist & pedestrian',
    color: '#dcfce7',
    accent: '#15803d',
    action: 'Give vulnerable road users extra space.',
    tips: ['Slow and check mirrors', 'Look out at junctions'],
  },
  information: {
    label: 'Information',
    color: '#e5e7eb',
    accent: '#374151',
    action: 'Use the guidance to plan your next move.',
    tips: ['Confirm direction', 'Look for follow-on signs'],
  },
  motorway: {
    label: 'Motorway',
    color: '#e0e7ff',
    accent: '#4338ca',
    action: 'Follow lane guidance and check mirrors before changing lanes.',
    tips: ['Signal early', 'Maintain a safe gap'],
  },
  'tidal-flow': {
    label: 'Tidal flow',
    color: '#cffafe',
    accent: '#0e7490',
    action: 'Lane directions can change. Obey signals at all times.',
    tips: ['Stay in lane', 'Watch overhead signals'],
  },
  'shared-use': {
    label: 'Shared use',
    color: '#f0fdf4',
    accent: '#166534',
    action: 'Shared area ahead. Slow down and give way.',
    tips: ['Expect mixed users', 'Proceed with caution'],
  },
  'road-works': {
    label: 'Road works',
    color: '#ffedd5',
    accent: '#c2410c',
    action: 'Temporary layout ahead. Follow cones and limits.',
    tips: ['Slow down', 'Watch for workers'],
  },
  misc: {
    label: 'Other',
    color: '#f3f4f6',
    accent: '#6b7280',
    action: 'Follow the instruction and watch for related markings.',
    tips: ['Stay alert', 'Expect linked signs'],
  },
};

const getCategoryMeta = (key?: string) => {
  if (key && CATEGORY_META[key]) return CATEGORY_META[key];
  return CATEGORY_META.misc;
};

const RoadSignsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [index, setIndex] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const listRef = useRef<FlatList>(null);

  const categoryOptions = useMemo(() => {
    const unique = Array.from(new Set(roadSigns.map((item) => item.category))).sort();
    return ['all', ...unique].map((key) => ({
      key,
      label: key === 'all' ? 'All' : getCategoryMeta(key).label,
    }));
  }, []);
  const data = useMemo(() => {
    if (selectedCategory === 'all') return roadSigns;
    return roadSigns.filter((item) => item.category === selectedCategory);
  }, [selectedCategory]);
  const progress = data.length ? (index + 1) / data.length : 0;

  useEffect(() => {
    setIndex(0);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [selectedCategory]);

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems?.length) {
      const nextIdx = viewableItems[0].index ?? 0;
      setIndex(nextIdx);
    }
  }).current;

  const getItemLayout = (_: any, idx: number) => ({
    length: CARD_WIDTH + CARD_GUTTER,
    offset: (CARD_WIDTH + CARD_GUTTER) * idx,
    index: idx,
  });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.backdropCircleOne} />
      <View style={styles.backdropCircleTwo} />
      <View style={styles.topSection}>
        <View style={styles.header}>
          <IconButton icon="arrow-left" onPress={() => navigation.goBack()} />
          <View style={styles.headerText}>
            <Text variant="headlineSmall">Road Signs</Text>
            <Text style={styles.subhead}>Swipe, tap to flip, and learn fast.</Text>
          </View>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryRow}
        >
          {categoryOptions.map((option) => {
            const active = selectedCategory === option.key;
            return (
              <Pressable
                key={option.key}
                onPress={() => setSelectedCategory(option.key)}
                style={[styles.categoryChip, active && styles.categoryChipActive]}
              >
                <Text style={[styles.categoryChipText, active && styles.categoryChipTextActive]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
      <View style={styles.listSection}>
        <FlatList
          ref={listRef}
          horizontal
          pagingEnabled
          data={data}
          keyExtractor={(item) => item.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          style={styles.list}
          snapToInterval={CARD_WIDTH + CARD_GUTTER}
          snapToAlignment="center"
          decelerationRate="fast"
          getItemLayout={getItemLayout}
          initialNumToRender={3}
          maxToRenderPerBatch={4}
          windowSize={5}
          removeClippedSubviews
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={{ itemVisiblePercentThreshold: 80 }}
          renderItem={({ item }) => <SignCard item={item} />}
        />
      </View>
      <View style={styles.bottomSection}>
        <View style={styles.pagination}>
          <IconButton
            icon="chevron-left"
            onPress={() => {
              if (!data.length) return;
              listRef.current?.scrollToIndex({ index: Math.max(index - 1, 0), animated: true });
            }}
          />
          <Text style={styles.paginationText}>
            {index + 1} / {data.length}
          </Text>
          <IconButton
            icon="chevron-right"
            onPress={() => {
              if (!data.length) return;
              listRef.current?.scrollToIndex({ index: Math.min(index + 1, data.length - 1), animated: true });
            }}
          />
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
        </View>
      </View>
    </SafeAreaView>
  );
};

const SignCardBase: React.FC<{ item: typeof roadSigns[number] }> = ({ item }) => {
  const flip = useRef(new Animated.Value(0)).current;
  const [isFront, setIsFront] = useState(true);
  const categoryMeta = getCategoryMeta(item.category);
  const imageUri = ROAD_SIGNS_BASE_URL ? `${ROAD_SIGNS_BASE_URL}/${item.imagePath}` : '';

  const frontRotate = flip.interpolate({
    inputRange: [0, 180],
    outputRange: ['0deg', '180deg'],
  });
  const backRotate = flip.interpolate({
    inputRange: [0, 180],
    outputRange: ['180deg', '360deg'],
  });
  const frontOpacity = flip.interpolate({
    inputRange: [0, 90, 180],
    outputRange: [1, 0, 0],
  });
  const backOpacity = flip.interpolate({
    inputRange: [0, 90, 180],
    outputRange: [0, 0, 1],
  });

  const handleFlip = () => {
    Animated.timing(flip, {
      toValue: isFront ? 180 : 0,
      duration: 450,
      useNativeDriver: true,
    }).start(() => setIsFront(!isFront));
  };

  return (
    <View style={styles.cardWrap}>
      <Animated.View
        style={[
          styles.cardFace,
          { transform: [{ perspective: 1000 }, { rotateY: frontRotate }], opacity: frontOpacity },
        ]}
        pointerEvents={isFront ? 'auto' : 'none'}
      >
        <Pressable onPress={handleFlip} style={StyleSheet.absoluteFill}>
          <Card style={[styles.card, styles.cardFaceSurface]}>
            <Card.Content style={styles.cardContent}>
              <View style={styles.cardHeaderRow}>
                <View style={[styles.categoryPill, { backgroundColor: categoryMeta.color }]}>
                  <Text style={[styles.categoryPillText, { color: categoryMeta.accent }]}>
                    {categoryMeta.label}
                  </Text>
                </View>
                <Text style={styles.signCode}>#{item.id}</Text>
              </View>
              <View style={styles.signWrap}>
                {imageUri ? (
                  <Image source={{ uri: imageUri }} style={styles.signImage} resizeMode="contain" />
                ) : (
                  <View style={styles.imagePlaceholder}>
                    <MaterialCommunityIcons name="image-outline" size={48} color="#94a3b8" />
                  </View>
                )}
              </View>
              <Text variant="titleMedium" style={styles.signTitle}>
                {item.title}
              </Text>
              <Text style={styles.tapHint}>Tap to flip for details</Text>
            </Card.Content>
          </Card>
        </Pressable>
      </Animated.View>
      <Animated.View
        style={[
          styles.cardFace,
          styles.cardBackFace,
          { transform: [{ perspective: 1000 }, { rotateY: backRotate }], opacity: backOpacity },
        ]}
        pointerEvents={!isFront ? 'auto' : 'none'}
      >
        <Pressable onPress={handleFlip} style={StyleSheet.absoluteFill}>
          <View style={styles.backSurface}>
            <Text variant="titleMedium" style={styles.signTitle}>
              {item.title}
            </Text>
            <View style={styles.backMetaRow}>
              <View style={[styles.categoryPill, { backgroundColor: categoryMeta.color }]}>
                <Text style={[styles.categoryPillText, { color: categoryMeta.accent }]}>
                  {categoryMeta.label}
                </Text>
              </View>
              <Text style={styles.signCode}>#{item.id}</Text>
            </View>
            <ScrollView style={styles.descriptionScroll} contentContainerStyle={styles.descriptionContent}>
              <Text style={styles.sectionLabel}>Meaning</Text>
              <Text style={styles.description}>
                {item.description?.trim() ? item.description : 'Description coming soon.'}
              </Text>
              <Text style={styles.sectionLabel}>What to do</Text>
              <Text style={styles.actionText}>{categoryMeta.action}</Text>
              <View style={styles.tipsRow}>
                {categoryMeta.tips.map((tip) => (
                  <View key={tip} style={styles.tipChip}>
                    <Text style={styles.tipText}>{tip}</Text>
                  </View>
                ))}
              </View>
            </ScrollView>
            <Text style={styles.tapHint}>Tap to flip back</Text>
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
};

const SignCard = React.memo(SignCardBase, (prev, next) => prev.item.id === next.item.id);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f6ff' },
  topSection: {
    paddingTop: spacing(1.5),
  },
  header: {
    paddingHorizontal: spacing(2),
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerText: { marginLeft: spacing(1), flex: 1 },
  subhead: { color: colors.muted, marginTop: spacing(0.5) },
  categoryRow: {
    paddingHorizontal: spacing(2),
    paddingTop: spacing(0.5),
    paddingBottom: spacing(1),
    alignItems: 'center',
  },
  categoryChip: {
    backgroundColor: '#eef2ff',
    paddingHorizontal: spacing(1.25),
    paddingVertical: spacing(0.5),
    borderRadius: 16,
    marginRight: spacing(1),
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  categoryChipActive: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  categoryChipText: { color: '#334155', fontWeight: '600', fontSize: 12 },
  categoryChipTextActive: { color: '#fff' },
  listSection: {
    flex: 1,
    justifyContent: 'center',
  },
  list: { flexGrow: 0 },
  listContent: {
    paddingHorizontal: SIDE_PADDING,
    paddingVertical: spacing(1.5),
    alignItems: 'center',
  },
  cardWrap: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    marginRight: CARD_GUTTER,
  },
  card: {
    flex: 1,
    borderRadius: 24,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    elevation: 8,
    shadowColor: '#0f172a',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
  },
  cardContent: { flex: 1, padding: spacing(2) },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing(1),
  },
  categoryPill: {
    paddingHorizontal: spacing(1),
    paddingVertical: spacing(0.35),
    borderRadius: 999,
  },
  categoryPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  signCode: { color: '#64748b', fontWeight: '600', fontSize: 12 },
  signWrap: {
    width: '100%',
    height: CARD_HEIGHT * 0.7,
    backgroundColor: '#f8fafc',
    borderRadius: 18,
    padding: spacing(1),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  signImage: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  signTitle: { marginTop: spacing(1), fontWeight: '700', textAlign: 'center' },
  descriptionScroll: { flex: 1, marginTop: spacing(1) },
  descriptionContent: { paddingBottom: spacing(2), flexGrow: 1 },
  sectionLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: '#94a3b8',
    marginTop: spacing(1),
  },
  description: { color: colors.text, lineHeight: 20, marginTop: spacing(0.5) },
  actionText: { color: '#0f172a', fontWeight: '600', marginTop: spacing(0.5) },
  tipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing(1),
  },
  tipChip: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: spacing(1),
    paddingVertical: spacing(0.4),
    borderRadius: 12,
    marginRight: spacing(0.5),
    marginBottom: spacing(0.5),
  },
  tipText: { color: '#334155', fontSize: 12, fontWeight: '600' },
  tapHint: { marginTop: spacing(1), color: colors.muted, textAlign: 'center' },
  bottomSection: {
    paddingBottom: spacing(2),
  },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  paginationText: { color: colors.muted },
  progressTrack: {
    height: 6,
    marginHorizontal: spacing(3),
    borderRadius: 3,
    backgroundColor: '#e2e8f0',
    marginBottom: spacing(1),
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  cardFace: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    backfaceVisibility: 'hidden',
  },
  cardBackFace: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  cardFaceSurface: {
    backfaceVisibility: 'hidden',
  },
  backSurface: {
    flex: 1,
    borderRadius: 20,
    backgroundColor: '#fff',
    padding: spacing(2),
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  backMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing(0.5),
  },
  backdropCircleOne: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: '#e8ecff',
    top: 90,
    right: -80,
    opacity: 0.7,
  },
  backdropCircleTwo: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: '#e6fff2',
    bottom: 120,
    left: -70,
    opacity: 0.6,
  },
});

export default RoadSignsScreen;
