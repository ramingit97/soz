import { Component, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import * as Sentry from '@sentry/react-native';

import { Text } from '@/components/Text';
import { useSettings } from '@/store/settings';
import { colors, fontFamily, fontSize, radius, spacing } from '@/theme';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    console.warn('[ErrorBoundary]', error, info.componentStack);
    // Forward to Sentry — no-op if not configured
    Sentry.captureException(error, {
      contexts: { react: { componentStack: info.componentStack ?? '' } },
    });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      // Без маскота и анимаций: если упал сам рисунок персонажа, экран ошибки
      // не должен падать вместе с ним. Язык — из стора напрямую (класс без хуков).
      const az = useSettings.getState().parentUILanguage === 'az';
      return (
        <View style={styles.root}>
          <Text style={styles.title}>{az ? 'Nəsə alınmadı' : 'Что-то пошло не так'}</Text>
          <Text style={styles.subtitle}>
            {az ? 'Ekranı yeniləməyə çalışın.' : 'Попробуйте обновить экран.'}
          </Text>
          {__DEV__ && this.state.error && <Text style={styles.devError}>{this.state.error.message}</Text>}
          <Pressable onPress={this.handleReset} style={styles.btn} accessibilityRole="button">
            <Text style={styles.btnText}>{az ? 'Yenidən cəhd et' : 'Попробовать снова'}</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[6],
    gap: spacing[3],
  },
  title: {
    fontFamily: fontFamily.display,
    fontSize: fontSize['2xl'],
    color: colors.ink,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.base,
    color: colors.inkSoft,
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 22,
  },
  devError: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    color: colors.error,
    textAlign: 'center',
    backgroundColor: '#FFF0F0',
    padding: spacing[3],
    borderRadius: radius.md,
    maxWidth: 320,
  },
  btn: {
    marginTop: spacing[4],
    backgroundColor: colors.primary,
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[3],
    borderRadius: radius.full,
  },
  btnText: {
    color: colors.white,
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.base,
  },
});
