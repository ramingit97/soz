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
import Svg, { Circle, Path } from 'react-native-svg';

import { Text } from '@/components/Text';
import { useSettings } from '@/store/settings';
import { colors, fontFamily, fontSize, radius, scaleFont, shadow, spacing } from '@/theme';

type TabKey = 'home' | 'talk' | 'progress' | 'profile';

interface Tab {
  key: TabKey;
  route: string;
  labelRu: string;
  labelAz: string;
}

const TABS: Tab[] = [
  { key: 'home',     route: '/home',     labelRu: 'Учиться',  labelAz: 'Öyrən' },
  { key: 'talk',     route: '/talk',     labelRu: 'Говорить', labelAz: 'Danış' },
  { key: 'progress', route: '/progress', labelRu: 'Прогресс', labelAz: 'Tərəqqi' },
  { key: 'profile',  route: '/profile',  labelRu: 'Профиль',  labelAz: 'Profil' },
];

/** Custom duotone nav icons — soft filled shape + rounded stroke (MicIcon family). */
function TabIcon({ name, color, size }: { name: TabKey; color: string; size: number }) {
  const sw = 2;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {name === 'home' && (
        <Path
          d="M4 11.5 12 4l8 7.5V19a1 1 0 0 1-1 1h-4v-5h-6v5H5a1 1 0 0 1-1-1z"
          fill={color}
          fillOpacity={0.18}
          stroke={color}
          strokeWidth={sw}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}
      {name === 'talk' && (
        <Path
          d="M4 5h16a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H9l-4 4v-4H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"
          fill={color}
          fillOpacity={0.18}
          stroke={color}
          strokeWidth={sw}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}
      {name === 'progress' && (
        <Path
          d="M5 13v6M12 8v11M19 4v15"
          stroke={color}
          strokeWidth={sw}
          strokeLinecap="round"
        />
      )}
      {name === 'profile' && (
        <>
          <Circle cx="12" cy="8" r="4" fill={color} fillOpacity={0.18} stroke={color} strokeWidth={sw} />
          <Path
            d="M4.5 20a7.5 7.5 0 0 1 15 0"
            fill={color}
            fillOpacity={0.18}
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}
    </Svg>
  );
}

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
    <Pressable style={styles.tab} onPress={handlePress} hitSlop={6}>
      <Animated.View style={[styles.tabInner, animStyle]}>
        <View style={[styles.iconWrap, active && styles.iconWrapActive]}>
          <TabIcon
            name={tab.key}
            color={active ? colors.primary : colors.inkSoft}
            size={active ? 24 : 22}
          />
        </View>
        <Text style={[styles.label, active && styles.labelActive]}>
          {isAz ? tab.labelAz : tab.labelRu}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

export function BottomTabs() {
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

const styles = StyleSheet.create({
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
    backgroundColor: colors.white,
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
  iconWrapActive: {
    backgroundColor: colors.primarySoft,
  },
  icon: {
    fontSize: fontSize.xl,
    opacity: 0.5,
  },
  iconActive: {
    fontSize: scaleFont(22),
    opacity: 1,
  },
  label: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize['3xs'],
    color: colors.inkSoft,
    letterSpacing: 0.2,
  },
  labelActive: {
    fontFamily: fontFamily.bodyBold,
    color: colors.primary,
  },
});

/** Spacer to add below scroll content so it doesn't get hidden behind the tab bar. */
export function BottomTabsSpacer() {
  return <View style={{ height: TAB_HEIGHT + BOTTOM_INSET + spacing[4] }} />;
}
