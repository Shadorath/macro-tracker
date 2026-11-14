/**
 * Settings screen.
 * Milestone 2: Connection (Gemini key, Apps Script URL, token) and the model
 * under Advanced. The Goals group is added at the top in milestone 5.
 */

import { useState } from 'preact/hooks';
import { DEFAULT_MODEL, loadSettings, saveSettings, type Settings } from '../settings';
import { callSheet, errorMessage, type DayResponse } from '../sheet';
import { dateString } from '../dates';

type Status = { kind: 'idle' | 'busy' | 'ok' | 'error'; text: string };

/** Removes spaces people often paste by accident; empty model = default. */
function cleaned(form: Settings): Settings {
  return {
    geminiKey: form.geminiKey.trim(),
    sheetUrl: form.sheetUrl.trim(),
    token: form.token.trim(),
    model: form.model.trim() || DEFAULT_MODEL,
  };
}

/** Returns a one-line problem, or null when the form looks fine. */
function checkForm(form: Settings): string | null {
  if (form.sheetUrl && !/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(form.sheetUrl)) {
    return 'The Apps Script URL should start with https://script.google.com/macros/s/ and end with /exec.';
  }
  return null;
}

export function SettingsScreen({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState<Settings>(loadSettings);
  const [status, setStatus] = useState<Status>({ kind: 'idle', text: '' });

  // Updates one field as you type.
  const update = (key: keyof Settings) => (e: Event) => {
    setForm({ ...form, [key]: (e.currentTarget as HTMLInputElement).value });
    if (status.kind === 'error') setStatus({ kind: 'idle', text: '' });
  };

  // Asks the sheet for today's data using what's typed in the fields (saved or not).
  async function testConnection() {
    const f = cleaned(form);
    const problem = checkForm(f);
    if (problem) return setStatus({ kind: 'error', text: problem });
    if (!f.sheetUrl || !f.token) {
      return setStatus({ kind: 'error', text: 'Enter the Apps Script URL and token first.' });
    }

    setStatus({ kind: 'busy', text: 'Testing…' });
    try {
      const day = await callSheet<DayResponse>(f, 'getDay', { date: dateString() });
      setStatus({
        kind: 'ok',
        text: `Connected. Today: ${day.totals.kcal} of ${day.goals.kcal} kcal eaten.`,
      });
    } catch (err) {
      setStatus({ kind: 'error', text: errorMessage(err) });
    }
  }

  function save() {
    const f = cleaned(form);
    const problem = checkForm(f);
    if (problem) return setStatus({ kind: 'error', text: problem });
    saveSettings(f);
    onClose();
  }

  // Shared props for secret and technical fields: no autocorrect or capitals.
  const plain = { autocomplete: 'off', autocapitalize: 'none', spellcheck: false } as const;

  return (
    <main class="screen">
      <div class="topbar">
        <h1>Settings</h1>
        <button onClick={onClose}>Cancel</button>
      </div>

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
        <p class="hint">If the free limit is reached, the app retries once with gemini-3.1-flash-lite.</p>
      </details>

      <div class="bottom-bar">
        <button class="btn-primary" onClick={save}>Save</button>
      </div>
    </main>
  );
}
