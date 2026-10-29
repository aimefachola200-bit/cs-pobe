/* République du Bénin — MEMP — CS Pobè — v2.4.0 : en-têtes fixes
   Les rubriques (en-têtes de colonnes) de chaque tableau restent visibles quand on fait défiler la page, pour remplir
   sans se tromper de colonne ; sur téléphone, la première colonne reste visible quand on glisse vers la droite ;
   dans un long formulaire, le titre de la partie en cours reste en haut.
   Fonctionnement : l'en-tête (<thead>) de chaque tableau suit le défilement de la page (ou de la fenêtre de saisie)
   et se cale juste sous la barre du haut tant que le tableau est à l'écran — y compris pour les tableaux placés dans
   une boîte à défilement horizontal, où un simple « position: sticky » ne fonctionne pas. Un tableau dont la 1re
   ligne n'a que des cellules <th> sans <thead> en reçoit un.
   Conception : Maître Aimé FACHOLA — Tél. +229 01 96 51 03 33 */
(function (global) {
  'use strict';
  const EXCLURE = '.no-sticky, .apercu-import, .cal-mois, svg';
  function hauteurBarres() {
    let h = 0;
    document.querySelectorAll('.barre-haut, .barre-retour').forEach(b => {
      const cs = getComputedStyle(b);
      if (cs.display !== 'none' && (cs.position === 'sticky' || cs.position === 'fixed')) h += b.offsetHeight;
    });
    document.documentElement.style.setProperty('--hauteur-barres', h + 'px');
  }
  function marquer() {
    document.querySelectorAll('table').forEach(t => {
      if (t.dataset.ef || t.closest(EXCLURE)) return;
      if (!t.tHead && t.rows.length > 1) {
        const r = t.rows[0];
        if (r.cells.length && [...r.cells].every(c => c.tagName === 'TH') && !t.querySelector('tbody tr th:not(:first-child)')) {
          const th = t.createTHead(); th.appendChild(r);
        }
      }
      t.dataset.ef = t.tHead ? '1' : '0';
      if (t.tHead) t.classList.add('ef');
    });
    caler();
  }
  /* Haut de la zone visible : barres collées de la page, ou haut de la fenêtre de saisie qui défile. */
  function hautVisible(t) {
    const m = t.closest('.modal-content');
    let h = m ? m.getBoundingClientRect().top + (parseFloat(getComputedStyle(m).paddingTop) || 0)
      : (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hauteur-barres')) || 0);
    // sous le titre de la partie de formulaire, lui-même collé en haut
    const sec = t.closest('.form-section'), h4 = sec && sec.querySelector(':scope > h4');
    if (h4 && getComputedStyle(h4).position === 'sticky') h += h4.offsetHeight;
    return h;
  }
  let enCours = false;
  function caler() {
    if (enCours) return; enCours = true;
    requestAnimationFrame(() => {
      enCours = false;
      document.querySelectorAll('table.ef').forEach(t => {
        const th = t.tHead; if (!th || !t.offsetParent) return;
        const r = t.getBoundingClientRect(), h = th.offsetHeight, haut = hautVisible(t);
        let dy = 0;
        if (r.top < haut && r.bottom > haut + h + 8) dy = Math.min(haut - r.top, r.height - h - 8);
        const v = dy > 0 ? 'translateY(' + Math.round(dy) + 'px)' : '';
        if (th.style.transform !== v) { th.style.transform = v; th.classList.toggle('ef-cale', dy > 0); }
      });
    });
  }
  let minuterie = null;
  const plus_tard = () => { clearTimeout(minuterie); minuterie = setTimeout(() => { hauteurBarres(); marquer(); }, 120); };
  function demarrer() {
    hauteurBarres(); marquer();
    addEventListener('scroll', caler, { capture: true, passive: true });
    new MutationObserver(muts => { if (muts.some(m => m.addedNodes.length)) plus_tard(); }).observe(document.body, { childList: true, subtree: true });
    addEventListener('resize', plus_tard);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer); else demarrer();
  global.EntetesFixes = { marquer, caler };
})(window);
