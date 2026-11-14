import { render } from 'preact';
import { App } from './app';
import './styles.css';
import { applyTheme, loadTheme } from './theme';
applyTheme(loadTheme()); // status bar colour for the chosen theme

// Keyboard workaround. When the keyboard opens, the page gets shorter and may
// only now become scrollable (e.g. manual entry). Chrome on Android then
// ignored the first swipe until the screen was touched again (found with a
// debug readout on the phone). Nudging the scroll position by 1 px after the
// resize makes Chrome pick up the new scroll length straight away.
addEventListener('resize', () => {
  const page = document.scrollingElement;
  if (!page) return;
  const max = page.scrollHeight - page.clientHeight;
  if (page.scrollTop < max) page.scrollTop += 1;
});
render(<App />, document.getElementById('app')!);
// The service worker makes the app installable and lets it open offline.
// Only in the built app: during development it would cache stale files.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
  });
}
