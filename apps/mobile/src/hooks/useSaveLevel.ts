/**
 * Сохранить уровень языка: на сервере — через `/children/:id/preferences`, чтобы
 * пересобрались будущие уроки (просто записать поле мало: план строится под
 * уровень), затем обновить кэш плана и стор.
 *
 * Без входа (гость без профиля на сервере) уровень меняется только на телефоне.
 */

import { useState } from 'react';

import { updatePreferences } from '@/services/api';
import { fetchFullCurriculum } from '@/services/curriculum';
import { useSettings, type ChildLevel } from '@/store/settings';

export function useSaveLevel() {
  const childId = useSettings((s) => s.childId);
  const token = useSettings((s) => s.authToken);
  const childName = useSettings((s) => s.childName) ?? '';
  const childAge = useSettings((s) => s.childAge) ?? 10;
  const learningLanguages = useSettings((s) => s.learningLanguages);
  const setChildProfile = useSettings((s) => s.setChildProfile);

  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  const save = async (level: ChildLevel): Promise<boolean> => {
    if (saving) return false;
    setSaving(true);
    setFailed(false);
    try {
      if (childId && token) {
        await updatePreferences(childId, { level }, token);
        await Promise.all(
          learningLanguages.map((l) => fetchFullCurriculum(childId, l, token).catch(() => 0)),
        );
      }
      setChildProfile(childName, childAge, level);
      return true;
    } catch {
      setFailed(true);
      return false;
    } finally {
      setSaving(false);
    }
  };

  return { save, saving, failed };
}
