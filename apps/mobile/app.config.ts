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
        'Söz needs the microphone so your child can talk with Bobo, the AI language friend.',
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
          'Söz needs the microphone so your child can talk with Bobo, the AI language friend.',
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

  extra: {
    eas: {
      projectId: process.env.EAS_PROJECT_ID ?? '',
    },
  },
});
