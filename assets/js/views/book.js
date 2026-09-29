// Book content: a form for a new piece, with a live due-date suggestion.

import { CONFIG, PRIORITIES } from '../config.js';
import { formatDate, formatDay, relativeDay } from '../dates.js';
import { suggestDueDate } from '../schedule.js';
import { customFields, fieldLabel as L, listValues } from '../settings.js';
import { customInput, customProblems, readCustom } from '../custom-fields.js';
import { esc, formData, money, on, options, rateText, safeUrl, toast, words, WRITING } from '../ui.js';

export function renderBook(ctx) {
  const { el, store, today, person } = ctx;
  const people = (tab, filter = () => true) => store.all(tab).filter(filter).map(p => ({ value: p.id, label: p.name }));
  const clients = store.all('clients').filter(c => c.active);
  const writers = store.all('writers').filter(w => w.active);

  ctx.setHeader({ title: 'Book content', subtitle: 'Add a new piece and give the writer a realistic due date.' });

  const languages = listValues('languages');
  const types = listValues('types');
  const firstOr = (list, preferred) => (list.includes(preferred) ? preferred : list[0]);
  const bookingExtras = customFields().filter(f => f.showOnBooking);

  const field = (label, control, { wide = false, hint = '', required = false } = {}) => `
    <label class="field${wide ? ' field--wide' : ''}">
      <span class="field__label">${esc(label)}${required ? ' <span class="req" aria-hidden="true">*</span>' : ''}</span>
      ${control}
      ${hint ? `<span class="field__hint">${esc(hint)}</span>` : ''}
    </label>`;

  el.innerHTML = `
    <div class="book">
      <form class="panel book__form form-grid" novalidate>
        <h2 class="field--wide">What and who</h2>
        ${field(L('clientId'), `<select name="clientId" required>${options(clients.map(c => ({ value: c.id, label: c.name })), '', { blank: 'Choose one' })}</select>`, { required: true })}
        ${field(L('writerId'), `<select name="writerId" required>${options(writers.map(w => ({ value: w.id, label: w.name })), '', { blank: 'Choose one' })}</select>`, { required: true, hint: 'Filled in with the client’s usual writer.' })}
        ${field(L('title'), '<input type="text" name="title" required placeholder="For OPC, the page addresses">', { wide: true, required: true })}
        ${field(L('language'), `<select name="language">${options(languages, firstOr(languages, 'English'))}</select>`)}
        ${field(L('type'), `<select name="type">${options(types, firstOr(types, 'Blog'))}</select>`)}
        ${field(L('words'), '<input type="number" name="words" min="1" step="50" required inputmode="numeric">', { required: true })}
        ${field(L('amId'), `<select name="amId">${options(people('ams'), '', { blank: 'None' })}</select>`)}

        <h2 class="field--wide">Dates and priority</h2>
        ${field(L('priority'), `<select name="priority">${options(PRIORITIES, 'Normal')}</select>`, { hint: 'Urgent work is planned first.' })}
        ${field(L('neededBy'), '<input type="date" name="neededBy">', { hint: 'When the AM or client really needs it.' })}
        ${field(L('dueDate'), '<input type="date" name="dueDate" required>', { required: true, hint: 'Filled in from the suggestion; you can change it.' })}
        <span class="check field--pad"><input type="checkbox" name="pinned"> Pin this date so reshuffles never move it</span>

        <h2 class="field--wide">Links and notes</h2>
        ${field(L('briefLink'), '<input type="url" name="briefLink" placeholder="https://">', { wide: true })}
        ${field(L('clickupLink'), '<input type="url" name="clickupLink" placeholder="https://">', { wide: true })}
        ${field(L('bookedBy'), `<select name="bookedBy">${options(people('team', p => p.active), person.id)}</select>`)}
        ${field(L('notes'), '<textarea name="notes" rows="3"></textarea>', { wide: true })}
        ${bookingExtras.length ? `<h2 class="field--wide">More fields</h2>${bookingExtras.map(f => customInput(f, '')).join('')}` : ''}

        <p class="form-error field--wide" role="alert" hidden></p>
        <div class="form-actions field--wide">
          <button type="submit" class="btn btn--primary">Book content</button>
          <a class="btn" href="#/content">Cancel</a>
        </div>
      </form>

      <aside class="panel book__plan" aria-labelledby="plan-title">
        <h2 id="plan-title">Suggested due date</h2>
        <div class="plan" aria-live="polite"></div>
      </aside>
    </div>`;

  const form = el.querySelector('form');
  const planBox = el.querySelector('.plan');
  const error = form.querySelector('.form-error');
  let dueTouched = false;

  const suggestFor = (writerId, d) => {
    const writer = store.get('writers', writerId);
    const open = store.all('content').filter(c => c.writerId === writerId && WRITING.includes(c.status));
    return {
      writer,
      open,
      result: suggestDueDate({
        writer,
        openPieces: open,
        newPiece: { words: d.words, priority: d.priority, dateBooked: today },
        timeOff: store.all('timeoff'),
        holidays: store.all('holidays'),
        today,
        startNextDay: CONFIG.newWorkStartsNextWorkingDay,
      }),
    };
  };

  const update = () => {
    const d = formData(form);
    if (!d.writerId || !(d.words > 0)) {
      planBox.innerHTML = '<p class="muted">Choose a client, a writer and the target words to see when it can be done.</p>';
      return;
    }
    const { writer, open, result } = suggestFor(d.writerId, d);
    if (!dueTouched && result.due) form.elements.dueDate.value = result.due;

    if (!result.due) {
      planBox.innerHTML = `<p class="warn">${esc(writer.name)} has no free time in the next year. Check their daily word limits on the Writers page.</p>`;
      return;
    }

    const cost = (Number(d.words) || 0) * writer.rate;
    const spread = result.days.map(x => `<tr><td>${esc(formatDay(x.date))}</td><td class="num">${words(x.words)} words</td></tr>`).join('');
    let warnings = '';

    if (d.neededBy && result.due > d.neededBy) {
      const client = store.get('clients', d.clientId);
      const backupId = client?.backupWriterId;
      let backup = '';
      if (backupId && backupId !== d.writerId) {
        const b = suggestFor(backupId, d);
        if (b.result.due) {
          backup = `<p>${esc(b.writer.name)} (backup writer) could deliver by <strong>${esc(formatDate(b.result.due))}</strong>.</p>
            <button type="button" class="btn btn--small" data-act="use-backup" data-id="${esc(backupId)}">Use ${esc(b.writer.name)}</button>`;
        }
      }
      warnings += `<div class="warn"><p>This is after the needed-by date, ${esc(formatDate(d.neededBy))}.</p>${backup}</div>`;
    }

    if (result.moved.length) {
      const titles = Object.fromEntries(open.map(c => [c.id, c.title]));
      warnings += `
        <div class="note">
          <p>Booking this as ${esc(d.priority)} moves ${result.moved.length} of ${esc(writer.name)}’s pieces later:</p>
          <ul>${result.moved.map(m => `<li><strong>${esc(m.id)}</strong> ${esc(titles[m.id])}: ${esc(formatDay(m.from))} to ${esc(formatDay(m.to))}</li>`).join('')}</ul>
          <p class="field__hint">Their saved due dates won’t change by themselves yet. Automatic reshuffling comes in round 3.</p>
        </div>`;
    }

    const chosen = form.elements.dueDate.value;
    planBox.innerHTML = `
      <p class="plan__date">${esc(formatDay(result.due))}<span>/${esc(result.due.slice(0, 4))}</span></p>
      <p class="plan__rel">${esc(relativeDay(result.due, today))}, with ${esc(writer.name)}</p>
      ${chosen && chosen !== result.due ? `<p class="note">You chose ${esc(formatDate(chosen))}. <button type="button" class="linkish" data-act="use-suggested">Use the suggestion</button></p>` : ''}
      <table class="spread"><caption>How it fits into ${esc(writer.name)}’s days</caption><tbody>${spread}</tbody></table>
      <p class="plan__cost">Cost ${esc(money(cost))} <span>(${words(d.words)} words at ${esc(rateText(writer.rate))})</span></p>
      ${warnings}`;
  };

  form.addEventListener('change', event => {
    const t = event.target;
    if (t.name === 'clientId') {
      const client = store.get('clients', t.value);
      if (client) {
        if (client.usualWriterId) form.elements.writerId.value = client.usualWriterId;
        form.elements.amId.value = client.amId || '';
        if (client.language) form.elements.language.value = client.language;
      }
    }
    if (t.name === 'dueDate') dueTouched = Boolean(t.value);
    update();
  });
  form.addEventListener('input', event => {
    if (event.target.name === 'words') update();
  });

  on(planBox, 'click', '[data-act="use-backup"]', (event, btn) => {
    form.elements.writerId.value = btn.dataset.id;
    dueTouched = false;
    update();
  });
  on(planBox, 'click', '[data-act="use-suggested"]', () => {
    dueTouched = false;
    update();
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const d = formData(form);
    const custom = readCustom(form, {});
    const problems = [];
    if (!d.clientId) problems.push(`Choose the ${L('clientId').toLowerCase()}.`);
    if (!d.writerId) problems.push(`Choose the ${L('writerId').toLowerCase()}.`);
    if (!d.title) problems.push(`Add the ${L('title').toLowerCase()}.`);
    if (!(d.words > 0)) problems.push(`Add the ${L('words').toLowerCase()}.`);
    if (!d.dueDate) problems.push(`Add the ${L('dueDate').toLowerCase()}.`);
    for (const k of ['briefLink', 'clickupLink']) {
      if (d[k] && !safeUrl(d[k])) problems.push(`${L(k)} must start with https://`);
    }
    problems.push(...customProblems(custom));
    form.querySelectorAll('[aria-invalid]').forEach(x => x.removeAttribute('aria-invalid'));
    if (problems.length) {
      error.textContent = problems.join(' ');
      error.hidden = false;
      const first = [['clientId', !d.clientId], ['writerId', !d.writerId], ['title', !d.title], ['words', !(d.words > 0)], ['dueDate', !d.dueDate]]
        .filter(([, bad]) => bad).map(([n]) => form.elements[n]);
      first.forEach(x => x.setAttribute('aria-invalid', 'true'));
      (first[0] || error).focus();
      return;
    }

    const writer = store.get('writers', d.writerId);
    const saved = await store.save('content', {
      dateBooked: today,
      bookedBy: d.bookedBy,
      writerId: d.writerId,
      clientId: d.clientId,
      title: d.title,
      language: d.language,
      type: d.type,
      briefLink: d.briefLink,
      words: Number(d.words),
      rate: writer.rate,
      dueDate: d.dueDate,
      pinned: d.pinned,
      dateReceived: '',
      contentLink: '',
      status: 'booked',
      dateApproved: '',
      notes: d.notes,
      amId: d.amId,
      neededBy: d.neededBy,
      priority: d.priority,
      qcBy: '',
      summary: false,
      clickupLink: d.clickupLink,
      ...(customFields().length ? { custom } : {}),
    }, { by: person.id, note: 'Booked' });

    toast(`Booked ${saved.id} for ${writer.name}, due ${formatDate(saved.dueDate)}.`);
    ctx.go(`#/content/${saved.id}`);
  });

  update();
}
