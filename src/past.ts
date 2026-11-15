/**
 * The last 7 days before today, for swiping back through days on Today.
 *
 * - Preloaded while Today is open (one getDay per day, all at once), so a
 *   swipe shows the day straight away, with its meals.
 * - Kept on the phone (localStorage), so swipes work instantly right after
 *   opening the app, even before the sheet answers.
 * - Reloaded at most every 10 minutes; changes made on this phone (save to
 *   an earlier day, delete, undo) update the saved copy straight away.
 */

import { dateString } from './dates';
import type { DayResponse } from './sheet';

export const PAST_DAYS = 7;
const KEY = 'macro-tracker.past';
const MAX_AGE_MS = 10 * 60 * 1000;

export type PastDays = { loadedAt: number; days: Record<string, DayResponse> };

/** Dates of the past days, newest first: [yesterday, ..., 7 days ago]. */
export function pastDates(): string[] {
  return Array.from({ length: PAST_DAYS }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (i + 1));
    return dateString(d);
  });
}

export function loadCachedPast(): PastDays {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as PastDays | null;
    if (saved?.days) return saved;
  } catch {
    // unreadable: start empty
  }
  return { loadedAt: 0, days: {} };
}

export function cachePast(past: PastDays): void {
  try {
    // Only keep the days that are still in the 7-day window.
    const keep = new Set(pastDates());
    const days = Object.fromEntries(Object.entries(past.days).filter(([d]) => keep.has(d)));
    localStorage.setItem(KEY, JSON.stringify({ ...past, days }));
  } catch {
    // storage full or blocked: swipes still work once loaded
  }
}

/** True when the saved copy is old or misses one of the 7 days. */
export function pastIsStale(past: PastDays): boolean {
  return Date.now() - past.loadedAt > MAX_AGE_MS || pastDates().some((d) => !past.days[d]);
}
