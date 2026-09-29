// Sign-in. Google sign-in turns on in round 2; until then, practice sign-in
// lets you try the tool as any made-up team member or writer.

import { CONFIG, LOGO, ROLE_LABELS } from '../config.js';
import { appName } from '../settings.js';
import { esc, initials, on } from '../ui.js';

const GOOGLE_G = `<svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>`;

export function renderSignIn({ el, store, signIn }) {
  const team = store.all('team').filter(p => p.active);
  const writers = store.all('writers').filter(w => w.active);
  const googleReady = Boolean(CONFIG.googleClientId);

  const person = (kind, p, detail) => `
    <li>
      <button class="person" type="button" data-kind="${kind}" data-id="${esc(p.id)}">
        <span class="avatar" aria-hidden="true">${esc(initials(p.name))}</span>
        <span class="person__text"><strong>${esc(p.name)}</strong><span>${esc(detail)}</span></span>
      </button>
    </li>`;

  const root = document.createElement('div');
  root.className = 'signin';
  root.innerHTML = `
    <div class="signin__panel">
      <div class="brand brand--large">
        <img class="brand__logo" src="${LOGO}" alt="Move Ahead Media" width="200" height="47">
        <span class="brand__name">${esc(appName())}</span>
      </div>
      <p class="signin__lede">Book, track and schedule content with the team and our writers.</p>

      <button class="gbtn" type="button" ${googleReady ? '' : 'disabled'} aria-describedby="google-note">
        ${GOOGLE_G}<span>Sign in with Google</span>
      </button>
      <p id="google-note" class="signin__note">
        ${googleReady
          ? 'Use your Move Ahead Media Google account, or the email the content team added for you.'
          : 'Google sign-in turns on in round 2, once the Client ID is set up.'}
      </p>

      <section class="signin__practice" aria-labelledby="practice-title">
        <h2 id="practice-title">Practice sign-in</h2>
        <p>Choose who you want to be. Everything here is made-up data and stays in this browser.</p>
        <h3>Content team</h3>
        <ul class="people">${team.map(p => person('team', p, ROLE_LABELS[p.role])).join('')}</ul>
        <h3>Writers</h3>
        <ul class="people">${writers.map(w => person('writer', w, `${w.type} writer, ${w.languages.join(' and ')}`)).join('')}</ul>
      </section>
    </div>`;

  el.replaceChildren(root);
  on(root, 'click', '.person', (event, btn) => signIn({ kind: btn.dataset.kind, id: btn.dataset.id }));
}
