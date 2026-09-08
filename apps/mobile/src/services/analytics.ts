import { API_BASE_URL } from './api';
import { useSettings } from '@/store/settings';

export type AnalyticsEvent =
  | 'app_open'
  | 'lesson_started'
  | 'lesson_complete'
  | 'grammar_complete'
  | 'paywall_viewed'
  | 'purchase_initiated'
  | 'purchase_success'
  | 'purchase_failed'
  | 'restore_success'
  | 'streak_milestone'
  | 'onboarding_complete'
  | 'talk_session_started'
  | 'adult_talk_started';

interface TrackOptions {
  event: AnalyticsEvent;
  props?: Record<string, string | number | boolean | null | undefined>;
  userId?: string | null;
  childId?: string | null;
}

export function track(options: TrackOptions): void {
  // /events requires a token now (it was open to the world and unattributed).
  // Read it here rather than threading it through all ~14 call sites — the trial
  // holds a real token too, so this covers guests as well.
  const token = useSettings.getState().authToken;
  if (!token) return; // pre-onboarding, before any account exists — nothing to attribute

  fetch(`${API_BASE_URL}/events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ ...options, ts: Date.now() }),
  }).catch(() => {});
}
