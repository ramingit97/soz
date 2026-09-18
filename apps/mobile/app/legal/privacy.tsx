import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { PaperBackground } from '@/components/PaperBackground';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Text } from '@/components/Text';
import { UIModeProvider } from '@/hooks/useUIMode';
import { useSettings } from '@/store/settings';
import { colors, fontFamily, fontSize, spacing } from '@/theme';
import { MODE_TOKENS } from '@/theme/modeTokens';

export default function PrivacyPolicyScreen() {
  const router = useRouter();
  const lang = useSettings((s) => s.parentUILanguage) ?? 'ru';
  const isAz = lang === 'az';

  return (
    // Политику читает родитель — «взрослый» режим.
    <UIModeProvider force="teen">
    <PaperBackground>
      <ScreenHeader title={isAz ? 'Məxfilik siyasəti' : 'Политика конфиденциальности'} />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingHorizontal: MODE_TOKENS.teen.density.padX }]}>
        <Animated.View entering={FadeInDown.duration(400)}>
          <Text style={styles.updated}>
            {isAz ? 'Son yenilənmə: 2026-07-07' : 'Обновлено: 2026-07-07'}
          </Text>

          <Section title={isAz ? '1. Hansı məlumatları toplayırıq' : '1. Какие данные мы собираем'}>
            {isAz
              ? 'Söz uşağınızın öyrənmə təcrübəsini fərdiləşdirmək üçün lazım olan minimum məlumatı toplayır:\n\n• Valideyn email və şifrə (parolun hash-i)\n• Uşağın adı, yaşı, dərs təqvimi\n• Dərslər zamanı qarşılaşdığı suallara verdiyi cavablar\n• Bobo ilə səs müzakirələrinin transkripti'
              : 'Söz собирает минимум данных, нужный для персонализации обучения:\n\n• Email родителя и хэш пароля\n• Имя ребёнка, возраст, расписание уроков\n• Ответы на упражнения и допущенные ошибки\n• Транскрипты разговоров с Бобо'}
          </Section>

          <Section title={isAz ? '2. Səs yazıları' : '2. Аудиозаписи'}>
            {isAz
              ? 'Bobo ilə müzakirələr zamanı səs müvəqqəti olaraq Deepgram (transkripsiya) və OpenAI (cavab) tərəfdaşlarına göndərilir. Audio sənədləri saxlamırıq — yalnız mətn transkripti istifadəçinin profilinə bağlanır. Mətn son söhbətdən 90 gün sonra avtomatik silinir.'
              : 'Во время разговора с Бобо аудио передаётся партнёрам Deepgram (распознавание) и OpenAI (генерация ответа). Сами аудиофайлы НЕ сохраняются — только текстовая расшифровка привязывается к профилю. Расшифровки автоматически удаляются через 90 дней после последнего разговора.'}
          </Section>

          <Section title={isAz ? '3. Uşaq məxfiliyi (COPPA / GDPR-K)' : '3. Конфиденциальность детей (COPPA / GDPR-K)'}>
            {isAz
              ? '13 yaşdan kiçik uşaqların məlumatları yalnız valideyn təsdiqindən sonra toplanır. Qeydiyyat zamanı valideyn yoxlaması tələb olunur. Reklam və ya cross-app izləmə istifadə etmirik. Tətbiqin sabitliyi üçün yalnız qəza diaqnostikası toplanır (Sentry, şəxsi məlumat olmadan).'
              : 'Данные детей младше 13 лет собираются только после явного согласия родителя. При регистрации требуется родительская верификация. Мы не используем рекламу и межприложенческий трекинг. Для стабильности приложения собирается только диагностика сбоев (Sentry, без персональных данных).'}
          </Section>

          <Section title={isAz ? '4. Məlumatların silinməsi' : '4. Удаление данных'}>
            {isAz
              ? 'Valideyn istənilən vaxt valideyn ekranından "Hesabı sil" düyməsi vasitəsilə uşağın hesabını və bütün məlumatlarını silə bilər. Silinmə 7 gün ərzində bütün serverlərdən baş verir.'
              : 'Родитель может в любой момент удалить аккаунт ребёнка и все его данные через кнопку "Удалить аккаунт" в родительском экране. Удаление выполняется со всех серверов в течение 7 дней.'}
          </Section>

          <Section title={isAz ? '5. Üçüncü tərəflər' : '5. Третьи стороны'}>
            {isAz
              ? 'İstifadə etdiyimiz xidmətlər:\n\n• Neon (PostgreSQL) — verilənlər bazası\n• OpenAI — Bobo dialoqları və danışıq tanınması\n• Deepgram — danışıq tanınması\n• ElevenLabs — Bobo-nun səsi\n• RevenueCat — abunəliklər\n• Sentry — qəza diaqnostikası (şəxsi məlumat olmadan)\n\nBütün tərəfdaşlar uşaq məxfiliyi standartlarına uyğun gəlir.'
              : 'Партнёры:\n\n• Neon (PostgreSQL) — база данных\n• OpenAI — диалоги Бобо и распознавание речи\n• Deepgram — распознавание речи\n• ElevenLabs — голос Бобо\n• RevenueCat — подписки\n• Sentry — диагностика сбоев (без персональных данных)\n\nВсе партнёры соответствуют стандартам детской конфиденциальности.'}
          </Section>

          <Section title={isAz ? '6. Əlaqə' : '6. Контакты'}>
            ramin.web.97@gmail.com
          </Section>
        </Animated.View>
      </ScrollView>
    </PaperBackground>
    </UIModeProvider>
  );
}

function Section({ title, children }: { title: string; children: string }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.body}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingTop: spacing[1],
    paddingBottom: spacing[10],
  },
  updated: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.xs,
    color: colors.inkSoft,
    marginBottom: spacing[6],
  },
  section: { marginBottom: spacing[5] },
  sectionTitle: {
    fontFamily: fontFamily.bodyBlack,
    fontSize: fontSize.lg,
    color: colors.primary,
    marginBottom: spacing[2],
  },
  body: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    color: colors.inkSoft,
    lineHeight: 22,
  },
});
