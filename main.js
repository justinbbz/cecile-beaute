/* Cécile Beauté — animations et interactions : chargement, héros « la fenêtre en arche s'ouvre », révélations, cartes en défilement horizontal,
   tarifs en onglets, avis, horaires, curseur. GSAP + ScrollTrigger + Lenis sont fournis en local (assets/vendor).
   Sans JavaScript, ou avec « réduire les animations », tout le contenu reste visible et utilisable. */
(() => {
  'use strict';

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const clamp = (v, a = 0, b = 1) => (Number.isFinite(v) ? Math.min(b, Math.max(a, v)) : a);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = t => t * t * (3 - 2 * t);
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  const html = document.documentElement;
  const CFG = window.CB || {};
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches || /[?&]reduced=1/.test(location.search); // ?reduced=1 pour tester le mode sans animation
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const hasGSAP = !!(window.gsap && window.ScrollTrigger);
  const nf = (n, d = 0) => n.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });

  if (reduce) html.classList.add('reduced');
  if (!hasGSAP) html.classList.add('no-anim');
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  if (!location.hash) window.scrollTo(0, 0);
  if (hasGSAP) window.gsap.registerPlugin(window.ScrollTrigger);

  /* ============================================================
     0. Découpage des textes
     ============================================================ */
  function splitNode(node, make) {
    const frag = document.createDocumentFragment();
    node.childNodes.forEach(child => {
      if (child.nodeType === 3) {
        child.textContent.split(/(\s+)/).forEach(part => {
          if (!part) return;
          if (/^\s+$/.test(part)) frag.appendChild(document.createTextNode(' '));
          else frag.appendChild(make(part));
        });
      } else if (child.nodeType === 1) {
        if (child.classList.contains('pill')) { frag.appendChild(child.cloneNode(true)); return; }
        const clone = child.cloneNode(false);
        clone.appendChild(splitNode(child, make));
        frag.appendChild(clone);
      }
    });
    return frag;
  }
  function splitWords(el, make) { const f = splitNode(el, make); el.textContent = ''; el.appendChild(f); }

  $$('[data-split]').forEach(el => {
    let i = 0;
    splitWords(el, word => {
      const w = document.createElement('span'); w.className = 'w';
      const inner = document.createElement('span'); inner.className = 'wi'; inner.style.setProperty('--i', i++); inner.textContent = word;
      w.appendChild(inner); return w;
    });
  });
  const manifest = $('#manifestText');
  if (manifest) splitWords(manifest, word => { const s = document.createElement('span'); s.className = 'word'; s.textContent = word; return s; });
  // lettres du titre du héros
  $$('[data-chars]').forEach((el, k) => {
    const txt = el.textContent; el.textContent = '';
    [...txt].forEach((c, i) => {
      const s = document.createElement('span'); s.className = 'ch'; s.setAttribute('aria-hidden', 'true');
      s.style.setProperty('--i', i + k * 5); s.textContent = c; el.appendChild(s);
    });
  });

  /* ============================================================
     1. Défilement fluide (Lenis) et liens d'ancre
     ============================================================ */
  let lenis = null;
  if (!reduce && window.Lenis) {
    lenis = new window.Lenis({ lerp: .09, wheelMultiplier: .95, smoothWheel: true });
    if (hasGSAP) {
      lenis.on('scroll', window.ScrollTrigger.update);
      window.gsap.ticker.add(t => lenis.raf(t * 1000));
      window.gsap.ticker.lagSmoothing(0);
    } else {
      const raf = t => { lenis.raf(t); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
    }
  }
  window.CSX = { lenis };   // même nom que dans les autres maquettes : outils-qa/ s'en sert pour faire défiler
  window.CBScroll = {
    lock() { html.classList.add('is-locked'); lenis && lenis.stop(); },
    unlock() { html.classList.remove('is-locked'); lenis && lenis.start(); },
    to(target, offset = -70) {
      if (lenis) lenis.scrollTo(target, { offset, duration: 1.8, easing: t => 1 - Math.pow(1 - t, 4) });
      else { const y = (typeof target === 'number' ? target : target.getBoundingClientRect().top + scrollY) + offset; window.scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' }); }
    }
  };
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href');
    if (id.length < 2) return;
    const target = document.getElementById(id.slice(1));
    if (!target) return;
    e.preventDefault();
    closeMenu();
    window.CBScroll.to(target, id === '#accueil' ? 0 : -70);
    history.replaceState(null, '', id);
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    setTimeout(() => target.focus({ preventScroll: true }), 900);
  });
  html.addEventListener('cb:dialog', e => (e.detail ? window.CBScroll.lock() : window.CBScroll.unlock()));
  window.CBScroll.lock();   // pas de défilement pendant le chargement ; relâché dans ready()

  /* ============================================================
     2. En-tête, menu mobile, lien actif
     ============================================================ */
  const head = $('#head'), burger = $('#burger'), menu = $('#menu'), progress = $('#headProgress');
  const heroTrack = $('#heroTrack'), stage = $('#heroStage'), hero = $('#accueil');
  let lastY = scrollY, heroEnd = 1;
  const measure = () => { heroEnd = Math.max(1, heroTrack.offsetHeight - (stage.offsetHeight || innerHeight)); };

  function openMenu() {
    menu.hidden = false; menu.inert = false; document.body.classList.add('menu-open'); burger.setAttribute('aria-expanded', 'true'); burger.setAttribute('aria-label', 'Fermer le menu');
    window.CBScroll.lock(); setTimeout(() => { const a = $('a', menu); a && a.focus(); }, 350);
  }
  function closeMenu() {
    if (!document.body.classList.contains('menu-open')) return;
    document.body.classList.remove('menu-open'); burger.setAttribute('aria-expanded', 'false'); burger.setAttribute('aria-label', 'Ouvrir le menu');
    menu.inert = true; window.CBScroll.unlock();
  }
  menu.inert = true; menu.hidden = false;
  burger.addEventListener('click', () => (document.body.classList.contains('menu-open') ? closeMenu() : openMenu()));
  addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });
  $$('[data-open-booking]', menu).forEach(b => b.addEventListener('click', closeMenu));

  function updateHeader(y) {
    head.classList.toggle('is-solid', y > 30 && !document.body.classList.contains('menu-open'));
    const goingDown = y > lastY + 2, goingUp = y < lastY - 2;
    if (y > heroEnd + 240 && goingDown && !document.body.classList.contains('menu-open')) head.classList.add('is-hidden');
    else if (goingUp || y < heroEnd) head.classList.remove('is-hidden');
    lastY = y;
    const max = document.documentElement.scrollHeight - (document.documentElement.clientHeight || innerHeight);
    progress.style.transform = 'scaleX(' + (max > 0 ? clamp(y / max) : 0).toFixed(4) + ')';
  }

  // lien du menu correspondant à la section visible
  const sections = ['soins', 'sothys', 'tarifs', 'institut', 'avis', 'infos'].map(id => document.getElementById(id)).filter(Boolean);
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => es.forEach(e => {
      const a = $(`.nav a[href="#${e.target.id}"]`);
      if (a) a.classList.toggle('is-active', e.isIntersecting);
    }), { rootMargin: '-45% 0px -50% 0px' });
    sections.forEach(s => io.observe(s));
  }

  /* ============================================================
     3. HÉROS : la fenêtre en arche s'ouvre pendant que le film avance (images du film dans un canvas)
     ============================================================ */
  const canvas = $('#heroCanvas');
  const ctx = canvas.getContext('2d', { alpha: false });
  const N = (CFG.HERO && CFG.HERO.frames) | 0;
  const EXT = (CFG.HERO && CFG.HERO.extension) || 'webp';
  let cw = 0, ch = 0, dir = '';
  const portraitPhone = () => matchMedia('(max-width: 820px)').matches;
  const wantedDir = () => (portraitPhone() ? CFG.HERO.mobile : CFG.HERO.ordinateur);
  const frames = new Array(N).fill(null);
  const have = new Uint8Array(N);
  let gen = 0, drawnOnce = false, lastKey = '';
  const OPEN = .2;                    // part du défilement pendant laquelle l'arche s'ouvre en plein écran
  const kOf = p => smooth(clamp(p / OPEN));
  let intro = reduce || !hasGSAP ? 1 : 0;   // l'arche se lève après le chargement

  function resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = Math.round(stage.clientWidth * dpr), h = Math.round(stage.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; lastKey = ''; }
    cw = canvas.width; ch = canvas.height;
  }
  /* géométrie de la fenêtre : arche au repos, plein écran une fois ouverte (k = 0 → 1) */
  function setBox(k) {
    const W = stage.clientWidth, H = stage.clientHeight, mob = portraitPhone();
    const aw = mob ? Math.min(W * .78, 380) : Math.min(W * .30, 430);
    const ah = mob ? H * .44 : Math.min(H * .70, 720);
    const at = mob ? H * .29 : (H - ah) / 2 + H * .02;
    const al = (W - aw) / 2;
    const ih = ah * easeOut(intro);                 // l'arche se lève depuis son seuil
    const t0 = at + (ah - ih), b0 = H - (at + ah);
    const l = lerp(al, 0, k), r = lerp(al, 0, k), t = lerp(t0, 0, k), b = lerp(b0, 0, k);
    const rad = Math.max(0, lerp(Math.min(aw / 2, ih / 2 + 2), 0, Math.min(1, k * 1.1)));
    const s = stage.style;
    s.setProperty('--l', l.toFixed(1) + 'px'); s.setProperty('--ri', r.toFixed(1) + 'px'); s.setProperty('--t', t.toFixed(1) + 'px'); s.setProperty('--bi', b.toFixed(1) + 'px');
    s.setProperty('--w', (W - l - r).toFixed(1) + 'px'); s.setProperty('--h', (H - t - b).toFixed(1) + 'px'); s.setProperty('--r', rad.toFixed(1) + 'px');
    s.setProperty('--aw', aw.toFixed(1) + 'px'); s.setProperty('--k', k.toFixed(4));
  }
  function loadImage(src) {
    return new Promise(resolve => {
      const im = new Image(); im.decoding = 'async';
      im.onload = () => (im.decode ? Promise.race([im.decode().catch(() => {}), new Promise(r => setTimeout(r, 1200))]).then(() => resolve(im)) : resolve(im));
      im.onerror = () => resolve(null);
      im.src = src;
    });
  }
  const pad3 = i => String(i + 1).padStart(3, '0');
  function loadOrder() {
    const out = [], seen = new Set();
    const add = i => { if (i >= 0 && i < N && !seen.has(i)) { seen.add(i); out.push(i); } };
    for (let i = 0; i < N; i += 10) add(i);
    add(N - 1);
    for (let i = 0; i < N; i += 5) add(i);
    for (let i = 0; i < N; i += 2) add(i);
    for (let i = 0; i < N; i++) add(i);
    return out;
  }
  async function loadFrames(onProgress) {
    const g = ++gen, q = loadOrder(); let k = 0, done = 0;
    const first = Math.min(N, 12);
    const worker = async () => {
      while (k < q.length && g === gen) {
        const i = q[k++];
        const im = await loadImage(dir + pad3(i) + '.' + EXT);
        if (g !== gen) return;
        if (im) { frames[i] = im; have[i] = 1; }
        done++;
        if (onProgress && done <= first) onProgress(done / first);
      }
    };
    await Promise.all(Array.from({ length: 5 }, worker));
  }
  function nearest(i) {
    if (have[i]) return i;
    for (let d = 1; d < N; d++) { if (i - d >= 0 && have[i - d]) return i - d; if (i + d < N && have[i + d]) return i + d; }
    return -1;
  }
  /* dessine l'image en « cover » ; tant que l'arche est fermée, on rapproche et on décale pour garder le visage au centre de la fenêtre */
  function cover(img, zoom, alpha, shift) {
    const iw = img.naturalWidth, ih = img.naturalHeight;
    const s = Math.max(cw / iw, ch / ih) * zoom, dw = iw * s, dh = ih * s;
    const x = (cw - dw) / 2 + shift * dw, y = (ch - dh) / 2;
    ctx.globalAlpha = alpha; ctx.drawImage(img, x, y, dw, dh);
  }
  function render(p) {
    if (!cw || !N || !Number.isFinite(p)) return;
    const k = kOf(p);
    const f = p * (N - 1), i0 = Math.floor(f), t = f - i0, i1 = Math.min(N - 1, i0 + 1);
    const a = nearest(i0), b = nearest(i1);
    if (a < 0) return;
    const key = a + '|' + b + '|' + t.toFixed(3) + '|' + cw + 'x' + ch + '|' + k.toFixed(3);
    if (key === lastKey) return; lastKey = key;
    const mob = portraitPhone();
    const fx = mob ? .5 : .34;                                   // position du visage dans la première image
    const z0 = mob ? 1.18 : 1.5;                                // zoom de départ (arche fermée)
    const zoom = lerp(z0, 1, k) * (1 + p * .08);                 // puis léger travelling avant sur toute la durée
    const shift = (1 - k) * (.5 - fx) * (mob ? 0 : 1);
    ctx.globalAlpha = 1;
    cover(frames[a], zoom, 1, shift);
    if (b !== a && t > .02) cover(frames[b], zoom, t, shift);
    ctx.globalAlpha = 1;
    if (!drawnOnce) { drawnOnce = true; hero.classList.add('is-drawn'); }
  }

  /* textes qui apparaissent le long de l'avancée */
  const beats = $$('.beat').map(el => ({ el, a: parseFloat(el.dataset.in), b: parseFloat(el.dataset.out), final: el.classList.contains('beat--final') }));
  const content = $('.hero__content'), cue = $('#heroCue'), bar = $('#heroBar'), counter = $('#heroN');
  function updateBeats(p) {
    for (const bt of beats) {
      const span = bt.b - bt.a, t = clamp((p - bt.a) / span);
      let o;
      if (bt.final) o = smooth(clamp((p - bt.a) / .05));
      else o = smooth(clamp(t / .2)) * (1 - smooth(clamp((t - .78) / .22)));
      const y = bt.final ? lerp(30, 0, smooth(clamp((p - bt.a) / .06))) : lerp(46, -46, t);
      bt.el.style.opacity = o.toFixed(3);
      bt.el.style.transform = `translate3d(0,${y.toFixed(1)}px,0)`;
      bt.el.style.visibility = o < .01 ? 'hidden' : 'visible';
      bt.el.style.pointerEvents = bt.final && o > .6 ? 'auto' : 'none';
    }
    const k = clamp(p / .08);
    if (content) { content.style.opacity = (1 - smooth(k)).toFixed(3); content.style.transform = `translate3d(0,${(-k * 40).toFixed(1)}px,0)`; content.style.visibility = k >= 1 ? 'hidden' : 'visible'; }
    if (cue) cue.style.opacity = (1 - clamp(p / .04)).toFixed(2);
    if (bar) bar.style.transform = `scaleX(${p.toFixed(4)})`;
    if (counter) counter.textContent = '0' + (p < .3 ? 1 : p < .55 ? 2 : p < .82 ? 3 : 4) + ' / 04';
    hero.classList.toggle('is-wide', kOf(p) > .85);
  }

  const scrub = !reduce && hasGSAP;
  let progressNow = 0, ticking = false;
  function frame() {
    ticking = false;
    const y = window.scrollY;
    const p = scrub ? clamp(y / heroEnd) : 0;   // sans animation : le héros reste sur sa première image, texte visible
    progressNow = p;
    if (y <= heroEnd + (stage.offsetHeight || innerHeight)) { setBox(kOf(p)); render(p); updateBeats(p); }
    updateHeader(y);
  }
  const requestFrame = () => { if (!ticking) { ticking = true; requestAnimationFrame(frame); } };
  addEventListener('scroll', requestFrame, { passive: true });
  if (lenis) lenis.on('scroll', requestFrame);
  addEventListener('resize', () => { measure(); resizeCanvas(); lastKey = ''; if (wantedDir() !== dir) { dir = wantedDir(); loadFrames(); } requestFrame(); if (hasGSAP) window.ScrollTrigger.refresh(); });

  /* chargement, puis ouverture du rideau et lever de l'arche */
  const loader = $('#loader'), pct = $('#loaderPct');
  let shown = 0;
  function setPct(v) { shown = Math.max(shown, v); if (pct) pct.textContent = Math.round(shown * 100); }
  function ready() {
    setPct(1);
    window.CBScroll.unlock();
    loader.classList.add('is-out');
    hero.classList.add('is-ready');
    if (intro < 1 && hasGSAP) {
      const o = { v: 0 };
      window.gsap.to(o, { v: 1, duration: 1.9, delay: .55, ease: 'power2.out', onUpdate: () => { intro = o.v; setBox(kOf(progressNow)); }, onComplete: () => { intro = 1; setBox(kOf(progressNow)); } });
    }
    setTimeout(() => { loader.hidden = true; }, 1300);
  }
  measure(); resizeCanvas(); setBox(0);
  dir = wantedDir();
  const minWait = new Promise(r => setTimeout(r, reduce ? 200 : 2000));
  const fontsOk = (document.fonts && document.fonts.ready ? Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 2500))]) : Promise.resolve());
  const framesFirst = N ? new Promise(res => {
    let started = false;
    const go = () => { if (started) return; started = true; loadFrames(v => { setPct(v * .9); if (v >= 1) res(); }); };
    go();
    setTimeout(res, 6000);   // filet de sécurité : on n'attend jamais plus de 6 s
  }) : Promise.resolve();
  Promise.all([minWait, fontsOk, framesFirst]).then(() => { frame(); ready(); }).catch(ready);
  frame();

  /* ============================================================
     4. Bandeau défilant : la vitesse suit celle du défilement
     ============================================================ */
  const mrow = $('#marqueeRow');
  if (mrow && hasGSAP && !reduce) {
    const sets = $$('.marquee__set', mrow); let x = 0, boost = 0, lastScroll = scrollY;
    window.gsap.ticker.add((time, dt) => {
      const w = sets[0].offsetWidth; if (!w) return;
      const v = (scrollY - lastScroll) / Math.max(dt, 1) * 16; lastScroll = scrollY;
      boost = lerp(boost, clamp(Math.abs(v) / 40, 0, 4), .08);
      x -= (.5 + boost * 2.2) * (dt / 16); if (x <= -w) x += w;
      mrow.style.transform = `translate3d(${x.toFixed(2)}px,0,0)`;
    });
  }

  /* ============================================================
     5. Apparitions (IntersectionObserver)
     ============================================================ */
  if ('IntersectionObserver' in window && !reduce) {
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      e.target.classList.add('is-in'); io.unobserve(e.target);
    }), { rootMargin: '0px 0px -12% 0px', threshold: .05 });
    $$('[data-reveal], .title, .co').forEach(el => io.observe(el));
    const ioBars = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { $$('.bar__t i', e.target).forEach(i => i.style.setProperty('--s', i.style.getPropertyValue('--v'))); ioBars.unobserve(e.target); } }), { threshold: .3 });
    const bars = $('.bars'); if (bars) ioBars.observe(bars);
  } else {
    $$('[data-reveal], .title, .co').forEach(el => el.classList.add('is-in'));
    $$('.bar__t i').forEach(i => i.style.setProperty('--s', i.style.getPropertyValue('--v')));
  }

  /* compteurs */
  $$('[data-count]').forEach(el => {
    const to = parseFloat(el.dataset.count), dec = +(el.dataset.dec || 0);
    if (reduce || !hasGSAP) { el.textContent = nf(to, dec); return; }
    const o = { v: 0 }; el.textContent = nf(0, dec);
    window.ScrollTrigger.create({ trigger: el, start: 'top 88%', once: true, onEnter: () => window.gsap.to(o, { v: to, duration: 2, ease: 'power3.out', onUpdate: () => { el.textContent = nf(o.v, dec); } }) });
  });

  /* ============================================================
     6. Manifeste : les mots s'allument, les arches s'ouvrent
     ============================================================ */
  if (manifest && hasGSAP && !reduce) {
    const words = $$('.word', manifest);
    window.ScrollTrigger.create({
      trigger: manifest, start: 'top 78%', end: 'bottom 52%', scrub: true,
      onUpdate: self => {
        const n = words.length, f = self.progress * (n + 3);
        words.forEach((w, i) => w.classList.toggle('is-lit', i < f));
        $$('.pill', manifest).forEach((p, i) => p.classList.toggle('is-open', self.progress > .12 + i * .26));
      }
    });
  } else if (manifest) { $$('.pill', manifest).forEach(p => p.classList.add('is-open')); }

  /* ============================================================
     7. Soins : cartes en défilement horizontal (bureau)
     ============================================================ */
  const soins = $('#soins'), track = $('#soinsTrack'), soinsBar = $('#soinsBar');
  if (soins && track && hasGSAP && !reduce) {
    const mm = window.gsap.matchMedia();
    mm.add('(min-width: 900px)', () => {
      soins.classList.add('is-pinned');
      const dist = () => Math.max(0, track.scrollWidth - (document.documentElement.clientWidth || window.innerWidth) + 40);
      const tw = window.gsap.to(track, {
        x: () => -dist(), ease: 'none',
        scrollTrigger: { trigger: '#soinsPin', start: 'top top', end: () => '+=' + Math.round(dist() * 1.15), pin: true, scrub: .7, invalidateOnRefresh: true, onUpdate: s => { if (soinsBar) soinsBar.style.transform = `scaleX(${s.progress.toFixed(4)})`; } }
      });
      return () => { soins.classList.remove('is-pinned'); tw.scrollTrigger && tw.scrollTrigger.kill(); tw.kill(); window.gsap.set(track, { clearProps: 'transform' }); };
    });
  }

  /* ============================================================
     8. Tarifs : onglets accessibles
     ============================================================ */
  const tabs = $$('.tab'), panels = $$('.panel');
  function activateTab(id, focus) {
    tabs.forEach(t => { const on = t.dataset.tab === id; t.classList.toggle('is-on', on); t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; if (on && focus) t.focus(); });
    panels.forEach(p => { const on = p.dataset.family === id; p.hidden = !on; p.classList.toggle('is-on', on); });
    if (hasGSAP) setTimeout(() => window.ScrollTrigger.refresh(), 60);
  }
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => activateTab(t.dataset.tab));
    t.addEventListener('keydown', e => {
      const k = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (k) { e.preventDefault(); activateTab(tabs[(i + k + tabs.length) % tabs.length].dataset.tab, true); }
      if (e.key === 'Home') { e.preventDefault(); activateTab(tabs[0].dataset.tab, true); }
      if (e.key === 'End') { e.preventDefault(); activateTab(tabs[tabs.length - 1].dataset.tab, true); }
    });
  });
  document.addEventListener('click', e => { const l = e.target.closest('a[data-tab]'); if (l) activateTab(l.dataset.tab); });

  /* réservation depuis la page */
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-open-booking]');
    if (b && window.CBBooking) { e.preventDefault(); window.CBBooking.open({ trigger: b, family: b.dataset.family, service: b.dataset.service }); }
    const g = e.target.closest('[data-open-gift]');
    if (g && window.CBGift) { e.preventDefault(); window.CBGift.open({ trigger: g }); }
    const add = e.target.closest('.row__add');
    if (add && window.CBBooking) { window.CBBooking.toggle(add.dataset.serviceId); }
  });
  // retour du paiement de la carte cadeau annulé
  if (/[?&]cadeau=annule/.test(location.search)) { history.replaceState(null, '', location.pathname + '#cadeau'); setTimeout(() => window.CBGift && window.CBGift.open({}), 600); }

  /* ============================================================
     9. Parallaxe douce
     ============================================================ */
  if (hasGSAP && !reduce) {
    $$('[data-parallax]').forEach(el => {
      const v = parseFloat(el.dataset.parallax) || 0;
      window.gsap.fromTo(el, { yPercent: v }, { yPercent: -v, ease: 'none', scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true } });
    });
  }

  /* ============================================================
     10. Avis : carrousel (glisser, boutons, progression)
     ============================================================ */
  const slider = $('#slider');
  if (slider) {
    const sb = $('#sliderBar'), prev = $('#sPrev'), next = $('#sNext');
    const step = () => { const c = $('.rev', slider); return c ? c.getBoundingClientRect().width + 16 : 320; };
    const upd = () => { const max = slider.scrollWidth - slider.clientWidth; sb.style.transform = `scaleX(${(max > 0 ? clamp(slider.scrollLeft / max) * .9 + .1 : 1).toFixed(3)})`; prev.disabled = slider.scrollLeft < 4; next.disabled = slider.scrollLeft > max - 4; };
    slider.addEventListener('scroll', upd, { passive: true }); addEventListener('resize', upd); upd();
    prev.addEventListener('click', () => slider.scrollBy({ left: -step() * 1.4, behavior: reduce ? 'auto' : 'smooth' }));
    next.addEventListener('click', () => slider.scrollBy({ left: step() * 1.4, behavior: reduce ? 'auto' : 'smooth' }));
    slider.addEventListener('keydown', e => { if (e.key === 'ArrowRight') { e.preventDefault(); next.click(); } if (e.key === 'ArrowLeft') { e.preventDefault(); prev.click(); } });
    // glisser à la souris
    let down = false, sx = 0, sl = 0, moved = 0;
    slider.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') return; down = true; moved = 0; sx = e.clientX; sl = slider.scrollLeft; });
    addEventListener('pointermove', e => { if (!down) return; const dx = e.clientX - sx; moved = Math.max(moved, Math.abs(dx)); if (moved > 4) { slider.classList.add('is-drag'); slider.scrollLeft = sl - dx; } });
    addEventListener('pointerup', () => { if (down) { down = false; slider.classList.remove('is-drag'); } });
  }

  /* ============================================================
     11. Horaires : ouvert / fermé en ce moment (heure de Paris)
     ============================================================ */
  const state = $('#hoursState');
  if (state) {
    const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
    const parts = () => Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Paris', hourCycle: 'h23', weekday: 'long', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date()).map(x => [x.type, x.value]));
    const EN = { Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 };
    const hm = s => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
    const lab = m => (m % 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}` : `${Math.floor(m / 60)} h`);
    const rows = Object.fromEntries($$('.hours__table tr').map(tr => [tr.dataset.day, (tr.dataset.open || '').split(',').filter(Boolean).map(x => x.split('-').map(hm))]));
    function majHoraires() {
      const p = parts(), d = EN[p.weekday], now = +p.hour * 60 + +p.minute;
      $$('.hours__table tr').forEach(tr => tr.classList.toggle('is-today', tr.dataset.day === JOURS[d]));
      const today = rows[JOURS[d]] || [];
      const cur = today.find(([o, f]) => now >= o && now < f);
      state.classList.toggle('is-open', !!cur); state.classList.toggle('is-closed', !cur);
      let txt;
      if (cur) txt = `Ouvert maintenant · ferme à ${lab(cur[1])}`;
      else {
        let found = null;
        for (let k = 0; k < 8 && !found; k++) {
          const day = JOURS[(d + k) % 7], pl = rows[day] || [];
          const nx = pl.find(([o]) => k > 0 || o > now);
          if (nx) found = { k, day, o: nx[0] };
        }
        txt = found ? `Fermé · ouvre ${found.k === 0 ? "aujourd'hui" : found.k === 1 ? 'demain' : found.day} à ${lab(found.o)}` : 'Fermé';
      }
      state.querySelector('span').textContent = txt;
    }
    majHoraires(); setInterval(majHoraires, 60000);
  }

  /* carte Google, chargée seulement au clic */
  const mapBtn = $('#mapBtn');
  if (mapBtn) mapBtn.addEventListener('click', () => {
    const box = $('#map'); const f = document.createElement('iframe');
    f.title = 'Carte : Cécile Beauté, 24 boulevard Latourette, Forcalquier'; f.loading = 'lazy'; f.referrerPolicy = 'no-referrer-when-downgrade';
    f.src = 'https://maps.google.com/maps?q=43.9585723,5.7795194&z=17&hl=fr&output=embed';
    box.appendChild(f); mapBtn.closest('.map__ph').remove();
  });

  /* ============================================================
     12. Détails : carte cadeau 3D, boutons magnétiques, curseur
     ============================================================ */
  const gc = $('#gcard');
  if (gc && finePointer && !reduce) {
    const host = gc.parentElement;
    host.addEventListener('pointermove', e => { const r = gc.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5; gc.style.transform = `perspective(900px) rotateY(${(x * 16).toFixed(2)}deg) rotateX(${(-y * 12).toFixed(2)}deg)`; });
    host.addEventListener('pointerleave', () => { gc.style.transform = ''; });
  }
  if (finePointer && !reduce && hasGSAP) {
    $$('[data-magnetic]').forEach(b => {
      const inner = b;
      b.addEventListener('pointermove', e => { const r = b.getBoundingClientRect(); const x = e.clientX - (r.left + r.width / 2), y = e.clientY - (r.top + r.height / 2); window.gsap.to(inner, { x: x * .22, y: y * .3, duration: .5, ease: 'power3.out' }); });
      b.addEventListener('pointerleave', () => window.gsap.to(inner, { x: 0, y: 0, duration: .9, ease: 'elastic.out(1,.5)' }));
    });
    // curseur
    const cur = $('#cursor'), lab = $('#cursorLabel');
    html.classList.add('has-cursor');
    const qx = window.gsap.quickTo(cur, 'x', { duration: .35, ease: 'power3.out' }), qy = window.gsap.quickTo(cur, 'y', { duration: .35, ease: 'power3.out' });
    addEventListener('pointermove', e => { qx(e.clientX); qy(e.clientY); cur.classList.remove('is-hidden'); }, { passive: true });
    document.addEventListener('pointerleave', () => cur.classList.add('is-hidden'));
    document.addEventListener('pointerover', e => {
      const t = e.target.closest && e.target.closest('[data-cursor]');
      if (t) { lab.textContent = t.dataset.cursor; cur.classList.add('is-big'); } else cur.classList.remove('is-big');
    });
  }

  addEventListener('load', () => { measure(); if (hasGSAP) window.ScrollTrigger.refresh(); requestFrame(); });
})();
