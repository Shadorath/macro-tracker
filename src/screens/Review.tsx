/**
 * Review screen: photo → Gemini estimate → adjust → Save.
 *
 * Layout (SPEC.md): title "Review" with Cancel; photo thumbnail;
 * "Lunch · 12:35" and the meal name (all tappable); item rows with − / +
 * grams; "+ Add food" and "Re-check with a note"; meal total; Save at the
 * bottom. The only ways out are Save and Cancel (or the phone's Back).
 *
 * The time defaults to now and can be changed (also to an earlier day) for
 * meals eaten earlier. Changing it re-guesses the meal type unless you
 * picked one yourself.
 *
 * Small editors open inline under the thing you tapped (no pop-ups).
 */

import { useEffect, useRef, useState } from 'preact/hooks';
import type { Photo } from '../photo';
import type { Settings } from '../settings';
import type { Meal } from '../sheet';
import { errorMessage } from '../sheet';
import { dateString, timestampString } from '../dates';
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
  | { kind: 'time' }
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
  onSave: (meal: Meal) => Promise<void>; // throws with a one-line message if it fails
};

const STEP_GRAMS = 10;
const tick = () => navigator.vibrate?.(10); // short haptic tick

/** "12:35", "Yesterday 21:10" or "12 Nov 21:10". */
function whenLabel(d: Date): string {
  const time = timestampString(d).slice(11);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (dateString(d) === dateString()) return time;
  if (dateString(d) === dateString(yesterday)) return `Yesterday ${time}`;
  return `${d.getDate()} ${d.toLocaleDateString('en-GB', { month: 'short' })} ${time}`;
}

/** Meal ID from the moment of saving, e.g. m-20261114-123512 (unique per save). */
function newMealId(): string {
  return 'm-' + timestampString().replace(/[-:]/g, '').replace(' ', '-') + String(new Date().getSeconds()).padStart(2, '0');
}

export function ReviewScreen({ settings, photo, photoError, onCancel, onRetake, onOpenSettings, onSave }: Props) {
  const [phase, setPhase] = useState<Phase>(() =>
    photoError ? { kind: 'error', message: photoError, errorKind: 'photo' }
    : photo ? { kind: 'analyzing' }
    : { kind: 'ready' });
  const [mealTime, setMealTime] = useState(() => new Date());
  const [mealType, setMealType] = useState<MealType>(() => mealTypeFor());
  const [typePicked, setTypePicked] = useState(false); // you chose the type yourself
  const [mealName, setMealName] = useState('');
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [note, setNote] = useState('');          // Gemini's note
  const [editor, setEditor] = useState<Editor>(() => (photo || photoError ? { kind: 'none' } : { kind: 'add' }));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
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

  function changeTime(d: Date) {
    const now = new Date();
    setMealTime(d > now ? now : d); // no meals from the future
  }

  // Until you pick a type yourself, keep guessing it from the time and size.
  const totalKcal = items.reduce((sum, i) => sum + i.kcal, 0);
  const autoName = items[0]?.name ?? ''; // the meal's name until you give it one
  useEffect(() => {
    if (!typePicked) setMealType(mealTypeFor(mealTime, totalKcal));
  }, [mealTime, totalKcal, typePicked]);

  // Sends the meal to the sheet. On success the app goes back to Today;
  // on failure everything stays here and a one-line error explains why.
  async function save() {
    if (saving || !items.length) return;
    const timestamp = timestampString(mealTime);
    const r1 = (v: number) => Math.round(v * 10) / 10;
    const mealItems = items.map((i) => ({
      name: i.name,
      grams: Math.round(i.grams),
      kcal: Math.round(i.kcal),
      protein_g: r1(i.protein_g),
      fat_g: r1(i.fat_g),
      carbs_g: r1(i.carbs_g),
      confidence: i.confidence,
    }));
    const t = totalsOf(mealItems);
    const meal: Meal = {
      id: newMealId(),
      timestamp,
      time: timestamp.slice(11),
      type: mealType,
      name: mealName.trim() || autoName, // the same name the screen shows
      source: photo ? 'photo' : 'manual',
      note,
      items: mealItems,
      totals: { kcal: Math.round(t.kcal), protein_g: r1(t.protein_g), fat_g: r1(t.fat_g), carbs_g: r1(t.carbs_g) },
    };

    setSaving(true);
    setSaveError('');
    try {
      await onSave(meal);
    } catch (err) {
      setSaveError(errorMessage(err));
      setSaving(false);
    }
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
          {/* "Lunch · 12:35", then the meal name – all tappable */}
          <div class="meal-head">
            <button class="text-btn" onClick={() => setEditor(editor.kind === 'type' ? { kind: 'none' } : { kind: 'type' })}>
              {mealType}
            </button>
            <span class="sep">·</span>
            <button class="text-btn" onClick={() => setEditor(editor.kind === 'time' ? { kind: 'none' } : { kind: 'time' })}>
              {whenLabel(mealTime)}
            </button>
          </div>
          {/* Until you name the meal, it's called after its first food (shown greyed). */}
          <button class={`text-btn meal-name${mealName ? '' : ' auto'}`} onClick={() => setEditor({ kind: 'mealName' })}>
            {mealName || autoName || 'Name this meal'}
          </button>

          {editor.kind === 'type' && (
            <div class="chips">
              {MEAL_TYPES.map((t) => (
                <button class={`chip${t === mealType ? ' on' : ''}`} onClick={() => { setMealType(t); setTypePicked(true); setEditor({ kind: 'none' }); }}>
                  {t}
                </button>
              ))}
            </div>
          )}

          {editor.kind === 'time' && (
            <TimeEditor value={mealTime} onDone={(d) => { changeTime(d); setEditor({ kind: 'none' }); }} />
          )}

          {editor.kind === 'mealName' && (
            <TextEditor
              label="Meal name"
              value={mealName}
              placeholder={autoName}
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
        {saveError && <p class="status error" role="alert">{saveError}</p>}
        {/* Say why Save is off, instead of a silently disabled button */}
        {!saveError && phase.kind === 'ready' && !items.length && (
          <p class="status">
            {editor.kind === 'add' ? 'Tap Add to put the food in this meal, then Save.' : 'Add at least one food to save.'}
          </p>
        )}
        <button class="btn-primary" onClick={save} disabled={phase.kind !== 'ready' || !items.length || saving}>
          {saving ? 'Saving…' : saveError ? 'Retry save' : 'Save'}
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
function TextEditor({ label, value, placeholder, onDone }: { label: string; value: string; placeholder?: string; onDone: (v: string) => void }) {
  const [text, setText] = useState(value);
  return (
    <form class="inline-field" onSubmit={(e) => { e.preventDefault(); onDone(text.trim()); }}>
      <div class="field">
        <label>
          {label}
          <input value={text} placeholder={placeholder} onInput={(e) => setText(e.currentTarget.value)} autoFocus />
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

/** Date and time picker (the phone's own), for meals eaten earlier. */
function TimeEditor({ value, onDone }: { value: Date; onDone: (d: Date) => void }) {
  const toInput = (d: Date) => timestampString(d).replace(' ', 'T'); // "2026-11-14T12:35"
  const [text, setText] = useState(toInput(value));
  return (
    <form class="inline-field" onSubmit={(e) => {
      e.preventDefault();
      const d = new Date(text); // read as the phone's local time
      if (!isNaN(d.getTime())) onDone(d);
    }}>
      <div class="field">
        <label>
          When did you eat it?
          <input type="datetime-local" value={text} max={toInput(new Date())} onInput={(e) => setText(e.currentTarget.value)} />
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

  // ½× / 1½× / 2×: multiplies the grams and every number already filled in
  // (e.g. "Apple" estimated at 150 g, then 2× for two apples).
  function multiply(x: number) {
    const times = (v: string, round: (v: number) => string) => (v.trim() === '' || isNaN(n(v)) ? v : round(n(v) * x));
    const whole = (v: number) => String(Math.round(v));
    setF((prev) => ({
      ...prev,
      grams: times(prev.grams, whole),
      kcal: times(prev.kcal, whole),
      protein_g: times(prev.protein_g, one),
      fat_g: times(prev.fat_g, one),
      carbs_g: times(prev.carbs_g, one),
    }));
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
      // (The usual offline line mentions the photo; there's none here.)
      const offline = err instanceof GeminiError && err.kind === 'offline';
      setError(offline ? 'No internet. Type the numbers, or Estimate again when online.' : geminiMessage(err));
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
          {/* No autoFocus here: when the app opens the keyboard by itself, Chrome
              on Android ignores the first swipe afterwards (found with a debug
              readout on the phone). Tapping the field yourself avoids that. */}
          <input value={f.name} onInput={set('name')} />
        </label>
      </div>
      <div class="grid-2">
        {numberField('grams', 'Grams')}
        {numberField('kcal', 'kcal')}
        {numberField('protein_g', 'Protein g')}
        {numberField('fat_g', 'Fat g')}
        {numberField('carbs_g', 'Carbs g')}
      </div>
      {/* The portion chips appear once there are grams to multiply. */}
      {n(f.grams) > 0 && (
        <div class="chips">
          {[0.5, 1.5, 2].map((x) => (
            <button class="chip" type="button" onClick={() => { tick(); multiply(x); }}>
              {x === 0.5 ? '½×' : x === 1.5 ? '1½×' : '2×'}
            </button>
          ))}
        </div>
      )}
      {error && <p class="status error">{error}</p>}
      <div class="row-actions">
        <button class="btn-small" type="submit" disabled={estimating}>Add</button>
        <button class="text-btn" type="button" onClick={estimate} disabled={estimating}>
          {estimating ? 'Estimating…' : 'Estimate'}
        </button>
        <button class="text-btn quiet" type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
