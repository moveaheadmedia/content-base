// Settings (admin only): people and access, dropdown lists, field names and columns,
// extra fields, stage names, and the tool's name.

import { PRIORITIES, ROLE_LABELS, STAGES } from '../config.js';
import {
  allFields, columnsFor, CUSTOM_TYPES, customFields, defaultSettings, FIELDS, LISTS, nextCustomId, SETTINGS_ID, settings,
} from '../settings.js';
import { esc, formData, on, openDrawer, options, toast } from '../ui.js';
import { openWriter } from './writers.js';

const SECTIONS = [
  { key: 'people', label: 'People' },
  { key: 'lists', label: 'Lists' },
  { key: 'fields', label: 'Fields & columns' },
  { key: 'stages', label: 'Stages' },
  { key: 'general', label: 'General' },
];

let section = 'people';

// Saves the whole settings object: the defaults with the admin's changes on top.
async function saveSettings(ctx, patch, note) {
  await ctx.store.save('settings', { ...settings(), ...patch, id: SETTINGS_ID }, { by: ctx.person.id, note });
}

const field = (label, control, { wide = false, hint = '' } = {}) => `
  <label class="field${wide ? ' field--wide' : ''}"><span class="field__label">${esc(label)}</span>${control}${hint ? `<span class="field__hint">${esc(hint)}</span>` : ''}</label>`;

export function renderSettings(ctx) {
  const { el } = ctx;
  ctx.setHeader({
    title: 'Settings',
    subtitle: 'Only the admin sees this page. Changes apply to everyone straight away.',
  });

  const draw = {
    people: peopleSection, lists: listsSection, fields: fieldsSection, stages: stagesSection, general: generalSection,
  }[section];

  el.innerHTML = `
    <nav class="tabs" aria-label="Settings sections">
      ${SECTIONS.map(s => `<button type="button" class="tabs__btn" data-section="${s.key}" aria-pressed="${s.key === section}">${esc(s.label)}</button>`).join('')}
    </nav>
    <div class="settings">${draw(ctx)}</div>`;

  on(el, 'click', '[data-section]', (event, btn) => {
    section = btn.dataset.section;
    ctx.refresh();
  });

  ({ people: bindPeople, lists: bindLists, fields: bindFields, stages: bindStages, general: bindGeneral })[section](ctx);
}

// ---- People ------------------------------------------------------------------

function peopleSection(ctx) {
  const { store, person } = ctx;
  const team = store.all('team');
  const writers = store.all('writers');
  const ams = store.all('ams');
  const content = store.all('content');
  const clients = store.all('clients');

  const access = p => (p.active === false ? '<span class="tag tag--off">No access</span>' : '<span class="tag tag--on">Can sign in</span>');
  const teamUsed = id => content.some(c => c.bookedBy === id || c.qcBy === id);
  const writerUsed = id => content.some(c => c.writerId === id) || clients.some(c => c.usualWriterId === id || c.backupWriterId === id)
    || store.all('timeoff').some(t => t.writerId === id);

  return `
    <p class="settings__intro">Removing someone’s access keeps their past work and history. They can’t sign in, and they no longer appear when booking new work. You can give access back at any time.</p>

    <section class="panel">
      <div class="panel__head">
        <div><h2>Content team</h2><p>Staff who sign in to book and manage content.</p></div>
        <button type="button" class="btn btn--primary" data-act="add-team">Add team member</button>
      </div>
      <div class="table-scroll"><table class="table">
        <thead><tr><th scope="col">Name</th><th scope="col">Role</th><th scope="col">Access</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead>
        <tbody>${team.map(p => `
          <tr>
            <td><span class="t-title">${esc(p.name)}${p.id === person.id ? ' <span class="muted">(you)</span>' : ''}</span><span class="t-sub">${esc(p.email)}</span></td>
            <td>${esc(ROLE_LABELS[p.role])}</td>
            <td>${access(p)}</td>
            <td class="t-actions">
              <button type="button" class="btn btn--small" data-edit-team="${esc(p.id)}">Edit</button>
              ${p.id !== person.id && !teamUsed(p.id) ? `<button type="button" class="btn btn--small btn--danger" data-delete="team" data-id="${esc(p.id)}">Delete</button>` : ''}
            </td>
          </tr>`).join('')}
        </tbody>
      </table></div>
    </section>

    <section class="panel">
      <div class="panel__head">
        <div><h2>Writers</h2><p>Internal and external writers. They only ever see their own work.</p></div>
        <button type="button" class="btn btn--primary" data-act="add-writer">Add writer</button>
      </div>
      <div class="table-scroll"><table class="table">
        <thead><tr><th scope="col">Name</th><th scope="col">Type</th><th scope="col">Access</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead>
        <tbody>${writers.map(w => `
          <tr>
            <td><span class="t-title">${esc(w.name)}</span><span class="t-sub">${esc(w.email)}</span></td>
            <td>${esc(w.type)}</td>
            <td>${access(w)}</td>
            <td class="t-actions">
              <button type="button" class="btn btn--small" data-edit-writer="${esc(w.id)}">Edit</button>
              <button type="button" class="btn btn--small" data-toggle-writer="${esc(w.id)}">${w.active === false ? 'Give access' : 'Remove access'}</button>
              ${!writerUsed(w.id) ? `<button type="button" class="btn btn--small btn--danger" data-delete="writers" data-id="${esc(w.id)}">Delete</button>` : ''}
            </td>
          </tr>`).join('')}
        </tbody>
      </table></div>
      <p class="table-note">Delete only shows for people with no work, clients or time off yet. Everyone else can have their access removed instead.</p>
    </section>

    <section class="panel">
      <div class="panel__head"><div><h2>AMs</h2><p>Account managers. They don’t sign in yet; their names are used on clients and pieces.</p></div></div>
      <form class="list-editor" data-form="ams" novalidate>
        <ul class="list-editor__rows">${ams.map(a => {
          const uses = clients.filter(c => c.amId === a.id).length + content.filter(c => c.amId === a.id).length;
          return `
          <li data-id="${esc(a.id)}">
            <input type="text" name="name" value="${esc(a.name)}" aria-label="AM name">
            <span class="list-editor__note">${uses ? `Used ${uses} ${uses === 1 ? 'time' : 'times'}` : 'Not used yet'}</span>
            <button type="button" class="btn btn--small btn--danger" data-remove-am="${esc(a.id)}" ${uses ? 'disabled title="Change the clients and pieces that use this AM first."' : ''}>Remove</button>
          </li>`;
        }).join('')}</ul>
        <div class="list-editor__add">
          <input type="text" name="newAm" placeholder="New AM’s name" aria-label="New AM's name">
          <button type="button" class="btn" data-act="add-am">Add</button>
        </div>
        <p class="form-error" role="alert" hidden></p>
        <div class="form-actions"><button type="submit" class="btn btn--primary">Save AMs</button></div>
      </form>
    </section>`;
}

function bindPeople(ctx) {
  const { el, store, person } = ctx;
  const by = person.id;

  on(el, 'click', '[data-act="add-team"]', () => openTeamMember(ctx, null));
  on(el, 'click', '[data-edit-team]', (event, btn) => openTeamMember(ctx, btn.dataset.editTeam));
  on(el, 'click', '[data-act="add-writer"]', () => openWriter(ctx, null));
  on(el, 'click', '[data-edit-writer]', (event, btn) => openWriter(ctx, btn.dataset.editWriter));

  on(el, 'click', '[data-toggle-writer]', async (event, btn) => {
    const w = store.get('writers', btn.dataset.toggleWriter);
    const giving = w.active === false;
    const open = store.all('content').filter(c => c.writerId === w.id && ['booked', 'with_writer', 'revisions'].includes(c.status)).length;
    const warning = open
      ? `\n\n${w.name} still has ${open} unfinished ${open === 1 ? 'piece' : 'pieces'}. They stay with ${w.name} until you give them to another writer on the Content page.`
      : '';
    if (!giving && !confirm(`Remove ${w.name}'s access? Their past work stays, and you can give access back later.${warning}`)) return;
    await store.save('writers', { id: w.id, active: giving }, { by, note: giving ? 'Access given' : 'Access removed' });
    toast(giving ? `${w.name} can sign in again.` : `${w.name} can no longer sign in.`);
    ctx.refresh();
  });

  on(el, 'click', '[data-delete]', async (event, btn) => {
    const tab = btn.dataset.delete;
    const row = store.get(tab, btn.dataset.id);
    if (!confirm(`Delete ${row.name}? This can't be undone.`)) return;
    await store.remove(tab, row.id, { by, note: `Deleted ${row.name}` });
    toast(`Deleted ${row.name}.`);
    ctx.refresh();
  });

  // AMs: edit names in place, add new ones, remove unused ones, then save.
  const form = el.querySelector('[data-form="ams"]');
  const rows = form.querySelector('.list-editor__rows');
  on(form, 'click', '[data-act="add-am"]', () => {
    const input = form.elements.newAm;
    const name = input.value.trim();
    if (!name) return input.focus();
    rows.insertAdjacentHTML('beforeend', `
      <li data-id=""><input type="text" name="name" value="${esc(name)}" aria-label="AM name">
        <span class="list-editor__note">New</span>
        <button type="button" class="btn btn--small btn--danger" data-remove-am="">Remove</button></li>`);
    input.value = '';
    input.focus();
  });
  on(form, 'click', '[data-remove-am]', (event, btn) => btn.closest('li').remove());
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const items = [...rows.querySelectorAll('li')].map(li => ({ id: li.dataset.id, name: li.querySelector('input').value.trim() }));
    const error = form.querySelector('.form-error');
    if (items.some(i => !i.name)) {
      error.textContent = 'Every AM needs a name.';
      error.hidden = false;
      return;
    }
    const kept = new Set(items.map(i => i.id).filter(Boolean));
    for (const old of store.all('ams')) if (!kept.has(old.id)) await store.remove('ams', old.id, { by, note: `Removed AM ${old.name}` });
    for (const i of items) {
      const old = i.id ? store.get('ams', i.id) : null;
      if (!old) await store.save('ams', { name: i.name }, { by, note: 'AM added' });
      else if (old.name !== i.name) await store.save('ams', { id: i.id, name: i.name }, { by });
    }
    toast('AMs saved.');
    ctx.refresh();
  });
}

function openTeamMember(ctx, id) {
  const { store, person } = ctx;
  const p = id ? store.get('team', id) : { name: '', email: '', role: 'content', active: true };
  const self = id === person.id;
  const body = `
    <form class="form-grid" novalidate>
      ${field('Name', `<input type="text" name="name" value="${esc(p.name)}" required>`)}
      ${field('Email', `<input type="email" name="email" value="${esc(p.email)}" required>`, { hint: 'The Google account they sign in with.' })}
      ${field('Role', `<select name="role" ${self ? 'disabled' : ''}>${options(Object.entries(ROLE_LABELS).filter(([k]) => k !== 'writer').map(([value, label]) => ({ value, label })), p.role)}</select>`,
        { hint: self ? 'You can’t change your own role.' : 'Admins can also change writers, rates and these settings.' })}
      <span class="check field--pad"><input type="checkbox" name="active" ${p.active !== false ? 'checked' : ''} ${self ? 'disabled' : ''}> Can sign in</span>
      <p class="form-error field--wide" role="alert" hidden></p>
      <div class="form-actions field--wide"><button type="submit" class="btn btn--primary">${id ? 'Save changes' : 'Add team member'}</button></div>
    </form>`;
  const panel = openDrawer({ label: id || 'New team member', title: id ? p.name : 'Add a team member', body });
  const form = panel.querySelector('form');
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const d = formData(form);
    const role = self ? p.role : d.role;
    const active = self ? true : d.active;
    const problems = [];
    if (!d.name) problems.push('Add a name.');
    if (!/^\S+@\S+\.\S+$/.test(d.email)) problems.push('Add a valid email.');
    const taken = store.all('team').concat(store.all('writers')).some(x => x.email.toLowerCase() === d.email.toLowerCase() && x.id !== id);
    if (taken) problems.push('Someone already uses that email.');
    const adminsLeft = store.all('team').filter(x => x.id !== id && x.role === 'admin' && x.active !== false).length + (role === 'admin' && active ? 1 : 0);
    if (!adminsLeft) problems.push('There must always be at least one admin who can sign in.');
    if (problems.length) {
      const error = form.querySelector('.form-error');
      error.textContent = problems.join(' ');
      error.hidden = false;
      return;
    }
    const saved = await store.save('team', { ...(id ? { id } : {}), name: d.name, email: d.email, role, active }, { by: person.id, note: id ? '' : 'Team member added' });
    toast(id ? `Saved ${saved.name}.` : `Added ${saved.name}.`);
    ctx.refresh();
  });
}

// ---- Lists -------------------------------------------------------------------

function listsSection() {
  const s = settings();
  return `
    <p class="settings__intro">Change the choices in each dropdown. Renaming a value also updates every piece that uses it. Removing a value only stops it being offered; pieces that already use it keep it.</p>
    <div class="settings__grid">
      ${LISTS.map(l => `
        <section class="panel">
          <div class="panel__head"><div><h2>${esc(l.label)}</h2></div></div>
          <form class="list-editor" data-list="${l.key}" novalidate>
            <ul class="list-editor__rows">${s.lists[l.key].map(v => listRow(v, v)).join('')}</ul>
            <div class="list-editor__add">
              <input type="text" name="newValue" placeholder="Add a value" aria-label="New value for ${esc(l.label)}">
              <button type="button" class="btn" data-act="add-value">Add</button>
            </div>
            <p class="form-error" role="alert" hidden></p>
            <div class="form-actions">
              <button type="submit" class="btn btn--primary">Save</button>
              <button type="button" class="linkish" data-act="reset-list">Use the original list</button>
            </div>
          </form>
        </section>`).join('')}
      <section class="panel">
        <div class="panel__head"><div><h2>Priorities</h2><p>Fixed, because due dates are planned by priority.</p></div></div>
        <ul class="plain-list">${PRIORITIES.map(p => `<li>${esc(p)}</li>`).join('')}</ul>
      </section>
    </div>`;
}

const listRow = (value, original) => `
  <li data-original="${esc(original)}">
    <input type="text" name="value" value="${esc(value)}" aria-label="Value">
    <span class="list-editor__moves">
      <button type="button" class="icon-btn icon-btn--small" data-move="up" aria-label="Move up">↑</button>
      <button type="button" class="icon-btn icon-btn--small" data-move="down" aria-label="Move down">↓</button>
    </span>
    <button type="button" class="btn btn--small btn--danger" data-act="remove-value">Remove</button>
  </li>`;

function bindLists(ctx) {
  const { el, store, person } = ctx;
  for (const form of el.querySelectorAll('[data-list]')) {
    const list = LISTS.find(l => l.key === form.dataset.list);
    const rows = form.querySelector('.list-editor__rows');
    const error = form.querySelector('.form-error');

    on(form, 'click', '[data-act="add-value"]', () => {
      const input = form.elements.newValue;
      if (!input.value.trim()) return input.focus();
      rows.insertAdjacentHTML('beforeend', listRow(input.value.trim(), ''));
      input.value = '';
      input.focus();
    });
    on(form, 'click', '[data-act="remove-value"]', (event, btn) => btn.closest('li').remove());
    on(form, 'click', '[data-move]', (event, btn) => {
      const li = btn.closest('li');
      if (btn.dataset.move === 'up' && li.previousElementSibling) li.previousElementSibling.before(li);
      if (btn.dataset.move === 'down' && li.nextElementSibling) li.nextElementSibling.after(li);
      btn.focus();
    });
    on(form, 'click', '[data-act="reset-list"]', () => {
      rows.innerHTML = defaultSettings().lists[list.key].map(v => listRow(v, settings().lists[list.key].includes(v) ? v : '')).join('');
      toast('Original list restored. Save to keep it.');
    });

    form.addEventListener('submit', async event => {
      event.preventDefault();
      const items = [...rows.querySelectorAll('li')].map(li => ({ value: li.querySelector('input').value.trim(), original: li.dataset.original }));
      const values = items.map(i => i.value);
      let problem = '';
      if (!values.length) problem = 'Keep at least one value.';
      else if (values.some(v => !v)) problem = 'Values can’t be blank.';
      else if (new Set(values.map(v => v.toLowerCase())).size !== values.length) problem = 'Each value can only appear once.';
      if (problem) {
        error.textContent = problem;
        error.hidden = false;
        return;
      }
      const renames = items.filter(i => i.original && i.original !== i.value);
      const { tab, field: key } = list.usedBy;
      let updated = 0;
      for (const r of renames) {
        for (const row of store.all(tab).filter(x => x[key] === r.original)) {
          await store.save(tab, { id: row.id, [key]: r.value }, { by: person.id, note: `${list.label}: "${r.original}" renamed to "${r.value}" in Settings` });
          updated++;
        }
      }
      await saveSettings(ctx, { lists: { ...settings().lists, [list.key]: values } }, `${list.label} list changed`);
      toast(updated ? `${list.label} saved. ${updated} ${updated === 1 ? 'record was' : 'records were'} updated with the new name.` : `${list.label} saved.`);
      ctx.refresh();
    });
  }
}

// ---- Fields & columns ------------------------------------------------------------

function fieldsSection() {
  const s = settings();
  const compact = new Set(columnsFor('compact'));
  const sheet = new Set(columnsFor('sheet'));
  const typeLabel = t => CUSTOM_TYPES.find(x => x.value === t)?.label || t;
  const defaults = Object.fromEntries(FIELDS.map(f => [f.key, f.label]));
  const locked = key => key === 'title' || key === 'status';

  const rows = allFields().map(f => {
    const custom = f.builtIn ? null : customFields().find(c => `custom:${c.id}` === f.key);
    return `
      <tr data-key="${esc(f.key)}">
        <td>
          <input type="text" name="label" value="${esc(f.builtIn ? (s.labels[f.key] || '') : f.label)}"
            placeholder="${esc(f.builtIn ? defaults[f.key] : '')}" aria-label="Name for ${esc(f.label)}" ${f.builtIn ? '' : 'required'}>
        </td>
        <td class="t-center"><input type="checkbox" name="compact" aria-label="Show ${esc(f.label)} in Compact view" ${compact.has(f.key) ? 'checked' : ''} ${locked(f.key) ? 'checked disabled' : ''}></td>
        <td class="t-center"><input type="checkbox" name="sheet" aria-label="Show ${esc(f.label)} in Sheet view" ${sheet.has(f.key) ? 'checked' : ''}></td>
        <td>${f.builtIn ? '<span class="muted">Built in</span>' : `
          <span class="t-title">${esc(typeLabel(custom.type))}</span>
          ${custom.type === 'choice' ? `<input type="text" name="options" value="${esc((custom.options || []).join(', '))}" aria-label="Choices for ${esc(custom.label)}" placeholder="Choices, separated by commas">` : ''}`}
        </td>
        <td class="t-center">${f.builtIn ? '' : `<input type="checkbox" name="booking" aria-label="Show ${esc(custom.label)} on the Book content form" ${custom.showOnBooking ? 'checked' : ''}>`}</td>
        <td class="t-actions">${f.builtIn ? '' : `<button type="button" class="btn btn--small btn--danger" data-delete-field="${esc(custom.id)}">Delete</button>`}</td>
      </tr>`;
  }).join('');

  return `
    <p class="settings__intro">Rename any field, choose which columns show in the Content list, and add fields of your own. Leave a name blank to use the original. Title and Stage always show in Compact view. For your own fields, tick <strong>On booking form</strong> to have them filled in when a piece is booked; otherwise they appear only in each piece\u2019s details.</p>

    <section class="panel">
      <div class="panel__head"><div><h2>Fields</h2><p>Renaming only changes what people see. The information itself stays the same.</p></div></div>
      <form data-form="fields" novalidate>
        <div class="table-scroll"><table class="table table--form">
          <thead><tr>
            <th scope="col">Name people see</th><th scope="col" class="t-center">Compact</th><th scope="col" class="t-center">Sheet view</th>
            <th scope="col">Kind</th><th scope="col" class="t-center">On booking form</th><th scope="col"><span class="sr-only">Actions</span></th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table></div>
        <p class="form-error" role="alert" hidden></p>
        <div class="form-actions form-actions--pad"><button type="submit" class="btn btn--primary">Save fields</button></div>
      </form>
    </section>

    <section class="panel">
      <div class="panel__head"><div><h2>Add a field</h2><p>For anything the team needs to record that isn’t here yet, like a target keyword.</p></div></div>
      <form class="form-grid form-grid--tight" data-form="new-field" novalidate>
        ${field('Name', '<input type="text" name="label" required placeholder="e.g. Target keyword">')}
        ${field('Kind', `<select name="type">${options(CUSTOM_TYPES, 'text')}</select>`)}
        ${field('Choices', '<input type="text" name="options" placeholder="e.g. Yes, No, Maybe">', { wide: true, hint: 'Only for Dropdown. Separate choices with commas.' })}
        <span class="check"><input type="checkbox" name="booking"> Show on the Book content form</span>
        <span class="check"><input type="checkbox" name="compact"> Show in Compact view</span>
        <span class="check"><input type="checkbox" name="sheet" checked> Show in Sheet view</span>
        <p class="form-error field--wide" role="alert" hidden></p>
        <div class="form-actions field--wide"><button type="submit" class="btn btn--primary">Add field</button></div>
      </form>
    </section>`;
}

const splitChoices = text => [...new Set(String(text || '').split(',').map(x => x.trim()).filter(Boolean))];

function bindFields(ctx) {
  const { el } = ctx;
  const form = el.querySelector('[data-form="fields"]');
  const defaults = Object.fromEntries(FIELDS.map(f => [f.key, f.label]));

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const labels = {};
    const columns = { compact: [], sheet: [] };
    const extras = customFields().map(f => ({ ...f }));
    const problems = [];

    for (const tr of form.querySelectorAll('tr[data-key]')) {
      const key = tr.dataset.key;
      const name = tr.querySelector('[name="label"]').value.trim();
      const compact = tr.querySelector('[name="compact"]');
      if (compact.checked || compact.disabled) columns.compact.push(key);
      if (tr.querySelector('[name="sheet"]').checked) columns.sheet.push(key);
      if (key.startsWith('custom:')) {
        const f = extras.find(x => `custom:${x.id}` === key);
        if (!name) problems.push('Your own fields need a name.');
        f.label = name || f.label;
        f.showOnBooking = tr.querySelector('[name="booking"]').checked;
        const choices = tr.querySelector('[name="options"]');
        if (choices) {
          f.options = splitChoices(choices.value);
          if (!f.options.length) problems.push(`${f.label} needs at least one choice.`);
        }
      } else if (name && name !== defaults[key]) {
        labels[key] = name;
      }
    }
    if (problems.length) {
      const error = form.querySelector('.form-error');
      error.textContent = [...new Set(problems)].join(' ');
      error.hidden = false;
      return;
    }
    await saveSettings(ctx, { labels, columns, customFields: extras }, 'Fields and columns changed');
    toast('Fields saved.');
    ctx.refresh();
  });

  on(form, 'click', '[data-delete-field]', async (event, btn) => {
    const f = customFields().find(x => x.id === btn.dataset.deleteField);
    if (!confirm(`Delete the field "${f.label}"? Values already saved on pieces are kept but no longer shown.`)) return;
    const s = settings();
    const key = `custom:${f.id}`;
    await saveSettings(ctx, {
      customFields: s.customFields.filter(x => x.id !== f.id),
      columns: { compact: s.columns.compact.filter(k => k !== key), sheet: s.columns.sheet.filter(k => k !== key) },
    }, `Field "${f.label}" deleted`);
    toast(`Deleted the field "${f.label}".`);
    ctx.refresh();
  });

  const add = el.querySelector('[data-form="new-field"]');
  add.addEventListener('submit', async event => {
    event.preventDefault();
    const d = formData(add);
    const error = add.querySelector('.form-error');
    const choices = splitChoices(d.options);
    const taken = allFields().some(f => f.label.toLowerCase() === d.label.toLowerCase());
    const problem = !d.label ? 'Give the field a name.'
      : taken ? 'There’s already a field with that name.'
      : d.type === 'choice' && !choices.length ? 'Add at least one choice for the dropdown.' : '';
    if (problem) {
      error.textContent = problem;
      error.hidden = false;
      return;
    }
    const s = settings();
    const id = nextCustomId(s.customFields);
    const newField = { id, label: d.label, type: d.type, options: d.type === 'choice' ? choices : [], showOnBooking: d.booking };
    await saveSettings(ctx, {
      customFields: [...s.customFields, newField],
      columns: {
        compact: d.compact ? [...s.columns.compact, `custom:${id}`] : s.columns.compact,
        sheet: d.sheet ? [...s.columns.sheet, `custom:${id}`] : s.columns.sheet,
      },
    }, `Field "${d.label}" added`);
    toast(`Added the field "${d.label}".`);
    ctx.refresh();
  });
}

// ---- Stages ------------------------------------------------------------------------

function stagesSection() {
  const saved = settings().stages;
  return `
    <p class="settings__intro">Rename the stages. Their order and what they do stay the same. Leave a name blank to use the original.</p>
    <section class="panel">
      <form data-form="stages" novalidate>
        <div class="table-scroll"><table class="table table--form">
          <thead><tr><th scope="col">#</th><th scope="col">Name the team sees</th><th scope="col">Name writers see</th></tr></thead>
          <tbody>${STAGES.map((st, i) => `
            <tr data-key="${st.key}">
              <td class="t-id">${i + 1}</td>
              <td><input type="text" name="label" value="${esc(saved[st.key]?.label || '')}" placeholder="${esc(st.label)}" aria-label="Team name for stage ${i + 1}"></td>
              <td><input type="text" name="writer" value="${esc(saved[st.key]?.writer || '')}" placeholder="${esc(st.writer)}" aria-label="Writer name for stage ${i + 1}"></td>
            </tr>`).join('')}
          </tbody>
        </table></div>
        <div class="form-actions form-actions--pad"><button type="submit" class="btn btn--primary">Save stages</button></div>
      </form>
    </section>`;
}

function bindStages(ctx) {
  const form = ctx.el.querySelector('[data-form="stages"]');
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const stages = {};
    for (const tr of form.querySelectorAll('tr[data-key]')) {
      const def = STAGES.find(s => s.key === tr.dataset.key);
      const label = tr.querySelector('[name="label"]').value.trim();
      const writer = tr.querySelector('[name="writer"]').value.trim();
      const entry = {};
      if (label && label !== def.label) entry.label = label;
      if (writer && writer !== def.writer) entry.writer = writer;
      if (Object.keys(entry).length) stages[def.key] = entry;
    }
    await saveSettings(ctx, { stages }, 'Stage names changed');
    toast('Stages saved.');
    ctx.refresh();
  });
}

// ---- General ----------------------------------------------------------------------

function generalSection() {
  return `
    <section class="panel">
      <div class="panel__head"><div><h2>Tool name</h2><p>Shown in the menu, on the sign-in page and in the browser tab.</p></div></div>
      <form class="form-grid form-grid--tight" data-form="general" novalidate>
        ${field('Name', `<input type="text" name="appName" value="${esc(settings().appName)}" required>`)}
        <p class="form-error field--wide" role="alert" hidden></p>
        <div class="form-actions field--wide"><button type="submit" class="btn btn--primary">Save</button></div>
      </form>
    </section>
    <section class="panel">
      <div class="panel__head"><div><h2>Start again</h2><p>Puts every name, list, column and stage back to how it was. Your own fields are removed, and their saved values are hidden.</p></div></div>
      <div class="form-actions form-actions--pad"><button type="button" class="btn btn--danger" data-act="reset-settings">Reset all settings</button></div>
    </section>`;
}

function bindGeneral(ctx) {
  const { el } = ctx;
  const form = el.querySelector('[data-form="general"]');
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const { appName } = formData(form);
    if (!appName) {
      const error = form.querySelector('.form-error');
      error.textContent = 'Give the tool a name.';
      error.hidden = false;
      return;
    }
    await saveSettings(ctx, { appName }, 'Tool name changed');
    toast('Name saved.');
    ctx.refresh();
  });
  on(el, 'click', '[data-act="reset-settings"]', async () => {
    if (!confirm('Reset all settings to how they were at the start?')) return;
    await ctx.store.save('settings', { ...defaultSettings(), id: SETTINGS_ID }, { by: ctx.person.id, note: 'All settings reset' });
    toast('Settings reset.');
    ctx.refresh();
  });
}
