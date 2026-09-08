/**
 * "Who's here?" profile picker — shown on every app open after auth.
 * Parent taps their child's card → loads that child's data → home.
 * Parent taps "Я родитель" → goes to parent dashboard.
 *
 * Falls back to local store data if API returns no children (e.g. trial mode
 * or createChild failed silently during registration).
 */

import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { HBPet } from '@/components/HBPet';
import { PaperBackground } from '@/components/PaperBackground';
import { ParentalGateModal, useParentalGate } from '@/components/ParentalGate';
import { Text } from '@/components/Text';
import { getChildren, type ChildProfile } from '@/services/api';
import { todayISO, useSettings } from '@/store/settings';
import { colors, fontFamily, fontSize, radius, shadow, spacing, tints } from '@/theme';

const PET_HUES = [55, 175, 300, 90] as const;

function petHueFor(childId: string, localId: string | null, storedHue: number): number {
  if (childId === localId) return storedHue;
  let hash = 0;
  for (let i = 0; i < childId.length; i++) hash = (hash * 31 + childId.charCodeAt(i)) | 0;
  return PET_HUES[Math.abs(hash) % PET_HUES.length]!;
}

// ─── Ring avatar ────────────────────────────────────────────────────────────

function RingAvatar({
  hue,
  progress,
  todayDone,
  size = 96,
}: {
  hue: number;
  progress: number;
  todayDone: boolean;
  size?: number;
}) {
  const r = (size - 10) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const filled = Math.max(0.04, progress) * circumference;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={colors.bgDeep}
          strokeWidth={7}
        />
        <Circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={todayDone ? colors.accent : colors.primary}
          strokeWidth={7}
          strokeDasharray={`${filled} ${circumference}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
        />
      </Svg>
      <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
        <HBPet size={size * 0.54} hue={hue} mood="happy" />
      </View>
      {todayDone && (
        <View style={ring.checkBadge}>
          <Text style={ring.checkText}>✓</Text>
        </View>
      )}
    </View>
  );
}

const ring = StyleSheet.create({
  checkBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.card,
  },
  checkText: {
    color: colors.white,
    fontFamily: fontFamily.bodyBlack,
    fontSize: fontSize.xs,
    lineHeight: 14,
  },
});

// ─── Child card ──────────────────────────────────────────────────────────────

function ChildCard({
  child,
  index,
  localChildId,
  storedHue,
  onPress,
}: {
  child: ChildProfile;
  index: number;
  localChildId: string | null;
  storedHue: number;
  onPress: () => void;
}) {
  const scale = useSharedValue(0.88);
  const opacity = useSharedValue(0);

  useEffect(() => {
    const delay = 80 + index * 70;
    scale.value = withDelay(delay, withSpring(1, { damping: 13 }));
    opacity.value = withDelay(delay, withSpring(1, { damping: 20 }));
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const hue = petHueFor(child.id, localChildId, storedHue);
  const progress = Math.min(1, child.currentDay / 30);
  const todayDone = child.lastCompletedDate === todayISO();

  return (
    <Animated.View style={[styles.cardWrap, animStyle]}>
      <Pressable
        style={({ pressed }) => [styles.card, pressed && { transform: [{ scale: 0.96 }] }]}
        onPress={onPress}
      >
        <RingAvatar hue={hue} progress={progress} todayDone={todayDone} size={96} />

        <Text style={styles.childName} numberOfLines={1}>{child.name}</Text>

        <View style={styles.chipsRow}>
          {child.streak > 0 && (
            <View style={styles.chip}>
              <Text style={styles.chipText}>🔥 {child.streak}</Text>
            </View>
          )}
          <View style={styles.chip}>
            <Text style={styles.chipText}>⭐ {child.totalStars}</Text>
          </View>
        </View>

        <View style={[styles.dayChip, todayDone && styles.dayChipDone]}>
          <Text style={[styles.dayChipText, todayDone && styles.dayChipTextDone]}>
            {todayDone ? '✓ Готово' : `День ${child.currentDay}`}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ─── Add child card ──────────────────────────────────────────────────────────

function AddChildCard({ onPress, index }: { onPress: () => void; index: number }) {
  const scale = useSharedValue(0.88);
  const opacity = useSharedValue(0);
  useEffect(() => {
    const delay = 80 + index * 70;
    scale.value = withDelay(delay, withSpring(1, { damping: 13 }));
    opacity.value = withDelay(delay, withSpring(1, { damping: 20 }));
  }, []);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.cardWrap, animStyle]}>
      <Pressable
        style={({ pressed }) => [styles.addCard, pressed && { transform: [{ scale: 0.96 }] }]}
        onPress={onPress}
      >
        <View style={styles.addCircle}>
          <Text style={styles.addPlus}>+</Text>
        </View>
        <Text style={styles.addLabel}>Добавить{'\n'}ребёнка</Text>
      </Pressable>
    </Animated.View>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function ProfileSelectScreen() {
  const router = useRouter();
  const authToken = useSettings((s) => s.authToken);
  const syncChild = useSettings((s) => s.syncChild);
  const lang = useSettings((s) => s.parentUILanguage) ?? 'ru';
  const isAz = lang === 'az';

  // Parental gate — adding a child must be confirmed by the adult
  const parentalGate = useParentalGate();

  const localChildId = useSettings((s) => s.childId);
  const localChildName = useSettings((s) => s.childName);
  const localChildAge = useSettings((s) => s.childAge);
  const localCurrentDay = useSettings((s) => s.currentDay);
  const localTotalStars = useSettings((s) => s.totalStars);
  const localStreak = useSettings((s) => s.streak);
  const localLearningLangs = useSettings((s) => s.learningLanguages);
  const localLastCompleted = useSettings((s) => s.lastCompletedDate);
  const storedHue = useSettings((s) => s.petHue);

  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState(false);

  // Refetch the list every time the screen regains focus — covers the
  // case of returning here after creating a new child via /setup/* or
  // /parent-add-child.
  useFocusEffect(
    useCallback(() => {
      if (!authToken) { setLoading(false); return; }
      setLoading(true);
      getChildren(authToken)
        .then((list) => {
          setChildren(list);
          setApiError(false);
        })
        .catch((err) => {
          console.warn('[profile-select] getChildren failed:', err);
          setApiError(true);
        })
        .finally(() => setLoading(false));
    }, [authToken]),
  );

  const displayChildren: ChildProfile[] = (() => {
    if (children.length > 0) return children;
    if (localChildName && localChildId) {
      return [{
        id: localChildId,
        name: localChildName,
        age: localChildAge ?? 8,
        level: 'beginner',
        learningLanguages: localLearningLangs,
        scheduleDays: [],
        scheduleMinutes: 15,
        scheduleHour: 17,
        currentDay: localCurrentDay,
        totalStars: localTotalStars,
        streak: localStreak,
        lastCompletedDate: localLastCompleted,
      }];
    }
    return [];
  })();

  const handleSelectChild = (child: ChildProfile) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    syncChild(child);
    router.replace('/home');
  };

  const handleParent = () => {
    Haptics.selectionAsync().catch(() => {});
    // Gate the parent area behind the math challenge — a child shouldn't be able
    // to wander into the parent report / settings just by tapping the button.
    parentalGate.run(() => {
      if (displayChildren.length > 0 && !localChildId) {
        syncChild(displayChildren[0]!);
      }
      router.replace('/parent-summary' as any);
    });
  };

  const handleAddChild = () => {
    Haptics.selectionAsync().catch(() => {});
    parentalGate.run(() => {
      router.push('/setup/name' as any);
    });
  };

  return (
    <PaperBackground>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View entering={FadeInDown.duration(500)} style={styles.header}>
          <View style={styles.petHalo}>
            <HBPet size={80} hue={storedHue} mood="happy" />
          </View>
          <Text style={styles.heading}>
            {isAz ? 'Kim burada?' : 'Кто здесь?'}
          </Text>
          <Text style={styles.subheading}>
            {isAz ? 'Öz profilini seç' : 'Выбери свой профиль'}
          </Text>
        </Animated.View>

        {/* Child grid / loader */}
        {loading ? (
          <Animated.View entering={FadeIn.duration(400)} style={styles.loader}>
            <ActivityIndicator color={colors.primary} size="large" />
          </Animated.View>
        ) : (
          <View style={styles.grid}>
            {displayChildren.map((child, i) => (
              <ChildCard
                key={child.id}
                child={child}
                index={i}
                localChildId={localChildId}
                storedHue={storedHue}
                onPress={() => handleSelectChild(child)}
              />
            ))}
            <AddChildCard index={displayChildren.length} onPress={handleAddChild} />
          </View>
        )}

        {/* Offline warning */}
        {apiError && displayChildren.length > 0 && (
          <Animated.View entering={FadeIn.duration(400)} style={styles.warningBox}>
            <Text style={styles.warningText}>
              ⚠️ {isAz ? 'Məlumatları yeniləmək alınmadı. Sonuncu yadda saxlanan göstərilir.' : 'Не удалось обновить данные. Показаны последние сохранённые.'}
            </Text>
          </Animated.View>
        )}

        {/* Parent strip */}
        <Animated.View entering={FadeInUp.duration(500).delay(350)} style={styles.parentArea}>
          <Pressable
            style={({ pressed }) => [styles.parentStrip, pressed && { opacity: 0.75 }]}
            onPress={handleParent}
          >
            <View style={styles.parentIcon}>
              <Text style={{ fontSize: 16 }}>🔒</Text>
            </View>
            <Text style={styles.parentText}>
              {isAz ? 'Mən valideynəm' : 'Я родитель'}
            </Text>
            <View style={styles.parentPins}>
              {[0, 1, 2, 3].map((i) => (
                <View key={i} style={styles.pinDot} />
              ))}
            </View>
            <Text style={styles.parentArrow}>›</Text>
          </Pressable>
        </Animated.View>
      </ScrollView>

      {/* Parental gate — guards "Add child" action */}
      <ParentalGateModal {...parentalGate.modalProps} />
    </PaperBackground>
  );
}

const CARD_SIZE = 148;

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    alignItems: 'center',
    paddingTop: 72,
    paddingBottom: 48,
    paddingHorizontal: spacing[5],
  },

  header: {
    alignItems: 'center',
    marginBottom: spacing[8],
    gap: spacing[2],
  },
  petHalo: {
    width: 108,
    height: 108,
    borderRadius: 54,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[2],
    ...shadow.sm,
  },
  heading: {
    color: colors.ink,
    fontFamily: fontFamily.display,
    fontSize: 34,
    letterSpacing: -0.5,
  },
  subheading: {
    color: colors.inkSoft,
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.base,
  },

  loader: {
    paddingVertical: spacing[10],
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing[4],
    marginBottom: spacing[6],
  },

  cardWrap: {
    width: CARD_SIZE,
  },
  card: {
    width: CARD_SIZE,
    minHeight: CARD_SIZE + 40,
    borderRadius: radius['2xl'],
    backgroundColor: colors.card,
    alignItems: 'center',
    paddingTop: spacing[4],
    paddingBottom: spacing[4],
    paddingHorizontal: spacing[3],
    gap: spacing[2],
    borderTopWidth: 1.5,
    borderTopColor: 'rgba(255,255,255,0.8)',
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(125,90,42,0.08)',
    ...shadow.md,
  },
  childName: {
    color: colors.ink,
    fontFamily: fontFamily.display,
    fontSize: 16,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: spacing[1],
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  chip: {
    backgroundColor: colors.bgDeep,
    borderRadius: radius.full,
    paddingHorizontal: spacing[2],
    paddingVertical: 3,
  },
  chipText: {
    color: colors.inkSoft,
    fontFamily: fontFamily.bodyMedium,
    fontSize: 11,
  },
  dayChip: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.full,
    paddingHorizontal: spacing[3],
    paddingVertical: 3,
  },
  dayChipDone: {
    backgroundColor: tints.sage,
  },
  dayChipText: {
    color: colors.primary,
    fontFamily: fontFamily.bodyBold,
    fontSize: 10,
    letterSpacing: 0.3,
  },
  dayChipTextDone: {
    color: colors.accent,
  },

  addCard: {
    width: CARD_SIZE,
    minHeight: CARD_SIZE + 40,
    borderRadius: radius['2xl'],
    borderWidth: 2,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[3],
    backgroundColor: 'rgba(252,247,233,0.5)',
  },
  addCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPlus: {
    color: colors.primary,
    fontFamily: fontFamily.display,
    fontSize: 30,
    lineHeight: 34,
  },
  addLabel: {
    color: colors.primary,
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.xs,
    textAlign: 'center',
    lineHeight: 18,
  },

  warningBox: {
    backgroundColor: tints.butter,
    borderRadius: radius.lg,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    marginBottom: spacing[5],
    maxWidth: 320,
    borderWidth: 1,
    borderColor: colors.butter,
  },
  warningText: {
    color: colors.inkSoft,
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.xs,
    textAlign: 'center',
  },

  parentArea: {
    width: '100%',
    alignItems: 'center',
    marginTop: spacing[2],
  },
  parentStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[5],
    borderRadius: radius['2xl'],
    backgroundColor: colors.card,
    minWidth: 260,
    borderTopWidth: 1.5,
    borderTopColor: 'rgba(255,255,255,0.8)',
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(125,90,42,0.08)',
    ...shadow.sm,
  },
  parentIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.bgDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  parentText: {
    color: colors.ink,
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.base,
    flex: 1,
  },
  parentPins: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
  },
  pinDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.inkSoft,
    opacity: 0.35,
  },
  parentArrow: {
    color: colors.inkSoft,
    fontSize: 22,
    fontFamily: fontFamily.bodyBold,
  },
});
