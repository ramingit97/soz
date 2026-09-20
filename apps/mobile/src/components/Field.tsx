/**
 * Field — поле ввода с подписью: 52 dp, белое, рамка 1,5 dp, при фокусе рамка в
 * цвете питомца. Визуально не кнопка. Одно на вход, регистрацию и восстановление
 * пароля — раньше у каждого экрана был свой кремовый вариант.
 */
import { forwardRef, useState, type ReactNode } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { Text } from '@/components/Text';
import { useAccent } from '@/hooks/useAccent';
import { useTheme } from '@/hooks/useTheme';
import { fontFamily, fontSize, radius, spacing } from '@/theme';
import { makeModeStyles } from '@/theme/modeTokens';

interface Props extends TextInputProps {
  label: string;
  /** Справа от подписи — «Забыли?» и т. п. */
  labelRight?: ReactNode;
}

export const Field = forwardRef<TextInput, Props>(function Field({ label, labelRight, style, onFocus, onBlur, ...rest }, ref) {
  const { c, mode: uiMode } = useTheme();
  const styles = stylesByMode[uiMode];
  const accent = useAccent();
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <Text variant="bodyBold" style={styles.label}>
          {label}
        </Text>
        {labelRight}
      </View>
      <TextInput
        ref={ref}
        placeholderTextColor={c.textMuted}
        accessibilityLabel={label}
        {...rest}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[styles.input, { borderColor: focused ? accent.bottom : c.surfaceBorder }, style]}
      />
    </View>
  );
});

const stylesByMode = makeModeStyles((t) => StyleSheet.create({
  wrap: { gap: spacing[1] },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { color: t.c.ink, fontSize: fontSize.sm },
  input: {
    minHeight: 52,
    borderWidth: 1.5,
    borderRadius: radius.lg,
    paddingHorizontal: spacing[4],
    backgroundColor: t.c.surface,
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.base,
    color: t.c.ink,
  },
}));
