/**
 * The app always opens on Today. Other screens are one tap away, and the
 * phone's Back button (or gesture) returns to Today.
 *
 * How Back works: opening a screen adds a browser history entry
 * (history.pushState). Pressing Back removes it and fires "popstate",
 * which sends us back to Today.
 *
 * The camera: a hidden <input type="file" capture="environment"> opens the
 * Android camera (or the gallery). The chosen photo is shrunk and handed to
 * the Review screen.
 */

import { useEffect, useRef, useState } from 'preact/hooks';
import { TodayScreen } from './screens/Today';
import { SettingsScreen } from './screens/Settings';
import { ReviewScreen } from './screens/Review';
import { loadSettings } from './settings';
import { preparePhoto, type Photo } from './photo';

type Screen = 'today' | 'settings' | 'review';

type ReviewState = { photo: Photo | null; photoError?: string; id: number };

export function App() {
  const [screen, setScreen] = useState<Screen>('today');
  const [review, setReview] = useState<ReviewState>({ photo: null, id: 0 });
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Start clean on Today, even if the address had a #screen in it.
    if (location.hash) history.replaceState(null, '', location.pathname);
    const onBack = () => setScreen('today');
    window.addEventListener('popstate', onBack);
    return () => window.removeEventListener('popstate', onBack);
  }, []);

  function open(next: Screen) {
    if (screen === next) return;
    // Settings opened from Review replaces Review, so Back still goes to Today.
    if (screen === 'today') history.pushState({ screen: next }, '', `#${next}`);
    else history.replaceState({ screen: next }, '', `#${next}`);
    setScreen(next);
  }

  // Leaving a screen = the same as pressing Back.
  const close = () => history.back();

  const openCamera = () => fileInput.current?.click();

  // A photo was taken or picked: shrink it, then show Review.
  async function onPhoto(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // so the same photo can be picked again
    if (!file) return;

    let next: ReviewState;
    try {
      next = { photo: await preparePhoto(file), id: review.id + 1 };
    } catch {
      next = { photo: null, photoError: "Couldn't open this photo. Try another one.", id: review.id + 1 };
    }
    setReview(next); // a new id restarts the Review screen (used by Retake)
    open('review');
  }

  return (
    <>
      <input ref={fileInput} type="file" accept="image/*" capture="environment" hidden onChange={onPhoto} />
      {screen === 'settings' && <SettingsScreen onClose={close} />}
      {screen === 'review' && (
        <ReviewScreen
          key={review.id}
          settings={loadSettings()}
          photo={review.photo}
          photoError={review.photoError}
          onCancel={close}
          onRetake={openCamera}
          onOpenSettings={() => open('settings')}
        />
      )}
      {screen === 'today' && <TodayScreen onOpenSettings={() => open('settings')} onCamera={openCamera} />}
    </>
  );
}
