/**
 * Profile fork — "Who is this app for?"
 *
 * The first onboarding decision (after the tour): a parent-managed KID profile,
 * or an ADULT learner on the family account. Drives persona, proactive gating,
 * paywall copy, and which onboarding path follows.
 *   kid   → /learning-languages → /setup/name → … (existing chain)
 *   adult → /learning-languages → /setup/goal → /auth/register
 */

import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

import { HBButton } from '@/components/HBButton';
import { HBCard } from '@/components/HBCard';
import { HBPet } from '@/components/HBPet';
import { PaperBackground } from '@/components/PaperBackground';
import { Text } from '@/components/Text';
import { useSettings, type ProfileType } from '@/store/settings';
import { colors, fontFamily, fontSize, spacing } from '@/theme';

interface Option {
  key: ProfileType;
  emoji: string;
  titleRu: string;
  titleAz: string;
  subRu: string;
  subAz: string;
  hue: number;
}

const OPTIONS: Option[] = [
  {
    key: 'kid',
    emoji: '🧸',
    titleRu: 'Для ребёнка',
    titleAz: 'Uşaq üçün',
    subRu: 'Настраивает родитель · игра и безопасность',
    subAz: 'Valideyn qurur · oyun və təhlükəsizlik',
    hue: 55,
  },
  {
    key: 'adult',
    emoji: '🎯',
    titleRu: 'Для себя',
    titleAz: 'Özüm üçün',
    subRu: 'Взрослый ученик · свои цели и разговор',
    subAz: 'Böyük şagird · öz məqsədlərin',
    hue: 175,
  },
];

export default function ProfileTypeScreen() {
  const router = useRouter();
  const lang = useSettings((s) => s.parentUILanguage) ?? 'ru';
  const setProfileType = useSettings((s) => s.setProfileType);
  const isAz = lang === 'az';

  const [who, setWho] = useState<ProfileType>('kid');

  const handleContinue = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setProfileType(who);
    router.push('/learning-languages');
  };

  return (
    <PaperBackground>
      {/* ScrollView: содержимое (маскот 92 + заголовок + две карточки, текст в
          которых переносится на вторую строку) на 320 × 712 dp не оставляло
          места кнопке. Вместе с нижним инсетом из PaperBackground это и давало
          обрезанную наполовину «Продолжить». */}
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(600)} style={styles.header}>
          <View style={styles.petHalo}>
            <HBPet size={64} hue={who === 'adult' ? 175 : 55} mood="happy" />
          </View>
          <Text style={styles.title}>
            {isAz ? 'Bu kim üçündür?' : 'Для кого приложение?'}
          </Text>
          <Text style={styles.subtitle}>
            {isAz
              ? 'Хани hər ikisi üçün uyğunlaşır'
              : 'Хани подстроится под каждого'}
          </Text>
        </Animated.View>

        <View style={styles.options}>
          {OPTIONS.map((o, i) => {
            const selected = who === o.key;
            return (
              <Animated.View key={o.key} entering={FadeInUp.duration(500).delay(140 + i * 100)}>
                <Pressable
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setWho(o.key);
                  }}
                >
                  <HBCard
                    depth={selected ? 'md' : 'sm'}
                    ringColor={selected ? colors.accent : undefined}
                    style={styles.optionCard}
                  >
                    <View style={styles.optionEmoji}>
                      <Text style={{ fontSize: 30 }}>{o.emoji}</Text>
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.optionTitle}>{isAz ? o.titleAz : o.titleRu}</Text>
                      <Text style={styles.optionSub}>{isAz ? o.subAz : o.subRu}</Text>
                    </View>
                    <View style={[styles.radio, selected && styles.radioOn]}>
                      {selected && <View style={styles.radioDot} />}
                    </View>
                  </HBCard>
                </Pressable>
              </Animated.View>
            );
          })}
        </View>

        <Animated.View entering={FadeInUp.duration(400).delay(400)} style={styles.cta}>
          <HBButton
            full
            variant="primary"
            label={isAz ? 'Davam et' : 'Продолжить'}
            onPress={handleContinue}
          />
        </Animated.View>
      </ScrollView>
    </PaperBackground>
  );
}

const styles = StyleSheet.create({
  // flexGrow вместо flex — см. age.tsx. paddingTop 80 был жёстким числом,
  // рассчитанным на широкий экран; на коротком он один съедал 11% высоты.
  container: { flexGrow: 1, paddingHorizontal: spacing[6], paddingTop: spacing[10] },
  header: { alignItems: 'center', gap: spacing[2], marginBottom: spacing[8] },
  petHalo: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[2],
  },
  title: {
    fontFamily: fontFamily.display,
    fontSize: fontSize['2xl'],
    color: colors.ink,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    color: colors.inkSoft,
    textAlign: 'center',
  },
  options: { gap: spacing[3] },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[4],
  },
  optionEmoji: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionTitle: { fontFamily: fontFamily.display, fontSize: fontSize.lg, color: colors.ink },
  optionSub: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.xs,
    color: colors.inkSoft,
    marginTop: 2,
  },
  radio: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { borderColor: colors.accent, backgroundColor: colors.accent },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.white },
  cta: { marginTop: 'auto', paddingBottom: spacing[8] },
});
