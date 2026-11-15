/**
 * The day's meals as cards on Today, under the meals line (SPEC.md, Meal card).
 *
 * - Newest meal first.
 * - Each card: "Lunch · 12:35" and kcal, the meal name, then three small
 *   bars (Protein, Carbs, Fat). Each bar is the meal's grams against the
 *   DAY's goal, so a bar a third full = a third of the day's protein.
 *   No orange-red warning on these bars.
 * - Tap a card to open it: a hairline and two quiet text buttons, "Edit" and
 *   "Delete meal". One card open at a time; tap it again to close.
 */

import { useState } from 'preact/hooks';
import type { Meal, Totals } from '../sheet';

export function MealList({ meals, goals, onEdit, onDelete }: {
  meals: Meal[];   // in time order, as the day keeps them
  goals: Totals;   // the day's goals (the bars measure against these)
  onEdit: (meal: Meal) => void;
  onDelete: (meal: Meal) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  if (!meals.length) return <p class="hint meals-empty">No meals yet</p>;

  const newestFirst = [...meals].reverse();

  return (
    <>
      {newestFirst.map((meal) => {
        const open = openId === meal.id;
        return (
          <div class="card meal-tile" key={meal.id}>
            <button class="meal-tile-main" onClick={() => setOpenId(open ? null : meal.id)} aria-expanded={open}>
              <div class="meal-tile-top">
                <span class="label">{meal.type} · {meal.time}</span>
                <span>{Math.round(meal.totals.kcal)} kcal</span>
              </div>
              <div class="meal-tile-name">{meal.name}</div>
              <div class="mini-bars">
                <MiniBar letter="P" colour="var(--protein)" grams={meal.totals.protein_g} goal={goals.protein_g} />
                <MiniBar letter="C" colour="var(--carbs)" grams={meal.totals.carbs_g} goal={goals.carbs_g} />
                <MiniBar letter="F" colour="var(--fat)" grams={meal.totals.fat_g} goal={goals.fat_g} />
              </div>
            </button>
            {open && (
              <div class="meal-tile-actions">
                <button class="text-btn quiet" onClick={() => onEdit(meal)}>Edit</button>
                <button class="text-btn quiet" onClick={() => { setOpenId(null); onDelete(meal); }}>Delete meal</button>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

/** "P 51 g" above a 6 px bar: the meal's grams against the day's goal. */
function MiniBar({ letter, colour, grams, goal }: { letter: string; colour: string; grams: number; goal: number }) {
  const pct = goal > 0 ? Math.min(100, (grams / goal) * 100) : 0;
  return (
    <div class="mini-bar">
      <span class="hint">{letter} {Math.round(grams)} g</span>
      <div class="bar small"><div style={{ width: `${pct}%`, background: colour }} /></div>
    </div>
  );
}
