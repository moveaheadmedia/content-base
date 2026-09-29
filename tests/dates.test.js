import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addWorkingDays, formatDate, formatDay, monthLabel, nextWorkingDay, relativeDay, startOfWeek, workingDaysBetween,
} from '../assets/js/dates.js';

test('dates show as DD/MM/YYYY', () => {
  assert.equal(formatDate('2026-09-29'), '29/09/2026');
  assert.equal(formatDate(''), '');
  assert.equal(formatDay('2026-09-29'), 'Tue 29/09');
});

test('weeks start on Monday', () => {
  assert.equal(startOfWeek('2026-10-04'), '2026-09-28'); // Sunday
  assert.equal(startOfWeek('2026-09-28'), '2026-09-28'); // Monday
});

test('working days skip weekends', () => {
  assert.equal(nextWorkingDay('2026-10-02'), '2026-10-05'); // Fri -> Mon
  assert.equal(addWorkingDays('2026-10-02', 1), '2026-10-05');
  assert.equal(addWorkingDays('2026-10-05', -1), '2026-10-02');
  assert.equal(workingDaysBetween('2026-10-02', '2026-10-06'), 2);
  assert.equal(workingDaysBetween('2026-10-06', '2026-10-02'), -2);
});

test('plain-language labels', () => {
  assert.equal(monthLabel('2026-09'), 'September 2026');
  assert.equal(relativeDay('2026-10-01', '2026-09-29'), 'in 2 days');
  assert.equal(relativeDay('2026-09-27', '2026-09-29'), '2 days late');
  assert.equal(relativeDay('2026-09-29', '2026-09-29'), 'today');
});
