/**
 * «Что помнит Бобо» — факты, которые персонаж узнал о ребёнке в разговорах,
 * по темам, и то, о чём он собирается спросить. Каждый факт можно стереть.
 *
 * Фон и карточки — из общей палитры (раньше здесь был фиолетовый градиент,
 * которого нет больше нигде в приложении).
 */

import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';

import { HBCard } from '@/components/HBCard';
import { HBIconBox } from '@/components/HBIconBox';
import { HBPet } from '@/components/HBPet';
import { Icon, type IconName } from '@/components/Icon';
import { PaperBackground } from '@/components/PaperBackground';
import { ScreenHeader } from '@/components/ScreenHeader';
import { CardSkeleton, Skeleton } from '@/components/Skeleton';
import { Text } from '@/components/Text';
import { useTheme } from '@/hooks/useTheme';
import { forgetFact, getBoboMemory, type BoboMemory, type ChildFact } from '@/services/api';
import { useSettings } from '@/store/settings';
import { colors, fontFamily, fontSize, radius, scaleFont, spacing } from '@/theme';
import { useCompanionName } from '@/utils/companion';

const CATEGORIES: Record<ChildFact['category'], { icon: IconName; ru: string; az: string }> = {
  interests:    { icon: 'palette',   ru: 'Интересы',     az: 'Maraqlar' },
  family:       { icon: 'users',     ru: 'Семья',        az: 'Ailə' },
  pets:         { icon: 'paw-print', ru: 'Питомцы',      az: 'Ev heyvanları' },
  routine:      { icon: 'sun',       ru: 'Распорядок',   az: 'Gündəlik' },
  recent_event: { icon: 'sparkles',  ru: 'Недавно',      az: 'Bu yaxınlarda' },
  preferences:  { icon: 'heart',     ru: 'Предпочтения', az: 'Üstünlüklər' },
};

export default function MemoryScreen() {
  const lang = useSettings((s) => s.parentUILanguage) ?? 'ru';
  const childId = useSettings((s) => s.childId);
  const childName = useSettings((s) => s.childName) ?? '';
  const learningLanguages = useSettings((s) => s.learningLanguages);
  const authToken = useSettings((s) => s.authToken);
  const isAz = lang === 'az';
  const learningLang = learningLanguages[0] ?? 'en';
  const bot = useCompanionName();
  const { t, accent } = useTheme();

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
    <PaperBackground>
      <ScreenHeader
        title={isAz ? `${bot} xatırlayır` : `${bot} помнит о тебе`}
        subtitle={isAz ? `Hər söhbətdə ${bot} səni daha yaxşı tanıyır` : `С каждым разговором ${bot} узнаёт тебя лучше`}
      />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingHorizontal: t.density.padX, gap: t.density.gap }]}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={{ gap: spacing[3] }}>
            <HBCard style={styles.banner}>
              <Skeleton width={56} height={56} borderRadius={28} />
              <View style={{ flex: 1, gap: 6 }}>
                <Skeleton width="70%" height={14} />
                <Skeleton width="50%" height={10} />
              </View>
            </HBCard>
            <CardSkeleton height={120} />
            <CardSkeleton height={120} />
          </View>
        ) : factCount === 0 ? (
          <Animated.View entering={FadeIn.duration(400)}>
            <HBCard style={styles.emptyCard}>
              <HBPet size={t.mascot.hero} mood="curious" />
              <Text variant="headline" align="center">
                {isAz ? 'Hələ bir şey bilmir' : 'Пока ничего не знает'}
              </Text>
              <Text variant="body" tone="secondary" align="center" style={styles.emptyText}>
                {isAz
                  ? `${bot} ilə danışmağa başla — və o səni xatırlamağa başlayacaq.`
                  : `Поговори с ${bot} — и он начнёт тебя запоминать.`}
              </Text>
            </HBCard>
          </Animated.View>
        ) : (
          <>
            {/* Сколько запомнил */}
            <Animated.View entering={FadeInUp.duration(450)}>
              <HBCard style={styles.banner}>
                <HBPet size={t.mascot.inline} mood="happy" />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.bannerNumber, { color: accent.ink }]}>{factCount}</Text>
                  <Text variant="bodyBold">
                    {isAz ? 'fakt yadda saxladım' : 'фактов запомнил'}
                  </Text>
                </View>
              </HBCard>
            </Animated.View>

            {/* Факты по темам */}
            {Object.entries(grouped).map(([category, facts], idx) => {
              const meta = CATEGORIES[category as ChildFact['category']];
              if (!meta) return null;
              return (
                <Animated.View key={category} entering={FadeInUp.duration(400).delay(120 + idx * 60)}>
                  <HBCard>
                    <View style={styles.categoryHeader}>
                      <HBIconBox icon={meta.icon} tint={accent.soft} iconColor={accent.ink} size={36} />
                      <Text variant="bodyBold" style={styles.categoryTitle}>
                        {isAz ? meta.az : meta.ru}
                      </Text>
                      <View style={[styles.categoryCount, { backgroundColor: accent.soft }]}>
                        <Text style={[styles.categoryCountText, { color: accent.ink }]}>{facts.length}</Text>
                      </View>
                    </View>
                    <View style={styles.factList}>
                      {facts.map((fact, i) => (
                        <View key={i} style={styles.factRow}>
                          <View style={[styles.factBullet, { backgroundColor: accent.bottom }]} />
                          <View style={{ flex: 1 }}>
                            <Text variant="caption" style={styles.factText}>
                              {fact.fact}
                            </Text>
                            {fact.mentionedAt ? (
                              <Text style={styles.factDate}>{fact.mentionedAt}</Text>
                            ) : null}
                          </View>
                          <Pressable
                            onPress={() => handleForget(fact)}
                            hitSlop={8}
                            accessibilityRole="button"
                            accessibilityLabel={isAz ? 'Unut' : 'Забыть'}
                            style={styles.factForget}
                          >
                            <Icon name="x" size={14} color={colors.inkSoft} strokeWidth={2.5} />
                          </Pressable>
                        </View>
                      ))}
                    </View>
                  </HBCard>
                </Animated.View>
              );
            })}

            {/* О чём спросит */}
            {askCount > 0 && (
              <Animated.View entering={FadeInUp.duration(400).delay(400)}>
                <HBCard bg={accent.soft} style={styles.askCard}>
                  <View style={styles.askHead}>
                    <Icon name="message-circle" size={18} color={accent.ink} />
                    <Text variant="bodyBold" style={{ color: accent.ink }}>
                      {isAz ? `${bot} səndən soruşacaq` : `${bot} спросит тебя`}
                    </Text>
                  </View>
                  {memory!.thingsToAskBack.map((q, i) => (
                    <Text key={i} variant="caption" style={styles.askText}>
                      {q}
                    </Text>
                  ))}
                </HBCard>
              </Animated.View>
            )}
          </>
        )}
      </ScrollView>
    </PaperBackground>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingTop: spacing[2], paddingBottom: spacing[12] },

  emptyCard: { alignItems: 'center', gap: spacing[2], paddingVertical: spacing[6] },
  emptyText: { maxWidth: 280 },

  banner: { flexDirection: 'row', alignItems: 'center', gap: spacing[4] },
  bannerNumber: {
    fontFamily: fontFamily.display,
    fontSize: scaleFont(36),
    lineHeight: scaleFont(40),
    letterSpacing: -1,
  },

  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginBottom: spacing[3],
  },
  categoryTitle: { flex: 1 },
  categoryCount: {
    borderRadius: radius.full,
    minWidth: 24,
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    alignItems: 'center',
  },
  categoryCountText: {
    fontFamily: fontFamily.bodyBlack,
    fontSize: fontSize.xs,
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
    marginTop: 8,
  },
  factText: { color: colors.ink },
  factDate: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize['3xs'],
    color: colors.inkSoft,
    marginTop: 2,
  },
  factForget: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },

  askCard: { gap: spacing[2] },
  askHead: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  askText: { color: colors.ink },
});
