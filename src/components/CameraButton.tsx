/**
 * The app's only two icons, both on Today:
 * - the round camera button, bottom centre;
 * - the faint + for manual entry, bottom right (level with the camera button).
 */

export function CameraButton({ onClick }: { onClick: () => void }) {
  return (
    <button class="camera" onClick={onClick} aria-label="Take a photo of your meal">
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"
        stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M4 8h3l1.5-2h7L17 8h3v11H4z" />
        <circle cx="12" cy="13.5" r="3.5" />
      </svg>
    </button>
  );
}

/** Thin outline +, the size of the camera icon, in the faint track colour. */
export function PlusButton({ onClick }: { onClick: () => void }) {
  return (
    <button class="plus" onClick={onClick} aria-label="Add a meal by hand">
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"
        stroke-linecap="round" aria-hidden="true">
        <path d="M12 5v14M5 12h14" />
      </svg>
    </button>
  );
}
