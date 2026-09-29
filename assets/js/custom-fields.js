// Extra fields the admin adds on the Settings page (e.g. "Target keyword").
// Each piece keeps their values in `piece.custom`, keyed by the field's ID.

import { formatDate } from './dates.js';
import { customFields } from './settings.js';
import { esc, extLink, options, safeUrl, words } from './ui.js';

const nameOf = field => `custom__${field.id}`;

// A form control for one extra field, labelled with the field's name.
export function customInput(field, value, { disabled = false } = {}) {
  const dis = disabled ? 'disabled' : '';
  const name = nameOf(field);
  const v = value ?? '';
  const wrap = (control, wide = false) =>
    `<label class="field${wide ? ' field--wide' : ''}"><span class="field__label">${esc(field.label)}</span>${control}</label>`;
  switch (field.type) {
    case 'longtext': return wrap(`<textarea name="${name}" rows="3" ${dis}>${esc(v)}</textarea>`, true);
    case 'number': return wrap(`<input type="number" name="${name}" value="${esc(v)}" ${dis}>`);
    case 'date': return wrap(`<input type="date" name="${name}" value="${esc(v)}" ${dis}>`);
    case 'link': return wrap(`<input type="url" name="${name}" value="${esc(v)}" placeholder="https://" ${dis}>`, true);
    case 'choice': return wrap(`<select name="${name}" ${dis}>${options(field.options || [], v, { blank: 'Not set' })}</select>`);
    case 'tick':
      return `<span class="check field--wide"><input type="checkbox" name="${name}" ${v ? 'checked' : ''} ${dis}> ${esc(field.label)}</span>`;
    default: return wrap(`<input type="text" name="${name}" value="${esc(v)}" ${dis}>`);
  }
}

// Reads the extra fields from a form. Fields not on the form keep their current value.
export function readCustom(form, current = {}) {
  const out = { ...current };
  for (const field of customFields()) {
    const el = form.elements[nameOf(field)];
    if (!el || el.disabled) continue;
    if (field.type === 'tick') out[field.id] = el.checked;
    else if (field.type === 'number') out[field.id] = el.value === '' ? '' : Number(el.value);
    else out[field.id] = el.value.trim();
  }
  return out;
}

// Problems with the extra fields, in plain words.
export function customProblems(values) {
  return customFields()
    .filter(f => f.type === 'link' && values[f.id] && !safeUrl(values[f.id]))
    .map(f => `${f.label} must start with https://`);
}

// A value for a table cell.
export function customCell(field, value) {
  if (value === '' || value === null || value === undefined || value === false) return '';
  switch (field.type) {
    case 'tick': return 'Yes';
    case 'date': return esc(formatDate(value));
    case 'link': return extLink(value, 'Open');
    case 'number': return words(value);
    default: return `<span class="t-clip">${esc(value)}</span>`;
  }
}

// A value in plain words, for the change history.
export function customText(field, value) {
  if (value === '' || value === null || value === undefined) return 'empty';
  if (field?.type === 'tick') return value ? 'yes' : 'no';
  if (field?.type === 'date') return formatDate(value);
  return String(value);
}
