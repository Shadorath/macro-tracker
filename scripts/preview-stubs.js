/*
 * Test helpers for the local preview (http://localhost:4173/macro-tracker/).
 * NOT part of the app: nothing here is built or published to the phone.
 *
 * Why: testing must never use the real sheet, the real Gemini key or real
 * food data. This file fakes all three in the preview's browser tab.
 *
 * Use:
 *   0. npm run build:test   builds the app and copies this file into dist/
 *      (the normal build and the published site never contain it)
 *   1. load it in the preview tab, once per page load, with this one line:
 *        eval(await (await fetch('/macro-tracker/preview-stubs.js', { cache: 'no-store' })).text())
 *   2. mt.seed()            fake settings + today + the last 7 days, then reloads
 *      (load the file again after the reload)
 *   3. mt.mode = 'ok'       what the fake internet does, see MODES below
 *   4. mt.photo()           acts like taking a photo
 *      mt.swipe(120)        swipe right on Today (-120 = left)
 *      mt.tap('Edit')      taps the button with exactly that text
 *      mt.calls             the requests the app made (action or model name)
 *   5. mt.clear()           removes all test data from the tab
 */

(() => {
  const MODES = ['ok', 'offline', 'badkey', 'busy', 'limit', 'empty', 'slow'];
  const SHEET = 'https://script.google.com/macros/s/FAKE-TEST/exec';
  const KEYS = ['settings', 'day', 'goals', 'past', 'theme'].map((k) => 'macro-tracker.' + k);
  const GOALS = { kcal: 2400, protein_g: 150, fat_g: 69, carbs_g: 294 };

  const pad = (n) => String(n).padStart(2, '0');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const dateBack = (days) => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  /** A fake day with `count` meals adding up to the given totals. */
  function fakeDay(date, kcal, p, f, c, count) {
    const meals = Array.from({ length: count }, (_, i) => {
      const time = `${pad(8 + i * 5)}:00`;
      const totals = { kcal: Math.round(kcal / count), protein_g: p / count, fat_g: f / count, carbs_g: c / count };
      return {
        id: `m-${date}-${i}`, timestamp: `${date} ${time}`, time, type: ['Breakfast', 'Lunch', 'Dinner'][i % 3],
        name: `Test meal ${i + 1}`, source: 'manual', note: '',
        items: [{ name: `Food ${i + 1}`, grams: 200, ...totals, confidence: '' }], totals,
      };
    });
    return { date, goals: GOALS, totals: { kcal, protein_g: p, fat_g: f, carbs_g: c }, meals };
  }

  // Yesterday ... 7 days ago: a normal day, an over-goal day, an empty day, ...
  const PAST = [[2210, 140, 70, 250, 3], [2650, 120, 95, 300, 3], [1800, 110, 50, 200, 2], [0, 0, 0, 0, 0],
    [2300, 150, 60, 280, 3], [1950, 130, 66, 210, 2], [2400, 149, 69, 290, 3]];
  const days = () => {
    const all = { [dateBack(0)]: fakeDay(dateBack(0), 986, 50, 46, 99, 2) };
    PAST.forEach((v, i) => { all[dateBack(i + 1)] = fakeDay(dateBack(i + 1), ...v); });
    return all;
  };

  const json = (body, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

  // ---- fake internet: only the sheet and Gemini are replaced ----
  const realFetch = window.__mtRealFetch || (window.__mtRealFetch = window.fetch.bind(window));
  Object.defineProperty(navigator, 'onLine', { get: () => mt.mode !== 'offline', configurable: true });

  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input.url;
    const isSheet = url.startsWith(SHEET);
    const isGemini = url.includes('generativelanguage.googleapis.com');
    if (!isSheet && !isGemini) return realFetch(input, init);

    if (mt.mode === 'offline') { mt.calls.push('offline'); throw new TypeError('Failed to fetch'); }
    if (mt.mode === 'slow') await wait(3000);

    if (isSheet) {
      const body = JSON.parse(init.body);
      mt.calls.push(body.action + (body.date ? ' ' + body.date : ''));
      const all = days();
      if (body.action === 'getDay') return json({ ok: true, ...(all[body.date] || fakeDay(body.date, 0, 0, 0, 0, 0)) });
      if (body.action === 'setGoals') return json({ ok: true, goals: body.goals });
      if (body.action === 'deleteMeal') return json({ ok: true, deleted: 1 });
      return json({ ok: true, mealId: body.meal && body.meal.id });
    }

    mt.calls.push((url.match(/models\/([^:?]+)/) || [])[1]);
    if (mt.mode === 'badkey') return json({ error: { code: 400, message: 'API key not valid. Please pass a valid API key.' } }, 400);
    if (mt.mode === 'busy') return json({ error: { code: 503 } }, 503);
    if (mt.mode === 'limit') return json({ error: { code: 429 } }, 429);
    if (!init || init.method !== 'POST') return json({ name: 'models/fake' }); // Test connection
    const answer = mt.mode === 'empty'
      ? { meal_name: '', items: [], note: 'This photo shows a keyboard, not food.' }
      : { meal_name: 'Chicken rice bowl', note: 'Sauce amount is a guess.', items: [
        { name: 'Grilled chicken breast', grams: 150, kcal: 248, protein_g: 46.5, fat_g: 5.4, carbs_g: 0, confidence: 'high' },
        { name: 'White rice', grams: 180, kcal: 234, protein_g: 4.3, fat_g: 0.5, carbs_g: 51, confidence: 'medium' },
        { name: 'Soy sauce', grams: 15, kcal: 8, protein_g: 1.2, fat_g: 0, carbs_g: 0.8, confidence: 'low' }] };
    return json({ candidates: [{ content: { parts: [{ text: JSON.stringify(answer) }] } }] });
  };

  // ---- helpers ----
  const mt = window.mt = {
    MODES,
    mode: 'ok',
    calls: [],
    wait,

    /** Fake settings, today and the last 7 days; then reloads the page. */
    seed({ theme } = {}) {
      const all = days();
      const today = dateBack(0);
      localStorage.setItem(KEYS[0], JSON.stringify({ geminiKey: 'fake-test-key', sheetUrl: SHEET, token: 'fake-token', model: 'gemini-3.6-flash' }));
      localStorage.setItem(KEYS[1], JSON.stringify(all[today]));
      localStorage.setItem(KEYS[2], JSON.stringify(GOALS));
      delete all[today];
      localStorage.setItem(KEYS[3], JSON.stringify({ loadedAt: Date.now(), days: all }));
      if (theme) localStorage.setItem(KEYS[4], theme);
      location.replace(location.pathname);
    },

    /** Removes every trace of test data from this tab. */
    clear() {
      KEYS.forEach((k) => localStorage.removeItem(k));
      return Object.keys(localStorage);
    },

    /** Taps the button whose text is exactly `text`. */
    async tap(text, ms = 300) {
      const button = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === text);
      if (!button) throw new Error(`No button "${text}"`);
      button.click();
      await wait(ms);
    },

    /** Types into a field (so the app notices the change). */
    type(input, value) {
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    },

    /** Acts like taking a photo: feeds a small test picture to the camera input. */
    async photo(ms = 1500) {
      const c = document.createElement('canvas');
      c.width = 400; c.height = 300;
      const g = c.getContext('2d');
      g.fillStyle = '#c84'; g.fillRect(0, 0, 400, 300);
      g.fillStyle = '#eee'; g.beginPath(); g.arc(200, 150, 90, 0, 7); g.fill();
      const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.8));
      const files = new DataTransfer();
      files.items.add(new File([blob], 'meal.jpg', { type: 'image/jpeg' }));
      const input = document.querySelector('input[type=file]');
      input.files = files.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
      await wait(ms);
    },

    /** A sideways swipe on Today: positive = right (one day back). */
    async swipe(dx, ms = 250) {
      const el = document.querySelector('main.today');
      const touch = (x, y) => new Touch({ identifier: 1, target: el, clientX: x, clientY: y });
      el.dispatchEvent(new TouchEvent('touchstart', { touches: [touch(180, 400)], changedTouches: [touch(180, 400)], bubbles: true }));
      el.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: [touch(180 + dx, 405)], bubbles: true }));
      await wait(ms);
    },

    /** The visible text of the current screen, one line per row. */
    text() {
      return (document.querySelector('main') || document.body).innerText.replace(/\n+/g, '\n');
    },
  };

  return 'mt ready: ' + Object.keys(mt).join(', ');
})();
