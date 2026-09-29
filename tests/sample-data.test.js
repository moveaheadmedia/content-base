import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSampleData } from '../assets/js/sample-data.js';
import { STAGES } from '../assets/js/config.js';
import { planWriter, WRITING_STAGES } from '../assets/js/schedule.js';
import { QUICK } from '../assets/js/ui.js';

const TODAY = '2026-09-29';
const data = buildSampleData(TODAY);

test('every row has a unique id', () => {
  for (const tab of ['team', 'ams', 'writers', 'clients', 'content', 'revisions', 'timeoff', 'holidays', 'history', 'settings']) {
    const ids = data[tab].map(r => r.id);
    assert.equal(new Set(ids).size, ids.length, `duplicate id in ${tab}`);
  }
});

test('every reference points at a real row', () => {
  const has = (tab, id) => data[tab].some(r => r.id === id);
  for (const c of data.content) {
    assert.ok(has('clients', c.clientId), `${c.id} client`);
    assert.ok(has('writers', c.writerId), `${c.id} writer`);
    assert.ok(has('ams', c.amId), `${c.id} AM`);
    assert.ok(has('team', c.bookedBy), `${c.id} booked by`);
    if (c.qcBy) assert.ok(has('team', c.qcBy), `${c.id} QC by`);
    assert.ok(STAGES.some(s => s.key === c.status), `${c.id} stage`);
  }
  for (const r of data.revisions) assert.ok(has('content', r.contentId));
  for (const t of data.timeoff) assert.ok(has('writers', t.writerId));
  for (const c of data.clients) {
    assert.ok(has('writers', c.usualWriterId));
    if (c.backupWriterId) assert.ok(has('writers', c.backupWriterId));
  }
});

test('no real-looking contact details: every email and link uses example.com', () => {
  for (const p of [...data.team, ...data.writers]) assert.match(p.email, /@example\.com$/);
  for (const c of data.content) {
    for (const link of [c.briefLink, c.contentLink, c.clickupLink].filter(Boolean)) assert.match(link, /^https:\/\/[a-z.]*example\.com\//);
  }
});

test('the practice data shows one overdue piece, work due this week and work waiting for QC', () => {
  const revisions = data.revisions;
  const count = key => data.content.filter(c => QUICK[key].test(c, { today: TODAY, revisions })).length;
  assert.equal(count('overdue'), 1);
  for (const key of ['week', 'qc']) assert.ok(count(key) > 0, `nothing for ${key}`);
});

test('every writer with open work gets a plan', () => {
  for (const w of data.writers) {
    const open = data.content.filter(c => c.writerId === w.id && WRITING_STAGES.includes(c.status));
    const plan = planWriter({ writer: w, pieces: open, timeOff: data.timeoff, holidays: data.holidays, start: TODAY });
    for (const p of open) assert.ok(plan.pieces[p.id].due, `${p.id} has no planned date`);
  }
});
