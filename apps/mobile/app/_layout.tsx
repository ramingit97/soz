import { setAudioModeAsync } from 'expo-audio';
import { useFonts } from 'expo-font';
import * as Notifications from 'expo-notifications';
import { Stack, useRouter, type Href } from 'expo-router';
import * as Sentry from '@sentry/react-native';
import * as SplashScreen from 'expo-splash-screen';

// Initialize Sentry early — only if DSN is configured (no-op otherwise)
const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: __DEV__ ? 'development' : 'production',
    tracesSampleRate: __DEV__ ? 1.0 : 0.1,
    sendDefaultPii: false, // kids app — never send PII
  });
}
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { SplashIntro } from '@/components/SplashIntro';
import { setAiLessonResolver, setCompanionNameProvider, setCurriculumLessonResolver } from '@/data/lessons';
import { track } from '@/services/analytics';
import { setSessionExpiredHandler } from '@/services/api';
import {
  getCachedCurriculumLesson,
  hydrateCurriculumCache,
} from '@/services/curriculum';
import {
  getCachedLesson,
  hydrateLessonCache,
} from '@/services/generatedLessons';
import { flushProgressQueue } from '@/services/progressQueue';
import { initPurchases, checkPremium, identifyPurchaser } from '@/services/subscriptions';
import { useSettings } from '@/store/settings';
import { colors } from '@/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

// Android notification channel
if (Platform.OS === 'android') {
  Notifications.setNotificationChannelAsync('lesson-reminders', {
    name: 'Lesson Reminders',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
  }).catch(() => {});
}

export default function RootLayout() {
  const userId = useSettings((s) => s.userId);
  const childId = useSettings((s) => s.childId);
  const setIsPremium = useSettings((s) => s.setIsPremium);
  const router = useRouter();
  const [introDone, setIntroDone] = useState(false);

  // Deep-link taps on proactive "Bobo wants to ask" callbacks → open that thread
  useEffect(() => {
    function handle(response: Notifications.NotificationResponse | null) {
      const data = response?.notification.request.content.data as
        | { route?: string; threadId?: string; language?: string }
        | undefined;
      if (!data?.route) return;
      const qs: string[] = [];
      if (data.threadId) qs.push(`threadId=${encodeURIComponent(String(data.threadId))}`);
      if (data.language) qs.push(`lang=${encodeURIComponent(String(data.language))}`);
      router.push(`${data.route}${qs.length ? `?${qs.join('&')}` : ''}` as Href);
    }
    const sub = Notifications.addNotificationResponseReceivedListener(handle);
    // Cold start: app launched by tapping a notification
    Notifications.getLastNotificationResponseAsync()
      .then((r) => { if (r) handle(r); })
      .catch(() => {});
    return () => sub.remove();
  }, []);

  useEffect(() => {
    initPurchases(userId);
    // Bind RevenueCat's app_user_id to our userId, then take entitlement from
    // the server. The webhook can only find the account if the two ids match,
    // and the API gates paid endpoints on its own record — so a locally-stored
    // isPremium that disagrees would show content the server refuses to serve.
    const token = useSettings.getState().authToken;
    (async () => {
      if (userId) await identifyPurchaser(userId);
      const premium = await checkPremium(token).catch(() => false);
      setIsPremium(premium);
    })();
    track({ event: 'app_open', userId, childId });

    // Deliver any lesson completions that failed to reach the server (offline
    // when the child finished). Idempotent per (child, language, day), so a
    // duplicate delivery is a no-op — the risk is losing progress, not double
    // counting it.
    const authToken = useSettings.getState().authToken;
    if (authToken) {
      flushProgressQueue(authToken)
        .then((result) => { if (result) useSettings.getState().applyServerProgress(result); })
        .catch(() => {});
    }

    // Wire up resolvers immediately — caches fill async via hydrate/fetch
    setAiLessonResolver((lang, day) => {
      const cid = useSettings.getState().childId;
      if (!cid) return null;
      return getCachedLesson(cid, lang, day);
    });
    setCurriculumLessonResolver((lang, day) => {
      const cid = useSettings.getState().childId;
      if (!cid) return null;
      return getCachedCurriculumLesson(cid, lang, day);
    });
    setCompanionNameProvider(() => useSettings.getState().petName);

    // The server can revoke a session now (a password reset invalidates every
    // older token). Without this the app keeps a dead token forever and every
    // screen just fails. Clear it and send the parent to sign in again.
    setSessionExpiredHandler(() => {
      if (!useSettings.getState().authToken) return; // already signed out
      useSettings.getState().logout();
      router.replace('/auth/login' as Href);
    });
    hydrateLessonCache().catch(() => {});
    hydrateCurriculumCache().catch(() => {});

    // SFX should play even with the iOS mute switch on (like all game audio).
    // NOTE: no `allowsRecording` here — talk.tsx owns the record/playback dance.
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
  }, [userId]);

  // Каждое начертание подключается своим файлом, а не через корень пакета:
  // корневой index.js пакетов @expo-google-fonts делает require на ВСЕ
  // начертания с курсивами, и Metro кладёт их в бандл и в каждое EAS Update
  // (было 21 файл шрифтов, используются 7). Имена — те же, что в fontFamily.
  const [fontsLoaded, fontError] = useFonts({
    Nunito_400Regular: require('@expo-google-fonts/nunito/Nunito_400Regular.ttf'),
    Nunito_600SemiBold: require('@expo-google-fonts/nunito/Nunito_600SemiBold.ttf'),
    Nunito_700Bold: require('@expo-google-fonts/nunito/Nunito_700Bold.ttf'),
    Nunito_800ExtraBold: require('@expo-google-fonts/nunito/Nunito_800ExtraBold.ttf'),
    Nunito_900Black: require('@expo-google-fonts/nunito/Nunito_900Black.ttf'),
    Onest_600SemiBold: require('@expo-google-fonts/onest/600SemiBold/Onest_600SemiBold.ttf'),
    Onest_700Bold: require('@expo-google-fonts/onest/700Bold/Onest_700Bold.ttf'),
  });

  // Шрифт не загрузился — рисуем системным, а не держим пустой экран вечно.
  const fontsReady = fontsLoaded || !!fontError;

  useEffect(() => {
    if (fontsReady) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsReady]);

  if (!fontsReady) return null;

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.bg },
              animation: 'slide_from_right',
            }}
          />
          {!introDone && <SplashIntro onDone={() => setIntroDone(true)} />}
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
