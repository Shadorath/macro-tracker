/**
 * The app always opens on Today. Other screens are one tap away, and the
 * phone's Back button (or gesture) returns to Today.
 *
 * How Back works: opening a screen from Today adds a browser history entry
 * (history.pushState). Pressing Back removes it and fires "popstate", which
 * sends us back to Today. Moving from one screen to another (e.g. Review to
 * Settings) replaces the entry, so Back still goes straight to Today.
 * Showing the meals on Today is not a screen, so Back doesn't close them.
 *
 * Today's numbers: shown instantly from the phone's saved copy, then
 * refreshed quietly from the sheet (on open, when returning to Today, and
 * when the app comes back to the front).
 *
 * Swiping back through days: Today can show any of the last 7 days (swipe
 * right = one day back). Those days are preloaded while Today is open (see
 * past.ts), so a swipe shows them straight away. Coming back to the app
 * always shows today again, with the meals hidden.
 *
 * Editing a meal: Edit on a meal card opens Review filled with that meal.
 * Save adds the edited meal under a new meal ID, then deletes the old one
 * (so the Apps Script needs no "update" action).
 *
 * The camera: a hidden <input type="file" capture="environment"> opens the
 * Android camera (or the gallery). The photo is shrunk and handed to Review.
 */

import { useEffect, useRef, useState } from 'preact/hooks';
import { TodayScreen } from './screens/Today';
import { SettingsScreen } from './screens/Settings';
import { ReviewScreen } from './screens/Review';
import { Toast, type ToastData } from './components/Toast';
import { hasSheet, loadSettings } from './settings';
import { preparePhoto, type Photo } from './photo';
import { dateString } from './dates';
import { newVersionOnline } from './update';
import { primeKeyboard } from './keyboard';
import { cachePast, loadCachedPast, PAST_DAYS, pastDates, pastIsStale, type PastDays } from './past';
import { cacheDay, emptyDay, loadCachedDay, withMeal, withoutMeal } from './day';
import { addMeal, deleteMeal, errorMessage, getDay, SheetError, type DayResponse, type Meal, type Totals } from './sheet';

type Screen = 'today' | 'settings' | 'review';

/** "yesterday" or "12 Nov" for a "2026-11-12" date. */
function dayLabel(date: string): string {
  const y = new Date();
  y.setDate(y.getDate() - 1);
  if (date === dateString(y)) return 'yesterday';
  const [yy, mm, dd] = date.split('-').map(Number);
  return new Date(yy, mm - 1, dd).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

// What Review opens with: a photo, nothing (manual entry) or a saved meal to edit.
type ReviewState = { photo: Photo | null; photoError?: string; edit?: Meal; id: number };

export function App() {
  const [screen, setScreen] = useState<Screen>('today');
  const [review, setReview] = useState<ReviewState>({ photo: null, id: 0 });
  const [day, setDayState] = useState<DayResponse>(loadCachedDay);
  const [syncError, setSyncError] = useState('');
  const [toast, setToast] = useState<ToastData | null>(null);
  const [updateReady, setUpdateReady] = useState(false); // a newer version is online
  const fileInput = useRef<HTMLInputElement>(null);
  const dayRef = useRef(day);         // latest day, for code that runs later (Undo)
  const localChanges = useRef(0);     // bumps on every save/undo made on the phone

  // Swiping back through days on Today: 0 = today, 1 = yesterday, ... 7.
  const [past, setPastState] = useState<PastDays>(loadCachedPast);
  const pastRef = useRef(past);
  const [offset, setOffset] = useState(0);
  const [slide, setSlide] = useState<'' | 'older' | 'newer'>(''); // direction of the last change
  const [mealsOpen, setMealsOpen] = useState(false); // meal cards shown on Today (stay open while swiping)

  // Updates today's data on screen and in the phone's saved copy.
  function setDay(next: DayResponse) {
    dayRef.current = next;
    setDayState(next);
    cacheDay(next);
  }

  // Same for the past days.
  function setPast(next: PastDays) {
    pastRef.current = next;
    setPastState(next);
    cachePast(next);
  }

  /** Changes one day's data (today or a loaded past day), on screen and saved. */
  function changeDay(date: string, change: (d: DayResponse) => DayResponse) {
    if (date === dayRef.current.date) setDay(change(dayRef.current));
    const saved = pastRef.current.days[date];
    if (saved) setPast({ ...pastRef.current, days: { ...pastRef.current.days, [date]: change(saved) } });
  }

  // Preloads the last 7 days (all at once), so swiping back shows them
  // straight away. Skipped if the saved copy is less than 10 minutes old.
  async function refreshPast() {
    const settings = loadSettings();
    if (!hasSheet(settings) || !pastIsStale(pastRef.current)) return;
    const changesAtStart = localChanges.current;
    const results = await Promise.allSettled(pastDates().map((date) => getDay(settings, date)));
    if (localChanges.current !== changesAtStart) return; // a save/delete happened meanwhile
    const days = { ...pastRef.current.days };
    results.forEach((r) => { if (r.status === 'fulfilled') days[r.value.date] = r.value; });
    const allLoaded = results.every((r) => r.status === 'fulfilled');
    setPast({ loadedAt: allLoaded ? Date.now() : pastRef.current.loadedAt, days });
  }

  // Quietly asks the sheet for today's data (and preloads the past days).
  async function refresh() {
    const settings = loadSettings();
    if (!hasSheet(settings)) return;
    refreshPast();
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
    // Back lands on the entry below, which is always Today.
    const onBack = (e: PopStateEvent) => setScreen(e.state?.screen ?? 'today');
    const checkUpdate = async () => { if (await newVersionOnline()) setUpdateReady(true); };
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      setOffset(0); // coming back to the app always shows today,
      setMealsOpen(false); // with the meals hidden
      refresh();
      checkUpdate();
    };
    checkUpdate();
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

  // The + on Today, or "Add manually": Review without a photo.
  function openManual() {
    primeKeyboard(); // keyboard opens now, inside the tap (see keyboard.ts)
    setReview({ photo: null, id: review.id + 1 });
    open('review');
  }

  // Edit on a meal card: Review filled with that meal (no photo).
  function openEdit(meal: Meal) {
    setReview({ photo: null, edit: meal, id: review.id + 1 });
    open('review');
  }

  // Save from Review: send to the sheet, then update Today straight away.
  async function saveMeal(meal: Meal) {
    const settings = loadSettings();
    if (!hasSheet(settings)) throw new SheetError('setup', 'Add the Apps Script URL and token in Settings.');
    await addMeal(settings, meal);
    if (review.edit) return replaceMeal(review.edit, meal);

    navigator.vibrate?.(15); // one short haptic tick
    localChanges.current++;
    const date = meal.timestamp.slice(0, 10);
    changeDay(date, (d) => withMeal(d, meal)); // today, or a past day
    setToast({
      id: Date.now(),
      text: date === dayRef.current.date ? 'Saved' : `Saved to ${dayLabel(date)}`,
      undo: () => undoSave(meal),
    });
    close(); // back to Today
  }

  /**
   * Second half of saving an edited meal: the new copy is in the sheet, now
   * delete the old one. Both days change if the date was changed. If the old
   * copy can't be deleted, both copies show and the toast says so.
   */
  async function replaceMeal(old: Meal, meal: Meal) {
    navigator.vibrate?.(15);
    localChanges.current++;
    changeDay(meal.timestamp.slice(0, 10), (d) => withMeal(d, meal));
    try {
      await deleteMeal(loadSettings(), old.id);
      changeDay(old.timestamp.slice(0, 10), (d) => withoutMeal(d, old.id));
      setToast({ id: Date.now(), text: 'Meal updated' });
    } catch (err) {
      setToast({ id: Date.now(), text: `Saved, but the old copy is still there: delete it. ${errorMessage(err)}` });
    }
    close(); // back to Today
  }

  // Undo in the toast: delete the meal again.
  async function undoSave(meal: Meal) {
    localChanges.current++;
    const date = meal.timestamp.slice(0, 10);
    changeDay(date, (d) => withoutMeal(d, meal.id));
    try {
      await deleteMeal(loadSettings(), meal.id);
    } catch (err) {
      // Couldn't remove it from the sheet: put it back so the screen stays true.
      changeDay(date, (d) => withMeal(d, meal));
      setToast({ id: Date.now(), text: `Couldn't undo. ${errorMessage(err)}` });
    }
  }

  /**
   * "Delete meal" on a meal card (today or a past day): removes the meal from
   * the screen at once, deletes it in the sheet, and offers Undo for 5 s,
   * which saves it again.
   */
  async function deleteDayMeal(meal: Meal) {
    const date = meal.timestamp.slice(0, 10);
    const remove = () => changeDay(date, (d) => withoutMeal(d, meal.id));
    const restore = () => changeDay(date, (d) => withMeal(d, meal));
    localChanges.current++;
    remove();
    try {
      await deleteMeal(loadSettings(), meal.id);
    } catch (err) {
      restore(); // still in the sheet, so show it again
      setToast({ id: Date.now(), text: `Couldn't delete. ${errorMessage(err)}` });
      return;
    }
    navigator.vibrate?.(15);
    setToast({
      id: Date.now(),
      text: 'Meal deleted',
      undo: async () => {
        localChanges.current++;
        restore();
        try {
          await addMeal(loadSettings(), meal);
        } catch (err) {
          remove();
          setToast({ id: Date.now(), text: `Couldn't undo. ${errorMessage(err)}` });
        }
      },
    });
  }

  // New goals saved in Settings: show them on Today (and past days) straight away.
  function goalsSaved(goals: Totals) {
    localChanges.current++;
    setDay({ ...dayRef.current, goals });
    const days = Object.fromEntries(Object.entries(pastRef.current.days).map(([date, d]) => [date, { ...d, goals }]));
    setPast({ ...pastRef.current, days });
  }

  // Swipe right = one day back, left = one day forward (today at most).
  function swipe(daysBack: 1 | -1) {
    const next = Math.min(PAST_DAYS, Math.max(0, offset + daysBack));
    if (next === offset) return;
    setSlide(daysBack > 0 ? 'older' : 'newer');
    setOffset(next);
  }

  // The day Today shows: today, or a past day (from the preloaded copy).
  const shownDate = offset === 0 ? day.date : pastDates()[offset - 1];
  const shownDay = offset === 0 ? day : past.days[shownDate] ?? emptyDay(shownDate);
  const shownLoaded = offset === 0 || Boolean(past.days[shownDate]);

  const settings = loadSettings();

  return (
    <>
      <input ref={fileInput} type="file" accept="image/*" capture="environment" hidden onChange={onPhoto} />

      {screen === 'today' && (
        <TodayScreen
          day={shownDay}
          isToday={offset === 0}
          loading={!shownLoaded}
          slide={slide}
          connected={hasSheet(settings)}
          syncError={syncError}
          onOpenSettings={() => open('settings')}
          mealsOpen={mealsOpen}
          onToggleMeals={() => setMealsOpen((o) => !o)}
          onEditMeal={openEdit}
          onDeleteMeal={deleteDayMeal}
          onCamera={openCamera}
          onManual={openManual}
          onSwipe={swipe}
          onToday={() => { setSlide('newer'); setOffset(0); }}
        />
      )}
      {screen === 'settings' && <SettingsScreen onClose={close} onGoalsSaved={goalsSaved} />}
      {screen === 'review' && (
        <ReviewScreen
          key={review.id}
          settings={settings}
          photo={review.photo}
          photoError={review.photoError}
          edit={review.edit}
          onCancel={close}
          onRetake={openCamera}
          onOpenSettings={() => open('settings')}
          onSave={saveMeal}
        />
      )}

      {toast && <Toast toast={toast} onDone={() => setToast(null)} />}

      {/* Only on Today, so a reload never throws away a meal being edited. */}
      {updateReady && !toast && screen === 'today' && (
        <div class="toast above-camera" role="status">
          <span>New version</span>
          <button onClick={() => location.reload()}>Reload</button>
        </div>
      )}
    </>
  );
}
