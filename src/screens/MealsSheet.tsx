/**
 * Today's meals: a sheet that slides up over Today after tapping the
 * calories card (design/today-concept.html, middle frame).
 *
 * - Each meal: type and time, meal name, kcal; tap to see its foods
 *   (with P / F / C) and "Delete meal".
 * - "Add manually" opens Review without a photo; "Past days ›" opens the
 *   last 7 days.
 * - Closes with a swipe down, a tap on the dimmed area, or Back.
 */

import { useEffect, useRef, useState } from 'preact/hooks';
import type { DayResponse, Meal } from '../sheet';
import { MealList } from '../components/MealList';

type Props = {
  day: DayResponse;
  onClose: () => void;
  onAddManually: () => void;
  onPastDays: () => void;
  onDelete: (meal: Meal) => void;
};

export function MealsSheet({ day, onClose, onAddManually, onPastDays, onDelete }: Props) {
  const [dragY, setDragY] = useState(0);
  const startY = useRef<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // While the sheet is open, the Today screen behind it must not scroll,
  // otherwise it "steals" the swipe.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, []);

  // Swipe down on the sheet to close it. If the meal list is scrolled down,
  // a swipe scrolls the list back up first instead.
  const onTouchStart = (e: TouchEvent) => {
    const list = listRef.current;
    const inScrolledList = list && list.contains(e.target as Node) && list.scrollTop > 0;
    startY.current = inScrolledList ? null : e.touches[0].clientY;
  };
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

        <div class="sheet-list" ref={listRef}>
          <MealList meals={day.meals} empty="Nothing logged yet today." onDelete={onDelete} />
        </div>

        <div class="sheet-actions">
          <button class="primary" onClick={onAddManually}>Add manually</button>
          <button class="primary" onClick={onPastDays}>Past days ›</button>
        </div>
      </section>
    </div>
  );
}
