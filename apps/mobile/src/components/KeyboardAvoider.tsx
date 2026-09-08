/**
 * KeyboardAvoider — the canonical fix for "input hidden behind the keyboard".
 *
 * Wraps form content in a ScrollView so the focused field can always scroll
 * into view, taps outside still register (keyboardShouldPersistTaps), and a
 * fixed CTA passed via `footer` stays pinned below the scroll — above the
 * keyboard.
 *
 * Why not RN's KeyboardAvoidingView: it reads its own position from onLayout,
 * which is PARENT-relative — inside a SafeAreaView (our `Screen`) that
 * under-counts by the top inset (~59px on Dynamic-Island iPhones) and the
 * footer ends up half-hidden behind the keyboard. Instead we measure our own
 * bottom edge in WINDOW coordinates (measureInWindow) and pad by the exact
 * overlap with the keyboard frame from keyboardWillChangeFrame. Deterministic
 * for any callsite nesting. Android keeps the platform adjustResize behavior.
 */

import { useEffect, useRef, type ReactNode } from 'react';
import {
  Keyboard,
  Platform,
  ScrollView,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

interface KeyboardAvoiderProps {
  children: ReactNode;
  /** Pinned below the scroll area (e.g. a Continue button). */
  footer?: ReactNode;
  /** Vertically center content when it fits (good for hero-style screens). */
  center?: boolean;
  contentContainerStyle?: StyleProp<ViewStyle>;
}

export function KeyboardAvoider({
  children,
  footer,
  center = false,
  contentContainerStyle,
}: KeyboardAvoiderProps) {
  const rootRef = useRef<View>(null);
  const overlap = useSharedValue(0);

  useEffect(() => {
    if (Platform.OS !== 'ios') return; // Android: windowSoftInputMode adjustResize
    const sub = Keyboard.addListener('keyboardWillChangeFrame', (e) => {
      const kbTop = e.endCoordinates.screenY; // window coords; = screen height when hidden
      const duration = e.duration && e.duration > 10 ? e.duration : 250;
      // Padding doesn't change our OUTER frame, so re-measuring stays stable
      // across repeated keyboard frame changes (predictive bar on/off etc.).
      rootRef.current?.measureInWindow((_x, y, _w, h) => {
        overlap.value = withTiming(Math.max(0, y + h - kbTop), { duration });
      });
    });
    return () => sub.remove();
  }, [overlap]);

  const padStyle = useAnimatedStyle(() => ({ paddingBottom: overlap.value }));

  return (
    <Animated.View ref={rootRef} style={[styles.flex, padStyle]}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[
          styles.content,
          center && styles.centered,
          contentContainerStyle,
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
      {footer ? <View>{footer}</View> : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flexGrow: 1 },
  centered: { justifyContent: 'center' },
});
