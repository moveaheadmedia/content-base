// Content list: every piece, with filters, quick buttons, and a side panel per piece.
// Column names, dropdown lists, stage names and which columns show come from Settings.

import { PRIORITIES } from '../config.js';
import { addWorkingDays, formatDate, formatStamp, monthKey, monthLabel, relativeDay } from '../dates.js';
import { PRIORITY_RANK, suggestDueDate } from '../schedule.js';
import { columnsFor, customField, customFields, fieldLabel, listValues, stages } from '../settings.js';
import { customCell, customInput, customProblems, customText, readCustom } from '../custom-fields.js';
import {
  closeDrawer, costOf, esc, extLink, flagsFor, flagTags, formData, ICONS, money, on, openDrawer,
  openRevision, options, priorityTag, QUICK, rateText, safeUrl, stageChip, stageIndex, stageOf, toast, words, WRITING,
} from '../ui.js';

const FILTER_KEYS = ['q', 'month', 'writer', 'client', 'am', 'status', 'priority', 'language', 'type', 'bookedBy', 'qcBy', 'quick'];
const blankFilters = () => Object.fromEntries(FILTER_KEYS.map(k => [k, '']));

const state = { ...blankFilters(), view: 'compact', sort: 'due', more: false };

const DATE_FIELDS = ['dueDate', 'neededBy', 'dateReceived', 'dateApproved', 'dateBooked'];

export function renderContent(ctx) {
  const { el, query } = ctx;

  // Links such as #/content?quick=overdue or #/content?writer=W-01 set the filters.
  const incoming = FILTER_KEYS.filter(k => query.has(k));
  if (incoming.length) {
    Object.assign(state, blankFilters());
    incoming.forEach(k => { state[k] = query.get(k); });
    history.replaceState(null, '', ctx.param ? `#/content/${ctx.param}` : '#/content');
  }

  ctx.setHeader({
    title: 'Content',
    subtitle: 'Every piece, from booking to handover.',
    actions: ctx.can('book') ? `<a class="btn btn--primary" href="#/book">${ICONS.book}<span>Book content</span></a>` : '',
  });

  el.innerHTML = `
    <section class="panel filters" aria-label="Filters">${filterBar(ctx)}</section>
    <section class="panel table-panel" aria-live="polite" id="results"></section>`;

  drawResults(ctx);
  bindFilters(ctx);

  on(el, 'click', 'tr[data-id]', (event, row) => {
    if (event.target.closest('a')) return;
    openPiece(ctx, row.dataset.id);
  });
  on(el, 'keydown', 'tr[data-id]', (event, row) => {
    if (event.key === 'Enter') openPiece(ctx, row.dataset.id);
  });

  if (ctx.param) openPiece(ctx, ctx.param);
}

// ---- Filters ---------------------------------------------------------------

function filterBar(ctx) {
  const { store } = ctx;
  const content = store.all('content');
  const months = [...new Set(content.map(c => monthKey(c.dateBooked)))].sort().reverse();
  const people = list => list.map(p => ({ value: p.id, label: p.name }));
  const select = (name, label, items, blank) =>
    `<label class="field field--inline"><span class="sr-only">${esc(label)}</span><select name="${name}" aria-label="${esc(label)}">${options(items, state[name], { blank })}</select></label>`;

  return `
    <div class="filters__row">
      <label class="search">
        <span class="sr-only">Search</span>
        <input type="search" name="q" value="${esc(state.q)}" placeholder="Search title, client, writer or ID" autocomplete="off">
      </label>
      ${select('month', 'Month booked', months.map(m => ({ value: m, label: monthLabel(m) })), 'All months')}
      ${select('writer', fieldLabel('writerId'), people(store.all('writers')), `All ${fieldLabel('writerId').toLowerCase()}s`)}
      ${select('status', fieldLabel('status'), stages().map(s => ({ value: s.key, label: s.label })), `All ${fieldLabel('status').toLowerCase()}s`)}
      ${select('priority', fieldLabel('priority'), PRIORITIES, `Any ${fieldLabel('priority').toLowerCase()}`)}
      <button type="button" class="btn btn--small" data-act="more" aria-expanded="${state.more}" aria-controls="more-filters">More filters</button>
    </div>
    <div class="filters__row" id="more-filters" ${state.more ? '' : 'hidden'}>
      ${select('client', fieldLabel('clientId'), people(store.all('clients')), `All ${fieldLabel('clientId').toLowerCase()}s`)}
      ${select('am', fieldLabel('amId'), people(store.all('ams')), `All ${fieldLabel('amId')}s`)}
      ${select('language', fieldLabel('language'), listValues('languages'), `All ${fieldLabel('language').toLowerCase()}s`)}
      ${select('type', fieldLabel('type'), listValues('types'), `All ${fieldLabel('type').toLowerCase()}s`)}
      ${select('bookedBy', fieldLabel('bookedBy'), people(store.all('team')), `${fieldLabel('bookedBy')} anyone`)}
      ${select('qcBy', fieldLabel('qcBy'), people(store.all('team')), `${fieldLabel('qcBy')} anyone`)}
    </div>
    <div class="filters__row filters__row--quick">
      <div class="quick" role="group" aria-label="Quick filters">
        ${['week', 'overdue', 'urgent', 'qc'].map(k => `<button type="button" class="chip-btn" data-quick="${k}" aria-pressed="${state.quick === k}">${esc(QUICK[k].label)}</button>`).join('')}
        ${state.quick === 'revisions' ? `<button type="button" class="chip-btn" data-quick="revisions" aria-pressed="true">${esc(QUICK.revisions.label)}</button>` : ''}
      </div>
      <div class="filters__tools">
        <label class="field field--inline"><span class="sr-only">Sort</span>
          <select name="sort" aria-label="Sort">${options([
            { value: 'due', label: `Sort by ${fieldLabel('dueDate').toLowerCase()} (open first)` },
            { value: 'booked', label: 'Newest booked first' },
            { value: 'stage', label: `Sort by ${fieldLabel('status').toLowerCase()}` },
          ], state.sort)}</select>
        </label>
        <div class="seg" role="group" aria-label="Table layout">
          <button type="button" data-view="compact" aria-pressed="${state.view === 'compact'}">Compact</button>
          <button type="button" data-view="sheet" aria-pressed="${state.view === 'sheet'}">Sheet view</button>
        </div>
      </div>
    </div>`;
}

function bindFilters(ctx) {
  const bar = ctx.el.querySelector('.filters');
  bar.addEventListener('input', event => {
    const t = event.target;
    if (!t.name) return;
    state[t.name] = t.value;
    drawResults(ctx);
  });
  on(bar, 'click', '[data-quick]', (event, btn) => {
    state.quick = state.quick === btn.dataset.quick ? '' : btn.dataset.quick;
    bar.querySelectorAll('[data-quick]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.quick === state.quick)));
    drawResults(ctx);
  });
  on(bar, 'click', '[data-view]', (event, btn) => {
    state.view = btn.dataset.view;
    bar.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === state.view)));
    drawResults(ctx);
  });
  on(bar, 'click', '[data-act="more"]', (event, btn) => {
    state.more = !state.more;
    btn.setAttribute('aria-expanded', String(state.more));
    bar.querySelector('#more-filters').hidden = !state.more;
  });
  on(ctx.el, 'click', '[data-act="clear"]', () => {
    Object.assign(state, blankFilters());
    ctx.el.querySelector('.filters').innerHTML = filterBar(ctx);
    drawResults(ctx);
  });
}

function filtered(ctx) {
  const { store, today, lookup } = ctx;
  const revisions = store.all('revisions');
  const q = state.q.toLowerCase();
  const rows = store.all('content').filter(c => {
    if (q) {
      const hay = `${c.id} ${c.title} ${lookup.name('clients', c.clientId)} ${lookup.name('writers', c.writerId)} ${c.notes}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (state.month && monthKey(c.dateBooked) !== state.month) return false;
    if (state.writer && c.writerId !== state.writer) return false;
    if (state.client && c.clientId !== state.client) return false;
    if (state.am && c.amId !== state.am) return false;
    if (state.status && c.status !== state.status) return false;
    if (state.priority && c.priority !== state.priority) return false;
    if (state.language && c.language !== state.language) return false;
    if (state.type && c.type !== state.type) return false;
    if (state.bookedBy && c.bookedBy !== state.bookedBy) return false;
    if (state.qcBy && c.qcBy !== state.qcBy) return false;
    if (state.quick && !QUICK[state.quick]?.test(c, { today, revisions })) return false;
    return true;
  });

  const FINISHED = ['approved', 'sent'];
  const byDue = (a, b) => {
    const fa = FINISHED.includes(a.status), fb = FINISHED.includes(b.status);
    if (fa !== fb) return fa ? 1 : -1;
    if ((a.dueDate || '9') !== (b.dueDate || '9')) return (a.dueDate || '9') < (b.dueDate || '9') ? -1 : 1;
    return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
  };
  const sorters = {
    due: byDue,
    booked: (a, b) => (a.dateBooked === b.dateBooked ? (a.id < b.id ? 1 : -1) : a.dateBooked < b.dateBooked ? 1 : -1),
    stage: (a, b) => stageIndex(a.status) - stageIndex(b.status) || byDue(a, b),
  };
  return { rows: rows.sort(sorters[state.sort] || byDue), revisions };
}

// ---- Results -----------------------------------------------------------------

function drawResults(ctx) {
  const box = ctx.el.querySelector('#results');
  const { rows, revisions } = filtered(ctx);
  const active = FILTER_KEYS.some(k => state[k]);
  const total = ctx.store.all('content').length;

  const head = `
    <div class="results__head">
      <p><strong>${rows.length}</strong> of ${total} pieces</p>
      ${active ? '<button type="button" class="linkish" data-act="clear">Clear filters</button>' : ''}
    </div>`;

  if (!rows.length) {
    box.innerHTML = `${head}<div class="empty"><p>No pieces match these filters.</p>${active ? '<button type="button" class="btn" data-act="clear">Clear filters</button>' : ''}</div>`;
    return;
  }
  box.innerHTML = head + table(ctx, rows, revisions, state.view);
}

// One table for both views; the columns come from Settings.
function table(ctx, rows, revisions, view) {
  const keys = columnsFor(view).filter(k => k !== 'cost' || ctx.can('see-cost'));
  const cells = keys.map(k => ({ key: k, label: fieldLabel(k), ...cellRule(k, ctx, revisions, view) }));
  const compact = view === 'compact';

  const body = rows.map(c => `
    <tr data-id="${esc(c.id)}" tabindex="0">
      <td class="t-id" data-label="ID">${esc(c.id)}</td>
      ${cells.map(col => `<td class="${col.cls || ''}" data-label="${esc(col.label)}">${col.render(c)}</td>`).join('')}
    </tr>`).join('');

  return `
    <div class="table-scroll${compact ? '' : ' table-scroll--sheet'}">
      <table class="table ${compact ? 'table--compact' : 'table--sheet'}">
        <thead><tr><th scope="col">ID</th>${cells.map(col => `<th scope="col"${col.cls?.includes('num') ? ' class="num"' : ''}>${esc(col.label)}</th>`).join('')}</tr></thead>
        <tbody>${body}</tbody>
      </table>
    </div>`;
}

// How each column shows a piece.
function cellRule(key, ctx, revisions, view) {
  const { lookup, today } = ctx;
  const compact = view === 'compact';
  const date = field => ({ render: c => esc(formatDate(c[field])), cls: 't-nowrap' });
  const link = field => ({ render: c => extLink(c[field], 'Open') });
  const pin = c => (c.pinned ? `<span class="pin" title="Pinned date">${ICONS.pin}</span>` : '');

  if (key.startsWith('custom:')) {
    const field = customField(key.slice(7));
    return { render: c => (field ? customCell(field, c.custom?.[field.id]) : '') };
  }
  switch (key) {
    case 'title': return compact
      ? {
        cls: 'cell-title',
        render: c => `<span class="t-title">${esc(c.title)}</span><span class="t-sub">${esc(lookup.name('clients', c.clientId))}<span class="t-meta">${esc(c.language)}, ${esc(c.type)}</span></span>`,
      }
      : { render: c => `<span class="t-clip">${esc(c.title)}</span>` };
    case 'writerId': return { cls: 't-nowrap', render: c => esc(lookup.name('writers', c.writerId)) };
    case 'clientId': return { cls: 't-nowrap', render: c => esc(lookup.name('clients', c.clientId)) };
    case 'amId': return { cls: 't-nowrap', render: c => esc(lookup.name('ams', c.amId)) };
    case 'bookedBy': return { cls: 't-nowrap', render: c => esc(lookup.person(c.bookedBy)) };
    case 'qcBy': return { cls: 't-nowrap', render: c => esc(lookup.person(c.qcBy)) };
    case 'language': return { render: c => esc(c.language) };
    case 'type': return { render: c => esc(c.type) };
    case 'words': return { cls: 'num', render: c => words(c.words) };
    case 'cost': return { cls: 'num', render: c => money(costOf(c)) };
    case 'dueDate': return {
      cls: 't-nowrap',
      render: c => `<span class="t-date">${esc(formatDate(c.dueDate))}${pin(c)}</span>${compact && WRITING.includes(c.status) && c.dueDate ? `<span class="t-sub">${esc(relativeDay(c.dueDate, today))}</span>` : ''}`,
    };
    case 'dateBooked': case 'dateReceived': case 'dateApproved': case 'neededBy': return date(key);
    case 'briefLink': case 'contentLink': case 'clickupLink': return link(key);
    case 'status': return { render: c => `<span class="stage-cell">${stageChip(c.status)}${flagTags(flagsFor(c, { today, revisions }))}</span>` };
    case 'priority': return { render: c => priorityTag(c.priority) };
    case 'notes': return { render: c => `<span class="t-clip">${esc(c.notes)}</span>` };
    case 'summary': return { render: c => (c.summary ? 'Added' : '') };
    case 'revisions': return { cls: 'num', render: c => revisions.filter(r => r.contentId === c.id).length || '' };
    default: return { render: () => '' };
  }
}

// ---- One piece in the side panel -----------------------------------------------

function nextStage(status) {
  if (status === 'with_client') return 'approved';
  if (status === 'revisions') return 'qc';
  const list = stages();
  const next = list[stageIndex(status) + 1];
  return next && next.key !== 'revisions' ? next.key : null;
}

function openPiece(ctx, id) {
  const { store, lookup, today } = ctx;
  const piece = store.get('content', id);
  if (!piece) {
    toast(`${id} wasn’t found. It may have been deleted.`);
    history.replaceState(null, '', '#/content');
    return;
  }
  if (location.hash !== `#/content/${id}`) history.replaceState(null, '', `#/content/${id}`);

  const revisions = store.all('revisions').filter(r => r.contentId === id).sort((a, b) => a.round - b.round);
  const flags = flagsFor(piece, { today, revisions });
  const next = nextStage(piece.status);
  const people = (tab, keep = []) => store.all(tab)
    .filter(p => p.active !== false || keep.includes(p.id))
    .map(p => ({ value: p.id, label: p.active === false ? `${p.name} (no access)` : p.name }));
  const canEdit = ctx.can('edit-content');
  const dis = canEdit ? '' : 'disabled';
  const L = fieldLabel;

  const field = (key, control, { wide = false, hint = '' } = {}) => `
    <label class="field${wide ? ' field--wide' : ''}"><span class="field__label">${esc(L(key))}</span>${control}${hint ? `<span class="field__hint">${hint}</span>` : ''}</label>`;
  const input = (name, type = 'text', extra = '') => `<input type="${type}" name="${name}" value="${esc(piece[name] ?? '')}" ${extra} ${dis}>`;
  const select = (name, items, blank) => `<select name="${name}" ${dis}>${options(items, piece[name], { blank })}</select>`;

  const log = store.historyFor(id);
  const historyHtml = log.length ? log.map(h => `
    <li>
      <span class="log__when">${esc(formatStamp(h.at))}</span>
      <span class="log__what"><strong>${esc(lookup.person(h.by) || 'Someone')}</strong> ${esc(h.note || (h.action === 'updated' ? 'Edited' : h.action))}
        ${h.changes?.length ? `<span class="log__changes">${h.changes.flatMap(ch => describeChange(ch, lookup)).map(esc).join('<br>')}</span>` : ''}
      </span>
    </li>`).join('') : '<li class="empty-line">No changes yet.</li>';

  const revisionsHtml = revisions.length ? revisions.map(r => `
    <li class="rev">
      <p class="rev__head"><strong>Round ${r.round}</strong> sent ${esc(formatDate(r.dateSent))}, due ${esc(formatDate(r.dueDate))}
        ${r.dateReturned ? `, returned ${esc(formatDate(r.dateReturned))}` : '<span class="flag flag--risk">With writer</span>'}</p>
      <p class="rev__body">${esc(r.feedback)}</p>
    </li>`).join('') : '<li class="empty-line">No revision rounds.</li>';

  const extra = customFields();

  const body = `
    <div class="piece-top">
      <div class="stage-cell">${stageChip(piece.status)}${flagTags(flags)}${priorityTag(piece.priority)}</div>
      <p class="muted">${esc(lookup.name('clients', piece.clientId))}, written by ${esc(lookup.name('writers', piece.writerId))}
        ${ctx.can('see-cost') ? `<br>Cost ${esc(money(costOf(piece)))} (${words(piece.words)} words at ${esc(rateText(piece.rate))} per word)` : ''}</p>
    </div>

    ${canEdit ? `
    <section class="d-section" aria-labelledby="move-title">
      <h3 id="move-title">${esc(L('status'))}</h3>
      <div class="move">
        ${next ? `<button type="button" class="btn btn--primary" data-act="next" data-to="${next}">Move to ${esc(stageOf(next).label)}</button>` : ''}
        <form class="move__form" data-form="move">
          <label class="sr-only" for="move-to">Move to</label>
          <select id="move-to" name="to">${options(stages().map(s => ({ value: s.key, label: s.label })), piece.status)}</select>
          <button type="submit" class="btn">Move</button>
        </form>
        ${piece.status !== 'revisions' && !WRITING.includes(piece.status) ? '<button type="button" class="btn" data-act="show-revision">Send for revisions</button>' : ''}
      </div>
      <form class="rev-form" data-form="revision" hidden>
        <label class="field field--wide"><span class="field__label">What needs to change</span><textarea name="feedback" rows="3" required placeholder="Paste or summarise the client’s feedback"></textarea></label>
        <label class="field"><span class="field__label">Revision due</span><input type="date" name="dueDate" value="${esc(addWorkingDays(today, 2))}" required></label>
        <div class="form-actions">
          <button type="submit" class="btn btn--primary">Send for revisions</button>
          <button type="button" class="btn" data-act="hide-revision">Cancel</button>
        </div>
      </form>
    </section>` : ''}

    <section class="d-section" aria-labelledby="details-title">
      <h3 id="details-title">Details</h3>
      <form class="form-grid" data-form="details" novalidate>
        ${field('title', input('title', 'text', 'required'), { wide: true })}
        ${field('clientId', select('clientId', people('clients', [piece.clientId])))}
        ${field('writerId', select('writerId', people('writers', [piece.writerId])))}
        ${field('language', select('language', listValues('languages')))}
        ${field('type', select('type', listValues('types')))}
        ${field('words', input('words', 'number', 'min="0" step="50"'))}
        ${field('priority', select('priority', PRIORITIES))}
        ${field('dueDate', `
          <span class="due-row">${input('dueDate', 'date')}
            ${canEdit ? '<button type="button" class="btn btn--small" data-act="suggest">Suggest</button>' : ''}</span>
          <span class="check"><input type="checkbox" name="pinned" ${piece.pinned ? 'checked' : ''} ${dis}> Pin this date</span>`,
          { hint: 'A pinned date is never moved by a reshuffle.' })}
        ${field('neededBy', input('neededBy', 'date'))}
        ${field('amId', select('amId', people('ams', [piece.amId]), 'None'))}
        ${field('qcBy', select('qcBy', people('team', [piece.qcBy]), 'Not yet'))}
        ${field('bookedBy', select('bookedBy', people('team', [piece.bookedBy])))}
        ${field('dateBooked', `<input type="text" value="${esc(formatDate(piece.dateBooked))}" disabled>`)}
        ${field('dateReceived', input('dateReceived', 'date'))}
        ${field('dateApproved', input('dateApproved', 'date'), { hint: 'The date the client approved it.' })}
        ${field('briefLink', input('briefLink', 'url', 'placeholder="https://"'), { wide: true })}
        ${field('contentLink', input('contentLink', 'url', 'placeholder="https://"'), { wide: true })}
        ${field('clickupLink', input('clickupLink', 'url', 'placeholder="https://"'), { wide: true })}
        <span class="check field--wide"><input type="checkbox" name="summary" ${piece.summary ? 'checked' : ''} ${dis}> ${esc(L('summary'))}</span>
        ${field('notes', `<textarea name="notes" rows="3" ${dis}>${esc(piece.notes)}</textarea>`, { wide: true })}
        ${extra.length ? `<p class="form-group-title field--wide">More fields</p>${extra.map(f => customInput(f, piece.custom?.[f.id], { disabled: !canEdit })).join('')}` : ''}
        <p class="form-error field--wide" role="alert" hidden></p>
        <p class="suggest-note field--wide" aria-live="polite" hidden></p>
        ${canEdit ? `
        <div class="form-actions field--wide">
          <button type="submit" class="btn btn--primary">Save changes</button>
          <span class="links">${extLink(piece.briefLink, 'Open brief')}${extLink(piece.contentLink, 'Open content')}</span>
        </div>` : ''}
      </form>
    </section>

    <section class="d-section" aria-labelledby="rev-title">
      <h3 id="rev-title">${esc(L('revisions'))}</h3>
      <ul class="revs">${revisionsHtml}</ul>
    </section>

    <section class="d-section" aria-labelledby="log-title">
      <h3 id="log-title">History</h3>
      <ul class="log">${historyHtml}</ul>
    </section>

    ${ctx.can('delete-content') ? `
    <section class="d-section d-section--danger">
      <button type="button" class="btn btn--danger" data-act="delete">Delete ${esc(piece.id)}</button>
      <p class="field__hint">Only the admin can delete. This can’t be undone.</p>
    </section>` : ''}`;

  const panel = openDrawer({
    label: piece.id,
    title: piece.title,
    body,
    wide: true,
    onClose: () => history.replaceState(null, '', '#/content'),
  });
  bindPiece(ctx, panel, piece);
}

// One change, in plain words, for the history list.
function describeChange(ch, lookup) {
  if (ch.field === 'custom') {
    const before = ch.from || {}, after = ch.to || {};
    return [...new Set([...Object.keys(before), ...Object.keys(after)])]
      .filter(k => JSON.stringify(before[k] ?? '') !== JSON.stringify(after[k] ?? ''))
      .map(k => {
        const f = customField(k);
        return `${f?.label || k}: ${customText(f, before[k])} to ${customText(f, after[k])}`;
      });
  }
  const label = ch.field === 'pinned' ? 'Pinned date' : ch.field === 'rate' ? 'Rate' : fieldLabel(ch.field);
  return [`${label}: ${show(ch.field, ch.from, lookup)} to ${show(ch.field, ch.to, lookup)}`];
}

function show(field, value, lookup) {
  if (value === '' || value === null || value === undefined) return 'empty';
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  if (DATE_FIELDS.includes(field)) return formatDate(value);
  if (field === 'clientId') return lookup.name('clients', value) || value;
  if (field === 'writerId') return lookup.name('writers', value) || value;
  if (field === 'amId') return lookup.name('ams', value) || value;
  if (field === 'qcBy' || field === 'bookedBy') return lookup.person(value) || value;
  if (field === 'status') return stageOf(value).label;
  if (field === 'rate') return rateText(value);
  const s = String(value);
  return s.length > 60 ? `${s.slice(0, 57)}...` : s;
}

function bindPiece(ctx, panel, piece) {
  const { store, today, person } = ctx;
  const by = person.id;
  const details = panel.querySelector('[data-form="details"]');
  const revForm = panel.querySelector('[data-form="revision"]');
  const error = panel.querySelector('.form-error');

  const moveTo = async to => {
    if (to === piece.status) return;
    if (to === 'revisions') {
      revForm.hidden = false;
      revForm.querySelector('textarea').focus();
      return;
    }
    const patch = { id: piece.id, status: to };
    if (WRITING.includes(piece.status) && !WRITING.includes(to) && !piece.dateReceived) patch.dateReceived = today;
    if (to === 'approved' && !piece.dateApproved) patch.dateApproved = today;
    if (piece.status === 'revisions') {
      const open = openRevision(piece.id, store.all('revisions'));
      if (open) await store.save('revisions', { id: open.id, dateReturned: today }, { by, note: `Round ${open.round} returned` });
    }
    await store.save('content', patch, {
      by, action: 'stage', note: `Moved from ${stageOf(piece.status).label} to ${stageOf(to).label}`,
    });
    toast(`Moved ${piece.id} to ${stageOf(to).label}.`);
    ctx.refresh();
  };

  on(panel, 'click', '[data-act="next"]', (event, btn) => moveTo(btn.dataset.to));
  panel.querySelector('[data-form="move"]')?.addEventListener('submit', event => {
    event.preventDefault();
    moveTo(new FormData(event.target).get('to'));
  });
  on(panel, 'click', '[data-act="show-revision"]', () => {
    revForm.hidden = false;
    revForm.querySelector('textarea').focus();
  });
  on(panel, 'click', '[data-act="hide-revision"]', () => { revForm.hidden = true; });

  revForm?.addEventListener('submit', async event => {
    event.preventDefault();
    const { feedback, dueDate } = formData(revForm);
    if (!feedback || !dueDate) {
      toast('Add the feedback and a revision due date.');
      return;
    }
    const round = store.all('revisions').filter(r => r.contentId === piece.id).length + 1;
    await store.save('revisions', { contentId: piece.id, round, feedback, dateSent: today, dueDate, dateReturned: '' }, { by, note: `Round ${round} sent` });
    await store.save('content', { id: piece.id, status: 'revisions' }, { by, action: 'stage', note: `Sent for revisions (round ${round}), due ${formatDate(dueDate)}` });
    toast(`${piece.id} sent to the writer for revisions.`);
    ctx.refresh();
  });

  on(panel, 'click', '[data-act="suggest"]', () => {
    const d = formData(details);
    const writer = store.get('writers', d.writerId);
    const note = panel.querySelector('.suggest-note');
    const others = store.all('content').filter(c => c.writerId === d.writerId && WRITING.includes(c.status) && c.id !== piece.id);
    const result = suggestDueDate({
      writer,
      openPieces: others,
      newPiece: { id: piece.id, words: d.words, priority: d.priority, dateBooked: piece.dateBooked },
      timeOff: store.all('timeoff'),
      holidays: store.all('holidays'),
      today,
      startNextDay: piece.dateBooked >= today,
    });
    note.hidden = false;
    if (!result.due) {
      note.textContent = `${writer.name} has no free time in the next year. Check their daily word limits.`;
      return;
    }
    details.elements.dueDate.value = result.due;
    note.textContent = `Suggested ${formatDate(result.due)} from ${writer.name}’s free time. Save changes to keep it.`;
  });

  details?.addEventListener('submit', async event => {
    event.preventDefault();
    const d = formData(details);
    for (const k of Object.keys(d)) if (k.startsWith('custom__')) delete d[k];
    const custom = readCustom(details, piece.custom || {});
    const problems = [];
    if (!d.title) problems.push(`Add a ${fieldLabel('title').toLowerCase()}.`);
    if (d.words === '' || d.words < 0) problems.push(`${fieldLabel('words')} must be 0 or more.`);
    for (const k of ['briefLink', 'contentLink', 'clickupLink']) {
      if (d[k] && !safeUrl(d[k])) problems.push(`${fieldLabel(k)} must start with https://`);
    }
    problems.push(...customProblems(custom));
    if (problems.length) {
      error.textContent = problems.join(' ');
      error.hidden = false;
      return;
    }
    const patch = { id: piece.id, ...d, words: Number(d.words) || 0 };
    if (customFields().length || piece.custom) patch.custom = custom;
    if (d.writerId !== piece.writerId) patch.rate = store.get('writers', d.writerId).rate;
    await store.save('content', patch, { by });
    toast(`Saved ${piece.id}.`);
    ctx.refresh();
  });

  on(panel, 'click', '[data-act="delete"]', async () => {
    if (!confirm(`Delete ${piece.id} "${piece.title}"? This can't be undone.`)) return;
    await store.remove('content', piece.id, { by, note: `Deleted "${piece.title}"` });
    closeDrawer();
    toast(`Deleted ${piece.id}.`);
    ctx.refresh();
  });
}
