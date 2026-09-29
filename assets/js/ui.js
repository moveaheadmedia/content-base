// Small shared helpers for building screens.

import { stages } from './settings.js';
import { addDays, isWeekend, nextWorkingDay, startOfWeek } from './dates.js';

// ---- Safe text and links -------------------------------------------------

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ESCAPES[c]);

// Only web links can become clickable; anything else is shown as plain text.
export const safeUrl = url => {
  const u = String(url || '').trim();
  return /^https?:\/\/\S+$/i.test(u) ? u : '';
};

export function extLink(url, label) {
  const u = safeUrl(url);
  if (!u) return '';
  return `<a class="ext" href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`;
}

// ---- Numbers ---------------------------------------------------------------

export const words = n => Number(n || 0).toLocaleString('en-GB');
export const money = n => `$${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const rateText = n => `$${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
export const costOf = piece => (Number(piece.words) || 0) * (Number(piece.rate) || 0);

export const initials = name => String(name || '?').split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase();

// ---- Stages, priority and warnings --------------------------------------

export const stageOf = key => stages().find(s => s.key === key) || stages()[0];
export const stageIndex = key => stages().findIndex(s => s.key === key);
export const WRITING = ['booked', 'with_writer'];
export const FINISHED = ['approved', 'sent'];

export function stageChip(key, { writerView = false } = {}) {
  const s = stageOf(key);
  return `<span class="stage stage--${s.tone}">${esc(writerView ? s.writer : s.label)}</span>`;
}

export function priorityTag(p) {
  if (p === 'Urgent') return '<span class="prio prio--urgent">Urgent</span>';
  if (p === 'High') return '<span class="prio prio--high">High</span>';
  return '<span class="prio prio--normal">Normal</span>';
}

export function openRevision(pieceId, revisions) {
  return revisions
    .filter(r => r.contentId === pieceId && !r.dateReturned)
    .sort((a, b) => b.round - a.round)[0] || null;
}

// Red warning tags. These are never stages: a piece at any stage can carry one.
export function flagsFor(piece, { today, revisions = [] }) {
  const flags = [];
  const writing = WRITING.includes(piece.status);
  if (writing && piece.dueDate && piece.dueDate < today) flags.push({ kind: 'overdue', label: 'Overdue' });
  if (piece.status === 'revisions') {
    const rev = openRevision(piece.id, revisions);
    if (rev?.dueDate && rev.dueDate < today) flags.push({ kind: 'overdue', label: 'Revision overdue' });
  }
  if (!FINISHED.includes(piece.status) && piece.neededBy && piece.neededBy < today) {
    flags.push({ kind: 'past', label: 'Past needed-by' });
  } else if (writing && piece.neededBy && piece.dueDate && piece.dueDate > piece.neededBy) {
    flags.push({ kind: 'risk', label: 'Due after needed-by' });
  }
  return flags;
}

export const flagTags = flags => flags.map(f => `<span class="flag flag--${f.kind}">${esc(f.label)}</span>`).join('');

// The working week the team is looking at: this week, or next week at the weekend.
export function thisWeek(today) {
  const start = startOfWeek(isWeekend(today) ? nextWorkingDay(today) : today);
  return { start, end: addDays(start, 6) };
}

// Quick buttons, shared by the dashboard counts and the Content list so both agree.
export const QUICK = {
  week: {
    label: 'Due this week',
    test: (c, { today }) => {
      const { start, end } = thisWeek(today);
      return WRITING.includes(c.status) && c.dueDate >= start && c.dueDate <= end;
    },
  },
  overdue: {
    label: 'Overdue',
    test: (c, { today, revisions }) => flagsFor(c, { today, revisions }).some(f => f.kind === 'overdue'),
  },
  urgent: {
    label: 'Urgent',
    test: c => c.priority === 'Urgent' && !FINISHED.includes(c.status),
  },
  qc: {
    label: 'Waiting for QC',
    test: c => c.status === 'qc',
  },
  revisions: {
    label: 'Open revisions',
    test: c => c.status === 'revisions',
  },
};

// ---- Forms -----------------------------------------------------------------

// items: strings, or { value, label }. A saved value that is no longer in the list
// (the admin removed it) still shows, so nothing is lost by opening a piece.
export function options(items, selected = '', { blank } = {}) {
  const out = blank !== undefined ? [`<option value="">${esc(blank)}</option>`] : [];
  const values = items.map(it => String(typeof it === 'string' ? it : it.value));
  if (selected !== '' && selected !== null && selected !== undefined && !values.includes(String(selected))) {
    out.push(`<option value="${esc(selected)}" selected>${esc(selected)} (no longer in the list)</option>`);
  }
  for (const it of items) {
    const value = typeof it === 'string' ? it : it.value;
    const label = typeof it === 'string' ? it : it.label;
    out.push(`<option value="${esc(value)}"${String(value) === String(selected ?? '') ? ' selected' : ''}>${esc(label)}</option>`);
  }
  return out.join('');
}

export function formData(form) {
  const out = {};
  for (const el of form.elements) {
    if (!el.name || el.disabled) continue;
    if (el.type === 'checkbox') {
      if (el.hasAttribute('data-group')) {
        out[el.name] ??= [];
        if (el.checked) out[el.name].push(el.value);
      } else {
        out[el.name] = el.checked;
      }
    } else if (el.type === 'number') {
      out[el.name] = el.value === '' ? '' : Number(el.value);
    } else {
      out[el.name] = el.value.trim();
    }
  }
  return out;
}

// ---- Events ----------------------------------------------------------------

// Listens on `root` for events from any element matching `selector` inside it.
export function on(root, type, selector, handler) {
  root.addEventListener(type, event => {
    const target = event.target.closest(selector);
    if (target && root.contains(target)) handler(event, target);
  });
}

// ---- Toast -------------------------------------------------------------------

let toastTimer = null;
export function toast(message) {
  const root = document.getElementById('toast-root');
  root.innerHTML = `<div class="toast" role="status">${esc(message)}</div>`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { root.innerHTML = ''; }, 3200);
}

// ---- Side panel ----------------------------------------------------------------

let drawerState = null;

export function openDrawer({ title, label = '', body, wide = false, onClose }) {
  closeDrawer({ silent: true });
  const root = document.getElementById('drawer-root');
  const opener = document.activeElement;
  root.innerHTML = `
    <div class="drawer-backdrop" data-close></div>
    <aside class="drawer${wide ? ' drawer--wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
      <header class="drawer__head">
        <div>
          ${label ? `<p class="drawer__label">${esc(label)}</p>` : ''}
          <h2 id="drawer-title">${esc(title)}</h2>
        </div>
        <button class="icon-btn" type="button" data-close aria-label="Close">${ICONS.close}</button>
      </header>
      <div class="drawer__body">${body}</div>
    </aside>`;
  document.body.classList.add('has-drawer');
  const panel = root.querySelector('.drawer');
  const onKey = e => { if (e.key === 'Escape') closeDrawer(); };
  document.addEventListener('keydown', onKey);
  root.querySelectorAll('[data-close]').forEach(el => el.addEventListener('click', () => closeDrawer()));
  drawerState = { onKey, onClose, opener };
  panel.querySelector('input, select, textarea, button:not([data-close])')?.focus({ preventScroll: true });
  return panel;
}

export function closeDrawer({ silent = false } = {}) {
  if (!drawerState) return;
  const { onKey, onClose, opener } = drawerState;
  drawerState = null;
  document.removeEventListener('keydown', onKey);
  document.getElementById('drawer-root').innerHTML = '';
  document.body.classList.remove('has-drawer');
  if (!silent) {
    onClose?.();
    if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
  }
}

// ---- Icons (inline, so the page needs no icon files) -------------------------

const svg = path => `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;

export const ICONS = {
  dashboard: svg('<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>'),
  content: svg('<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.5" cy="6" r="1"/><circle cx="3.5" cy="12" r="1"/><circle cx="3.5" cy="18" r="1"/>'),
  book: svg('<path d="M12 5v14M5 12h14"/>'),
  writers: svg('<path d="M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20"/><circle cx="10" cy="8" r="3.5"/><path d="M20 20v-1.5a3.5 3.5 0 0 0-2.5-3.35M15.5 4.6a3.5 3.5 0 0 1 0 6.8"/>'),
  clients: svg('<path d="M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16"/><path d="M16 9h2a2 2 0 0 1 2 2v10M8 7h4M8 11h4M8 15h4M2 21h20"/>'),
  timeoff: svg('<rect x="3" y="4.5" width="18" height="16.5" rx="2"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>'),
  mywork: svg('<path d="M9 11l2 2 4-4"/><rect x="3" y="3" width="18" height="18" rx="2"/>'),
  close: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
  menu: svg('<path d="M4 7h16M4 12h16M4 17h16"/>'),
  pin: svg('<path d="M9 4h6l-1 6 3 3H7l3-3-1-6zM12 13v8"/>'),
  settings: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
};
