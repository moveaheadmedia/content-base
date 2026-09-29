// What the admin can change on the Settings page: field names, dropdown lists,
// stage names, which columns show, and extra fields of the team's own.
//
// Saved settings sit on top of the starting values in config.js: anything the
// admin hasn't changed uses the starting value. Field and stage names are saved
// only when renamed; lists, columns and extra fields are saved whole once edited.

import { CONFIG, CONTENT_TYPES, LANGUAGES, STAGES, TIME_OFF_REASONS } from './config.js';

// Built-in content fields, in the same order as the old sheet, then the new ones.
// `compact` = shown in the Compact view by default. Cost and Revisions are worked out, not typed.
export const FIELDS = [
  { key: 'dateBooked', label: 'Date booked', sheet: true },
  { key: 'bookedBy', label: 'Booked by', sheet: true },
  { key: 'writerId', label: 'Writer', compact: true, sheet: true },
  { key: 'clientId', label: 'Client', sheet: true },
  { key: 'title', label: 'Working title', compact: true, sheet: true, required: true },
  { key: 'language', label: 'Language', sheet: true },
  { key: 'type', label: 'Content type', sheet: true },
  { key: 'briefLink', label: 'Brief link', sheet: true },
  { key: 'words', label: 'Target words', compact: true, sheet: true },
  { key: 'cost', label: 'Cost (USD)', sheet: true },
  { key: 'dueDate', label: 'Due date', compact: true, sheet: true },
  { key: 'dateReceived', label: 'Date received', sheet: true },
  { key: 'contentLink', label: 'Content link', sheet: true },
  { key: 'status', label: 'Stage', compact: true, sheet: true, required: true },
  { key: 'dateApproved', label: 'Date approved', sheet: true },
  { key: 'notes', label: 'Notes', sheet: true },
  { key: 'amId', label: 'AM', sheet: true },
  { key: 'neededBy', label: 'Needed by', sheet: true },
  { key: 'priority', label: 'Priority', compact: true, sheet: true },
  { key: 'qcBy', label: 'QC by', sheet: true },
  { key: 'summary', label: 'Summary added', sheet: true },
  { key: 'revisions', label: 'Revisions', sheet: true },
  { key: 'clickupLink', label: 'ClickUp task link', sheet: true },
];

export const CUSTOM_TYPES = [
  { value: 'text', label: 'Short text' },
  { value: 'longtext', label: 'Long text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'link', label: 'Link' },
  { value: 'tick', label: 'Tick box' },
  { value: 'choice', label: 'Dropdown' },
];

// The lists the admin can edit. Priority stays fixed because due dates depend on it.
export const LISTS = [
  { key: 'languages', label: 'Languages', defaults: LANGUAGES, usedBy: { tab: 'content', field: 'language' } },
  { key: 'types', label: 'Content types', defaults: CONTENT_TYPES, usedBy: { tab: 'content', field: 'type' } },
  { key: 'timeOffReasons', label: 'Time off reasons', defaults: TIME_OFF_REASONS, usedBy: { tab: 'timeoff', field: 'reason' } },
];

export const SETTINGS_ID = 'S-01';

export function defaultSettings() {
  return {
    id: SETTINGS_ID,
    appName: CONFIG.appName,
    labels: {},
    lists: Object.fromEntries(LISTS.map(l => [l.key, [...l.defaults]])),
    stages: {},
    columns: {
      compact: FIELDS.filter(f => f.compact).map(f => f.key),
      sheet: FIELDS.filter(f => f.sheet).map(f => f.key),
    },
    customFields: [],
  };
}

// Saved settings on top of the defaults. Missing or broken parts fall back to the default.
export function mergeSettings(saved) {
  const base = defaultSettings();
  if (!saved || typeof saved !== 'object') return base;
  const lists = { ...base.lists };
  for (const l of LISTS) {
    if (Array.isArray(saved.lists?.[l.key]) && saved.lists[l.key].length) lists[l.key] = saved.lists[l.key].map(String);
  }
  const columns = { ...base.columns };
  for (const view of ['compact', 'sheet']) {
    if (Array.isArray(saved.columns?.[view])) columns[view] = saved.columns[view].map(String);
  }
  return {
    ...base,
    appName: String(saved.appName || base.appName),
    labels: { ...(saved.labels || {}) },
    lists,
    stages: { ...(saved.stages || {}) },
    columns,
    customFields: Array.isArray(saved.customFields) ? saved.customFields : [],
  };
}

// ---- The settings in use right now ------------------------------------------
// Set once per screen draw by app.js, so every screen sees the latest.

let current = defaultSettings();

export function useSettings(saved) {
  current = mergeSettings(saved);
  return current;
}

export const settings = () => current;
export const appName = () => current.appName;

export function fieldLabel(key) {
  if (current.labels[key]) return current.labels[key];
  if (key.startsWith('custom:')) return customField(key.slice(7))?.label || key;
  return FIELDS.find(f => f.key === key)?.label || key;
}

export const listValues = name => current.lists[name] || [];

export const customFields = () => current.customFields;
export const customField = id => current.customFields.find(f => f.id === id) || null;

export function stages() {
  return STAGES.map(s => ({
    ...s,
    label: current.stages[s.key]?.label || s.label,
    writer: current.stages[s.key]?.writer || s.writer,
  }));
}

// Columns always show in a fixed order; the admin only chooses which ones.
// Sheet view follows the old sheet. Compact view starts with the title and ends with the stage.
function columnOrder(view) {
  const builtIn = FIELDS.map(f => f.key);
  const custom = current.customFields.map(f => `custom:${f.id}`);
  if (view === 'sheet') return [...builtIn, ...custom];
  const first = ['title', 'writerId', 'clientId'];
  return [...first, ...builtIn.filter(k => !first.includes(k) && k !== 'status'), ...custom, 'status'];
}

// Column keys chosen for a view, in order. Fields that no longer exist drop out.
export function columnsFor(view) {
  const chosen = new Set(current.columns[view] || []);
  return columnOrder(view).filter(k => chosen.has(k));
}

// Every field the admin can place in a view: built-in first, then custom ones.
export function allFields() {
  return [
    ...FIELDS.map(f => ({ key: f.key, label: fieldLabel(f.key), builtIn: true, required: Boolean(f.required) })),
    ...current.customFields.map(f => ({ key: `custom:${f.id}`, label: f.label, builtIn: false, type: f.type })),
  ];
}

export function nextCustomId(fields) {
  const max = fields.reduce((m, f) => Math.max(m, Number(String(f.id).slice(2)) || 0), 0);
  return `F-${String(max + 1).padStart(2, '0')}`;
}
