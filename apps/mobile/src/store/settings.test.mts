/**
 * Новый профиль начинается с чистого листа, но с тем же аккаунтом.
 *
 * Баг с device QA: имя питомца из прошлого теста («Ппп») всплывало в новом
 * онбординге — petName лежит в AsyncStorage и ничем не сбрасывался. Обратная
 * ошибка не лучше: если сброс заденет токен или согласие, родитель, добавляющий
 * второго ребёнка, окажется разлогинен посреди настройки.
 *
 * AsyncStorage заглушён — проверяется поведение стора, а не React Native.
 */

import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';

const store = new Map<string, string>();
mock.module('@react-native-async-storage/async-storage', {
  defaultExport: {
    getItem: async (k: string) => store.get(k) ?? null,
    setItem: async (k: string, v: string) => void store.set(k, v),
    removeItem: async (k: string) => void store.delete(k),
  },
});

const { useSettings, focusToLessonPrefs } = await import('./settings.js');

function fillWithPreviousChild() {
  useSettings.setState({
    authToken: 'token-1',
    userId: 'user-1',
    isGuestAccount: true,
    parentUILanguage: 'az',
    audioConsent: true,
    onboardingComplete: true,
    learningLanguages: ['en', 'ru'],
    isPremium: true,
    childId: 'child-1',
    childName: 'Ппп',
    childAge: 6,
    childAgeRange: '5-7',
    childAgeBand: 'young',
    childLevel: 'elementary',
    petName: 'Ппп',
    petHue: 300,
    childInterests: ['космос'],
    learningFocus: ['speaking'],
    goal: 'school',
    goalsAll: ['school'],
    currentDay: 5,
    totalStars: 40,
    streak: 3,
    lastCompletedDate: '2026-09-13',
    starsEarnedToday: 12,
  });
}

describe('startNewProfileSetup', () => {
  it('стирает всё, что принадлежит прошлому ребёнку', () => {
    fillWithPreviousChild();
    useSettings.getState().startNewProfileSetup('kid');
    const s = useSettings.getState();
    assert.equal(s.petName, null);
    assert.equal(s.petHue, 55);
    assert.equal(s.childId, null);
    assert.equal(s.childName, null);
    assert.equal(s.childAge, null);
    assert.equal(s.childAgeRange, null);
    assert.equal(s.childAgeBand, null);
    assert.equal(s.childLevel, null);
    assert.deepEqual(s.childInterests, []);
    assert.deepEqual(s.learningFocus, []);
    assert.equal(s.goal, null);
    assert.equal(s.currentDay, 1);
    assert.equal(s.totalStars, 0);
    assert.equal(s.streak, 0);
    assert.equal(s.lastCompletedDate, null);
    assert.equal(s.starsEarnedToday, 0);
    assert.equal(s.profileType, 'kid');
  });

  it('не трогает аккаунт, язык интерфейса, согласие и подписку', () => {
    fillWithPreviousChild();
    useSettings.getState().startNewProfileSetup('kid');
    const s = useSettings.getState();
    assert.equal(s.authToken, 'token-1');
    assert.equal(s.userId, 'user-1');
    assert.equal(s.isGuestAccount, true);
    assert.equal(s.parentUILanguage, 'az');
    assert.equal(s.audioConsent, true);
    assert.equal(s.onboardingComplete, true);
    assert.deepEqual(s.learningLanguages, ['en', 'ru']);
    assert.equal(s.isPremium, true);
  });

  it('профиль «для себя» сразу получает взрослый регистр', () => {
    fillWithPreviousChild();
    useSettings.getState().startNewProfileSetup('adult');
    const s = useSettings.getState();
    assert.equal(s.profileType, 'adult');
    assert.equal(s.childAgeBand, 'adult');
  });
});

describe('focusToLessonPrefs', () => {
  it('каждый упор включает только свой переключатель', () => {
    assert.deepEqual(focusToLessonPrefs(['speaking']), { moreTalk: true });
    assert.deepEqual(focusToLessonPrefs(['listening']), { moreListening: true });
    assert.deepEqual(focusToLessonPrefs(['words']), { moreWords: true });
  });

  it('«всё понемногу» — пустой выбор, без переключателей', () => {
    assert.deepEqual(focusToLessonPrefs([]), {});
  });
});

describe('markLessonStep', () => {
  it('копит шаги дня и стирает прошлые дни того же ребёнка и языка', () => {
    useSettings.setState({ lessonStepsDone: {} });
    const { markLessonStep } = useSettings.getState();
    markLessonStep('child-1', 'en', 1, 'words');
    markLessonStep('child-1', 'en', 1, 'grammar');
    markLessonStep('child-1', 'en', 1, 'words');
    markLessonStep('child-2', 'en', 4, 'words');
    assert.deepEqual(useSettings.getState().lessonStepsDone['child-1:en:1'], ['words', 'grammar']);

    markLessonStep('child-1', 'en', 2, 'words');
    const s = useSettings.getState().lessonStepsDone;
    assert.equal(s['child-1:en:1'], undefined);
    assert.deepEqual(s['child-1:en:2'], ['words']);
    assert.deepEqual(s['child-2:en:4'], ['words'], 'другой ребёнок не задет');
  });
});
