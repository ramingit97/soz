import type { LanguageCode, NativeLanguage, ParentUILanguage } from './language.js';

export interface ParentUser {
  id: string;
  email: string;
  uiLanguage: ParentUILanguage;
  createdAt: string;
}

export interface ChildProfile {
  id: string;
  parentId: string;
  name: string;
  age: number;
  avatarId: string;
  nativeLanguage: NativeLanguage;
  learningLanguages: LanguageCode[];
  createdAt: string;
}

export type SubscriptionStatus = 'trialing' | 'active' | 'expired' | 'cancelled';

export interface Subscription {
  id: string;
  parentId: string;
  status: SubscriptionStatus;
  trialEndsAt?: string;
  currentPeriodEnd?: string;
  plan?: 'monthly' | 'yearly';
}
