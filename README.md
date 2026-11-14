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
npm run build    # type-check and build into dist/
npm run icons    # redraw the app icons in public/icons/
```

Pushing to `main` builds and deploys to GitHub Pages (`.github/workflows/deploy.yml`).
