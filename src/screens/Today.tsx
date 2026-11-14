/**
 * Today screen – placeholder for milestone 2.
 * The real calories card, macros card and camera button arrive in milestone 4.
 */

import { longDate } from '../dates';
import { hasSheet, loadSettings } from '../settings';

export function TodayScreen({ onOpenSettings }: { onOpenSettings: () => void }) {
  const connected = hasSheet(loadSettings());

  return (
    <main class="screen">
      <div class="topbar">
        <span>{longDate()}</span>
        <button onClick={onOpenSettings}>Settings</button>
      </div>

      <section class="card">
        <span class="label">Calories</span>
        <p class="hint">
          {connected
            ? 'Connection saved. Your daily progress will show here soon.'
            : 'Open Settings to connect your Google Sheet.'}
        </p>
      </section>
    </main>
  );
}
