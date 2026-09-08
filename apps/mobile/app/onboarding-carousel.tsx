/**
 * Honeybear · First-launch onboarding carousel (4 slides).
 *
 * 1. "Привет, я Хани" — pet portrait with butter halo + sparkles
 * 2. "Игры и истории" — 6 floating icons orbiting around Хани
 * 3. "Питомец растёт вместе с тобой" — 3 sizes left → right + crown
 * 4. "Родитель рядом" — parent dashboard preview + parent avatar
 */

import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

import { HBButton } from '@/components/HBButton';
import { HBPet } from '@/components/HBPet';
import { PaperBackground } from '@/components/PaperBackground';
import { Text } from '@/components/Text';
import { useSettings } from '@/store/settings';
import { colors, fontFamily, fontSize, radius, shadow, spacing } from '@/theme';

const { width: SW } = Dimensions.get('window');

function Crown({ size = 56 }: { size?: number }) {
  return (
    <Svg width={size} height={size * 0.5} viewBox="0 0 62 32">
      <Path
        d="M 6 26 L 8 8 L 18 18 L 31 4 L 44 18 L 54 8 L 56 26 Z"
        fill={colors.butter}
        stroke={colors.ink}
        strokeWidth={1.2}
        strokeLinejoin="round"
      />
      <Circle cx="31" cy="14" r="3" fill={colors.berry} />
    </Svg>
  );
}

const SLIDES = [
  {
    bg: 'honey' as const,
    titleRu: 'Привет! Я Хани',
    titleAz: 'Salam! Mən Hani',
    subRu: 'Я научу тебя английскому через игры, истории и весёлые разговоры — 5 минут в день, и ты заговоришь.',
    subAz: 'Sənə oyunlar, hekayələr və əyləncəli söhbətlərlə ingiliscə öyrədəcəyəm — gündə 5 dəqiqə.',
  },
  {
    bg: 'sage' as const,
    titleRu: 'Игры, истории и сказки',
    titleAz: 'Oyunlar, hekayələr və nağıllar',
    subRu: 'Никаких скучных уроков. Карточки, мини-игры, чат с питомцем и интерактивные сказки с выбором.',
    subAz: 'Heç bir darıxdırıcı dərs. Kartlar, mini-oyunlar, ev heyvanı ilə söhbət və interaktiv nağıllar.',
  },
  {
    bg: 'cream' as const,
    titleRu: 'Питомец растёт вместе с тобой',
    titleAz: 'Ev heyvanı səninlə birgə böyüyür',
    subRu: 'Корми Хани новыми словами, наряжай его, открывай новых друзей.',
    subAz: 'Hanini yeni sözlərlə qidalandır, onu geyindir, yeni dostlar aç.',
  },
  {
    bg: 'night' as const,
    titleRu: 'Родитель рядом',
    titleAz: 'Valideyn yaxınlıqda',
    subRu: 'Прогресс, время за экраном и темп обучения — в отдельном кабинете родителя. Безопасно и прозрачно.',
    subAz: 'Tərəqqi və ekran vaxtı — valideyn kabinetində. Təhlükəsiz və şəffaf.',
  },
];

const ORBIT_ICONS = [
  { e: '🎮', x: 90, y: 0 },
  { e: '📖', x: 180, y: 30 },
  { e: '💬', x: 180, y: 130 },
  { e: '🎯', x: 90, y: 170 },
  { e: '🎵', x: 0, y: 130 },
  { e: '🧩', x: 0, y: 30 },
];

function Slide({ idx, isAz }: { idx: number; isAz: boolean }) {
  const slide = SLIDES[idx]!;
  return (
    <View style={[styles.slide, { width: SW }]}>
      {/* Art */}
      <View style={styles.artBox}>
        {idx === 0 && (
          <>
            {[
              { x: 12, y: 22, c: colors.berry, s: 14 },
              { x: 220, y: 6, c: colors.accent, s: 18 },
              { x: 240, y: 170, c: colors.primary, s: 12 },
              { x: 0, y: 130, c: colors.butter, s: 16 },
            ].map((sp, i) => (
              <Text
                key={i}
                style={{
                  position: 'absolute',
                  left: sp.x,
                  top: sp.y,
                  fontSize: sp.s,
                  color: sp.c,
                }}
              >
                ✦
              </Text>
            ))}
            <View style={styles.haloLg}>
              <HBPet size={180} mood="happy" />
            </View>
          </>
        )}
        {idx === 1 && (
          <View style={styles.orbitBox}>
            {ORBIT_ICONS.map((it, i) => (
              <View
                key={i}
                style={[
                  styles.orbitItem,
                  { left: it.x, top: it.y },
                  shadow.md,
                ]}
              >
                <Text style={{ fontSize: 22 }}>{it.e}</Text>
              </View>
            ))}
            <View style={styles.orbitCenter}>
              <HBPet size={120} mood="happy" />
            </View>
          </View>
        )}
        {idx === 2 && (
          <View style={styles.growthRow}>
            <View style={{ opacity: 0.55 }}>
              <HBPet size={56} mood="happy" />
            </View>
            <Text style={styles.growthArrow}>›</Text>
            <View style={{ opacity: 0.78 }}>
              <HBPet size={88} mood="happy" />
            </View>
            <Text style={styles.growthArrow}>›</Text>
            <View>
              <HBPet size={120} mood="happy" />
              <View style={styles.growthCrown}>
                <Crown size={48} />
              </View>
            </View>
          </View>
        )}
        {idx === 3 && (
          <View style={styles.dashboardBox}>
            <View style={[styles.miniDashboard, shadow.md]}>
              <View style={styles.miniDashHeader}>
                <Text style={styles.miniDashLabel}>
                  {isAz ? 'HƏFTƏNİN VAXTI' : 'ВРЕМЯ НЕДЕЛИ'}
                </Text>
                <Text style={styles.miniDashDelta}>↑ +18%</Text>
              </View>
              <Text style={styles.miniDashValue}>2ч 14м</Text>
              <View style={styles.miniDashBars}>
                {[14, 22, 18, 26, 12, 24, 19].map((v, i) => (
                  <View
                    key={i}
                    style={[
                      styles.miniDashBar,
                      {
                        height: (v / 26) * 36,
                        backgroundColor: i === 6 ? colors.primary : colors.accent,
                      },
                    ]}
                  />
                ))}
              </View>
            </View>
            <View style={[styles.parentAvatar, shadow.md]}>
              <Text style={{ fontSize: 36 }}>👨‍👩</Text>
            </View>
            <View style={styles.miniPet}>
              <HBPet size={70} mood="happy" />
            </View>
          </View>
        )}
      </View>

      {/* Text */}
      <View style={styles.textBox}>
        <Animated.Text
          entering={FadeInUp.duration(500)}
          style={styles.slideTitle}
        >
          {isAz ? slide.titleAz : slide.titleRu}
        </Animated.Text>
        <Animated.Text
          entering={FadeInUp.duration(500).delay(100)}
          style={styles.slideSub}
        >
          {isAz ? slide.subAz : slide.subRu}
        </Animated.Text>
      </View>
    </View>
  );
}

export default function OnboardingCarouselScreen() {
  const router = useRouter();
  const lang = useSettings((s) => s.parentUILanguage) ?? 'ru';
  const isAz = lang === 'az';

  const [idx, setIdx] = useState(0);
  const scrollRef = useRef<ScrollView | null>(null);

  const slide = SLIDES[idx]!;

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const newIdx = Math.round(e.nativeEvent.contentOffset.x / SW);
    if (newIdx !== idx) setIdx(newIdx);
  };

  const handleNext = () => {
    Haptics.selectionAsync().catch(() => {});
    if (idx < SLIDES.length - 1) {
      scrollRef.current?.scrollTo({ x: (idx + 1) * SW, animated: true });
    } else {
      finish();
    }
  };

  const finish = () => {
    router.replace('/language' as any);
  };

  return (
    <PaperBackground variant={slide.bg}>
      <View style={styles.container}>
        {/* skip / spacer */}
        <View style={styles.topBar}>
          {idx < 3 ? (
            <Pressable onPress={finish} style={[styles.skipBtn, shadow.sm]}>
              <Text style={styles.skipText}>
                {isAz ? 'Keç' : 'Пропустить'}
              </Text>
            </Pressable>
          ) : (
            <View style={{ height: 30 }} />
          )}
        </View>

        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
          style={{ flex: 1 }}
        >
          {SLIDES.map((_, i) => (
            <Slide key={i} idx={i} isAz={isAz} />
          ))}
        </ScrollView>

        {/* dots */}
        <View style={styles.dotsRow}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === idx && { width: 22, backgroundColor: colors.primary },
              ]}
            />
          ))}
        </View>

        {/* CTA */}
        <View style={styles.cta}>
          <HBButton
            full
            variant="primary"
            label={
              idx < SLIDES.length - 1
                ? isAz ? 'İrəli' : 'Дальше'
                : isAz ? 'Başla! →' : 'Поехали! →'
            }
            onPress={handleNext}
          />
        </View>
      </View>
    </PaperBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 60 },

  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing[5],
    height: 32,
  },
  skipBtn: {
    backgroundColor: colors.card,
    paddingHorizontal: spacing[3],
    paddingVertical: 6,
    borderRadius: radius.full,
  },
  skipText: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.xs,
    color: colors.inkSoft,
  },

  slide: {
    paddingHorizontal: spacing[6],
    paddingTop: spacing[4],
    alignItems: 'center',
  },
  artBox: {
    width: 260,
    height: 260,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing[6],
  },
  haloLg: {
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(245, 212, 102, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  orbitBox: { width: 230, height: 230, position: 'relative' },
  orbitItem: {
    position: 'absolute',
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbitCenter: {
    position: 'absolute',
    top: 55,
    left: 55,
    alignItems: 'center',
    justifyContent: 'center',
  },

  growthRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing[1],
  },
  growthArrow: {
    fontFamily: fontFamily.bodyBlack,
    fontSize: 24,
    color: colors.inkSoft,
    marginHorizontal: -2,
  },
  growthCrown: {
    position: 'absolute',
    top: -22,
    alignSelf: 'center',
  },

  dashboardBox: { width: 240, height: 230, position: 'relative' },
  miniDashboard: {
    position: 'absolute',
    top: 8,
    left: 0,
    right: 0,
    padding: spacing[3],
    borderRadius: radius.xl,
    backgroundColor: colors.card,
    transform: [{ rotate: '-3deg' }],
  },
  miniDashHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  miniDashLabel: {
    fontFamily: fontFamily.bodyBlack,
    fontSize: 10,
    color: colors.inkSoft,
    letterSpacing: 0.5,
  },
  miniDashDelta: {
    fontFamily: fontFamily.bodyBlack,
    fontSize: 11,
    color: colors.accent,
  },
  miniDashValue: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.xl,
    color: colors.ink,
    marginTop: 2,
  },
  miniDashBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    height: 36,
    marginTop: spacing[2],
  },
  miniDashBar: {
    flex: 1,
    borderRadius: 3,
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  parentAvatar: {
    position: 'absolute',
    bottom: 0,
    right: 16,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniPet: { position: 'absolute', bottom: 10, left: 8 },

  textBox: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[6],
    alignItems: 'center',
  },
  slideTitle: {
    fontFamily: fontFamily.display,
    fontSize: fontSize['2xl'],
    color: colors.ink,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  slideSub: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    color: colors.inkSoft,
    textAlign: 'center',
    marginTop: spacing[2],
    lineHeight: 20,
    paddingHorizontal: spacing[2],
  },

  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: spacing[3],
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.bgDeep,
  },

  cta: { paddingHorizontal: spacing[5], paddingBottom: spacing[8] },
});
