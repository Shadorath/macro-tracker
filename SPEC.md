# Food Photo Macro Tracker — App Spec

Nov 14, 2026 · Istok · updated Nov 15, 2026 to match the app as built (v1 finished and approved)

This file describes the app **as it is**. When the app changes, change this file in the same commit, so there is one source of truth.

## Overview

A personal web app, installed to the Android home screen, that turns a photo of a meal into calories, protein, fat and carbs, lets me correct it, and logs it to a Google Sheet against my daily goals.

| Decision | Choice |
| --- | --- |
| Platform | Installable web app (PWA) on Android, opened from a home-screen icon |
| Users | Just me, single user, no login |
| Tracked nutrients | Calories (kcal), protein, fat, carbs (g) |
| Food recognition | Google Gemini API, free tier (Gemini Flash), with the photo; returns structured JSON |
| Saving | Review and adjust portions first, then save |
| Storage | Google Sheet in my (personal) Drive is the source of truth |
| API key | Free Gemini API key from Google AI Studio (personal account), entered once in Settings, kept on the phone. Whole app costs nothing to run |

Success = logging a meal takes under 30 seconds from opening the app, and today's progress against goals is visible on the first screen.

## User flow and screens

The app opens on Today; one tap on the camera button starts the photo flow, and saving returns me to Today with updated bars.

Flow: Today screen → Take photo → Gemini estimates → Review and adjust → (tap Save) → Save to sheet → back to Today, where totals and goal bars update. If Gemini finds no food or the call fails, I retake the photo or switch to manual entry, which opens the same Review screen with an empty list.

| Screen | What it shows | Main actions |
| --- | --- | --- |
| Today | Calories card (kcal eaten, "X kcal left of GOAL", ring with %), Nutrients card (three coloured bars), the "Today's meals" line and, once opened, the day's meal cards under it | Camera button (bottom centre); faint + for manual entry (bottom right); tap the meals line to show or hide the meals; Settings (quiet text, top right); swipe right / left to see earlier days |
| Capture | Android camera via the file input | Take photo or pick from gallery |
| Review | Photo thumbnail, meal type and time, meal name, items with grams and macros, low-confidence items marked "check", Gemini's note, meal total | − / + on grams, tap grams for ½× / 1½× / 2× or typing; tap a name to rename or delete; tap the type or the time to change it; Add food; Re-check with a note; Save, Cancel |
| Settings | Daily goals first (four fields + the kcal and % helper), then Connection (API key, Apps Script URL, token, Test connection), Theme, and the model under Advanced | Test connection, Save (the theme switches at once, without Save) |

**Navigation:** no bottom bar, no pop-ups. Today is home; every other screen is one tap away and Back returns to Today: Settings (top-right text) and Review (camera button, the + or a meal's Edit). Showing the meals is not a separate screen, so Back does not close them.

**Meals on Today:** under the Nutrients card sits the meals line, "Today's meals 4 ˅" ("Meals 3 ˅" on a past day). Tapping it shows that day's meals as cards right under it, newest first, and the ˅ turns to ˄; tapping it again hides them. Today opens with the meals hidden, so it still answers "how much is left?" at a glance; the camera button floats above the cards when the page scrolls. With no meals, opening the line shows "No meals yet" as a hint. Tapping a meal card opens it to show two quiet text buttons, **Edit** and **Delete meal** (one card open at a time; tap it again to close). Delete works as before, with Undo.

**Swiping days on Today:** swipe right = one day back (up to 7 days), left = forward. A past day looks the same, with its date at the top, "Today ›" in place of Settings, and no camera button or +. Its meals show and work the same way (Edit and Delete included), and if the meals are open they stay open while I swipe, so I can flip through days. The 7 days are preloaded while Today is open and kept on the phone, so a swipe never waits. Coming back to the app always shows today, with the meals hidden.

**Review details**

- Meal time defaults to now and can be changed to an earlier time or day (never the future), for meals logged late. Saving to another day says "Saved to yesterday".
- Meal type is guessed from the time and size: 05:00–10:30 Breakfast, 11:30–14:30 Lunch, 17:30–21:30 Dinner, otherwise Snack; at lunch and dinner time a meal under 250 kcal is a Snack. The guess follows the foods and the time until I pick a type myself.
- Until I name a meal, it shows its first food's name in grey and is saved under that name.
- "+ Add food" opens a form (food, grams, kcal, protein, fat, carbs). **Estimate** asks Gemini for the numbers from the name (and grams, if given); changing the grams afterwards rescales them until I type a number myself. ½× / 1½× / 2× chips multiply the grams and every filled number. Add needs a name, grams and kcal.
- Manual entry (the + at the bottom right of Today) is this same screen without a photo, starting with the Add food form open.
- **Editing a meal** (Edit on a meal card) opens this same screen filled with the saved meal: its type, time, name and foods, but no photo (photos aren't stored), so there is no thumbnail and no "Re-check with a note". The title reads "Edit meal". Save replaces the meal: the app saves the edited meal under a new meal ID, then deletes the old one, so no Apps Script change is needed. It keeps each food's source, confidence and the note. Toast: "Meal updated". If removing the old copy fails, both copies show, and the error line says to delete the old one. Cancel leaves the meal as it was.
- When Save is off, one line above it says why.

## UX pillars

Every screen and feature has to pass three tests: is it minimal, is it clear, is it fast. When two pillars clash, **clear beats minimal** (never hide something I need to understand the number) and **fast beats pretty** (no animation or step that makes me wait).

**1. Minimalist: only what earns its place**

- One main action per screen, shown as the single strong button; everything else is quiet.
- No decoration: no illustrations, badges, streaks or motivational messages. (The Cyberpunk theme adds colour and one tight glow, nothing else.)
- Show four nutrients and nothing more; no micronutrients, no charts in v1.
- Settings and rarely used actions (delete, rename) live one level down, never on the main path.
- Empty space is fine; a screen with three things on it is a good screen.

**2. Clear: understood at a glance**

- The Today screen answers one question in under 2 seconds: "how much can I still eat today?"
- Big numbers for what matters, small labels for context.
- Every number has its unit (g, kcal); no abbreviations beyond P / F / C after the first full label.
- Plain words on buttons: "Save", "Retake", "Add food"; no icons without a label, except the camera button and the + for manual entry.
- Estimates look like estimates: low-confidence items show a small "check" marker, never a pop-up.
- Errors say what happened and what to do, in one line ("No internet. Your photo is kept." + Retry).

**3. Easy and fast: as few taps and waits as possible**

| Task | Tap budget |
| --- | --- |
| Open app → see what's left today | 0 taps |
| Log a meal from a photo, no corrections | 3 taps: camera, shutter, Save |
| Fix one portion before saving | +2 taps: tap grams, pick ½× / 1½× / 2× |
| Log a meal by hand | 1 tap to open: the + (then fill in the Add food form) |
| See today's meals | 1 tap: the meals line |
| Edit or delete a meal | 3 taps: the meals line, the meal, Edit / Delete meal |
| See yesterday | 1 swipe |
| Change a goal | 3 taps: Settings, the goal field, Save |

- The camera button sits bottom centre, reachable with the right thumb; all main actions live in the bottom half of the screen.
- Grams are nudged with − / + (10 g per tap); tapping the grams value opens quick chips (½×, 1½×, 2×) and a number field, so any portion is 2 taps.
- The app opens straight to Today with cached data shown instantly, then refreshes quietly in the background (on open, on returning to Today, and when the app comes back to the front).
- While Gemini analyses, show the photo with a calm progress line, not a blocking spinner; Cancel is always available.
- After Save: one short haptic tick and a brief "Saved" toast, then straight back to Today. No confirmation dialogs, but Undo in the toast for 5 seconds. Delete meal works the same way ("Meal deleted" + Undo).

## Visual style

Two themes, chosen in Settings → Theme and remembered on the phone. Each follows the phone's light/dark setting.

- **Cyberpunk (default):** neon pink actions on a deep purple-black (or pale lavender) background. It must stay **crisp**: solid colours, thin sharp card edges, and one tight glow on the ring and camera button in dark mode only. No haze, no see-through layers.
- **Classic:** the original quiet, near-monochrome look of `design/today-concept.html`: charcoal and white, no brand colour.

| Colour | Cyberpunk light / dark | Classic light / dark |
| --- | --- | --- |
| Background | #F7F2FC / #0A0614 | #F2F2F4 / #0E0E10 |
| Cards | #FFFFFF / #150D24, 1 px edge #EBDDF7 / #2E1B4D | #FFFFFF / #1A1A1D, no edge |
| Text | #24103F / #F5F0FF; secondary #6E5A8A / #A99BC7 | #2B2D33 / #F2F2F2; secondary #6E7079 / #A1A1A6 |
| Actions and ring (camera, Save, selected chip) | #E0115F / #FF2A6D | same as the text colour (ink) |
| Protein · carbs · fat (dot and bar only) | #8A2BE2 · #D9A400 · #0097A7 / #B967FF · #F9F002 · #05D9E8 | #6D4AFF · #F2A11B · #3D9BF2 / #A08CFF · #F7B955 · #6AB0F7 |
| Over goal | #D9480F / #FF8A3D | #C2410C / #FB8A5C |
| Errors | #C62828 / #FF7A93 | #C62828 / #F28B8B |

| Element | Rule |
| --- | --- |
| Colour use | No pure black, no green. Over-goal and error colours only on text, never as backgrounds |
| Font | Roboto from Google Fonts (saved for offline use), falling back to the phone's font. Numbers use tabular figures so they don't jump |
| Type sizes | Calories 64 px bold · screen title 20 px · card titles 17 px · body 16 px · labels 14–15 px · hints 13 px. Nothing smaller than 13 px |
| Spacing | 8 px grid; screen padding 16–20 px; 16–24 px between groups |
| Touch targets | At least 48 × 48 px; camera button 72 px circle |
| Shapes | Cards 20 px corners, buttons 12 px; progress bars 8 px tall, ring 9 px stroke, both with rounded ends |
| Lines | Flat cards, no shadows; hairline dividers inside cards |
| Icons | Outline style; the camera button and the + are the only icons in the app |
| Motion | Max 150 ms, only for bars filling, screen changes and the day sliding in; respects "reduce motion" |
| Feedback | Haptic tick on Save, Delete and stepper taps; toasts at the bottom, 3 s (5 s when they offer Undo) |
| App icon | A 70 % neon-pink ring with three macro bars (purple, yellow, cyan) on #0A0614: `public/icons/icon.svg`. The manifest colours are #0A0614 too, because Android paints its bottom navigation strip with them |

**Components (the whole kit)**

- Calories card: "Calories" label, the big number = kcal **eaten** + "eaten", "680 kcal left of 2200" under it, a 104 px ring on the right (% in the centre). It shows numbers only and does nothing when tapped. Past the goal the number and the line turn orange-red, the line reads "120 kcal over 2200" and the ring is full.
- Macro row: coloured dot + label, "112 g / 150 g" right-aligned with the eaten value bold, 8 px bar in the macro's colour.
- Meals line (on Today, under Nutrients): a slim card, 56 px tall, "Today's meals" (medium weight) on the left, the meal count and ˅ (˄ while open) in the secondary colour on the right. The whole line is one tap target that shows or hides the meal cards under it.
- Meal card (on Today, under the meals line, 8 px apart): a smaller card in the same style as the Nutrients card (same background, edge and 20 px corners, 16 px padding). Top line: "Lunch · 12:35" as a label on the left, "530 kcal" on the right. Then the meal name (body size). Then one row of three small bars side by side (Protein, Carbs, Fat, as on the Nutrients card), each with a "P 51 g" hint above a 6 px bar in the macro's colour. Each bar shows that meal's grams against the **day's goal** (for example 51 g of a 150 g protein goal fills a third), so I can see how big a piece of the day the meal was. No orange-red warning on meal bars. The whole card is one tap target; open, it adds a hairline and the quiet "Edit" and "Delete meal" text buttons.
- Plus button: a 48 px tap target at the bottom right of Today, level with the camera button, today only. It is a thin outline +, the size of the camera icon, drawn in the faint track colour so it is barely seen. It opens manual entry.
- Item row (Review): food name, grams with − / +, kcal and P / F / C in small text, "check" marker when low confidence.
- Primary button (full width, bottom), small solid button (Add), quiet text button, chips, camera button (round).
- Toast and inline error line.

Any new screen is built only from these parts; adding a new component needs a reason tied to a pillar.

**Review screen layout** (top to bottom): title "Review" with Cancel on the right; photo thumbnail; "Lunch · 12:35" (both tappable) and the meal name; item rows with − / + grams; Gemini's note; "+ Add food" and "Re-check with a note" as quiet text buttons; meal total ("530 kcal · P51 F6 C61"); full-width Save button at the bottom. No other navigation on this screen: the only ways out are Save and Cancel.

## Food recognition

The app sends one photo to the Google Gemini API (free tier) and gets back a list of foods with estimated grams and macros as JSON.

**Request**

- Endpoint: `POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`, called directly from the browser, key in the `x-goog-api-key` header.
- Model: `gemini-3.6-flash` by default (a Settings field under Advanced). If it answers with a rate limit (429), a server error (5xx) or nothing within 20 s, the app retries once with `gemini-3.1-flash-lite` (40 s limit).
- Image: resized on the phone to max 1568 px on the long side, JPEG quality 0.8, sent as an inline image part (base64, `image/jpeg`).
- The prompt below goes in `systemInstruction`; an optional note ("half portion", "cooked in butter") is added as a text part. It's never asked for up front: on Review, "Re-check with a note" re-sends the photo with it.
- Structured output: `generationConfig.responseFormat.text` with `mimeType: "APPLICATION_JSON"` and a `schema` matching the one below. (Google has renamed these fields before; check the current docs if it stops working.)
- **Estimate** in the Add food form is the same call without a photo: the food's name and grams as text, one item back.
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

- `confidence` is `high`, `medium` or `low`; low items are marked "check" on the Review screen.
- Macros per item scale linearly with grams: when I change grams on Review, the app recalculates kcal and macros locally, with no new API call.

**Errors**

| Case | Behaviour |
| --- | --- |
| No network | One line: "No internet. Your photo is kept." + Retry |
| Bad or missing key, unknown model | One line: "Gemini rejected the key. Check it in Settings." + Open Settings |
| Free limit reached (HTTP 429, after the Flash-Lite retry) | One line: "Free limit reached for now. Try again later." + Add manually |
| Gemini busy or too slow (after the Flash-Lite retry) | One line: "Gemini is busy right now. Try again in a minute." + Retry |
| Empty item list | Gemini's `note` in one line + Retake / Add manually |
| Slow reply | The progress line keeps moving and Cancel stays visible; never a blocking spinner |

Add manually is offered with every error. Sheet errors (no internet, wrong URL, wrong token, timeout after 20 s) are one line each too; a failed Save keeps everything on Review with "Retry save".

## Google Sheet structure

One spreadsheet, "Food Log", in my personal Google Drive (time zone Europe/Ljubljana), with three tabs: one row per food item in Log, my targets in Goals, and per-day totals in Daily.

**Log** (appended by the app, one row per item; header row 1 already in place)

| Column | Example | Notes |
| --- | --- | --- |
| A Timestamp | 2026-11-14 12:35 | The meal's time by the **phone's clock** (I may be in another time zone), written as a real sheet date |
| B Date | 2026-11-14 | Used for daily totals |
| C Meal ID | m-20261114-123512 | Groups the items of one meal; made from the moment of saving, with seconds, so it is unique |
| D Meal | Lunch | Breakfast / Lunch / Dinner / Snack, guessed, editable |
| E Meal name | Chicken rice bowl | From Gemini or the first food, editable |
| F Food | Grilled chicken breast | |
| G Grams | 150 | |
| H kcal | 248 | |
| I Protein g | 46.5 | |
| J Fat g | 5.4 | |
| K Carbs g | 0 | |
| L Source | photo | photo / manual |
| M Confidence | high | Blank for manual |
| N Note | Sauce amount is a guess | |

**Goals** (edited from the app or by hand): A1:B1 headers "Nutrient", "Daily goal"; rows 2–5 are kcal, Protein g, Fat g, Carbs g. Column C holds a note.

**Daily** (formulas only, **nothing ever writes here**, not the app and not the script)

- A2 lists every logged date, newest first (one SORT/UNIQUE/FILTER formula); B2 to I2 are ARRAYFORMULAs that fill down by themselves. B to E sum kcal, protein, fat and carbs per date with `SUMIFS` over the Log tab.
- F to I show % of goal, so the sheet works as a history view even without the app.

## Sheet connection

A small Google Apps Script bound to the spreadsheet, deployed as a web app, is the app's only backend: the app POSTs JSON to its URL and the script reads or writes the sheet. The code is `apps-script/Code.gs`; setup steps are in `apps-script/README.md`.

**Why this route:** no Google sign-in flow or OAuth client in the app, no server to host, free, and the script runs as me with access to my sheet.

**Actions** (all `POST`, body is JSON with `action`, `token` and data)

| Action | Sends | Returns |
| --- | --- | --- |
| `addMeal` | meal fields + list of items | `ok`, meal ID (saving the same meal ID twice changes nothing) |
| `getDay` | date | that day's meals with items, totals, goals |
| `getRange` | from date, to date | daily totals (newest first) and goals. No longer used by the app since the Past days screen was removed; kept in the script so it needn't be redeployed |
| `setGoals` | kcal, protein, fat, carbs | `ok`, the goals |
| `deleteMeal` | meal ID | `ok` (removes its rows) |

**Rules**

- Every request carries a secret `token` (a long random string) that the script checks against its Script Property `TOKEN`; a wrong token returns `{ "ok": false, "error": "unauthorized" }` (Apps Script can't send a real 401).
- Send the body as `Content-Type: text/plain` so the browser skips the CORS preflight that Apps Script cannot answer; the script parses it with `JSON.parse(e.postData.contents)`.
- Use `LockService` around writes so two quick saves can't collide.
- Always reply with `ContentService` JSON: `{ "ok": true, ... }` or `{ "ok": false, "error": "..." }`.

## Daily goals and progress

- A day runs 00:00 to 23:59 by the phone's clock.
- Totals = sum of that date's Log rows; the app gets them from `getDay` and updates them right after a save or delete without waiting for a reload.
- Each macro bar keeps its own colour and stops at full; above 110 % of goal its eaten value turns orange-red. Protein never warns, since going over is fine.
- Goals are set in the Daily goals group at the top of Settings (four number fields), saved with `setGoals` and cached on the phone for offline display.
- Helper in the goals group ("Calculate from kcal and %"): enter a protein / fat / carbs split in % (must add up to 100) and it fills the gram fields (protein and carbs 4 kcal/g, fat 9 kcal/g).

## Tech stack and hosting

A small static web app built with Vite and TypeScript, hosted free on GitHub Pages, installed to the home screen from Chrome on Android.

| Part | Choice | Why |
| --- | --- | --- |
| Build | Vite + TypeScript | Fast, simple, outputs static files |
| UI | Preact, no other UI or CSS libraries | Light, React-like, small bundle |
| Styling | Plain CSS, mobile-first; themes as CSS variables, dark mode via `prefers-color-scheme` | No extra tooling |
| Camera | `<input type="file" accept="image/*" capture="environment">` | Opens the Android camera directly, also allows picking from gallery |
| Image resize | Canvas, before upload | Smaller, faster API calls |
| Install | Web app manifest + hand-written service worker (`public/sw.js`) | Home-screen icon, full-screen, opens offline |
| Hosting | GitHub Pages (HTTPS), repo `Shadorath/macro-tracker`, URL `https://shadorath.github.io/macro-tracker/`, deployed by a GitHub Actions workflow on every push | Free; HTTPS is required for install and camera |
| On the phone | `localStorage`: settings, theme, today's data, the last 7 days, goals | Single user, nothing to sync |

- **Opening:** the service worker tries the network first so updates arrive; with no answer in 3 s (weak signal) or no internet it opens the saved copy.
- **Updates:** when the app opens or comes back to the front and a newer version is online, Today shows "New version · Reload".
- **Secrets:** the Gemini key, Apps Script URL and token exist only in Settings on the phone. They never go into the code or the repo, which is public.

**Cost:** free. The Gemini free tier, GitHub Pages, Apps Script and Google Sheets cost nothing at this volume, and no billing account is needed.

## Status

Version 1 was built in six milestones (sheet and script; app shell and Settings; photo → Gemini → Review; Save and Today; goals, Past days and manual entry; polish) and approved on Nov 15, 2026. Added since: swiping through the last 7 days on Today.

**In progress (spec written, not built yet):** the meals show as cards on Today under their own "Today's meals" line (moved out of the calories card) instead of in a pop-up sheet, with small P / C / F bars, Edit and Delete; a faint + for manual entry; the meals sheet and the Past days screen are removed. Until it is built, the live app still works the old way. Remove this paragraph in the commit that ships it.

## Out of scope and future ideas

Version 1 leaves these out to stay small; any can be added later.

- Multiple users or sharing (would need a server to hide the API key).
- Fiber, sugar, salt or micronutrients.
- Barcode scanning for packaged food.
- Saved favourite meals for one-tap logging.
- Offline save queue that syncs when back online.
- Weekly charts and trends inside the app (the Daily tab covers basic history).
- Storing the photos themselves in Google Drive.
- A live home-screen icon (Android doesn't let a web app change its icon).
