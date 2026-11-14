/**
 * Settings are stored only on this phone, in localStorage.
 * The Gemini key, sheet URL and token are never put in the code or logged.
 */

export type Settings = {
  geminiKey: string; // Gemini API key from Google AI Studio
  sheetUrl: string;  // Apps Script web app URL (ends in /exec)
  token: string;     // secret token that the Apps Script checks
  model: string;     // Gemini model ID
};

export const DEFAULT_MODEL = 'gemini-3.5-flash';

const STORAGE_KEY = 'macro-tracker.settings';

const DEFAULTS: Settings = { geminiKey: '', sheetUrl: '', token: '', model: DEFAULT_MODEL };

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(settings: Settings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

/** True when the sheet connection is filled in. */
export function hasSheet(settings: Settings): boolean {
  return Boolean(settings.sheetUrl && settings.token);
}
