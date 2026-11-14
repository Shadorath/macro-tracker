import { render } from 'preact';
import { App } from './app';
import './styles.css';
import { applyTheme, loadTheme } from './theme';
applyTheme(loadTheme()); // status bar colour for the chosen theme
render(<App />, document.getElementById('app')!);
// The service worker makes the app installable and lets it open offline.
// Only in the built app: during development it would cache stale files.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
  });
}
