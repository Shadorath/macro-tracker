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
 * Small editors open inline under the thing you tapped (no pop-ups). They
 * and the food row live in components/ReviewEditors.tsx; the "+ Add food"
 * form is components/AddFood.tsx.
 */

import { useEffect, useRef, useState } from 'preact/hooks';
import type { Photo } from '../photo';
import type { Settings } from '../settings';
import type { Meal } from '../sheet';
import { errorMessage } from '../sheet';
import { dateString, timestampString } from '../dates';
import { primeKeyboard } from '../keyboard';
import { analyzePhoto, geminiMessage, GeminiError, type GeminiErrorKind } from '../gemini';
import { MEAL_TYPES, mealTypeFor, pfc, toReviewItem, totalsOf, withGrams, type MealType, type ReviewItem } from '../meal';
import { AddFood } from '../components/AddFood';
import { ItemRow, RecheckEditor, TextEditor, TimeEditor, type Editor } from '../components/ReviewEditors';

type Phase =
  | { kind: 'analyzing' }
  | { kind: 'error'; message: string; errorKind: GeminiErrorKind | 'empty' | 'photo' }
  | { kind: 'ready' };

type Props = {
  settings: Settings;
  photo: Photo | null;     // null for manual entry or when the photo couldn't be opened
  photoError?: string;
  onCancel: () => void;
  onRetake: () => void;
  onOpenSettings: () => void;
  onSave: (meal: Meal) => Promise<void>; // throws with a one-line message if it fails
};

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
    primeKeyboard(); // keyboard opens inside the tap (see keyboard.ts)
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
            <button class="text-btn" onClick={() => { primeKeyboard(); setEditor({ kind: 'add' }); }}>+ Add food</button>
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
