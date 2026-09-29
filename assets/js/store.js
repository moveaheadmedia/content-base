// Where the tool keeps its information.
//
// Screens only ever use the functions returned by createStore(), never the storage
// itself. In round 1 that is the practice store below (made-up data in this browser).
// In round 2 a sheet store with the same functions will talk to the Google script,
// and the screens will not need to change.
//
// Each tab below becomes a tab in the Google Sheet: one row per item, headings in row 1.

import { CONFIG } from './config.js';
import { nowStamp } from './dates.js';
import { buildSampleData, SAMPLE_VERSION } from './sample-data.js';

export const TABS = ['team', 'ams', 'writers', 'clients', 'content', 'revisions', 'timeoff', 'holidays', 'history', 'settings'];

// Every row gets its own ID; tabs refer to each other by these IDs, never by name.
const ID_FORMAT = {
  team: ['T-', 2], ams: ['AM-', 2], writers: ['W-', 2], clients: ['CL-', 2], content: ['C-', 4],
  revisions: ['R-', 4], timeoff: ['O-', 3], holidays: ['H-', 3], history: ['L-', 5], settings: ['S-', 2],
};

const STORAGE_KEY = `content-base:practice:v${SAMPLE_VERSION}`;

export function createStore({ today }) {
  if (CONFIG.mode === 'practice') return createPracticeStore({ today });
  throw new Error(`Storage mode "${CONFIG.mode}" isn't available yet. It arrives in round 2.`);
}

// Removes practice data saved by earlier versions, so nobody sees the old sample set.
function forgetOldVersions() {
  try {
    for (let v = 1; v < SAMPLE_VERSION; v++) localStorage.removeItem(`content-base:practice:v${v}`);
  } catch { /* nothing saved */ }
}

function readSaved() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeSaved(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

const isValid = data => data && data.version === SAMPLE_VERSION && Array.isArray(data.content);

// Adds any tab a newer version of the tool expects, so saved practice data keeps working.
function upgrade(data) {
  for (const tab of TABS) if (!Array.isArray(data[tab])) data[tab] = [];
  return data;
}

const same = (a, b) => JSON.stringify(a ?? '') === JSON.stringify(b ?? '');

function createPracticeStore({ today }) {
  let data = null;
  let saving = true; // false when this browser won't let us save

  const copy = row => structuredClone(row);
  const persist = () => { saving = writeSaved(data); };

  const nextId = tab => {
    const [prefix, width] = ID_FORMAT[tab];
    const max = data[tab].reduce((m, r) => Math.max(m, Number(String(r.id).slice(prefix.length)) || 0), 0);
    return `${prefix}${String(max + 1).padStart(width, '0')}`;
  };

  const log = ({ tab, entityId, by, action, note = '', changes = [] }) => {
    data.history.push({ id: nextId('history'), at: nowStamp(), by: by || '', tab, entityId, action, note, changes });
  };

  return {
    mode: 'practice',
    get saving() { return saving; },

    async load() {
      forgetOldVersions();
      const saved = readSaved();
      data = upgrade(isValid(saved) ? saved : buildSampleData(today));
      if (!isValid(saved)) persist();
    },

    async reset() {
      data = upgrade(buildSampleData(today));
      persist();
    },

    all(tab) {
      return data[tab].map(copy);
    },

    get(tab, id) {
      const row = data[tab].find(r => r.id === id);
      return row ? copy(row) : null;
    },

    // Adds a row (no id, or an id not yet used) or updates one. Every change is logged.
    // `note` describes the change in words, e.g. "Moved to QC".
    async save(tab, row, { by, note, action } = {}) {
      const list = data[tab];
      const i = row.id ? list.findIndex(r => r.id === row.id) : -1;
      let saved;
      if (i === -1) {
        saved = { ...row, id: row.id || nextId(tab) };
        list.push(saved);
        log({ tab, entityId: saved.id, by, action: action || 'created', note: note || 'Created' });
      } else {
        const before = list[i];
        saved = { ...before, ...row };
        const changes = Object.keys(saved)
          .filter(k => k !== 'id' && !same(before[k], saved[k]))
          .map(field => ({ field, from: before[field] ?? '', to: saved[field] ?? '' }));
        list[i] = saved;
        if (changes.length || note) log({ tab, entityId: saved.id, by, action: action || 'updated', note: note || '', changes });
      }
      persist();
      return copy(saved);
    },

    async remove(tab, id, { by, note } = {}) {
      const i = data[tab].findIndex(r => r.id === id);
      if (i === -1) return;
      data[tab].splice(i, 1);
      log({ tab, entityId: id, by, action: 'removed', note: note || 'Removed' });
      persist();
    },

    historyFor(entityId) {
      return data.history
        .filter(h => h.entityId === entityId)
        .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
        .map(copy);
    },
  };
}
