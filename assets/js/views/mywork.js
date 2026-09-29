// My work: what a writer sees. Only their own pieces, the simpler stage names, and no pay.

import { formatDate, formatDay, relativeDay } from '../dates.js';
import { fieldLabel } from '../settings.js';
import { esc, extLink, formData, on, openRevision, priorityTag, safeUrl, stageChip, stageOf, toast, words } from '../ui.js';

const GROUPS = [
  { key: 'Revisions needed', intro: 'The client asked for changes. Update your document, then submit it again.' },
  { key: 'New', intro: 'New work for you. Accept it so the team knows you’ve seen it.' },
  { key: 'In progress', intro: 'Submit each piece with a link to your finished document.' },
  { key: 'Submitted', intro: 'With the team or the client. Nothing to do unless they ask for changes.' },
  { key: 'Done', intro: 'Approved by the client.' },
];

export function renderMyWork(ctx) {
  const { el, store, today, person, lookup } = ctx;
  const mine = store.all('content').filter(c => c.writerId === person.id);
  const revisions = store.all('revisions');
  const open = mine.filter(c => c.status === 'booked' || c.status === 'with_writer');
  const nextDue = open.map(c => c.dueDate).sort()[0];

  ctx.setHeader({
    title: 'My work',
    subtitle: open.length
      ? `${open.length} ${open.length === 1 ? 'piece' : 'pieces'} to write. Next due ${formatDate(nextDue)}.`
      : 'Nothing to write right now.',
  });

  const card = c => {
    const s = stageOf(c.status);
    const rev = c.status === 'revisions' ? openRevision(c.id, revisions) : null;
    const due = rev ? rev.dueDate : c.dueDate;
    const late = (s.writer === 'New' || s.writer === 'In progress' || rev) && due && due < today;
    let action = '';
    if (s.writer === 'New') {
      action = `<button type="button" class="btn btn--primary" data-act="accept" data-id="${esc(c.id)}">Accept</button>`;
    } else if (s.writer === 'In progress' || s.writer === 'Revisions needed') {
      const label = rev ? 'Submit revision' : 'Submit';
      action = `
        <form class="submit-form" data-id="${esc(c.id)}" novalidate>
          <label class="field">
            <span class="field__label">Link to your finished document</span>
            <input type="url" name="link" value="${esc(rev ? c.contentLink : '')}" placeholder="https://docs.google.com/..." required>
          </label>
          <button type="submit" class="btn btn--primary">${label}</button>
          <p class="form-error" role="alert" hidden></p>
        </form>`;
    }
    return `
      <article class="work-card work-card--${s.tone}">
        <header class="work-card__head">
          <div>
            <h3>${esc(c.title)}</h3>
            <p class="muted">${esc(lookup.name('clients', c.clientId))}</p>
          </div>
          <span class="stage-cell">${c.priority !== 'Normal' && s.writer !== 'Done' ? priorityTag(c.priority) : ''}${stageChip(c.status, { writerView: true })}</span>
        </header>
        <dl class="facts">
          <div><dt>${rev ? 'Revision due' : 'Due'}</dt><dd class="${late ? 'is-late' : ''}">${esc(formatDay(due))}/${esc(due.slice(0, 4))} <span>(${esc(relativeDay(due, today))})</span></dd></div>
          <div><dt>${esc(fieldLabel('words'))}</dt><dd>${words(c.words)}</dd></div>
          <div><dt>${esc(fieldLabel('language'))}</dt><dd>${esc(c.language)}</dd></div>
          <div><dt>${esc(fieldLabel('type'))}</dt><dd>${esc(c.type)}</dd></div>
          ${c.dateReceived ? `<div><dt>Submitted</dt><dd>${esc(formatDate(c.dateReceived))}</dd></div>` : ''}
        </dl>
        ${rev ? `<div class="feedback"><p class="feedback__label">Round ${rev.round} feedback</p><p>${esc(rev.feedback)}</p></div>` : ''}
        ${c.notes && s.writer !== 'Done' ? `<p class="work-card__note">${esc(c.notes)}</p>` : ''}
        <div class="work-card__links">${extLink(c.briefLink, 'Open brief')}${extLink(c.contentLink, 'Open my document')}</div>
        ${action}
      </article>`;
  };

  const sections = GROUPS.map(g => {
    let items = mine.filter(c => stageOf(c.status).writer === g.key);
    if (g.key === 'Done' || g.key === 'Submitted') {
      items = items.sort((a, b) => ((a.dateApproved || a.dateReceived) < (b.dateApproved || b.dateReceived) ? 1 : -1)).slice(0, 6);
    } else {
      items = items.sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1));
    }
    if (!items.length) return '';
    return `
      <section class="work-group" aria-labelledby="g-${esc(g.key.replace(/\s/g, '-'))}">
        <h2 id="g-${esc(g.key.replace(/\s/g, '-'))}">${esc(g.key)} <span class="count">${items.length}</span></h2>
        <p class="muted">${esc(g.intro)}</p>
        <div class="work-list">${items.map(card).join('')}</div>
      </section>`;
  }).join('');

  el.innerHTML = `
    ${sections || '<div class="empty panel"><p>No work is assigned to you yet. The content team will add it here.</p></div>'}
    <p class="table-note">Need time off? Tell the content team and they’ll add it, so your due dates move around it.</p>`;

  on(el, 'click', '[data-act="accept"]', async (event, btn) => {
    await store.save('content', { id: btn.dataset.id, status: 'with_writer' }, { by: person.id, action: 'stage', note: 'Accepted by the writer' });
    toast('Accepted. It’s now in progress.');
    ctx.refresh();
  });

  el.addEventListener('submit', async event => {
    const form = event.target.closest('.submit-form');
    if (!form) return;
    event.preventDefault();
    const { link } = formData(form);
    const error = form.querySelector('.form-error');
    if (!safeUrl(link)) {
      error.textContent = 'Paste the full link to your document, starting with https://';
      error.hidden = false;
      form.elements.link.focus();
      return;
    }
    const piece = store.get('content', form.dataset.id);
    if (piece.status === 'revisions') {
      const rev = openRevision(piece.id, store.all('revisions'));
      if (rev) await store.save('revisions', { id: rev.id, dateReturned: today }, { by: person.id, note: `Round ${rev.round} returned` });
      await store.save('content', { id: piece.id, status: 'qc', contentLink: link }, { by: person.id, action: 'stage', note: 'Revision submitted by the writer' });
      toast('Revision submitted. The team will check it.');
    } else {
      await store.save('content', { id: piece.id, status: 'submitted', contentLink: link, dateReceived: piece.dateReceived || today }, { by: person.id, action: 'stage', note: 'Submitted by the writer' });
      toast('Submitted. Thank you!');
    }
    ctx.refresh();
  });
}
