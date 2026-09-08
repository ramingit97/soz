import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Tracks the OS "Reduce Motion" accessibility setting. Honeybear Pro motion
 * (breathing, squish, stagger) is gated on this — when enabled we keep only
 * essential press feedback. Required for an app aimed at young children.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => {
        if (mounted) setReduced(v);
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (v) =>
      setReduced(v),
    );
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  return reduced;
}
