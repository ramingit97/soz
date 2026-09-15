/**
 * ScreenHeader — верхняя строка второстепенного экрана: «назад», заголовок слева,
 * место справа.
 *
 * Отступ сверху — от безопасной зоны телефона (`safeTop`), а не числом: экраны
 * держали `paddingTop: 50…90`, и на телефоне с высокой строкой состояния
 * заголовок уезжал под часы, а на низком — висел с пустотой над собой.
 *
 * Прежний `HBScreenHeader` (ни одного использования, центрированный заголовок)
 * заменён этим.
 */
import { type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HBBackButton } from '@/components/HBBackButton';
import { type IconName } from '@/components/Icon';
import { Text } from '@/components/Text';
import { useTheme } from '@/hooks/useTheme';
import { spacing } from '@/theme';

interface Props {
  title?: string;
  subtitle?: string;
  /** Вместо заголовка — своё содержимое (аватар персонажа со статусом и т. п.). */
  center?: ReactNode;
  /** Скрыть «назад» (корневой экран вкладки). */
  hideBack?: boolean;
  /** По умолчанию `router.back()`. */
  onBack?: () => void;
  /** `x` — выйти без результата (урок), по умолчанию шеврон. */
  backIcon?: IconName;
  backLabel?: string;
  right?: ReactNode;
  /** Добавить сверху высоту строки состояния. Выключать, если фон экрана уже её учёл. */
  safeTop?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function ScreenHeader({
  title,
  subtitle,
  center,
  hideBack,
  onBack,
  backIcon,
  backLabel,
  right,
  safeTop = true,
  style,
}: Props) {
  const insets = useSafeAreaInsets();
  const { t } = useTheme();
  return (
    <View
      style={[
        styles.row,
        { paddingTop: (safeTop ? insets.top : 0) + spacing[2], paddingHorizontal: t.density.padX },
        style,
      ]}
    >
      {hideBack ? null : (
        <HBBackButton inline onPress={onBack} icon={backIcon} accessibilityLabel={backLabel} />
      )}
      <View style={styles.center}>
        {center ?? (
          <>
            {title ? (
              <Text variant="headline" numberOfLines={1}>
                {title}
              </Text>
            ) : null}
            {subtitle ? (
              <Text variant="caption" tone="secondary" numberOfLines={2}>
                {subtitle}
              </Text>
            ) : null}
          </>
        )}
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingBottom: spacing[2],
    minHeight: 44,
  },
  center: { flex: 1, minWidth: 0, gap: 1 },
  right: { alignItems: 'flex-end', justifyContent: 'center' },
});
