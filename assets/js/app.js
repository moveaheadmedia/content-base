// Content Base: page frame, sign-in, moving between screens, and who can do what.

import { LOGO, ROLE_LABELS } from './config.js';
import { todayISO } from './dates.js';
import { createStore } from './store.js';
import { appName, useSettings } from './settings.js';
import { closeDrawer, esc, ICONS, initials, on, toast } from './ui.js';
import { renderSignIn } from './views/signin.js';
import { renderDashboard } from './views/dashboard.js';
import { renderContent } from './views/content.js';
import { renderBook } from './views/book.js';
import { renderWriters } from './views/writers.js';
import { renderClients } from './views/clients.js';
import { renderTimeOff } from './views/timeoff.js';
import { renderMyWork } from './views/mywork.js';
import { renderSettings } from './views/settings.js';

const PERSON_KEY = 'content-base:practice:person';


// What each role may do. Writers only ever see their own pieces.
const PERMISSIONS = {
  admin: ['book', 'edit-content', 'delete-content', 'see-cost', 'manage-clients', 'manage-writers', 'manage-timeoff', 'settings'],
  content: ['book', 'edit-content', 'see-cost', 'manage-clients', 'manage-timeoff'],
  writer: ['my-work'],
};

const TEAM_ROUTES = [
  { name: 'dashboard', label: 'Dashboard', icon: 'dashboard', view: renderDashboard },
  { name: 'content', label: 'Content', icon: 'content', view: renderContent },
  { name: 'book', label: 'Book content', icon: 'book', view: renderBook },
  { name: 'writers', label: 'Writers', icon: 'writers', view: renderWriters },
  { name: 'clients', label: 'Clients', icon: 'clients', view: renderClients },
  { name: 'timeoff', label: 'Time off & holidays', icon: 'timeoff', view: renderTimeOff },
  { name: 'settings', label: 'Settings', icon: 'settings', view: renderSettings, perm: 'settings' },
];
const WRITER_ROUTES = [
  { name: 'my-work', label: 'My work', icon: 'mywork', view: renderMyWork },
];

const app = document.getElementById('app');
const today = todayISO();
let store;
let shellFor = null; // the person the frame was last drawn for
let lastRoute = '';
let memoryPerson = null; // used when this browser won't save

function readPerson() {
  try {
    return JSON.parse(localStorage.getItem(PERSON_KEY) || 'null');
  } catch {
    return memoryPerson;
  }
}

function writePerson(value) {
  memoryPerson = value;
  try {
    if (value) localStorage.setItem(PERSON_KEY, JSON.stringify(value));
    else localStorage.removeItem(PERSON_KEY);
  } catch { /* sign-in then lasts until the page reloads */ }
}

function currentPerson() {
  const saved = readPerson();
  if (!saved) return null;
  if (saved.kind === 'team') {
    const p = store.get('team', saved.id);
    return p && p.active ? { ...p, kind: 'team', roleKey: p.role } : null;
  }
  const w = store.get('writers', saved.id);
  return w && w.active ? { ...w, kind: 'writer', roleKey: 'writer' } : null;
}

function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, query = ''] = raw.split('?');
  const [name = '', param = ''] = path.split('/');
  return { name, param: decodeURIComponent(param), query: new URLSearchParams(query) };
}

function lookups() {
  const map = tab => Object.fromEntries(store.all(tab).map(r => [r.id, r]));
  const tabs = { team: map('team'), writers: map('writers'), clients: map('clients'), ams: map('ams') };
  return {
    ...tabs,
    name: (tab, id) => tabs[tab][id]?.name || '',
    person: id => tabs.team[id]?.name || tabs.writers[id]?.name || '',
  };
}

function routesFor(person) {
  const all = person.kind === 'writer' ? WRITER_ROUTES : TEAM_ROUTES;
  return all.filter(r => !r.perm || PERMISSIONS[person.roleKey].includes(r.perm));
}

function drawShell(person) {
  const routes = routesFor(person);
  app.innerHTML = `
    <div class="app">
      <aside class="sidebar" id="sidebar">
        <a class="brand" href="#/${routes[0].name}">
          <img class="brand__logo" src="${LOGO}" alt="Move Ahead Media" width="150" height="35">
          <span class="brand__name">${esc(appName())}</span>
        </a>
        <nav class="nav" aria-label="Main">
          ${routes.map(r => `<a class="nav__link" href="#/${r.name}" data-route="${r.name}">${ICONS[r.icon]}<span>${esc(r.label)}</span></a>`).join('')}
        </nav>
        <div class="sidebar__foot">
          <div class="me">
            <span class="avatar" aria-hidden="true">${esc(initials(person.name))}</span>
            <span class="me__text"><strong>${esc(person.name)}</strong><span>${esc(ROLE_LABELS[person.roleKey])}</span></span>
          </div>
          <button class="btn btn--small" type="button" data-shell="switch">Switch person</button>
        </div>
      </aside>
      <div class="nav-scrim" data-shell="close-nav"></div>
      <div class="main-col">
        <div class="practice-bar" role="note">
          <span>${store.saving
            ? 'Practice mode: made-up data, saved only in this browser.'
            : 'Practice mode: this browser isn’t saving changes, so they will be lost when you reload.'}</span>
          <button class="linkish" type="button" data-shell="reset">Reset practice data</button>
        </div>
        <header class="topbar">
          <button class="icon-btn menu-btn" type="button" data-shell="open-nav" aria-label="Open menu" aria-controls="sidebar">${ICONS.menu}</button>
          <div class="topbar__titles">
            <h1 id="page-title"></h1>
            <p id="page-subtitle"></p>
          </div>
          <div class="topbar__actions" id="page-actions"></div>
        </header>
        <main id="main" tabindex="-1"></main>
      </div>
    </div>`;
}

// Frame buttons. Bound once, on the page root, so they never stack up.
async function onShellClick(event, el) {
  const act = el.dataset.shell;
  const frame = app.querySelector('.app');
  if (act === 'switch') {
    writePerson(null);
    location.hash = '#/signin';
  } else if (act === 'reset') {
    if (!confirm('Reset all practice data? Every change made in this browser will be replaced with fresh sample data.')) return;
    await store.reset();
    shellFor = null;
    render();
    toast('Practice data reset.');
  } else if (act === 'open-nav') {
    frame?.classList.add('nav-open');
  } else if (act === 'close-nav') {
    frame?.classList.remove('nav-open');
  }
}

function render() {
  closeDrawer({ silent: true });
  // Apply the admin's Settings (names, lists, stages, columns) before drawing anything.
  useSettings(store.all('settings')[0]);
  const person = currentPerson();
  const { name, param, query } = parseHash();

  if (!person) {
    shellFor = null;
    document.title = `Sign in | ${appName()}`;
    renderSignIn({
      el: app, store, today,
      signIn: chosen => {
        writePerson(chosen);
        const next = chosen.kind === 'writer' ? '#/my-work' : '#/dashboard';
        if (location.hash === next) render();
        else location.hash = next;
      },
    });
    return;
  }

  const routes = routesFor(person);
  const route = routes.find(r => r.name === name) || routes[0];
  if (route.name !== name) history.replaceState(null, '', `#/${route.name}`);

  const key = `${person.kind}:${person.id}:${person.roleKey}:${appName()}`;
  if (shellFor !== key) {
    drawShell(person);
    shellFor = key;
  }

  app.querySelector('.app').classList.remove('nav-open');
  app.querySelectorAll('.nav__link').forEach(a => {
    if (a.dataset.route === route.name) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });

  // Screens listen for clicks on their own element; a fresh one each time
  // means listeners from the previous screen never pile up.
  if (lastRoute !== route.name) window.scrollTo(0, 0);
  lastRoute = route.name;

  const old = document.getElementById('main');
  const main = old.cloneNode(false);
  old.replaceWith(main);

  const role = person.roleKey;
  route.view({
    el: main, store, today, person, role, param, query,
    lookup: lookups(),
    can: action => PERMISSIONS[role].includes(action),
    go: hash => {
      if (location.hash === hash) render();
      else location.hash = hash;
    },
    refresh: render,
    setHeader: ({ title, subtitle = '', actions = '' }) => {
      document.getElementById('page-title').textContent = title;
      document.getElementById('page-subtitle').textContent = subtitle;
      document.getElementById('page-actions').innerHTML = actions;
      document.title = `${title} | ${appName()}`;
    },
  });
}

async function boot() {
  try {
    store = createStore({ today });
    await store.load();
  } catch (error) {
    app.innerHTML = `<div class="fatal"><h1>Content Base couldn’t start</h1><p>${esc(error.message)}</p></div>`;
    return;
  }
  on(app, 'click', '[data-shell]', onShellClick);
  window.addEventListener('hashchange', render);
  render();
}

boot();
