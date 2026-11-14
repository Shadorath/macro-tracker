/**
 * Settings screen.
 *
 * - Goals first (used most): kcal, protein, fat, carbs. Saved to the sheet's
 *   Goals tab with setGoals and kept on the phone for offline display.
 *   Helper: enter kcal and a protein / fat / carbs split in %, and it fills
 *   the gram fields (protein and carbs 4 kcal per g, fat 9 kcal per g).
 * - Connection: Gemini key, Apps Script URL, token, Test connection.
 * - Advanced: the Gemini model.
 *
 * Tap budget for changing a goal: Settings, the goal field, Save.
 */

import { useState } from 'preact/hooks';
import { DEFAULT_MODEL, FALLBACK_MODEL, hasSheet, loadSettings, saveSettings, type Settings } from '../settings';
import { callSheet, errorMessage, setGoals, type DayResponse, type Totals } from '../sheet';
import { cachedGoals } from '../day';
import { dateString } from '../dates';
import { checkGemini, geminiMessage } from '../gemini';

type Status = { kind: 'idle' | 'busy' | 'ok' | 'error'; text: string };

type GoalFields = { kcal: string; protein_g: string; fat_g: string; carbs_g: string };

/** Removes spaces people often paste by accident; empty model = default. */
function cleaned(form: Settings): Settings {
  return {
    geminiKey: form.geminiKey.trim(),
    sheetUrl: form.sheetUrl.trim(),
    token: form.token.trim(),
    model: form.model.trim() || DEFAULT_MODEL,
  };
}

/** Returns a one-line problem, or null when the connection looks fine. */
function checkForm(form: Settings): string | null {
  if (form.sheetUrl && !/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(form.sheetUrl)) {
    return 'The Apps Script URL should start with https://script.google.com/macros/s/ and end with /exec.';
  }
  return null;
}

const num = (v: string) => Number(v.trim().replace(',', '.'));

/** The goal fields as numbers, or a one-line problem. */
function readGoals(g: GoalFields): Totals | string {
  const goals = { kcal: num(g.kcal), protein_g: num(g.protein_g), fat_g: num(g.fat_g), carbs_g: num(g.carbs_g) };
  if (Object.values(goals).some((v) => !isFinite(v) || v <= 0)) return 'Each goal needs a number above 0.';
  return { kcal: Math.round(goals.kcal), protein_g: Math.round(goals.protein_g), fat_g: Math.round(goals.fat_g), carbs_g: Math.round(goals.carbs_g) };
}

export function SettingsScreen({ onClose, onGoalsSaved }: {
  onClose: () => void;
  onGoalsSaved: (goals: Totals) => void;
}) {
  const [form, setForm] = useState<Settings>(loadSettings);
  const [status, setStatus] = useState<Status>({ kind: 'idle', text: '' });
  const [saveStatus, setSaveStatus] = useState<Status>({ kind: 'idle', text: '' });
  const [startGoals] = useState<Totals>(cachedGoals);
  const [goals, setGoalFields] = useState<GoalFields>(() => ({
    kcal: String(startGoals.kcal),
    protein_g: String(startGoals.protein_g),
    fat_g: String(startGoals.fat_g),
    carbs_g: String(startGoals.carbs_g),
  }));

  // Updates one connection field as you type.
  const update = (key: keyof Settings) => (e: Event) => {
    const value = (e.currentTarget as HTMLInputElement).value;
    setForm((prev) => ({ ...prev, [key]: value })); // build on the latest values
    if (status.kind === 'error') setStatus({ kind: 'idle', text: '' });
  };

  // Updates one goal field as you type.
  const updateGoal = (key: keyof GoalFields) => (e: Event) => {
    const value = (e.currentTarget as HTMLInputElement).value;
    setGoalFields((prev) => ({ ...prev, [key]: value }));
    if (saveStatus.kind === 'error') setSaveStatus({ kind: 'idle', text: '' });
  };

  // Checks the sheet (asks for today's data) and the Gemini key, using what's
  // typed in the fields (saved or not). One line of result for each.
  async function testConnection() {
    const f = cleaned(form);
    const problem = checkForm(f);
    if (problem) return setStatus({ kind: 'error', text: problem });
    if (!f.sheetUrl || !f.token) {
      return setStatus({ kind: 'error', text: 'Enter the Apps Script URL and token first.' });
    }

    // No internet: one clear line instead of two failures.
    if (!navigator.onLine) return setStatus({ kind: 'error', text: 'No internet. Connect and test again.' });

    setStatus({ kind: 'busy', text: 'Testing…' });
    const [sheet, gemini] = await Promise.allSettled([
      callSheet<DayResponse>(f, 'getDay', { date: dateString() }),
      checkGemini(f.geminiKey, f.model),
    ]);

    const sheetLine = sheet.status === 'fulfilled'
      ? `Sheet connected. Today: ${sheet.value.totals.kcal} of ${sheet.value.goals.kcal} kcal eaten.`
      : errorMessage(sheet.reason);
    const geminiLine = gemini.status === 'fulfilled'
      ? `Gemini key works (${f.model}).`
      : geminiMessage(gemini.reason);

    const allOk = sheet.status === 'fulfilled' && gemini.status === 'fulfilled';
    setStatus({ kind: allOk ? 'ok' : 'error', text: `${sheetLine}\n${geminiLine}` });
  }

  // Saves the connection on the phone, and the goals to the sheet (only if
  // they changed). Stays open with a one-line error if something fails.
  async function save() {
    const f = cleaned(form);
    const problem = checkForm(f);
    if (problem) return setSaveStatus({ kind: 'error', text: problem });
    const g = readGoals(goals);
    if (typeof g === 'string') return setSaveStatus({ kind: 'error', text: g });

    saveSettings(f);

    const changed = (Object.keys(g) as (keyof Totals)[]).some((k) => g[k] !== startGoals[k]);
    if (changed) {
      if (!hasSheet(f)) {
        return setSaveStatus({ kind: 'error', text: 'Connect your sheet below to save goals.' });
      }
      setSaveStatus({ kind: 'busy', text: '' });
      try {
        const result = await setGoals(f, g);
        onGoalsSaved(result.goals);
      } catch (err) {
        return setSaveStatus({ kind: 'error', text: errorMessage(err) });
      }
    }
    onClose();
  }

  // Shared props for secret and technical fields: no autocorrect or capitals.
  const plain = { autocomplete: 'off', autocapitalize: 'none', spellcheck: false } as const;

  const goalField = (key: keyof GoalFields, id: string, label: string) => (
    <div class="field">
      <label for={id}>{label}</label>
      <input id={id} type="number" inputMode="numeric" min="1" value={goals[key]} onInput={updateGoal(key)} />
    </div>
  );

  return (
    <main class="screen">
      <div class="topbar">
        <h1>Settings</h1>
        <button onClick={onClose}>Cancel</button>
      </div>

      <section class="card" aria-labelledby="goals-title">
        <h2 id="goals-title">Daily goals</h2>
        <div class="grid-2">
          {goalField('kcal', 'goal-kcal', 'Calories (kcal)')}
          {goalField('protein_g', 'goal-protein', 'Protein (g)')}
          {goalField('fat_g', 'goal-fat', 'Fat (g)')}
          {goalField('carbs_g', 'goal-carbs', 'Carbs (g)')}
        </div>
        <SplitHelper
          kcal={num(goals.kcal)}
          current={goals}
          onFill={(grams) => setGoalFields((prev) => ({ ...prev, ...grams }))}
        />
      </section>

      <section class="card" aria-labelledby="connection-title">
        <h2 id="connection-title">Connection</h2>

        <div class="field">
          <label for="gemini-key">Gemini API key</label>
          <input id="gemini-key" type="password" value={form.geminiKey} onInput={update('geminiKey')} {...plain} />
        </div>

        <div class="field">
          <label for="sheet-url">Apps Script URL</label>
          <input id="sheet-url" type="url" inputMode="url" value={form.sheetUrl} onInput={update('sheetUrl')}
            placeholder="https://script.google.com/macros/s/…/exec" {...plain} />
        </div>

        <div class="field">
          <label for="token">Token</label>
          <input id="token" type="password" value={form.token} onInput={update('token')} {...plain} />
        </div>

        <div>
          <button class="text-btn" onClick={testConnection} disabled={status.kind === 'busy'}>
            Test connection
          </button>
          {status.text && (
            <p class={`status${status.kind === 'error' ? ' error' : ''}`} role="status">{status.text}</p>
          )}
        </div>
      </section>

      <details>
        <summary>Advanced</summary>
        <div class="field">
          <label for="model">Gemini model</label>
          <input id="model" type="text" value={form.model} onInput={update('model')} placeholder={DEFAULT_MODEL} {...plain} />
        </div>
        <p class="hint">If this model is busy or the free limit is reached, the app retries once with {FALLBACK_MODEL}.</p>
      </details>

      <div class="bottom-bar">
        {saveStatus.kind === 'error' && <p class="status error" role="alert">{saveStatus.text}</p>}
        <button class="btn-primary" onClick={save} disabled={saveStatus.kind === 'busy'}>
          {saveStatus.kind === 'busy' ? 'Saving…' : 'Save'}
        </button>
      </div>
    </main>
  );
}

/**
 * "Calculate from kcal and %": enter a protein / fat / carbs split and it
 * fills the gram fields from the kcal goal (P and C 4 kcal/g, F 9 kcal/g).
 */
function SplitHelper({ kcal, current, onFill }: {
  kcal: number;
  current: GoalFields;
  onFill: (grams: Pick<GoalFields, 'protein_g' | 'fat_g' | 'carbs_g'>) => void;
}) {
  // Start from the split the current goals already make.
  const [pct, setPct] = useState(() => {
    const k = num(current.kcal) || 1;
    const p = Math.round((num(current.protein_g) * 4 * 100) / k);
    const f = Math.round((num(current.fat_g) * 9 * 100) / k);
    return { protein: String(p), fat: String(f), carbs: String(Math.max(0, 100 - p - f)) };
  });
  const [error, setError] = useState('');
  const total = num(pct.protein) + num(pct.fat) + num(pct.carbs);

  const set = (k: keyof typeof pct) => (e: Event) => {
    const value = (e.currentTarget as HTMLInputElement).value;
    setPct((prev) => ({ ...prev, [k]: value }));
    setError('');
  };

  function fill() {
    if (!(kcal > 0)) return setError('Enter the calories goal first.');
    if (Math.round(total) !== 100) return setError(`The three % should add up to 100 (now ${Math.round(total)} %).`);
    onFill({
      protein_g: String(Math.round((kcal * num(pct.protein)) / 100 / 4)),
      fat_g: String(Math.round((kcal * num(pct.fat)) / 100 / 9)),
      carbs_g: String(Math.round((kcal * num(pct.carbs)) / 100 / 4)),
    });
  }

  const pctField = (k: keyof typeof pct, label: string) => (
    <div class="field">
      <label>
        {label}
        <input type="number" inputMode="numeric" min="0" max="100" value={pct[k]} onInput={set(k)} />
      </label>
    </div>
  );

  return (
    <details class="split-helper">
      <summary>Calculate from kcal and %</summary>
      <div class="grid-3">
        {pctField('protein', 'Protein %')}
        {pctField('fat', 'Fat %')}
        {pctField('carbs', 'Carbs %')}
      </div>
      {error
        ? <p class="status error">{error}</p>
        : <p class="hint">Total {Math.round(total)} % of {kcal > 0 ? `${kcal} kcal` : 'your calories goal'}.</p>}
      <button class="text-btn" type="button" onClick={fill}>Fill in grams</button>
    </details>
  );
}
