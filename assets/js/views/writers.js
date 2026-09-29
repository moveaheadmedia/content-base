// Writers: daily word limits, rates and languages. Only the admin can change them.

import { CONFIG, WEEKDAYS, WRITER_TYPES } from '../config.js';
import { listValues } from '../settings.js';
import { esc, formData, on, openDrawer, options, rateText, toast, words, WRITING } from '../ui.js';

export function renderWriters(ctx) {
  const { el, store } = ctx;
  const canManage = ctx.can('manage-writers');
  const writers = store.all('writers').sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name));
  const clients = store.all('clients');
  const content = store.all('content');

  ctx.setHeader({
    title: 'Writers',
    subtitle: canManage ? 'Daily word limits, rates and languages.' : 'Only the admin can change writers and rates.',
    actions: canManage ? '<button type="button" class="btn btn--primary" id="add-writer">Add writer</button>' : '',
  });

  const rows = writers.map(w => {
    const theirs = clients.filter(c => c.usualWriterId === w.id).map(c => c.name);
    const open = content.filter(c => c.writerId === w.id && WRITING.includes(c.status)).length;
    const week = WEEKDAYS.reduce((sum, d) => sum + (Number(w.capacity[d.key]) || 0), 0);
    return `
      <tr data-id="${esc(w.id)}" tabindex="0"${w.active ? '' : ' class="is-inactive"'}>
        <td class="cell-title" data-label="Writer"><span class="t-title">${esc(w.name)}${w.active ? '' : ' <span class="muted">(inactive)</span>'}</span><span class="t-sub">${esc(w.email)}</span></td>
        <td data-label="Type">${esc(w.type)}</td>
        <td data-label="Languages">${esc(w.languages.join(', '))}</td>
        <td class="num" data-label="Rate">${esc(rateText(w.rate))}</td>
        ${WEEKDAYS.map(d => `<td class="num" data-label="${d.label}">${words(w.capacity[d.key])}</td>`).join('')}
        <td class="num" data-label="Week">${words(week)}</td>
        <td class="t-wrap" data-label="Usual writer for">${theirs.length ? esc(theirs.join(', ')) : '<span class="muted">None yet</span>'}</td>
        <td class="num" data-label="Being written"><a href="#/content?writer=${esc(w.id)}">${open}</a></td>
      </tr>`;
  }).join('');

  el.innerHTML = `
    <section class="panel table-panel">
      <div class="table-scroll">
        <table class="table table--compact">
          <thead><tr>
            <th scope="col">Writer</th><th scope="col">Type</th><th scope="col">Languages</th><th scope="col" class="num">Rate</th>
            ${WEEKDAYS.map(d => `<th scope="col" class="num">${d.label}</th>`).join('')}
            <th scope="col" class="num">Week</th><th scope="col">Usual writer for</th><th scope="col" class="num">Being written</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <p class="table-note">Rates are USD per word. Daily limits are in words. Due dates skip weekends, holidays and time off.</p>
    </section>`;

  on(el, 'click', 'tr[data-id]', (event, row) => openWriter(ctx, row.dataset.id));
  on(el, 'keydown', 'tr[data-id]', (event, row) => { if (event.key === 'Enter') openWriter(ctx, row.dataset.id); });
  document.getElementById('add-writer')?.addEventListener('click', () => openWriter(ctx, null));
}

// The add/edit panel for one writer. Also used by Settings > People.
export function openWriter(ctx, id) {
  const { store, person } = ctx;
  const canManage = ctx.can('manage-writers');
  const w = id ? store.get('writers', id) : {
    name: '', email: '', type: 'External', rate: CONFIG.defaultRate, languages: ['English'],
    capacity: { mon: 0, tue: 0, wed: 0, thu: 0, fri: 0 }, active: true, notes: '',
  };
  const dis = canManage ? '' : 'disabled';
  const field = (label, control, { wide = false, hint = '' } = {}) => `
    <label class="field${wide ? ' field--wide' : ''}"><span class="field__label">${esc(label)}</span>${control}${hint ? `<span class="field__hint">${esc(hint)}</span>` : ''}</label>`;

  const body = `
    ${canManage ? '' : '<p class="note">Only the admin can change writers and rates.</p>'}
    <form class="form-grid" novalidate>
      ${field('Name', `<input type="text" name="name" value="${esc(w.name)}" required ${dis}>`)}
      ${field('Email', `<input type="email" name="email" value="${esc(w.email)}" required ${dis}>`, { hint: 'The email they sign in with.' })}
      ${field('Type', `<select name="type" ${dis}>${options(WRITER_TYPES, w.type)}</select>`)}
      ${field('Rate per word (USD)', `<input type="number" name="rate" value="${esc(w.rate)}" min="0" step="0.005" ${dis}>`, { hint: 'New bookings use this rate. Existing pieces keep theirs.' })}
      <fieldset class="field--wide">
        <legend class="field__label">Languages</legend>
        <div class="checks">${[...new Set([...listValues('languages').filter(l => l !== 'Pending'), ...w.languages])].map(l => `
          <span class="check"><input type="checkbox" name="languages" value="${esc(l)}" data-group ${w.languages.includes(l) ? 'checked' : ''} ${dis}> ${esc(l)}</span>`).join('')}
        </div>
      </fieldset>
      <fieldset class="field--wide">
        <legend class="field__label">Daily word limit</legend>
        <div class="limits">${WEEKDAYS.map(d => `
          <label class="field"><span class="field__hint">${d.label}</span>
            <input type="number" name="cap_${d.key}" value="${esc(w.capacity[d.key] ?? 0)}" min="0" step="100" inputmode="numeric" ${dis}>
          </label>`).join('')}
        </div>
        <span class="field__hint">Use 0 for days they don’t write. Weekends are always off.</span>
      </fieldset>
      <span class="check field--wide"><input type="checkbox" name="active" ${w.active ? 'checked' : ''} ${dis}> Active (can sign in and take new work)</span>
      ${field('Notes', `<textarea name="notes" rows="2" ${dis}>${esc(w.notes)}</textarea>`, { wide: true })}
      <p class="form-error field--wide" role="alert" hidden></p>
      ${canManage ? `<div class="form-actions field--wide"><button type="submit" class="btn btn--primary">${id ? 'Save changes' : 'Add writer'}</button></div>` : ''}
    </form>`;

  const panel = openDrawer({ label: id || 'New writer', title: id ? w.name : 'Add a writer', body });
  const form = panel.querySelector('form');
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const d = formData(form);
    const problems = [];
    if (!d.name) problems.push('Add a name.');
    if (!/^\S+@\S+\.\S+$/.test(d.email)) problems.push('Add a valid email.');
    if (d.rate === '' || d.rate < 0) problems.push('Rate must be 0 or more.');
    if (!d.languages.length) problems.push('Choose at least one language.');
    const taken = store.all('writers').concat(store.all('team')).some(p => p.email.toLowerCase() === d.email.toLowerCase() && p.id !== id);
    if (taken) problems.push('Someone already uses that email.');
    if (problems.length) {
      const error = form.querySelector('.form-error');
      error.textContent = problems.join(' ');
      error.hidden = false;
      return;
    }
    const capacity = Object.fromEntries(Object.entries(d).filter(([k]) => k.startsWith('cap_')).map(([k, v]) => [k.slice(4), Math.max(0, Number(v) || 0)]));
    const saved = await store.save('writers', {
      ...(id ? { id } : {}),
      name: d.name, email: d.email, type: d.type, rate: Number(d.rate), languages: d.languages,
      capacity, active: d.active, notes: d.notes,
    }, { by: person.id, note: id ? '' : 'Writer added' });
    toast(id ? `Saved ${saved.name}.` : `Added ${saved.name}.`);
    ctx.refresh();
  });
}
