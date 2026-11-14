/**
 * Past days: the last 7 days before today, newest first, with kcal and
 * P / F / C against your goals. Tap a day to see its meals (and delete one).
 * Older history lives in the Google Sheet's Daily tab.
 */

import { useEffect, useState } from 'preact/hooks';
import { dateString } from '../dates';
import { loadSettings } from '../settings';
import { errorMessage, getDay, getRange, type DaySummary, type Meal, type Totals } from '../sheet';
import { MealList } from '../components/MealList';

const DAYS = 7;

/** "Fri 13 Nov" for "2026-11-13". */
function dayName(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const day = new Date(y, m - 1, d);
  return `${day.toLocaleDateString('en-GB', { weekday: 'short' })} ${d} ${day.toLocaleDateString('en-GB', { month: 'short' })}`;
}

type OpenDay = { date: string; meals: Meal[] | null; error: string };

export type DeleteHandlers = { remove: () => void; restore: () => void };

export function PastDaysScreen({ onClose, onDelete }: {
  onClose: () => void;
  onDelete: (meal: Meal, handlers: DeleteHandlers) => void;
}) {
  const [days, setDays] = useState<DaySummary[] | null>(null);
  const [goals, setGoals] = useState<Totals | null>(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState<OpenDay | null>(null);

  async function load() {
    setError('');
    const to = new Date();
    to.setDate(to.getDate() - 1);         // yesterday
    const from = new Date();
    from.setDate(from.getDate() - DAYS);  // 7 days ago
    try {
      const result = await getRange(loadSettings(), dateString(from), dateString(to));
      setDays(result.days);
      setGoals(result.goals);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  useEffect(() => { load(); }, []);

  async function toggleDay(date: string) {
    if (open?.date === date) return setOpen(null);
    setOpen({ date, meals: null, error: '' });
    try {
      const day = await getDay(loadSettings(), date);
      setOpen((o) => (o?.date === date ? { date, meals: day.meals, error: '' } : o));
    } catch (err) {
      setOpen((o) => (o?.date === date ? { date, meals: null, error: errorMessage(err) } : o));
    }
  }

  // Delete a meal of a past day: update the list here, the app does the rest.
  function deleteMeal(meal: Meal) {
    const date = meal.timestamp.slice(0, 10);
    const adjust = (sign: 1 | -1) => {
      setOpen((o) => {
        if (!o || o.date !== date || !o.meals) return o;
        const meals = sign < 0 ? o.meals.filter((m) => m.id !== meal.id)
          : [...o.meals, meal].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
        return { ...o, meals };
      });
      setDays((list) => list && list.map((d) => d.date !== date ? d : {
        ...d,
        kcal: d.kcal + sign * meal.totals.kcal,
        protein_g: d.protein_g + sign * meal.totals.protein_g,
        fat_g: d.fat_g + sign * meal.totals.fat_g,
        carbs_g: d.carbs_g + sign * meal.totals.carbs_g,
        meals: d.meals + sign,
      }));
    };
    onDelete(meal, { remove: () => adjust(-1), restore: () => adjust(1) });
  }

  return (
    <main class="screen">
      <div class="topbar">
        <h1>Past days</h1>
        <button onClick={onClose}>Close</button>
      </div>

      {error && (
        <div class="error-block">
          <p class="status error" role="alert">{error}</p>
          <div class="row-actions"><button class="text-btn" onClick={load}>Retry</button></div>
        </div>
      )}

      {!days && !error && <p class="label">Loading…</p>}

      {days && goals && (
        <section class="card past-days">
          {!days.length && <p class="hint">Nothing logged in the last {DAYS} days.</p>}
          {days.map((d) => {
            const isOpen = open?.date === d.date;
            const over = d.kcal > goals.kcal;
            return (
              <div class="past-day" key={d.date}>
                <button class="past-day-main" onClick={() => toggleDay(d.date)} aria-expanded={isOpen}>
                  <div class="past-day-top">
                    <span>{dayName(d.date)}</span>
                    <span>
                      <span class={`eaten${over ? ' over' : ''}`}>{Math.round(d.kcal)}</span>
                      <span class="goal"> / {goals.kcal} kcal</span>
                    </span>
                  </div>
                  <span class="past-day-pfc">
                    P {Math.round(d.protein_g)}/{goals.protein_g} · F {Math.round(d.fat_g)}/{goals.fat_g} · C {Math.round(d.carbs_g)}/{goals.carbs_g} g
                  </span>
                </button>
                {isOpen && (
                  <div class="past-day-meals">
                    {open.error && <p class="status error">{open.error}</p>}
                    {!open.meals && !open.error && <p class="label">Loading…</p>}
                    {open.meals && <MealList meals={open.meals} empty="No meals left on this day." onDelete={deleteMeal} />}
                  </div>
                )}
              </div>
            );
          })}
          <p class="hint">Older days are in the Daily tab of your Google Sheet.</p>
        </section>
      )}
    </main>
  );
}
