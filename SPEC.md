# Food Photo Macro Tracker — App Spec

Nov 14, 2026 · Istok

## Overview

A personal web app, installed to the Android home screen, that turns a photo of a meal into calories, protein, fat and carbs, lets me correct it, and logs it to a Google Sheet against my daily goals.

| Decision | Choice |
| --- | --- |
| Platform | Installable web app (PWA) on Android, opened from a home-screen icon |
| Users | Just me, single user, no login |
| Tracked nutrients | Calories (kcal), protein, fat, carbs (g) |
| Food recognition | Google Gemini API, free tier (Gemini Flash), with the photo; returns structured JSON |
| Saving | Review and adjust portions first, then save |
| Storage | Google Sheet in my Drive is the source of truth |
| API key | Free Gemini API key from Google AI Studio, entered once in Settings, kept on the phone. Whole app costs nothing to run |

Success = logging a meal takes under 30 seconds from opening the app, and today's progress against goals is visible on the first screen.

## User flow and screens

The app opens on Today; one tap on the camera button starts the photo flow, and saving returns me to Today with updated bars.

Flow: Today screen → Take photo → Gemini estimates → Review and adjust → (tap Save) → Save to sheet → back to Today, where totals and goal bars update. If Gemini finds no food or the call fails, I retake the photo or switch to manual entry, which opens the same Review screen with an empty list.

| Screen | What it shows | Main actions |
| --- | --- | --- |
| Today | Calories card (big number, ring with %, "Today's meals ›" row) and Macros card (three coloured bars); nothing else | Camera button (bottom centre); tap the calories card to open today's meals; Settings (quiet text, top right) |
| Capture | Android camera via the file input | Take photo or pick from gallery |
| Review | Photo thumbnail, meal type, meal name, items with grams and macros, low-confidence items marked "check", meal total | − / + on grams, tap grams for ½× / 1½× / 2× or typing; tap a name to rename or delete; Add food; Re-check with a note; Save, Cancel |
| Today's meals (sheet) | Slides up over Today: today's meals with time and kcal; tap one to see its items | Add manually, delete a meal, Past days |
| Past days | Earlier days, newest first, kcal and macros against goals | Tap a day to see its meals |
| Settings | Goals group first (four fields), then Connection (API key, Apps Script URL, token); model choice under Advanced | Test connection, Save |

Navigation: no bottom bar. Today is home; every other screen is one tap away and Back returns to Today: the meals sheet (tap the calories card), Settings (top-right text) and Review (camera button).

## UX pillars

Every screen and feature has to pass three tests: is it minimal, is it clear, is it fast. When two pillars clash, **clear beats minimal** (never hide something I need to understand the number) and **fast beats pretty** (no animation or step that makes me wait).

**1. Minimalist: only what earns its place**

- One main action per screen, shown as the single strong button; everything else is quiet.
- No decoration: no illustrations, gradients, shadows, badges, streaks or motivational messages.
- Show four nutrients and nothing more; no micronutrients, no charts in v1.
- Settings and rarely used actions (delete, rename) live one level down, never on the main path.
- Empty space is fine; a screen with three things on it is a good screen.

**2. Clear: understood at a glance**

- The Today screen answers one question in under 2 seconds: "how much can I still eat today?"
- Big numbers for what matters (remaining kcal), small labels for context.
- Every number has its unit (g, kcal); no abbreviations beyond P / F / C after the first full label.
- Plain words on buttons: "Save", "Retake", "Add food"; no icons without a label, except the camera button.
- Estimates look like estimates: low-confidence items show a small "check" marker, never a pop-up.
- Errors say what happened and what to do, in one line ("No internet. Your photo is kept — Retry").

**3. Easy and fast: as few taps and waits as possible**

| Task | Tap budget |
| --- | --- |
| Open app → see what's left today | 0 taps |
| Log a meal from a photo, no corrections | 3 taps: camera, shutter, Save |
| Fix one portion before saving | +2 taps: tap grams, pick ½× / 1½× / 2× |
| See today's meals | 1 tap: the calories card |
| Change a goal | 3 taps: Settings, the goal field, Save |

- The camera button sits bottom centre, reachable with the right thumb; all main actions live in the bottom half of the screen.
- Grams are nudged with − / + (10 g per tap); tapping the grams value opens quick chips (½×, 1½×, 2×) and a number field, so any portion is 2 taps.
- Meal type (breakfast, lunch, dinner, snack) is pre-filled from the time of day.
- The app opens straight to Today with cached data shown instantly, then refreshes quietly in the background.
- While Gemini analyses, show the photo with a calm progress line, not a blocking spinner; Cancel is always available.
- After Save: one short haptic tick and a brief "Saved" toast, then straight back to Today. No confirmation dialogs, but Undo in the toast for 5 seconds.

## Visual style

A quiet, near-monochrome interface: charcoal and white for structure and actions, one colour per macro for the data, the phone's own font and generous space. The numbers are the design. See `design/today-concept.html` for the exact look.

| Element | Rule |
| --- | --- |
| Theme | Follows the phone's light/dark setting; both designed, dark is not an afterthought |
| Background | Light: #F2F2F4 with white #FFFFFF cards · Dark: #0E0E10 with #1A1A1D cards |
| Text | Primary: soft charcoal #2B2D33 / #F2F2F2; secondary #6E7079 / #A1A1A6. No pure black anywhere |
| Accent | No brand colour. Actions and the calorie ring are ink: camera button and Save are solid charcoal #2B2D33 with white icon or text, inverted in dark mode. Macro colours, only on their dot and bar: protein violet #6D4AFF, carbs amber #F2A11B, fat blue #3D9BF2 (dark: #A08CFF, #F7B955, #6AB0F7) |
| Status | Over goal: orange-red #C2410C (dark #FB8A5C) on the "kcal over" number and a macro's eaten value; bars keep their colour. Errors: red #C62828. Never as backgrounds |
| Font | System font (Roboto on Android): no download, loads instantly. Numbers use tabular figures so they don't jump |
| Type sizes | Calories left 64 px bold · screen title 20 px · body 16 px · labels 13 px. Nothing smaller than 13 px |
| Spacing | 8 px grid; screen padding 16–20 px; 16–24 px between groups |
| Touch targets | At least 48 × 48 px; camera button 72 px circle |
| Shapes | Cards 20 px corners, buttons 12 px; progress bars 8 px tall, ring 9 px stroke, both with rounded ends |
| Lines | Flat white cards on the grey background, no borders or shadows; hairline dividers inside cards |
| Icons | Outline style, 24 px; the camera button is the only icon in the app |
| Motion | Max 150 ms, only for bars filling and screen changes; respects "reduce motion" |
| Feedback | Haptic tick on Save and on stepper taps; toasts at the bottom, 3 s (5 s when they offer Undo) |

**Components (the whole kit)**

- Calories card: "Calories" label, big number + "left", "1520 of 2200 kcal eaten" under it, a 104 px ring on the right (ink on a light track, % in the centre), and a "Today's meals 3 ›" row at the bottom. The whole card is one tap target that opens the meals sheet. Past the goal the number reads "120 kcal over" in orange-red and the ring is full.
- Macro row: coloured dot + label, "112 g / 150 g" right-aligned with the eaten value bold, 8 px bar in the macro's colour.
- Sheet: slides up from the bottom over Today, closes with a swipe down or Back.
- Meal row (in the sheet): meal type and time, meal name, kcal on the right; tap to expand items.
- Item row (Review): food name, grams with − / +, kcal and P / F / C in small text, "check" marker when low confidence.
- Primary button (ink, full width, bottom), quiet text button, camera button (round, ink).
- Toast and inline error line.

Any new screen is built only from these parts; adding a new component needs a reason tied to a pillar.

**Review screen layout** (top to bottom): title "Review" with Cancel on the right; photo thumbnail; "Lunch · Chicken rice bowl" (meal type and name, both tappable to edit); item rows with − / + grams; "+ Add food" and "Re-check with a note" as quiet text buttons; meal total ("530 kcal · P51 F6 C61"); full-width Save button at the bottom. No other navigation on this screen: the only ways out are Save and Cancel.

## Food recognition

The app sends one photo to the Google Gemini API (free tier) and gets back a list of foods with estimated grams and macros as JSON.

**Request**

- Endpoint: `POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`, called directly from the browser, key in the `x-goog-api-key` header.
- Model: `gemini-3.5-flash` by default; on a rate-limit error retry once with `gemini-3.1-flash-lite`. Both are free-tier models as of November 2026. The model ID is a Settings field so it can be changed when Google renames models.
- Image: resized on the phone to max 1568 px on the long side, JPEG quality ~0.8, sent as an inline image part (base64, `image/jpeg`).
- The prompt below goes in `systemInstruction`; an optional note ("half portion", "cooked in butter") is added as a text part. It's never asked for up front: on Review, "Re-check with a note" re-sends the photo with it.
- Structured output: `generationConfig` with `responseMimeType: "application/json"` and a response schema matching the one below. Check Google's current structured-output docs for exact field names; they have changed between API versions.
- Free-tier limits: requests per minute and per day are capped (current numbers only in AI Studio); a few meals a day fits easily. Google may use free-tier requests to improve its products.
- Key safety: the key is restricted to the Gemini API in Google AI Studio. It never goes into the repository.

**Prompt (system)**

> You are a nutrition estimator. Identify every distinct food or drink in the photo. For each, estimate the edible portion in grams and its calories, protein, fat and carbohydrates for that portion, using typical values for European home cooking. Account for visible oils, sauces and dressings. If unsure, give your best estimate and lower the confidence. If the photo shows no food, return an empty list and say why in `note`.

**Response schema**

```json
{
  "meal_name": "Chicken rice bowl",
  "items": [
    {
      "name": "Grilled chicken breast",
      "grams": 150,
      "kcal": 248,
      "protein_g": 46.5,
      "fat_g": 5.4,
      "carbs_g": 0,
      "confidence": "high"
    }
  ],
  "note": "Sauce amount is a guess."
}
```

- `confidence` is `high`, `medium` or `low`; low items are highlighted on the Review screen.
- Macros per item scale linearly with grams: when I change grams on Review, the app recalculates kcal and macros locally, with no new API call.

**Errors**

| Case | Behaviour |
| --- | --- |
| No network | One line: "No internet. Your photo is kept." + Retry |
| Bad or missing key | One line: "Gemini rejected the key. Check it in Settings." + Open Settings |
| Free limit reached (HTTP 429, after the Flash-Lite retry) | One line: "Free limit reached for now. Try again later." + Add manually |
| Empty item list | Gemini's `note` in one line + Retake / Add manually |
| Slow reply (>20 s) | The progress line keeps moving and Cancel stays visible; never a blocking spinner |

## Google Sheet structure

One spreadsheet, "Food Log" (already created in my Google Drive, time zone Europe/Ljubljana), with three tabs: one row per food item in Log, my targets in Goals, and per-day totals in Daily.

**Log** (appended by the app, one row per item; header row 1 already in place)

| Column | Example | Notes |
| --- | --- | --- |
| A Timestamp | 2026-11-14 12:35 | Local time, Europe/Ljubljana |
| B Date | 2026-11-14 | Used for daily totals |
| C Meal ID | m-20261114-1235 | Groups items from one photo |
| D Meal | Lunch | Breakfast / Lunch / Dinner / Snack, guessed from time, editable |
| E Meal name | Chicken rice bowl | From Gemini, editable |
| F Food | Grilled chicken breast | |
| G Grams | 150 | |
| H kcal | 248 | |
| I Protein g | 46.5 | |
| J Fat g | 5.4 | |
| K Carbs g | 0 | |
| L Source | photo | photo / manual |
| M Confidence | high | Blank for manual |
| N Note | Sauce amount is a guess | |

**Goals** (edited from the app or by hand): A1:B1 headers "Nutrient", "Daily goal"; rows 2–5 below. Column C holds a note.

| Row | Nutrient | Daily goal |
| --- | --- | --- |
| 2 | kcal | 2200 |
| 3 | Protein g | 150 |
| 4 | Fat g | 70 |
| 5 | Carbs g | 220 |

The numbers above are placeholders until I set my own.

**Daily** (formulas only, nothing written by the app or the script)

- A2 lists every logged date, newest first (one SORT/UNIQUE/FILTER formula); B2 to I2 are ARRAYFORMULAs that fill down by themselves. B to E sum kcal, protein, fat and carbs per date with `SUMIFS` over the Log tab.
- F to I show % of goal, so the sheet works as a history view even without the app.

## Sheet connection

A small Google Apps Script bound to the spreadsheet, deployed as a web app, is the app's only backend: the app POSTs JSON to its URL and the script reads or writes the sheet.

**Why this route:** no Google sign-in flow or OAuth client in the app, no server to host, free, and the script runs as me with access to my sheet.

**Actions** (all `POST`, body is JSON with `action`, `token` and data)

| Action | Sends | Returns |
| --- | --- | --- |
| `addMeal` | meal fields + list of items | `ok`, meal ID |
| `getDay` | date | items for that day, totals, goals |
| `getRange` | from date, to date | daily totals for Past days |
| `setGoals` | kcal, protein, fat, carbs | `ok` |
| `deleteMeal` | meal ID | `ok` (removes its rows) |

**Rules**

- Every request carries a secret `token` (a long random string) that the script checks; wrong token returns `401`-style error JSON. This keeps strangers who find the URL out.
- Send the body as `Content-Type: text/plain` so the browser skips the CORS preflight that Apps Script cannot answer; the script parses it with `JSON.parse(e.postData.contents)`.
- Use `LockService` around writes so two quick saves can't collide.
- Always reply with `ContentService` JSON: `{ "ok": true, ... }` or `{ "ok": false, "error": "..." }`.

**One-time setup**

1. The "Food Log" spreadsheet with the Log, Goals and Daily tabs already exists.
2. Extensions → Apps Script, paste the script, set the `TOKEN` in Script Properties.
3. Deploy → New deployment → Web app, execute as Me, access Anyone.
4. Copy the web app URL and the token into the app's Settings.
5. Press "Test connection" in Settings; it calls `getDay` for today.

## Daily goals and progress

The Today screen shows calories as a ring (eaten ÷ goal, % in the centre) beside the big "680 left" number, and protein, carbs and fat as three coloured bars with "112 g / 150 g" beside each.

- A day runs 00:00 to 23:59 local time (Europe/Ljubljana).
- Totals = sum of that date's Log rows; the app gets them from `getDay` and updates them right after a save without waiting for a reload.
- Each macro bar keeps its own colour and stops at full; above 110 % of goal its eaten value turns orange-red. Protein never warns, since going over is fine.
- The big number beside the ring shows kcal left today, with "1520 of 2200 kcal eaten" under it; past the goal it turns orange-red and reads "120 kcal over".
- Goals are set in the Goals group at the top of Settings (four number fields), saved with `setGoals` and cached on the phone for offline display.
- Optional helper in the Goals group: enter kcal and a protein/fat/carb split in %, and it fills the gram fields (protein and carbs 4 kcal/g, fat 9 kcal/g).

## Tech stack and hosting

A small static web app built with Vite and TypeScript, hosted free on GitHub Pages, installed to the home screen from Chrome on Android.

| Part | Choice | Why |
| --- | --- | --- |
| Build | Vite + TypeScript | Fast, simple, outputs static files |
| UI | Preact | Light, React-like, small bundle |
| Styling | Plain CSS, mobile-first, dark mode via `prefers-color-scheme` | No extra tooling |
| Camera | `<input type="file" accept="image/*" capture="environment">` | Opens the Android camera directly, also allows picking from gallery |
| Image resize | Canvas, before upload | Smaller, faster API calls |
| Install | Web app manifest + service worker | Home-screen icon, full-screen, app shell loads offline |
| Hosting | GitHub Pages (HTTPS), repo `Shadorath/macro-tracker`, URL `https://shadorath.github.io/macro-tracker/` | Free; HTTPS is required for install and camera |
| Settings | `localStorage` on the phone | Single user, nothing to sync |

**Settings screen fields:** the Goals group first (used most), then Connection: Gemini API key, Apps Script URL, token and one "Test connection" button; model choice sits under Advanced. The key and token never go into the code or the repo.

**Cost:** free. The Gemini free tier, GitHub Pages, Apps Script and Google Sheets cost nothing at this volume, and no billing account is needed.

## Build plan

Six milestones, each ending in something I can try on my phone before moving on.

1. **Sheet + Apps Script.** The spreadsheet and its three tabs already exist; write the script with all five actions and the token check. The script never writes to the Daily tab.
   - Check: a test request adds a row and `getDay` returns it.
2. **App shell + Settings.** Vite project, manifest, service worker, Settings screen saving to `localStorage`, Test connection for the sheet.
   - Check: installs to the home screen from GitHub Pages and the sheet test passes.
3. **Photo → Gemini → Review.** Camera input, resize, API call with the schema, Review screen with editable grams and live recalculation.
   - Check: a photo of a real meal shows sensible items within ~10 s; changing grams updates macros.
4. **Save + Today.** Save from Review via `addMeal`, Today screen with the calories card and macro bars, meals sheet on tapping the calories card.
   - Check: after saving, the numbers move and the rows appear in the Log tab.
5. **Goals + past days + manual add.** Goals group in Settings with `setGoals`, Past days list (from the meals sheet) via `getRange`, manual food entry, delete meal.
   - Check: changing a goal updates the bars; a deleted meal disappears from the sheet.
6. **Polish.** Error states from the recognition table, dark mode check, app icon, loading states.
   - Check: airplane mode and a wrong API key both show clear messages, nothing crashes.

## Out of scope and future ideas

Version 1 leaves these out to stay small; any can be added later.

- Multiple users or sharing (would need a server to hide the API key).
- Fiber, sugar, salt or micronutrients.
- Barcode scanning for packaged food.
- Saved favourite meals for one-tap logging.
- Offline save queue that syncs when back online.
- Weekly charts and trends inside the app (the Daily tab covers basic history).
- Storing the photos themselves in Google Drive.
- Claude API as an optional, more accurate (paid) recognition engine.
