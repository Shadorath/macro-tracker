/**
 * Today screen – still a placeholder (the calories and macros cards arrive
 * in milestone 4), now with the camera button.
 */

import { longDate } from '../dates';
import { hasSheet, loadSettings } from '../settings';
import { CameraButton } from '../components/CameraButton';

export function TodayScreen({ onOpenSettings, onCamera }: { onOpenSettings: () => void; onCamera: () => void }) {
  const connected = hasSheet(loadSettings());

  return (
    <main class="screen today">
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

      <CameraButton onClick={onCamera} />
    </main>
  );
}
