// Time off & holidays. Writers tell the content team; the team adds it here.
// Due dates skip these days.

import { listValues } from '../settings.js';
import { addDays, addMonths, formatDate, isWeekend, monthKey, monthLabel, startOfWeek } from '../dates.js';
import { esc, formData, on, options, toast, WRITING } from '../ui.js';

let month = '';
let notice = '';

export function renderTimeOff(ctx) {
  const { el, store, today, lookup, person } = ctx;
  if (!month) month = monthKey(today);
  const canManage = ctx.can('manage-timeoff');
  const timeOff = store.all('timeoff').sort((a, b) => (a.from < b.from ? 1 : -1));
  const holidays = store.all('holidays').sort((a, b) => (a.date < b.date ? -1 : 1));
  const writers = store.all('writers').filter(w => w.active);

  ctx.setHeader({
    title: 'Time off & holidays',
    subtitle: 'Writers tell the content team about time off, and the team adds it here. Due dates skip these days.',
  });

  // ---- Month calendar -------------------------------------------------------
  const gridStart = startOfWeek(`${month}-01`);
  const gridEnd = addDays(startOfWeek(addDays(`${addMonths(month, 1)}-01`, -1)), 6);
  const cells = [];
  for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) {
    const hol = holidays.filter(h => h.date === d);
    const off = timeOff.filter(t => d >= t.from && d <= t.to);
    const classes = ['cal__day', monthKey(d) !== month && 'is-outside', isWeekend(d) && 'is-weekend', d === today && 'is-today'].filter(Boolean).join(' ');
    cells.push(`
      <div class="${classes}" role="gridcell" aria-label="${esc(formatDate(d))}">
        <span class="cal__num">${Number(d.slice(8))}</span>
        ${hol.map(h => `<span class="cal__chip cal__chip--holiday">${esc(h.name)}</span>`).join('')}
        ${off.map(t => `<span class="cal__chip cal__chip--${['leave', 'sick'].includes(t.reason.toLowerCase()) ? t.reason.toLowerCase() : 'other'}">${esc(lookup.name('writers', t.writerId).split(' ')[0])}, ${esc(t.reason.toLowerCase())}</span>`).join('')}
      </div>`);
  }
  const rowsOfSeven = [];
  for (let i = 0; i < cells.length; i += 7) rowsOfSeven.push(`<div class="cal__week" role="row">${cells.slice(i, i + 7).join('')}</div>`);

  // ---- Lists ------------------------------------------------------------------
  const offRows = timeOff.length ? timeOff.map(t => `
    <li class="${t.to < today ? 'is-past' : ''}">
      <span class="list-row__main">
        <strong>${esc(lookup.name('writers', t.writerId))}</strong>
        <span>${esc(t.reason)}: ${esc(formatDate(t.from))}${t.to !== t.from ? ` to ${esc(formatDate(t.to))}` : ''}${t.note ? `. ${esc(t.note)}` : ''}</span>
      </span>
      ${canManage ? `<button type="button" class="btn btn--small" data-remove="timeoff" data-id="${esc(t.id)}">Remove</button>` : ''}
    </li>`).join('') : '<li class="empty-line">No time off added.</li>';

  const holRows = holidays.length ? holidays.map(h => `
    <li class="${h.date < today ? 'is-past' : ''}">
      <span class="list-row__main"><strong>${esc(formatDate(h.date))}</strong><span>${esc(h.name)}</span></span>
      ${canManage ? `<button type="button" class="btn btn--small" data-remove="holidays" data-id="${esc(h.id)}">Remove</button>` : ''}
    </li>`).join('') : '<li class="empty-line">No holidays added.</li>';

  el.innerHTML = `
    ${notice ? `<div class="note note--page" role="status">${notice}</div>` : ''}
    <div class="timeoff">
      <section class="panel cal-panel" aria-labelledby="cal-title">
        <div class="panel__head">
          <h2 id="cal-title">${esc(monthLabel(month))}</h2>
          <div class="seg" role="group" aria-label="Change month">
            <button type="button" data-month="-1" aria-label="Previous month">Previous</button>
            <button type="button" data-month="0">This month</button>
            <button type="button" data-month="1" aria-label="Next month">Next</button>
          </div>
        </div>
        <div class="cal" role="grid" aria-labelledby="cal-title">
          <div class="cal__week cal__week--head" role="row">${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => `<div role="columnheader">${d}</div>`).join('')}</div>
          ${rowsOfSeven.join('')}
        </div>
      </section>

      <div class="timeoff__side">
        <section class="panel" aria-labelledby="off-title">
          <div class="panel__head"><h2 id="off-title">Writer time off</h2></div>
          ${canManage ? `
          <form class="form-grid form-grid--tight" data-form="timeoff" novalidate>
            <label class="field field--wide"><span class="field__label">Writer</span><select name="writerId" required>${options(writers.map(w => ({ value: w.id, label: w.name })), '', { blank: 'Choose a writer' })}</select></label>
            <label class="field"><span class="field__label">From</span><input type="date" name="from" value="${esc(today)}" required></label>
            <label class="field"><span class="field__label">To</span><input type="date" name="to" value="${esc(today)}" required></label>
            <label class="field"><span class="field__label">Reason</span><select name="reason">${options(listValues('timeOffReasons'), listValues('timeOffReasons')[0])}</select></label>
            <label class="field"><span class="field__label">Note</span><input type="text" name="note" placeholder="Optional"></label>
            <p class="form-error field--wide" role="alert" hidden></p>
            <div class="form-actions field--wide"><button type="submit" class="btn btn--primary">Add time off</button></div>
          </form>` : ''}
          <ul class="list-rows">${offRows}</ul>
        </section>

        <section class="panel" aria-labelledby="hol-title">
          <div class="panel__head"><h2 id="hol-title">Public holidays</h2></div>
          <p class="panel__text">Added by hand. Nobody gets work planned on these days.</p>
          ${canManage ? `
          <form class="form-grid form-grid--tight" data-form="holiday" novalidate>
            <label class="field"><span class="field__label">Date</span><input type="date" name="date" required></label>
            <label class="field"><span class="field__label">Name</span><input type="text" name="name" required placeholder="e.g. New Year’s Day"></label>
            <p class="form-error field--wide" role="alert" hidden></p>
            <div class="form-actions field--wide"><button type="submit" class="btn btn--primary">Add holiday</button></div>
          </form>` : ''}
          <ul class="list-rows">${holRows}</ul>
        </section>
      </div>
    </div>`;
  notice = '';

  on(el, 'click', '[data-month]', (event, btn) => {
    const n = Number(btn.dataset.month);
    month = n === 0 ? monthKey(today) : addMonths(month, n);
    ctx.refresh();
  });

  const fail = (form, text) => {
    const error = form.querySelector('.form-error');
    error.textContent = text;
    error.hidden = false;
  };

  el.querySelector('[data-form="timeoff"]')?.addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.target;
    const d = formData(form);
    if (!d.writerId) return fail(form, 'Choose a writer.');
    if (!d.from || !d.to) return fail(form, 'Add both dates.');
    if (d.to < d.from) return fail(form, 'The end date is before the start date.');
    await store.save('timeoff', d, { by: person.id, note: `${d.reason} added` });

    const name = lookup.name('writers', d.writerId);
    const affected = store.all('content').filter(c => c.writerId === d.writerId && WRITING.includes(c.status) && c.dueDate >= d.from);
    notice = affected.length
      ? `Added ${esc(name)}’s time off. ${affected.length} of their pieces ${affected.length === 1 ? 'is' : 'are'} due on or after ${esc(formatDate(d.from))} and may need a new date:
         <a href="#/content?writer=${esc(d.writerId)}">see ${esc(name)}’s pieces</a>. Automatic reshuffling comes in round 3.`
      : `Added ${esc(name)}’s time off. None of their pieces are affected.`;
    month = monthKey(d.from);
    ctx.refresh();
  });

  el.querySelector('[data-form="holiday"]')?.addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.target;
    const d = formData(form);
    if (!d.date || !d.name) return fail(form, 'Add the date and a name.');
    if (holidays.some(h => h.date === d.date)) return fail(form, 'There’s already a holiday on that date.');
    await store.save('holidays', d, { by: person.id, note: 'Holiday added' });
    toast(`Added ${d.name} on ${formatDate(d.date)}.`);
    month = monthKey(d.date);
    ctx.refresh();
  });

  on(el, 'click', '[data-remove]', async (event, btn) => {
    const tab = btn.dataset.remove;
    if (!confirm(tab === 'holidays' ? 'Remove this holiday?' : 'Remove this time off?')) return;
    await store.remove(tab, btn.dataset.id, { by: person.id });
    toast('Removed.');
    ctx.refresh();
  });
}
