/**
 * TEMPORARY scroll debug readout (to find why manual entry needs two swipes
 * with the keyboard open). Turned on in Settings > Advanced; remove this file
 * once the bug is fixed.
 *
 * Shows a small box at the top with the screen and keyboard sizes and the
 * last events: touches, pointer events ("cancel" = Chrome took the gesture
 * for scrolling), scrolls (which element), resizes and focus changes.
 */

const KEY = 'macro-tracker.debug';

export const debugOn = () => {
  try { return localStorage.getItem(KEY) === '1'; } catch { return false; }
};

export function setDebug(on: boolean) {
  localStorage.setItem(KEY, on ? '1' : '0');
  location.reload();
}

export function startDebug() {
  const box = document.createElement('pre');
  box.style.cssText =
    'position:fixed;top:0;left:0;right:0;z-index:99;margin:0;padding:4px 6px;max-height:46vh;overflow:hidden;' +
    'font:10px/1.3 monospace;color:#0f0;background:rgba(0,0,0,.82);pointer-events:none;white-space:pre-wrap';
  document.body.appendChild(box);

  const t0 = performance.now();
  const lines: string[] = [];
  let moves = 0;
  const name = (el: EventTarget | null) => {
    if (!(el instanceof Element)) return el === document ? 'document' : String(el);
    return el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : '');
  };
  const log = (s: string) => {
    lines.unshift(`${Math.round(performance.now() - t0)} ${s}`);
    lines.length = Math.min(lines.length, 22);
    draw();
  };
  const draw = () => {
    const vv = window.visualViewport;
    const review = document.querySelector('.screen.review') as HTMLElement | null;
    box.textContent =
      `inner ${innerHeight} | vv ${vv ? Math.round(vv.height) + ' top ' + Math.round(vv.offsetTop) : '-'} | ` +
      `doc ${Math.round(document.scrollingElement?.scrollTop ?? 0)}/${document.scrollingElement?.scrollHeight} | ` +
      `review ${review ? Math.round(review.scrollTop) + '/' + review.scrollHeight + ' h' + review.clientHeight : '-'}\n` +
      `focus ${name(document.activeElement)}\n` + lines.join('\n');
  };

  const opts = { capture: true, passive: true };
  // Scrolls are counted, not listed one by one: one line per swipe (or per
  // burst of scrolling with no finger on the screen).
  let touching = false;
  let scrolls = 0;
  let quietTimer = 0;
  addEventListener('touchstart', (e) => { touching = true; moves = 0; scrolls = 0; log(`TOUCH START on ${name(e.target)}`); }, opts);
  addEventListener('touchmove', (e) => { if (++moves <= 2) log(`touchmove#${moves} cancelable=${e.cancelable}`); }, opts);
  addEventListener('touchend', () => { touching = false; log(`TOUCH END: ${moves} moves, ${scrolls} scrolls`); scrolls = 0; }, opts);
  addEventListener('touchcancel', () => log('touchcancel'), opts);
  addEventListener('pointercancel', () => log('pointercancel (Chrome scrolls)'), opts);
  document.addEventListener('scroll', (e) => {
    scrolls++;
    if (touching) { if (scrolls === 1) log(`first scroll: ${name(e.target)}`); return; }
    // Scrolling without a finger (e.g. Chrome moving the field into view).
    clearTimeout(quietTimer);
    quietTimer = window.setTimeout(() => { log(`no-finger scrolls: ${scrolls} (${name(e.target)})`); scrolls = 0; }, 300);
  }, opts);
  addEventListener('resize', () => log(`resize inner=${innerHeight}`), opts);
  window.visualViewport?.addEventListener('resize', () => log(`vv resize ${Math.round(visualViewport!.height)}`));
  window.visualViewport?.addEventListener('scroll', () => log(`vv scroll top=${Math.round(visualViewport!.offsetTop)}`));
  addEventListener('focusin', (e) => log(`focus ${name(e.target)}`), opts);
  addEventListener('focusout', (e) => log(`blur ${name(e.target)}`), opts);
  setInterval(draw, 500); // keep the sizes on the top line current
  draw();
}
