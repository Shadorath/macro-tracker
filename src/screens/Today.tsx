/**
 * Today screen (design/today-concept.html): answers "how much can I still
 * eat today?" at a glance.
 *
 * - Calories card: kcal eaten (big, so it rises together with the ring %),
 *   "680 kcal left of 2200" under it, a ring with the % eaten, and
 *   "Today's meals 3 ›". The whole card is one tap target that opens the
 *   meals sheet. Past the goal: "120 kcal over 2200", the eaten number in
 *   orange-red and a full ring. (Istok's change to the spec, which had the
 *   kcal left as the big number.)
 * - Nutrients card: protein, carbs, fat as coloured bars with "112 g / 150 g".
 *   A bar stops at full; above 110 % the eaten value turns orange-red,
 *   except protein (going over is fine).
 * - The camera button, bottom centre.
 */

import { longDate } from '../dates';
import type { DayResponse } from '../sheet';
import { CameraButton } from '../components/CameraButton';

type Props = {
  day: DayResponse;
  connected: boolean;     // sheet URL and token are filled in
  syncError: string;      // last refresh failed (showing saved numbers)
  onOpenSettings: () => void;
  onOpenMeals: () => void;
  onCamera: () => void;
};

const RING_R = 44;
const RING_C = 2 * Math.PI * RING_R; // circumference ≈ 276.5

export function TodayScreen({ day, connected, syncError, onOpenSettings, onOpenMeals, onCamera }: Props) {
  const goal = day.goals.kcal;
  const eaten = Math.round(day.totals.kcal);
  const left = goal - eaten;
  const over = left < 0;
  const pct = goal > 0 ? eaten / goal : 0;
  const mealCount = day.meals.length;

  const label = `${eaten} kcal eaten today, ${over ? `${-left} kcal over` : `${left} kcal left`}, `
    + `${Math.round(pct * 100)} percent of goal. Show today's meals`;

  return (
    <main class="screen today">
      <div class="topbar">
        <span>{longDate()}</span>
        <button onClick={onOpenSettings}>Settings</button>
      </div>

      {/* Calories card: the whole card is one tap target */}
      <button class="card calories" onClick={onOpenMeals} aria-label={label}>
        <div class="cal-row">
          <div class="cal-text">
            <span class="label">Calories</span>
            <div class={`big${over ? ' over' : ''}`}>
              <span class="num">{eaten}</span>
              <span class="unit">eaten</span>
            </div>
            <span class={`sub${over ? ' over' : ''}`}>
              {over ? `${-left} kcal over ${goal}` : `${left} kcal left of ${goal}`}
            </span>
          </div>
          <div class="ring">
            <svg width="104" height="104" viewBox="0 0 104 104" aria-hidden="true">
              <circle cx="52" cy="52" r={RING_R} fill="none" stroke="var(--track)" stroke-width="9" />
              {pct > 0 && (
                <circle cx="52" cy="52" r={RING_R} fill="none" stroke="var(--ink)" stroke-width="9" stroke-linecap="round"
                  stroke-dasharray={`${Math.min(1, pct) * RING_C} ${RING_C}`} transform="rotate(-90 52 52)" class="ring-fill" />
              )}
            </svg>
            <span>{Math.round(pct * 100)}%</span>
          </div>
        </div>
        <div class="meals-row">
          <span>Today's meals</span>
          <span class="count">{mealCount} ›</span>
        </div>
      </button>

      {/* Nutrients card */}
      <section class="card macros" aria-label="Nutrients today">
        <h2>Nutrients</h2>
        <MacroRow name="Protein" colour="var(--protein)" eaten={day.totals.protein_g} goal={day.goals.protein_g} warns={false} />
        <MacroRow name="Carbs" colour="var(--carbs)" eaten={day.totals.carbs_g} goal={day.goals.carbs_g} warns />
        <MacroRow name="Fat" colour="var(--fat)" eaten={day.totals.fat_g} goal={day.goals.fat_g} warns />
      </section>

      {!connected && <p class="hint center">Connect your Google Sheet in Settings to save meals.</p>}
      {connected && syncError && <p class="hint center">{syncError} Showing saved numbers.</p>}

      <CameraButton onClick={onCamera} />
    </main>
  );
}

/** Coloured dot + name, "112 g / 150 g" (eaten bold), 8 px bar. */
function MacroRow({ name, colour, eaten, goal, warns }: {
  name: string;
  colour: string;
  eaten: number;
  goal: number;
  warns: boolean; // turn the eaten value orange-red above 110 %?
}) {
  const pct = goal > 0 ? eaten / goal : 0;
  const over = warns && pct > 1.1;
  return (
    <div class="macro">
      <div class="macro-head">
        <span class="macro-name"><span class="dot" style={{ background: colour }} />{name}</span>
        <span>
          <span class={`eaten${over ? ' over' : ''}`}>{Math.round(eaten)} g</span>
          <span class="goal"> / {Math.round(goal)} g</span>
        </span>
      </div>
      <div class="bar">
        <div style={{ width: `${Math.min(100, pct * 100)}%`, background: colour }} />
      </div>
    </div>
  );
}
