/**
 * The app always opens on Today. Other screens are one tap away, and the
 * phone's Back button (or gesture) returns to Today.
 *
 * How Back works: opening a screen adds a browser history entry
 * (history.pushState). Pressing Back removes it and fires "popstate",
 * which sends us back to Today.
 */

import { useEffect, useState } from 'preact/hooks';
import { TodayScreen } from './screens/Today';
import { SettingsScreen } from './screens/Settings';

type Screen = 'today' | 'settings';

export function App() {
  const [screen, setScreen] = useState<Screen>('today');

  useEffect(() => {
    // Start clean on Today, even if the address had a #screen in it.
    if (location.hash) history.replaceState(null, '', location.pathname);
    const onBack = () => setScreen('today');
    window.addEventListener('popstate', onBack);
    return () => window.removeEventListener('popstate', onBack);
  }, []);

  function open(next: Screen) {
    history.pushState({ screen: next }, '', `#${next}`);
    setScreen(next);
  }

  // Leaving a screen = the same as pressing Back.
  const close = () => history.back();

  if (screen === 'settings') return <SettingsScreen onClose={close} />;
  return <TodayScreen onOpenSettings={() => open('settings')} />;
}
