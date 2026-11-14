/** The round camera button, bottom centre – the only icon in the app. */
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
