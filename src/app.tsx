/**
 * The app always opens on Today. Other screens are one tap away, and the
 * phone's Back button (or gesture) returns to Today.
 *
 * How Back works: opening a screen from Today adds a browser history entry
 * (history.pushState). Pressing Back removes it and fires "popstate", which
 * sends us back to Today. Moving from one screen to another (e.g. the meals
 * sheet to Review) replaces the entry, so Back still goes straight to Today.
 *
 * Today's numbers: shown instantly from the phone's saved copy, then
 * refreshed quietly from the sheet (on open, when returning to Today, and
 * when the app comes back to the front).
 *
 * The camera: a hidden <input type="file" capture="environment"> opens the
 * Android camera (or the gallery). The photo is shrunk and handed to Review.
 */

import { useEffect, useRef, useState } from 'preact/hooks';
import { TodayScreen } from './screens/Today';
import { SettingsScreen } from './screens/Settings';
import { ReviewScreen } from './screens/Review';
import { MealsSheet } from './screens/MealsSheet';
import { PastDaysScreen, type DeleteHandlers } from './screens/PastDays';
import { Toast, type ToastData } from './components/Toast';
import { hasSheet, loadSettings } from './settings';
import { preparePhoto, type Photo } from './photo';
import { dateString } from './dates';
import { cacheDay, emptyDay, loadCachedDay, withMeal, withoutMeal } from './day';
import { addMeal, deleteMeal, errorMessage, getDay, SheetError, type DayResponse, type Meal, type Totals } from './sheet';

type Screen = 'today' | 'settings' | 'review' | 'meals' | 'past';

/** "yesterday" or "12 Nov" for a "2026-11-12" date. */
function dayLabel(date: string): string {
  const y = new Date();
  y.setDate(y.getDate() - 1);
  if (date === dateString(y)) return 'yesterday';
  const [yy, mm, dd] = date.split('-').map(Number);
  return new Date(yy, mm - 1, dd).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

type ReviewState = { photo: Photo | null; photoError?: string; id: number };

export function App() {
  const [screen, setScreen] = useState<Screen>('today');
  const [review, setReview] = useState<ReviewState>({ photo: null, id: 0 });
  const [day, setDayState] = useState<DayResponse>(loadCachedDay);
  const [syncError, setSyncError] = useState('');
  const [toast, setToast] = useState<ToastData | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const dayRef = useRef(day);         // latest day, for code that runs later (Undo)
  const localChanges = useRef(0);     // bumps on every save/undo made on the phone

  // Updates today's data on screen and in the phone's saved copy.
  function setDay(next: DayResponse) {
    dayRef.current = next;
    setDayState(next);
    cacheDay(next);
  }

  // Quietly asks the sheet for today's data.
  async function refresh() {
    const settings = loadSettings();
    if (!hasSheet(settings)) return;
    const today = dateString();
    if (dayRef.current.date !== today) setDay(emptyDay(today)); // it's a new day
    const changesAtStart = localChanges.current;
    try {
      const fresh = await getDay(settings, today);
      // Ignore the answer if a save or undo happened while we were asking.
      if (localChanges.current === changesAtStart) setDay(fresh);
      setSyncError('');
    } catch (err) {
      setSyncError(errorMessage(err));
    }
  }

  useEffect(() => {
    // Start clean on Today, even if the address had a #screen in it.
    if (location.hash) history.replaceState(null, '', location.pathname);
    const onBack = () => setScreen('today');
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    window.addEventListener('popstate', onBack);
    document.addEventListener('visibilitychange', onVisible);
    // (The first refresh runs from the "coming back to Today" effect below.)
    return () => {
      window.removeEventListener('popstate', onBack);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  // Coming back to Today (e.g. after Settings): refresh quietly.
  useEffect(() => { if (screen === 'today') refresh(); }, [screen]);

  function open(next: Screen) {
    if (screen === next) return;
    if (screen === 'today') history.pushState({ screen: next }, '', `#${next}`);
    else history.replaceState({ screen: next }, '', `#${next}`);
    setScreen(next);
  }

  // Leaving a screen = the same as pressing Back.
  const close = () => history.back();

  const openCamera = () => fileInput.current?.click();

  // A photo was taken or picked: shrink it, then show Review.
  async function onPhoto(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // so the same photo can be picked again
    if (!file) return;

    let next: ReviewState;
    try {
      next = { photo: await preparePhoto(file), id: review.id + 1 };
    } catch {
      next = { photo: null, photoError: "Couldn't open this photo. Try another one.", id: review.id + 1 };
    }
    setReview(next); // a new id restarts the Review screen (used by Retake)
    open('review');
  }

  // "Add manually": Review without a photo.
  function openManual() {
    setReview({ photo: null, id: review.id + 1 });
    open('review');
  }

  // Save from Review: send to the sheet, then update Today straight away.
  async function saveMeal(meal: Meal) {
    const settings = loadSettings();
    if (!hasSheet(settings)) throw new SheetError('setup', 'Add the Apps Script URL and token in Settings.');
    await addMeal(settings, meal);

    navigator.vibrate?.(15); // one short haptic tick
    localChanges.current++;
    const isToday = meal.timestamp.slice(0, 10) === dayRef.current.date;
    if (isToday) setDay(withMeal(dayRef.current, meal));
    setToast({
      id: Date.now(),
      text: isToday ? 'Saved' : `Saved to ${dayLabel(meal.timestamp.slice(0, 10))}`,
      undo: () => undoSave(meal, isToday),
    });
    close(); // back to Today
  }

  // Undo in the toast: delete the meal again.
  async function undoSave(meal: Meal, wasToday: boolean) {
    localChanges.current++;
    if (wasToday) setDay(withoutMeal(dayRef.current, meal.id));
    try {
      await deleteMeal(loadSettings(), meal.id);
    } catch (err) {
      // Couldn't remove it from the sheet: put it back so the screen stays true.
      if (wasToday) setDay(withMeal(dayRef.current, meal));
      setToast({ id: Date.now(), text: `Couldn't undo. ${errorMessage(err)}` });
    }
  }

  /**
   * "Delete meal" (in Today's meals or Past days): removes the meal from the
   * screen at once, deletes it in the sheet, and offers Undo for 5 s, which
   * saves it again. `handlers` update the screen the meal was deleted from.
   */
  async function deleteWithUndo(meal: Meal, handlers: DeleteHandlers) {
    localChanges.current++;
    handlers.remove();
    try {
      await deleteMeal(loadSettings(), meal.id);
    } catch (err) {
      handlers.restore(); // still in the sheet, so show it again
      setToast({ id: Date.now(), text: `Couldn't delete. ${errorMessage(err)}` });
      return;
    }
    navigator.vibrate?.(15);
    setToast({
      id: Date.now(),
      text: 'Meal deleted',
      undo: async () => {
        localChanges.current++;
        handlers.restore();
        try {
          await addMeal(loadSettings(), meal);
        } catch (err) {
          handlers.remove();
          setToast({ id: Date.now(), text: `Couldn't undo. ${errorMessage(err)}` });
        }
      },
    });
  }

  // Delete from Today's meals: today's numbers change straight away.
  const deleteTodayMeal = (meal: Meal) => deleteWithUndo(meal, {
    remove: () => setDay(withoutMeal(dayRef.current, meal.id)),
    restore: () => setDay(withMeal(dayRef.current, meal)),
  });

  // New goals saved in Settings: show them on Today straight away.
  function goalsSaved(goals: Totals) {
    localChanges.current++;
    setDay({ ...dayRef.current, goals });
  }

  const settings = loadSettings();

  return (
    <>
      <input ref={fileInput} type="file" accept="image/*" capture="environment" hidden onChange={onPhoto} />

      {(screen === 'today' || screen === 'meals') && (
        <TodayScreen
          day={day}
          connected={hasSheet(settings)}
          syncError={syncError}
          onOpenSettings={() => open('settings')}
          onOpenMeals={() => open('meals')}
          onCamera={openCamera}
        />
      )}
      {screen === 'meals' && (
        <MealsSheet
          day={day}
          onClose={close}
          onAddManually={openManual}
          onPastDays={() => open('past')}
          onDelete={deleteTodayMeal}
        />
      )}
      {screen === 'past' && <PastDaysScreen onClose={close} onDelete={deleteWithUndo} />}
      {screen === 'settings' && <SettingsScreen onClose={close} onGoalsSaved={goalsSaved} />}
      {screen === 'review' && (
        <ReviewScreen
          key={review.id}
          settings={settings}
          photo={review.photo}
          photoError={review.photoError}
          onCancel={close}
          onRetake={openCamera}
          onOpenSettings={() => open('settings')}
          onSave={saveMeal}
        />
      )}

      {toast && <Toast toast={toast} onDone={() => setToast(null)} />}
    </>
  );
}
