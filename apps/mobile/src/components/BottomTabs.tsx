/**
 * Persistent bottom navigation — the primary way to move between core sections.
 *
 * 4 destinations:
 *   • Учиться (home) — today's lesson + progress
 *   • Говорить (talk) — free conversation with Bobo
 *   • Прогресс (progress) — vocab collection, achievements, streak
 *   • Профиль (profile) — settings, parent area, account
 *
 * Used by all "core" screens. Hidden inside lesson flows.
 */

import * as Haptics from 'expo-haptics';
import { useRouter, usePathname } from 'expo-router';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { Icon, type IconName } from '@/components/Icon';
import { Text } from '@/components/Text';
import { useAccent } from '@/hooks/useAccent';
import { useUIMode } from '@/hooks/useUIMode';
import { useSettings } from '@/store/settings';
import { fontFamily, fontSize, radius, shadow, spacing } from '@/theme';
import { makeModeStyles } from '@/theme/modeTokens';
import { useTheme } from '@/hooks/useTheme';

type TabKey = 'home' | 'talk' | 'progress' | 'profile';

interface Tab {
  key: TabKey;
  icon: IconName;
  route: string;
  labelRu: string;
  labelAz: string;
}

const TABS: Tab[] = [
  { key: 'home',     icon: 'house',          route: '/home',     labelRu: 'Учиться',  labelAz: 'Öyrən' },
  { key: 'talk',     icon: 'message-circle', route: '/talk',     labelRu: 'Говорить', labelAz: 'Danış' },
  { key: 'progress', icon: 'chart-column',   route: '/progress', labelRu: 'Прогресс', labelAz: 'Tərəqqi' },
  { key: 'profile',  icon: 'user',           route: '/profile',  labelRu: 'Профиль',  labelAz: 'Profil' },
];

function TabButton({
  tab,
  active,
  onPress,
  isAz,
}: {
  tab: Tab;
  active: boolean;
  onPress: () => void;
  isAz: boolean;
}) {
  const { c, mode: uiMode } = useTheme();
  const styles = stylesByMode[uiMode];
  const accent = useAccent();
  const mode = useUIMode();
  const scale = useSharedValue(1);
  const lift = useSharedValue(0);

  const handlePress = () => {
    scale.value = withSpring(0.9, { damping: 12 }, () => {
      scale.value = withSpring(1, { damping: 12 });
    });
    lift.value = withSpring(active ? 0 : -4, { damping: 14 });
    onPress();
  };

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateY: lift.value }],
  }));

  return (
    <Pressable
      style={styles.tab}
      onPress={handlePress}
      hitSlop={6}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
    >
      <Animated.View style={[styles.tabInner, animStyle]}>
        {/* Активная вкладка в цвет питомца. У малышей — заливка-пилюля под
            иконкой, у старших только цвет: пилюля читается как детская. */}
        <View style={[styles.iconWrap, active && mode === 'kid' && { backgroundColor: accent.soft }]}>
          <Icon
            name={tab.icon}
            color={active ? accent.ink : c.inkSoft}
            size={active ? 24 : 22}
          />
        </View>
        <Text style={[styles.label, active && styles.labelActive, active && { color: accent.ink }]}>
          {isAz ? tab.labelAz : tab.labelRu}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

export function BottomTabs() {
  const { mode: uiMode } = useTheme();
  const styles = stylesByMode[uiMode];
  const router = useRouter();
  const pathname = usePathname();
  const lang = useSettings((s) => s.parentUILanguage) ?? 'ru';
  const isAz = lang === 'az';
  const learningLanguages = useSettings((s) => s.learningLanguages);
  const currentDay = useSettings((s) => s.currentDay);

  const activeKey: TabKey = (() => {
    if (pathname.startsWith('/talk')) return 'talk';
    if (pathname.startsWith('/progress')) return 'progress';
    if (pathname.startsWith('/profile')) return 'profile';
    return 'home';
  })();

  const navigate = (tab: Tab) => {
    if (tab.key === activeKey) return;
    Haptics.selectionAsync().catch(() => {});

    // Talk needs lang + day params
    if (tab.key === 'talk') {
      const lang = learningLanguages[0] ?? 'en';
      router.push(`/talk?lang=${lang}&day=${currentDay}` as any);
      return;
    }
    router.push(tab.route as any);
  };

  return (
    <View style={styles.container} pointerEvents="box-none">
      <View style={[styles.bar, shadow.lg]}>
        {TABS.map((tab) => (
          <TabButton
            key={tab.key}
            tab={tab}
            active={activeKey === tab.key}
            onPress={() => navigate(tab)}
            isAz={isAz}
          />
        ))}
      </View>
    </View>
  );
}

const TAB_HEIGHT = 68;
const BOTTOM_INSET = Platform.OS === 'ios' ? 24 : 12;

const stylesByMode = makeModeStyles((t) => StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing[4],
    paddingBottom: BOTTOM_INSET,
    paddingTop: spacing[2],
  },
  bar: {
    flexDirection: 'row',
    backgroundColor: t.c.surface,
    borderWidth: 1,
    borderColor: t.c.surfaceBorder,
    borderRadius: radius['2xl'],
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[1],
    minHeight: TAB_HEIGHT,
    alignItems: 'center',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[1],
  },
  tabInner: {
    alignItems: 'center',
    gap: 2,
  },
  iconWrap: {
    width: 40,
    height: 32,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  label: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize['3xs'],
    color: t.c.inkSoft,
    letterSpacing: 0.2,
  },
  labelActive: {
    fontFamily: fontFamily.bodyBold,
  },
}));

/** Spacer to add below scroll content so it doesn't get hidden behind the tab bar. */
export function BottomTabsSpacer() {
  return <View style={{ height: TAB_HEIGHT + BOTTOM_INSET + spacing[4] }} />;
}
