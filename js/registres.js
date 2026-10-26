/* République du Bénin — MEMP — CS Pobè / Mon école
   Registres et documents de classe au format SCOLARIS / GESCOL :
   * registre d'appel du mois (demi-journées : M = matin, S = soir ; le mercredi, matin seulement) ;
   * tableau de relevés mensuels pour l'année scolaire (modèle officiel, 9 colonnes) ;
   * tableau d'affichage (liste de classe, répartition par sexe, scolarité × sexe, âge × sexe, graphiques) ;
   * statistiques et courbes : présences de la classe et de l'école, évaluations de la classe ;
   * synthèse de l'évaluation de l'école (par cours, par matière, écarts de genre, analyse).
   Chaque document porte l'en-tête officiel, la signature digitale du titulaire et du directeur, le cachet de
   l'école et un code QR de vérification (page v.html). Impression / PDF et Excel (.xlsx).
   Conception : Maître Aimé FACHE — Tél. 01 96 51 03 33 */
(function (global) {
  'use strict';
  const A = () => global.AppBridge, D = () => A().data, V = () => global.Evaluations, P = () => global.Pieces;
  const esc = (v) => String(v === null || v === undefined ? '' : v).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const JC = ['Di', 'Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa'];
  const MOIS_SCOLAIRES = [[0, 9], [0, 10], [0, 11], [0, 12], [1, 1], [1, 2], [1, 3], [1, 4], [1, 5], [1, 6]];
  const LIB_RELEVE = { 9: 'SEPT.', 10: 'OCT.', 11: 'NOV.', 12: 'DÉC.', 1: 'JAN.', 2: 'FÉV.', 3: 'MARS', 4: 'AVRIL', 5: 'MAI', 6: 'JUIN' };
  const COLONNES_RELEVE = [
    ['dj', 'NOMBRE des demi-jours de classe du mois'], ['eff', 'TOTAL des élèves qui ont fréquenté la classe pendant le mois'],
    ['poss', 'TOTAL des présences possibles par demi-jours de classe'], ['abs', 'TOTAL des absences du mois'],
    ['effe', 'TOTAL des présences effectives'], ['pct', 'POURCENTAGE des présences effectives dans le mois'],
    ['n4', "NOMBRE d'élèves n'ayant jamais manqué la classe ou n'ayant pas manqué plus de 4 fois"],
    ['n5', "NOMBRE d'élèves ayant manqué plus de 4 fois"], ['imp', 'TOTAL des absences imputables aux élèves de la colonne précédente']];
  const COUL_F = '#C2185B', COUL_G = '#1F4E79', COUL_T = '#1B7F3B';
  const nb = (v) => (v === null || v === undefined || v === '' ? '—' : String(Math.round(v * 10) / 10).replace('.', ','));
  const pct = (a, b) => (b ? Math.round(a / b * 1000) / 10 : null);
  const pctTxt = (v) => (v === null ? '—' : nb(v) + ' %');
  const etat = { ecole: '', cours: '', mois: '', periode: '', onglet: 'registre' };

  /* ---------------- données ---------------- */
  const ecoles = () => D().ecoles.slice().sort((a, b) => String(a.nom).localeCompare(String(b.nom), 'fr'));
  const ecoleDe = (id) => D().ecoles.find(e => String(e.id) === String(id));
  const estMaternelle = (e) => String((e && e.type) || '').indexOf('EM') === 0;
  const coursDe = (e) => (estMaternelle(e) ? ['Petits', 'Grands'] : V().COURS.slice());
  const nomC = (a) => A().nomComplet(a);
  const eleves = (ecoleId, cours) => D().apprenants.filter(a => String(a.ecoleId) === String(ecoleId) && (!cours || a.cours === cours))
    .sort((x, y) => nomC(x).localeCompare(nomC(y), 'fr'));
  const sexeF = (a) => /^f/i.test(a.sexe || '');
  function titulaire(ecoleId, cours) {
    const at = A().attributionDe(ecoleId, cours);
    return D().personnel.find(x => String(x.id) === String(at.enseignantId)) || null;
  }
  const annee = () => A().anneeActive();
  const an1 = () => parseInt(String(annee()).slice(0, 4), 10) || new Date().getFullYear();
  const isoJ = (d) => global.Calendrier.iso(d);
  const ferie = () => D().joursFeries || [];

  /** Demi-journées de classe d'une date : 2 du lundi au vendredi, 1 le mercredi (matin), 0 sinon. */
  function demi(dateIso, recs) {
    const r = recs && recs[dateIso];
    const base = global.Calendrier.estJourEcole(dateIso, ferie()) ? (new Date(dateIso + 'T12:00').getDay() === 3 ? 1 : 2) : 0;
    if (!r) return base;
    const n = (r.absentsApresMidi || []).length ? 2 : Math.max(base, 1);   // jour saisi (rattrapage compris)
    return Math.max(base, n);
  }
  function enregistrements(ecoleId, cours, prefixe) {
    const m = {};
    D().presencesApprenants.filter(r => String(r.ecoleId) === String(ecoleId) && r.cours === cours && String(r.date || '').indexOf(prefixe) === 0)
      .forEach(r => { m[r.date] = r; });
    return m;
  }
  function joursDuMois(y, mo, recs) {
    const dernier = new Date(y, mo, 0).getDate(), out = [];
    for (let j = 1; j <= dernier; j++) { const d = isoJ(new Date(y, mo - 1, j)), n = demi(d, recs); if (n > 0) out.push([d, n]); }
    return out;
  }

  /* ---------------- pièces du document ---------------- */
  function entete(ecole, titre, sousTitre) {
    return A().enteteDocument({ etablissement: ecole ? ecole.nom : '' })
      + '<h2 class="rg-titre">' + esc(titre) + '</h2>' + (sousTitre ? '<div class="rg-sous">' + esc(sousTitre) + '</div>' : '');
  }
  function infos(paires) {
    return '<table class="rg-infos"><tbody><tr>' + paires.map(([k, v]) => '<td><span>' + esc(k) + '</span><b>' + esc(v === undefined || v === null || v === '' ? '—' : v) + '</b></td>').join('') + '</tr></tbody></table>';
  }
  /** Pied commun : code QR de vérification, signature du titulaire, signature du directeur avec le cachet. */
  function pied(ecole, cours, type, cle, resume, options) {
    options = options || {};
    const p = P(), numero = p.numeroDocument(type, cle), lien = p.lienVerification(numero, resume);
    const porteur = ecole ? A().porteurEcole(ecole) : {};
    const tit = cours && ecole ? titulaire(ecole.id, cours) : null;
    const libTit = tit && sexeF(tit) ? 'La titulaire' : 'Le titulaire';
    const libDir = /^(mme|madame)/i.test(String((ecole && ecole.directeur) || '')) ? 'La Directrice' : 'Le Directeur';
    return '<div class="rg-pied">'
      + '<div class="rg-verif">' + p.qr(lien, 88) + '<div class="petit muet">Document n° <b>' + esc(numero) + '</b><br>'
      + 'Empreinte ' + esc(p.empreinte(resume + '|' + cle)) + '<br>Scannez le code pour vérifier</div></div>'
      + (options.sansTitulaire ? '' : '<div class="rg-sig">' + p.blocSignature(tit ? { nom: tit.nom, signature_image: tit.signature_image } : null, libTit) + '</div>')
      + '<div class="rg-dir"><div class="rg-cachet">' + p.cachet(porteur, { taille: 92 }) + '</div>'
      + '<div class="rg-sig">' + p.blocSignature({ nom: (ecole && (ecole.cachet_nom || ecole.directeur)) || '', signature_image: ecole && ecole.signature_image }, options.libDir || libDir) + '</div></div>'
      + '</div>';
  }
  function legendeDate() {
    const e = ecoleDe(etat.ecole);
    return '<p class="rg-lieu">' + esc((e && (e.commune || e.arrondissement)) || 'Pobè') + ', le ' + new Date().toLocaleDateString('fr-FR') + '</p>';
  }
  /** Ouvre le document dans la fenêtre : boutons Imprimer / PDF et Excel. */
  function ouvrir(titre, corps, nomFichier, paysage) {
    A().openModal(titre, '<div class="xbar no-print rg-barre"><button class="btn btn-primary" type="button" id="rgImprimer">🖨️ Imprimer / PDF</button> '
      + '<button class="btn btn-info" type="button" id="rgExcel">📊 Excel</button></div>'
      + '<div class="page-a4 rg-doc' + (paysage ? ' rg-paysage' : '') + '" id="rgDoc">' + corps + '</div>');
    document.getElementById('rgImprimer').onclick = () => {
      document.body.classList.toggle('rg-impression-paysage', !!paysage);
      document.body.classList.add('bilan-print');   // le document porte déjà son en-tête officiel
      window.print();
      setTimeout(() => document.body.classList.remove('rg-impression-paysage', 'bilan-print'), 1500);
    };
    document.getElementById('rgExcel').onclick = () => {
      const doc = document.getElementById('rgDoc').cloneNode(true);
      doc.querySelectorAll('.entete-officiel, .rg-pied, svg, .no-print').forEach(x => x.remove());
      // bloc d'informations : rubriques sur une ligne, valeurs sur la suivante (deux lignes du classeur)
      doc.querySelectorAll('table.rg-infos').forEach(t => {
        const cases = [...t.querySelectorAll('td')];
        t.innerHTML = '<thead><tr>' + cases.map(c => '<th>' + esc((c.querySelector('span') || {}).textContent || '') + '</th>').join('') + '</tr></thead>'
          + '<tbody><tr>' + cases.map(c => '<td>' + esc((c.querySelector('b') || {}).textContent || '') + '</td>').join('') + '</tr></tbody>';
      });
      A().telecharger(nomFichier + '.xlsx', global.XlsxEcrire.depuisHtmlBlob('<h3>RÉPUBLIQUE DU BÉNIN — MEMP — ' + esc((ecoleDe(etat.ecole) || {}).nom || '') + '</h3>' + doc.innerHTML, titre.slice(0, 30)),
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    };
  }
  const fichier = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '');
  function exiger() {
    const e = ecoleDe(etat.ecole);
    if (!e || !etat.cours) { alert('Choisissez l’école et le cours.'); return null; }
    return e;
  }

  /* ---------------- 1. registre d'appel du mois ---------------- */
  function registre() {
    const e = exiger(); if (!e) return;
    const [y, mo] = (etat.mois || isoJ(new Date()).slice(0, 7)).split('-').map(Number);
    const pref = y + '-' + String(mo).padStart(2, '0');
    const recs = enregistrements(e.id, etat.cours, pref), jours = joursDuMois(y, mo, recs), liste = eleves(e.id, etat.cours);
    const tit = titulaire(e.id, etat.cours);
    if (!liste.length) { alert('Aucun apprenant dans ce cours : complétez la liste des apprenants.'); return; }
    let h1 = '<tr><th rowspan="2">N°</th><th rowspan="2" class="rg-nom">Nom et prénoms</th>', h2 = '<tr>';
    jours.forEach(([d, n]) => {
      const dt = new Date(d + 'T12:00');
      h1 += '<th colspan="' + n + '"' + (recs[d] ? '' : ' class="rg-nonsaisi"') + '>' + JC[dt.getDay()] + ' ' + dt.getDate() + '</th>';
      h2 += ['M', 'S'].slice(0, n).map(x => '<th' + (recs[d] ? '' : ' class="rg-nonsaisi"') + '>' + x + '</th>').join('');
    });
    h1 += '<th rowspan="2">Abs.</th></tr>'; h2 += '</tr>';
    const totCol = []; let totGen = 0;
    const corps = liste.map((a, i) => {
      let t = 0, k = 0;
      const cells = jours.map(([d, n]) => {
        const r = recs[d]; let s = '';
        for (let dm = 0; dm < n; dm++) {
          const abs = r ? ((dm === 0 ? r.absentsMatin : r.absentsApresMidi) || []).map(String).indexOf(String(a.id)) >= 0 : false;
          totCol[k] = (totCol[k] || 0) + (abs ? 1 : 0); t += abs ? 1 : 0; k++;
          s += '<td class="' + (r ? '' : 'rg-nonsaisi') + '">' + (abs ? '<b class="rg-a">A</b>' : '') + '</td>';
        }
        return s;
      }).join('');
      totGen += t;
      return '<tr><td>' + (i + 1) + '</td><td class="rg-nom">' + esc(nomC(a)) + '</td>' + cells + '<td><b>' + (t || '') + '</b></td></tr>';
    }).join('');
    const nbDemi = jours.reduce((s, [, n]) => s + n, 0);
    const pied2 = '<tr class="tot"><td></td><td class="rg-nom">Absents</td>' + totCol.map(v => '<td>' + (v || '') + '</td>').join('') + '<td>' + totGen + '</td></tr>';
    const libMois = MOIS[mo - 1].charAt(0).toUpperCase() + MOIS[mo - 1].slice(1) + ' ' + y;
    const corpsDoc = entete(e, 'REGISTRE DE PRÉSENCE', libMois + ' — Année scolaire ' + annee() + ' — A = absent(e), case vide = présent(e) ; M = matin, S = soir (après-midi)')
      + infos([['DDEMP', 'Plateau'], ['CS', 'Pobè'], ['École', e.nom], ['Cours', etat.cours], ['Titulaire', tit ? tit.nom : ''], ['Effectif', liste.length],
        ['Demi-journées', nbDemi], ['Absences du mois', totGen], ['Année scolaire', annee()]])
      + '<div class="rg-scroll"><table class="rg-tab rg-registre"><thead>' + h1 + h2 + '</thead><tbody>' + corps + pied2 + '</tbody></table></div>'
      + (jours.some(([d]) => !recs[d]) ? '<p class="petit muet">Colonnes grisées : jour de classe dont l’appel n’a pas été saisi.</p>' : '')
      + legendeDate() + pied(e, etat.cours, 'REGISTRE', e.id + '-' + etat.cours + '-' + pref, 'Registre ' + etat.cours + ' ' + pref + ' ' + e.nom);
    ouvrir('Registre de présence — ' + etat.cours + ' — ' + libMois, corpsDoc, 'Registre_presence_' + fichier(e.nom + '_' + etat.cours + '_' + pref), true);
  }

  /* ---------------- 2. relevés mensuels de l'année ---------------- */
  function releveCalcul(e, cours) {
    const liste = eleves(e.id, cours), y0 = an1(), out = [];
    MOIS_SCOLAIRES.forEach(([dec, mo]) => {
      const y = y0 + dec, pref = y + '-' + String(mo).padStart(2, '0');
      const recs = enregistrements(e.id, cours, pref), jours = joursDuMois(y, mo, recs);
      const dj = jours.reduce((s, [, n]) => s + n, 0), saisis = Object.keys(recs).length;
      if (!saisis) { out.push({ lib: LIB_RELEVE[mo], v: dj ? { dj, eff: liste.length, poss: dj * liste.length } : null, saisi: false }); return; }
      const b = global.Presences.bilanPeriodeApprenants(liste, Object.values(recs));
      const poss = dj * liste.length, abs = b.totalAbsences;
      out.push({ lib: LIB_RELEVE[mo], saisi: true, v: { dj, eff: liste.length, poss, abs, effe: Math.max(0, poss - abs), pct: pct(Math.max(0, poss - abs), poss),
        n4: b.effectifGroupePeu, n5: b.effectifGroupePlus, imp: b.absencesGroupePlus } });
    });
    const tot = {}, moy = {}, faits = out.filter(l => l.saisi);
    COLONNES_RELEVE.forEach(([c]) => { tot[c] = faits.reduce((s, l) => s + (l.v[c] || 0), 0); moy[c] = faits.length ? tot[c] / faits.length : null; });
    tot.pct = pct(tot.effe, tot.poss);
    return { lignes: out, tot, moy, faits: faits.length, effectif: liste.length };
  }
  function releve() {
    const e = exiger(); if (!e) return;
    const r = releveCalcul(e, etat.cours), tit = titulaire(e.id, etat.cours);
    const fmt = (v, c) => (v === undefined || v === null ? '—' : c === 'pct' ? pctTxt(v) : nb(v));
    const corps = entete(e, "TABLEAU DE RELEVÉS MENSUELS POUR L'ANNÉE SCOLAIRE", 'Année scolaire : ' + annee())
      + infos([['DDEMP', 'Plateau'], ['CS', 'Pobè'], ['École', e.nom], ['Cours', etat.cours], ['Titulaire', tit ? tit.nom : ''], ['Année', annee()]])
      + '<div class="rg-scroll"><table class="rg-tab rg-releve"><thead><tr><th>Mois</th>' + COLONNES_RELEVE.map(([, l], i) => '<th>(' + (i + 1) + ')<br>' + esc(l) + '</th>').join('') + '</tr></thead><tbody>'
      + r.lignes.map(l => '<tr><td><b>' + l.lib + '</b></td>' + COLONNES_RELEVE.map(([c]) => '<td' + (c === 'pct' ? ' class="rg-pct"' : '') + '>'
        + (l.v ? (l.saisi || ['dj', 'eff', 'poss'].indexOf(c) >= 0 ? fmt(l.v[c], c) : '—') : '—') + '</td>').join('') + '</tr>').join('')
      + '<tr class="tot"><td>TOTAL</td>' + COLONNES_RELEVE.map(([c]) => '<td>' + (r.faits ? fmt(r.tot[c], c) : '—') + '</td>').join('') + '</tr>'
      + '<tr class="tot"><td>MOYENNE GÉN.</td>' + COLONNES_RELEVE.map(([c]) => '<td>' + (c === 'pct' || !r.faits ? '—' : nb(r.moy[c])) + '</td>').join('') + '</tr>'
      + '</tbody></table></div>'
      + '<p class="petit muet">Présences possibles = demi-jours de classe × élèves ayant fréquenté la classe ; présences effectives = présences possibles − absences ; '
      + 'pourcentage = présences effectives / présences possibles × 100. Moyenne générale = total / nombre de mois renseignés (' + r.faits + ').</p>'
      + legendeDate() + pied(e, etat.cours, 'RELEVEMENS', e.id + '-' + etat.cours + '-' + annee(), 'Releve mensuel ' + etat.cours + ' ' + annee() + ' ' + e.nom);
    ouvrir('Relevés mensuels — ' + etat.cours + ' — ' + annee(), corps, 'Releves_mensuels_' + fichier(e.nom + '_' + etat.cours + '_' + annee()), true);
  }

  /* ---------------- 3. tableau d'affichage ---------------- */
  const RANG = { CI: 1, CP: 2, CE1: 3, CE2: 4, CM1: 5, CM2: 6, Petits: 1, Grands: 2 };
  function ageAu(dn, ref) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dn || ''); if (!m) return null;
    const d = new Date(+m[1], +m[2] - 1, +m[3]); if (d > ref) return null;
    return ref.getFullYear() - d.getFullYear() - ((ref.getMonth() < d.getMonth() || (ref.getMonth() === d.getMonth() && ref.getDate() < d.getDate())) ? 1 : 0);
  }
  const scolariteDe = (a) => (a.scolarite !== undefined && a.scolarite !== '' ? Number(a.scolarite) : (RANG[a.cours] || 0) + (a.redoublant === 'Oui' ? 1 : 0) || null);
  function repartition(liste, cle) {
    const m = new Map();
    liste.forEach(a => { const v = cle(a), k = v === null || v === undefined || isNaN(v) ? 'Non renseigné' : v; const x = m.get(k) || { lib: k, f: 0, g: 0 }; sexeF(a) ? x.f++ : x.g++; m.set(k, x); });
    const rows = [...m.values()].sort((a, b) => (typeof a.lib === 'number' ? a.lib : 999) - (typeof b.lib === 'number' ? b.lib : 999));
    const T = liste.length; rows.forEach(r => { r.t = r.f + r.g; r.pct = pct(r.t, T); });
    return { rows, tot: { f: rows.reduce((s, r) => s + r.f, 0), g: rows.reduce((s, r) => s + r.g, 0), t: T, pct: T ? 100 : null } };
  }
  function miniTab(titre, rep, lib, unite) {
    return '<div class="rg-mini"><h4>' + esc(titre) + '</h4><table class="rg-tab"><thead><tr><th>' + esc(lib) + '</th><th>F</th><th>G</th><th>Total</th><th>%</th></tr></thead><tbody>'
      + rep.rows.map(r => '<tr><td>' + esc(r.lib) + (typeof r.lib === 'number' ? esc(unite) : '') + '</td><td>' + r.f + '</td><td>' + r.g + '</td><td>' + r.t + '</td><td>' + pctTxt(r.pct) + '</td></tr>').join('')
      + '<tr class="tot"><td>TOTAL</td><td>' + rep.tot.f + '</td><td>' + rep.tot.g + '</td><td>' + rep.tot.t + '</td><td>' + pctTxt(rep.tot.pct) + '</td></tr></tbody></table>'
      + (rep.rows.length ? global.Graphiques.svgType('barres', { titre: titre.replace('RÉCAPITULATIF : ', ''), labels: rep.rows.map(r => String(r.lib) + (typeof r.lib === 'number' ? unite : '')),
        series: [{ nom: 'Filles', values: rep.rows.map(r => r.f), color: COUL_F }, { nom: 'Garçons', values: rep.rows.map(r => r.g), color: COUL_G }], w: 460, h: 250 }) : '') + '</div>';
  }
  function affichageDonnees(e, cours) {
    const liste = eleves(e.id, cours), ref = new Date(an1(), 11, 31);
    const lignes = liste.map(a => ({ a, age: ageAu(a.dateNaiss, ref), sc: scolariteDe(a) }));
    const f = liste.filter(sexeF).length;
    return { liste, lignes, rep: { f, g: liste.length - f, t: liste.length }, sco: repartition(liste, scolariteDe), ages: repartition(liste, a => ageAu(a.dateNaiss, ref)) };
  }
  function affichageDoc() {
    const e = exiger(); if (!e) return;
    const d = affichageDonnees(e, etat.cours), tit = titulaire(e.id, etat.cours);
    const corps = entete(e, "LISTE DES ÉLÈVES — TABLEAU D'AFFICHAGE", 'Année scolaire ' + annee() + ' — Âge calculé au 31/12/' + an1())
      + infos([['Cours', etat.cours], ['Titulaire', tit ? tit.nom : ''], ['Directeur', e.directeur || ''], ['Effectif', d.rep.t + ' (F : ' + d.rep.f + ' – G : ' + d.rep.g + ')'], ['Année', annee()]])
      + '<table class="rg-tab rg-liste"><thead><tr><th>N°</th><th>Nom</th><th>Prénoms</th><th>Sexe</th><th>Âge</th><th>Scolarité</th><th>Contact parents</th></tr></thead><tbody>'
      + (d.lignes.length ? d.lignes.map((l, i) => '<tr><td>' + (i + 1) + '</td><td class="rg-nom">' + esc(String(l.a.nom || '').toUpperCase()) + '</td><td class="rg-nom">' + esc(l.a.prenoms || '')
        + '</td><td>' + esc(sexeF(l.a) ? 'F' : 'G') + '</td><td>' + (l.age === null ? '' : l.age) + '</td><td>' + (l.sc || '') + '</td><td>' + esc(l.a.telParent || '') + '</td></tr>').join('')
        : '<tr><td colspan="7">Aucun élève inscrit dans cette classe.</td></tr>') + '</tbody></table>'
      + '<h4 class="rg-h4">RÉPARTITION PAR SEXE</h4><table class="rg-tab rg-rep"><thead><tr><th></th><th>Filles</th><th>Garçons</th><th>Total</th></tr></thead><tbody>'
      + '<tr><td>Effectif</td><td>' + d.rep.f + '</td><td>' + d.rep.g + '</td><td>' + d.rep.t + '</td></tr>'
      + '<tr><td>Pourcentage</td><td>' + pctTxt(pct(d.rep.f, d.rep.t)) + '</td><td>' + pctTxt(pct(d.rep.g, d.rep.t)) + '</td><td>' + (d.rep.t ? '100 %' : '0 %') + '</td></tr></tbody></table>'
      + '<div class="rg-deux">' + miniTab('RÉCAPITULATIF : SCOLARITÉ PAR SEXE', d.sco, 'Scolarité (ans)', ' an(s)') + miniTab('RÉCAPITULATIF : ÂGE PAR SEXE (au 31/12/' + an1() + ')', d.ages, 'Âge', ' ans') + '</div>'
      + '<p class="petit muet">Scolarité : nombre d’années de scolarité de l’élève. Âge : âge révolu au 31/12/' + an1() + '.</p>'
      + legendeDate() + pied(e, etat.cours, 'AFFICHAGE', e.id + '-' + etat.cours + '-' + annee(), 'Affichage ' + etat.cours + ' ' + annee() + ' ' + e.nom);
    ouvrir("Tableau d'affichage — " + etat.cours, corps, 'Tableau_affichage_' + fichier(e.nom + '_' + etat.cours));
  }

  /* ---------------- 4. statistiques et courbes : présences ---------------- */
  function statsPresenceCalc(e, cours) {
    const liste = eleves(e.id, cours), y0 = an1();
    return MOIS_SCOLAIRES.map(([dec, mo]) => {
      const y = y0 + dec, pref = y + '-' + String(mo).padStart(2, '0'), recs = Object.values(enregistrements(e.id, cours, pref));
      if (!recs.length) return { lib: LIB_RELEVE[mo], taux: null, tf: null, tg: null, abs: null, af: null, ag: null };
      const fil = liste.filter(sexeF), gar = liste.filter(a => !sexeF(a));
      const b = global.Presences.bilanPeriodeApprenants(liste, recs), bf = global.Presences.bilanPeriodeApprenants(fil, recs), bg = global.Presences.bilanPeriodeApprenants(gar, recs);
      return { lib: LIB_RELEVE[mo], taux: b.tauxPresence, tf: fil.length ? bf.tauxPresence : null, tg: gar.length ? bg.tauxPresence : null, abs: b.totalAbsences, af: bf.totalAbsences, ag: bg.totalAbsences };
    });
  }
  function statsPresence() {
    const e = exiger(); if (!e) return;
    const s = statsPresenceCalc(e, etat.cours), liste = eleves(e.id, etat.cours);
    const recsAn = D().presencesApprenants.filter(r => String(r.ecoleId) === String(e.id) && r.cours === etat.cours && r.annee === annee());
    const b = global.Presences.bilanPeriodeApprenants(liste, recsAn);
    const ecoleRows = coursDe(e).map(c => {
      const l = eleves(e.id, c), rec = D().presencesApprenants.filter(r => String(r.ecoleId) === String(e.id) && r.cours === c && r.annee === annee());
      const bb = global.Presences.bilanPeriodeApprenants(l, rec); return { c, eff: l.length, j: bb.joursSaisis, taux: bb.tauxPresence, abs: bb.totalAbsences, plus4: bb.effectifGroupePlus };
    });
    const corps = entete(e, 'STATISTIQUES DE PRÉSENCE', etat.cours + ' — Année scolaire ' + annee())
      + infos([['Cours', etat.cours], ['Effectif', liste.length], ['Jours saisis', b.joursSaisis], ['Taux annuel', pctTxt(b.tauxPresence)], ['Absences (demi-j.)', b.totalAbsences], ['Plus de 4 absences', b.effectifGroupePlus]])
      + '<table class="rg-tab"><thead><tr><th>Mois</th><th>Taux de présence</th><th>Taux filles</th><th>Taux garçons</th><th>Absences (demi-j.)</th><th>Absences F</th><th>Absences G</th></tr></thead><tbody>'
      + s.map(r => '<tr><td><b>' + r.lib + '</b></td><td>' + pctTxt(r.taux) + '</td><td>' + pctTxt(r.tf) + '</td><td>' + pctTxt(r.tg) + '</td><td>' + nb(r.abs) + '</td><td>' + nb(r.af) + '</td><td>' + nb(r.ag) + '</td></tr>').join('') + '</tbody></table>'
      + global.Graphiques.svgType('ligne', { titre: 'Taux de présence par mois (%)', sousTitre: e.nom + ' — ' + etat.cours, labels: s.map(r => r.lib),
        series: [{ nom: 'Ensemble', values: s.map(r => r.taux), color: COUL_T }, { nom: 'Filles', values: s.map(r => r.tf), color: COUL_F }, { nom: 'Garçons', values: s.map(r => r.tg), color: COUL_G }] })
      + global.Graphiques.svgType('barres', { titre: 'Absences par mois (demi-journées)', labels: s.map(r => r.lib),
        series: [{ nom: 'Filles', values: s.map(r => r.af), color: COUL_F }, { nom: 'Garçons', values: s.map(r => r.ag), color: COUL_G }] })
      + '<h4 class="rg-h4">ÉCOLE : PRÉSENCES PAR COURS (année)</h4><table class="rg-tab"><thead><tr><th>Cours</th><th>Effectif</th><th>Jours saisis</th><th>Taux de présence</th><th>Absences (demi-j.)</th><th>Élèves &gt; 4 absences</th></tr></thead><tbody>'
      + ecoleRows.map(r => '<tr><td><b>' + r.c + '</b></td><td>' + r.eff + '</td><td>' + r.j + '</td><td>' + pctTxt(r.taux) + '</td><td>' + r.abs + '</td><td>' + r.plus4 + '</td></tr>').join('') + '</tbody></table>'
      + (b.plusDeQuatreAbsences && b.plusDeQuatreAbsences.length ? '<p><b>À suivre :</b> ' + b.plusDeQuatreAbsences.map(x => esc(nomC(x.apprenant)) + ' (' + x.absences + ')').join(', ') + '.</p>' : '')
      + legendeDate() + pied(e, etat.cours, 'STATPRES', e.id + '-' + etat.cours + '-' + annee(), 'Statistiques presence ' + etat.cours + ' ' + annee() + ' ' + e.nom);
    ouvrir('Statistiques de présence — ' + etat.cours, corps, 'Statistiques_presence_' + fichier(e.nom + '_' + etat.cours));
  }

  /* ---------------- 5. évaluations : statistiques et courbes de la classe ---------------- */
  const cleP = (p) => A().clePeriode(p);
  function resultatsPeriode(liste, cle) {
    return liste.map(a => {
      const f = D().notes.find(n => String(n.apprenantId) === String(a.id) && n.periode === cle && n.annee === annee()) || {};
      return Object.assign({ a, f }, V().resultat(f));
    });
  }
  function statClasse(liste, cle) {
    const r = resultatsPeriode(liste, cle), g = (pred) => {
      const s = r.filter(x => pred(x.a)), c = s.filter(x => x.aCompose), ad = c.filter(x => x.admis);
      return { i: s.length, c: c.length, r: ad.length, t: pct(ad.length, c.length), moy: c.length ? Math.round(c.reduce((t, x) => t + (x.moyenne || 0), 0) / c.length * 100) / 100 : null };
    };
    return { r, f: g(sexeF), gg: g(a => !sexeF(a)), t: g(() => true) };
  }
  function statsEval() {
    const e = exiger(); if (!e) return;
    const liste = eleves(e.id, etat.cours), periodes = V().periodesDe(etat.cours), cle = etat.periode || cleP(periodes[0]);
    const parP = periodes.map(p => ({ p, s: statClasse(liste, cleP(p)) }));
    const cour = statClasse(liste, cle), per = periodes.find(p => cleP(p) === cle) || periodes[0];
    const mat = V().MATIERES.map((m, i) => {
      const notes = cour.r.map(x => ({ n: x.notes[i], f: sexeF(x.a) })).filter(x => x.n !== null);
      const mf = notes.filter(x => x.f && x.n >= V().SEUIL_MATIERE).length, mg = notes.filter(x => !x.f && x.n >= V().SEUIL_MATIERE).length;
      return { m, c: notes.length, max: mf + mg, mf, mg, taux: pct(mf + mg, notes.length), moy: notes.length ? Math.round(notes.reduce((s, x) => s + x.n, 0) / notes.length * 100) / 100 : null };
    });
    const corps = entete(e, 'STATISTIQUES DES ÉVALUATIONS', etat.cours + ' — ' + V().libellePeriode(per) + ' — Année scolaire ' + annee())
      + infos([['Cours', etat.cours], ['Inscrits', cour.t.i], ['Ont composé', cour.t.c], ['Ont atteint le seuil', cour.t.r], ['Taux de réussite', pctTxt(cour.t.t)], ['Moyenne de la classe', cour.t.moy === null ? '—' : nb(cour.t.moy) + '/20']])
      + '<h4 class="rg-h4">ÉVOLUTION SUR L’ANNÉE</h4><table class="rg-tab"><thead><tr><th>Évaluation</th><th>Ont composé</th><th>Seuil atteint G</th><th>Seuil atteint F</th><th>Seuil atteint T</th><th>Taux G</th><th>Taux F</th><th>Taux T</th><th>Moyenne</th></tr></thead><tbody>'
      + parP.map(x => '<tr><td>' + esc(V().libellePeriode(x.p)) + '</td><td>' + x.s.t.c + '</td><td>' + x.s.gg.r + '</td><td>' + x.s.f.r + '</td><td>' + x.s.t.r + '</td><td>' + pctTxt(x.s.gg.t) + '</td><td>' + pctTxt(x.s.f.t) + '</td><td>' + pctTxt(x.s.t.t) + '</td><td>' + (x.s.t.moy === null ? '—' : nb(x.s.t.moy)) + '</td></tr>').join('') + '</tbody></table>'
      + global.Graphiques.svgType('ligne', { titre: 'Taux de réussite au seuil (%)', sousTitre: e.nom + ' — ' + etat.cours, labels: parP.map(x => (x.p.type === 'SOMMATIVE' ? 'S' : 'F') + x.p.numero + ' ' + x.p.mois.slice(0, 3)),
        series: [{ nom: 'Ensemble', values: parP.map(x => x.s.t.t), color: COUL_T }, { nom: 'Filles', values: parP.map(x => x.s.f.t), color: COUL_F }, { nom: 'Garçons', values: parP.map(x => x.s.gg.t), color: COUL_G }] })
      + '<h4 class="rg-h4">RÉSULTATS PAR MATIÈRE — ' + esc(V().libellePeriode(per).toUpperCase()) + '</h4><table class="rg-tab"><thead><tr><th>Matière</th><th>Ont composé</th><th>Maîtrise (≥ ' + V().SEUIL_MATIERE + ') G</th><th>F</th><th>T</th><th>% de réussite</th><th>Moyenne</th><th>À renforcer</th></tr></thead><tbody>'
      + mat.map(x => '<tr><td class="rg-nom">' + esc(x.m.libelle) + '</td><td>' + x.c + '</td><td>' + x.mg + '</td><td>' + x.mf + '</td><td>' + x.max + '</td><td>' + pctTxt(x.taux) + '</td><td>' + (x.moy === null ? '—' : nb(x.moy)) + '</td><td>' + (x.taux !== null && x.taux < 50 ? 'OUI' : '') + '</td></tr>').join('') + '</tbody></table>'
      + global.Graphiques.svgType('barres', { titre: '% de réussite par matière', labels: mat.map(x => x.m.abrege), series: [{ nom: '% de réussite', values: mat.map(x => x.taux), color: COUL_G }] })
      + legendeDate() + pied(e, etat.cours, 'STATEVAL', e.id + '-' + etat.cours + '-' + cle + '-' + annee(), 'Statistiques evaluation ' + etat.cours + ' ' + cle + ' ' + e.nom);
    ouvrir('Statistiques des évaluations — ' + etat.cours, corps, 'Statistiques_evaluations_' + fichier(e.nom + '_' + etat.cours + '_' + cle));
  }

  /* ---------------- 6. synthèse de l'évaluation (école) ---------------- */
  function synthese() {
    const e = ecoleDe(etat.ecole); if (!e) { alert('Choisissez l’école.'); return; }
    const per = V().PERIODES.find(p => cleP(p) === etat.periode) || V().PERIODES[0], cle = cleP(per);
    const niveaux = coursDe(e).filter(c => V().COURS.indexOf(c) >= 0).map(c => {
      const liste = eleves(e.id, c), concerne = V().concerne(c, per), s = statClasse(liste, cle);
      const ren = V().MATIERES.filter((m, i) => { const n = s.r.map(x => x.notes[i]).filter(v => v !== null); return n.length && pct(n.filter(v => v >= V().SEUIL_MATIERE).length, n.length) < 50; }).map(m => m.abrege);
      const t = s.t.t, obs = !concerne ? 'Ne compose pas' : !s.t.c ? 'Non saisi' : t >= 75 ? 'Satisfaisant' : t >= 50 ? 'Acceptable' : 'À renforcer';
      return { c, s, ren, obs, concerne };
    });
    const T = { i: [0, 0], c: [0, 0], r: [0, 0] };
    niveaux.forEach(n => { T.i[0] += n.s.gg.i; T.i[1] += n.s.f.i; T.c[0] += n.s.gg.c; T.c[1] += n.s.f.c; T.r[0] += n.s.gg.r; T.r[1] += n.s.f.r; });
    const gft = (a) => '<td>' + a[0] + '</td><td>' + a[1] + '</td><td><b>' + (a[0] + a[1]) + '</b></td>';
    const lignes = niveaux.map(n => '<tr><td><b>' + n.c + '</b></td>' + gft([n.s.gg.i, n.s.f.i]) + gft([n.s.gg.c, n.s.f.c]) + gft([n.s.gg.r, n.s.f.r])
      + '<td>' + pctTxt(n.s.gg.t) + '</td><td>' + pctTxt(n.s.f.t) + '</td><td><b>' + pctTxt(n.s.t.t) + '</b></td><td>' + esc(n.ren.join(', ')) + '</td><td>' + esc(n.obs) + '</td></tr>').join('');
    const tT = [pct(T.r[0], T.c[0]), pct(T.r[1], T.c[1]), pct(T.r[0] + T.r[1], T.c[0] + T.c[1])];
    // matières : école entière
    const tous = niveaux.filter(n => n.concerne).flatMap(n => n.s.r);
    const mat = V().MATIERES.map((m, i) => {
      const x = tous.filter(y => y.notes[i] !== null), cf = x.filter(y => sexeF(y.a)), cg = x.filter(y => !sexeF(y.a));
      const mf = cf.filter(y => y.notes[i] >= V().SEUIL_MATIERE).length, mg = cg.filter(y => y.notes[i] >= V().SEUIL_MATIERE).length;
      return { m, cg: cg.length, cf: cf.length, mg, mf, pg: cg.length - mg, pf: cf.length - mf, taux: pct(mf + mg, x.length) };
    });
    const faibles = mat.filter(x => x.taux !== null && x.taux < 50).map(x => x.m.libelle), fortes = mat.filter(x => x.taux !== null && x.taux >= 75).map(x => x.m.libelle);
    const ecartTxt = niveaux.filter(n => n.s.f.t !== null && n.s.gg.t !== null).map(n => n.c + ' : ' + nb(Math.abs(n.s.f.t - n.s.gg.t)) + ' point(s) d’écart en faveur des ' + (n.s.f.t >= n.s.gg.t ? 'filles' : 'garçons'));
    const corps = entete(e, "SYNTHÈSE DE L'ÉVALUATION", V().libellePeriode(per) + ' — Année scolaire ' + annee())
      + infos([['DDEMP', 'Plateau'], ['CS', 'Pobè'], ['Zone', e.zone_ped || ''], ['UP', e.unite_ped || ''], ['École', e.nom], ['Directeur', e.directeur || ''], ['Année', annee()]])
      + '<h4 class="rg-h4">1. PARTICIPATION ET RÉUSSITE AU SEUIL PAR COURS</h4><div class="rg-scroll"><table class="rg-tab"><thead>'
      + '<tr><th rowspan="2">Cours</th><th colspan="3">Inscrits</th><th colspan="3">Ont composé</th><th colspan="3">Ont atteint le seuil</th><th colspan="3">Taux de réussite</th><th rowspan="2">À renforcer</th><th rowspan="2">Observation</th></tr>'
      + '<tr>' + ['G', 'F', 'T', 'G', 'F', 'T', 'G', 'F', 'T', 'G', 'F', 'T'].map(x => '<th>' + x + '</th>').join('') + '</tr></thead><tbody>' + lignes
      + '<tr class="tot"><td>TOTAL</td>' + gft(T.i) + gft(T.c) + gft(T.r) + '<td>' + pctTxt(tT[0]) + '</td><td>' + pctTxt(tT[1]) + '</td><td>' + pctTxt(tT[2]) + '</td><td></td><td></td></tr></tbody></table></div>'
      + global.Graphiques.svgType('barres', { titre: 'Taux de réussite au seuil par cours (%)', labels: niveaux.map(n => n.c),
        series: [{ nom: 'Garçons', values: niveaux.map(n => n.s.gg.t), color: COUL_G }, { nom: 'Filles', values: niveaux.map(n => n.s.f.t), color: COUL_F }, { nom: 'Ensemble', values: niveaux.map(n => n.s.t.t), color: COUL_T }] })
      + '<h4 class="rg-h4">2. MAÎTRISE PAR MATIÈRE (ÉCOLE)</h4><div class="rg-scroll"><table class="rg-tab"><thead><tr><th rowspan="2">Matière</th><th colspan="3">Ont composé</th><th colspan="3">Maîtrise partielle</th><th colspan="3">Maîtrise maximale (≥ ' + V().SEUIL_MATIERE + ')</th><th rowspan="2">% réussite</th><th rowspan="2">À renforcer</th></tr>'
      + '<tr>' + ['G', 'F', 'T', 'G', 'F', 'T', 'G', 'F', 'T'].map(x => '<th>' + x + '</th>').join('') + '</tr></thead><tbody>'
      + mat.map(x => '<tr><td class="rg-nom">' + esc(x.m.libelle) + '</td>' + gft([x.cg, x.cf]) + gft([x.pg, x.pf]) + gft([x.mg, x.mf]) + '<td>' + pctTxt(x.taux) + '</td><td>' + (x.taux !== null && x.taux < 50 ? 'OUI' : '') + '</td></tr>').join('') + '</tbody></table></div>'
      + '<h4 class="rg-h4">3. ANALYSE DES RÉSULTATS</h4><ul class="rg-analyse">'
      + '<li><b>Analyse quantitative :</b> ' + (T.c[0] + T.c[1]) + ' élève(s) ont composé sur ' + (T.i[0] + T.i[1]) + ' inscrit(s) ; ' + (T.r[0] + T.r[1]) + ' ont atteint le seuil, soit ' + pctTxt(tT[2]) + '.</li>'
      + '<li><b>Analyse qualitative :</b> ' + (fortes.length ? 'matières bien maîtrisées : ' + esc(fortes.join(', ')) + '. ' : '') + (faibles.length ? 'Matières à renforcer (moins de 50 % de réussite) : ' + esc(faibles.join(', ')) + '.' : 'Aucune matière sous 50 % de réussite.') + '</li>'
      + '<li><b>Écarts de genre :</b> ' + (ecartTxt.length ? esc(ecartTxt.join(' ; ')) + '.' : 'non calculables (notes non saisies).') + '</li></ul>'
      + legendeDate() + pied(e, null, 'SYNTHESE', e.id + '-' + cle + '-' + annee(), 'Synthese ' + cle + ' ' + annee() + ' ' + e.nom, { sansTitulaire: true });
    ouvrir("Synthèse de l'évaluation — " + V().libellePeriode(per), corps, 'Synthese_evaluation_' + fichier(e.nom + '_' + cle + '_' + annee()), true);
  }

  /* ---------------- page « Registres, statistiques et synthèse » ---------------- */
  function selectEcole(id) {
    const l = ecoles();
    if (!etat.ecole || !ecoleDe(etat.ecole)) etat.ecole = (A().ecoleDuPoste() || l[0] || {}).id || '';
    return '<select id="' + id + '">' + (l.length > 1 ? '<option value="">— École —</option>' : '') + l.map(e => '<option value="' + esc(e.id) + '"' + (String(e.id) === String(etat.ecole) ? ' selected' : '') + '>' + esc(e.nom) + '</option>').join('') + '</select>';
  }
  function selectCours(id) {
    const e = ecoleDe(etat.ecole), cs = e ? coursDe(e) : V().COURS;
    if (cs.indexOf(etat.cours) < 0) etat.cours = '';
    return '<select id="' + id + '"><option value="">— Cours —</option>' + cs.map(c => '<option' + (c === etat.cours ? ' selected' : '') + '>' + c + '</option>').join('') + '</select>';
  }
  function selectPeriode(id) {
    if (!etat.periode) etat.periode = cleP(V().PERIODES[0]);
    return '<select id="' + id + '">' + V().PERIODES.map(p => '<option value="' + cleP(p) + '"' + (cleP(p) === etat.periode ? ' selected' : '') + '>' + esc(V().libellePeriode(p)) + '</option>').join('') + '</select>';
  }
  function carteDoc(icone, titre, texte, action, extra) {
    return '<div class="rg-carte"><div class="rg-ic">' + icone + '</div><b>' + esc(titre) + '</b><span>' + esc(texte) + '</span>' + (extra || '')
      + '<button class="btn btn-primary btn-sm" type="button" data-rg="' + action + '">Ouvrir</button></div>';
  }
  function rendre() {
    const page = document.getElementById('registres'); if (!page) return;
    if (!etat.mois) etat.mois = isoJ(new Date()).slice(0, 7);
    const e = ecoleDe(etat.ecole), tit = e && etat.cours ? titulaire(e.id, etat.cours) : null;
    page.innerHTML = '<div class="page-title">📋 Registres, statistiques et synthèse</div>'
      + '<div class="alert alert-info">Documents au format de SCOLARIS et GESCOL : en-tête officiel, signature digitale du titulaire et du directeur, cachet de l’école '
      + 'et code QR de vérification. Imprimez-les ou enregistrez-les en PDF ; chacun s’exporte aussi en Excel.</div>'
      + '<div class="search-bar rg-choix">' + selectEcole('rgEcole') + selectCours('rgCours')
      + '<input type="month" id="rgMois" value="' + esc(etat.mois) + '" aria-label="Mois du registre">' + selectPeriode('rgPeriode') + '</div>'
      + '<div class="rg-titulaire">' + (e && etat.cours ? (tit ? 'Titulaire : <b>' + esc(tit.nom) + '</b> — signature digitale : ' + (tit.signature_image ? '<img src="' + tit.signature_image + '" alt="Signature" style="height:28px;vertical-align:middle"> ' : '<i>non enregistrée</i> ')
        + '<button class="btn btn-sm" type="button" id="rgSigner">✍️ ' + (tit.signature_image ? 'Modifier' : 'Enregistrer') + ' la signature du titulaire</button>'
        : 'Aucun titulaire attribué à ce cours (rubrique « Attribution des classes ») : la signature du titulaire restera à apposer à la main.')
        + (e.signature_image ? '' : ' · <span class="muet">Signature du directeur : à enregistrer dans « Cachets et signatures ».</span>') : 'Choisissez l’école et le cours.') + '</div>'
      + '<div class="rg-cartes">'
      + carteDoc('🗓️', "Registre d'appel du mois", 'Demi-journées M / S, absences marquées A, totaux par jour et par élève.', 'registre')
      + carteDoc('📊', 'Relevés mensuels de l’année', 'Tableau officiel : demi-jours, présences possibles et effectives, pourcentages, élèves > 4 absences.', 'releve')
      + carteDoc('📌', "Tableau d'affichage", 'Liste de classe, répartition par sexe, scolarité et âge par sexe, graphiques.', 'affichage')
      + carteDoc('📈', 'Statistiques et courbes de présence', 'Taux de présence par mois (filles, garçons), absences, comparaison des cours.', 'statpres')
      + carteDoc('📝', 'Statistiques et courbes des évaluations', 'Réussite au seuil sur l’année, résultats et maîtrise par matière.', 'stateval')
      + carteDoc('🗂️', "Synthèse de l'évaluation (école)", 'Par cours et par matière, G / F / T, écarts de genre et analyse.', 'synthese')
      + '</div>'
      + (e && etat.cours ? '<div class="form-section mt-15"><h4>Tableau d’affichage — scolarité et contacts</h4><p class="petit muet">Corrigez au besoin la scolarité (années de scolarité) et le contact des parents, puis enregistrez.</p>'
        + '<div class="table-container"><div class="table-scroll"><table><thead><tr><th>N°</th><th>Nom et prénoms</th><th>Sexe</th><th>Scolarité (ans)</th><th>Contact parents</th></tr></thead><tbody>'
        + eleves(e.id, etat.cours).map((a, i) => '<tr><td>' + (i + 1) + '</td><td>' + esc(nomC(a)) + '</td><td>' + (sexeF(a) ? 'F' : 'G') + '</td><td><input type="number" min="0" max="12" style="width:70px" data-sco="' + esc(a.id) + '" value="' + esc(scolariteDe(a) || '') + '"></td>'
          + '<td><input type="tel" style="width:150px" data-tel="' + esc(a.id) + '" value="' + esc(a.telParent || '') + '"></td></tr>').join('')
        + '</tbody></table></div></div><div class="text-center mt-15"><button class="btn btn-success" type="button" id="rgSauver">💾 Enregistrer</button></div></div>' : '');
    const lier = (id, cle, apres) => { const x = document.getElementById(id); if (x) x.onchange = () => { etat[cle] = x.value; if (apres) apres(); }; };
    lier('rgEcole', 'ecole', rendre); lier('rgCours', 'cours', rendre); lier('rgMois', 'mois'); lier('rgPeriode', 'periode');
    page.querySelectorAll('[data-rg]').forEach(b => { b.onclick = () => ({ registre, releve, affichage: affichageDoc, statpres: statsPresence, stateval: statsEval, synthese })[b.dataset.rg](); });
    const sg = document.getElementById('rgSigner');
    if (sg && tit) sg.onclick = () => P().capturerSignature(tit.nom, tit.signature_image, image => { tit.signature_image = image || undefined; if (!image) delete tit.signature_image; A().saveData(); rendre(); });
    const sv = document.getElementById('rgSauver');
    if (sv) sv.onclick = () => {
      page.querySelectorAll('[data-sco]').forEach(i => { const a = D().apprenants.find(x => String(x.id) === i.dataset.sco); if (a) a.scolarite = i.value === '' ? '' : Number(i.value); });
      page.querySelectorAll('[data-tel]').forEach(i => { const a = D().apprenants.find(x => String(x.id) === i.dataset.tel); if (a) a.telParent = i.value.trim(); });
      A().saveData(); alert('Scolarités et contacts enregistrés.');
    };
  }

  document.head.append(Object.assign(document.createElement('style'), { textContent: `
    .rg-cartes{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,230px),1fr));gap:12px;margin-top:12px}
    .rg-carte{background:#fff;border:1px solid #D0D5DD;border-radius:10px;padding:14px;display:flex;flex-direction:column;gap:6px}
    .rg-carte b{color:#1F4E79}.rg-carte span{font-size:12.5px;color:#667085;flex:1}.rg-carte .btn{align-self:flex-start}.rg-ic{font-size:24px}
    .rg-choix select,.rg-choix input{min-width:140px}.rg-titulaire{margin:6px 0 4px;font-size:13px}
    .rg-doc{font-size:11px}.rg-doc .rg-titre{text-align:center;margin:10px 0 2px;font-size:16px;letter-spacing:.3px;color:#12324F}
    .rg-doc .rg-sous{text-align:center;color:#475467;margin-bottom:8px;font-size:11px}
    .rg-infos{width:100%;border-collapse:collapse;margin:6px 0 8px}.rg-infos td{border:1px solid #98A2B3;padding:4px 6px;vertical-align:top}
    .rg-infos span{display:block;font-size:9.5px;color:#475467;text-transform:uppercase}.rg-infos b{font-size:11px}
    .rg-scroll{overflow-x:auto}
    .rg-tab{width:100%;border-collapse:collapse;margin:4px 0 10px}
    .rg-tab th,.rg-tab td{border:1px solid #667085;padding:3px 4px;text-align:center;font-size:10.5px}
    .rg-tab th{background:#DCE6F2;color:#12324F}.rg-tab .rg-nom{text-align:left;white-space:nowrap}
    .rg-tab tr.tot td{background:#EEF4FA;font-weight:700}.rg-tab .rg-pct{background:#DCE6F2;font-weight:700}
    .rg-registre th,.rg-registre td{padding:2px 1px;min-width:14px;font-size:9px}.rg-registre .rg-nom{font-size:9.5px}
    .rg-nonsaisi{background:#F2F4F7 !important}.rg-a{color:#B42318}
    .rg-releve th{font-size:8.5px;font-weight:600}
    .rg-deux{display:grid;grid-template-columns:1fr 1fr;gap:12px}.rg-mini h4,.rg-h4{font-size:11.5px;margin:10px 0 4px;color:#12324F}
    .rg-rep{max-width:420px}.rg-analyse{margin:4px 0 8px 18px;padding:0}.rg-analyse li{margin-bottom:4px}
    .rg-lieu{text-align:right;margin:8px 0 0}
    .rg-pied{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;margin-top:10px;page-break-inside:avoid;break-inside:avoid}
    .rg-verif{display:flex;gap:8px;align-items:flex-start;max-width:230px}.rg-verif svg{width:88px;height:88px;flex:none}
    .rg-sig{text-align:center;min-width:150px}.rg-dir{display:flex;align-items:center;gap:6px}.rg-cachet{opacity:.95}
    @media (max-width:700px){.rg-deux{grid-template-columns:1fr}.rg-pied{flex-wrap:wrap}}
    @page rgpaysage{size:A4 landscape;margin:8mm}
    @media print{body.rg-impression-paysage .rg-doc{page:rgpaysage}.rg-barre{display:none!important}.rg-scroll{overflow:visible}.rg-doc svg.courbe{max-height:250px}}
  ` }));
  global.Extra = global.Extra || { pages: {} };
  global.Extra.pages.registres = rendre;
  global.Registres = { pied, registre, releve, affichage: affichageDoc, statsPresence, statsEval, synthese, etat, rendre, releveCalcul, affichageDonnees, statClasse };
})(window);
