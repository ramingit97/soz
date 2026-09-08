/**
 * Screen — Honeybear page wrapper.
 *
 * Cream base with optional honey gradient and accent blobs. Decoration variants
 * map to the design palette: "bobo" → peach + sage, "sunrise" → butter + berry.
 *
 * Keeps original props (scroll, gradient, contentStyle, decoration) so existing
 * callsites work unchanged.
 */

import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { type ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing } from '@/theme';

interface ScreenProps {
  children: ReactNode;
  scroll?: boolean;
  gradient?: boolean;
  contentStyle?: ViewStyle;
  decoration?: 'bobo' | 'sunrise' | 'none';
}

export function Screen({
  children,
  scroll = false,
  gradient = false,
  contentStyle,
  decoration = 'none',
}: ScreenProps) {
  const Container = scroll ? ScrollView : View;

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      {gradient ? (
        <LinearGradient
          colors={['#FCE9CC', colors.bg, colors.bgDeep]}
          locations={[0, 0.55, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}

      {decoration === 'bobo' ? (
        <>
          <View style={[styles.blob, styles.blobTop, { backgroundColor: colors.primarySoft }]} />
          <View style={[styles.blob, styles.blobBottom, { backgroundColor: '#DDF1EA' }]} />
        </>
      ) : null}
      {decoration === 'sunrise' ? (
        <>
          <View
            style={[
              styles.blob,
              styles.blobTop,
              { backgroundColor: colors.butter, opacity: 0.35 },
            ]}
          />
          <View
            style={[
              styles.blob,
              styles.blobBottom,
              { backgroundColor: '#FFE3E8', opacity: 0.6 },
            ]}
          />
        </>
      ) : null}

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <Container
          style={scroll ? undefined : styles.container}
          contentContainerStyle={
            scroll ? [styles.scrollContent, contentStyle] : contentStyle
          }
          showsVerticalScrollIndicator={false}
        >
          {children}
        </Container>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  safe: { flex: 1 },
  container: {
    flex: 1,
    paddingHorizontal: spacing[6],
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing[6],
    paddingBottom: spacing[12],
  },
  blob: {
    position: 'absolute',
    width: 360,
    height: 360,
    borderRadius: 360,
    opacity: 0.55,
  },
  blobTop: { top: -160, right: -120 },
  blobBottom: { bottom: -180, left: -140 },
});
