import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dayCapacity, planWriter, suggestDueDate } from '../assets/js/schedule.js';

// Reference week: Mon 2026-10-05 to Fri 2026-10-09.
const MON = '2026-10-05', TUE = '2026-10-06', WED = '2026-10-07', THU = '2026-10-08', FRI = '2026-10-09';
const SAT = '2026-10-10', NEXT_MON = '2026-10-12';

const flat = limit => ({ mon: limit, tue: limit, wed: limit, thu: limit, fri: limit });
const writer = { id: 'W-01', capacity: flat(2000) };
const piece = (id, words, extra = {}) => ({ id, words, priority: 'Normal', dateBooked: '2026-10-01', ...extra });

test('no capacity on weekends, holidays or time off', () => {
  assert.equal(dayCapacity(writer, SAT), 0);
  assert.equal(dayCapacity(writer, MON, { holidays: [{ date: MON }] }), 0);
  assert.equal(dayCapacity(writer, TUE, { timeOff: [{ writerId: 'W-01', from: MON, to: WED }] }), 0);
  assert.equal(dayCapacity(writer, TUE, { timeOff: [{ writerId: 'W-02', from: MON, to: WED }] }), 2000);
  assert.equal(dayCapacity({ id: 'W-03', capacity: { mon: 500, tue: 500, wed: 1500 } }, WED), 1500);
});

test('the plan doc example: 1,500 booked Monday, a new 1,000-word piece is due Tuesday', () => {
  const r = suggestDueDate({
    writer, openPieces: [piece('C-1', 1500)], newPiece: { words: 1000, priority: 'Normal', dateBooked: MON },
    today: MON, startNextDay: false,
  });
  assert.equal(r.due, TUE);
  assert.deepEqual(r.days, [{ date: MON, words: 500 }, { date: TUE, words: 500 }]);
  assert.deepEqual(r.moved, []);
});

test('new work starts the next working day by default', () => {
  const r = suggestDueDate({ writer, openPieces: [], newPiece: { words: 800, dateBooked: FRI }, today: FRI });
  assert.equal(r.due, NEXT_MON);
});

test('an urgent piece goes first and pushes normal pieces back', () => {
  const open = [piece('C-1', 2000), piece('C-2', 2000)];
  const r = suggestDueDate({
    writer, openPieces: open, newPiece: { words: 2000, priority: 'Urgent', dateBooked: MON }, today: MON,
  });
  // Urgent can't start before Tuesday, so it takes all of Tuesday.
  assert.equal(r.due, TUE);
  assert.deepEqual(r.moved, [{ id: 'C-2', from: TUE, to: WED }]);
});

test('same priority: the earliest booked goes first', () => {
  const plan = planWriter({
    writer, start: MON,
    pieces: [piece('C-2', 2000, { dateBooked: '2026-10-02' }), piece('C-1', 2000, { dateBooked: '2026-09-30' })],
  });
  assert.equal(plan.pieces['C-1'].due, MON);
  assert.equal(plan.pieces['C-2'].due, TUE);
});

test('a pinned piece keeps its date and leaves earlier days free', () => {
  const plan = planWriter({
    writer, start: MON,
    pieces: [piece('PIN', 1000, { pinned: true, dueDate: THU }), piece('C-1', 3000)],
  });
  assert.equal(plan.pieces.PIN.due, THU);
  assert.deepEqual(plan.pieces.PIN.days, [{ date: THU, words: 1000 }]);
  assert.equal(plan.pieces['C-1'].due, TUE);
  assert.equal(plan.pieces.PIN.fits, true);
});

test('a pinned piece that cannot fit by its date is flagged', () => {
  const plan = planWriter({ writer, start: MON, pieces: [piece('PIN', 5000, { pinned: true, dueDate: TUE })] });
  assert.equal(plan.pieces.PIN.due, TUE);
  assert.equal(plan.pieces.PIN.fits, false);
});

test('time off and holidays are skipped', () => {
  const plan = planWriter({
    writer, start: MON,
    timeOff: [{ writerId: 'W-01', from: MON, to: TUE, reason: 'Sick' }],
    holidays: [{ date: WED }],
    pieces: [piece('C-1', 3000)],
  });
  assert.deepEqual(plan.pieces['C-1'].days, [{ date: THU, words: 2000 }, { date: FRI, words: 1000 }]);
  assert.equal(plan.pieces['C-1'].due, FRI);
});

test('a piece with no word count is due on the first working day', () => {
  const plan = planWriter({ writer, start: SAT, pieces: [piece('C-1', 0)] });
  assert.equal(plan.pieces['C-1'].due, NEXT_MON);
});

test('a writer with no capacity gets no due date', () => {
  const plan = planWriter({ writer: { id: 'W-9', capacity: {} }, start: MON, pieces: [piece('C-1', 500)] });
  assert.equal(plan.pieces['C-1'].due, null);
  assert.equal(plan.pieces['C-1'].fits, false);
});
