/**
 * HomeHero — единственная главная карточка экрана: «Урок дня».
 *
 * Решение владельца 2026-09-14: на главном одна понятная вещь. В карточке —
 * тема дня и шаги урока (что ребёнок будет делать), одна кнопка. Выполненный
 * день показывает те же шаги с галочками и зовёт поговорить. Остальные
 * состояния (урок собирается, нужен аккаунт, нужен Premium) занимают ту же
 * карточку, а не добавляют новые блоки.
 */
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { HBButton } from '../HBButton';
import { HBCard } from '../HBCard';
import { HBIconBox } from '../HBIconBox';
import { HBPet } from '../HBPet';
import { Icon, type IconName } from '../Icon';
import { Text } from '../Text';
import { useAccent } from '@/hooks/useAccent';
import { useUIMode } from '@/hooks/useUIMode';
import { colors, spacing, tints } from '@/theme';
import type { HomeState, PlanStep } from '@/utils/homeState';

interface Props {
  state: HomeState;
  isAz: boolean;
  bot: string;
  childName: string;
  currentDay: number;
  theme: string | null;
  vocabulary: string[];
  steps: PlanStep[];
  petHue: number;
  generating: boolean;
  onStart: () => void;
  onStartQuiz: () => void;
  onTalk: () => void;
  onRegister: () => void;
  onPaywall: () => void;
  onRetry: () => void;
  onContinueOffline: () => void;
  onGeneratePlan: () => void;
}

const STEP_ICON: Record<PlanStep, IconName> = {
  words: 'sparkles',
  reading: 'book-open',
  grammar: 'lightbulb',
  listening: 'headphones',
  talk: 'message-circle',
  quiz: 'trophy',
};

function stepText(step: PlanStep, p: Props): { title: string; subtitle: string } {
  const az = p.isAz;
  switch (step) {
    case 'words': {
      const words = p.vocabulary.slice(0, 3).join(', ');
      const more = p.vocabulary.length > 3 ? ` +${p.vocabulary.length - 3}` : '';
      return { title: az ? 'Yeni sözlər' : 'Новые слова', subtitle: words ? `${words}${more}` : az ? 'Oyunla' : 'В игре' };
    }
    case 'reading':
      return { title: az ? 'Oxu' : 'Чтение', subtitle: az ? 'Qısa hekayə' : 'Короткая история' };
    case 'grammar':
      return { title: az ? 'Qrammatika' : 'Грамматика', subtitle: az ? 'Bir neçə tapşırıq' : 'Пара упражнений' };
    case 'listening':
      return { title: az ? 'Səsli hekayə' : 'История на слух', subtitle: az ? 'Dinlə və suallara cavab ver' : 'Послушай и ответь на вопросы' };
    case 'talk':
      return { title: az ? `${p.bot} ilə söhbət` : `Разговор с ${p.bot}`, subtitle: az ? 'Günün mövzusunda' : 'На тему дня' };
    case 'quiz':
      return { title: az ? 'Həftəlik test' : 'Недельный тест', subtitle: az ? 'Həftənin sözləri üzrə 7 sual' : '7 вопросов по словам недели' };
  }
}

export function HomeHero(p: Props) {
  const accent = useAccent();
  const kid = useUIMode() === 'kid';
  const az = p.isAz;
  const dayLabel = az ? `Günün dərsi · Gün ${p.currentDay}` : `Урок дня · День ${p.currentDay}`;

  if (p.state === 'lesson' || p.state === 'quiz' || p.state === 'done') {
    const done = p.state === 'done';
    const start = p.state === 'quiz' ? p.onStartQuiz : p.onStart;
    const title = done
      ? az ? 'Dərs tamamlandı!' : 'Урок выполнен!'
      : p.theme ?? (az ? 'Günün dərsi' : 'Урок дня');
    return (
      <Pressable onPress={done ? undefined : start} disabled={done} accessibilityRole={done ? undefined : 'button'}>
        <HBCard depth="deep" style={styles.card}>
          <View style={styles.headRow}>
            <View style={styles.headText}>
              <Text variant="label" tone="brand">{dayLabel}</Text>
              <Text variant="title" style={styles.title}>{title}</Text>
              {done && p.theme ? (
                <Text variant="caption" tone="secondary">{p.theme}</Text>
              ) : null}
            </View>
            {kid ? <HBPet size={64} hue={p.petHue} mood={done ? 'sleepy' : 'happy'} /> : null}
          </View>

          <View style={styles.steps}>
            {p.steps.map((step) => {
              const t = stepText(step, p);
              return (
                <View key={step} style={styles.stepRow}>
                  <HBIconBox
                    icon={done ? 'check' : STEP_ICON[step]}
                    tint={done ? tints.sage : accent.soft}
                    iconColor={done ? colors.accentDeep : accent.ink}
                    size={40}
                  />
                  <View style={styles.stepText}>
                    <Text variant="bodyBold" numberOfLines={1}>{t.title}</Text>
                    <Text variant="caption" tone="secondary" numberOfLines={1}>{t.subtitle}</Text>
                  </View>
                </View>
              );
            })}
          </View>

          {done ? (
            <HBButton full icon="message-circle" label={az ? `${p.bot} ilə danış` : `Поговорить с ${p.bot}`} onPress={p.onTalk} />
          ) : (
            <HBButton
              full
              icon="play"
              label={p.state === 'quiz' ? (az ? 'Testi başla' : 'Начать тест') : az ? 'Dərsə başla' : 'Начать урок'}
              onPress={start}
            />
          )}
        </HBCard>
      </Pressable>
    );
  }

  // Состояния, которые не дают начать урок, — та же карточка, короче.
  let icon: IconName = 'sparkles';
  let title = '';
  let body = '';
  let action: React.ReactNode = null;

  switch (p.state) {
    case 'register':
      icon = 'save';
      title = az ? 'Tərəqqini saxla' : 'Сохрани прогресс';
      body = az
        ? 'Birinci gün bitdi! Davam etmək üçün pulsuz hesab yarat — heç nə itməyəcək.'
        : 'Первый день пройден! Чтобы продолжить, создай бесплатный аккаунт — ничего не потеряется.';
      action = <HBButton full label={az ? 'Hesab yarat' : 'Создать аккаунт'} onPress={p.onRegister} />;
      break;
    case 'paywall':
      icon = 'crown';
      title = az ? 'Pulsuz günlər bitdi' : 'Бесплатные дни закончились';
      body = az ? 'Bütün planı açmaq üçün Premium lazımdır.' : 'Чтобы открыть весь план, нужен Premium.';
      action = <HBButton full variant="butter" label={az ? 'Premium-u aç' : 'Открыть Premium'} onPress={p.onPaywall} />;
      break;
    case 'preparing':
      icon = 'sparkles';
      title = az ? `${p.bot} dərsi hazırlayır…` : `${p.bot} готовит урок…`;
      body = az ? `${p.childName} üçün fərdi dərs — bir neçə saniyə.` : `Персональный урок для ${p.childName} — пара секунд.`;
      action = <ActivityIndicator color={accent.bottom} />;
      break;
    case 'error':
      icon = 'circle-alert';
      title = az ? 'Dərsi yükləmək alınmadı' : 'Не получилось загрузить урок';
      body = az ? 'İnterneti yoxla və yenidən cəhd et.' : 'Проверь интернет и попробуй ещё раз.';
      action = (
        <View style={styles.actions}>
          <HBButton full icon="refresh-cw" label={az ? 'Yenidən cəhd et' : 'Повторить'} onPress={p.onRetry} />
          <HBButton full variant="ghost" size="md" label={az ? 'Oflayn davam et' : 'Продолжить офлайн'} onPress={p.onContinueOffline} />
        </View>
      );
      break;
    case 'generating':
      icon = 'calendar';
      title = az ? 'Yeni həftənin planı' : 'План на новую неделю';
      body = az ? `${p.bot} ${p.childName} üçün növbəti həftəni qurur.` : `${p.bot} составит следующую неделю для ${p.childName}.`;
      action = p.generating ? (
        <ActivityIndicator color={accent.bottom} />
      ) : (
        <HBButton full icon="sparkles" label={az ? 'Planı qur' : 'Составить план'} onPress={p.onGeneratePlan} />
      );
      break;
  }

  return (
    <HBCard depth="deep" style={styles.card}>
      <View style={styles.headRow}>
        <HBIconBox icon={icon} tint={accent.soft} iconColor={accent.ink} size={48} />
        <View style={styles.headText}>
          <Text variant="label" tone="brand">{dayLabel}</Text>
          <Text variant="headline">{title}</Text>
        </View>
      </View>
      <Text variant="body" tone="secondary">{body}</Text>
      {action}
    </HBCard>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing[4] },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  headText: { flex: 1, minWidth: 0, gap: spacing[1] },
  title: { marginTop: spacing[0.5] },
  steps: { gap: spacing[2] },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  stepText: { flex: 1, minWidth: 0 },
  actions: { gap: spacing[1] },
});
