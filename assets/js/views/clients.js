// Clients: language, AM, and which writer usually covers them.

import { listValues } from '../settings.js';
import { esc, extLink, FINISHED, formData, on, openDrawer, options, safeUrl, toast } from '../ui.js';

export function renderClients(ctx) {
  const { el, store, lookup } = ctx;
  const canManage = ctx.can('manage-clients');
  const clients = store.all('clients').sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name));
  const content = store.all('content');

  ctx.setHeader({
    title: 'Clients',
    subtitle: 'Each client’s language, AM and writers.',
    actions: canManage ? '<button type="button" class="btn btn--primary" id="add-client">Add client</button>' : '',
  });

  const rows = clients.map(c => {
    const open = content.filter(p => p.clientId === c.id && !FINISHED.includes(p.status)).length;
    const site = safeUrl(c.website);
    return `
      <tr data-id="${esc(c.id)}" tabindex="0"${c.active ? '' : ' class="is-inactive"'}>
        <td class="cell-title" data-label="Client"><span class="t-title">${esc(c.name)}</span>${site ? `<span class="t-sub">${extLink(site, site.replace(/^https?:\/\//, ''))}</span>` : ''}</td>
        <td data-label="Language">${esc(c.language)}</td>
        <td data-label="AM">${esc(lookup.name('ams', c.amId)) || '<span class="muted">None</span>'}</td>
        <td data-label="Usual writer">${esc(lookup.name('writers', c.usualWriterId)) || '<span class="muted">None</span>'}</td>
        <td data-label="Backup writer">${esc(lookup.name('writers', c.backupWriterId)) || '<span class="muted">None</span>'}</td>
        <td class="num" data-label="Open pieces"><a href="#/content?client=${esc(c.id)}">${open}</a></td>
      </tr>`;
  }).join('');

  el.innerHTML = `
    <section class="panel table-panel">
      <div class="table-scroll">
        <table class="table table--compact">
          <thead><tr>
            <th scope="col">Client</th><th scope="col">Language</th><th scope="col">AM</th>
            <th scope="col">Usual writer</th><th scope="col">Backup writer</th><th scope="col" class="num">Open pieces</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <p class="table-note">Booking fills in the usual writer, AM and language. The backup writer is suggested when a date would be too late.</p>
    </section>`;

  on(el, 'click', 'tr[data-id]', (event, row) => {
    if (event.target.closest('a')) return;
    openClient(ctx, row.dataset.id);
  });
  on(el, 'keydown', 'tr[data-id]', (event, row) => { if (event.key === 'Enter') openClient(ctx, row.dataset.id); });
  document.getElementById('add-client')?.addEventListener('click', () => openClient(ctx, null));
}

function openClient(ctx, id) {
  const { store, person } = ctx;
  const canManage = ctx.can('manage-clients');
  const c = id ? store.get('clients', id) : { name: '', website: '', language: 'English', amId: '', usualWriterId: '', backupWriterId: '', active: true };
  const writers = store.all('writers').filter(w => w.active || w.id === c.usualWriterId || w.id === c.backupWriterId).map(w => ({ value: w.id, label: w.name }));
  const ams = store.all('ams').map(a => ({ value: a.id, label: a.name }));
  const dis = canManage ? '' : 'disabled';
  const field = (label, control, { wide = false, hint = '' } = {}) => `
    <label class="field${wide ? ' field--wide' : ''}"><span class="field__label">${esc(label)}</span>${control}${hint ? `<span class="field__hint">${esc(hint)}</span>` : ''}</label>`;

  const body = `
    <form class="form-grid" novalidate>
      ${field('Client name', `<input type="text" name="name" value="${esc(c.name)}" required ${dis}>`, { wide: true })}
      ${field('Website', `<input type="url" name="website" value="${esc(c.website)}" placeholder="https://" ${dis}>`, { wide: true })}
      ${field('Language', `<select name="language" ${dis}>${options(listValues('languages'), c.language)}</select>`)}
      ${field('AM', `<select name="amId" ${dis}>${options(ams, c.amId, { blank: 'None' })}</select>`)}
      ${field('Usual writer', `<select name="usualWriterId" ${dis}>${options(writers, c.usualWriterId, { blank: 'None yet' })}</select>`, { hint: 'Keeps the client’s tone of voice consistent.' })}
      ${field('Backup writer', `<select name="backupWriterId" ${dis}>${options(writers, c.backupWriterId, { blank: 'None' })}</select>`, { hint: 'Suggested when the usual writer is too busy or away.' })}
      <span class="check field--wide"><input type="checkbox" name="active" ${c.active ? 'checked' : ''} ${dis}> Active client</span>
      <p class="form-error field--wide" role="alert" hidden></p>
      ${canManage ? `<div class="form-actions field--wide"><button type="submit" class="btn btn--primary">${id ? 'Save changes' : 'Add client'}</button></div>` : ''}
    </form>`;

  const panel = openDrawer({ label: id || 'New client', title: id ? c.name : 'Add a client', body });
  const form = panel.querySelector('form');
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const d = formData(form);
    const problems = [];
    if (!d.name) problems.push('Add the client’s name.');
    if (d.website && !safeUrl(d.website)) problems.push('Website must start with https://');
    if (d.backupWriterId && d.backupWriterId === d.usualWriterId) problems.push('The backup writer should be someone other than the usual writer.');
    if (problems.length) {
      const error = form.querySelector('.form-error');
      error.textContent = problems.join(' ');
      error.hidden = false;
      return;
    }
    const saved = await store.save('clients', { ...(id ? { id } : {}), ...d }, { by: person.id, note: id ? '' : 'Client added' });
    toast(id ? `Saved ${saved.name}.` : `Added ${saved.name}.`);
    ctx.refresh();
  });
}
