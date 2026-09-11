/**
 * Bobo Memory screen — surfaces the differentiating "Bobo as friend
 * with persistent memory" feature.
 *
 * Shows facts Bobo has learned about the child across past conversations,
 * grouped by category (family, pets, interests, etc.) and the things
 * Bobo plans to ask about next.
 */

import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';

import { Bobo } from '@/components/Bobo';
import { HBBackButton } from '@/components/HBBackButton';
import { CardSkeleton, Skeleton } from '@/components/Skeleton';
import { Text } from '@/components/Text';
import { forgetFact, getBoboMemory, type BoboMemory, type ChildFact } from '@/services/api';
import { useSettings } from '@/store/settings';
import { colors, fontFamily, fontSize, radius, scaleFont, shadow, spacing } from '@/theme';
import { useCompanionName } from '@/utils/companion';

const CATEGORIES: Record<ChildFact['category'], { emoji: string; ru: string; az: string }> = {
  interests:    { emoji: '🎨', ru: 'Интересы',         az: 'Maraqlar' },
  family:       { emoji: '👨‍👩‍👧', ru: 'Семья',            az: 'Ailə' },
  pets:         { emoji: '🐾', ru: 'Питомцы',          az: 'Ev heyvanları' },
  routine:      { emoji: '☀️', ru: 'Распорядок',       az: 'Gündəlik' },
  recent_event: { emoji: '✨', ru: 'Недавно',          az: 'Bu yaxınlarda' },
  preferences:  { emoji: '💚', ru: 'Предпочтения',     az: 'Üstünlüklər' },
};

export default function MemoryScreen() {
  const router = useRouter();
  const lang = useSettings((s) => s.parentUILanguage) ?? 'ru';
  const childId = useSettings((s) => s.childId);
  const childName = useSettings((s) => s.childName) ?? '';
  const learningLanguages = useSettings((s) => s.learningLanguages);
  const authToken = useSettings((s) => s.authToken);
  const isAz = lang === 'az';
  const learningLang = learningLanguages[0] ?? 'en';
  const bot = useCompanionName();

  const [memory, setMemory] = useState<BoboMemory | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!childId || !authToken) { setLoading(false); return; }
    getBoboMemory(childId, learningLang, authToken)
      .then(setMemory)
      .catch((e) => console.warn('[memory] load failed:', e))
      .finally(() => setLoading(false));
  }, [childId, authToken, learningLang]);

  const handleForget = (fact: ChildFact) => {
    if (!childId || !authToken) return;
    setMemory((prev) =>
      prev ? { ...prev, facts: prev.facts.filter((f) => f !== fact) } : prev,
    );
    forgetFact(childId, learningLang, fact.fact, authToken).catch(() => {});
  };

  // Group facts by category
  const grouped: Record<string, ChildFact[]> = {};
  if (memory?.facts) {
    for (const fact of memory.facts) {
      const cat = fact.category;
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat]!.push(fact);
    }
  }

  const factCount = memory?.facts.length ?? 0;
  const askCount = memory?.thingsToAskBack.length ?? 0;

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['#FFF6EC', '#F5EBFF', '#EFE5FF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.4, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <HBBackButton />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.duration(600)} style={styles.header}>
          <Bobo size={88} mood="happy" />
          <Text style={styles.title}>
            {isAz
              ? `${bot} ${childName} haqqında bilir`
              : `${bot} помнит о тебе`}
          </Text>
          <Text style={styles.subtitle}>
            {isAz
              ? `Hər söhbətdə ${bot} səni daha yaxşı tanıyır.`
              : `С каждым разговором ${bot} узнаёт тебя лучше.`}
          </Text>
        </Animated.View>

        {loading ? (
          <View style={{ gap: spacing[3] }}>
            <View style={[styles.banner, shadow.sm]}>
              <Skeleton width={56} height={56} borderRadius={28} />
              <View style={{ flex: 1, gap: 6 }}>
                <Skeleton width="70%" height={14} />
                <Skeleton width="50%" height={10} />
              </View>
            </View>
            <CardSkeleton height={120} />
            <CardSkeleton height={120} />
          </View>
        ) : factCount === 0 ? (
          <Animated.View entering={FadeIn.duration(400)} style={[styles.emptyCard, shadow.sm]}>
            <Text style={styles.emptyEmoji}>💭</Text>
            <Text style={styles.emptyTitle}>
              {isAz ? 'Hələ bir şey bilmir' : 'Пока ничего не знает'}
            </Text>
            <Text style={styles.emptyText}>
              {isAz
                ? `${bot} ilə danışmağa başla — və o səni xatırlamağa başlayacaq.`
                : `Поговори с ${bot} — и он начнёт тебя запоминать.`}
            </Text>
          </Animated.View>
        ) : (
          <>
            {/* Stat banner */}
            <Animated.View entering={FadeInUp.duration(500).delay(100)} style={[styles.banner, shadow.sm]}>
              <Text style={styles.bannerNumber}>{factCount}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.bannerLabel}>
                  {isAz ? 'fakt yadda saxladım' : 'фактов запомнил'}
                </Text>
                <Text style={styles.bannerSub}>
                  {isAz
                    ? 'Sənin haqqında özəl şeylər'
                    : 'Особенные вещи о тебе'}
                </Text>
              </View>
              <Text style={styles.bannerEmoji}>🧠</Text>
            </Animated.View>

            {/* Facts by category */}
            {Object.entries(grouped).map(([category, facts], idx) => {
              const meta = CATEGORIES[category as ChildFact['category']];
              if (!meta) return null;
              return (
                <Animated.View
                  key={category}
                  entering={FadeInUp.duration(400).delay(200 + idx * 80)}
                  style={[styles.categoryCard, shadow.sm]}
                >
                  <View style={styles.categoryHeader}>
                    <Text style={styles.categoryEmoji}>{meta.emoji}</Text>
                    <Text style={styles.categoryTitle}>{isAz ? meta.az : meta.ru}</Text>
                    <View style={styles.categoryCount}>
                      <Text style={styles.categoryCountText}>{facts.length}</Text>
                    </View>
                  </View>
                  <View style={styles.factList}>
                    {facts.map((fact, i) => (
                      <View key={i} style={styles.factRow}>
                        <View style={styles.factBullet} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.factText}>{fact.fact}</Text>
                          {fact.mentionedAt ? (
                            <Text style={styles.factDate}>{fact.mentionedAt}</Text>
                          ) : null}
                        </View>
                        <Pressable
                          onPress={() => handleForget(fact)}
                          hitSlop={8}
                          style={styles.factForget}
                        >
                          <Text style={styles.factForgetText}>✕</Text>
                        </Pressable>
                      </View>
                    ))}
                  </View>
                </Animated.View>
              );
            })}

            {/* Things to ask back */}
            {askCount > 0 && (
              <Animated.View entering={FadeInUp.duration(400).delay(500)} style={[styles.askCard, shadow.sm]}>
                <Text style={styles.askLabel}>
                  {isAz ? `💬 ${bot} SƏNDƏN SORUŞACAQ` : `💬 ${bot} СПРОСИТ ТЕБЯ`}
                </Text>
                {memory!.thingsToAskBack.map((q, i) => (
                  <View key={i} style={styles.askRow}>
                    <Text style={styles.askText}>{q}</Text>
                  </View>
                ))}
              </Animated.View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFF6EC' },
  scroll: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[16],
    paddingBottom: spacing[12],
  },


  header: {
    alignItems: 'center',
    marginBottom: spacing[6],
    gap: spacing[2],
  },
  title: {
    fontFamily: fontFamily.display,
    fontSize: fontSize['2xl'],
    color: colors.ink,
    textAlign: 'center',
    marginTop: spacing[2],
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    color: colors.inkSoft,
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 20,
  },

  loader: { paddingVertical: spacing[12], alignItems: 'center' },

  emptyCard: {
    backgroundColor: colors.white,
    borderRadius: radius['2xl'],
    paddingVertical: spacing[8],
    paddingHorizontal: spacing[6],
    alignItems: 'center',
    gap: spacing[2],
  },
  emptyEmoji: { fontSize: 56 },
  emptyTitle: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.xl,
    color: colors.ink,
    textAlign: 'center',
  },
  emptyText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    color: colors.inkSoft,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 260,
  },

  banner: {
    backgroundColor: colors.white,
    borderRadius: radius['2xl'],
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[5],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
    marginBottom: spacing[4],
  },
  bannerNumber: {
    fontFamily: fontFamily.display,
    fontSize: scaleFont(44),
    color: colors.primary,
    letterSpacing: -1,
  },
  bannerLabel: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.base,
    color: colors.ink,
  },
  bannerSub: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.xs,
    color: colors.inkSoft,
    marginTop: 2,
  },
  bannerEmoji: { fontSize: 28 },

  categoryCard: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    padding: spacing[4],
    marginBottom: spacing[3],
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginBottom: spacing[3],
  },
  categoryEmoji: { fontSize: 22 },
  categoryTitle: {
    flex: 1,
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.base,
    color: colors.ink,
  },
  categoryCount: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.full,
    minWidth: 24,
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    alignItems: 'center',
  },
  categoryCountText: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.xs,
    color: colors.primary,
  },
  factList: { gap: spacing[2] },
  factRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
  },
  factBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
    marginTop: 8,
  },
  factText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.inkSoft,
    lineHeight: 20,
  },
  factDate: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize['3xs'],
    color: colors.inkSoft,
    opacity: 0.7,
    marginTop: 2,
  },
  factForget: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#F0E7D2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  factForgetText: {
    fontFamily: fontFamily.bodyBlack,
    fontSize: fontSize['2xs'],
    color: colors.inkSoft,
  },

  askCard: {
    backgroundColor: '#FFFBEA',
    borderRadius: radius.xl,
    padding: spacing[4],
    marginTop: spacing[3],
    borderWidth: 1,
    borderColor: '#FCD34D',
    gap: spacing[2],
  },
  askLabel: {
    fontFamily: fontFamily.bodyBlack,
    fontSize: fontSize['3xs'],
    color: '#92400E',
    letterSpacing: 1.5,
  },
  askRow: {
    paddingVertical: spacing[1],
  },
  askText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: '#78350F',
    lineHeight: 20,
  },
});
