import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';

import { useAccent } from '@/hooks/useAccent';
import { useUIMode } from '@/hooks/useUIMode';
import { colors, fontFamily, fontSize, lineHeight, semantic } from '@/theme';
import { makeModeStyles } from '@/theme/modeTokens';

type Variant = 'hero' | 'title' | 'headline' | 'subtitle' | 'body' | 'bodyBold' | 'caption' | 'label';
type Tone =
  | 'primary'
  | 'secondary'
  | 'muted'
  | 'onDark'
  | 'brand'
  | 'danger'
  | 'success'
  /** Текст на заливке акцентом (белый, на «масле» тёмный). */
  | 'onAccent'
  /** @deprecated светлый персик, контраст на креме 2.3 — используйте `brand`. */
  | 'bobo'
  | 'accent';

interface TextProps extends RNTextProps {
  variant?: Variant;
  tone?: Tone;
  align?: TextStyle['textAlign'];
}

type DisplayVariant = 'hero' | 'title' | 'headline';

/**
 * Заголовки зависят от режима: kid — Nunito Black крупнее, teen — Onest мельче.
 * Размеры меньше прежних (title был 4xl): на 320 dp заголовок из четырёх слов
 * разваливался на четыре строки.
 */
const displayStyles = makeModeStyles((t): Record<DisplayVariant, TextStyle> => ({
  hero: {
    fontFamily: t.font.display,
    fontSize: t.heading.hero,
    lineHeight: Math.round(t.heading.hero * lineHeight.tight),
    letterSpacing: -0.5,
  },
  title: {
    fontFamily: t.font.display,
    fontSize: t.heading.title,
    lineHeight: Math.round(t.heading.title * lineHeight.snug),
    letterSpacing: -0.3,
  },
  headline: {
    fontFamily: t.font.displaySemi,
    fontSize: t.heading.headline,
    lineHeight: Math.round(t.heading.headline * lineHeight.snug),
    letterSpacing: -0.2,
  },
}));

const textStyles: Record<Exclude<Variant, DisplayVariant>, TextStyle> = {
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

const toneColors: Record<Exclude<Tone, 'onAccent'>, string> = {
  primary: colors.ink,
  secondary: colors.inkSoft,
  muted: colors.inkSoft,
  onDark: colors.textOnDark,
  brand: colors.primaryDeep,
  danger: semantic.danger,
  success: colors.accentDeep,
  bobo: colors.primary,
  accent: colors.accentPink,
};

function isDisplay(v: Variant): v is DisplayVariant {
  return v === 'hero' || v === 'title' || v === 'headline';
}

export function Text({
  variant = 'body',
  tone = 'primary',
  align,
  style,
  children,
  ...rest
}: TextProps) {
  const mode = useUIMode();
  const accent = useAccent();
  const variantStyle = isDisplay(variant) ? displayStyles[mode][variant] : textStyles[variant];

  // If a custom style overrides fontSize but not lineHeight, the variant's
  // lineHeight (from base 16px) clips emojis or large glyphs. Auto-extend
  // lineHeight so emoji-only Text doesn't get cropped.
  const flatStyle: TextStyle = Array.isArray(style)
    ? Object.assign({}, ...style.filter(Boolean) as TextStyle[])
    : (style as TextStyle | undefined) ?? {};
  const variantSize = (variantStyle.fontSize ?? 16) as number;
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
        variantStyle,
        { color: tone === 'onAccent' ? accent.text : toneColors[tone] },
        align ? { textAlign: align } : null,
        style,
        autoLineHeight,
      ]}
    >
      {children}
    </RNText>
  );
}
