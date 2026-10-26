/* CS Pobè / Mon école — présentation commune avec SCOLARIS et GESCOL :
   menu latéral en tiroir (☰) sur téléphone et tablette, marque et version dans le menu,
   mise à jour automatique de l'application (service worker). Conception : Maître Aimé FACHE */
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

  global.Interface = { ouvrirMenu: ouvrir };
})(window);
