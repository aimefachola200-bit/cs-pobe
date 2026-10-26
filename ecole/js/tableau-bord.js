/* v2.0 — Tableau de bord présenté comme dans SCOLARIS et GESCOL : en-tête, raccourcis, alertes,
   indicateurs clés (cartes KPI), tableau des écoles par type, personnel par statut, retraites et courriers.
   Même rendu pour la circonscription (CS Pobè) et pour l'école (Mon école), avec les chiffres de chacun. */
(function (global) {
  'use strict';
  const App = () => global.AppBridge;
  const esc = s => App().echapper(s == null ? '' : s);
  const nb = n => Number(n || 0).toLocaleString('fr-FR');
  const pct = (a, b) => b ? Math.round(100 * a / b) + ' %' : '—';
  const ecole = () => global.Config && global.Config.estEcole();
  const lien = page => "showPage('" + page + "', document.querySelector('.menu-item[data-page=" + page + "]'))";

  const RACCOURCIS_CS = [
    ['ecoles', '🏫', 'Écoles', 'Liste et fiches'], ['personnel', '👥', 'Personnel', 'Enseignants et carrières'],
    ['effectifs', '👨‍🎓', 'Effectifs', 'Élèves par école'], ['echanges', '🔄', 'Échanges', 'Paquets des écoles'],
    ['visites', '🔎', 'Visites', 'Inspections'], ['fiches', '🗂️', 'Fiches officielles', 'À imprimer'],
    ['docsref', '📚', 'Documents officiels', 'Calendrier, planifications'], ['courriers', '📬', 'Courriers', 'Arrivée et départ'],
    ['bilans', '📊', 'Bilans', 'Trimestriels et annuel'], ['backup', '💾', 'Sauvegarde', 'Garder une copie']
  ];
  const RACCOURCIS_ECOLE = [
    ['maFiche', '🧑‍💼', 'Ma fiche école', 'Renseignements'], ['apprenants', '🧒', 'Apprenants', 'Listes par classe'],
    ['presenceApprenants', '🗓️', 'Présences', 'Appel du jour'], ['notes', '🗒️', 'Notes et bulletins', 'Évaluations'],
    ['registres', '📋', 'Registres et synthèse', 'Appel, affichage, statistiques'], ['educmaster', '🔄', 'EducMaster', 'Élèves et notes'],
    ['personnel', '👥', 'Personnel', 'Enseignants'], ['cep', '📋', 'Inscription CEP', 'Fiches candidats'],
    ['docsref', '📚', 'Documents officiels', 'Calendrier, emplois du temps'], ['echanges', '🔄', 'Envoyer à la CS', 'Paquet de l’école'],
    ['fiches', '🗂️', 'Fiches officielles', 'À imprimer'], ['backup', '💾', 'Sauvegarde', 'Garder une copie']
  ];

  function kpi(libelle, valeur, detail, page) {
    return '<div class="kpi"' + (page ? ' role="link" tabindex="0" style="cursor:pointer" onclick="' + lien(page) + '"' : '') + '>'
      + '<div class="l">' + libelle + '</div><div class="v">' + valeur + '</div>' + (detail ? '<div class="d">' + detail + '</div>' : '') + '</div>';
  }

  function render() {
    const page = document.getElementById('dashboard'); if (!page) return;
    const A = App(), d = A.data, annee = A.anneeActive ? A.anneeActive() : '';
    const C = global.Carriere, actif = p => !C || C.estActif(p);
    const nomEcole = ecole() && A.ecoleDuPoste && A.ecoleDuPoste() ? A.ecoleDuPoste().nom : '';

    /* chiffres */
    const ecoles = d.ecoles || [], compte = t => ecoles.filter(e => e.type === t).length;
    const pub = compte('EPP') + compte('EM'), priv = compte('EPPRIV') + compte('EMPRIV');
    let g = 0, f = 0;
    (d.effectifs || []).filter(e => !e.annee || e.annee === annee).forEach(e => {
      const G = parseInt(e.totalG, 10) || 0, F = parseInt(e.totalF, 10) || 0;
      if (G || F) { g += G; f += F; } else g += parseInt(e.total, 10) || 0;
    });
    const eleves = g + f;
    const pers = (d.personnel || []).filter(actif), femmes = pers.filter(p => p.sexe === 'F').length;
    const auj = new Date(), dans12 = new Date(); dans12.setFullYear(dans12.getFullYear() + 1);
    const retraites = !C ? [] : pers.map(p => ({ p, dr: C.dateRetraite(p.dateNaissance, p.grade, p.statut) }))
      .filter(x => x.dr && x.dr >= auj && x.dr <= dans12).sort((a, b) => a.dr - b.dr);
    const arr = d.courriersArr || [], dep = d.courriersDep || [];
    const al = global.Ameliorations && global.Ameliorations.alertes ? global.Ameliorations.alertes() : [];
    const ordre = { danger: 0, warning: 1, info: 2 }; al.sort((a, b) => ordre[a.niveau] - ordre[b.niveau]);

    /* raccourcis */
    const vis = p => !global.Config || global.Config.pageVisible(p);
    const existe = p => !!document.querySelector('.menu-item[data-page="' + p + '"]');
    const racc = (ecole() ? RACCOURCIS_ECOLE : RACCOURCIS_CS).filter(([p]) => vis(p) && existe(p));
    const raccHtml = '<div class="raccourcis">'
      + (al.length ? '<a href="#" class="alerte" onclick="event.preventDefault();' + lien('alertes') + '"><span class="ico">🚨</span><b>Alertes</b><span class="d">' + al.length + ' point(s) à voir</span></a>' : '')
      + racc.map(([p, i, t, s]) => '<a href="#" onclick="event.preventDefault();' + lien(p) + '"><span class="ico">' + i + '</span><b>' + t + '</b><span class="d">' + s + '</span></a>').join('') + '</div>';

    /* indicateurs */
    const kpis = '<div class="grille">'
      + (ecole()
        ? kpi('Élèves inscrits', nb(eleves), eleves ? nb(f) + ' filles (' + pct(f, eleves) + ')' : 'Effectifs à saisir', 'effectifs')
          + kpi('Personnel', nb(pers.length), pers.length ? nb(femmes) + ' femmes (' + pct(femmes, pers.length) + ')' : 'À enregistrer', 'personnel')
          + kpi('Élèves par enseignant', pers.length && eleves ? Math.round(eleves / pers.length) : '—', 'Ratio indicatif')
          + kpi('Apprenants nominatifs', nb((d.apprenants || []).length), 'Listes de classe', 'apprenants')
          + kpi('Candidats au CEP', nb((d.cep || []).length), 'Fiches d’inscription', 'cep')
          + kpi('Départs à la retraite', nb(retraites.length), 'Dans les 12 prochains mois', 'retraite')
        : kpi('Écoles', nb(ecoles.length), nb(pub) + ' publiques · ' + nb(priv) + ' privées', 'ecoles')
          + kpi('Élèves', nb(eleves), eleves ? nb(f) + ' filles (' + pct(f, eleves) + ')' : 'Effectifs à saisir', 'effectifs')
          + kpi('Personnel actif', nb(pers.length), pers.length ? nb(femmes) + ' femmes (' + pct(femmes, pers.length) + ')' : 'À enregistrer', 'personnel')
          + kpi('Élèves par enseignant', pers.length && eleves ? Math.round(eleves / pers.length) : '—', 'Ratio indicatif')
          + kpi('Départs à la retraite', nb(retraites.length), 'Dans les 12 prochains mois', 'retraite')
          + kpi('Courriers', nb(arr.length + dep.length), nb(arr.length) + ' arrivée · ' + nb(dep.length) + ' départ', 'courriers'))
      + '</div>';

    /* 1. Écoles par type (circonscription) */
    const ligneType = (l, t) => { const n = compte(t); return '<tr><td>' + l + '</td><td class="num">' + n + '</td></tr>'; };
    const tabEcoles = ecole() ? '' : '<div class="carte"><h2>1. Écoles par type</h2><div class="tw"><table class="t"><thead><tr><th>Type</th><th class="num">Nombre</th></tr></thead><tbody>'
      + ligneType('Écoles primaires publiques', 'EPP') + ligneType('Écoles primaires privées', 'EPPRIV')
      + '<tr class="st"><td>Sous-total primaire</td><td class="num">' + (compte('EPP') + compte('EPPRIV')) + '</td></tr>'
      + ligneType('Écoles maternelles publiques', 'EM') + ligneType('Écoles maternelles privées', 'EMPRIV')
      + '<tr class="st"><td>Sous-total maternelle</td><td class="num">' + (compte('EM') + compte('EMPRIV')) + '</td></tr>'
      + '<tr class="b"><td>Total</td><td class="num">' + ecoles.length + '</td></tr></tbody></table></div></div>';

    /* alertes */
    const blocAlertes = '<div class="carte"><h2>' + (ecole() ? '1' : '2') + '. Points à surveiller</h2>'
      + (al.length ? al.slice(0, 5).map(a => '<div class="alerte-l ' + a.niveau + '"><span class="ico">' + (a.niveau === 'danger' ? '⛔' : a.niveau === 'warning' ? '⚠️' : 'ℹ️') + '</span><div>'
        + '<b>' + esc(a.titre) + '</b>' + (a.action ? ' <a href="#" onclick="event.preventDefault();' + a.action + '">' + esc(a.libelle) + '</a>' : '') + '</div></div>').join('')
        + (al.length > 5 ? '<p><a href="#" onclick="event.preventDefault();' + lien('alertes') + '">Voir les ' + al.length + ' alertes</a></p>' : '')
        : '<p class="sous">✔ Rien à signaler : tout est à jour.</p>') + '</div>';

    const n0 = ecole() ? 2 : 3;
    const liste = (items, vide) => items.length ? '<div class="liste-l">' + items.join('') + '</div>' : '<p class="sous">' + vide + '</p>';
    const blocRetraite = '<div class="carte"><h2>' + (n0 + 1) + '. Retraites des 12 prochains mois</h2>'
      + liste(retraites.slice(0, 8).map(x => '<div><b>' + esc(x.p.nom) + '</b> (' + esc(x.p.grade || '—') + ')<br><small>Retraite : ' + A.formatDate(x.dr) + '</small></div>'), 'Aucune retraite prévue dans les 12 prochains mois.') + '</div>';
    const recents = arr.slice(-5).concat(dep.slice(-5)).sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 8);
    const blocCourriers = !vis('courriers') ? '' : '<div class="carte"><h2>' + (n0 + 2) + '. Derniers courriers</h2>'
      + liste(recents.map(c => '<div><b>' + esc(c.objet) + '</b><br><small>' + A.formatDate(c.date) + ' — ' + esc(c.expediteur || c.destinataire || '') + '</small></div>'), 'Aucun courrier enregistré.') + '</div>';

    page.innerHTML = '<div class="entete"><h1>' + (ecole() ? 'Tableau de bord de l’école' : 'Tableau de bord de la circonscription') + '</h1>'
      + '<div class="sous">' + esc(ecole() ? (nomEcole || 'Mon école') : 'Circonscription scolaire de Pobè') + (annee ? ' · Année scolaire ' + esc(annee) : '')
      + (global.Config && global.Config.version ? ' · version ' + esc(global.Config.version) : '') + '</div></div>'
      + raccHtml + kpis
      + '<div class="grille2">' + tabEcoles + blocAlertes + '</div>'
      + '<div class="carte"><h2>' + n0 + '. Personnel par statut et par sexe</h2><div class="tw" id="ventilationDashboard"></div></div>'
      + '<div class="grille2">' + blocRetraite + blocCourriers + '</div>'
      /* éléments repris par l'ancien code (compatibilité) */
      + '<div id="statsGrid" hidden></div><div id="alerteRetraite" hidden></div><div id="derniersCourriers" hidden></div>';
    ventilation();
  }

  function ventilation() {
    const cible = document.getElementById('ventilationDashboard'); if (!cible || !global.Carriere) return;
    const d = App().data, par = {};
    global.Carriere.ventilerPersonnel(d.personnel || [], d.ecoles || []).forEach(l => { par[l.libelle] = l; });
    let tH = 0, tF = 0;
    const r = (cle, lib) => { const x = par[cle] || { H: 0, F: 0 }; tH += x.H; tF += x.F; return '<tr><td>' + lib + '</td><td class="num">' + x.H + '</td><td class="num">' + x.F + '</td><td class="num"><b>' + (x.H + x.F) + '</b></td></tr>'; };
    const corps = r('FE — Directeur', 'FE — Directeur') + r('FE — Collaborateur', 'FE — Adjoint') + r('ACDPE — Directeur', 'ACDPE — Directeur') + r('ACDPE — Collaborateur', 'ACDPE — Adjoint')
      + r('PRIVEE — Directeur', 'Privé — Directeur') + r('PRIVEE — Collaborateur', 'Privé — Adjoint') + r('ACDPCTD (AME)', 'ACDPCTD (AME)') + r('Éducateur', 'Éducateur');
    cible.innerHTML = '<table class="t"><thead><tr><th>Statut</th><th class="num">Hommes</th><th class="num">Femmes</th><th class="num">Total</th></tr></thead><tbody>'
      + corps + '<tr class="b"><td>Total</td><td class="num">' + tH + '</td><td class="num">' + tF + '</td><td class="num">' + (tH + tF) + '</td></tr></tbody></table>';
  }

  global.TableauBord = { render };
  const p = document.getElementById('dashboard');
  if (p && !p.classList.contains('hidden') && global.AppBridge) { try { render(); } catch (e) { console.error(e); } }
})(window);
