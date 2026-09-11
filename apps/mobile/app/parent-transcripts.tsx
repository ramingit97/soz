import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

import { HBBackButton } from '@/components/HBBackButton';
import { Text } from '@/components/Text';
import { getTranscripts, type ConversationRecord } from '@/services/api';
import { useSettings } from '@/store/settings';
import { colors, fontFamily, fontSize, radius, shadow, spacing } from '@/theme';
import { useCompanionName } from '@/utils/companion';

export default function ParentTranscriptsScreen() {
  const router = useRouter();
  const lang = useSettings((s) => s.parentUILanguage) ?? 'ru';
  const childId = useSettings((s) => s.childId);
  const childName = useSettings((s) => s.childName) ?? '';
  const authToken = useSettings((s) => s.authToken);
  const isAz = lang === 'az';
  const bot = useCompanionName();

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

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['#F4EDFF', '#EDE4FF', colors.cream]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <HBBackButton />

      <ScrollView contentContainerStyle={styles.scroll}>
        <Animated.View entering={FadeInDown.duration(500)} style={styles.header}>
          <Text style={styles.title}>
            {isAz ? `${childName}-in dialoqları` : `Диалоги ${childName}`}
          </Text>
          <Text style={styles.subtitle}>
            {isAz
              ? `${bot} ilə müzakirələr — bütün dedikləri burada`
              : `Разговоры с ${bot} — всё что говорил здесь`}
          </Text>
        </Animated.View>

        {loading && (
          <View style={styles.loaderBox}>
            <ActivityIndicator color={colors.primary} size="large" />
          </View>
        )}

        {!loading && conversations.length === 0 && (
          <View style={styles.emptyBox}>
            <Text style={{ fontSize: 48, textAlign: 'center' }}>💬</Text>
            <Text style={styles.emptyText}>
              {isAz
                ? `Hələ dialoq yoxdur. ${bot} gözləyir!`
                : `Пока нет диалогов. ${bot} ждёт!`}
            </Text>
          </View>
        )}

        {!loading && conversations.map((conv, i) => {
          const expanded = expandedId === conv.id;
          const childTurns = conv.turns.filter((t) => t.role === 'child').length;
          return (
            <Animated.View
              key={conv.id}
              entering={FadeInUp.duration(400).delay(i * 60)}
              style={[styles.card, shadow.sm]}
            >
              <Pressable
                onPress={() => setExpandedId(expanded ? null : conv.id)}
                style={styles.cardHeader}
              >
                <View style={styles.dayBadge}>
                  <Text style={styles.dayBadgeText}>
                    {isAz ? `Gün ${conv.day}` : `День ${conv.day}`}
                  </Text>
                </View>
                <View style={{ flex: 1, marginLeft: spacing[3] }}>
                  <Text style={styles.cardDate}>{formatDate(conv.updatedAt)}</Text>
                  <Text style={styles.cardMeta}>
                    {childTurns} {isAz ? 'replika' : childTurns === 1 ? 'реплика' : childTurns < 5 ? 'реплики' : 'реплик'} ·{' '}
                    {conv.language === 'en' ? '🇬🇧 English' : '🇷🇺 Русский'}
                  </Text>
                </View>
                <Text style={styles.expandArrow}>{expanded ? '▾' : '▸'}</Text>
              </Pressable>

              {expanded && (
                <View style={styles.turnsList}>
                  {conv.turns.length === 0 && (
                    <Text style={styles.emptyTurns}>
                      {isAz ? 'Bu dialoq boşdur' : 'Этот диалог пуст'}
                    </Text>
                  )}
                  {conv.turns.map((t, j) => (
                    <View
                      key={j}
                      style={[
                        styles.turnRow,
                        t.role === 'child' ? styles.turnChild : styles.turnBobo,
                      ]}
                    >
                      <Text style={styles.turnLabel}>
                        {t.role === 'child' ? `🧒 ${childName}` : `🤖 ${bot}`}
                      </Text>
                      <Text style={styles.turnText}>{t.text}</Text>
                    </View>
                  ))}
                </View>
              )}
            </Animated.View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[16] ?? 64,
    paddingBottom: spacing[10],
    gap: spacing[3],
  },
  header: { marginBottom: spacing[4] },
  title: {
    fontFamily: fontFamily.display,
    fontSize: fontSize['2xl'],
    color: colors.ink,
  },
  subtitle: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    color: colors.inkSoft,
    marginTop: 4,
  },
  loaderBox: { paddingVertical: spacing[10] },
  emptyBox: { paddingVertical: spacing[10], gap: spacing[3], alignItems: 'center' },
  emptyText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.base,
    color: colors.inkSoft,
    textAlign: 'center',
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    overflow: 'hidden',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', padding: spacing[4] },
  dayBadge: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: radius.sm,
  },
  dayBadgeText: {
    fontFamily: fontFamily.bodyBlack,
    fontSize: fontSize['2xs'],
    color: colors.primary,
    letterSpacing: 0.5,
  },
  cardDate: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.sm,
    color: colors.ink,
  },
  cardMeta: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.xs,
    color: colors.inkSoft,
    marginTop: 2,
  },
  expandArrow: {
    fontSize: fontSize.xl,
    color: colors.inkSoft,
    fontFamily: fontFamily.bodyBold,
  },
  turnsList: {
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[4],
    gap: spacing[2],
  },
  turnRow: {
    padding: spacing[3],
    borderRadius: radius.lg,
  },
  turnChild: { backgroundColor: '#FFF3E0' },
  turnBobo: { backgroundColor: colors.primarySoft },
  turnLabel: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize.xs,
    color: colors.inkSoft,
    marginBottom: 4,
  },
  turnText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    color: colors.ink,
    lineHeight: 20,
  },
  emptyTurns: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    color: colors.inkSoft,
    textAlign: 'center',
    paddingVertical: spacing[3],
  },
});
