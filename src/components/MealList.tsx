/**
 * List of meals (used in Today's meals and in Past days).
 * Each row: meal type and time, meal name, kcal. Tap a row to see its foods
 * with grams, kcal and P / F / C, and the quiet "Delete meal" action.
 * Deleting happens straight away; the app shows an Undo toast (no dialogs).
 */

import { useState } from 'preact/hooks';
import type { Meal } from '../sheet';
import { pfc } from '../meal';

export function MealList({ meals, empty, onDelete }: {
  meals: Meal[];
  empty: string;              // text when there are no meals
  onDelete: (meal: Meal) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  if (!meals.length) return <p class="hint">{empty}</p>;

  return (
    <>
      {meals.map((meal) => {
        const open = openId === meal.id;
        return (
          <div class="meal" key={meal.id}>
            <button class="meal-main" onClick={() => setOpenId(open ? null : meal.id)} aria-expanded={open}>
              <div>
                <small>{meal.type} · {meal.time}</small>
                {meal.name}
              </div>
              <span>{Math.round(meal.totals.kcal)} kcal</span>
            </button>
            {open && (
              <>
                <ul class="meal-items">
                  {meal.items.map((item) => (
                    <li>
                      <div class="meal-item-top">
                        <span>{item.name} · {Math.round(item.grams)} g</span>
                        <span>{Math.round(item.kcal)} kcal</span>
                      </div>
                      <span class="meal-item-pfc">{pfc(item)}</span>
                    </li>
                  ))}
                </ul>
                <button class="text-btn quiet delete-meal" onClick={() => onDelete(meal)}>Delete meal</button>
              </>
            )}
          </div>
        );
      })}
    </>
  );
}
