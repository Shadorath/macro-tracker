/**
 * Review screen: photo → Gemini estimate → adjust → Save.
 *
 * Layout (SPEC.md): title "Review" with Cancel; photo thumbnail;
 * "Lunch · Chicken rice bowl" (both tappable); item rows with − / + grams;
 * "+ Add food" and "Re-check with a note"; meal total; Save at the bottom.
 * The only ways out are Save and Cancel (or the phone's Back).
 *
 * Small editors open inline under the thing you tapped (no pop-ups).
 */

import { useEffect, useRef, useState } from 'preact/hooks';
import type { Photo } from '../photo';
import type { Settings } from '../settings';
import { analyzePhoto, estimateFood, geminiMessage, GeminiError, type GeminiErrorKind } from '../gemini';
import {
  MEAL_TYPES, mealTypeFor, pfc, toReviewItem, totalsOf, withGrams,
  type FoodItem, type MealType, type ReviewItem,
} from '../meal';

type Phase =
  | { kind: 'analyzing' }
  | { kind: 'error'; message: string; errorKind: GeminiErrorKind | 'empty' | 'photo' }
  | { kind: 'ready' };

/** Which inline editor is open (only one at a time). */
type Editor =
  | { kind: 'none' }
  | { kind: 'type' }
  | { kind: 'mealName' }
  | { kind: 'grams'; id: string }
  | { kind: 'itemName'; id: string }
  | { kind: 'add' }
  | { kind: 'recheck' };

type Props = {
  settings: Settings;
  photo: Photo | null;     // null for manual entry or when the photo couldn't be opened
  photoError?: string;
  onCancel: () => void;
  onRetake: () => void;
  onOpenSettings: () => void;
};

const STEP_GRAMS = 10;
const tick = () => navigator.vibrate?.(10); // short haptic tick

export function ReviewScreen({ settings, photo, photoError, onCancel, onRetake, onOpenSettings }: Props) {
  const [phase, setPhase] = useState<Phase>(() =>
    photoError ? { kind: 'error', message: photoError, errorKind: 'photo' }
    : photo ? { kind: 'analyzing' }
    : { kind: 'ready' });
  const [mealType, setMealType] = useState<MealType>(() => mealTypeFor());
  const [mealName, setMealName] = useState('');
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [note, setNote] = useState('');          // Gemini's note
  const [editor, setEditor] = useState<Editor>(() => (photo || photoError ? { kind: 'none' } : { kind: 'add' }));
  const [saveMessage, setSaveMessage] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  // Ask Gemini about the photo. `userNote` comes from "Re-check with a note".
  async function analyze(userNote?: string) {
    if (!photo) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setPhase({ kind: 'analyzing' });
    setEditor({ kind: 'none' });

    try {
      const result = await analyzePhoto({
        key: settings.geminiKey,
        model: settings.model,
        imageBase64: photo.base64,
        note: userNote,
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      setNote(result.note);
      if (!result.items.length) {
        setPhase({ kind: 'error', errorKind: 'empty', message: result.note || 'No food found in this photo.' });
        return;
      }
      setMealName(result.meal_name);
      setItems(result.items.map(toReviewItem));
      setPhase({ kind: 'ready' });
    } catch (err) {
      if (err instanceof GeminiError && err.kind === 'cancelled') return;
      setPhase({
        kind: 'error',
        message: geminiMessage(err),
        errorKind: err instanceof GeminiError ? err.kind : 'bad',
      });
    }
  }

  // Start right away when the screen opens with a photo; stop if we leave.
  useEffect(() => {
    if (photo && !photoError) analyze();
    return () => abortRef.current?.abort();
  }, []);

  const updateItem = (id: string, change: (i: ReviewItem) => ReviewItem | null) =>
    setItems((list) => list.flatMap((i) => (i.id === id ? (change(i) ?? []) : [i])));

  const switchToManual = () => {
    setPhase({ kind: 'ready' });
    setEditor({ kind: 'add' });
  };

  function save() {
    // Saving to the sheet is built in milestone 4.
    setSaveMessage('Saving to your sheet arrives in the next update.');
  }

  const totals = totalsOf(items);

  return (
    <main class="screen review">
      <div class="topbar">
        <h1>Review</h1>
        <button onClick={onCancel}>Cancel</button>
      </div>

      {photo && <img class="thumb" src={photo.dataUrl} alt="Your meal photo" />}

      {phase.kind === 'analyzing' && (
        <div class="analyzing" role="status">
          <div class="progress-line"><div /></div>
          <span class="label">Estimating…</span>
        </div>
      )}

      {phase.kind === 'error' && (
        <ErrorActions
          phase={phase}
          hasPhoto={Boolean(photo)}
          onRetry={() => analyze()}
          onRetake={onRetake}
          onManual={switchToManual}
          onOpenSettings={onOpenSettings}
        />
      )}

      {phase.kind === 'ready' && (
        <section class="card meal-card">
          {/* "Lunch · Chicken rice bowl" – both parts tappable */}
          <div class="meal-head">
            <button class="text-btn" onClick={() => setEditor(editor.kind === 'type' ? { kind: 'none' } : { kind: 'type' })}>
              {mealType}
            </button>
            <span class="sep">·</span>
            <button class="text-btn meal-name" onClick={() => setEditor({ kind: 'mealName' })}>
              {mealName || 'Name this meal'}
            </button>
          </div>

          {editor.kind === 'type' && (
            <div class="chips">
              {MEAL_TYPES.map((t) => (
                <button class={`chip${t === mealType ? ' on' : ''}`} onClick={() => { setMealType(t); setEditor({ kind: 'none' }); }}>
                  {t}
                </button>
              ))}
            </div>
          )}

          {editor.kind === 'mealName' && (
            <TextEditor
              label="Meal name"
              value={mealName}
              onDone={(v) => { setMealName(v); setEditor({ kind: 'none' }); }}
            />
          )}

          <div class="items">
            {items.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                editor={editor}
                setEditor={setEditor}
                onGrams={(g) => updateItem(item.id, (i) => withGrams(i, g))}
                onRename={(name) => updateItem(item.id, (i) => ({ ...i, name }))}
                onDelete={() => updateItem(item.id, () => null)}
              />
            ))}
            {!items.length && editor.kind !== 'add' && <p class="hint">No food yet. Add it below.</p>}
          </div>

          {editor.kind === 'add' && (
            <AddFood
              settings={settings}
              onAdd={(item) => { setItems((list) => [...list, item]); setEditor({ kind: 'none' }); }}
              onCancel={() => setEditor({ kind: 'none' })}
            />
          )}

          {note && <p class="hint">{note}</p>}

          <div class="row-actions">
            <button class="text-btn" onClick={() => setEditor({ kind: 'add' })}>+ Add food</button>
            {photo && (
              <button class="text-btn quiet" onClick={() => setEditor({ kind: 'recheck' })}>Re-check with a note</button>
            )}
          </div>

          {editor.kind === 'recheck' && <RecheckEditor onRecheck={(n) => analyze(n)} />}

          <div class="meal-total">
            <span>{Math.round(totals.kcal)} kcal</span>
            <span class="label">{pfc(totals)}</span>
          </div>
        </section>
      )}

      <div class="bottom-bar">
        {saveMessage && <p class="status">{saveMessage}</p>}
        <button class="btn-primary" onClick={save} disabled={phase.kind !== 'ready' || !items.length}>
          Save
        </button>
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------

/** One-line error plus the actions that make sense for it (SPEC.md Errors table). */
function ErrorActions({ phase, hasPhoto, onRetry, onRetake, onManual, onOpenSettings }: {
  phase: Extract<Phase, { kind: 'error' }>;
  hasPhoto: boolean;
  onRetry: () => void;
  onRetake: () => void;
  onManual: () => void;
  onOpenSettings: () => void;
}) {
  const k = phase.errorKind;
  return (
    <div class="error-block">
      <p class="status error" role="alert">{phase.message}</p>
      <div class="row-actions">
        {k === 'key' && <button class="text-btn" onClick={onOpenSettings}>Open Settings</button>}
        {hasPhoto && ['offline', 'busy', 'timeout', 'bad'].includes(k) && (
          <button class="text-btn" onClick={onRetry}>Retry</button>
        )}
        {['empty', 'bad', 'photo'].includes(k) && <button class="text-btn" onClick={onRetake}>Retake</button>}
        <button class="text-btn quiet" onClick={onManual}>Add manually</button>
      </div>
    </div>
  );
}

/** Item row: name, kcal, − / + grams, P / F / C and a "check" marker when unsure. */
function ItemRow({ item, editor, setEditor, onGrams, onRename, onDelete }: {
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
function TextEditor({ label, value, onDone }: { label: string; value: string; onDone: (v: string) => void }) {
  const [text, setText] = useState(value);
  return (
    <form class="inline-field" onSubmit={(e) => { e.preventDefault(); onDone(text.trim()); }}>
      <div class="field">
        <label>
          {label}
          <input value={text} onInput={(e) => setText(e.currentTarget.value)} autoFocus />
        </label>
      </div>
      <button class="text-btn" type="submit">Done</button>
    </form>
  );
}

/** A number field with a Done button. */
function NumberEditor({ label, value, onDone }: { label: string; value: number; onDone: (v: number) => void }) {
  const [text, setText] = useState(String(value));
  return (
    <form class="inline-field" onSubmit={(e) => { e.preventDefault(); const n = Number(text); if (n >= 0) onDone(n); }}>
      <div class="field">
        <label>
          {label}
          <input type="number" inputMode="decimal" min="0" value={text} onInput={(e) => setText(e.currentTarget.value)} />
        </label>
      </div>
      <button class="text-btn" type="submit">Done</button>
    </form>
  );
}

/** "Re-check with a note": re-sends the photo with a short hint. */
function RecheckEditor({ onRecheck }: { onRecheck: (note: string) => void }) {
  const [text, setText] = useState('');
  return (
    <form class="inline-field" onSubmit={(e) => { e.preventDefault(); if (text.trim()) onRecheck(text); }}>
      <div class="field">
        <label>
          Note for Gemini
          <input value={text} placeholder="e.g. half portion, cooked in butter" onInput={(e) => setText(e.currentTarget.value)} autoFocus />
        </label>
      </div>
      <button class="text-btn" type="submit">Re-check</button>
    </form>
  );
}

/**
 * "+ Add food": type a food in by hand. "Estimate" asks Gemini for the
 * kcal and macros of the named food (and grams, if empty); you can adjust
 * them before tapping Add.
 */
function AddFood({ settings, onAdd, onCancel }: {
  settings: Settings;
  onAdd: (item: ReviewItem) => void;
  onCancel: () => void;
}) {
  const [f, setF] = useState({ name: '', grams: '', kcal: '', protein_g: '', fat_g: '', carbs_g: '' });
  const [error, setError] = useState('');
  const [estimating, setEstimating] = useState(false);
  const [confidence, setConfidence] = useState<FoodItem['confidence']>(''); // from Gemini, if estimated
  // After Estimate, the values per gram, so changing grams rescales the numbers.
  // Cleared as soon as you type a kcal or macro yourself.
  const [perGram, setPerGram] = useState<{ kcal: number; protein_g: number; fat_g: number; carbs_g: number } | null>(null);
  const n = (v: string) => (v.trim() === '' ? 0 : Number(v.replace(',', '.')));
  const one = (v: number) => String(Math.round(v * 10) / 10);

  // Always build on the latest values (prev), so quick changes never overwrite each other.
  const set = (k: keyof typeof f) => (e: Event) => {
    const value = (e.currentTarget as HTMLInputElement).value;
    if (k === 'grams' && perGram && n(value) > 0) {
      const g = n(value);
      setF((prev) => ({
        ...prev,
        grams: value,
        kcal: String(Math.round(perGram.kcal * g)),
        protein_g: one(perGram.protein_g * g),
        fat_g: one(perGram.fat_g * g),
        carbs_g: one(perGram.carbs_g * g),
      }));
      return;
    }
    if (k !== 'grams' && k !== 'name') setPerGram(null); // you typed a number yourself
    setF((prev) => ({ ...prev, [k]: value }));
  };

  function submit(e: Event) {
    e.preventDefault();
    const values = { grams: n(f.grams), kcal: n(f.kcal), protein_g: n(f.protein_g), fat_g: n(f.fat_g), carbs_g: n(f.carbs_g) };
    if (!f.name.trim()) return setError('Give the food a name.');
    if (f.kcal.trim() === '') return setError('Enter the kcal, or tap Estimate.');
    if (Object.values(values).some((v) => isNaN(v) || v < 0)) return setError('Use numbers only, like 150 or 12.5.');
    if (!values.grams) return setError('Enter the grams.');
    onAdd(toReviewItem({ name: f.name.trim(), confidence, ...values }));
  }

  // Ask Gemini about the food and fill in the number fields.
  async function estimate() {
    const grams = n(f.grams);
    if (!f.name.trim()) return setError('Type the food first, then tap Estimate.');
    if (isNaN(grams) || grams < 0) return setError('Use numbers only, like 150 or 12.5.');
    setError('');
    setEstimating(true);
    try {
      const item = await estimateFood({ key: settings.geminiKey, model: settings.model, name: f.name.trim(), grams: grams || undefined });
      if (item.grams > 0) {
        setPerGram({
          kcal: item.kcal / item.grams,
          protein_g: item.protein_g / item.grams,
          fat_g: item.fat_g / item.grams,
          carbs_g: item.carbs_g / item.grams,
        });
      }
      setF((prev) => ({
        ...prev,
        grams: String(Math.round(item.grams)),
        kcal: String(Math.round(item.kcal)),
        protein_g: one(item.protein_g),
        fat_g: one(item.fat_g),
        carbs_g: one(item.carbs_g),
      }));
      setConfidence(item.confidence);
    } catch (err) {
      setError(geminiMessage(err));
    } finally {
      setEstimating(false);
    }
  }

  const numberField = (key: keyof typeof f, label: string) => (
    <div class="field">
      <label>
        {label}
        <input type="number" inputMode="decimal" min="0" step="any" value={f[key]} onInput={set(key)} />
      </label>
    </div>
  );

  return (
    <form class="add-food" onSubmit={submit}>
      <div class="field">
        <label>
          Food
          <input value={f.name} onInput={set('name')} autoFocus />
        </label>
      </div>
      <div class="grid-2">
        {numberField('grams', 'Grams')}
        {numberField('kcal', 'kcal')}
        {numberField('protein_g', 'Protein g')}
        {numberField('fat_g', 'Fat g')}
        {numberField('carbs_g', 'Carbs g')}
      </div>
      {error && <p class="status error">{error}</p>}
      <div class="row-actions">
        <button class="text-btn" type="submit" disabled={estimating}>Add</button>
        <button class="text-btn" type="button" onClick={estimate} disabled={estimating}>
          {estimating ? 'Estimating…' : 'Estimate'}
        </button>
        <button class="text-btn quiet" type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
