/**
 * Opens the phone keyboard reliably for a field that doesn't exist yet.
 *
 * Android only opens the keyboard for a field the app focuses if that
 * happens right inside your tap. Screens like Add food appear a moment
 * after the tap, so their own autoFocus sometimes came too late and the
 * keyboard stayed closed.
 *
 * Call primeKeyboard() inside the tap handler: it focuses an invisible
 * field at once (the keyboard opens), and when the real field appears
 * with autoFocus, the cursor moves there and the keyboard stays open.
 */

let hidden: HTMLInputElement | null = null;

export function primeKeyboard(): void {
  if (!hidden) {
    hidden = document.createElement('input');
    hidden.setAttribute('aria-hidden', 'true');
    hidden.tabIndex = -1;
    hidden.autocomplete = 'off';
    // Invisible but focusable; 16 px text so Android doesn't zoom in.
    hidden.style.cssText =
      'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;border:0;padding:0;font-size:16px;pointer-events:none';
    document.body.appendChild(hidden);
  }
  hidden.focus({ preventScroll: true });
}
