/** Date helpers. All dates use the phone's own clock and time zone. */

const pad = (n: number) => String(n).padStart(2, '0');

/** "2026-11-14" for the given moment (default: now). */
export function dateString(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "2026-11-14 12:35" – the timestamp format the sheet expects. */
export function timestampString(d: Date = new Date()): string {
  return `${dateString(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "Saturday, 14 November" for the top bar. */
export function longDate(d: Date = new Date()): string {
  const weekday = d.toLocaleDateString('en-GB', { weekday: 'long' });
  const month = d.toLocaleDateString('en-GB', { month: 'long' });
  return `${weekday}, ${d.getDate()} ${month}`;
}
