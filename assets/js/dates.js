// Dates are stored as 'YYYY-MM-DD' strings everywhere. These helpers work in UTC,
// so a date never shifts by a day because of the viewer's time zone.
// ISO date strings also sort and compare correctly as plain strings.

const DAY_MS = 86400000;

export const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
  'September', 'October', 'November', 'December'];

const pad = n => String(n).padStart(2, '0');

export function parseISO(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function toISO(date) {
  return date.toISOString().slice(0, 10);
}

// Today's date where the viewer is.
export function todayISO(now = new Date()) {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function addDays(s, n) {
  return toISO(new Date(parseISO(s).getTime() + n * DAY_MS));
}

export function weekday(s) {
  return parseISO(s).getUTCDay();
}

export function isWeekend(s) {
  const w = weekday(s);
  return w === 0 || w === 6;
}

export function nextWorkingDay(s) {
  let d = addDays(s, 1);
  while (isWeekend(d)) d = addDays(d, 1);
  return d;
}

// Moves n weekdays forward (or back when n is negative), skipping weekends.
export function addWorkingDays(s, n) {
  const step = n < 0 ? -1 : 1;
  let d = s;
  for (let left = Math.abs(n); left > 0;) {
    d = addDays(d, step);
    if (!isWeekend(d)) left--;
  }
  return d;
}

// Weekdays after `from` up to and including `to`; negative when `to` is earlier.
export function workingDaysBetween(from, to) {
  if (from === to) return 0;
  const step = to > from ? 1 : -1;
  let count = 0;
  for (let d = from; d !== to;) {
    d = addDays(d, step);
    if (!isWeekend(d)) count += step;
  }
  return count;
}

// Monday of the week that contains `s`.
export function startOfWeek(s) {
  return addDays(s, -((weekday(s) + 6) % 7));
}

export function weekDates(monday, count = 5) {
  return Array.from({ length: count }, (_, i) => addDays(monday, i));
}

export function nowStamp(now = new Date()) {
  return now.toISOString();
}

// 29/09/2026
export function formatDate(s) {
  if (!s) return '';
  const [y, m, d] = s.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

// Tue 29/09
export function formatDay(s) {
  if (!s) return '';
  const [, m, d] = s.split('-');
  return `${WEEKDAY_NAMES[weekday(s)]} ${d}/${m}`;
}

// 29/09/2026 14:05 (viewer's local time)
export function formatStamp(iso) {
  if (!iso) return '';
  const t = new Date(iso);
  return `${pad(t.getDate())}/${pad(t.getMonth() + 1)}/${t.getFullYear()} ${pad(t.getHours())}:${pad(t.getMinutes())}`;
}

export function monthKey(s) {
  return s ? s.slice(0, 7) : '';
}

// '2026-09' -> 'September 2026'
export function monthLabel(key) {
  const [y, m] = key.split('-').map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

export function addMonths(key, n) {
  const [y, m] = key.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}`;
}

// "today", "tomorrow", "in 3 days", "2 days late"
export function relativeDay(s, today) {
  const diff = Math.round((parseISO(s) - parseISO(today)) / DAY_MS);
  if (diff === 0) return 'today';
  if (diff === 1) return 'tomorrow';
  if (diff === -1) return '1 day late';
  return diff > 0 ? `in ${diff} days` : `${-diff} days late`;
}
