/**
 * Плашка с ответом внизу экрана урока — общая для слов и грамматики.
 *
 * У детей (макет C) это зелёный лист с кромкой килима и Бобо, который
 * выглядывает из-за края: верный ответ должен ощущаться как маленький праздник.
 * У взрослых (макет D) — спокойная полоса: мятная галочка, «Верно» и правило
 * одной строкой.
 *
 * Плашка только показывает результат. Переход к следующему заданию остаётся на
 * экране урока (там он по таймеру), чтобы не разъезжалась логика начисления.
 */
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';

import { HBPet } from '../HBPet';
import { Icon } from '../Icon';
import { KilimTrim } from '../scene/KilimTrim';
import { Text } from '../Text';
import { useTheme } from '@/hooks/useTheme';
import { spacing } from '@/theme';
import { makeModeStyles } from '@/theme/modeTokens';

interface Props {
  tone: 'correct' | 'wrong' | 'reveal';
  /** Крупная строка: «Верно!», «Попробуй ещё». */
  title: string;
  /** Пояснение: перевод слова или правило. */
  subtitle?: string | null;
}

export function AnswerSheet({ tone, title, subtitle }: Props) {
  const { c, mode: uiMode } = useTheme();
  const styles = stylesByMode[uiMode];
  const kid = uiMode === 'kid';
  const good = tone === 'correct';

  const bg = good ? c.success : tone === 'reveal' ? c.warning : c.error;

  if (kid) {
    return (
      <Animated.View
        entering={FadeInDown.duration(220)}
        exiting={FadeOut.duration(140)}
        style={[styles.sheet, { backgroundColor: bg }]}
      >
        {good ? (
          <View style={styles.trim}>
            <KilimTrim />
          </View>
        ) : null}
        <View style={styles.pet} pointerEvents="none">
          <HBPet size={72} mood={good ? 'happy' : 'sad'} still />
        </View>
        <Text variant="title" style={styles.kidTitle}>{title}</Text>
        {subtitle ? (
          <Text variant="body" style={styles.kidSub} numberOfLines={2}>{subtitle}</Text>
        ) : null}
      </Animated.View>
    );
  }

  return (
    <Animated.View
      entering={FadeInDown.duration(200)}
      exiting={FadeOut.duration(120)}
      style={[styles.sheet, { backgroundColor: c.surface, borderTopColor: c.surfaceBorder }]}
    >
      <View style={styles.teenRow}>
        <View style={[styles.mark, { backgroundColor: bg }]}>
          <Icon name={good ? 'check' : 'x'} size={15} color={c.bg} strokeWidth={3} />
        </View>
        <Text variant="bodyBold">{title}</Text>
      </View>
      {subtitle ? (
        <Text variant="body" tone="secondary" numberOfLines={2} style={styles.teenSub}>{subtitle}</Text>
      ) : null}
    </Animated.View>
  );
}

const stylesByMode = makeModeStyles((t) => StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: t.mode === 'kid' ? spacing[6] : spacing[4],
    paddingBottom: t.mode === 'kid' ? spacing[6] : spacing[5],
    paddingHorizontal: t.density.padX,
    borderTopLeftRadius: t.mode === 'kid' ? 30 : 24,
    borderTopRightRadius: t.mode === 'kid' ? 30 : 24,
    borderTopWidth: t.mode === 'kid' ? 0 : 1,
    gap: spacing[1],
  },
  trim: { position: 'absolute', left: 0, right: 0, top: 0, overflow: 'hidden' },
  // Бобо выглядывает из-за правого края плашки.
  pet: { position: 'absolute', right: spacing[4], top: -42 },
  kidTitle: { color: t.c.white },
  kidSub: { color: t.c.white, opacity: 0.95 },
  teenRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  mark: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  teenSub: { marginLeft: 32 },
}));
