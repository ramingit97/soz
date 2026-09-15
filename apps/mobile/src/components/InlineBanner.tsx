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
import { colors, radius, semantic, spacing } from '@/theme';

type Tone = 'info' | 'warning' | 'danger' | 'success';

const TONES: Record<Tone, { bg: string; border: string; ink: string; icon: IconName }> = {
  info: { bg: colors.surface, border: colors.surfaceBorder, ink: colors.inkSoft, icon: 'circle-alert' },
  warning: { bg: '#FFF6D6', border: '#F0DC92', ink: '#7F6628', icon: 'moon' },
  danger: { bg: '#FDECEF', border: '#F5C2CC', ink: semantic.danger, icon: 'circle-alert' },
  success: { bg: '#E6F6F0', border: '#B9E3D5', ink: colors.accentDeep, icon: 'circle-check' },
};

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
  const t = TONES[tone];
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
            <Icon name="x" size={18} color={colors.inkSoft} />
          </Pressable>
        ) : null}
      </View>
      {action ? (
        <HBButton size="sm" label={action.label} onPress={action.onPress} style={styles.action} />
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    gap: spacing[2],
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2] },
  body: { flex: 1, minWidth: 0, gap: 1 },
  title: { color: colors.ink },
  text: { color: colors.ink },
  action: { alignSelf: 'flex-start' },
});
