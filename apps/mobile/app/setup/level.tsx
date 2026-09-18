/**
 * Уровень языка — настройка из родительского раздела.
 *
 * Уровень задаёт сложность плана: после сохранения сервер пересобирает будущие
 * уроки (`useSaveLevel`). Для 11+ есть мини-проверка на минуту
 * (`setup/placement`) — выбрать уровень самому можно всегда, тест не обязателен.
 */

import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';

import { HBButton } from '@/components/HBButton';
import { HBCard } from '@/components/HBCard';
import { HBIconBox } from '@/components/HBIconBox';
import { Icon } from '@/components/Icon';
import { InlineBanner } from '@/components/InlineBanner';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Text } from '@/components/Text';
import { useAccent } from '@/hooks/useAccent';
import { useSaveLevel } from '@/hooks/useSaveLevel';
import { UIModeProvider } from '@/hooks/useUIMode';
import { useSettings, type ChildLevel } from '@/store/settings';
import { colors, fontFamily, fontSize, radius, spacing } from '@/theme';
import { KID_MAX_AGE } from '@/theme/mode';
import { LEVEL_INFO, LEVEL_ORDER } from '@/utils/levels';

export default function SetupLevelScreen() {
  const router = useRouter();
  const accent = useAccent();
  const isAz = useSettings((s) => s.parentUILanguage) === 'az';
  const childName = useSettings((s) => s.childName) ?? '';
  const childAge = useSettings((s) => s.childAge);
  const profileType = useSettings((s) => s.profileType);
  const current = useSettings((s) => s.childLevel) ?? 'beginner';
  const { save, saving, failed } = useSaveLevel();

  const [selected, setSelected] = useState<ChildLevel>(current);
  const changed = selected !== current;
  // Вопросы проверки — грамматика для подростков и взрослых, малышам не подходят.
  const canTest = profileType === 'adult' || (childAge ?? 0) > KID_MAX_AGE;

  const handleSave = async () => {
    if (!changed) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    if (await save(selected)) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.back();
    }
  };

  return (
    // Настройку делает родитель — «взрослый» режим.
    <UIModeProvider force="teen">
      <Screen scroll>
        <ScreenHeader
          safeTop={false}
          title={isAz ? 'Dil səviyyəsi' : 'Уровень языка'}
          subtitle={isAz ? `${childName} dili necə bilir` : `Как ${childName} знает язык`}
          style={styles.header}
        />

        <View style={styles.cards}>
          {LEVEL_ORDER.map((key, i) => {
            const info = LEVEL_INFO[key];
            const sel = key === selected;
            return (
              <Animated.View key={key} entering={FadeInUp.duration(400).delay(60 + i * 60)}>
                <Pressable
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setSelected(key);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: sel }}
                  style={[
                    styles.card,
                    { borderColor: sel ? accent.bottom : colors.border, backgroundColor: sel ? accent.soft : colors.white },
                  ]}
                >
                  <View style={[styles.code, { backgroundColor: sel ? accent.bottom : colors.bgDeep }]}>
                    <Text style={[styles.codeText, { color: sel ? accent.text : colors.inkSoft }]}>{info.code}</Text>
                  </View>
                  <View style={styles.flex}>
                    <Text style={[styles.cardTitle, sel && { color: accent.ink }]}>
                      {isAz ? info.az : info.ru}
                      {key === current ? (
                        <Text style={styles.nowTag}>{isAz ? '  · indi' : '  · сейчас'}</Text>
                      ) : null}
                    </Text>
                    <Text variant="caption" tone="secondary">{isAz ? info.descAz : info.descRu}</Text>
                  </View>
                  <View style={[styles.radio, sel && { backgroundColor: accent.bottom, borderColor: accent.bottom }]}>
                    {sel ? <Icon name="check" size={14} color={accent.text} strokeWidth={3} /> : null}
                  </View>
                </Pressable>
              </Animated.View>
            );
          })}
        </View>

        {canTest ? (
          <Pressable
            onPress={() => router.push('/setup/placement' as never)}
            accessibilityRole="button"
            disabled={saving}
          >
            <HBCard style={styles.testRow}>
              <HBIconBox icon="clipboard-list" tint={accent.soft} iconColor={accent.ink} size={40} />
              <View style={styles.flex}>
                <Text variant="bodyBold">{isAz ? 'Əmin deyilsiniz?' : 'Не уверены?'}</Text>
                <Text variant="caption" tone="secondary">
                  {isAz ? '6 sual, təxminən 1 dəqiqə' : '6 вопросов, около минуты'}
                </Text>
              </View>
              <Icon name="chevron-right" size={20} color={colors.inkSoft} />
            </HBCard>
          </Pressable>
        ) : null}

        {failed ? (
          <InlineBanner
            tone="danger"
            icon="wifi-off"
            style={styles.banner}
            text={isAz
              ? 'Yadda saxlamaq alınmadı. İnterneti yoxlayıb yenidən cəhd edin.'
              : 'Не получилось сохранить. Проверьте интернет и попробуйте ещё раз.'}
          />
        ) : changed ? (
          <InlineBanner
            tone="info"
            icon="refresh-cw"
            style={styles.banner}
            text={isAz
              ? 'Növbəti dərslər yeni səviyyəyə uyğun qurulacaq.'
              : 'Следующие уроки перестроятся под новый уровень.'}
          />
        ) : null}

        <View style={styles.cta}>
          <HBButton
            full
            icon="check"
            variant={changed ? 'primary' : 'soft'}
            label={saving
              ? isAz ? 'Dərslər yenilənir…' : 'Перестраиваю уроки…'
              : isAz ? 'Yadda saxla' : 'Сохранить'}
            loading={saving}
            disabled={!changed || saving}
            onPress={handleSave}
          />
        </View>
      </Screen>
    </UIModeProvider>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 0, marginBottom: spacing[3] },
  flex: { flex: 1, gap: 2 },
  cards: { gap: spacing[3], marginBottom: spacing[4] },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[4],
    borderRadius: radius.xl,
    borderWidth: 2,
  },
  code: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeText: { fontFamily: fontFamily.bodyBlack, fontSize: fontSize.base, letterSpacing: 0.5 },
  cardTitle: { fontFamily: fontFamily.bodyBlack, fontSize: fontSize.base, color: colors.ink },
  nowTag: { fontFamily: fontFamily.bodyBold, fontSize: fontSize.xs, color: colors.inkSoft },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  testRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  banner: { marginTop: spacing[4] },
  cta: { marginTop: spacing[5], paddingBottom: spacing[6] },
});
