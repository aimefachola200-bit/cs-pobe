/* CS Pobè et Mon école — adaptateur du module commun « Pédagogie » (js/pedagogie.js) : programmes, guides, progressions
   annuelles, fiches de préparation, résumés, épreuves avec corrigés et planification jour / semaine / mois (contenus de
   SCOLARIS dans data/pedagogie/, chargés à la demande et gardés hors ligne).
   Notes de la circonscription ou de l'école : réglage « pedagogieNotes ». Sujets de l'examen blanc : réglage
   « examenBlancSujets », rappelés en tête de la page « Examen blanc ».
   Conception : Maître Aimé FACHE */
(function (global) {
  'use strict';
  const A = () => global.AppBridge;
  const D = () => A().data;
  const ecoleMode = () => !!(global.Config && global.Config.estEcole && global.Config.estEcole());
  const IC = (n) => (global.Icones ? global.Icones.icone(n, { taille: 16 }) + ' ' : '');
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function reglage(id) { return ((D().reglages || []).find(x => x.id === id) || {}).valeur; }
  function ecrireReglage(id, v) {
    D().reglages = D().reglages || [];
    let r = D().reglages.find(x => x.id === id); if (!r) { r = { id }; D().reglages.push(r); }
    r.valeur = v; A().saveData();
    return Promise.resolve();
  }
  function auteur() {
    if (ecoleMode()) { const e = A().ecoleDuPoste ? A().ecoleDuPoste() : null; return e ? (e.directeur || e.nom || 'Direction de l’école') : 'Direction de l’école'; }
    return 'Circonscription scolaire de Pobè';
  }
  function adaptateur() {
    const U = global.UascepCS && global.UascepCS.adaptateur;
    const ecole = ecoleMode() ? (A().ecoleDuPoste ? A().ecoleDuPoste() : null) : null;
    const liens = [{ l: 'Évaluations', route: 'evaluations', icone: 'fiche' }];
    if (!ecoleMode()) liens.unshift({ l: 'Visites et inspections', route: 'visites', icone: 'inspection' }), liens.push({ l: 'Examen blanc', route: 'examen', icone: 'stade' });
    liens.push({ l: 'Examens et concours', route: 'pvsExamens', icone: 'examen' });
    return {
      app: ecoleMode() ? 'Mon école' : 'CS Pobè', base: 'data/pedagogie/', peutAnnoter: true, auteur: auteur(),
      coursParDefaut: ecole && ecole.cycle === 'Maternelle' ? 'CI' : undefined,
      notes: { charger: () => Promise.resolve(reglage('pedagogieNotes') || {}), enregistrer: (o) => ecrireReglage('pedagogieNotes', o) },
      imprimer: U && U.imprimer ? (titre, html, o) => ((o && o.epreuve) ? global.Pedagogie.imprimerSimple(titre, html) : U.imprimer(titre, html)) : undefined,
      memo: { get: (k) => { try { return localStorage.getItem('ped.' + k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem('ped.' + k, v); } catch (e) { /* stockage indisponible */ } } },
      liens, ouvrir: (route) => A().showPage(route, document.querySelector('.menu-item[data-page="' + route + '"]')),
      examenBlanc: ecoleMode() ? undefined : { lire: () => Promise.resolve(reglage('examenBlancSujets') || null), retenir: (s) => ecrireReglage('examenBlancSujets', s) }
    };
  }

  /* ---------- page « Pédagogie » ---------- */
  global.Extra = global.Extra || { pages: {} };
  global.Extra.pages.pedagogie = function () {
    const el = document.getElementById('pedagogieModule'); if (!el) return;
    if (!global.Pedagogie) { el.textContent = 'Module indisponible : rechargez l’application.'; return; }
    global.Pedagogie.monter(el, adaptateur()).catch(e => { console.error(e); el.textContent = 'Le module n’a pas pu s’ouvrir.'; });
  };

  /* ---------- rappel des sujets retenus en tête de la page « Examen blanc » ---------- */
  function carteSujets() {
    const page = document.getElementById('examen'); if (!page || page.classList.contains('hidden')) return;
    let c = document.getElementById('pedSujetsExamen');
    if (!c) { c = document.createElement('div'); c.id = 'pedSujetsExamen'; c.className = 'card'; c.style.margin = '0 0 12px'; const t = page.querySelector('.page-title'); (t ? t.after(c) : page.prepend(c)); }
    const s = reglage('examenBlancSujets');
    c.innerHTML = '<div style="padding:10px 14px"><h3 style="margin:0 0 6px">' + IC('examen') + 'Sujets de l’examen blanc</h3>'
      + (s && s.periode ? '<p style="margin:0 0 8px"><b>' + esc(s.cours) + ' — ' + esc(s.periode_lib) + '</b> : ' + (s.disciplines || []).length + ' épreuve(s) retenue(s) dans « Pédagogie » (' + esc((s.disciplines || []).join(', ')) + ').</p>'
        : '<p style="margin:0 0 8px;color:#667085">Aucun sujet retenu : ouvrez « Pédagogie » › Épreuves (CM2) et choisissez « Retenir comme sujets de l’examen blanc ».</p>')
      + '<div style="display:flex;gap:6px;flex-wrap:wrap">'
      + (s && s.periode ? '<button class="btn btn-primary btn-sm" type="button" data-ped-eb="sujets">' + IC('imprimer') + 'Imprimer les sujets</button><button class="btn btn-sm" type="button" data-ped-eb="corriges">' + IC('valider') + 'Corrigés et grilles</button>' : '')
      + '<button class="btn btn-sm" type="button" data-ped-eb="choisir">' + IC('livres') + (s && s.periode ? 'Changer de sujets' : 'Choisir les sujets') + '</button></div></div>';
    c.querySelectorAll('[data-ped-eb]').forEach(b => b.addEventListener('click', async () => {
      const k = b.getAttribute('data-ped-eb');
      if (k === 'choisir') { try { localStorage.setItem('ped.onglet', 'epreuves'); } catch (e) { /* */ } A().showPage('pedagogie', document.querySelector('.menu-item[data-page="pedagogie"]')); return; }
      if (!global.Pedagogie || !(await global.Pedagogie.imprimerJeu(adaptateur(), s.cours, s.periode, k === 'corriges'))) alert('Sujets introuvables : ouvrez « Pédagogie » une fois connecté.');
    }));
  }
  function surveiller() {
    const page = document.getElementById('examen'); if (!page) return;
    new MutationObserver(carteSujets).observe(page, { attributes: true, attributeFilter: ['class'] });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', surveiller); else surveiller();

  global.PedagogieCS = { adaptateur, carteSujets };
})(window);
