/* République du Bénin — MEMP — CS Pobè
   Statistique officielle 2025 de la CS (salles de classe, mobilier, manuels, classes autorisées) affichée en lecture
   seule en tête des pages « Infrastructures » et « Mobilier » : pour l'école, ses propres chiffres ; pour la
   circonscription, le tableau des écoles publiques. Données agrégées, aucune donnée nominative.
   Conception : Maître Aimé FACHOLA — Tél. +229 01 96 51 03 33 */
(function (global) {
  'use strict';
  const S = () => global.POBE_STATS || { ecoles: [] };
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const norm = (s) => String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9/]+/g, ' ').trim();
  const v = (x) => (x == null ? '—' : x);
  const estEcole = () => !!(global.Config && global.Config.estEcole && global.Config.estEcole());
  const COURS = ['CI', 'CP', 'CE1', 'CE2', 'CM1', 'CM2'];
  function mesEcoles() {
    const d = global.AppBridge && global.AppBridge.data, liste = (d && d.ecoles) || [];
    const idx = new Map(S().ecoles.map(e => [norm(e.nom), e]));
    return liste.map(e => idx.get(norm(e.nom))).filter(Boolean);
  }
  function blocEcole(e) {
    const m = e.manuels || {};
    return '<h4>' + esc(e.nom) + ' — arrondissement de ' + esc(e.arr) + (e.creation ? ' · créée en ' + esc(e.creation) : '') + '</h4>'
      + '<div class="table-scroll"><table><thead><tr><th>Classes autorisées 2023-24</th><th>Classes autorisées 2024-25</th><th>Salles en matériaux définitifs</th>'
      + '<th>Provisoires</th><th>Sans mur et sans toit</th><th>Bureau / magasin</th><th>Total salles</th></tr></thead><tbody><tr>'
      + [e.classes_aut_2324, e.classes_aut_2425, e.salles.def, e.salles.prov, e.salles.sans, e.salles.bureau, e.salles.total].map(x => '<td>' + v(x) + '</td>').join('')
      + '</tr></tbody></table></div>'
      + '<div class="table-scroll"><table><thead><tr><th>Table + chaise</th><th>Table-banc 2 places</th><th>Table-banc 3 places</th><th>Total mobilier élèves</th><th>Bureau du maître + chaise</th></tr></thead><tbody><tr>'
      + [e.mobilier.t1, e.mobilier.t2, e.mobilier.t3, e.mobilier.total, e.mobilier.bureau_maitre].map(x => '<td>' + v(x) + '</td>').join('')
      + '</tr></tbody></table></div>'
      + '<div class="table-scroll"><table><thead><tr><th>Manuels</th>' + COURS.concat(['Total']).map(c => '<th>' + c + '</th>').join('') + '</tr></thead><tbody>'
      + [['Français', 'fr'], ['Mathématiques', 'ma']].map(([l, k]) => '<tr><td>' + l + '</td>'
        + COURS.concat(['TOTAL']).map(c => '<td>' + v(m[c] && m[c][k]) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>';
  }
  function blocCS() {
    const L = S().ecoles, som = (f) => L.reduce((s, e) => s + (Number(f(e)) || 0), 0);
    const lignes = L.map(e => '<tr><td>' + esc(e.nom) + '</td><td>' + esc(e.arr) + '</td>'
      + [e.classes_aut_2425, e.salles.def, e.salles.prov, e.salles.sans, e.salles.total, e.mobilier.total, e.manuels.TOTAL.fr, e.manuels.TOTAL.ma].map(x => '<td>' + v(x) + '</td>').join('') + '</tr>').join('');
    return '<div class="table-scroll"><table><thead><tr><th>École</th><th>Arrondissement</th><th>Classes autorisées 2024-25</th><th>Salles définitives</th><th>Provisoires</th><th>Sans mur / toit</th>'
      + '<th>Total salles</th><th>Mobilier élèves</th><th>Manuels français</th><th>Manuels maths</th></tr></thead><tbody>' + lignes
      + '<tr style="font-weight:700;background:#EEF4FA"><td colspan="2">Ensemble (' + L.length + ' écoles primaires publiques)</td>'
      + [som(e => e.classes_aut_2425), som(e => e.salles.def), som(e => e.salles.prov), som(e => e.salles.sans), som(e => e.salles.total), som(e => e.mobilier.total), som(e => e.manuels.TOTAL.fr), som(e => e.manuels.TOTAL.ma)].map(x => '<td>' + x + '</td>').join('')
      + '</tr></tbody></table></div>';
  }
  function carte(id) {
    const page = document.getElementById(id); if (!page) return;
    const ancien = page.querySelector('.statcs'); if (ancien) ancien.remove();
    let h;
    if (estEcole()) { const m = mesEcoles(); if (!m.length) return; h = m.map(blocEcole).join(''); }
    else h = blocCS();
    const div = document.createElement('details'); div.className = 'statcs'; div.open = estEcole();
    div.innerHTML = '<summary><b>Statistique officielle 2025 de la CS</b> (lecture seule)</summary>'
      + '<p class="xnote">Source : fichier de la CS « Statistique du personnel enseignant et des apprenants, actualisée 2025 ». '
      + 'Ces chiffres sont indicatifs : vos locaux et votre mobilier réels se saisissent dans le tableau ci-dessous.</p>' + h;
    const titre = page.querySelector('.page-title');
    if (titre && titre.nextSibling) page.insertBefore(div, titre.nextSibling); else page.appendChild(div);
  }
  /* L'ouverture d'une page passe par une fonction interne : on observe donc l'affichage de la page. */
  function surveiller() {
    ['infrastructures', 'mobilier'].forEach(id => {
      const p = document.getElementById(id); if (!p || p.dataset.statcs) return;
      p.dataset.statcs = '1';
      new MutationObserver(() => { if (!p.classList.contains('hidden') && !p.querySelector('.statcs')) { try { carte(id); } catch (e) { /* lecture seule */ } } })
        .observe(p, { attributes: true, attributeFilter: ['class'] });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', surveiller); else surveiller();
  setTimeout(surveiller, 1500);
  document.head.append(Object.assign(document.createElement('style'), { textContent: '.statcs{margin:10px 0;padding:8px 12px;background:#F4F8FC;border:1px solid #cfdcec;border-radius:6px}.statcs h4{margin:10px 0 4px;color:#1F4E79}.statcs table{font-size:12.5px}' }));
  global.StatCS = { carte, blocEcole, mesEcoles };
})(window);
