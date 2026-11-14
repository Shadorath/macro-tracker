/**
 * Colour theme: Cyberpunk (default) or Classic. Each follows the phone's
 * light or dark mode. Stored on the phone; the colours themselves live in
 * styles.css under :root (Classic) and :root[data-theme="cyberpunk"].
 *
 * index.html sets data-theme with a tiny script before the page appears,
 * so the app never flashes in the other theme's colours.
 */

export type Theme = 'cyberpunk' | 'classic';
export const THEMES: { id: Theme; label: string }[] = [
  { id: 'cyberpunk', label: 'Cyberpunk' },
  { id: 'classic', label: 'Classic' },
];

const KEY = 'macro-tracker.theme';

// Page background per theme, for the phone's status bar colour.
const STATUS_BAR: Record<Theme, { light: string; dark: string }> = {
  cyberpunk: { light: '#F7F2FC', dark: '#0A0614' },
  classic: { light: '#F2F2F4', dark: '#0E0E10' },
};

export function loadTheme(): Theme {
  try {
    return localStorage.getItem(KEY) === 'classic' ? 'classic' : 'cyberpunk';
  } catch {
    return 'cyberpunk';
  }
}

/** Switches the colours on screen (and the status bar) right away. */
export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  const [light, dark] = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
  if (light) light.content = STATUS_BAR[theme].light;
  if (dark) dark.content = STATUS_BAR[theme].dark;
}

export function saveTheme(theme: Theme): void {
  localStorage.setItem(KEY, theme);
  applyTheme(theme);
}
