# Macro Tracker: rules for Claude Code

This project is a single-user installable web app (PWA) for Istok's Android phone. He photographs a meal, the Google Gemini API (free tier) estimates calories, protein, carbs and fat, he adjusts portions, and the meal is logged to a Google Sheet through an Apps Script web app. A Today screen shows progress against daily goals.

- Full spec: `SPEC.md`. It is the source of truth.
- Visual reference: `design/today-concept.html` (code) and `design/today-concept.png` (screenshot of it). It shows the Today screen in light mode, with the meals sheet open, and in dark mode, with the exact colours, sizes and spacing.

## How to work

- Istok is not a professional web developer. Keep the code simple and commented, and explain each command in one plain sentence before you run it.
- Before writing any code, give a plan of 10 lines or fewer and list anything in SPEC.md that is unclear or contradictory. Wait for his OK.
- Build milestone by milestone, following the Build plan section of SPEC.md in order. After each milestone, stop, tell him exactly how to test it on his phone, and wait for his OK.
- If you need to deviate from the spec, ask first.
- The computer is Windows. Before milestone 1, check that Node.js (LTS), npm and Git are installed (`node -v`, `npm -v`, `git --version`). If any is missing, offer to install it with `winget` and wait for his OK.

## Tech constraints

- Vite + TypeScript + Preact, plain CSS, no other UI or CSS libraries.
- The Gemini API key, Apps Script URL and token come only from the Settings screen (localStorage). Never hard-code them, never commit them, never print them in logs. The repository will be public.
- Call the Gemini API (`generateContent`) directly from the browser, key in the `x-goog-api-key` header. Default model `gemini-3.5-flash`; on a rate-limit error (HTTP 429) retry once with `gemini-3.1-flash-lite`. Use JSON structured output matching the Response schema in SPEC.md, and check Google's current docs for the exact field names.
- The Food Log spreadsheet already exists with the Log, Goals and Daily tabs exactly as in SPEC.md. Don't create it again, and never write to the Daily tab (it is all formulas).
- Put the Apps Script code in `apps-script/Code.gs` and step-by-step setup in `apps-script/README.md`.
- Deploy to GitHub Pages with a GitHub Actions workflow. GitHub username: `Shadorath`. Repository name: `macro-tracker`, so the app lives at `https://shadorath.github.io/macro-tracker/` (set Vite's `base` to `/macro-tracker/`). Walk him through creating the repo and turning on Pages.

## Design constraints

- Follow the UX pillars and Visual style sections of SPEC.md strictly: minimalist, clear, fast. Respect the tap budgets.
- Use only the listed components and colours: soft charcoal #2B2D33 for text and actions, no pure black, no green, macro colours violet #6D4AFF / amber #F2A11B / blue #3D9BF2. System font (Roboto on Android).
- The Today screen is only the calories card (big number + ring) and the macros card, plus the camera button. Today's meals open in a bottom sheet when he taps the calories card.
- Build light and dark themes from the start, following `design/today-concept.html`.
