'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { POTION_PILOT_WINDOW } from '@/app/lib/analytics/potion-config';
import { enqueueGameActivity, excludePilotInCurrentTab, PILOT_EXCLUDED_KEY,
  recordPilotSiteActivity } from '@/app/lib/analytics/potion-client';
import { POTION_ACTIVITY_EVENT } from '@/app/lib/games/potion-timing/types';

export function PotionRetentionProvider(): null {
  const pathname = usePathname();
  useEffect(() => {
    if (!POTION_PILOT_WINDOW || /^\/admin(?:\/|$)/.test(pathname ?? '')) return;
    const onGame = (event: Event) => enqueueGameActivity((event as CustomEvent).detail);
    const onActivity = () => recordPilotSiteActivity();
    const onReturn = () => recordPilotSiteActivity(true);
    const onStorage = (event: StorageEvent) => {
      if (event.key === PILOT_EXCLUDED_KEY && event.newValue === '1') excludePilotInCurrentTab();
    };
    window.addEventListener(POTION_ACTIVITY_EVENT, onGame);
    window.addEventListener('pageshow', onReturn);
    window.addEventListener('storage', onStorage);
    document.addEventListener('visibilitychange', onReturn);
    document.addEventListener('pointerdown', onActivity, { passive: true });
    document.addEventListener('keydown', onActivity);
    onReturn();
    return () => {
      window.removeEventListener(POTION_ACTIVITY_EVENT, onGame);
      window.removeEventListener('pageshow', onReturn);
      window.removeEventListener('storage', onStorage);
      document.removeEventListener('visibilitychange', onReturn);
      document.removeEventListener('pointerdown', onActivity);
      document.removeEventListener('keydown', onActivity);
    };
  }, [pathname]);
  return null;
}
