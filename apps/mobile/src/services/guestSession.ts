/**
 * Anonymous trial session.
 *
 * Every AI endpoint requires a token, so the "try before you sign up" path on day
 * 1 needs one too. On first launch the app asks the API for a guest account: a
 * real user row with a real JWT, just without an email and password yet. The
 * server issues the device id (React Native has no crypto-strong RNG without an
 * extra native module, and this id is a bearer secret — anyone holding it gets
 * that trial account), and we keep it so a relaunch RESUMES the same trial rather
 * than forking a new one and stranding day-1 progress.
 *
 * Registering later upgrades this same account in place — see registerUser(),
 * which sends the guest token so the server keeps the userId and everything
 * hanging off it (children, progress, memory).
 *
 * Stored in expo-secure-store rather than AsyncStorage: it is a credential.
 */

import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { createGuestAccount } from './api';

const DEVICE_KEY = 'soz_device_id';
const isWeb = Platform.OS === 'web';

async function readDeviceId(): Promise<string | null> {
  if (isWeb) return null;
  try {
    return await SecureStore.getItemAsync(DEVICE_KEY);
  } catch {
    return null;
  }
}

async function writeDeviceId(id: string): Promise<void> {
  if (isWeb) return;
  try {
    await SecureStore.setItemAsync(DEVICE_KEY, id);
  } catch {
    /* keychain unavailable — the trial still works, it just won't resume */
  }
}

export interface GuestSession {
  token: string;
  userId: string;
}

/**
 * Get a usable trial token, creating or resuming the guest account as needed.
 * Returns null when the API is unreachable — callers should treat that as
 * "offline, stay on bundled content" rather than as a hard failure.
 */
export async function ensureGuestSession(): Promise<GuestSession | null> {
  try {
    const existingDeviceId = await readDeviceId();
    const res = await createGuestAccount(existingDeviceId);
    if (res.deviceId && res.deviceId !== existingDeviceId) {
      await writeDeviceId(res.deviceId);
    }
    return { token: res.token, userId: res.user.id };
  } catch {
    return null;
  }
}

/**
 * Drop the stored device id. Called after the trial is upgraded to a real
 * account so a later logout can't resume the now-registered trial, and on
 * account deletion.
 */
export async function clearGuestSession(): Promise<void> {
  if (isWeb) return;
  try {
    await SecureStore.deleteItemAsync(DEVICE_KEY);
  } catch {
    /* nothing stored — fine */
  }
}
