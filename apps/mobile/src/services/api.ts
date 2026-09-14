import Constants from 'expo-constants';

import type { LanguageCode } from '@soz/shared-types';

function resolveBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv;

  const hostUri =
    Constants.expoConfig?.hostUri ??
    (Constants as unknown as { manifest2?: { extra?: { expoGo?: { debuggerHost?: string } } } })
      .manifest2?.extra?.expoGo?.debuggerHost;

  if (hostUri) {
    const host = hostUri.split(':')[0];
    if (host) return `http://${host}:3000`;
  }

  // A release build has no Metro host to fall back on, so reaching this line in
  // production means EXPO_PUBLIC_API_URL was not set at build time and every
  // network call is about to fail against a localhost that does not exist. That
  // was the state of the production EAS profile until it was given an `env`
  // block; say so loudly rather than shipping a silently offline app again.
  if (!__DEV__) {
    console.error(
      '[api] EXPO_PUBLIC_API_URL is not set in this build — falling back to ' +
        'localhost:3000, which cannot work on a device. Check eas.json.',
    );
  }

  return 'http://localhost:3000';
}

export const API_BASE_URL = resolveBaseUrl();

/**
 * Called when the server rejects our token as revoked or malformed.
 *
 * The server can now end a session (a password reset bumps `users.token_version`
 * and every older token stops working). Without this hook the app would sit there
 * holding a dead token, failing every request with an opaque "401 token_revoked"
 * and no way back except reinstalling. Registered in app/_layout.tsx.
 */
let onSessionExpired: (() => void) | null = null;
export function setSessionExpiredHandler(fn: () => void): void {
  onSessionExpired = fn;
}

// ── Shared fetch helper ───────────────────────────────────────────────────────

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string | null,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  const text = await res.text().catch(() => '');
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      /* non-JSON body */
    }
  }

  if (!res.ok) {
    // Surface error message from body if available
    const bodyErr =
      body && typeof body === 'object' && 'error' in body
        ? String((body as { error: unknown }).error)
        : text;

    // Only when we actually presented a token: a 401 on an anonymous call means
    // "sign in", not "your session died".
    if (
      res.status === 401 &&
      token &&
      (bodyErr === 'token_revoked' || bodyErr === 'token_invalid')
    ) {
      onSessionExpired?.();
    }

    throw new Error(`${res.status} ${bodyErr}`);
  }

  // Even with 2xx, some backends return { error: "..." } — treat as failure
  if (body && typeof body === 'object' && 'error' in body && (body as { error: unknown }).error) {
    throw new Error(`${res.status} ${String((body as { error: unknown }).error)}`);
  }

  return body as T;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export interface AuthResponse {
  token: string;
  user: { id: string; email: string };
}

export interface GuestAuthResponse extends AuthResponse {
  /** Server-issued device id — persist it to resume this trial on relaunch. */
  deviceId: string;
  isGuest: true;
}

/**
 * Create or resume the anonymous trial account. Pass the stored deviceId to
 * resume; pass null on a fresh install and keep the one that comes back.
 */
export async function createGuestAccount(deviceId?: string | null): Promise<GuestAuthResponse> {
  return request<GuestAuthResponse>('/auth/guest', {
    method: 'POST',
    body: JSON.stringify(deviceId ? { deviceId } : {}),
  });
}

/**
 * `guestToken` upgrades the anonymous trial in place instead of creating a
 * second account: same userId, so the child profile, progress and memory built
 * during day 1 survive sign-up.
 */
export async function registerUser(
  email: string,
  password: string,
  guestToken?: string | null,
): Promise<AuthResponse> {
  return request<AuthResponse>(
    '/auth/register',
    {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    },
    guestToken,
  );
}

/**
 * Entitlement according to the server (users.premium_until, written by the
 * RevenueCat webhook). Authoritative — the paid endpoints gate on this.
 */
export async function getBillingStatus(token: string): Promise<{ isPremium: boolean }> {
  return request<{ isPremium: boolean }>('/billing/status', {}, token);
}

export interface TalkQuota {
  limit: number;
  remaining: number;
  premium: boolean;
}

/** Conversation turns left today — the same bucket the server enforces. */
export async function getTalkQuota(token: string): Promise<TalkQuota> {
  return request<TalkQuota>('/talk/quota', {}, token);
}

/** True when an error thrown by request() was the daily conversation limit. */
export function isRateLimitError(e: unknown): boolean {
  return e instanceof Error && /^429\b/.test(e.message);
}

export async function loginUser(email: string, password: string): Promise<AuthResponse> {
  return request<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function getMe(
  token: string,
): Promise<{ userId: string; email: string; emailVerified: boolean }> {
  return request<{ userId: string; email: string; emailVerified: boolean }>('/auth/me', {}, token);
}

export async function forgotPassword(email: string): Promise<void> {
  await request('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function resetPassword(
  email: string,
  code: string,
  newPassword: string,
): Promise<void> {
  await request('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ email, code, newPassword }),
  });
}

/** Permanently delete the whole account and every child's data (COPPA / GDPR / Play). */
export async function deleteAccount(token: string): Promise<void> {
  await request('/auth/account', { method: 'DELETE' }, token);
}

export async function sendVerification(token: string): Promise<void> {
  await request('/auth/send-verification', { method: 'POST' }, token);
}

export async function verifyEmail(token: string, code: string): Promise<void> {
  await request(
    '/auth/verify-email',
    {
      method: 'POST',
      body: JSON.stringify({ code }),
    },
    token,
  );
}

// ── Children ──────────────────────────────────────────────────────────────────

export interface ChildProfile {
  id: string;
  name: string;
  age: number;
  ageBand?: 'young' | 'mid' | 'teen' | 'adult';
  petName?: string | null;
  level: string;
  learningLanguages: string[];
  interests?: string[];
  lessonPrefs?: LessonPrefs;
  scheduleDays: string[];
  scheduleMinutes: number;
  scheduleHour: number;
  currentDay: number;
  totalStars: number;
  streak: number;
  lastCompletedDate: string | null;
  // Profile fork + proactive settings (family account + "Bobo messages first")
  profileType?: 'kid' | 'adult';
  goal?: string | null;
  goals?: string[];
  timezone?: string | null;
  proactiveOptIn?: number; // 0/1
  proactiveWindowStart?: number;
  proactiveWindowEnd?: number;
}

export async function createChild(
  profile: Omit<ChildProfile, 'id' | 'currentDay' | 'totalStars' | 'streak' | 'lastCompletedDate'>,
  token: string,
): Promise<ChildProfile> {
  return request<ChildProfile>(
    '/children',
    {
      method: 'POST',
      body: JSON.stringify(profile),
    },
    token,
  );
}

export async function getChildren(token: string): Promise<ChildProfile[]> {
  return request<ChildProfile[]>('/children', {}, token);
}

export async function updateChild(
  childId: string,
  updates: Partial<ChildProfile>,
  token: string,
): Promise<ChildProfile> {
  return request<ChildProfile>(
    `/children/${childId}`,
    {
      method: 'PUT',
      body: JSON.stringify(updates),
    },
    token,
  );
}

export async function deleteChild(childId: string, token: string): Promise<void> {
  await request(`/children/${childId}`, { method: 'DELETE' }, token);
}

// Parent "dials" set at the post-week checkpoint — steer future lessons.
export interface LessonPrefs {
  moreTalk?: boolean;
  moreWords?: boolean;
  /** Больше историй на слух в плане (упор «Слушать» из онбординга). */
  moreListening?: boolean;
  difficulty?: 'easier' | 'harder';
}

/**
 * Checkpoint steering: save new interests and/or dials. The server re-skins all
 * FUTURE lessons under the new settings (past lessons are never rewritten) and
 * awaits the primary language's next week, so a follow-up curriculum refetch
 * shows the change. Returns the day from which lessons were re-personalized.
 */
export async function updatePreferences(
  childId: string,
  prefs: { interests?: string[]; lessonPrefs?: LessonPrefs },
  token: string,
): Promise<{ ok: boolean; reskinFrom: number }> {
  return request<{ ok: boolean; reskinFrom: number }>(
    `/children/${childId}/preferences`,
    { method: 'POST', body: JSON.stringify(prefs) },
    token,
  );
}

// ── Progress ──────────────────────────────────────────────────────────────────

export interface LessonError {
  kind: 'word_game' | 'grammar' | 'pronunciation';
  prompt: string;
  correct: string;
  given: string;
}

/**
 * What the server says the child's totals are after recording a completion.
 * These are authoritative — the client mirrors them rather than computing its
 * own, because hydrate() overwrites local values with the server's anyway, so a
 * disagreement always resolves against the client (and used to lose days).
 */
export interface ProgressResult {
  ok: boolean;
  /** The day was already recorded; nothing changed. Not an error. */
  duplicate?: boolean;
  /** Absent when the server has no DB configured and skipped the write. */
  totalStars?: number;
  streak?: number;
  currentDay?: number;
  skipped?: boolean;
}

export interface RecordProgressInput {
  childId: string;
  language: string;
  day: number;
  starsEarned: number;
  errors: LessonError[];
  /** Minutes to ADD to UTC for local time — see localOffsetMinutes(). */
  tzOffsetMinutes: number;
}

export async function recordProgress(
  input: RecordProgressInput,
  token: string,
): Promise<ProgressResult> {
  return request<ProgressResult>(
    '/progress',
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
    token,
  );
}

export interface LessonProgressRecord {
  id: string;
  childId: string;
  language: string;
  day: number;
  starsEarned: number;
  completedAt: string;
}

export async function getProgress(childId: string, token: string): Promise<LessonProgressRecord[]> {
  // The endpoint returns a bare array; tolerate a {progress:[]} wrapper too.
  const res = await request<LessonProgressRecord[] | { progress: LessonProgressRecord[] }>(
    `/progress/${childId}`,
    {},
    token,
  );
  if (Array.isArray(res)) return res;
  return res?.progress ?? [];
}

// ── Analysis (AI pedagogical report) ──────────────────────────────────────────

export interface AnalysisResponse {
  analysis: {
    strengths: { topic: string; evidence: string }[];
    weaknesses: { topic: string; evidence: string; specificMistakes: string[] }[];
    vocabularyToReview: string[];
    conversationTopics: string[];
    interests: string[];
    suggestedFocus: string[];
  };
  meta: {
    lessonsCompleted: number;
    totalStars: number;
    totalErrors: number;
    empty: boolean;
  };
}

export async function getAnalysis(
  childId: string,
  language: string,
  token: string,
): Promise<AnalysisResponse> {
  return request<AnalysisResponse>(`/analysis/${childId}?language=${language}`, {}, token);
}

// ── Talk ──────────────────────────────────────────────────────────────────────

export interface TalkRequestPayload {
  childId: string;
  conversationId: string;
  language: LanguageCode;
  level?: 'beginner' | 'elementary' | 'pre_intermediate' | 'intermediate';
  day?: number;
  childName?: string;
  ageBand?: 'young' | 'mid' | 'teen' | 'adult';
  scenario?: string;
  /** Topic checklist — micro-goal detection criteria in English (1-based indices in objectivesDone). */
  objectives?: string[];
  companionName?: string;
  nativeLanguage?: 'ru' | 'az';
  /** Conversation-lesson timing — lets Бобо wrap the session up itself. */
  sessionElapsedSec?: number;
  sessionTargetSec?: number;
  audioBase64: string;
  audioMimeType?: string;
}

export interface TalkResponsePayload {
  transcript: string;
  responseText: string;
  audioBase64: string;
  audioMimeType: string;
  ttsStubbed: boolean;
  ttsReason?: string;
  pronunciationHint?: { confidence: number; unclearWords: string[] };
  /** 1-based indices of request objectives newly accomplished by the child's last utterance. */
  objectivesDone?: number[];
  /** Бобо decided the planned session time is up and said a warm goodbye. */
  wrapSuggested?: boolean;
  /** Set when the real-time safety screen detected a crisis and Bobo returned a safe reply. */
  crisis?: boolean;
  cost: { sttUsd: number; llmUsd: number; ttsUsd: number; totalUsd: number };
  timings: { sttMs: number; llmMs: number; ttsMs: number };
  tokens?: { inputTokens: number; outputTokens: number };
}

export interface OpenerResponse {
  text: string;
  audioBase64: string;
  audioMimeType: string;
  ttsStubbed: boolean;
  hasMemory: boolean;
  /** The remembered thread Бобо opened with, if any (proactive recall). */
  thread?: { id: string; text: string } | null;
}

export async function fetchTalkOpener(
  childId: string,
  language: LanguageCode,
  childName?: string | null,
  ageBand?: 'young' | 'mid' | 'teen' | 'adult' | null,
  level?: string,
  token?: string | null,
  threadId?: string | null,
  scenario?: string | null,
  companionName?: string | null,
): Promise<OpenerResponse> {
  return request<OpenerResponse>(
    '/talk/opener',
    {
      method: 'POST',
      body: JSON.stringify({
        childId,
        language,
        childName,
        ageBand,
        level: level ?? 'beginner',
        threadId,
        scenario,
        companionName,
      }),
    },
    token,
  );
}

// ── Memory threads — timed proactive follow-ups ───────────────────────────────

export interface MemoryThread {
  id: string;
  language: string;
  type: 'fact' | 'event' | 'promise' | 'emotion' | 'goal';
  text: string;
  category: string | null;
  sentiment: 'pos' | 'neu' | 'neg' | null;
  sensitive: boolean;
  status: 'open' | 'asked' | 'resolved' | 'dismissed';
  mentionedAt: string;
  eventDate: string | null;
  followUpAt: string | null;
}

/**
 * Follow-up threads. scope 'open' (default) → non-sensitive due/upcoming, for push
 * scheduling + home banner. scope 'all' → every thread incl. status, for the parent
 * transparency view.
 */
export async function getThreads(
  childId: string,
  language: LanguageCode,
  token: string,
  scope: 'open' | 'all' = 'open',
): Promise<MemoryThread[]> {
  const res = await request<{ threads: MemoryThread[] }>(
    `/talk/threads/${childId}?language=${language}${scope === 'all' ? '&scope=all' : ''}`,
    {},
    token,
  );
  return res.threads;
}

/** Forget / stop asking about a thread. */
export async function dismissThread(threadId: string, token: string): Promise<void> {
  await request(`/talk/threads/${threadId}`, { method: 'DELETE' }, token);
}

/** Mark a thread "asked" — called only AFTER the opener actually played (so a failed
 * opener doesn't burn the memory). */
export async function markThreadAsked(threadId: string, token?: string | null): Promise<void> {
  await request(`/talk/threads/${threadId}/asked`, { method: 'POST', body: '{}' }, token);
}

/** Remove a single remembered fact (privacy "forget this"). */
export async function forgetFact(
  childId: string,
  language: LanguageCode,
  fact: string,
  token: string,
): Promise<void> {
  await request(
    `/talk/memory/${childId}/forget`,
    {
      method: 'POST',
      body: JSON.stringify({ language, fact }),
    },
    token,
  );
}

/**
 * Flush memory extraction when the Talk screen closes (so short sessions don't lose
 * events). Returns `sensitive: true` if anything distressing surfaced today — the
 * client raises a neutral, real-time parent alert.
 */
export async function postSessionEnd(
  childId: string,
  conversationId: string,
  language: LanguageCode,
  childName?: string | null,
  token?: string | null,
): Promise<{ ok: boolean; sensitive: boolean }> {
  return request<{ ok: boolean; sensitive: boolean }>(
    '/talk/session-end',
    {
      method: 'POST',
      body: JSON.stringify({ childId, conversationId, language, childName }),
    },
    token,
  );
}

export interface ReviewItem {
  kind: 'word_game' | 'grammar';
  prompt: string;
  correct: string;
  given: string;
  day: number;
  date: string;
}

export async function getReviewItems(
  childId: string,
  language: LanguageCode,
  token: string,
  limit = 15,
): Promise<ReviewItem[]> {
  const res = await request<{ items: ReviewItem[] }>(
    `/progress/${childId}/errors?language=${language}&limit=${limit}`,
    {},
    token,
  );
  return res.items;
}

export interface ChildFact {
  category: 'interests' | 'family' | 'pets' | 'routine' | 'recent_event' | 'preferences';
  fact: string;
  mentionedAt: string;
}

export interface BoboMemory {
  facts: ChildFact[];
  thingsToAskBack: string[];
  lastInteractionDate: string | null;
}

export async function getBoboMemory(
  childId: string,
  language: LanguageCode,
  token: string,
): Promise<BoboMemory> {
  return request<BoboMemory>(`/talk/memory/${childId}?language=${language}`, {}, token);
}

export interface WordCheckResult {
  heard: string;
  matched: boolean;
  confidence: number;
}

export async function postWordCheck(
  childId: string,
  language: LanguageCode,
  expectedWord: string,
  audioBase64: string,
  token?: string | null,
  audioMimeType = 'audio/m4a',
): Promise<WordCheckResult> {
  return request<WordCheckResult>(
    '/talk/word-check',
    {
      method: 'POST',
      body: JSON.stringify({
        childId,
        language,
        expectedWord,
        audioBase64,
        audioMimeType,
      }),
    },
    token,
  );
}

export async function postTalk(
  payload: TalkRequestPayload,
  token?: string | null,
): Promise<TalkResponsePayload> {
  return request<TalkResponsePayload>(
    '/talk',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    token,
  );
}

/** Flag one of Бобо's AI replies as inappropriate/wrong (Google Play GenAI req.). */
export async function reportAiMessage(
  report: { childId?: string; conversationId: string; messageText: string; reason?: string },
  token?: string | null,
): Promise<void> {
  await request(
    '/talk/report',
    {
      method: 'POST',
      body: JSON.stringify(report),
    },
    token,
  );
}

// ── AI listening stories (per-child, saved for re-listen) ─────────────────────

export interface ListeningQuestionDTO {
  q: string;
  options: string[];
  correct: number;
}
export interface ListeningPhraseDTO {
  text: string;
  translation: string;
}
export interface ListeningStory {
  id: string;
  title: string;
  text: string;
  questions: ListeningQuestionDTO[];
  phrases: ListeningPhraseDTO[];
  audioBase64: string;
  audioMimeType: string;
  ttsStubbed?: boolean;
}
export interface ListeningStoryMeta {
  id: string;
  title: string;
  level: string;
  language: string;
  createdAt: string;
}

export async function generateListeningStory(
  childId: string,
  language: LanguageCode,
  token: string,
  level?: string,
  topic?: string,
): Promise<ListeningStory> {
  return request<ListeningStory>(
    '/listening/generate',
    {
      method: 'POST',
      body: JSON.stringify({ childId, language, level, topic }),
    },
    token,
  );
}

export async function getListeningStories(
  childId: string,
  token: string,
): Promise<ListeningStoryMeta[]> {
  return request<ListeningStoryMeta[]>(`/listening/${childId}`, {}, token);
}

export async function getListeningStory(id: string, token: string): Promise<ListeningStory> {
  return request<ListeningStory>(`/listening/story/${id}`, {}, token);
}

export interface ConversationRecord {
  id: string;
  childId: string;
  language: string;
  day: number;
  turns: { role: 'child' | 'bobo'; text: string }[];
  createdAt: string;
  updatedAt: string;
}

export async function getTranscripts(
  childId: string,
  token: string,
  language?: string,
): Promise<ConversationRecord[]> {
  const qs = language ? `?language=${language}` : '';
  const res = await request<{ conversations: ConversationRecord[] }>(
    `/talk/transcripts/${childId}${qs}`,
    {},
    token,
  );
  return res.conversations;
}

export interface HintResponse {
  suggestion: string;
}

export async function getTalkHint(
  language: 'en' | 'ru',
  day: number,
  level: string,
  childName: string | null,
  recentBoboLine: string | null,
  token?: string | null,
): Promise<HintResponse> {
  return request<HintResponse>(
    '/talk/hint',
    {
      method: 'POST',
      body: JSON.stringify({ language, day, level, childName, recentBoboLine }),
    },
    token,
  );
}

// ── Photo Learn (GPT-4o Vision) ──────────────────────────────────────────────

export interface PhotoLearnItem {
  word: string;
  translation: string;
  example: string;
  emoji: string;
}

export interface PhotoLearnResponse {
  summary: string;
  items: PhotoLearnItem[];
}

export async function postPhotoLearn(
  imageBase64: string,
  targetLanguage: 'en' | 'ru',
  uiLanguage: 'ru' | 'az',
  level: 'beginner' | 'elementary' | 'pre_intermediate' | 'intermediate',
  token: string,
): Promise<PhotoLearnResponse> {
  return request<PhotoLearnResponse>(
    '/photo-learn',
    {
      method: 'POST',
      body: JSON.stringify({
        imageBase64,
        imageMimeType: 'image/jpeg',
        targetLanguage,
        uiLanguage,
        level,
      }),
    },
    token,
  );
}

// ── Songs / Karaoke ──────────────────────────────────────────────────────────

export interface SongResponse {
  lyrics: string[];
  audioBase64: string;
  audioMimeType: string;
}

export async function postSong(
  vocab: string[],
  language: 'en' | 'ru',
  theme: string | undefined,
  token: string,
): Promise<SongResponse> {
  return request<SongResponse>(
    '/song',
    {
      method: 'POST',
      body: JSON.stringify({ vocab, language, theme }),
    },
    token,
  );
}

// ── AI Tools ──────────────────────────────────────────────────────────────────

export async function analyzeInterests(text: string, lang: 'ru' | 'az'): Promise<string[]> {
  try {
    const result = await request<{ tags: string[] }>('/ai/interests', {
      method: 'POST',
      body: JSON.stringify({ text, lang }),
    });
    return result.tags ?? [];
  } catch {
    return [];
  }
}
