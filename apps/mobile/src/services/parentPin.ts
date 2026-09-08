/**
 * Parent PIN — a 4-digit code the parent sets once and re-enters to reach the
 * parent area / paywall / add-child / consent. Replaces the old math challenge.
 *
 * Stored in expo-secure-store (hardware-backed Keychain/Keystore, encrypted at
 * rest). A 4-digit PIN isn't high-security on its own — the value here is that
 * the CHILD doesn't know it, and a reset requires the account password.
 */

import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const KEY = 'soz_parent_pin';
const isWeb = Platform.OS === 'web';

export async function hasPin(): Promise<boolean> {
  if (isWeb) return false;
  try {
    return !!(await SecureStore.getItemAsync(KEY));
  } catch {
    return false;
  }
}

export async function setPin(pin: string): Promise<void> {
  if (isWeb) return;
  try {
    await SecureStore.setItemAsync(KEY, pin);
  } catch {
    /* ignore — gate falls back to create mode next time */
  }
}

export async function verifyPin(pin: string): Promise<boolean> {
  if (isWeb) return true;
  try {
    const v = await SecureStore.getItemAsync(KEY);
    return !!v && v === pin;
  } catch {
    return false;
  }
}

export async function clearPin(): Promise<void> {
  if (isWeb) return;
  try {
    await SecureStore.deleteItemAsync(KEY);
  } catch {
    /* ignore */
  }
}
