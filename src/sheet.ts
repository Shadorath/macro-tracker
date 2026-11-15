/**
 * Talks to the Apps Script web app (see apps-script/Code.gs).
 *
 * Every call is a POST with a JSON body. It is sent as text/plain so the
 * browser skips the CORS "preflight" check that Apps Script can't answer.
 */

import type { Settings } from './settings';

export type Totals = { kcal: number; protein_g: number; fat_g: number; carbs_g: number };

export type MealItem = Totals & { name: string; grams: number; confidence: string };

export type Meal = {
  id: string;
  timestamp: string; // "2026-11-14 12:35"
  time: string;      // "12:35"
  type: string;      // Breakfast / Lunch / Dinner / Snack
  name: string;
  source: string;    // photo / manual
  note: string;
  items: MealItem[];
  totals: Totals;
};

export type DayResponse = { date: string; meals: Meal[]; totals: Totals; goals: Totals };

/** What went wrong, so screens can show the right one-line message. */
export type SheetErrorKind = 'setup' | 'offline' | 'timeout' | 'token' | 'url' | 'server';

export class SheetError extends Error {
  kind: SheetErrorKind;
  constructor(kind: SheetErrorKind, message: string) {
    super(message);
    this.kind = kind;
  }
}

const TIMEOUT_MS = 20_000;

/**
 * Calls one action on the sheet and returns its answer.
 * Throws a SheetError with a plain one-line message when something fails.
 */
export async function callSheet<T>(
  settings: Pick<Settings, 'sheetUrl' | 'token'>,
  action: string,
  data: Record<string, unknown> = {},
): Promise<T> {
  if (!settings.sheetUrl || !settings.token) {
    throw new SheetError('setup', 'Add the Apps Script URL and token in Settings.');
  }

  // Give up after 20 seconds so the app never hangs.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(settings.sheetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ ...data, action, token: settings.token }),
      signal: controller.signal,
    });
  } catch {
    if (controller.signal.aborted) throw new SheetError('timeout', 'The sheet took too long to answer. Try again.');
    if (!navigator.onLine) throw new SheetError('offline', 'No internet. Check your connection and try again.');
    throw new SheetError('url', "Couldn't reach the Apps Script URL. Check it in Settings.");
  } finally {
    clearTimeout(timer);
  }

  let body: { ok?: boolean; error?: string };
  try {
    body = await response.json();
  } catch {
    throw new SheetError('url', "The Apps Script URL didn't answer as expected. Check it in Settings.");
  }

  if (!body.ok) {
    if (body.error === 'unauthorized') {
      throw new SheetError('token', 'The sheet rejected the token. Check it in Settings.');
    }
    throw new SheetError('server', `The sheet said: ${body.error ?? 'unknown error'}`);
  }

  return body as T;
}

// ---------------------------------------------------------------------------
// The actions the app uses
// ---------------------------------------------------------------------------

type Conn = Pick<Settings, 'sheetUrl' | 'token'>;

/** Today's (or any day's) meals, totals and goals. */
export function getDay(settings: Conn, date: string): Promise<DayResponse> {
  return callSheet<DayResponse>(settings, 'getDay', { date });
}

/** Saves one meal: one Log row per item. */
export function addMeal(settings: Conn, meal: Meal): Promise<{ mealId: string }> {
  return callSheet(settings, 'addMeal', {
    meal: {
      id: meal.id,
      timestamp: meal.timestamp,
      type: meal.type,
      name: meal.name,
      source: meal.source,
      note: meal.note,
    },
    items: meal.items.map((i) => ({
      name: i.name,
      grams: i.grams,
      kcal: i.kcal,
      protein_g: i.protein_g,
      fat_g: i.fat_g,
      carbs_g: i.carbs_g,
      confidence: i.confidence,
    })),
  });
}

// (The script also has "getRange", no longer used since Past days was removed.)

/** Writes the four daily goals to the Goals tab. */
export function setGoals(settings: Conn, goals: Totals): Promise<{ goals: Totals }> {
  return callSheet(settings, 'setGoals', { goals });
}

/** Removes all Log rows of one meal. */
export function deleteMeal(settings: Conn, mealId: string): Promise<{ deleted: number }> {
  return callSheet(settings, 'deleteMeal', { mealId });
}

/** Turns any thrown error into one line of text for the screen. */
export function errorMessage(err: unknown): string {
  if (err instanceof SheetError) return err.message;
  return 'Something went wrong. Try again.';
}
