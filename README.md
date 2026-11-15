# Macro Tracker

A personal, installable web app: photograph a meal, Google Gemini estimates calories, protein, fat and carbs, adjust the portions, and the meal is logged to a Google Sheet.

- Spec: [SPEC.md](SPEC.md)
- Sheet backend setup: [apps-script/README.md](apps-script/README.md)
- Live app: https://shadorath.github.io/macro-tracker/

No keys or tokens live in this repository. The Gemini API key, Apps Script URL and token are entered in the app's Settings and stay on the phone.

## Develop

```bash
npm install
npm run dev      # local dev server
npm run build        # type-check and build into dist/
npm run build:test   # build + copy the test helpers (scripts/preview-stubs.js) into dist/
npm run preview      # serve the built app locally
npm run ship -- -Message "What changed"   # build, secret check, commit, push, wait for the deploy
npm run icons        # redraw icon-192/512.png from public/icons/icon.svg (uses Edge)
```

Pushing to `main` builds and deploys to GitHub Pages (`.github/workflows/deploy.yml`). The test helpers fake the sheet and Gemini in the local preview only; they are never part of the published app.
