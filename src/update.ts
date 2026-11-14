/**
 * "New version" check.
 *
 * Every build gives the app's main script a new name (index-AbC123.js).
 * We download the published index.html (skipping every saved copy) and
 * compare the script name in it with the one this page is running.
 * Different name = a newer version is online.
 */

const SCRIPT = /assets\/index-[\w-]+\.js/;

export async function newVersionOnline(): Promise<boolean> {
  const running = document.querySelector<HTMLScriptElement>('script[src*="assets/index-"]')?.src.match(SCRIPT)?.[0];
  if (!running || !navigator.onLine) return false; // dev mode, or no internet
  try {
    // cache: 'no-store' also tells our service worker to leave this request alone.
    const response = await fetch(import.meta.env.BASE_URL, { cache: 'no-store' });
    if (!response.ok) return false;
    const online = (await response.text()).match(SCRIPT)?.[0];
    return Boolean(online && online !== running);
  } catch {
    return false; // no answer: try again next time
  }
}
