/* CS Pobè / Mon école — présentation commune avec SCOLARIS et GESCOL :
   menu latéral en tiroir (\uE03E) sur téléphone et tablette, marque et version dans le menu,
   mise à jour automatique de l'application (service worker). Conception : Maître Aimé FACHOLA */
(function (global) {
  'use strict';
  const lat = document.getElementById('lateral'), voile = document.getElementById('voile'), btn = document.getElementById('btnMenu');
  const etroit = () => global.matchMedia && matchMedia('(max-width: 1000px)').matches;
  function ouvrir(o) {
    if (!lat) return;
    lat.classList.toggle('ouvert', o);
    if (voile) voile.hidden = !o;
    if (btn) btn.setAttribute('aria-expanded', String(o));
    document.body.style.overflow = o && etroit() ? 'hidden' : '';
  }
  if (btn) btn.addEventListener('click', () => ouvrir(!lat.classList.contains('ouvert')));
  if (voile) voile.addEventListener('click', () => ouvrir(false));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') ouvrir(false); });
  if (lat) lat.addEventListener('click', (e) => { if (e.target.closest('.menu-item') && etroit()) ouvrir(false); });

  /* marque et version */
  const C = global.Config || {};
  const nom = document.getElementById('marqueNom'), sous = document.getElementById('marqueSous');
  if (nom) nom.textContent = C.estEcole && C.estEcole() ? 'Mon école' : 'CS Pobè';
  if (sous) sous.textContent = C.estEcole && C.estEcole() ? 'Circonscription scolaire de Pobè' : 'Circonscription scolaire · Plateau';
  document.querySelectorAll('.version-app').forEach(x => { x.textContent = C.version || '—'; });
  /* Mon école : le logo et le nom de l'école du poste dans la barre */
  function majMarque() {
    if (!(C.estEcole && C.estEcole()) || !global.AppBridge || !global.AppBridge.ecoleDuPoste) return;
    const e = global.AppBridge.ecoleDuPoste(); if (!e) return;
    const g = document.querySelector('.marque .logo-g');
    if (g && global.LogoEcole) { g.innerHTML = global.LogoEcole.svgDe(e, 34); g.classList.add('logo-ecole'); }
    if (nom) nom.textContent = e.nom;
    if (sous && e.devise) sous.textContent = e.devise;
    const t = document.getElementById('titreApplication'), st = document.getElementById('sousTitreApplication');
    if (t && global.LogoEcole) { t.innerHTML = ''; const l = document.createElement('span'); l.className = 'bh-logo-ecole'; l.innerHTML = global.LogoEcole.svgDe(e, 26); t.append(l, document.createTextNode(' ' + e.nom)); }
    if (st && e.devise) st.textContent = '« ' + e.devise + ' »';
  }
  setTimeout(majMarque, 300);

  global.Interface = { ouvrirMenu: ouvrir, majMarque };
})(window);
