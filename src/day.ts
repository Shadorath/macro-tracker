/**
 * Today's data (meals, totals, goals).
 *
 * - Kept on the phone (localStorage) so the Today screen shows numbers
 *   instantly when the app opens, then refreshes quietly from the sheet.
 * - Updated locally right after a save or undo, without waiting for the sheet.
 */

import { dateString } from './dates';
import type { DayResponse, Meal, Totals } from './sheet';

const DAY_KEY = 'macro-tracker.day';
const GOALS_KEY = 'macro-tracker.goals';

// The spec's placeholder goals, used until the sheet has answered once.
export const DEFAULT_GOALS: Totals = { kcal: 2200, protein_g: 150, fat_g: 70, carbs_g: 220 };

const ZERO: Totals = { kcal: 0, protein_g: 0, fat_g: 0, carbs_g: 0 };

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function cachedGoals(): Totals {
  return read<Totals>(GOALS_KEY) ?? DEFAULT_GOALS;
}

export function emptyDay(date: string = dateString()): DayResponse {
  return { date, meals: [], totals: { ...ZERO }, goals: cachedGoals() };
}

/** Today's saved data, or an empty day if what's saved is from another day. */
export function loadCachedDay(): DayResponse {
  const today = dateString();
  const saved = read<DayResponse>(DAY_KEY);
  return saved && saved.date === today ? saved : emptyDay(today);
}

export function cacheDay(day: DayResponse): void {
  try {
    localStorage.setItem(DAY_KEY, JSON.stringify(day));
    localStorage.setItem(GOALS_KEY, JSON.stringify(day.goals));
  } catch {
    // Storage full or blocked: the app still works, it just won't open instantly.
  }
}

function sum(meals: Meal[]): Totals {
  const t = meals.reduce(
    (a, m) => ({
      kcal: a.kcal + m.totals.kcal,
      protein_g: a.protein_g + m.totals.protein_g,
      fat_g: a.fat_g + m.totals.fat_g,
      carbs_g: a.carbs_g + m.totals.carbs_g,
    }),
    { ...ZERO },
  );
  return { kcal: Math.round(t.kcal), protein_g: t.protein_g, fat_g: t.fat_g, carbs_g: t.carbs_g };
}

/** The day with one more meal (kept in time order). */
export function withMeal(day: DayResponse, meal: Meal): DayResponse {
  const meals = [...day.meals.filter((m) => m.id !== meal.id), meal].sort((a, b) =>
    a.timestamp.localeCompare(b.timestamp));
  return { ...day, meals, totals: sum(meals) };
}

/** The day without a meal. */
export function withoutMeal(day: DayResponse, mealId: string): DayResponse {
  const meals = day.meals.filter((m) => m.id !== mealId);
  return { ...day, meals, totals: sum(meals) };
}
