# Macro Tracker: rules for Claude Code

A single-user installable web app (PWA) for Istok's Android phone: photograph a meal, Google Gemini (free tier) estimates kcal, protein, fat and carbs, he adjusts, and the meal is logged to his "Food Log" Google Sheet through an Apps Script web app.

**Status:** version 1 is finished and live at https://shadorath.github.io/macro-tracker/. Work now is small features and fixes.

**`SPEC.md` describes the app as built and is the source of truth.** When behaviour or looks change, update SPEC.md in the same commit. `design/today-concept.html` shows the Classic theme's layout and sizes.

## How to work

- Istok is not a professional web developer. Keep the code simple and commented, and explain each command in one plain sentence before you run it.
- Small fix or clearly described change: do it, test it, publish it, then tell him exactly what to check on his phone.
- New feature, or anything that changes what SPEC.md says: give a plan of 10 lines or fewer first and wait for his OK.
- One session per feature or bug. This file and SPEC.md are enough to start from; don't re-read the whole codebase, open only the files the task touches (map below).
- He gets updates through the "New version · Reload" note on Today (or by fully closing and reopening the app).

## Hard rules

- **Secrets:** the Gemini API key, Apps Script URL and token come only from the Settings screen (localStorage). Never hard-code them, never commit them, never print them in logs or chat. The repository is public. Test values for scripts live in `macro-tracker-secrets.txt` in his home folder (outside the repo); read it without printing.
- **Never write to the Daily tab** of the sheet (it is all formulas).
- **Tech:** Vite + TypeScript + Preact, plain CSS, no other UI or CSS libraries.
- **Design:** follow SPEC.md's UX pillars and Visual style; build screens only from the listed components. Cyberpunk (default theme) must stay crisp: solid colours, thin edges, no haze. No pure black, no green.

## Where things are

| File | What it holds |
| --- | --- |
| `src/app.tsx` | Which screen is shown, Back handling, today's data, save / delete / undo, swiping days, the update note |
| `src/screens/` | `Today`, `Review`, `MealsSheet`, `PastDays`, `Settings` |
| `src/components/` | `AddFood` (the Add food form), `ReviewEditors` (food row + inline editors), `MealList`, `CameraButton`, `Toast` |
| `src/gemini.ts` | Prompt, schema, the Gemini call with fallback model, error messages |
| `src/sheet.ts` | The five Apps Script actions and their error messages |
| `src/meal.ts`, `day.ts`, `past.ts` | Meal maths and type guess; today's cached data; the preloaded last 7 days |
| `src/settings.ts`, `theme.ts`, `keyboard.ts`, `update.ts`, `photo.ts`, `dates.ts` | Small helpers, each explained at its top |
| `src/styles.css` | All styles; colour tokens for both themes at the top |
| `public/sw.js`, `manifest.webmanifest`, `icons/` | Service worker, install settings, icon (`icon.svg` → PNGs with `npm run icons`). **Raise `CACHE` in sw.js** when sw.js, the manifest or an icon changes |
| `apps-script/Code.gs` | The sheet backend. The live copy is deployed in his Google account: a change here only takes effect after he redeploys it (steps in `apps-script/README.md`) |
| `scripts/` | `publish.ps1`, `preview-stubs.js`, `make-icons.ps1` |

## Commands (Windows, PowerShell)

Sessions usually start in the outer folder; the repo is the inner `macro-tracker/` folder. From outside it use `npm --prefix macro-tracker run …` and `git -C macro-tracker …`. If `npm` isn't found, first run `$env:Path = "C:\Program Files\nodejs;$env:Path"`. There is no Python on this computer.

| Command | What it does |
| --- | --- |
| `npm run build` | Type-checks and builds into `dist/` |
| `npm run build:test` | The same, plus copies the test helpers into `dist/` for the preview |
| `npm run ship -- -Message "…"` | Builds, checks for secrets, commits everything, pushes, waits for the GitHub Pages deploy. For a longer message write it to a file with the Write tool and use `-MessageFile <path>` |
| `npm run icons` | Redraws the icon PNGs from `public/icons/icon.svg` |

Always publish with `npm run ship`; don't retype its steps.

## Testing

1. `npm run build:test`, then start the preview (launch config `preview` in the outer `.claude/launch.json`; it serves the built files at `http://localhost:4173/macro-tracker/`).
2. In the preview tab, load the helpers once per page load:
   `eval(await (await fetch('/macro-tracker/preview-stubs.js', { cache: 'no-store' })).text())`
3. `mt.seed()` puts in fake settings, a fake today and 7 fake past days and reloads (load the helpers again). `mt.mode` fakes the internet (`ok`, `offline`, `badkey`, `busy`, `limit`, `empty`, `slow`); `mt.photo()`, `mt.swipe(120)`, `mt.tap('Save')`, `mt.type(input, 'x')`, `mt.text()`, `mt.calls`. The file's header explains each.
4. `mt.clear()` when done. Never put real secrets or the real sheet into the preview.

Check results by reading text and values (`mt.text()`, DOM), in one script per flow. Take a screenshot only when the look itself is the question.

**The preview cannot test:** real touch scrolling, the Android keyboard, the camera, and anything about the installed app (icon, manifest colours). Those need his phone, so say clearly what is untested.

**Phone-only bugs:** if the first fix doesn't work, stop guessing. Add a temporary on-screen debug readout (a working one is `src/debug.ts` in commit `60c282c`: `git show 60c282c:src/debug.ts`), ask for a screenshot, fix what it shows, then remove the readout.

## Lessons from the phone (don't repeat these)

- No `touch-action: none` on a full-screen overlay. Chrome on Android kept the "don't scroll" rule for one more swipe after the meals sheet closed.
- Form fields on Review have `autocomplete="off"`, or Chrome shows its address / card autofill bar.
- Opening the keyboard for a field that appears after a tap: call `primeKeyboard()` inside the tap handler, then focus the real field by ref. HTML `autofocus` alone is unreliable.
- In forms, update state with `setState(prev => …)`; quick changes otherwise overwrite each other.
- Android paints its bottom navigation strip with the manifest's colours, and Chrome updates an installed app's manifest and icon on its own schedule (a day or two).
- A swipe that starts at the left screen edge is Android's Back gesture; the app can't change that.
- PowerShell: `Out-File -Encoding utf8` adds a hidden character that ends up in commit messages; write message files with the Write tool. Headless Edge can turn an HTML or SVG file into a PNG for mock-ups (`--headless=new --screenshot=…`, window at least 500 px wide).
