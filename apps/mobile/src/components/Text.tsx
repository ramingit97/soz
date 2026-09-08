import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';

import { colors, fontFamily, fontSize, lineHeight } from '@/theme';

type Variant = 'hero' | 'title' | 'headline' | 'subtitle' | 'body' | 'bodyBold' | 'caption' | 'label';
type Tone = 'primary' | 'secondary' | 'muted' | 'onDark' | 'bobo' | 'accent';

interface TextProps extends RNTextProps {
  variant?: Variant;
  tone?: Tone;
  align?: TextStyle['textAlign'];
}

const variantStyles: Record<Variant, TextStyle> = {
  hero: {
    fontFamily: fontFamily.display,
    fontSize: fontSize['5xl'],
    lineHeight: fontSize['5xl'] * lineHeight.tight,
    letterSpacing: -1,
  },
  title: {
    fontFamily: fontFamily.display,
    fontSize: fontSize['4xl'],
    lineHeight: fontSize['4xl'] * lineHeight.tight,
    letterSpacing: -0.5,
  },
  headline: {
    fontFamily: fontFamily.displaySemi,
    fontSize: fontSize['2xl'],
    lineHeight: fontSize['2xl'] * lineHeight.snug,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.lg,
    lineHeight: fontSize.lg * lineHeight.relaxed,
  },
  body: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.base,
    lineHeight: fontSize.base * lineHeight.relaxed,
  },
  bodyBold: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.base,
    lineHeight: fontSize.base * lineHeight.relaxed,
  },
  caption: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * lineHeight.normal,
  },
  label: {
    fontFamily: fontFamily.bodyBlack,
    fontSize: fontSize.xs,
    lineHeight: fontSize.xs * lineHeight.normal,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
};

const toneStyles: Record<Tone, { color: string }> = {
  primary: { color: colors.ink },
  secondary: { color: colors.inkSoft },
  muted: { color: colors.inkSoft },
  onDark: { color: colors.textOnDark },
  bobo: { color: colors.primary },
  accent: { color: colors.accentPink },
};

export function Text({
  variant = 'body',
  tone = 'primary',
  align,
  style,
  children,
  ...rest
}: TextProps) {
  // If a custom style overrides fontSize but not lineHeight, the variant's
  // lineHeight (from base 16px) clips emojis or large glyphs. Auto-extend
  // lineHeight so emoji-only Text doesn't get cropped.
  const flatStyle: TextStyle = Array.isArray(style)
    ? Object.assign({}, ...style.filter(Boolean) as TextStyle[])
    : (style as TextStyle | undefined) ?? {};
  const variantSize = (variantStyles[variant].fontSize ?? 16) as number;
  const overrideSize = flatStyle.fontSize as number | undefined;
  const overrideLineHeight = flatStyle.lineHeight as number | undefined;

  const autoLineHeight =
    overrideSize !== undefined && overrideSize > variantSize && overrideLineHeight === undefined
      ? { lineHeight: overrideSize * 1.25 }
      : null;

  return (
    <RNText
      {...rest}
      style={[
        variantStyles[variant],
        toneStyles[tone],
        align ? { textAlign: align } : null,
        style,
        autoLineHeight,
      ]}
    >
      {children}
    </RNText>
  );
}
