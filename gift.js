/* Cécile Beauté — carte cadeau : montant, destinataire, paiement Stripe.
   DEMO_MODE : la carte est simulée (code factice), rien n'est enregistré ni prélevé.
   Sinon : POST /api/cadeau → page de paiement Stripe → merci.html (la carte, avec son code, est aussi envoyée par e-mail). */
(() => {
  'use strict';

  const CFG = window.CB || {};
  const DEMO = CFG.DEMO_MODE !== false;
  const API = (CFG.API_BASE || '').replace(/\/$/, '') + '/api';
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const NB = ' ';
  const TEL = '+33492743811', TEL_AFFICHE = '04 92 74 38 11';
  const dlg = $('#gift');
  if (!dlg) return;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const eur = n => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace('.', ',')) + NB + '€';

  const S = { reg: null, montant: 50, custom: '', de: '', pour: '', email: '', message: '', consent: false, hp: '', submitting: false, done: null, openedAt: 0 };
  let built = false, trigger = null, dataPromise = null;

  function ensureData() {
    if (!dataPromise) dataPromise = fetch('reglages.json').then(r => r.json()).then(r => { S.reg = r; return r; }).catch(e => { dataPromise = null; throw e; });
    return dataPromise;
  }
  const cfg = () => S.reg.carteCadeau;
  const montantValide = () => Number.isInteger(S.montant) && S.montant >= cfg().minimum && S.montant <= cfg().maximum;
  const live = msg => { const l = $('#gfLive'); if (l) { l.textContent = ''; setTimeout(() => { l.textContent = msg; }, 60); } };

  function build() {
    if (built) return; built = true;
    dlg.setAttribute('data-lenis-prevent', '');
    dlg.addEventListener('click', e => { if (e.target === dlg && !S.submitting) close(); });
    dlg.addEventListener('cancel', e => { if (S.submitting) e.preventDefault(); });
    dlg.addEventListener('close', () => { document.documentElement.dispatchEvent(new CustomEvent('cb:dialog', { detail: false })); if (trigger && document.contains(trigger)) trigger.focus({ preventScroll: true }); });
    dlg.addEventListener('click', onClick); dlg.addEventListener('input', onInput); dlg.addEventListener('change', onInput);
    dlg.addEventListener('submit', e => e.preventDefault());
  }

  async function open(opts = {}) {
    build(); trigger = opts.trigger || document.activeElement;
    try { await ensureData(); } catch (e) { alert('La carte cadeau est momentanément indisponible. Appelez le ' + TEL_AFFICHE + '.'); return; }
    if (S.done) S.done = null;
    if (!S.openedAt) S.openedAt = Date.now();
    if (!dlg.open) { dlg.showModal(); document.documentElement.dispatchEvent(new CustomEvent('cb:dialog', { detail: true })); }
    render(true);
  }
  function close() { if (dlg.open) dlg.close(); }

  /* ---------- rendu ---------- */
  function carte() {
    const v = montantValide() ? eur(S.montant) : '— €';
    return `<div class="gcard gcard--dlg" aria-hidden="true"><span class="gcard__shine"></span><svg class="gcard__mark" viewBox="0 0 48 64"><use href="#cb-mark"/></svg>
<p class="gcard__t">Carte cadeau</p><p class="gcard__n">Cécile <em>Beauté</em></p><p class="gcard__amount" id="gfAmount">${v}</p>${S.pour ? `<p class="gcard__for">Pour ${esc(S.pour)}</p>` : ''}<p class="gcard__v">Valable ${cfg().validiteMois} mois</p></div>`;
  }

  function render(focus) {
    const c = cfg();
    if (S.done) { dlg.innerHTML = shell(vueFin(), vueAsideFin()); if (focus) focusTitle(); return; }
    const chips = c.montantsSuggeres.map(m => `<button type="button" class="chip chip--amount${S.montant === m && !S.custom ? ' is-on' : ''}" data-amount="${m}" aria-pressed="${S.montant === m && !S.custom}">${eur(m)}</button>`).join('');
    const main = `<h2 class="bk__title" id="gf-title">Offrir un moment</h2>
<p class="bk__lead">Choisissez le montant : la carte est envoyée par e-mail, valable ${c.validiteMois}${NB}mois. À offrir, ou à s'offrir.</p>
<form class="form" id="gfForm" novalidate>
  <fieldset class="amounts"><legend>Montant</legend>
    <div class="chips" role="group" aria-label="Montants proposés">${chips}</div>
    <div class="field field--inline"><label for="gf-custom">Ou un autre montant, de ${c.minimum} à ${c.maximum}${NB}€</label><div class="euro"><input id="gf-custom" name="custom" inputmode="numeric" pattern="[0-9]*" autocomplete="off" value="${esc(S.custom)}" placeholder="Ex. : 45"><span aria-hidden="true">€</span></div><p class="field__err" id="gf-e-montant" hidden></p></div>
  </fieldset>
  <div class="form__row">
    <div class="field"><label for="gf-pour">Pour <small>(facultatif)</small></label><input id="gf-pour" name="pour" maxlength="60" autocomplete="off" value="${esc(S.pour)}" placeholder="Le prénom de la personne"></div>
    <div class="field"><label for="gf-de">De la part de <span aria-hidden="true">*</span></label><input id="gf-de" name="de" maxlength="60" autocomplete="given-name" required value="${esc(S.de)}" placeholder="Votre prénom"><p class="field__err" id="gf-e-de" hidden></p></div>
  </div>
  <div class="field"><label for="gf-email">Votre e-mail <span aria-hidden="true">*</span></label><input id="gf-email" name="email" type="email" inputmode="email" autocomplete="email" required value="${esc(S.email)}" aria-describedby="gf-h-email"><p class="field__hint" id="gf-h-email">La carte et son code vous sont envoyés à cette adresse.</p><p class="field__err" id="gf-e-email" hidden></p></div>
  <div class="field"><label for="gf-msg">Un petit mot <small>(facultatif)</small></label><textarea id="gf-msg" name="message" rows="3" maxlength="240" placeholder="Joyeux anniversaire !">${esc(S.message)}</textarea></div>
  <div class="hp" aria-hidden="true"><label>Ne pas remplir<input name="site_web" tabindex="-1" autocomplete="off"></label></div>
  <div class="field field--check"><label class="check"><input type="checkbox" id="gf-consent" name="consent"${S.consent ? ' checked' : ''} required aria-describedby="gf-e-consent"><span class="check__box" aria-hidden="true"><svg><use href="#i-check"/></svg></span><span>J'ai lu les <a href="mentions-legales.html#cadeau" target="_blank" rel="noopener">conditions de la carte cadeau</a> et la <a href="mentions-legales.html#confidentialite" target="_blank" rel="noopener">politique de confidentialité</a>, et je les accepte. <span aria-hidden="true">*</span></span></label><p class="field__err" id="gf-e-consent" hidden></p></div>
</form>`;
    const aside = `<div class="sum sum--gift"><h3 class="sum__h">Votre carte</h3>${carte()}
<dl class="sum__tot"><div class="is-big"><dt>À régler</dt><dd id="gfTotal">${montantValide() ? eur(S.montant) : '—'}</dd></div></dl>
<div class="recap__err" id="gfErr" role="alert" hidden></div>
<button type="button" class="btn btn--rose sum__go" data-act="pay" id="gfPay"><svg aria-hidden="true"><use href="#i-lock"/></svg><span id="gfPayTxt">${montantValide() ? 'Payer ' + eur(S.montant) + ' en sécurité' : 'Choisissez un montant'}</span></button>
<p class="recap__secure recap__secure--light"><svg aria-hidden="true"><use href="#i-lock"/></svg> Paiement sécurisé par Stripe.</p>
<p class="sum__help">Une question ? <a href="tel:${TEL}">${TEL_AFFICHE}</a></p></div>`;
    dlg.innerHTML = shell(main, aside);
    if (focus) focusTitle();
  }
  function shell(main, aside) {
    return `<div class="bk bk--gift">
  <header class="bk__head"><p class="bk__brand"><svg viewBox="0 0 48 64" aria-hidden="true"><use href="#cb-mark"/></svg><span>Cécile <em>Beauté</em></span></p><span class="bk__gifttag"><svg aria-hidden="true"><use href="#i-gift"/></svg>Carte cadeau</span>
  <button class="bk__close" type="button" data-act="close" aria-label="Fermer"><svg aria-hidden="true"><use href="#i-close"/></svg></button></header>
  ${DEMO ? `<p class="bk__demo" role="note"><strong>Mode démonstration.</strong> Aucune carte n'est vendue et aucun paiement n'est prélevé.</p>` : ''}
  <div class="bk__body"><main class="bk__main" id="gfMain">${main}</main><aside class="bk__aside" aria-label="Récapitulatif de la carte cadeau">${aside}</aside></div>
  <div class="sr-only" id="gfLive" role="status" aria-live="polite"></div>
</div>`;
  }
  function focusTitle() { const h = $('#gf-title') || $('#gf-title-fin'); if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }); } const b = $('.bk__body', dlg); if (b) b.scrollTop = 0; }

  function vueFin() {
    const d = S.done;
    return `<div class="done" tabindex="-1"><div class="done__icon" aria-hidden="true"><svg><use href="#i-gift"/></svg></div>
<h2 class="bk__title" id="gf-title-fin">${d.demo ? 'Simulation terminée' : 'Carte cadeau prête'}</h2>
<p class="bk__lead">${d.demo ? 'Dans la vraie version, la carte (avec son code) serait envoyée par e-mail à l\'acheteuse, et Cécile serait prévenue.' : 'Elle vous est envoyée par e-mail.'}</p>
<div class="recap"><p class="recap__who"><strong>${eur(d.montant)}</strong>${d.pour ? ' pour ' + esc(d.pour) : ''} · code <strong class="mono">${esc(d.code)}</strong> · valable ${cfg().validiteMois}${NB}mois</p></div>
<p class="done__close"><button type="button" class="link-btn" data-act="close">Fermer</button></p></div>`;
  }
  function vueAsideFin() { return `<div class="sum sum--done"><h3 class="sum__h">Merci</h3>${carte()}<p class="sum__help"><a href="tel:${TEL}">${TEL_AFFICHE}</a></p></div>`; }

  /* ---------- validation et paiement ---------- */
  function lire() {
    const f = $('#gfForm'); if (!f) return;
    S.pour = f.elements.pour.value.trim(); S.de = f.elements.de.value.trim(); S.email = f.elements.email.value.trim(); S.message = f.elements.message.value.trim();
    S.consent = f.elements.consent.checked; S.hp = (f.elements.site_web && f.elements.site_web.value) || '';
  }
  function majAffichage() {
    const v = montantValide() ? eur(S.montant) : '— €';
    const a = $('#gfAmount'); if (a) a.textContent = v;
    const t = $('#gfTotal'); if (t) t.textContent = montantValide() ? eur(S.montant) : '—';
    const p = $('#gfPayTxt'); if (p) p.textContent = montantValide() ? 'Payer ' + eur(S.montant) + ' en sécurité' : 'Choisissez un montant';
    const card = $('.gcard--dlg'); if (card) { let f = $('.gcard__for', card); if (S.pour) { if (!f) { f = document.createElement('p'); f.className = 'gcard__for'; card.insertBefore(f, $('.gcard__v', card)); } f.textContent = 'Pour ' + S.pour; } else if (f) f.remove(); }
  }
  function valider() {
    lire();
    const errs = {};
    if (!montantValide()) errs.montant = `Choisissez un montant entre ${cfg().minimum} et ${cfg().maximum}${NB}€.`;
    if (S.de.length < 2) errs.de = 'Indiquez votre prénom.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(S.email)) errs.email = 'Indiquez une adresse e-mail valide, par exemple prenom@exemple.fr.';
    if (!S.consent) errs.consent = 'Cochez cette case pour continuer.';
    const map = { montant: 'gf-custom', de: 'gf-de', email: 'gf-email', consent: 'gf-consent' };
    let first = null;
    Object.keys(map).forEach(k => {
      const input = $('#' + map[k]), err = $('#gf-e-' + k);
      if (errs[k]) { err.textContent = errs[k]; err.hidden = false; input.setAttribute('aria-invalid', 'true'); if (!first) first = input; } else { err.hidden = true; input.removeAttribute('aria-invalid'); }
    });
    if (first) { first.focus(); live('Le formulaire contient des erreurs : ' + Object.values(errs).join(' ')); return false; }
    return true;
  }
  async function payer() {
    if (S.submitting || !valider()) return;
    const err = $('#gfErr'), btn = $('#gfPay'); err.hidden = true;
    if (DEMO) { S.done = { demo: true, montant: S.montant, pour: S.pour, code: 'CB-DEMO-' + Math.random().toString(36).slice(2, 6).toUpperCase() }; render(true); return; }
    S.submitting = true; btn.disabled = true; btn.classList.add('is-busy'); live('Envoi en cours…');
    try {
      const r = await fetch(API + '/cadeau', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ montant: S.montant, de: S.de, pour: S.pour, message: S.message, email: S.email, consentement: true, hp: S.hp, ouvert: Date.now() - S.openedAt }) });
      const data = await r.json().catch(() => ({}));
      if (r.ok && data.url) { window.location.href = data.url; return; }
      const msgs = { 429: 'Trop de tentatives. Réessayez dans quelques minutes ou appelez-nous.', 501: 'Le paiement en ligne n\'est pas encore activé. Appelez-nous pour acheter une carte cadeau.', 422: data.message || 'Certaines informations sont invalides.' };
      throw new Error(msgs[r.status] || data.message || 'Une erreur est survenue. Réessayez ou appelez-nous.');
    } catch (e) {
      S.submitting = false; btn.disabled = false; btn.classList.remove('is-busy');
      err.innerHTML = esc(e.message || 'Connexion impossible.') + ` <a href="tel:${TEL}">${TEL_AFFICHE}</a>`; err.hidden = false;
    }
  }

  /* ---------- événements ---------- */
  function onClick(e) {
    const a = e.target.closest('[data-amount]');
    if (a) { S.montant = +a.dataset.amount; S.custom = ''; lire(); $$('.chip--amount', dlg).forEach(c => { const on = c === a; c.classList.toggle('is-on', on); c.setAttribute('aria-pressed', String(on)); }); const cu = $('#gf-custom'); if (cu) cu.value = ''; majAffichage(); return; }
    const act = e.target.closest('[data-act]'); if (!act) return;
    if (act.dataset.act === 'pay') payer();
    if (act.dataset.act === 'close') close();
  }
  function onInput(e) {
    const t = e.target;
    if (t.id === 'gf-custom') {
      S.custom = t.value.replace(/\D/g, '').slice(0, 3); t.value = S.custom; S.montant = S.custom ? parseInt(S.custom, 10) : 0;
      $$('.chip--amount', dlg).forEach(c => { c.classList.remove('is-on'); c.setAttribute('aria-pressed', 'false'); });
      if (!S.custom) { S.montant = 50; $$('.chip--amount', dlg).forEach(c => { const on = +c.dataset.amount === 50; c.classList.toggle('is-on', on); c.setAttribute('aria-pressed', String(on)); }); }
      majAffichage(); return;
    }
    if (t.getAttribute && t.getAttribute('aria-invalid') === 'true') { t.removeAttribute('aria-invalid'); const k = { 'gf-de': 'de', 'gf-email': 'email', 'gf-custom': 'montant' }[t.id], err = k && $('#gf-e-' + k); if (err) err.hidden = true; }
    if (t.id === 'gf-pour') { S.pour = t.value.trim(); majAffichage(); }
  }

  window.CBGift = { open, close };
})();
