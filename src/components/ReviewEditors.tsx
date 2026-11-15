/**
 * The small parts of the Review screen: one food row and the inline editors
 * that open under the thing you tapped (no pop-ups).
 */

import { useState } from 'preact/hooks';
import { timestampString } from '../dates';
import { pfc, type ReviewItem } from '../meal';

/** Which inline editor is open on Review (only one at a time). */
export type Editor =
  | { kind: 'none' }
  | { kind: 'type' }
  | { kind: 'time' }
  | { kind: 'mealName' }
  | { kind: 'grams'; id: string }
  | { kind: 'itemName'; id: string }
  | { kind: 'add' }
  | { kind: 'recheck' };

const STEP_GRAMS = 10;
export const tick = () => navigator.vibrate?.(10); // short haptic tick

/** Item row: name, kcal, − / + grams, P / F / C and a "check" marker when unsure. */
export function ItemRow({ item, editor, setEditor, onGrams, onRename, onDelete }: {
  item: ReviewItem;
  editor: Editor;
  setEditor: (e: Editor) => void;
  onGrams: (grams: number) => void;
  onRename: (name: string) => void;
  onDelete: () => void;
}) {
  const gramsOpen = editor.kind === 'grams' && editor.id === item.id;
  const nameOpen = editor.kind === 'itemName' && editor.id === item.id;
  const close = () => setEditor({ kind: 'none' });

  return (
    <div class="item">
      <div class="item-top">
        <button class="item-name" onClick={() => setEditor(nameOpen ? { kind: 'none' } : { kind: 'itemName', id: item.id })}>
          {item.name}
        </button>
        <span class="item-kcal">{Math.round(item.kcal)} kcal</span>
      </div>

      <div class="item-bottom">
        <div class="stepper">
          <button aria-label={`Less ${item.name}`} onClick={() => { tick(); onGrams(item.grams - STEP_GRAMS); }}>−</button>
          <button class="grams" onClick={() => setEditor(gramsOpen ? { kind: 'none' } : { kind: 'grams', id: item.id })}>
            {item.grams} g
          </button>
          <button aria-label={`More ${item.name}`} onClick={() => { tick(); onGrams(item.grams + STEP_GRAMS); }}>+</button>
        </div>
        <span class="item-pfc">
          {pfc(item)}
          {item.confidence === 'low' && <span class="check">check</span>}
        </span>
      </div>

      {gramsOpen && (
        <div class="inline-editor">
          <div class="chips">
            {[0.5, 1.5, 2].map((x) => (
              <button class="chip" onClick={() => { onGrams(item.grams * x); close(); }}>
                {x === 0.5 ? '½×' : x === 1.5 ? '1½×' : '2×'}
              </button>
            ))}
          </div>
          <NumberEditor label="Grams" value={item.grams} onDone={(g) => { onGrams(g); close(); }} />
        </div>
      )}

      {nameOpen && (
        <div class="inline-editor">
          <TextEditor label="Food name" value={item.name} onDone={(v) => { if (v) onRename(v); close(); }} />
          <button class="text-btn quiet" onClick={onDelete}>Delete this food</button>
        </div>
      )}
    </div>
  );
}

/** A text field with a Done button (Enter also works). */
export function TextEditor({ label, value, placeholder, onDone }: { label: string; value: string; placeholder?: string; onDone: (v: string) => void }) {
  const [text, setText] = useState(value);
  return (
    <form autocomplete="off" class="inline-field" onSubmit={(e) => { e.preventDefault(); onDone(text.trim()); }}>
      <div class="field">
        <label>
          {label}
          <input autocomplete="off" value={text} placeholder={placeholder} onInput={(e) => setText(e.currentTarget.value)} autoFocus />
        </label>
      </div>
      <button class="text-btn" type="submit">Done</button>
    </form>
  );
}

/** A number field with a Done button. */
export function NumberEditor({ label, value, onDone }: { label: string; value: number; onDone: (v: number) => void }) {
  const [text, setText] = useState(String(value));
  return (
    <form autocomplete="off" class="inline-field" onSubmit={(e) => { e.preventDefault(); const n = Number(text); if (n >= 0) onDone(n); }}>
      <div class="field">
        <label>
          {label}
          <input autocomplete="off" type="number" inputMode="decimal" min="0" value={text} onInput={(e) => setText(e.currentTarget.value)} />
        </label>
      </div>
      <button class="text-btn" type="submit">Done</button>
    </form>
  );
}

/** Date and time picker (the phone's own), for meals eaten earlier. */
export function TimeEditor({ value, onDone }: { value: Date; onDone: (d: Date) => void }) {
  const toInput = (d: Date) => timestampString(d).replace(' ', 'T'); // "2026-11-14T12:35"
  const [text, setText] = useState(toInput(value));
  return (
    <form autocomplete="off" class="inline-field" onSubmit={(e) => {
      e.preventDefault();
      const d = new Date(text); // read as the phone's local time
      if (!isNaN(d.getTime())) onDone(d);
    }}>
      <div class="field">
        <label>
          When did you eat it?
          <input autocomplete="off" type="datetime-local" value={text} max={toInput(new Date())} onInput={(e) => setText(e.currentTarget.value)} />
        </label>
      </div>
      <button class="text-btn" type="submit">Done</button>
    </form>
  );
}

/** "Re-check with a note": re-sends the photo with a short hint. */
export function RecheckEditor({ onRecheck }: { onRecheck: (note: string) => void }) {
  const [text, setText] = useState('');
  return (
    <form autocomplete="off" class="inline-field" onSubmit={(e) => { e.preventDefault(); if (text.trim()) onRecheck(text); }}>
      <div class="field">
        <label>
          Note for Gemini
          <input autocomplete="off" value={text} placeholder="e.g. half portion, cooked in butter" onInput={(e) => setText(e.currentTarget.value)} autoFocus />
        </label>
      </div>
      <button class="text-btn" type="submit">Re-check</button>
    </form>
  );
}
