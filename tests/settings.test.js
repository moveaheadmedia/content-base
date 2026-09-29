import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  allFields, columnsFor, defaultSettings, fieldLabel, listValues, mergeSettings, nextCustomId, stages, useSettings,
} from '../assets/js/settings.js';

test('with nothing saved, everything uses the defaults', () => {
  useSettings(null);
  assert.equal(fieldLabel('title'), 'Working title');
  assert.ok(listValues('languages').includes('Japanese'));
  assert.equal(stages()[0].label, 'Booked');
  assert.deepEqual(columnsFor('compact'), ['title', 'writerId', 'words', 'dueDate', 'priority', 'status']);
});

test('saved names, lists and stage names replace the defaults', () => {
  useSettings({
    labels: { title: 'Title' },
    lists: { languages: ['English', 'Thai'] },
    stages: { qc: { label: 'Checking', writer: 'With the team' } },
  });
  assert.equal(fieldLabel('title'), 'Title');
  assert.equal(fieldLabel('words'), 'Target words');
  assert.deepEqual(listValues('languages'), ['English', 'Thai']);
  const qc = stages().find(s => s.key === 'qc');
  assert.equal(qc.label, 'Checking');
  assert.equal(qc.writer, 'With the team');
});

test('an empty saved list falls back to the default list', () => {
  const s = mergeSettings({ lists: { types: [] } });
  assert.deepEqual(s.lists.types, defaultSettings().lists.types);
});

test('custom fields get labels and can be shown as columns; deleted ones drop out', () => {
  useSettings({
    customFields: [{ id: 'F-01', label: 'Target keyword', type: 'text' }],
    columns: { compact: ['title', 'custom:F-01', 'custom:F-99'], sheet: ['title'] },
  });
  assert.equal(fieldLabel('custom:F-01'), 'Target keyword');
  assert.deepEqual(columnsFor('compact'), ['title', 'custom:F-01']);
  assert.ok(allFields().some(f => f.key === 'custom:F-01' && !f.builtIn));
});

test('custom field ids count up', () => {
  assert.equal(nextCustomId([]), 'F-01');
  assert.equal(nextCustomId([{ id: 'F-01' }, { id: 'F-07' }]), 'F-08');
});
