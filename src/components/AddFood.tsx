import { useEffect, useRef, useState } from 'preact/hooks';
import type { Settings } from '../settings';
import { estimateFood, geminiMessage, GeminiError } from '../gemini';
import { toReviewItem, type FoodItem, type ReviewItem } from '../meal';
import { tick } from './ReviewEditors';

/**
 * "+ Add food": type a food in by hand. "Estimate" asks Gemini for the
 * kcal and macros of the named food (and grams, if empty); you can adjust
 * them before tapping Add.
 */
export function AddFood({ settings, onAdd, onCancel }: {
  settings: Settings;
  onAdd: (item: ReviewItem) => void;
  onCancel: () => void;
}) {
  const [f, setF] = useState({ name: '', grams: '', kcal: '', protein_g: '', fat_g: '', carbs_g: '' });
  const [error, setError] = useState('');
  const [estimating, setEstimating] = useState(false);
  // Put the cursor in the Food box when the form appears. (The tap that opened
  // the form already opened the keyboard, see keyboard.ts; the browser's own
  // autofocus is skipped then, so we focus it ourselves.)
  const foodInput = useRef<HTMLInputElement>(null);
  useEffect(() => { foodInput.current?.focus({ preventScroll: true }); }, []);
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
        <input autocomplete="off" type="number" inputMode="decimal" min="0" step="any" value={f[key]} onInput={set(key)} />
      </label>
    </div>
  );

  return (
    <form autocomplete="off" class="add-food" onSubmit={submit}>
      <div class="field">
        <label>
          Food
          <input autocomplete="off" ref={foodInput} value={f.name} onInput={set('name')} />
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
