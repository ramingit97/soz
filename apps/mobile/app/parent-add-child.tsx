import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

import { HBBackButton } from '@/components/HBBackButton';
import { HBPet } from '@/components/HBPet';
import { KeyboardAvoider } from '@/components/KeyboardAvoider';
import { Text } from '@/components/Text';
import { createChild } from '@/services/api';
import { fetchFullCurriculum } from '@/services/curriculum';
import { useSettings, type ChildLevel } from '@/store/settings';
import { colors, fontFamily, fontSize, gradients, radius, shadow, spacing } from '@/theme';
import { useCompanionName } from '@/utils/companion';

const LEVELS: ChildLevel[] = ['beginner', 'elementary', 'pre_intermediate', 'intermediate'];
const LEVEL_CODE: Record<ChildLevel, string> = {
  beginner: 'A1', elementary: 'A2', pre_intermediate: 'B1', intermediate: 'B2',
};
const LEVEL_LABELS_RU: Record<ChildLevel, string> = {
  beginner: 'Начинающий',
  elementary: 'Элементарный',
  pre_intermediate: 'Средний',
  intermediate: 'Уверенный',
};
const LEVEL_LABELS_AZ: Record<ChildLevel, string> = {
  beginner: 'Yeni başlayan',
  elementary: 'Elementar',
  pre_intermediate: 'Orta',
  intermediate: 'Sərbəst',
};

const LANG_OPTS = ['en', 'ru'] as const;

export default function AddChildScreen() {
  const router = useRouter();
  const lang = useSettings((s) => s.parentUILanguage) ?? 'ru';
  const authToken = useSettings((s) => s.authToken);
  const syncChild = useSettings((s) => s.syncChild);
  const isAz = lang === 'az';
  const bot = useCompanionName();

  const [name, setName] = useState('');
  const [age, setAge] = useState<number>(9);
  const [level, setLevel] = useState<ChildLevel>('beginner');
  const [languages, setLanguages] = useState<('en' | 'ru')[]>(['en']);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleLang = (l: 'en' | 'ru') => {
    setLanguages((prev) => (prev.includes(l) ? prev.filter((x) => x !== l) : [...prev, l]));
  };

  const handleSubmit = async () => {
    if (!name.trim() || languages.length === 0 || !authToken) return;
    setError(null);
    setSubmitting(true);
    try {
      const child = await createChild(
        {
          name: name.trim(),
          age,
          level,
          learningLanguages: languages,
          scheduleDays: ['mon', 'tue', 'wed', 'thu', 'fri'],
          scheduleMinutes: 15,
          scheduleHour: 17,
        },
        authToken,
      );
      // Switch to the new child
      syncChild(child);
      // Pre-fetch their curriculum
      for (const l of languages) {
        fetchFullCurriculum(child.id, l, authToken).catch(() => {});
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.replace('/home');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'unknown');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['#FCE9CC', colors.bg, colors.bgDeep]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <HBBackButton />

      <KeyboardAvoider contentContainerStyle={styles.scroll}>
          <Animated.View entering={FadeInDown.duration(500)} style={styles.header}>
            <HBPet size={88} mood="happy" />
            <Text style={styles.title}>
              {isAz ? 'Yeni uşaq əlavə et' : 'Добавить ребёнка'}
            </Text>
            <Text style={styles.subtitle}>
              {isAz
                ? `${bot} onunla da dost olacaq 🤖`
                : `${bot} подружится и с ним 🤖`}
            </Text>
          </Animated.View>

          <Animated.View entering={FadeInUp.duration(500).delay(150)} style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>{isAz ? 'Ad' : 'Имя'}</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder={isAz ? 'Uşağın adı' : 'Имя ребёнка'}
                placeholderTextColor={colors.inkSoft}
                autoCapitalize="words"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>{isAz ? 'Yaş' : 'Возраст'}: {age}</Text>
              <View style={styles.ageRow}>
                {[8, 9, 10, 11, 12].map((a) => (
                  <Pressable
                    key={a}
                    onPress={() => setAge(a)}
                    style={[styles.ageChip, age === a && styles.ageChipActive]}
                  >
                    <Text style={[styles.ageText, age === a && styles.ageTextActive]}>{a}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>{isAz ? 'Səviyyə' : 'Уровень языка'}</Text>
              {LEVELS.map((opt) => (
                <Pressable
                  key={opt}
                  onPress={() => setLevel(opt)}
                  style={[styles.levelRow, level === opt && styles.levelRowActive]}
                >
                  <View style={[styles.radioOuter, level === opt && styles.radioOuterActive]}>
                    {level === opt && <View style={styles.radioInner} />}
                  </View>
                  <Text style={styles.levelText}>
                    {LEVEL_CODE[opt]} · {isAz ? LEVEL_LABELS_AZ[opt] : LEVEL_LABELS_RU[opt]}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>
                {isAz ? 'Hansı dilləri öyrənəcək?' : 'Какие языки изучает?'}
              </Text>
              <View style={styles.langRow}>
                {LANG_OPTS.map((l) => {
                  const on = languages.includes(l);
                  return (
                    <Pressable
                      key={l}
                      onPress={() => toggleLang(l)}
                      style={[styles.langChip, on && styles.langChipActive]}
                    >
                      <Text style={{ fontSize: fontSize['2xl'] }}>{l === 'en' ? '🇬🇧' : '🇷🇺'}</Text>
                      <Text style={[styles.langText, on && styles.langTextActive]}>
                        {l === 'en' ? 'English' : 'Русский'}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {error && <Text style={styles.errorText}>{error}</Text>}

            <Pressable
              onPress={handleSubmit}
              disabled={submitting || !name.trim() || languages.length === 0}
              style={[
                styles.submitBtn,
                (!name.trim() || languages.length === 0 || submitting) && { opacity: 0.5 },
              ]}
            >
              <LinearGradient
                colors={gradients.primary}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.submitGrad}
              >
                <Text style={styles.submitText}>
                  {submitting
                    ? (isAz ? 'Yaradılır...' : 'Создаём...')
                    : (isAz ? '✨ Əlavə et' : '✨ Добавить')}
                </Text>
              </LinearGradient>
            </Pressable>
          </Animated.View>
      </KeyboardAvoider>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[16] ?? 64,
    paddingBottom: spacing[10],
  },
  header: { alignItems: 'center', gap: spacing[2], marginBottom: spacing[6] },
  title: {
    fontFamily: fontFamily.display,
    fontSize: fontSize['2xl'],
    color: colors.ink,
    marginTop: spacing[2],
  },
  subtitle: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    color: colors.inkSoft,
  },

  form: { gap: spacing[4] },
  field: { gap: spacing[2] },
  label: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.sm,
    color: colors.ink,
  },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.base,
    color: colors.ink,
    ...shadow.sm,
  },

  ageRow: { flexDirection: 'row', gap: spacing[2] },
  ageChip: {
    flex: 1,
    paddingVertical: spacing[3],
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  ageChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  ageText: { fontFamily: fontFamily.bodyBlack, fontSize: fontSize.lg, color: colors.ink },
  ageTextActive: { color: colors.white },

  levelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  levelRowActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterActive: { borderColor: colors.primary },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  levelText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.base,
    color: colors.ink,
  },

  langRow: { flexDirection: 'row', gap: spacing[2] },
  langChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    backgroundColor: colors.white,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  langChipActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  langText: { fontFamily: fontFamily.bodyBold, fontSize: fontSize.base, color: colors.ink },
  langTextActive: { color: colors.primary },

  errorText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    color: colors.error,
    textAlign: 'center',
  },
  submitBtn: { borderRadius: radius.full, overflow: 'hidden', marginTop: spacing[2], ...shadow.glow },
  submitGrad: { paddingVertical: spacing[4], alignItems: 'center' },
  submitText: {
    color: colors.white,
    fontFamily: fontFamily.bodyBlack,
    fontSize: fontSize.lg,
  },
});
