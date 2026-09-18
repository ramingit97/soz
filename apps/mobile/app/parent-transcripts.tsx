/**
 * Диалоги ребёнка с персонажем — родителю видно всё, что было сказано.
 * Хранятся 90 дней (`services/retention.ts` на сервере), карточки раскрываются.
 */
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';

import { HBCard } from '@/components/HBCard';
import { HBPet } from '@/components/HBPet';
import { Icon } from '@/components/Icon';
import { PaperBackground } from '@/components/PaperBackground';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Text } from '@/components/Text';
import { useAccent } from '@/hooks/useAccent';
import { UIModeProvider } from '@/hooks/useUIMode';
import { getTranscripts, type ConversationRecord } from '@/services/api';
import { useSettings } from '@/store/settings';
import { colors, fontFamily, fontSize, radius, spacing } from '@/theme';
import { MODE_TOKENS } from '@/theme/modeTokens';
import { useCompanionName } from '@/utils/companion';

export default function ParentTranscriptsScreen() {
  const lang = useSettings((s) => s.parentUILanguage) ?? 'ru';
  const childId = useSettings((s) => s.childId);
  const childName = useSettings((s) => s.childName) ?? '';
  const authToken = useSettings((s) => s.authToken);
  const isAz = lang === 'az';
  const bot = useCompanionName();
  const accent = useAccent();
  const padX = MODE_TOKENS.teen.density.padX;

  const [conversations, setConversations] = useState<ConversationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!childId || !authToken) {
      setLoading(false);
      return;
    }
    getTranscripts(childId, authToken)
      .then(setConversations)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [childId, authToken]);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString(isAz ? 'az-AZ' : 'ru-RU', {
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const turnsLabel = (n: number) =>
    isAz ? `${n} replika` : `${n} ${n === 1 ? 'реплика' : n < 5 ? 'реплики' : 'реплик'}`;

  return (
    <UIModeProvider force="teen">
      <PaperBackground>
        <ScreenHeader
          title={isAz ? 'Dialoqlar' : `Диалоги ${childName}`}
          subtitle={
            isAz ? `${bot} ilə bütün söhbətlər` : `Все разговоры с ${bot}`
          }
        />

        <ScrollView contentContainerStyle={[styles.scroll, { paddingHorizontal: padX }]} showsVerticalScrollIndicator={false}>
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={accent.bottom} size="large" />
            </View>
          ) : null}

          {!loading && conversations.length === 0 ? (
            <HBCard style={styles.empty}>
              <HBPet size={MODE_TOKENS.teen.mascot.hero} mood="curious" />
              <Text variant="body" tone="secondary" align="center">
                {isAz ? `Hələ dialoq yoxdur. ${bot} gözləyir!` : `Пока нет диалогов. ${bot} ждёт!`}
              </Text>
            </HBCard>
          ) : null}

          {conversations.map((conv, i) => {
            const expanded = expandedId === conv.id;
            const childTurns = conv.turns.filter((t) => t.role === 'child').length;
            return (
              <Animated.View key={conv.id} entering={FadeInUp.duration(350).delay(Math.min(i, 8) * 50)}>
                <HBCard style={styles.card}>
                  <Pressable
                    onPress={() => setExpandedId(expanded ? null : conv.id)}
                    accessibilityRole="button"
                    accessibilityState={{ expanded }}
                    style={styles.cardHeader}
                  >
                    <View style={[styles.dayChip, { backgroundColor: accent.soft }]}>
                      <Text style={[styles.dayChipText, { color: accent.ink }]}>
                        {isAz ? `Gün ${conv.day}` : `День ${conv.day}`}
                      </Text>
                    </View>
                    <View style={styles.flex}>
                      <Text variant="bodyBold" numberOfLines={1}>{formatDate(conv.updatedAt)}</Text>
                      <Text variant="caption" tone="secondary">
                        {turnsLabel(childTurns)} · {conv.language === 'en' ? 'English' : 'Русский'}
                      </Text>
                    </View>
                    <Icon name={expanded ? 'chevron-down' : 'chevron-right'} size={20} color={colors.inkSoft} />
                  </Pressable>

                  {expanded ? (
                    <View style={styles.turns}>
                      {conv.turns.length === 0 ? (
                        <Text variant="caption" tone="secondary">
                          {isAz ? 'Bu dialoq boşdur' : 'Этот диалог пуст'}
                        </Text>
                      ) : null}
                      {conv.turns.map((t, j) => (
                        <View
                          key={j}
                          style={[
                            styles.turn,
                            t.role === 'child'
                              ? { backgroundColor: accent.soft }
                              : { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.surfaceBorder },
                          ]}
                        >
                          <Text variant="caption" tone="secondary">
                            {t.role === 'child' ? childName : bot}
                          </Text>
                          <Text variant="body">{t.text}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </HBCard>
              </Animated.View>
            );
          })}
        </ScrollView>
      </PaperBackground>
    </UIModeProvider>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingTop: spacing[2], paddingBottom: spacing[10], gap: spacing[2] },
  center: { paddingVertical: spacing[10], alignItems: 'center' },
  empty: { alignItems: 'center', gap: spacing[3], paddingVertical: spacing[6] },
  card: { gap: spacing[3] },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  flex: { flex: 1, minWidth: 0 },
  dayChip: { paddingHorizontal: spacing[2], paddingVertical: 4, borderRadius: radius.full },
  dayChipText: { fontFamily: fontFamily.bodyBlack, fontSize: fontSize['2xs'] },
  turns: { gap: spacing[2] },
  turn: { borderRadius: radius.lg, paddingHorizontal: spacing[3], paddingVertical: spacing[2], gap: 2 },
});
