import type { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Söz',
  slug: 'soz',
  version: '1.0.0',
  orientation: 'portrait',
  scheme: 'soz',
  userInterfaceStyle: 'light',
  newArchEnabled: true,

  icon: './assets/icon.png',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#FFF8F0',
  },

  ios: {
    supportsTablet: false,
    bundleIdentifier: 'az.soz.app',
    buildNumber: '1',
    infoPlist: {
      NSMicrophoneUsageDescription:
        'Söz needs the microphone so your child can talk with Хани, the AI language friend.',
      // photo-learn.tsx calls launchCameraAsync / launchImageLibraryAsync. iOS
      // terminates the app on the spot when a usage description is missing, and
      // App Review rejects the binary before that — so these are not optional
      // copy, they are the difference between the feature working and shipping
      // a guaranteed crash.
      NSCameraUsageDescription:
        'Söz uses the camera so your child can photograph an object and learn its name in the language they are studying.',
      NSPhotoLibraryUsageDescription:
        'Söz lets your child pick a photo to learn the names of the things in it.',
      ITSAppUsesNonExemptEncryption: false,
    },
  },

  android: {
    package: 'az.soz.app',
    versionCode: 1,
    permissions: ['android.permission.RECORD_AUDIO', 'android.permission.CAMERA'],
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#FFF8F0',
    },
  },

  web: {
    bundler: 'metro',
    output: 'static',
  },

  plugins: [
    'expo-router',
    'expo-font',
    [
      'expo-av',
      {
        microphonePermission:
          'Söz needs the microphone so your child can talk with Хани, the AI language friend.',
      },
    ],
    'expo-audio',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#FFF8F0',
        image: './assets/splash.png',
        imageWidth: 200,
      },
    ],
    'expo-secure-store',
    [
      'expo-image-picker',
      {
        // Duplicated from ios.infoPlist on purpose: the plugin is what writes
        // these into the generated Info.plist, and it also adds the Android
        // READ_MEDIA_IMAGES permission that Android 13+ requires.
        photosPermission:
          'Söz lets your child pick a photo to learn the names of the things in it.',
        cameraPermission:
          'Söz uses the camera so your child can photograph an object and learn its name in the language they are studying.',
      },
    ],
    // Was missing entirely while the app scheduled notifications at runtime:
    // streak reminders, the parent digest and the crisis nudge. Without the
    // plugin the native module is not configured in a release build.
    [
      'expo-notifications',
      {
        // White silhouette on transparent — Android tints it with `color`.
        // Without an explicit icon the system uses a flat cut-out of the app
        // icon, which for ours is an unreadable purple square.
        icon: './assets/notification-icon.png',
        color: '#7C5CFF',
      },
    ],
  ],

  experiments: {
    typedRoutes: true,
  },

  // The Expo account that owns the EAS project. Without it a build run under a
  // different logged-in account resolves to that account's namespace and fails.
  owner: 'ramin97leo',

  // EAS Update — раздача JS-правок без пересборки и переустановки.
  //
  // Зачем: без этого каждая правка стиля означает новую нативную сборку (20
  // минут) и новые 97 МБ у каждого, кому её отдали. На двенадцати тестировщиках,
  // которых требует Google, это неработоспособно. С обновлениями я публикую
  // бандл одной командой, приложение подтягивает его при следующем запуске.
  //
  // fallbackToCacheTimeout: 0 — на старте НЕ ждать сети. Приложение открывается
  // мгновенно на том бандле, что уже лежит внутри, а новый скачивается в фоне и
  // применяется со следующего запуска. Обратный вариант (ждать) означал бы
  // белый экран на плохой связи, а у нас дети и азербайджанский мобильный
  // интернет.
  updates: {
    url: 'https://u.expo.dev/4fc384df-3cbf-4fa1-a72e-59604dc8c10b',
    fallbackToCacheTimeout: 0,
  },

  // Политика fingerprint, а не appVersion. Fingerprint — это хеш НАТИВНОЙ части
  // проекта (список нативных модулей, плагины, разрешения). Обновление уходит
  // только на те сборки, чья нативная часть совместима.
  //
  // Это защита от конкретного класса аварий: если я добавлю нативный модуль и
  // опубликую JS, который его вызывает, то при политике appVersion этот бандл
  // прилетел бы на старую сборку без модуля — и приложение падало бы при
  // запуске у всех сразу, без возможности откатиться с их стороны. При
  // fingerprint такой бандл просто не будет им предложен, и сначала придётся
  // сделать новую нативную сборку.
  runtimeVersion: { policy: 'fingerprint' },

  extra: {
    eas: {
      // Hardcoded on purpose, not read from .env alone: .env is gitignored, and
      // EAS Build uploads the project WITHOUT gitignored files — an env-only id
      // resolves to '' on the build server and the build fails there, not here.
      // A project id is a public identifier, not a secret. Env still overrides.
      projectId: process.env.EAS_PROJECT_ID ?? '4fc384df-3cbf-4fa1-a72e-59604dc8c10b',
    },
  },
});
