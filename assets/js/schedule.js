// Due-date planning: fits each writer's open pieces into their working days.
//
// Rules (agreed in the plan):
// - Each writer has a daily word limit per weekday. Weekends, public holidays
//   and the writer's time off have no capacity.
// - Pieces fill the days in order: Urgent, then High, then Normal; within the
//   same priority, the earliest booked goes first.
// - A long piece spreads over several days; its due date is the day its last words fit.
// - A pinned piece keeps its date. Its words are taken from the days just before
//   that date, so earlier days stay free for the rest of the queue.

import { addDays, isWeekend, nextWorkingDay, weekday, WEEKDAY_KEYS } from './dates.js';

export const PRIORITY_RANK = { Urgent: 0, High: 1, Normal: 2 };

// Stages where the writer is still writing, so the piece uses their capacity.
export const WRITING_STAGES = ['booked', 'with_writer'];

const HORIZON_DAYS = 366;

export function dayCapacity(writer, date, { timeOff = [], holidays = [] } = {}) {
  if (isWeekend(date)) return 0;
  if (holidays.some(h => h.date === date)) return 0;
  if (timeOff.some(t => t.writerId === writer.id && date >= t.from && date <= t.to)) return 0;
  const limit = Number(writer.capacity?.[WEEKDAY_KEYS[weekday(date)]]);
  return limit > 0 ? limit : 0;
}

export function queueOrder(a, b) {
  const pa = PRIORITY_RANK[a.priority] ?? PRIORITY_RANK.Normal;
  const pb = PRIORITY_RANK[b.priority] ?? PRIORITY_RANK.Normal;
  if (pa !== pb) return pa - pb;
  if ((a.dateBooked || '') !== (b.dateBooked || '')) return (a.dateBooked || '') < (b.dateBooked || '') ? -1 : 1;
  return String(a.id).localeCompare(String(b.id));
}

const wordsOf = p => Math.max(0, Math.round(Number(p.words) || 0));

/**
 * Plans one writer's open pieces from `start` onward.
 * pieces: [{ id, words, priority, dateBooked, dueDate, pinned, earliestStart? }]
 * Returns {
 *   pieces: { [id]: { due, days: [{ date, words }], fits } },
 *   days:   { [date]: { capacity, used } }   // only days the plan looked at
 * }
 * `fits` is false when a pinned piece can't be finished by its date, or when
 * no date was found within a year.
 */
export function planWriter({ writer, pieces, timeOff = [], holidays = [], start }) {
  const days = {};
  const result = {};
  const slot = date => (days[date] ??= { capacity: dayCapacity(writer, date, { timeOff, holidays }), used: 0 });

  const take = (id, date, want) => {
    const s = slot(date);
    const n = Math.min(s.capacity - s.used, want);
    if (n <= 0) return 0;
    s.used += n;
    result[id].days.push({ date, words: n });
    return n;
  };

  const firstWorkingDay = from => {
    let d = from;
    for (let i = 0; i < HORIZON_DAYS && slot(d).capacity === 0; i++) d = addDays(d, 1);
    return slot(d).capacity > 0 ? d : null;
  };

  // 1. Pinned pieces whose date is still ahead keep that date.
  const pinned = pieces
    .filter(p => p.pinned && p.dueDate && p.dueDate >= start)
    .sort((a, b) => (a.dueDate === b.dueDate ? queueOrder(a, b) : a.dueDate < b.dueDate ? -1 : 1));

  for (const p of pinned) {
    result[p.id] = { due: p.dueDate, days: [], fits: true };
    let left = wordsOf(p);
    for (let d = p.dueDate; left > 0 && d >= start; d = addDays(d, -1)) left -= take(p.id, d, left);
    result[p.id].days.reverse();
    result[p.id].fits = left <= 0;
  }

  // 2. Everything else, in queue order, from the start date forward.
  const queue = pieces.filter(p => !result[p.id]).sort(queueOrder);

  for (const p of queue) {
    result[p.id] = { due: null, days: [], fits: false };
    const from = p.earliestStart && p.earliestStart > start ? p.earliestStart : start;
    let left = wordsOf(p);

    if (left === 0) {
      const d = firstWorkingDay(from);
      result[p.id] = { due: d, days: [], fits: d !== null };
      continue;
    }

    let d = from;
    for (let i = 0; left > 0 && i < HORIZON_DAYS; i++, d = addDays(d, 1)) left -= take(p.id, d, left);
    if (left <= 0) {
      result[p.id].due = result[p.id].days.at(-1).date;
      result[p.id].fits = true;
    }
  }

  return { pieces: result, days };
}

/**
 * Suggests a due date for a new piece, and lists open pieces it would push back.
 * newPiece: { words, priority, dateBooked }
 * openPieces: the writer's pieces still in WRITING_STAGES.
 */
export function suggestDueDate({ writer, openPieces, newPiece, timeOff = [], holidays = [], today, startNextDay = true }) {
  const candidate = {
    ...newPiece,
    id: newPiece.id || '__new__',
    pinned: false,
    earliestStart: startNextDay ? nextWorkingDay(today) : today,
  };
  const before = planWriter({ writer, pieces: openPieces, timeOff, holidays, start: today });
  const after = planWriter({ writer, pieces: [...openPieces, candidate], timeOff, holidays, start: today });

  const moved = openPieces
    .filter(p => before.pieces[p.id]?.due !== after.pieces[p.id]?.due)
    .map(p => ({ id: p.id, from: before.pieces[p.id]?.due ?? null, to: after.pieces[p.id]?.due ?? null }));

  const mine = after.pieces[candidate.id];
  return { due: mine.due, days: mine.days, fits: mine.fits, moved };
}
