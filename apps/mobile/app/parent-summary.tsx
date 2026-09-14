import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';

import { HBButton } from '@/components/HBButton';
import { HBCard } from '@/components/HBCard';
import { HBPet } from '@/components/HBPet';
import { PaperBackground } from '@/components/PaperBackground';
import { CardSkeleton, Skeleton } from '@/components/Skeleton';
import { Text } from '@/components/Text';
import { getLesson } from '@/data/lessons';
import {
  dismissThread,
  getAnalysis,
  getProgress,
  getThreads,
  updateChild,
  type AnalysisResponse,
  type LessonProgressRecord,
  type MemoryThread,
} from '@/services/api';
import {
  approveWeek,
  ensureWeekCached,
  listWeeks,
  triggerWeekGeneration,
  type GeneratedWeekRecord,
} from '@/services/generatedLessons';
import { useSettings } from '@/store/settings';
import { HBIconBox } from '@/components/HBIconBox';
import { colors, fontFamily, fontSize, radius, shadow, spacing, tints } from '@/theme';
import { useCompanionName } from '@/utils/companion';

export default function ParentSummaryScreen() {
  const router = useRouter();
  const lang = useSettings((s) => s.parentUILanguage) ?? 'ru';
  const childId = useSettings((s) => s.childId);
  const childName = useSettings((s) => s.childName) ?? '';
  const learningLanguages = useSettings((s) => s.learningLanguages);
  const authToken = useSettings((s) => s.authToken);
  const storedHue = useSettings((s) => s.petHue);
  const proactiveOptIn = useSettings((s) => s.proactiveOptIn);
  const setProactiveOptIn = useSettings((s) => s.setProactiveOptIn);
  const isAz = lang === 'az';
  const learningLang = learningLanguages[0] ?? 'en';
  const bot = useCompanionName();

  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [progress, setProgress] = useState<LessonProgressRecord[]>([]);
  const [pendingWeek, setPendingWeek] = useState<GeneratedWeekRecord | null>(null);
  const [threads, setThreads] = useState<MemoryThread[]>([]);
  const [proactiveOn, setProactiveOn] = useState(proactiveOptIn);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!authToken) { setError('no_auth'); setLoading(false); return; }
    if (!childId) { setError('no_child'); setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const [a, weeks, t, p] = await Promise.all([
        getAnalysis(childId, learningLang, authToken),
        listWeeks(childId, learningLang, authToken),
        getThreads(childId, learningLang, authToken, 'all').catch(() => [] as MemoryThread[]),
        getProgress(childId, authToken).catch(() => [] as LessonProgressRecord[]),
      ]);
      setAnalysis(a);
      setPendingWeek(weeks.find((w) => w.status === 'pending') ?? null);
      setThreads(t);
      setProgress(p);
    } catch (e) {
      console.warn('[parent-summary] load failed:', e);
      setError('load_failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [childId, authToken, learningLang]);

  const handleGenerate = async () => {
    if (!childId || !authToken || generating) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setGenerating(true);
    const result = await triggerWeekGeneration(childId, learningLang, authToken);
    if (result.ok) await load();
    setGenerating(false);
  };

  const handleApprove = async () => {
    if (!pendingWeek || !authToken || approving) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setApproving(true);
    const ok = await approveWeek(pendingWeek.id, authToken);
    if (ok) {
      if (childId) await ensureWeekCached(childId, learningLang, pendingWeek.startDay, authToken);
      router.back();
    }
    setApproving(false);
  };

  const handleRegenerate = async () => { await handleGenerate(); };

  const toggleProactive = async () => {
    if (!childId || !authToken) return;
    const next = !proactiveOn;
    Haptics.selectionAsync().catch(() => {});
    setProactiveOn(next);
    setProactiveOptIn(next); // local store drives client-side scheduling immediately
    try {
      await updateChild(childId, { proactiveOptIn: next ? 1 : 0 }, authToken);
    } catch {
      /* best-effort — local store already updated */
    }
  };

  const handleForgetThread = async (threadId: string) => {
    if (!authToken) return;
    Haptics.selectionAsync().catch(() => {});
    setThreads((prev) => prev.filter((t) => t.id !== threadId));
    dismissThread(threadId, authToken).catch(() => {});
  };

  // status → human label
  const threadStatusLabel = (t: MemoryThread): string => {
    if (t.status === 'resolved') return isAz ? 'cavablandı' : 'обсудили';
    if (t.status === 'asked') return isAz ? 'soruşdu' : 'спросил';
    if (t.sensitive) return isAz ? 'həssas — yalnız sizə' : 'деликатное — только вам';
    if (t.followUpAt) return isAz ? `soruşacaq: ${t.followUpAt}` : `спросит: ${t.followUpAt}`;
    return isAz ? 'yadda saxladı' : 'запомнил';
  };
  const visibleThreads = threads.filter((t) => t.status !== 'dismissed');

  // Concrete "what the child actually did" history — shows immediately after the
  // first lesson, unlike the AI analysis which needs a few lessons of data.
  const lessonHistory = (() => {
    const byLang = progress.filter((p) => p.language === learningLang);
    const src = byLang.length > 0 ? byLang : progress;
    return [...src].sort((a, b) => b.day - a.day).slice(0, 15);
  })();

  return (
    <PaperBackground>
      {/* Top action bar */}
      <View style={styles.topBar}>
        <Pressable
          style={styles.topBtn}
          onPress={() => router.replace('/profile-select' as any)}
        >
          <Text style={styles.topBtnText}>‹ {isAz ? 'Profillər' : 'Профили'}</Text>
        </Pressable>
        <Pressable
          style={styles.topBtn}
          onPress={() => router.push('/setup/name' as any)}
        >
          <Text style={[styles.topBtnText, { color: colors.primary }]}>
            + {isAz ? 'Uşaq' : 'Ребёнок'}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {/* Header */}
        <Animated.View entering={FadeInDown.duration(600)} style={styles.header}>
          <View style={styles.petHalo}>
            <HBPet size={72} hue={storedHue} mood="happy" />
          </View>
          <Text style={styles.title}>
            {isAz ? `${childName} üçün hesabat` : `Отчёт по ${childName}`}
          </Text>
          <Text style={styles.subtitle}>
            {isAz
              ? `${bot} nələr öyrəndiyini analiz etdi`
              : `${bot} проанализировал что выучилось`}
          </Text>
        </Animated.View>

        {/* Бобо memory & proactive control (parent transparency) */}
        {!loading && childId && authToken && error !== 'no_auth' && error !== 'no_child' && (
          <Animated.View entering={FadeInUp.duration(500).delay(40)}>
            <HBCard depth="sm" ringColor={proactiveOn ? colors.accent : undefined} style={styles.memCard}>
              <View style={styles.cardHeader}>
                <HBIconBox glyph="🐻" tint={colors.primarySoft} size={36} rounding={radius.md} glyphSize={18} />
                <Text style={styles.cardTitle}>{isAz ? 'Bobo yaddaşı' : 'Память Бобо'}</Text>
              </View>

              <Pressable onPress={toggleProactive} style={styles.memToggleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.memToggleTitle}>
                    {isAz ? 'Bobo özü yazsın' : 'Бобо пишет первым'}
                  </Text>
                  <Text style={styles.memToggleSub}>
                    {isAz
                      ? 'Keçən söhbəti xatırlayıb vaxtında soruşar (gündə ≤1, gündüz). İstənilən vaxt söndürün.'
                      : 'Вспомнит прошлый разговор и спросит вовремя (≤1 в день, днём). Можно выключить.'}
                  </Text>
                </View>
                <View style={[styles.memSwitch, proactiveOn && styles.memSwitchOn]}>
                  <View style={[styles.memKnob, proactiveOn && styles.memKnobOn]} />
                </View>
              </Pressable>

              {visibleThreads.length > 0 ? (
                <View style={{ gap: spacing[2] }}>
                  <Text style={styles.memListLabel}>
                    {isAz ? 'YADDA SAXLADI' : 'ЗАПОМНИЛ И СПРОСИТ'}
                  </Text>
                  {visibleThreads.slice(0, 12).map((t) => (
                    <View key={t.id} style={styles.threadRow}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.threadText}>{t.text}</Text>
                        <Text style={styles.threadMeta}>
                          {threadStatusLabel(t)} · {t.mentionedAt}
                        </Text>
                      </View>
                      <Pressable onPress={() => handleForgetThread(t.id)} hitSlop={8} style={styles.threadForget}>
                        <Text style={styles.threadForgetText}>✕</Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.cardSub}>
                  {isAz ? 'Bobo hələ bir şey planlaşdırmayıb.' : 'Бобо пока ничего не запланировал.'}
                </Text>
              )}
            </HBCard>
          </Animated.View>
        )}

        {/* Completed lessons — concrete progress, visible from lesson 1 */}
        {!loading && lessonHistory.length > 0 && (
          <Animated.View entering={FadeInUp.duration(500).delay(60)}>
            <HBCard depth="sm" style={styles.analysisCard}>
              <View style={styles.cardHeader}>
                <HBIconBox glyph="✅" tint={tints.sage} size={36} rounding={radius.md} glyphSize={18} />
                <Text style={styles.cardTitle}>
                  {isAz ? 'Keçilən dərslər' : 'Пройденные уроки'}
                </Text>
              </View>
              {lessonHistory.map((p) => {
                const theme = getLesson(p.language, p.day)?.theme;
                return (
                  <View key={p.id} style={styles.lessonRow}>
                    <View style={styles.lessonBadge}>
                      <Text style={styles.lessonBadgeText}>
                        {isAz ? `Gün ${p.day}` : `День ${p.day}`}
                      </Text>
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.lessonTheme} numberOfLines={1}>
                        {theme ?? (isAz ? 'Dərs' : 'Урок')}
                      </Text>
                      <Text style={styles.lessonDate}>{(p.completedAt ?? '').slice(0, 10)}</Text>
                    </View>
                    <Text style={styles.lessonStars}>⭐ {p.starsEarned}</Text>
                  </View>
                );
              })}
            </HBCard>
          </Animated.View>
        )}

        {/* Loading skeletons */}
        {loading && (
          <View style={{ gap: spacing[3] }}>
            <View style={styles.statsRow}>
              {[0,1,2].map((i) => (
                <View key={i} style={[styles.statCard, shadow.sm]}>
                  <Skeleton width={40} height={28} />
                  <Skeleton width={60} height={10} style={{ marginTop: 6 }} />
                </View>
              ))}
            </View>
            <CardSkeleton height={120} />
            <CardSkeleton height={140} />
            <Text style={styles.loadingText}>
              {isAz ? 'Analiz hazırlanır...' : 'Готовим анализ...'}
            </Text>
          </View>
        )}

        {/* Error states */}
        {error === 'no_child' && !loading && (
          <EmptyState
            emoji="👶"
            title={isAz ? 'Hələ uşaq yoxdur' : 'Пока нет ребёнка'}
            body={isAz
              ? `Uşaq əlavə et və ${bot} ona dil öyrətməyə başlasın.`
              : `Добавь ребёнка и ${bot} начнёт его учить языку.`}
            action={isAz ? '+ Uşaq əlavə et' : '+ Добавить ребёнка'}
            onAction={() => router.push('/setup/name' as any)}
          />
        )}
        {error === 'no_auth' && !loading && (
          <EmptyState
            emoji="🔐"
            title={isAz ? 'Daxil ol' : 'Нужен вход'}
            body={isAz
              ? 'Tərəqqi və analiz görmək üçün hesaba daxil ol.'
              : 'Войди в аккаунт чтобы видеть прогресс и анализ.'}
            action={isAz ? 'Daxil ol' : 'Войти'}
            onAction={() => router.push('/auth/login' as any)}
          />
        )}
        {error === 'load_failed' && !loading && (
          <EmptyState
            emoji="📡"
            title={isAz ? 'Yükləmə alınmadı' : 'Не удалось загрузить'}
            body={isAz
              ? 'İnternet bağlantısını yoxla və yenidən cəhd et.'
              : 'Проверь подключение и попробуй ещё раз.'}
            action={isAz ? 'Təkrar cəhd et' : 'Повторить'}
            onAction={load}
          />
        )}

        {/* Empty analysis */}
        {analysis && !loading && analysis.meta.empty && (
          <Animated.View entering={FadeInUp.duration(500)}>
            <HBCard depth="sm" style={styles.emptyCard}>
              <Text style={{ fontSize: 48, textAlign: 'center' }}>📚</Text>
              <Text style={styles.cardTitle}>
                {isAz ? 'Hələ məlumat yoxdur' : 'Пока нет данных'}
              </Text>
              <Text style={styles.cardSub}>
                {isAz
                  ? `${childName} ən azı bir dərs tamamladıqdan sonra hesabat görünəcək.`
                  : `Отчёт появится после первого урока ${childName}.`}
              </Text>
            </HBCard>
          </Animated.View>
        )}

        {/* Full analysis */}
        {analysis && !loading && !analysis.meta.empty && (
          <>
            {/* Stats row */}
            <Animated.View entering={FadeInUp.duration(500).delay(80)} style={styles.statsRow}>
              <StatCard emoji="📚" value={analysis.meta.lessonsCompleted} label={isAz ? 'dərs' : 'уроков'} />
              <StatCard emoji="⭐" value={analysis.meta.totalStars} label={isAz ? 'ulduz' : 'звёзд'} />
              <StatCard emoji="🎯" value={analysis.meta.totalErrors} label={isAz ? 'xəta' : 'ошибок'} />
            </Animated.View>

            {/* Strengths */}
            {analysis.analysis.strengths.length > 0 && (
              <Animated.View entering={FadeInUp.duration(500).delay(160)}>
                <HBCard depth="sm" ringColor={colors.accent} style={styles.analysisCard}>
                  <View style={styles.cardHeader}>
                    <HBIconBox glyph="💪" tint={tints.sage} size={36} rounding={radius.md} glyphSize={18} />
                    <Text style={styles.cardTitle}>
                      {isAz ? 'Güclü tərəfləri' : 'Сильные стороны'}
                    </Text>
                  </View>
                  {analysis.analysis.strengths.map((s, i) => (
                    <View key={i} style={styles.bulletRow}>
                      <View style={[styles.bullet, { backgroundColor: colors.accent }]}>
                        <Text style={styles.bulletCheck}>✓</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.bulletTopic}>{s.topic}</Text>
                        <Text style={styles.bulletEvidence}>{s.evidence}</Text>
                      </View>
                    </View>
                  ))}
                </HBCard>
              </Animated.View>
            )}

            {/* Weaknesses */}
            {analysis.analysis.weaknesses.length > 0 && (
              <Animated.View entering={FadeInUp.duration(500).delay(240)}>
                <HBCard depth="sm" ringColor={colors.butter} style={styles.analysisCard}>
                  <View style={styles.cardHeader}>
                    <HBIconBox glyph="🎯" tint="#FFF8D6" size={36} rounding={radius.md} glyphSize={18} />
                    <Text style={styles.cardTitle}>
                      {isAz ? 'Üzərində işləyirik' : 'Над чем работаем'}
                    </Text>
                  </View>
                  {analysis.analysis.weaknesses.map((w, i) => (
                    <View key={i} style={styles.bulletRow}>
                      <View style={[styles.bullet, { backgroundColor: colors.butter }]}>
                        <Text style={styles.bulletCheck}>•</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.bulletTopic}>{w.topic}</Text>
                        <Text style={styles.bulletEvidence}>{w.evidence}</Text>
                        {w.specificMistakes.length > 0 && (
                          <View style={styles.chipRow}>
                            {w.specificMistakes.slice(0, 4).map((m, j) => (
                              <View key={j} style={styles.mistakeChip}>
                                <Text style={styles.mistakeChipText}>{m}</Text>
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                    </View>
                  ))}
                </HBCard>
              </Animated.View>
            )}

            {/* Interests */}
            {analysis.analysis.interests.length > 0 && (
              <Animated.View entering={FadeInUp.duration(500).delay(300)}>
                <HBCard depth="sm" style={styles.analysisCard}>
                  <View style={styles.cardHeader}>
                    <HBIconBox glyph="💖" tint={tints.berry} size={36} rounding={radius.md} glyphSize={18} />
                    <Text style={styles.cardTitle}>{isAz ? 'Maraqları' : 'Интересы'}</Text>
                  </View>
                  <View style={styles.chipRow}>
                    {analysis.analysis.interests.map((interest, i) => (
                      <View key={i} style={styles.interestChip}>
                        <Text style={styles.interestText}>{interest}</Text>
                      </View>
                    ))}
                  </View>
                  <Text style={styles.cardSub}>
                    {isAz
                      ? `${bot} bu mövzuları gələcək dərslərə daxil edəcək.`
                      : `${bot} вплетёт эти темы в следующие уроки.`}
                  </Text>
                </HBCard>
              </Animated.View>
            )}

            {/* Vocabulary to review */}
            {analysis.analysis.vocabularyToReview.length > 0 && (
              <Animated.View entering={FadeInUp.duration(500).delay(340)}>
                <HBCard depth="sm" style={styles.analysisCard}>
                  <View style={styles.cardHeader}>
                    <HBIconBox glyph="🔄" tint={colors.primarySoft} size={36} rounding={radius.md} glyphSize={18} />
                    <Text style={styles.cardTitle}>
                      {isAz ? 'Təkrarlanacaq sözlər' : 'Повторим слова'}
                    </Text>
                  </View>
                  <View style={styles.chipRow}>
                    {analysis.analysis.vocabularyToReview.map((w, i) => (
                      <View key={i} style={styles.vocabChip}>
                        <Text style={styles.vocabChipText}>{w}</Text>
                      </View>
                    ))}
                  </View>
                </HBCard>
              </Animated.View>
            )}

            {/* AI Week plan */}
            <Animated.View entering={FadeInUp.duration(500).delay(400)}>
              <HBCard depth="md" ringColor={colors.primary} style={styles.planCard}>
                <View style={styles.cardHeader}>
                  <HBIconBox glyph="📅" tint={colors.primarySoft} size={36} rounding={radius.md} glyphSize={18} />
                  <Text style={[styles.cardTitle, { color: colors.primary }]}>
                    {isAz ? 'AI plan — növbəti həftə' : 'AI-план на следующую неделю'}
                  </Text>
                </View>

                {!pendingWeek && !generating && (
                  <>
                    <Text style={styles.cardSub}>
                      {isAz
                        ? 'Plan hələ yaradılmayıb. Şəxsi həftəlik plan üçün AI-ni işlət.'
                        : 'План ещё не создан. Запусти AI чтобы получить персональную программу на неделю.'}
                    </Text>
                    <HBButton
                      full
                      variant="primary"
                      label={isAz ? '✨ Planı yarat' : '✨ Создать план'}
                      onPress={handleGenerate}
                    />
                  </>
                )}

                {generating && (
                  <View style={styles.generatingBox}>
                    <ActivityIndicator color={colors.primary} size="large" />
                    <Text style={styles.loadingText}>
                      {isAz ? `${bot} plan qurur...` : `${bot} составляет план...`}
                    </Text>
                  </View>
                )}

                {pendingWeek && !generating && (
                  <>
                    <Animated.View entering={FadeIn.duration(500)} style={styles.rationaleBox}>
                      <Text style={styles.rationaleLabel}>
                        {isAz ? 'NIYƏ BU PLAN' : 'ПОЧЕМУ ИМЕННО ТАК'}
                      </Text>
                      <Text style={styles.rationaleText}>{pendingWeek.weekRationale}</Text>
                    </Animated.View>

                    {pendingWeek.lessons.map((l, i) => (
                      <Animated.View
                        key={i}
                        entering={FadeInUp.duration(300).delay(i * 60)}
                        style={[styles.dayRow, i === pendingWeek.lessons.length - 1 && { borderBottomWidth: 0 }]}
                      >
                        <View style={styles.dayBadge}>
                          <Text style={styles.dayBadgeText}>
                            {isAz ? `Gün ${l.day}` : `День ${l.day}`}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={styles.dayHeaderRow}>
                            <Text style={{ fontSize: 20 }}>{l.themeEmoji}</Text>
                            <Text style={styles.dayTheme}>{l.theme}</Text>
                          </View>
                          <Text style={styles.dayReasoning}>{l.reasoning}</Text>
                          <View style={styles.chipRow}>
                            {l.vocabulary.slice(0, 5).map((v, vi) => (
                              <View key={vi} style={styles.vocabChip}>
                                <Text style={styles.vocabChipText}>{v}</Text>
                              </View>
                            ))}
                          </View>
                        </View>
                      </Animated.View>
                    ))}

                    <View style={styles.actionsRow}>
                      <Pressable
                        onPress={handleRegenerate}
                        disabled={approving}
                        style={[styles.secondaryBtn, approving && { opacity: 0.5 }]}
                      >
                        <Text style={styles.secondaryBtnText}>
                          {isAz ? '🔄 Yenidən' : '🔄 Перегенерировать'}
                        </Text>
                      </Pressable>
                      <View style={{ flex: 1 }}>
                        <HBButton
                          full
                          variant="primary"
                          label={approving ? '...' : (isAz ? '✓ Təsdiqlə' : '✓ Утвердить')}
                          onPress={handleApprove}
                          disabled={approving}
                        />
                      </View>
                    </View>
                  </>
                )}
              </HBCard>
            </Animated.View>
          </>
        )}
      </ScrollView>
    </PaperBackground>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatCard({ emoji, value, label }: { emoji: string; value: number; label: string }) {
  return (
    <View style={[styles.statCard, shadow.sm]}>
      <Text style={{ fontSize: 22 }}>{emoji}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function EmptyState({
  emoji, title, body, action, onAction,
}: {
  emoji: string; title: string; body: string; action: string; onAction: () => void;
}) {
  return (
    <HBCard depth="sm" style={styles.emptyCard}>
      <Text style={{ fontSize: 52, textAlign: 'center' }}>{emoji}</Text>
      <Text style={[styles.cardTitle, { textAlign: 'center' }]}>{title}</Text>
      <Text style={[styles.cardSub, { textAlign: 'center' }]}>{body}</Text>
      <HBButton full variant="primary" label={action} onPress={onAction} />
    </HBCard>
  );
}

const styles = StyleSheet.create({
  topBar: {
    position: 'absolute',
    top: 52,
    left: spacing[5],
    right: spacing[5],
    zIndex: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  topBtn: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: radius.full,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.8)',
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(125,90,42,0.08)',
    ...shadow.sm,
  },
  topBtnText: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.sm,
    color: colors.inkSoft,
  },

  scroll: {
    paddingHorizontal: spacing[5],
    paddingTop: 110,
    paddingBottom: spacing[12],
    gap: spacing[4],
  },

  header: { alignItems: 'center', gap: spacing[2], marginBottom: spacing[2] },
  petHalo: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 1.5,
    borderTopColor: 'rgba(255,255,255,0.8)',
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(125,90,42,0.08)',
    ...shadow.sm,
  },
  title: {
    fontFamily: fontFamily.display,
    fontSize: fontSize['2xl'],
    color: colors.ink,
    textAlign: 'center',
    marginTop: spacing[2],
  },
  subtitle: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    color: colors.inkSoft,
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 20,
  },

  loadingText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    color: colors.inkSoft,
    textAlign: 'center',
    marginTop: spacing[2],
  },

  emptyCard: { alignItems: 'center', gap: spacing[3] },

  statsRow: { flexDirection: 'row', gap: spacing[2] },
  statCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing[4],
    alignItems: 'center',
    gap: spacing[1],
    borderTopWidth: 1.5,
    borderTopColor: 'rgba(255,255,255,0.8)',
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(125,90,42,0.08)',
  },
  statValue: {
    fontFamily: fontFamily.display,
    fontSize: fontSize['2xl'],
    color: colors.ink,
  },
  statLabel: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize['3xs'],
    color: colors.inkSoft,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  analysisCard: { gap: spacing[3] },
  planCard: { gap: spacing[3] },

  lessonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: colors.bgDeep,
  },
  lessonBadge: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: radius.sm,
    minWidth: 62,
  },
  lessonBadgeText: {
    fontFamily: fontFamily.bodyBlack,
    fontSize: fontSize['3xs'],
    color: colors.primary,
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  lessonTheme: { fontFamily: fontFamily.bodyBold, fontSize: fontSize.sm, color: colors.ink },
  lessonDate: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.xs,
    color: colors.inkSoft,
    marginTop: 1,
  },
  lessonStars: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.sm,
    color: '#E8A000',
  },
  memCard: { gap: spacing[3] },
  memToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    backgroundColor: colors.bg,
    borderRadius: radius.lg,
    padding: spacing[3],
  },
  memToggleTitle: { fontFamily: fontFamily.bodyBlack, fontSize: fontSize.sm, color: colors.ink },
  memToggleSub: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.xs,
    color: colors.inkSoft,
    marginTop: 3,
    lineHeight: 16,
  },
  memSwitch: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.bgDeep,
    padding: 3,
    justifyContent: 'center',
  },
  memSwitchOn: { backgroundColor: colors.accent },
  memKnob: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.white, ...shadow.sm },
  memKnobOn: { alignSelf: 'flex-end' },
  memListLabel: {
    fontFamily: fontFamily.bodyBlack,
    fontSize: fontSize['3xs'],
    color: colors.inkSoft,
    letterSpacing: 1,
  },
  threadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingVertical: spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: colors.bgDeep,
  },
  threadText: { fontFamily: fontFamily.bodyBold, fontSize: fontSize.sm, color: colors.ink },
  threadMeta: { fontFamily: fontFamily.bodyMedium, fontSize: fontSize.xs, color: colors.inkSoft, marginTop: 2 },
  threadForget: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.bgDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  threadForgetText: { fontFamily: fontFamily.bodyBlack, fontSize: fontSize.xs, color: colors.inkSoft },

  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  cardTitle: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.lg,
    color: colors.ink,
    flex: 1,
  },
  cardSub: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    color: colors.inkSoft,
    lineHeight: 20,
  },

  bulletRow: { flexDirection: 'row', gap: spacing[3], alignItems: 'flex-start' },
  bullet: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
    flexShrink: 0,
  },
  bulletCheck: {
    color: colors.white,
    fontFamily: fontFamily.bodyBlack,
    fontSize: fontSize['2xs'],
  },
  bulletTopic: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.base,
    color: colors.ink,
  },
  bulletEvidence: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.xs,
    color: colors.inkSoft,
    marginTop: 2,
    lineHeight: 18,
  },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginTop: spacing[1] },
  mistakeChip: {
    backgroundColor: '#FFF3E0',
    borderRadius: radius.sm,
    paddingHorizontal: spacing[2],
    paddingVertical: 3,
  },
  mistakeChipText: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize['2xs'],
    color: '#C76A1A',
  },
  interestChip: {
    backgroundColor: tints.berry,
    borderRadius: radius.full,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
  },
  interestText: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.sm,
    color: colors.berry,
  },
  vocabChip: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.sm,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
  },
  vocabChipText: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.sm,
    color: colors.primary,
  },

  rationaleBox: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.lg,
    padding: spacing[4],
    gap: spacing[2],
  },
  rationaleLabel: {
    fontFamily: fontFamily.bodyBlack,
    fontSize: fontSize['3xs'],
    color: colors.primary,
    letterSpacing: 1,
  },
  rationaleText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    color: colors.ink,
    lineHeight: 20,
  },

  dayRow: {
    flexDirection: 'row',
    gap: spacing[3],
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.bgDeep,
  },
  dayBadge: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: radius.sm,
    alignSelf: 'flex-start',
    minWidth: 60,
  },
  dayBadgeText: {
    fontFamily: fontFamily.bodyBlack,
    fontSize: fontSize['3xs'],
    color: colors.primary,
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  dayHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  dayTheme: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.base,
    color: colors.ink,
    flexShrink: 1,
  },
  dayReasoning: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.xs,
    color: colors.inkSoft,
    marginTop: 3,
    lineHeight: 17,
  },

  generatingBox: { alignItems: 'center', gap: spacing[3], paddingVertical: spacing[6] },

  actionsRow: { flexDirection: 'row', gap: spacing[2], marginTop: spacing[2], alignItems: 'center' },
  secondaryBtn: {
    flex: 1,
    borderRadius: radius.full,
    paddingVertical: spacing[3] + 1,
    alignItems: 'center',
    backgroundColor: colors.bgDeep,
    borderWidth: 1.5,
    borderColor: 'rgba(125,90,42,0.12)',
  },
  secondaryBtnText: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.sm,
    color: colors.inkSoft,
  },
});
