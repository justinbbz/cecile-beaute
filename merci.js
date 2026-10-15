/* Cécile Beauté — page de remerciement après le paiement Stripe (rendez-vous ou carte cadeau).
   Lit ?session_id=…, interroge /api/statut (qui confirme le rendez-vous dans l'agenda si besoin), affiche le résumé. */
(() => {
  'use strict';
  const CFG = window.CB || {};
  const API = (CFG.API_BASE || '').replace(/\/$/, '') + '/api';
  const box = document.getElementById('etat');
  const NB = ' ';
  const TEL = '+33492743811', TEL_AFFICHE = '04 92 74 38 11';
  const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = n => String(n).padStart(2, '0');
  const eur = c => (c % 100 === 0 ? String(c / 100) : (c / 100).toFixed(2).replace('.', ',')) + NB + '€';
  const duree = m => { const h = Math.floor(m / 60), r = m % 60; return !h ? m + NB + 'min' : r ? h + NB + 'h' + NB + pad(r) : h + NB + 'h'; };
  const dateLongue = s => { const d = new Date(s + 'T12:00:00Z'); const t = JOURS[d.getUTCDay()] + ' ' + d.getUTCDate() + ' ' + MOIS[d.getUTCMonth()]; return t.charAt(0).toUpperCase() + t.slice(1); };

  const id = new URLSearchParams(location.search).get('session_id') || '';
  const vue = (titre, corps, eyebrow = 'Votre rendez-vous') => { box.innerHTML = `<p class="eyebrow eyebrow--rose"><span>${eyebrow}</span></p><h1 class="page__title">${titre}</h1>${corps}`; const h = box.querySelector('h1'); h.tabIndex = -1; h.focus({ preventScroll: true }); };

  if (!/^cs_[A-Za-z0-9_]{10,200}$/.test(id)) {
    vue('Aucun paiement <em>à vérifier</em>', `<p>Cette page s'affiche après un paiement en ligne. <a href="index.html">Retourner au site</a>, ou appelez le <a href="tel:${TEL}">${TEL_AFFICHE}</a>.</p>`);
    return;
  }
  try { sessionStorage.removeItem('cb_resa_v1'); } catch (e) { /* ignore */ }

  let reg = null, essais = 0;
  const affiche = rdv => {
    const lignes = rdv.services.map(s => `<li>${esc(s.nom)}${s.detail ? ` <small>${esc(s.detail)}</small>` : ''}</li>`).join('');
    const paiement = rdv.reste > 0 ? `Acompte réglé : <strong>${eur(rdv.paye)}</strong>. Reste à régler à l'institut : <strong>${eur(rdv.reste)}</strong>.` : `Réglé en ligne : <strong>${eur(rdv.paye)}</strong>. Rien à régler sur place.`;
    vue('Rendez-vous <em>confirmé</em>', `
      <p>Merci${rdv.prenom ? ' ' + esc(rdv.prenom) : ''} ! Un e-mail de confirmation vous est envoyé${rdv.email ? ' à ' + esc(rdv.email) : ''}.</p>
      <div class="recap">
        <div class="recap__when"><svg aria-hidden="true"><use href="#i-calendar"/></svg><div><strong>${esc(dateLongue(rdv.date))}</strong><span>à ${esc(rdv.heure.replace(':', 'h'))} · ${duree(rdv.duree)}</span></div></div>
        <ul class="recap__items recap__items--plain">${lignes}</ul>
        <p>${paiement}</p>
        <p class="recap__who"><svg aria-hidden="true" class="inl"><use href="#i-pin"/></svg> ${esc(reg.adresse.rue)}, ${esc(reg.adresse.codePostal)} ${esc(reg.adresse.ville)} · Réf. ${esc(rdv.ref || '')}</p>
      </div>
      <div class="page__actions">
        <button class="btn btn--ink" type="button" id="ics"><span>Ajouter à mon agenda (.ics)</span></button>
        <a class="btn btn--line" target="_blank" rel="noopener" href="${esc(window.CBAgenda.lienGoogle(rdv, reg))}"><span>Google Agenda</span></a>
        <a class="btn btn--line" target="_blank" rel="noopener" href="${esc(reg.liens.itineraire)}"><span>Itinéraire</span></a>
      </div>
      <p>Annulation ou report gratuit jusqu'à ${reg.reservation.annulationHeures}${NB}heures avant : appelez le <a href="tel:${TEL}">${TEL_AFFICHE}</a>. <a href="index.html">Retour au site</a></p>`);
    document.getElementById('ics').addEventListener('click', () => window.CBAgenda.telecharger(rdv, reg));
  };
  const afficheCadeau = c => {
    const valide = c.valideJusquau.split('-').reverse().join('/');
    vue('Carte cadeau <em>prête</em>', `
      <p>Merci${c.de ? ' ' + esc(c.de) : ''} ! La carte est aussi envoyée par e-mail${c.email ? ' à ' + esc(c.email) : ''}. Vous pouvez l'imprimer ou la transférer pour l'offrir.</p>
      <div class="gcard gcard--page" aria-label="Carte cadeau de ${eur(c.montant * 100)}"><span class="gcard__shine"></span><svg class="gcard__mark" viewBox="0 0 48 64" aria-hidden="true"><use href="#cb-mark"/></svg>
        <p class="gcard__t">Carte cadeau</p><p class="gcard__n">Cécile <em>Beauté</em></p><p class="gcard__amount">${eur(c.montant * 100)}</p>${c.pour ? `<p class="gcard__for">Pour ${esc(c.pour)}</p>` : ''}<p class="gcard__code">${esc(c.code)}</p><p class="gcard__v">Valable jusqu'au ${esc(valide)}</p></div>
      ${c.message ? `<p><em>« ${esc(c.message)} »</em></p>` : ''}
      <p class="page__note">Le code se présente à l'institut, ou se donne au <a href="tel:${TEL}">${TEL_AFFICHE}</a> au moment de réserver. Référence : ${esc(c.ref || '')}.</p>
      <div class="page__actions"><button class="btn btn--ink" type="button" onclick="window.print()"><span>Imprimer la carte</span></button><a class="btn btn--line" href="index.html"><span>Retour au site</span></a></div>`, 'Votre carte cadeau');
  };

  async function verifier() {
    try {
      const r = await fetch(`${API}/statut?session_id=${encodeURIComponent(id)}`, { headers: { Accept: 'application/json' } });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.etat === 'confirme' && d.cadeau) return afficheCadeau(d.cadeau);
      if (r.ok && d.etat === 'confirme' && d.rdv) return affiche(d.rdv);
      if (r.ok && d.etat === 'expire') return vue('Session de paiement <em>expirée</em>', `<p>Le paiement n'a pas été effectué et le créneau a été libéré. <a href="index.html#reserver">Choisir un nouveau créneau</a>.</p>`);
      if (r.ok && d.etat === 'perdu') return vue('Paiement reçu : <em>un instant</em>', `<p>Nous avons bien reçu votre paiement, mais votre créneau doit être vérifié par Cécile, qui vous contacte très vite. Vous pouvez aussi appeler le <a href="tel:${TEL}">${TEL_AFFICHE}</a>.</p>`);
      if (r.ok && ++essais < 12) return setTimeout(verifier, 2500);
      throw new Error(d.message || 'statut');
    } catch (e) {
      vue('Nous n\'avons pas pu <em>vérifier</em>', `<p>Si votre paiement a abouti, vous allez recevoir un e-mail de confirmation. En cas de doute, appelez le <a href="tel:${TEL}">${TEL_AFFICHE}</a>.</p>`);
    }
  }
  fetch('reglages.json').then(r => r.json()).then(r => { reg = r; verifier(); }).catch(() => vue('Une erreur est <em>survenue</em>', `<p>Appelez le <a href="tel:${TEL}">${TEL_AFFICHE}</a>.</p>`));
})();
