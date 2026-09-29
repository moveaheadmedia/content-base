// Dashboard: what needs attention now, each writer's week, and what is due next.

import { addDays, formatDate, formatDay, relativeDay, weekDates } from '../dates.js';
import { dayCapacity, planWriter, PRIORITY_RANK } from '../schedule.js';
import { esc, flagsFor, flagTags, ICONS, on, openRevision, priorityTag, QUICK, stageChip, thisWeek, words, WRITING } from '../ui.js';

let weekOffset = 0; // 0 = this week, -1 = last week, 1 = next week

const firstName = name => String(name).split(' ')[0];

export function renderDashboard(ctx) {
  const { store, today, el, lookup } = ctx;
  const content = store.all('content');
  const revisions = store.all('revisions');
  const timeOff = store.all('timeoff');
  const holidays = store.all('holidays');
  // Writers without access still show while they have unfinished pieces, so no work is hidden.
  const writers = store.all('writers').filter(w => w.active !== false
    || content.some(c => c.writerId === w.id && WRITING.includes(c.status)));

  const { start: weekStart } = thisWeek(today);
  const monday = addDays(weekStart, 7 * weekOffset);
  const days = weekDates(monday);
  const range = `${formatDate(days[0]).slice(0, 5)} to ${formatDate(days[4])}`;
  const weekName = { '-1': 'Last week', 0: 'This week', 1: 'Next week' }[weekOffset] || `Week of ${formatDate(days[0])}`;
  const allPast = days[4] < today;
  const somePast = days[0] < today;

  ctx.setHeader({
    title: 'Dashboard',
    subtitle: `Today is ${formatDay(today)}/${today.slice(0, 4)}`,
    actions: ctx.can('book') ? `<a class="btn btn--primary" href="#/book">${ICONS.book}<span>Book content</span></a>` : '',
  });

  // ---- Attention strip ----------------------------------------------------
  const count = key => content.filter(c => QUICK[key].test(c, { today, revisions })).length;
  const strip = ['overdue', 'week', 'qc', 'revisions', 'urgent'].map(key => {
    const n = count(key);
    const alert = n > 0 && (key === 'overdue' || key === 'urgent');
    return `
      <a class="strip__item${alert ? ' is-alert' : ''}" href="#/content?quick=${key}">
        <span class="strip__num">${n}</span>
        <span class="strip__label">${esc(QUICK[key].label)}</span>
      </a>`;
  }).join('');

  // ---- Writer week ----------------------------------------------------------
  // Days ahead show the plan (words booked against the daily limit).
  // Past days show what actually happened: words delivered, and any late deliveries.
  const rows = writers.map(w => {
    const open = content.filter(c => c.writerId === w.id && WRITING.includes(c.status));
    const plan = planWriter({ writer: w, pieces: open, timeOff, holidays, start: today });
    const received = content.filter(c => c.writerId === w.id && c.dateReceived);
    let used = 0, cap = 0, delivered = 0;

    const cells = days.map(d => {
      const holiday = holidays.find(h => h.date === d);
      const off = timeOff.find(t => t.writerId === w.id && d >= t.from && d <= t.to);
      if (holiday || off) {
        const label = holiday ? holiday.name : off.reason;
        return `<div class="cell cell--off${d < today ? ' cell--past' : ''}" role="cell"><span class="cell__tag">${esc(label)}</span></div>`;
      }
      if (d < today) {
        const that = received.filter(c => c.dateReceived === d);
        const n = that.reduce((sum, c) => sum + (Number(c.words) || 0), 0);
        const late = that.filter(c => c.dueDate && c.dateReceived > c.dueDate).length;
        delivered += n;
        if (!n) return '<div class="cell cell--past" role="cell"><span class="cell__num">No delivery</span></div>';
        return `
          <div class="cell cell--past cell--done" role="cell" title="${esc(that.map(c => c.title).join(', '))}">
            <span class="cell__num"><strong>${words(n)}</strong> delivered</span>
            ${late ? `<span class="flag flag--overdue">${late} late</span>` : ''}
          </div>`;
      }
      const capacity = dayCapacity(w, d, { timeOff, holidays });
      if (!capacity) return '<div class="cell cell--none" role="cell"><span class="cell__num">No hours</span></div>';
      const booked = plan.days[d]?.used || 0;
      used += booked;
      cap += capacity;
      const pct = Math.round((booked / capacity) * 100);
      const state = booked >= capacity ? ' cell--full' : booked === 0 ? ' cell--free' : '';
      return `
        <div class="cell${state}" role="cell" title="${words(booked)} of ${words(capacity)} words booked">
          <span class="meter" aria-hidden="true"><span style="width:${pct}%"></span></span>
          <span class="cell__num">${booked === 0 ? 'Free' : `${words(booked)} / ${words(capacity)}`}</span>
        </div>`;
    }).join('');

    return `
      <div class="board__row" role="row">
        <div class="board__writer" role="rowheader">
          <a href="#/content?writer=${esc(w.id)}">${esc(w.name)}</a>${w.active === false ? '<span class="flag flag--risk">No access</span>' : ''}
          <span>${esc(w.type)}, ${esc(w.languages.join(', '))}</span>
        </div>
        ${cells}
        <div class="board__total" role="cell">
          ${allPast ? '' : cap ? `<span class="board__plan">${words(used)} <span>/ ${words(cap)}</span></span>` : '<span class="board__done">No time left</span>'}
          ${allPast ? `<span class="board__plan">${words(delivered)} delivered</span>` : somePast && delivered ? `<span class="board__done">${words(delivered)} delivered</span>` : ''}
        </div>
      </div>`;
  }).join('');

  const head = days.map(d => `
    <div class="board__day${d === today ? ' is-today' : ''}" role="columnheader">
      ${esc(formatDay(d))}${d === today ? '<span>Today</span>' : ''}
    </div>`).join('');

  // ---- Needs a decision -----------------------------------------------------
  const severity = { overdue: 0, past: 1, risk: 2 };
  const flagged = content
    .map(c => ({ c, flags: flagsFor(c, { today, revisions }) }))
    .filter(x => x.flags.length)
    .sort((a, b) => severity[a.flags[0].kind] - severity[b.flags[0].kind] || (a.c.dueDate < b.c.dueDate ? -1 : 1));

  const dueText = c => {
    const rev = c.status === 'revisions' ? openRevision(c.id, revisions) : null;
    return rev ? `revision due ${formatDate(rev.dueDate)}` : `due ${formatDate(c.dueDate)}`;
  };

  const decisions = flagged.length
    ? flagged.slice(0, 8).map(({ c, flags }) => `
        <li>
          <a class="item" href="#/content/${esc(c.id)}">
            <span class="item__main">
              <span class="item__title">${esc(c.title)}</span>
              <span class="item__sub">${esc(lookup.name('clients', c.clientId))}, ${esc(firstName(lookup.name('writers', c.writerId)))}, ${esc(dueText(c))}</span>
            </span>
            <span class="item__tags">${flagTags(flags)}${stageChip(c.status)}</span>
          </a>
        </li>`).join('')
    : '<li class="empty-line">Nothing is late or at risk.</li>';

  // ---- Due next ---------------------------------------------------------------
  const next = content
    .filter(c => WRITING.includes(c.status) && c.dueDate >= today)
    .sort((a, b) => (a.dueDate === b.dueDate ? PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] : a.dueDate < b.dueDate ? -1 : 1))
    .slice(0, 7);

  const dueNext = next.length
    ? next.map(c => `
        <li>
          <a class="item" href="#/content/${esc(c.id)}">
            <span class="item__date"><strong>${esc(formatDay(c.dueDate))}</strong><span>${esc(relativeDay(c.dueDate, today))}</span></span>
            <span class="item__main">
              <span class="item__title">${esc(c.title)}${c.pinned ? `<span class="pin" title="Pinned date">${ICONS.pin}</span>` : ''}</span>
              <span class="item__sub">${esc(lookup.name('writers', c.writerId))}, ${words(c.words)} words</span>
            </span>
            <span class="item__tags">${c.priority !== 'Normal' ? priorityTag(c.priority) : ''}</span>
          </a>
        </li>`).join('')
    : '<li class="empty-line">Nothing is due in the coming days.</li>';

  el.innerHTML = `
    <section class="strip" aria-label="Counts that need attention">${strip}</section>

    <section class="panel board-panel" aria-labelledby="board-title">
      <div class="panel__head">
        <div>
          <h2 id="board-title">Writer week: ${esc(weekName)} <span class="board__range">${esc(range)}</span></h2>
          <p>${allPast
            ? 'What each writer delivered, day by day.'
            : somePast
              ? 'Days ahead show words booked against each writer\u2019s daily limit. Past days show what was delivered.'
              : 'Words booked for each writer against their daily limit, worked out from the due-date plan.'}</p>
        </div>
        <div class="seg" role="group" aria-label="Choose a week">
          <button type="button" data-week="prev" aria-label="Previous week">\u2039 Previous</button>
          <button type="button" data-week="now" aria-pressed="${weekOffset === 0}">This week</button>
          <button type="button" data-week="next" aria-label="Next week">Next \u203a</button>
        </div>
      </div>
      <div class="board-scroll">
        <div class="board" role="table" aria-label="Writer week, ${esc(formatDate(days[0]))} to ${esc(formatDate(days[4]))}">
          <div class="board__row board__row--head" role="row">
            <div role="columnheader"><span class="sr-only">Writer</span></div>
            ${head}
            <div class="board__total" role="columnheader">Week</div>
          </div>
          ${rows}
        </div>
      </div>
      <ul class="legend" aria-label="Key">
        ${allPast ? '' : `<li><span class="key key--part"></span>Booked words / daily limit</li>
        <li><span class="key key--full"></span>Full</li>`}
        <li><span class="key key--off"></span>Time off or holiday</li>
        ${somePast ? '<li><span class="key key--done"></span>Past day: words delivered</li>' : ''}
      </ul>
    </section>

    <div class="dash-cols">
      <section class="panel" aria-labelledby="decide-title">
        <div class="panel__head"><h2 id="decide-title">Needs a decision</h2></div>
        <ul class="items">${decisions}</ul>
      </section>
      <section class="panel" aria-labelledby="next-title">
        <div class="panel__head"><h2 id="next-title">Due next</h2></div>
        <ul class="items">${dueNext}</ul>
      </section>
    </div>`;

  on(el, 'click', '[data-week]', (event, btn) => {
    const move = btn.dataset.week;
    weekOffset = move === 'now' ? 0 : weekOffset + (move === 'next' ? 1 : -1);
    ctx.refresh();
  });
}
