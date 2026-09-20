/**
 * LessonHeader — шапка шага урока: «×», название шага и полоса «шаг N из M».
 *
 * До редизайна у каждого экрана урока были свои точки прогресса, своя кнопка
 * выхода (или никакой — в игре со словами выйти было нельзя) и свой цвет пилюли
 * с эмодзи. Здесь одно на всех, с отступом от безопасной зоны.
 *
 * «×» уводит на главный, а не «назад»: назад из грамматики вело в игру со
 * словами, которую ребёнок уже прошёл. Пройденные шаги сохраняются
 * (`markLessonStep`), и урок продолжится с того же места.
 */
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/Icon';
import { Text } from '@/components/Text';
import { useTheme } from '@/hooks/useTheme';
import { useSettings } from '@/store/settings';
import { radius, shadow, spacing } from '@/theme';
import { makeModeStyles } from '@/theme/modeTokens';

interface Props {
  title: string;
  icon?: IconName;
  /** Текущий шаг, с единицы. */
  step: number;
  total: number;
  /** Место справа: «Дальше», счёт звёзд. */
  right?: ReactNode;
  /** По умолчанию — на главный. */
  onClose?: () => void;
}

export function LessonHeader({ title, icon, step, total, right, onClose }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { c, mode: uiMode, t, accent } = useTheme();
  const styles = stylesByMode[uiMode];
  const az = useSettings((s) => s.parentUILanguage) === 'az';
  const safeTotal = Math.max(1, total);
  const current = Math.min(Math.max(1, step), safeTotal);
  // Сегменты читаются лучше полосы, пока их немного; дальше — сплошная полоса.
  const segmented = safeTotal <= 8;

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing[2], paddingHorizontal: t.density.padX }]}>
      <View style={styles.row}>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            if (onClose) onClose();
            else router.replace('/home');
          }}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={az ? 'Dərsdən çıx' : 'Выйти из урока'}
          style={({ pressed }) => [styles.close, shadow.sm, pressed && styles.pressed]}
        >
          <Icon name="x" size={20} color={c.ink} strokeWidth={2.5} />
        </Pressable>

        <View style={styles.center}>
          <View style={styles.titleRow}>
            {icon ? <Icon name={icon} size={16} color={accent.ink} strokeWidth={2.5} /> : null}
            <Text variant="bodyBold" numberOfLines={1} style={styles.title}>
              {title}
            </Text>
            {/* «2/5», а не «2 из 5»: на 320 dp длинный счётчик переносился в две строки. */}
            <Text variant="caption" tone="secondary" numberOfLines={1} style={styles.count}>
              {`${current}/${safeTotal}`}
            </Text>
          </View>
          <View
            style={styles.track}
            accessibilityRole="progressbar"
            accessibilityLabel={az ? `Addım ${current} / ${safeTotal}` : `Шаг ${current} из ${safeTotal}`}
            accessibilityValue={{ min: 0, max: safeTotal, now: current }}
          >
            {segmented ? (
              Array.from({ length: safeTotal }, (_, i) => (
                <View
                  key={i}
                  style={[
                    styles.segment,
                    { backgroundColor: i < current ? accent.bottom : c.bgDeep },
                  ]}
                />
              ))
            ) : (
              <View style={styles.bar}>
                <View
                  style={[styles.barFill, { width: `${(current / safeTotal) * 100}%`, backgroundColor: accent.bottom }]}
                />
              </View>
            )}
          </View>
        </View>

        {right ? <View style={styles.right}>{right}</View> : null}
      </View>
    </View>
  );
}

const stylesByMode = makeModeStyles((t) => StyleSheet.create({
  root: { paddingBottom: spacing[2] },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  close: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: t.c.surface,
    borderWidth: 1,
    borderColor: t.c.surfaceBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { transform: [{ scale: 0.92 }] },
  center: { flex: 1, minWidth: 0, gap: 6 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  title: { flexShrink: 1, color: t.c.ink },
  count: { marginLeft: 'auto', flexShrink: 0, paddingLeft: spacing[1] },
  track: { flexDirection: 'row', gap: 4, height: 6 },
  segment: { flex: 1, borderRadius: 3 },
  bar: { flex: 1, borderRadius: 3, backgroundColor: t.c.bgDeep, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },
  right: { alignItems: 'flex-end', justifyContent: 'center' },
}));
