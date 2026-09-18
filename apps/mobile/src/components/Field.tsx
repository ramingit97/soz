/**
 * Field — поле ввода с подписью: 52 dp, белое, рамка 1,5 dp, при фокусе рамка в
 * цвете питомца. Визуально не кнопка. Одно на вход, регистрацию и восстановление
 * пароля — раньше у каждого экрана был свой кремовый вариант.
 */
import { forwardRef, useState, type ReactNode } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { Text } from '@/components/Text';
import { useAccent } from '@/hooks/useAccent';
import { colors, fontFamily, fontSize, radius, spacing } from '@/theme';

interface Props extends TextInputProps {
  label: string;
  /** Справа от подписи — «Забыли?» и т. п. */
  labelRight?: ReactNode;
}

export const Field = forwardRef<TextInput, Props>(function Field({ label, labelRight, style, onFocus, onBlur, ...rest }, ref) {
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
        placeholderTextColor={colors.textMuted}
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
        style={[styles.input, { borderColor: focused ? accent.bottom : colors.surfaceBorder }, style]}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: spacing[1] },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { color: colors.ink, fontSize: fontSize.sm },
  input: {
    minHeight: 52,
    borderWidth: 1.5,
    borderRadius: radius.lg,
    paddingHorizontal: spacing[4],
    backgroundColor: colors.surface,
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.base,
    color: colors.ink,
  },
});
