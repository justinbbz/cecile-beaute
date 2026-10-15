/* Cécile Beauté — réglages du navigateur (le reste est dans data/reglages.json et data/catalogue.json).
   Avant la mise en ligne :
   1. DEMO_MODE → false (le bandeau « démonstration » disparaît, les vraies fonctions /api sont appelées) ;
   2. retirer <meta name="robots" content="noindex, nofollow"> dans les pages et mettre « Allow: / » dans robots.txt ;
   3. retirer la mention « Maquette de démonstration » du pied de page (index.html).
*/
window.CB = {
  /* true : simulation complète (créneaux d'exemple, paiement simulé). Aucun rendez-vous n'est enregistré, aucun paiement n'est prélevé. */
  DEMO_MODE: true,

  /* Adresse des fonctions serveur. Vide = même domaine (Cloudflare Pages Functions, dossier functions/). */
  API_BASE: "",

  /* Film d'entrée découpé en images (assets/frames/f001.webp …, voir scripts/fabriquer-film.py) */
  HERO: { frames: 160, extension: "webp", ordinateur: "d-", mobile: "m-" },

  VERSION: "1"
};
