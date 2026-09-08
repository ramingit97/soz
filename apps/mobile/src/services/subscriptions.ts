import Purchases, { LOG_LEVEL, type PurchasesPackage } from 'react-native-purchases';
import { Platform } from 'react-native';

import { getBillingStatus } from './api';

declare const __DEV__: boolean;

// Set in your .env:  EXPO_PUBLIC_RC_IOS_KEY and EXPO_PUBLIC_RC_ANDROID_KEY
const API_KEY =
  Platform.OS === 'ios'
    ? (process.env.EXPO_PUBLIC_RC_IOS_KEY ?? '')
    : (process.env.EXPO_PUBLIC_RC_ANDROID_KEY ?? '');

export const PREMIUM_ENTITLEMENT = 'premium';
// Days 1–FREE_DAYS are available without a subscription
export const FREE_DAYS = 7;

let initialized = false;

export function initPurchases(userId?: string | null): void {
  if (!API_KEY || initialized) return;
  try {
    Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.WARN);
    Purchases.configure({ apiKey: API_KEY, appUserID: userId ?? undefined });
    initialized = true;
  } catch {
    // Native module not available in Expo Go — silently skip
  }
}

/**
 * Bind the RevenueCat identity to our account id.
 *
 * The webhook resolves `app_user_id` to a users row, so RevenueCat MUST know our
 * userId — otherwise purchases land under an anonymous RevenueCat id and the
 * server never learns who paid. configure() only sets it when the id was already
 * known at startup, which it isn't for anyone who signs in later (or upgrades
 * from the trial), so this runs whenever the account changes.
 */
export async function identifyPurchaser(userId: string): Promise<void> {
  if (!API_KEY) return;
  try {
    const info = await Purchases.getCustomerInfo();
    if (info.originalAppUserId === userId) return; // already bound
    await Purchases.logIn(userId);
  } catch {
    /* not configured / offline — the next launch retries */
  }
}

/**
 * Entitlement as the SERVER sees it. That's the one that matters: the API gates
 * paid endpoints on users.premium_until, so a client that disagrees would either
 * show locked content it can't fetch or an upsell to someone who already paid.
 * Falls back to the RevenueCat SDK when the API is unreachable.
 */
export async function checkPremium(token?: string | null): Promise<boolean> {
  if (token) {
    try {
      return (await getBillingStatus(token)).isPremium;
    } catch {
      /* offline — fall through to the on-device SDK */
    }
  }
  // Without an API key (dev / missing config) grant premium in __DEV__
  if (!API_KEY) return !!__DEV__;
  try {
    const info = await Purchases.getCustomerInfo();
    return !!info.entitlements.active[PREMIUM_ENTITLEMENT];
  } catch {
    return false;
  }
}

export async function getOfferings() {
  if (!API_KEY) return null;
  try {
    return await Purchases.getOfferings();
  } catch {
    return null;
  }
}

export async function purchasePackage(pkg: PurchasesPackage): Promise<boolean> {
  try {
    const result = await Purchases.purchasePackage(pkg);
    return !!result.customerInfo.entitlements.active[PREMIUM_ENTITLEMENT];
  } catch {
    return false;
  }
}

export async function restorePurchases(): Promise<boolean> {
  try {
    const info = await Purchases.restorePurchases();
    return !!info.entitlements.active[PREMIUM_ENTITLEMENT];
  } catch {
    return false;
  }
}
