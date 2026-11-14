import { render } from 'preact';
import { App } from './app';
import './styles.css';
import { applyTheme, loadTheme } from './theme';
import { debugOn, startDebug } from './debug';

applyTheme(loadTheme()); // status bar colour for the chosen theme
render(<App />, document.getElementById('app')!);
if (debugOn()) startDebug(); // TEMPORARY scroll debug readout (Settings > Advanced)

// The service worker makes the app installable and lets it open offline.
// Only in the built app: during development it would cache stale files.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
  });
}
