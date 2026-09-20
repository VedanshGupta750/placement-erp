// Date-range helpers for the calendar view — plain arithmetic, no library.
export function startOfWeek(d: Date) {
  const date = new Date(d);
  const day = date.getDay();
  date.setDate(date.getDate() - day);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

export function addDays(d: Date, n: number) {
  const date = new Date(d);
  date.setDate(date.getDate() + n);
  return date;
}

// Local calendar-day key, NOT d.toISOString().slice(0, 10) — that converts
// to UTC first, which silently shifts every entry to the wrong day for any
// timezone ahead of UTC (e.g. IST): a grid cell built as local midnight of
// the 17th is 18:30 UTC on the 16th, so its ISO date would read "16" while
// the cell is labeled "17". Using local getFullYear/Month/Date keeps both
// the grid cells and real scheduledAt instants keyed to the same calendar
// day a human actually sees on screen.
export function toDateKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
