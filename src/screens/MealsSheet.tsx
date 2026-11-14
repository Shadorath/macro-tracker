/**
 * Today's meals: a sheet that slides up over Today after tapping the
 * calories card (design/today-concept.html, middle frame).
 *
 * - Each meal: type and time, meal name, kcal; tap to see its items.
 * - "Add manually" opens Review without a photo.
 * - Closes with a swipe down, a tap on the dimmed area, or Back.
 *   (Delete meal and Past days come in milestone 5.)
 */

import { useRef, useState } from 'preact/hooks';
import type { DayResponse } from '../sheet';

type Props = {
  day: DayResponse;
  onClose: () => void;
  onAddManually: () => void;
};

export function MealsSheet({ day, onClose, onAddManually }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [dragY, setDragY] = useState(0);
  const startY = useRef<number | null>(null);

  // Swipe down on the sheet to close it.
  const onTouchStart = (e: TouchEvent) => { startY.current = e.touches[0].clientY; };
  const onTouchMove = (e: TouchEvent) => {
    if (startY.current === null) return;
    setDragY(Math.max(0, e.touches[0].clientY - startY.current));
  };
  const onTouchEnd = () => {
    if (dragY > 80) onClose();
    setDragY(0);
    startY.current = null;
  };

  return (
    <div class="sheet-layer">
      <div class="scrim" onClick={onClose} />
      <section
        class="sheet"
        aria-label="Today's meals"
        style={dragY ? { transform: `translateY(${dragY}px)`, transition: 'none' } : undefined}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div class="handle" />
        <div class="sheet-head">
          <h2>Today's meals</h2>
          <span class="label">{Math.round(day.totals.kcal)} kcal</span>
        </div>

        <div class="sheet-list">
          {!day.meals.length && <p class="hint">Nothing logged yet today.</p>}
          {day.meals.map((meal) => {
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
                  <ul class="meal-items">
                    {meal.items.map((item) => (
                      <li>
                        <span>{item.name} · {Math.round(item.grams)} g</span>
                        <span>{Math.round(item.kcal)} kcal</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>

        <div class="sheet-actions">
          <button class="primary" onClick={onAddManually}>Add manually</button>
        </div>
      </section>
    </div>
  );
}
