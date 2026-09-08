/**
 * Pet room — tamagotchi-style companion screen.
 * All state is local (no persistence). Child feeds, plays with and cares
 * for Хани between lessons. Stats decay slowly on a 30-second tick.
 */

import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { BottomTabs, BottomTabsSpacer } from '@/components/BottomTabs';
import { HBBackButton } from '@/components/HBBackButton';
import { HBPet } from '@/components/HBPet';
import { PaperBackground } from '@/components/PaperBackground';
import { Text } from '@/components/Text';
import { DEFAULT_STATS, loadPetStats, savePetStats } from '@/services/petCare';
import { playSfx } from '@/services/sfx';
import { useSettings } from '@/store/settings';
import { colors, fontFamily, fontSize, radius, shadow, spacing, tints } from '@/theme';

type RoomTab = 'room' | 'feed' | 'play' | 'care';
type PetMoodType = 'happy' | 'curious' | 'sleepy' | 'sad';

interface Stat { hunger: number; love: number; energy: number }

const MAX = 100;
const DECAY_INTERVAL = 30_000; // 30 s
const DECAY_AMOUNT = 3;

function avgStat(s: Stat) {
  return (s.hunger + s.love + s.energy) / 3;
}

function statMood(s: Stat): PetMoodType {
  const avg = avgStat(s);
  if (avg >= 70) return 'happy';
  if (avg >= 45) return 'curious';
  if (avg >= 20) return 'sleepy';
  return 'sad';
}

// ─── Stat bar ────────────────────────────────────────────────────────────────

function StatBar({ emoji, label, value, color }: {
  emoji: string; label: string; value: number; color: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <View style={bar.row}>
      <Text style={bar.emoji}>{emoji}</Text>
      <View style={{ flex: 1, gap: 3 }}>
        <View style={bar.labelRow}>
          <Text style={bar.label}>{label}</Text>
          <Text style={[bar.pct, { color }]}>{Math.round(pct)}%</Text>
        </View>
        <View style={bar.track}>
          <Animated.View style={[bar.fill, { width: `${pct}%`, backgroundColor: color }]} />
        </View>
      </View>
    </View>
  );
}

const bar = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  emoji: { fontSize: 20, width: 28 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontFamily: fontFamily.bodyBold, fontSize: fontSize.xs, color: colors.ink },
  pct: { fontFamily: fontFamily.bodyBlack, fontSize: 11 },
  track: {
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.bgDeep,
    overflow: 'hidden',
  },
  fill: { height: 10, borderRadius: 5 },
});

// ─── Tab bar ─────────────────────────────────────────────────────────────────

const TABS: { key: RoomTab; emoji: string; labelRu: string; labelAz: string }[] = [
  { key: 'room', emoji: '🏠', labelRu: 'Комната', labelAz: 'Otaq' },
  { key: 'feed', emoji: '🍎', labelRu: 'Кормить', labelAz: 'Yemək' },
  { key: 'play', emoji: '🎮', labelRu: 'Играть', labelAz: 'Oyna' },
  { key: 'care', emoji: '🛁', labelRu: 'Уход', labelAz: 'Qayğı' },
];

// ─── Feed tab items ───────────────────────────────────────────────────────────

interface FoodItem { emoji: string; labelRu: string; labelAz: string; gain: number; color: string }
const FOODS: FoodItem[] = [
  { emoji: '🍯', labelRu: 'Мёд', labelAz: 'Bal', gain: 25, color: colors.butter },
  { emoji: '🍎', labelRu: 'Яблоко', labelAz: 'Alma', gain: 15, color: '#FF6B6B' },
  { emoji: '🧁', labelRu: 'Кекс', labelAz: 'Keks', gain: 20, color: '#E8945A' },
  { emoji: '🥕', labelRu: 'Морковь', labelAz: 'Kök', gain: 12, color: '#FF9B3D' },
];

// ─── Play tab actions ─────────────────────────────────────────────────────────

interface PlayAction { emoji: string; labelRu: string; labelAz: string; gain: number }
const PLAY_ACTIONS: PlayAction[] = [
  { emoji: '🎾', labelRu: 'Мячик', labelAz: 'Top', gain: 20 },
  { emoji: '🎵', labelRu: 'Музыка', labelAz: 'Musiqi', gain: 15 },
  { emoji: '🤗', labelRu: 'Обнять', labelAz: 'Qucaq', gain: 25 },
  { emoji: '💃', labelRu: 'Танец', labelAz: 'Rəqs', gain: 18 },
];

// ─── Care tab actions ─────────────────────────────────────────────────────────

interface CareAction { emoji: string; labelRu: string; labelAz: string; gain: number }
const CARE_ACTIONS: CareAction[] = [
  { emoji: '🪮', labelRu: 'Расчесать', labelAz: 'Darama', gain: 20 },
  { emoji: '🛁', labelRu: 'Купать', labelAz: 'Yuma', gain: 25 },
  { emoji: '😴', labelRu: 'Отдых', labelAz: 'İstirahat', gain: 30 },
  { emoji: '💊', labelRu: 'Витамины', labelAz: 'Vitamin', gain: 15 },
];

// ─── Floating heart ───────────────────────────────────────────────────────────

function FloatingHeart({ emoji }: { emoji: string }) {
  const y = useSharedValue(0);
  const op = useSharedValue(1);
  useEffect(() => {
    y.value = withTiming(-80, { duration: 1200 });
    op.value = withTiming(0, { duration: 1200 });
  }, []);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }], opacity: op.value }));
  return (
    <Animated.Text style={[{ fontSize: 28, position: 'absolute', top: 0 }, style]}>
      {emoji}
    </Animated.Text>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function PetRoomScreen() {
  const router = useRouter();
  const lang = useSettings((s) => s.parentUILanguage) ?? 'ru';
  const childName = useSettings((s) => s.childName) ?? '';
  const childId = useSettings((s) => s.childId);
  const storedHue = useSettings((s) => s.petHue);
  const isAz = lang === 'az';

  const [tab, setTab] = useState<RoomTab>('room');
  const [stats, setStats] = useState<Stat>({ ...DEFAULT_STATS });
  const [floaters, setFloaters] = useState<{ id: number; emoji: string }[]>([]);
  const floaterIdRef = useRef(0);
  // Gate persistence on the initial load so we never overwrite stored stats
  // with the defaults before the read resolves.
  const loadedRef = useRef(false);

  // Hydrate persisted stats (with gentle away-decay) once per child.
  useEffect(() => {
    let alive = true;
    loadedRef.current = false;
    loadPetStats(childId).then((s) => {
      if (alive) { setStats(s); loadedRef.current = true; }
    });
    return () => { alive = false; };
  }, [childId]);

  // Persist on every change once loaded, and flush on unmount.
  useEffect(() => {
    if (!loadedRef.current) return;
    savePetStats(childId, stats);
  }, [stats, childId]);

  const petScale = useSharedValue(1);
  const petBounce = useSharedValue(0);

  // Idle bob
  useEffect(() => {
    petBounce.value = withRepeat(
      withSequence(
        withTiming(-6, { duration: 1400 }),
        withTiming(0, { duration: 1400 }),
      ),
      -1,
      false,
    );
  }, []);

  // Stat decay
  useEffect(() => {
    const id = setInterval(() => {
      setStats((s) => ({
        hunger: Math.max(0, s.hunger - DECAY_AMOUNT),
        love: Math.max(0, s.love - DECAY_AMOUNT),
        energy: Math.max(0, s.energy - DECAY_AMOUNT),
      }));
    }, DECAY_INTERVAL);
    return () => clearInterval(id);
  }, []);

  const bump = (emoji: string) => {
    petScale.value = withSequence(
      withSpring(1.18, { damping: 10 }),
      withSpring(1, { damping: 12 }),
    );
    playSfx('boop');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const id = ++floaterIdRef.current;
    setFloaters((f) => [...f, { id, emoji }]);
    setTimeout(() => setFloaters((f) => f.filter((x) => x.id !== id)), 1300);
  };

  const feed = (item: FoodItem) => {
    setStats((s) => ({ ...s, hunger: Math.min(MAX, s.hunger + item.gain) }));
    bump(item.emoji);
  };

  const play = (action: PlayAction) => {
    setStats((s) => ({ ...s, love: Math.min(MAX, s.love + action.gain) }));
    bump('❤️');
  };

  const care = (action: CareAction) => {
    setStats((s) => ({ ...s, energy: Math.min(MAX, s.energy + action.gain) }));
    bump('✨');
  };

  const petStyle = useAnimatedStyle(() => ({
    transform: [{ scale: petScale.value }, { translateY: petBounce.value }],
  }));

  const mood = statMood(stats);
  const avg = avgStat(stats);

  const moodLabel = (() => {
    if (avg >= 70) return isAz ? 'Xoşbəxtdir!' : 'Доволен!';
    if (avg >= 45) return isAz ? 'Yaxşıdır' : 'Неплохо';
    if (avg >= 20) return isAz ? 'Yorğundur' : 'Устал...';
    return isAz ? 'Kömək lazım!' : 'Нужна помощь!';
  })();

  return (
    <PaperBackground variant="honey">
      {/* Top bar */}
      <View style={styles.topBar}>
        <HBBackButton inline />
        <Text style={styles.topTitle}>
          {isAz ? 'Hani-nin otağı' : 'Комната Хани'}
        </Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Pet stage */}
        <Animated.View entering={FadeInDown.duration(500)} style={styles.stage}>
          {/* Halo */}
          <View style={styles.stageHalo} />
          <View style={styles.stageShadow} />

          {/* Floaters */}
          <View style={styles.floaterZone} pointerEvents="none">
            {floaters.map((f) => <FloatingHeart key={f.id} emoji={f.emoji} />)}
          </View>

          <Animated.View style={[styles.petWrap, petStyle]}>
            <Pressable
              onPress={() => { bump('💛'); setStats((s) => ({ ...s, love: Math.min(MAX, s.love + 5) })); }}
            >
              <HBPet size={160} hue={storedHue} mood={mood} />
            </Pressable>
          </Animated.View>
        </Animated.View>

        {/* Mood + name */}
        <Animated.View entering={FadeIn.duration(400).delay(200)} style={styles.nameRow}>
          <Text style={styles.petName}>
            {isAz ? 'Hani' : 'Хани'}
          </Text>
          <View style={[styles.moodBadge, { backgroundColor: avg >= 70 ? tints.sage : avg >= 45 ? '#FFF8D6' : tints.berry }]}>
            <Text style={[styles.moodText, { color: avg >= 70 ? colors.accent : avg >= 45 ? '#9C7E00' : colors.berry }]}>
              {moodLabel}
            </Text>
          </View>
        </Animated.View>

        {/* Stat bars */}
        <Animated.View entering={FadeInUp.duration(450).delay(150)} style={[styles.statsCard, shadow.sm]}>
          <StatBar emoji="🍯" label={isAz ? 'Ac deyil' : 'Голод'} value={stats.hunger} color={colors.butter} />
          <View style={styles.statDivider} />
          <StatBar emoji="💛" label={isAz ? 'Sevgi' : 'Любовь'} value={stats.love} color={colors.berry} />
          <View style={styles.statDivider} />
          <StatBar emoji="⚡" label={isAz ? 'Enerji' : 'Энергия'} value={stats.energy} color={colors.accent} />
        </Animated.View>

        {/* Tab bar */}
        <Animated.View entering={FadeInUp.duration(400).delay(220)} style={styles.tabBar}>
          {TABS.map((t) => (
            <Pressable
              key={t.key}
              style={[styles.tabBtn, tab === t.key && styles.tabBtnActive]}
              onPress={() => setTab(t.key)}
            >
              <Text style={styles.tabEmoji}>{t.emoji}</Text>
              <Text style={[styles.tabLabel, tab === t.key && { color: colors.primary }]}>
                {isAz ? t.labelAz : t.labelRu}
              </Text>
            </Pressable>
          ))}
        </Animated.View>

        {/* Tab content */}
        {tab === 'room' && (
          <Animated.View entering={FadeIn.duration(350)} style={styles.tabContent}>
            <Text style={styles.sectionLabel}>
              {isAz ? 'Hani-nin evi 🏡' : 'Дом Хани 🏡'}
            </Text>
            <View style={styles.roomGrid}>
              <RoomItem emoji="🛏️" label={isAz ? 'Çarpayı' : 'Кровать'} />
              <RoomItem emoji="📚" label={isAz ? 'Kitablar' : 'Книги'} />
              <RoomItem emoji="🎨" label={isAz ? 'Rəsm' : 'Рисунки'} />
              <RoomItem emoji="🏆" label={isAz ? 'Kuboklar' : 'Кубки'} />
            </View>
            <Text style={styles.tipText}>
              {isAz ? '💡 Hani-yə toxun — sevinir!' : '💡 Потрогай Хани — он радуется!'}
            </Text>
          </Animated.View>
        )}

        {tab === 'feed' && (
          <Animated.View entering={FadeIn.duration(350)} style={styles.tabContent}>
            <Text style={styles.sectionLabel}>
              {isAz ? 'Nə yemək istəyirsin?' : 'Что хочешь поесть?'}
            </Text>
            <View style={styles.actionGrid}>
              {FOODS.map((item) => (
                <Pressable
                  key={item.emoji}
                  style={({ pressed }) => [styles.actionBtn, pressed && { transform: [{ scale: 0.94 }] }, shadow.sm]}
                  onPress={() => feed(item)}
                >
                  <View style={[styles.actionIconBox, { backgroundColor: item.color + '33' }]}>
                    <Text style={styles.actionEmoji}>{item.emoji}</Text>
                  </View>
                  <Text style={styles.actionLabel}>{isAz ? item.labelAz : item.labelRu}</Text>
                  <Text style={styles.gainText}>+{item.gain}</Text>
                </Pressable>
              ))}
            </View>
          </Animated.View>
        )}

        {tab === 'play' && (
          <Animated.View entering={FadeIn.duration(350)} style={styles.tabContent}>
            <Text style={styles.sectionLabel}>
              {isAz ? 'Birlikdə oynayaq!' : 'Играем вместе!'}
            </Text>
            <View style={styles.actionGrid}>
              {PLAY_ACTIONS.map((action) => (
                <Pressable
                  key={action.emoji}
                  style={({ pressed }) => [styles.actionBtn, pressed && { transform: [{ scale: 0.94 }] }, shadow.sm]}
                  onPress={() => play(action)}
                >
                  <View style={[styles.actionIconBox, { backgroundColor: tints.berry }]}>
                    <Text style={styles.actionEmoji}>{action.emoji}</Text>
                  </View>
                  <Text style={styles.actionLabel}>{isAz ? action.labelAz : action.labelRu}</Text>
                  <Text style={[styles.gainText, { color: colors.berry }]}>+{action.gain}</Text>
                </Pressable>
              ))}
            </View>
          </Animated.View>
        )}

        {tab === 'care' && (
          <Animated.View entering={FadeIn.duration(350)} style={styles.tabContent}>
            <Text style={styles.sectionLabel}>
              {isAz ? 'Hani-yə qayğı göstər' : 'Позаботься о Хани'}
            </Text>
            <View style={styles.actionGrid}>
              {CARE_ACTIONS.map((action) => (
                <Pressable
                  key={action.emoji}
                  style={({ pressed }) => [styles.actionBtn, pressed && { transform: [{ scale: 0.94 }] }, shadow.sm]}
                  onPress={() => care(action)}
                >
                  <View style={[styles.actionIconBox, { backgroundColor: tints.sage }]}>
                    <Text style={styles.actionEmoji}>{action.emoji}</Text>
                  </View>
                  <Text style={styles.actionLabel}>{isAz ? action.labelAz : action.labelRu}</Text>
                  <Text style={[styles.gainText, { color: colors.accent }]}>+{action.gain}</Text>
                </Pressable>
              ))}
            </View>
          </Animated.View>
        )}

        {/* Lesson nudge */}
        <Animated.View entering={FadeInUp.duration(400).delay(350)} style={styles.nudgeCard}>
          <Text style={{ fontSize: 22 }}>📚</Text>
          <Text style={styles.nudgeText}>
            {isAz
              ? `${childName}, dərs keçsən Hani daha çox xoşbəxt olacaq!`
              : `${childName}, после урока Хани будет ещё счастливее!`}
          </Text>
          <Pressable
            style={styles.nudgeBtn}
            onPress={() => router.replace('/home')}
          >
            <Text style={styles.nudgeBtnText}>
              {isAz ? 'Dərsi başlat →' : 'К урокам →'}
            </Text>
          </Pressable>
        </Animated.View>

        <BottomTabsSpacer />
      </ScrollView>

      <BottomTabs />
    </PaperBackground>
  );
}

function RoomItem({ emoji, label }: { emoji: string; label: string }) {
  return (
    <View style={room.item}>
      <Text style={room.emoji}>{emoji}</Text>
      <Text style={room.label}>{label}</Text>
    </View>
  );
}

const room = StyleSheet.create({
  item: {
    width: '22%',
    alignItems: 'center',
    gap: spacing[1],
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    paddingVertical: spacing[4],
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.8)',
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(125,90,42,0.08)',
  },
  emoji: { fontSize: 28 },
  label: { fontFamily: fontFamily.bodyMedium, fontSize: 10, color: colors.inkSoft, textAlign: 'center' },
});

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[5],
    paddingTop: 52,
    paddingBottom: spacing[2],
  },
  topTitle: { fontFamily: fontFamily.display, fontSize: fontSize.base, color: colors.ink },

  scroll: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[2],
    paddingBottom: spacing[6],
    gap: spacing[4],
  },

  // Stage
  stage: {
    height: 220,
    alignSelf: 'center',
    width: 220,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stageHalo: {
    position: 'absolute',
    inset: 0,
    borderRadius: 110,
    backgroundColor: 'rgba(245, 212, 102, 0.35)',
  },
  stageShadow: {
    position: 'absolute',
    bottom: 18, left: 30, right: 30,
    height: 18, borderRadius: 18,
    backgroundColor: 'rgba(60, 49, 33, 0.12)',
  },
  floaterZone: {
    position: 'absolute',
    top: 10,
    alignSelf: 'center',
    alignItems: 'center',
    width: 60,
  },
  petWrap: { alignItems: 'center', justifyContent: 'center' },

  // Name + mood
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[3],
  },
  petName: { fontFamily: fontFamily.display, fontSize: fontSize['2xl'], color: colors.ink },
  moodBadge: {
    borderRadius: radius.full,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
  },
  moodText: { fontFamily: fontFamily.bodyBlack, fontSize: fontSize.xs },

  // Stats
  statsCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing[4],
    gap: spacing[3],
    borderTopWidth: 1.5,
    borderTopColor: 'rgba(255,255,255,0.8)',
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(125,90,42,0.08)',
  },
  statDivider: { height: 1, backgroundColor: colors.bgDeep },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.bgDeep,
    borderRadius: radius.xl,
    padding: 4,
    gap: 2,
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing[2],
    borderRadius: radius.lg,
    gap: 2,
  },
  tabBtnActive: {
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.8)',
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(125,90,42,0.08)',
  },
  tabEmoji: { fontSize: 16 },
  tabLabel: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 10,
    color: colors.inkSoft,
    letterSpacing: 0.2,
  },

  // Tab content
  tabContent: { gap: spacing[3] },
  sectionLabel: {
    fontFamily: fontFamily.bodyBlack,
    fontSize: 13,
    color: colors.inkSoft,
    letterSpacing: 0.5,
  },
  roomGrid: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing[2] },
  tipText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    color: colors.inkSoft,
    textAlign: 'center',
  },

  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[3],
  },
  actionBtn: {
    width: '45%',
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing[4],
    alignItems: 'center',
    gap: spacing[2],
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.8)',
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(125,90,42,0.08)',
  },
  actionIconBox: {
    width: 52,
    height: 52,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionEmoji: { fontSize: 28 },
  actionLabel: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 13,
    color: colors.ink,
  },
  gainText: {
    fontFamily: fontFamily.bodyBlack,
    fontSize: fontSize.xs,
    color: colors.primary,
  },

  // Nudge
  nudgeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    backgroundColor: colors.primarySoft,
    borderRadius: radius.xl,
    padding: spacing[4],
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.8)',
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(125,90,42,0.15)',
  },
  nudgeText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    color: colors.ink,
    flex: 1,
    lineHeight: 19,
  },
  nudgeBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  nudgeBtnText: {
    fontFamily: fontFamily.bodyBlack,
    fontSize: fontSize.xs,
    color: colors.white,
  },
});
