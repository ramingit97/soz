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
import { Icon, type IconName } from '@/components/Icon';
import { PaperBackground } from '@/components/PaperBackground';
import { ScreenHeader } from '@/components/ScreenHeader';
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
import { useAccent } from '@/hooks/useAccent';
import { UIModeProvider } from '@/hooks/useUIMode';
import { fontFamily, fontSize, radius, shadow, spacing } from '@/theme';
import { MODE_TOKENS, makeModeStyles } from '@/theme/modeTokens';
import { useCompanionName } from '@/utils/companion';
import { useTheme } from '@/hooks/useTheme';

export default function ParentSummaryScreen() {
  const { c, mode: uiMode } = useTheme();
  const styles = stylesByMode[uiMode];
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
  const accent = useAccent();
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
    // Отчёт читает родитель — всегда «взрослый» режим.
    <UIModeProvider force="teen">
    <PaperBackground>
      <ScreenHeader title={isAz ? `${childName}: hesabat` : `Отчёт: ${childName}`} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingHorizontal: MODE_TOKENS.teen.density.padX }]}
      >
        <Animated.View entering={FadeInDown.duration(450)} style={styles.intro}>
          <HBPet size={56} hue={storedHue} mood="happy" />
          <Text variant="body" tone="secondary" style={styles.flex}>
            {isAz ? `${bot} nələrin öyrənildiyini təhlil etdi` : `${bot} разобрал, что уже выучено`}
          </Text>
        </Animated.View>

        {/* Бобо memory & proactive control (parent transparency) */}
        {!loading && childId && authToken && error !== 'no_auth' && error !== 'no_child' && (
          <Animated.View entering={FadeInUp.duration(500).delay(40)}>
            <HBCard depth="sm" ringColor={proactiveOn ? accent.bottom : undefined} style={styles.memCard}>
              <View style={styles.cardHeader}>
                <HBIconBox icon="brain" tint={c.primarySoft} size={36} rounding={radius.md} />
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
                <View
                  style={[styles.memSwitch, proactiveOn && { backgroundColor: accent.bottom }]}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: proactiveOn }}
                >
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
                      <Pressable
                        onPress={() => handleForgetThread(t.id)}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel={isAz ? 'Unut' : 'Забыть'}
                        style={styles.threadForget}
                      >
                        <Icon name="x" size={14} color={c.inkSoft} strokeWidth={2.5} />
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
                <HBIconBox icon="circle-check" tint={c.tints.sage} size={36} rounding={radius.md} />
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
                    <View style={styles.starsRow}>
                      <Icon name="star" size={14} color={c.butterDeep} fill={c.butter} strokeWidth={2} />
                      <Text style={styles.lessonStars}>{p.starsEarned}</Text>
                    </View>
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
            icon="baby"
            title={isAz ? 'Hələ uşaq yoxdur' : 'Пока нет ребёнка'}
            body={isAz
              ? `Uşaq əlavə edin — və ${bot} ona dil öyrətməyə başlayacaq.`
              : `Добавьте ребёнка — и ${bot} начнёт учить его языку.`}
            action={isAz ? 'Uşaq əlavə et' : 'Добавить ребёнка'}
            onAction={() => router.push('/setup/profile-type' as never)}
          />
        )}
        {error === 'no_auth' && !loading && (
          <EmptyState
            icon="lock"
            title={isAz ? 'Giriş lazımdır' : 'Нужен вход'}
            body={isAz
              ? 'Tərəqqini və təhlili görmək üçün hesaba daxil olun.'
              : 'Войдите в аккаунт, чтобы видеть прогресс и разбор.'}
            action={isAz ? 'Daxil olun' : 'Войти'}
            onAction={() => router.push('/auth/login' as any)}
          />
        )}
        {error === 'load_failed' && !loading && (
          <EmptyState
            icon="wifi-off"
            title={isAz ? 'Yükləmə alınmadı' : 'Не удалось загрузить'}
            body={isAz
              ? 'İnternet bağlantısını yoxlayın və yenidən cəhd edin.'
              : 'Проверьте подключение и попробуйте ещё раз.'}
            action={isAz ? 'Təkrar cəhd et' : 'Повторить'}
            onAction={load}
          />
        )}

        {/* Empty analysis */}
        {analysis && !loading && analysis.meta.empty && (
          <Animated.View entering={FadeInUp.duration(500)}>
            <HBCard depth="sm" style={styles.emptyCard}>
              <HBPet size={96} mood="curious" />
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
              <StatCard icon="book-open" value={analysis.meta.lessonsCompleted} label={isAz ? 'dərs' : 'уроков'} />
              <StatCard icon="star" value={analysis.meta.totalStars} label={isAz ? 'ulduz' : 'звёзд'} />
              <StatCard icon="target" value={analysis.meta.totalErrors} label={isAz ? 'xəta' : 'ошибок'} />
            </Animated.View>

            {/* Strengths */}
            {analysis.analysis.strengths.length > 0 && (
              <Animated.View entering={FadeInUp.duration(500).delay(160)}>
                <HBCard depth="sm" ringColor={c.accent} style={styles.analysisCard}>
                  <View style={styles.cardHeader}>
                    <HBIconBox icon="dumbbell" tint={c.tints.sage} size={36} rounding={radius.md} />
                    <Text style={styles.cardTitle}>
                      {isAz ? 'Güclü tərəfləri' : 'Сильные стороны'}
                    </Text>
                  </View>
                  {analysis.analysis.strengths.map((s, i) => (
                    <View key={i} style={styles.bulletRow}>
                      <View style={[styles.bullet, { backgroundColor: c.accent }]}>
                        <Icon name="check" size={12} color={c.white} strokeWidth={3} />
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
                <HBCard depth="sm" ringColor={c.butter} style={styles.analysisCard}>
                  <View style={styles.cardHeader}>
                    <HBIconBox icon="target" tint="#FFF8D6" size={36} rounding={radius.md} />
                    <Text style={styles.cardTitle}>
                      {isAz ? 'Üzərində işləyirik' : 'Над чем работаем'}
                    </Text>
                  </View>
                  {analysis.analysis.weaknesses.map((w, i) => (
                    <View key={i} style={styles.bulletRow}>
                      <View style={[styles.bullet, { backgroundColor: c.butter }]}>
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
                    <HBIconBox icon="heart" tint={c.tints.berry} size={36} rounding={radius.md} />
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
                    <HBIconBox icon="refresh-cw" tint={c.primarySoft} size={36} rounding={radius.md} />
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
              <HBCard depth="md" ringColor={accent.bottom} style={styles.planCard}>
                <View style={styles.cardHeader}>
                  <HBIconBox icon="calendar" tint={c.primarySoft} size={36} rounding={radius.md} />
                  <Text style={[styles.cardTitle, { color: accent.ink }]}>
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
                      icon="sparkles"
                      label={isAz ? 'Planı yarat' : 'Создать план'}
                      onPress={handleGenerate}
                    />
                  </>
                )}

                {generating && (
                  <View style={styles.generatingBox}>
                    <ActivityIndicator color={c.primary} size="large" />
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
                      <HBButton
                        variant="soft"
                        icon="refresh-cw"
                        label={isAz ? 'Yenidən' : 'Заново'}
                        onPress={handleRegenerate}
                        disabled={approving}
                      />
                      <View style={{ flex: 1 }}>
                        <HBButton
                          full
                          variant="primary"
                          icon="check"
                          loading={approving}
                          label={isAz ? 'Təsdiqlə' : 'Утвердить'}
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
    </UIModeProvider>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatCard({ icon, value, label }: { icon: IconName; value: number; label: string }) {
  const { mode: uiMode } = useTheme();
  const styles = stylesByMode[uiMode];
  const accent = useAccent();
  return (
    <HBCard style={styles.statCard}>
      <Icon name={icon} size={20} color={accent.ink} />
      <Text style={styles.statValue}>{value}</Text>
      <Text variant="caption" tone="secondary">{label}</Text>
    </HBCard>
  );
}

function EmptyState({
  icon, title, body, action, onAction,
}: {
  icon: IconName; title: string; body: string; action: string; onAction: () => void;
}) {
  const { mode: uiMode } = useTheme();
  const styles = stylesByMode[uiMode];
  const accent = useAccent();
  return (
    <HBCard depth="sm" style={styles.emptyCard}>
      <HBIconBox icon={icon} tint={accent.soft} iconColor={accent.ink} size={56} />
      <Text variant="headline" align="center">{title}</Text>
      <Text variant="body" tone="secondary" align="center">{body}</Text>
      <HBButton full variant="primary" label={action} onPress={onAction} />
    </HBCard>
  );
}

const stylesByMode = makeModeStyles((t) => StyleSheet.create({
  scroll: {
    paddingTop: spacing[1],
    paddingBottom: spacing[12],
    gap: spacing[3],
  },
  intro: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  flex: { flex: 1, minWidth: 0 },
  starsRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },

  loadingText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    color: t.c.inkSoft,
    textAlign: 'center',
    marginTop: spacing[2],
  },

  emptyCard: { alignItems: 'center', gap: spacing[3] },

  statsRow: { flexDirection: 'row', gap: spacing[2] },
  statCard: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: spacing[3] },
  statValue: {
    fontFamily: fontFamily.display,
    fontSize: fontSize['2xl'],
    color: t.c.ink,
  },

  analysisCard: { gap: spacing[3] },
  planCard: { gap: spacing[3] },

  lessonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: t.c.bgDeep,
  },
  lessonBadge: {
    backgroundColor: t.c.primarySoft,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: radius.sm,
    minWidth: 62,
  },
  lessonBadgeText: {
    fontFamily: fontFamily.bodyBlack,
    fontSize: fontSize['3xs'],
    color: t.c.primary,
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  lessonTheme: { fontFamily: fontFamily.bodyBold, fontSize: fontSize.sm, color: t.c.ink },
  lessonDate: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.xs,
    color: t.c.inkSoft,
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
    backgroundColor: t.c.bg,
    borderRadius: radius.lg,
    padding: spacing[3],
  },
  memToggleTitle: { fontFamily: fontFamily.bodyBlack, fontSize: fontSize.sm, color: t.c.ink },
  memToggleSub: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.xs,
    color: t.c.inkSoft,
    marginTop: 3,
    lineHeight: 16,
  },
  memSwitch: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: t.c.bgDeep,
    padding: 3,
    justifyContent: 'center',
  },
  memKnob: { width: 22, height: 22, borderRadius: 11, backgroundColor: t.c.white, ...shadow.sm },
  memKnobOn: { alignSelf: 'flex-end' },
  memListLabel: {
    fontFamily: fontFamily.bodyBlack,
    fontSize: fontSize['3xs'],
    color: t.c.inkSoft,
    letterSpacing: 1,
  },
  threadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingVertical: spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: t.c.bgDeep,
  },
  threadText: { fontFamily: fontFamily.bodyBold, fontSize: fontSize.sm, color: t.c.ink },
  threadMeta: { fontFamily: fontFamily.bodyMedium, fontSize: fontSize.xs, color: t.c.inkSoft, marginTop: 2 },
  threadForget: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: t.c.bgDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },

  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  cardTitle: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.lg,
    color: t.c.ink,
    flex: 1,
  },
  cardSub: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    color: t.c.inkSoft,
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
    color: t.c.white,
    fontFamily: fontFamily.bodyBlack,
    fontSize: fontSize['2xs'],
  },
  bulletTopic: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.base,
    color: t.c.ink,
  },
  bulletEvidence: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.xs,
    color: t.c.inkSoft,
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
    backgroundColor: t.c.tints.berry,
    borderRadius: radius.full,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
  },
  interestText: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.sm,
    color: t.c.berry,
  },
  vocabChip: {
    backgroundColor: t.c.primarySoft,
    borderRadius: radius.sm,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
  },
  vocabChipText: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.sm,
    color: t.c.primary,
  },

  rationaleBox: {
    backgroundColor: t.c.primarySoft,
    borderRadius: radius.lg,
    padding: spacing[4],
    gap: spacing[2],
  },
  rationaleLabel: {
    fontFamily: fontFamily.bodyBlack,
    fontSize: fontSize['3xs'],
    color: t.c.primary,
    letterSpacing: 1,
  },
  rationaleText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    color: t.c.ink,
    lineHeight: 20,
  },

  dayRow: {
    flexDirection: 'row',
    gap: spacing[3],
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: t.c.bgDeep,
  },
  dayBadge: {
    backgroundColor: t.c.primarySoft,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: radius.sm,
    alignSelf: 'flex-start',
    minWidth: 60,
  },
  dayBadgeText: {
    fontFamily: fontFamily.bodyBlack,
    fontSize: fontSize['3xs'],
    color: t.c.primary,
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  dayHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  dayTheme: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.base,
    color: t.c.ink,
    flexShrink: 1,
  },
  dayReasoning: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.xs,
    color: t.c.inkSoft,
    marginTop: 3,
    lineHeight: 17,
  },

  generatingBox: { alignItems: 'center', gap: spacing[3], paddingVertical: spacing[6] },

  actionsRow: { flexDirection: 'row', gap: spacing[2], marginTop: spacing[2], alignItems: 'center' },
}));
