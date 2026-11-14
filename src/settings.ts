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

// gemini-3.5-flash (named in SPEC.md) no longer exists; 3.6-flash is the
// current stable free Flash model that answered reliably in tests (Nov 2026).
export const DEFAULT_MODEL = 'gemini-3.6-flash';

// Used once automatically when the main model is rate-limited, busy or slow.
export const FALLBACK_MODEL = 'gemini-3.1-flash-lite';

const STORAGE_KEY = 'macro-tracker.settings';

const DEFAULTS: Settings = { geminiKey: '', sheetUrl: '', token: '', model: DEFAULT_MODEL };

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const settings: Settings = raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
    // Milestone 2 saved the spec's model name, which Google has since retired.
    if (settings.model === 'gemini-3.5-flash') settings.model = DEFAULT_MODEL;
    return settings;
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
