/**
 * InlineBanner — сообщение прямо на экране вместо системного `Alert.alert`.
 *
 * Системный диалог перекрывает всё, требует нажать «ОК» и в веб-превью вообще не
 * показывался (в react-native-web `Alert.alert` — пустышка). Ошибка разговора,
 * конец дневного лимита, нужное согласие — это состояние экрана, а не событие:
 * полоска остаётся, пока причина не ушла или ребёнок её не закрыл.
 */
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';

import { HBButton } from '@/components/HBButton';
import { Icon, type IconName } from '@/components/Icon';
import { Text } from '@/components/Text';
import { radius, spacing } from '@/theme';
import { byMode, makeModeStyles } from '@/theme/modeTokens';
import { useTheme } from '@/hooks/useTheme';

type Tone = 'info' | 'warning' | 'danger' | 'success';

const TONES_BY_MODE = byMode<Record<Tone, { bg: string; border: string; ink: string; icon: IconName }>>((t) => ({
  info: { bg: t.c.surface, border: t.c.surfaceBorder, ink: t.c.inkSoft, icon: 'circle-alert' },
  warning: { bg: t.c.warningSoft, border: t.c.warning, ink: t.c.goldDeep, icon: 'moon' },
  danger: { bg: t.c.errorSoft, border: t.c.error, ink: t.c.error, icon: 'circle-alert' },
  success: { bg: t.c.successSoft, border: t.c.success, ink: t.c.successDeep, icon: 'circle-check' },
}));

interface Props {
  tone?: Tone;
  icon?: IconName;
  title?: string;
  text: string;
  action?: { label: string; onPress: () => void };
  onClose?: () => void;
  closeLabel?: string;
  style?: StyleProp<ViewStyle>;
}

export function InlineBanner({ tone = 'info', icon, title, text, action, onClose, closeLabel, style }: Props) {
  const { c, mode: uiMode } = useTheme();
  const styles = stylesByMode[uiMode];
  const t = TONES_BY_MODE[uiMode][tone];
  return (
    <Animated.View
      entering={FadeInDown.duration(250)}
      exiting={FadeOut.duration(150)}
      accessibilityRole="alert"
      style={[styles.box, { backgroundColor: t.bg, borderColor: t.border }, style]}
    >
      <View style={styles.row}>
        <Icon name={icon ?? t.icon} size={20} color={t.ink} />
        <View style={styles.body}>
          {title ? (
            <Text variant="bodyBold" style={styles.title}>
              {title}
            </Text>
          ) : null}
          <Text variant="caption" style={styles.text}>
            {text}
          </Text>
        </View>
        {onClose ? (
          <Pressable
            onPress={onClose}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={closeLabel ?? 'Close'}
          >
            <Icon name="x" size={18} color={c.inkSoft} />
          </Pressable>
        ) : null}
      </View>
      {action ? (
        <HBButton size="sm" label={action.label} onPress={action.onPress} style={styles.action} />
      ) : null}
    </Animated.View>
  );
}

const stylesByMode = makeModeStyles((t) => StyleSheet.create({
  box: {
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    gap: spacing[2],
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2] },
  body: { flex: 1, minWidth: 0, gap: 1 },
  title: { color: t.c.ink },
  text: { color: t.c.ink },
  action: { alignSelf: 'flex-start' },
}));
