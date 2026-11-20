/* v2.0 — « Documents officiels », présentés comme dans SCOLARIS et GESCOL :
   fichiers officiels (PDF, canevas), calendrier scolaire, emplois du temps, planification annuelle (EM et EP),
   projet de planification, thèmes et règlement intérieur. Les textes officiels (data/officiel.js) sont repris
   sans modification ; les emplois du temps et planifications peuvent être adaptés sur l'appareil
   (collection « officielPerso ») puis rétablis. Impression et export Excel pour chaque document. */
(function (global) {
  'use strict';
  const O = global.OFFICIEL || {}, DOCS = global.DOCS_OFFICIELS || { documents: [] }, REF = global.REF || {};
  const App = () => global.AppBridge;

  function h(tag, attrs, ...enfants) {
    const el = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => {
      if (v == null || v === false) return;
      if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'class') el.className = v;
      else el.setAttribute(k, v === true ? '' : v);
    });
    enfants.flat().forEach(e => { if (e != null && e !== false) el.append(e instanceof Node ? e : String(e)); });
    return el;
  }
  const dateFr = d => d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(d + 'T12:00').toLocaleDateString('fr-FR') : (d || '');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ---------- personnalisations (emplois du temps, planifications) ---------- */
  function perso(id) {
    const d = App().data; if (!Array.isArray(d.officielPerso)) d.officielPerso = [];
    const r = d.officielPerso.find(x => x.id === id); return r ? JSON.parse(JSON.stringify(r.lignes)) : null;
  }
  function enregistrer(id, lignes) {
    const d = App().data; if (!Array.isArray(d.officielPerso)) d.officielPerso = [];
    const i = d.officielPerso.findIndex(x => x.id === id);
    if (lignes == null) { if (i >= 0) d.officielPerso.splice(i, 1); }
    else if (i >= 0) d.officielPerso[i].lignes = lignes; else d.officielPerso.push({ id, lignes });
    App().saveData();
  }

  /* ---------- export Excel (tableau HTML lu par Excel / LibreOffice) ---------- */
  function exporterExcel(nom, titre, sousTitre, entetes, lignes) {
    const html = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body>'
      + '<table border="1"><tr><th colspan="' + entetes.length + '" style="font-size:14pt">' + esc(titre) + '</th></tr>'
      + (sousTitre ? '<tr><td colspan="' + entetes.length + '"><i>' + esc(sousTitre) + '</i></td></tr>' : '')
      + '<tr>' + entetes.map(e => '<th style="background:#12324F;color:#fff">' + esc(e) + '</th>').join('') + '</tr>'
      + lignes.map(l => '<tr>' + l.map(c => '<td style="vertical-align:top">' + esc(c).replace(/\n/g, '<br style="mso-data-placement:same-cell">') + '</td>').join('') + '</tr>').join('')
      + '</table></body></html>';
    const a = h('a', { href: URL.createObjectURL(window.XlsxEcrire.depuisHtmlBlob('﻿' + html)), download: nom + '.xlsx' });
    document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  const barre = (...boutons) => h('div', { class: 'doc-actions no-print' }, ...boutons);
  const bouton = (libelle, action, classe) => h('button', { class: 'btn ' + (classe || 'btn-secondary'), type: 'button', onclick: action }, libelle);
  const imprimer = () => bouton('\uE008 Imprimer / PDF', () => global.print(), 'btn-primary');
  const ajuster = t => { t.style.height = 'auto'; t.style.height = (t.scrollHeight + 2) + 'px'; };

  /* ---------- onglets ---------- */
  const ONGLETS = [
    ['fichiers', '\uE00D Fichiers officiels'], ['calendrier', '\uE017 Calendrier scolaire'], ['emploi', '\uE018 Emplois du temps'],
    ['planif', '\uE017 Planification annuelle'], ['projet', '\uE031 Projet de planification'], ['themes', '\uE042 Thèmes'], ['reglement', '\uE030 Règlement intérieur']
  ];
  let onglet = 'fichiers', edtNiv = 'ci_cp', planNiv = 'em_petits';

  function rendre() {
    const r = document.getElementById('docsref'); if (!r) return;
    const corps = h('div', { class: 'doc-corps' });
    r.replaceChildren(
      h('div', { class: 'entete' }, h('h1', null, '\uE031 Documents officiels'),
        h('div', { class: 'sous' }, 'Calendrier scolaire, emplois du temps, planifications, règlement intérieur, fiches et canevas — les mêmes textes que dans SCOLARIS et GESCOL, consultables hors ligne.')),
      h('div', { class: 'tabs', role: 'tablist' }, ...ONGLETS.map(([k, l]) => h('div', {
        class: 'tab' + (k === onglet ? ' active' : ''), role: 'tab', tabindex: '0', 'aria-selected': String(k === onglet),
        onclick: () => { onglet = k; rendre(); }, onkeydown: e => { if (e.key === 'Enter') { onglet = k; rendre(); } }
      }, l))),
      corps);
    ({ fichiers, calendrier, emploi, planif, projet, themes, reglement }[onglet] || fichiers)(corps);
  }

  /* 1. Fichiers officiels */
  function fichiers(c) {
    const vus = new Set(), docs = [];
    DOCS.documents.forEach(d => { vus.add(d.fichier); docs.push(d); });
    (REF.documents || []).forEach(d => { if (!vus.has(d.fichier)) docs.push(Object.assign({ groupe: 'Autres documents de la circonscription' }, d)); });
    const groupes = [...new Set(docs.map(d => d.groupe))];
    c.append(h('p', { class: 'sous' }, 'Choisissez « Ouvrir » pour lire le document, « Télécharger » pour le garder sur l’appareil ou l’imprimer.'));
    groupes.forEach(g => {
      c.append(h('h2', { class: 'sec-h' }, g), h('div', { class: 'doc-grille' }, ...docs.filter(d => d.groupe === g).map(d => {
        const ext = (d.format || d.fichier.split('.').pop()).toUpperCase(), icone = /XLS/.test(ext) ? '\uE015' : '\uE00D';
        return h('div', { class: 'doc-carte' },
          h('div', { class: 'doc-ic', 'aria-hidden': 'true' }, icone),
          h('div', { class: 'doc-txt' }, h('b', null, d.titre), d.description ? h('p', null, d.description) : null,
            h('small', null, [d.cycle, d.pages ? d.pages + ' page(s)' : '', ext].filter(Boolean).join(' · '))),
          h('div', { class: 'doc-btns' },
            h('a', { class: 'btn btn-primary btn-sm', href: d.fichier, target: '_blank', rel: 'noopener' }, 'Ouvrir'),
            h('a', { class: 'btn btn-secondary btn-sm', href: d.fichier, download: d.fichier.split('/').pop() }, 'Télécharger')));
      })));
    });
    c.append(h('h2', { class: 'sec-h' }, 'Documents intégrés à l’application'), h('div', { class: 'doc-grille' }, ...(DOCS.integres || []).map(d => {
      const cible = { emploi: 'emploi', calendrier: 'calendrier', reglement: 'reglement', planif: 'planif', themes: 'themes', planification: 'projet' }[d.route];
      return h('div', { class: 'doc-carte' }, h('div', { class: 'doc-ic', 'aria-hidden': 'true' }, '\uE04B'),
        h('div', { class: 'doc-txt' }, h('b', null, d.titre), h('p', null, d.description)),
        h('div', { class: 'doc-btns' }, bouton('Afficher', () => { onglet = cible; rendre(); }, 'btn-primary btn-sm')));
    })));
  }

  /* 2. Calendrier scolaire */
  function calendrier(c) {
    const annees = Object.keys(O.calendrier || {}).sort().reverse();
    if (!annees.length) { c.append(h('p', null, 'Calendrier non disponible.')); return; }
    const A = O.calendrier[annees[0]], T = O.types_calendrier || {}, COUL = O.couleurs_calendrier || {};
    const auj = new Date().toISOString().slice(0, 10);
    const pdf = DOCS.documents.find(d => /calendrier/i.test(d.fichier));
    c.append(
      h('div', { class: 'carte' }, h('h2', null, 'Calendrier de l’année scolaire ' + annees[0]), h('p', { class: 'sous' }, A.arrete), A.signe ? h('p', { class: 'sous' }, A.signe) : null,
        barre(imprimer(), bouton('\uE009 Excel', () => exporterExcel('Calendrier_scolaire_' + annees[0], 'CALENDRIER SCOLAIRE ' + annees[0], A.arrete,
          ['Période', 'Type', 'Début', 'Fin', 'Précision', 'Durée', 'Observations'], A.lignes.map(l => [l.libelle, T[l.type] || l.type, dateFr(l.debut), dateFr(l.fin), l.precision, l.duree, l.obs]))),
          pdf ? h('a', { class: 'btn btn-secondary', href: pdf.fichier, target: '_blank', rel: 'noopener' }, '\uE00D Arrêté (PDF)') : null)),
      h('div', { class: 'tw' }, h('table', { class: 't' },
        h('thead', null, h('tr', null, ...['Période', 'Début', 'Fin', 'Durée', 'Observations'].map(x => h('th', null, x)))),
        h('tbody', null, ...A.lignes.map(l => {
          const enCours = l.debut <= auj && (l.fin || l.debut) >= auj;
          return h('tr', { class: enCours ? 'b' : '' },
            h('td', null, h('span', { class: 'cal-pastille', style: 'background:' + (COUL[l.type] || '#E5E7EB') }), h('b', null, l.libelle), enCours ? h('span', { class: 'badge badge-success', style: 'margin-left:6px' }, 'en cours') : null,
              l.precision ? h('div', { class: 'sous' }, l.precision) : null),
            h('td', null, dateFr(l.debut)), h('td', null, dateFr(l.fin)), h('td', null, l.duree || ''), h('td', null, l.obs || ''));
        })))));
  }

  /* 3. Emplois du temps (modifiables) */
  function emploi(c) {
    const E = O.edt || [], J = O.jours || [];
    const ref = E.find(x => x.id === edtNiv) || E[0]; if (!ref) return;
    let lignes = perso('edt:' + ref.id) || JSON.parse(JSON.stringify(ref.lignes)), modifie = false;
    const etat = h('span', { class: 'sous' }, perso('edt:' + ref.id) ? 'Version adaptée sur cet appareil.' : 'Version officielle.');
    c.append(
      h('div', { class: 'tabs tabs-2' }, ...E.map(x => h('div', { class: 'tab' + (x.id === ref.id ? ' active' : ''), onclick: () => { if (modifie && !confirm('Quitter sans enregistrer les modifications ?')) return; edtNiv = x.id; rendre(); } }, x.libelle))),
      h('div', { class: 'carte' }, h('h2', null, 'Emploi du temps officiel — ' + ref.libelle), ref.source ? h('p', { class: 'sous' }, ref.source) : null, etat,
        barre(bouton('\uE007 Enregistrer', () => { enregistrer('edt:' + ref.id, lignes); modifie = false; rendre(); }, 'btn-success'),
          bouton('↺ Version officielle', () => { if (confirm('Revenir à l’emploi du temps officiel ? Vos modifications seront perdues.')) { enregistrer('edt:' + ref.id, null); rendre(); } }),
          imprimer(), bouton('\uE009 Excel', () => exporterExcel('Emploi_du_temps_' + ref.id, 'EMPLOI DU TEMPS — ' + ref.libelle.toUpperCase(), ref.source,
            ['Horaire', ...J.map(j => j[1])], lignes.map(l => [l.horaire, ...J.map(j => l[j[0]] || '')]))))),
      h('div', { class: 'tw' }, h('table', { class: 'edt' },
        h('thead', null, h('tr', null, h('th', null, 'Horaire'), ...J.map(j => h('th', null, j[1])))),
        h('tbody', null, ...lignes.map(l => {
          const pause = J.every(j => (l[j[0]] || '') === (l[J[0][0]] || '')) && /pause|récré|recre|déjeuner/i.test(l[J[0][0]] || '');
          return h('tr', { class: pause ? 'edt-pause' : '' }, h('td', { class: 'edt-h' }, l.horaire),
            ...J.map(j => h('td', null, h('textarea', { 'aria-label': l.horaire + ' — ' + j[1], rows: '2', oninput: e => { l[j[0]] = e.target.value; modifie = true; ajuster(e.target); } }, l[j[0]] || ''))));
        })))),
      ref.remarques && ref.remarques.length ? h('div', { class: 'carte' }, h('h3', null, 'Remarques'), h('ul', null, ...ref.remarques.map(x => h('li', null, x)))) : null);
    c.querySelectorAll('table.edt textarea').forEach(ajuster);
  }

  /* 4. Planification annuelle (EM par domaines D1-D5, EP CI → CM2) */
  const NIVEAUX_PLAN = [['em_petits', 'EM — section des petits'], ['em_grands', 'EM — section des grands'], ['CI', 'CI'], ['CP', 'CP'], ['CE1', 'CE1'], ['CE2', 'CE2'], ['CM1', 'CM1'], ['CM2', 'CM2']];
  const COLS_EM = [['trimestre', 'Trimestre', ''], ['mois', 'Mois', ''], ['d1', 'D1 — Éducation pour la santé, vie pratique', 'Domaines d’activités'],
    ['d2', 'D2 — Éducation du mouvement (expression corporelle)', 'Domaines d’activités'], ['d3', 'D3 — Éveil : observation, pré-lecture, pré-écriture, pré-mathématique', 'Domaines d’activités'],
    ['d4', 'D4 — Expression plastique, activités manuelles, expression émotionnelle', 'Domaines d’activités'], ['d5', 'D5 — Communication : langage, conte, poésie, chant, comptine', 'Domaines d’activités'], ['observations', 'Observations', '']];
  function planif(c) {
    const P = O.planif || { colonnes: [], mois: [], officielle: {} }, em = planNiv.startsWith('em_');
    const C = em ? COLS_EM : P.colonnes;
    const defaut = () => em ? P.mois.map(([t, m]) => ({ trimestre: t, mois: m, d1: '', d2: '', d3: '', d4: '', d5: '', observations: '' })) : JSON.parse(JSON.stringify(P.officielle[planNiv] || []));
    const lib = NIVEAUX_PLAN.find(x => x[0] === planNiv)[1];
    let lignes = perso('plan:' + planNiv) || defaut(), modifie = false;
    const groupes = [], ligne2 = [];
    for (let i = 0; i < C.length;) {
      const g = C[i][2];
      if (!g) { groupes.push(h('th', { rowspan: '2' }, C[i][1])); i++; continue; }
      let n = 0; while (i + n < C.length && C[i + n][2] === g) { ligne2.push(h('th', null, C[i + n][1])); n++; }
      groupes.push(h('th', { colspan: String(n) }, g)); i += n;
    }
    c.append(
      h('div', { class: 'tabs tabs-2' }, ...NIVEAUX_PLAN.map(([k, l]) => h('div', { class: 'tab' + (k === planNiv ? ' active' : ''), onclick: () => { if (modifie && !confirm('Quitter sans enregistrer les modifications ?')) return; planNiv = k; rendre(); } }, l))),
      h('div', { class: 'carte' }, h('h2', null, 'Planification annuelle — ' + lib),
        h('p', { class: 'sous' }, em ? 'Grille par domaines d’activités de la maternelle (D1 à D5), à compléter par l’école.' : (P.source || 'Planification de référence.')),
        h('p', { class: 'sous' }, perso('plan:' + planNiv) ? 'Version adaptée sur cet appareil.' : (em ? 'Grille vierge.' : 'Version de référence.')),
        barre(bouton('\uE007 Enregistrer', () => { enregistrer('plan:' + planNiv, lignes); modifie = false; rendre(); }, 'btn-success'),
          bouton('↺ Rétablir', () => { if (confirm('Revenir à la version de départ ? Vos modifications de ce niveau seront perdues.')) { enregistrer('plan:' + planNiv, null); rendre(); } }),
          imprimer(), bouton('\uE009 Excel', () => exporterExcel('Planification_' + planNiv, 'PLANIFICATION ANNUELLE — ' + lib.toUpperCase(), em ? 'Domaines d’activités de la maternelle' : P.source,
            C.map(([, l, g]) => g && !em ? g + ' — ' + l : l), lignes.map(l => C.map(([k]) => k === 'trimestre' ? 'T' + (l[k] || '') : (l[k] || ''))))))),
      h('div', { class: 'tw' }, h('table', { class: 'edt edt-plan' },
        h('thead', null, h('tr', null, ...groupes), ligne2.length ? h('tr', null, ...ligne2) : null),
        h('tbody', null, ...lignes.map(l => h('tr', null, ...C.map(([k]) => k === 'trimestre' ? h('td', { class: 'edt-h' }, 'T' + (l.trimestre || ''))
          : k === 'mois' ? h('td', { class: 'edt-h' }, l.mois)
            : h('td', null, h('textarea', { 'aria-label': l.mois + ' — ' + k, rows: '2', oninput: e => { l[k] = e.target.value; modifie = true; ajuster(e.target); } }, l[k] || '')))))))));
    c.querySelectorAll('table.edt textarea').forEach(ajuster);
  }

  /* 5-6. Projet de planification et thèmes : même contenu que l'ancienne page, affiché ici */
  const viaExtra = cle => c => {
    if (global.Extra && global.Extra.renderDocs) { const z = h('div'); c.append(z); global.Extra.renderDocs(cle, z); }
    else c.append(h('p', null, 'Document non disponible.'));
  };
  const projet = c => {
    const pdf = DOCS.documents.find(d => /projet/i.test(d.fichier));
    if (pdf) c.append(barre(h('a', { class: 'btn btn-secondary', href: pdf.fichier, target: '_blank', rel: 'noopener' }, '\uE00D Document complet (PDF)')));
    viaExtra('planif')(c);
  };
  const themes = c => {
    const pdf = DOCS.documents.find(d => /th[eè]me/i.test(d.fichier));
    if (pdf) c.append(barre(h('a', { class: 'btn btn-secondary', href: pdf.fichier, target: '_blank', rel: 'noopener' }, '\uE00D Thèmes (PDF)')));
    viaExtra('themes')(c);
  };

  /* 7. Règlement intérieur : texte officiel, puis document numérisé */
  let regVue = 'texte';
  function reglement(c) {
    const R = O.reglement || [];
    const pdf = DOCS.documents.find(d => /r[eè]glement/i.test(d.fichier));
    c.append(h('div', { class: 'tabs tabs-2' }, ...[['texte', 'Texte'], ['scan', 'Document numérisé']].map(([k, l]) => h('div', { class: 'tab' + (k === regVue ? ' active' : ''), onclick: () => { regVue = k; rendre(); } }, l))));
    if (regVue === 'scan') { viaExtra('reg')(c); return; }
    c.append(h('div', { class: 'carte' }, h('h2', null, 'Règlement intérieur des écoles primaires'), O.reglement_source ? h('p', { class: 'sous' }, O.reglement_source) : null,
      barre(imprimer(), bouton('\uE009 Excel', () => exporterExcel('Reglement_interieur', 'RÈGLEMENT INTÉRIEUR DES ÉCOLES PRIMAIRES', O.reglement_source, ['Type', 'N°', 'Titre', 'Texte'], R.map(a => [a.type, a.numero, a.titre, a.texte]))),
        pdf ? h('a', { class: 'btn btn-secondary', href: pdf.fichier, target: '_blank', rel: 'noopener' }, '\uE00D PDF officiel') : null),
      h('div', { class: 'reg-texte' }, ...R.map(a => a.type === 'titre'
        ? h('h3', { class: 'reg-titre' }, 'Titre ' + a.numero + ' — ' + a.titre)
        : h('div', { class: 'reg-art' }, h('b', null, a.type === 'preambule' ? a.titre : 'Article ' + a.numero + (a.titre ? ' — ' + a.titre : '')),
          ...String(a.texte || '').split('\n').filter(Boolean).map(p => h('p', null, p)))))));
  }

  function installer() {
    if (!global.Extra) global.Extra = { pages: {} };
    global.Extra.pages = global.Extra.pages || {};
    global.Extra.pages.docsref = rendre;
    const m = document.querySelector('.menu-item[data-page="docsref"]');
    if (m) m.innerHTML = '<span class="icon">\uE031</span> Documents officiels';
    const p = document.getElementById('docsref');
    if (p && !p.classList.contains('hidden')) rendre();
  }
  global.Officiel = { rendre, ouvrir: k => { onglet = k; rendre(); }, exporterExcel };
  installer();
})(window);
