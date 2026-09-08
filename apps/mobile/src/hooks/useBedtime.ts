/**
 * useBedtime — resolves the effective night/day theme based on user prefs.
 * - 'off' → never night
 * - 'on' → always night
 * - 'auto' → night between 20:00 and 07:00 local time
 */

import { useEffect, useState } from 'react';

import { useSettings } from '@/store/settings';

function isNightHour(): boolean {
  const h = new Date().getHours();
  return h >= 20 || h < 7;
}

export function useBedtime(): boolean {
  const mode = useSettings((s) => s.bedtimeMode);
  const [autoNight, setAutoNight] = useState<boolean>(() => isNightHour());

  useEffect(() => {
    if (mode !== 'auto') return;
    // Re-check every 5 minutes — covers the 20:00 / 07:00 boundary
    const tick = () => setAutoNight(isNightHour());
    const id = setInterval(tick, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [mode]);

  if (mode === 'off') return false;
  if (mode === 'on') return true;
  return autoNight;
}
