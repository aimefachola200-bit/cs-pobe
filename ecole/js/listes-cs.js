/* CS Pobè et Mon école — « Listes de classe » (accès rapide, lecture seule) : adaptateur du moteur commun js/listes-classe.js.
   Classes : organisation déclarée sur la fiche de l'école (jumelées, multigrades) ; à défaut, une classe par cours. */
(function (global) {
  'use strict';
  const A = () => global.AppBridge;
  const COURS = ['CI', 'CP', 'CE1', 'CE2', 'CM1', 'CM2'], MAT = ['Petits', 'Grands'];
  function ecolesVisibles() {
    const a = A(), poste = a.ecoleDuPoste && a.ecoleDuPoste();
    if (global.Config && global.Config.MODE === 'ECOLE') return poste ? [poste] : [];
    return (a.data.ecoles || []).slice().sort((x, y) => String(x.nom).localeCompare(String(y.nom), 'fr'));
  }
  const MODELES = 'assets/educmaster/', XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  const nomF = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '');
  /** Personnel en activité de l'école -> modèle officiel « Mes agents » d'EducMaster (aussi depuis la liste du personnel) */
  async function exporterAgents(ecoleId) {
    const a = A(); if (!ecoleId) { const p = a.ecoleDuPoste && a.ecoleDuPoste(); ecoleId = p ? p.id : null; }
    if (!ecoleId) { alert('Choisissez d’abord l’école (filtre « École »).'); return; }
    const C = global.Carriere, e = (a.data.ecoles || []).find(x => x.id == ecoleId) || {};
    const l = (a.data.personnel || []).filter(p => p.ecoleId == ecoleId && (!C || C.estActif(p)));
    if (!l.length) { alert('Aucun agent en activité pour cette école.'); return; }
    const b = await global.ModeleXlsx.EducMaster.agents(MODELES, l.map(p => ({ matricule: p.matricule, idAnpe: p.idAnpe, nom: p.nom, prenoms: p.prenoms, sexe: p.sexe, dateNaiss: p.dateNaissance,
      lieuNaiss: p.lieuNaiss, tel: p.telephone, email: p.email, ifu: p.ifu, datePriseService: p.datePriseServiceFP })));
    a.telecharger('EducMaster_agents_' + nomF(e.nom) + '_' + a.anneeActive() + '.xlsx', b, XLSX);
  }
  function adaptateur() {
    return {
      app: global.Config && global.Config.MODE === 'ECOLE' ? 'Mon école' : 'CS Pobè',
      annee: () => A().anneeActive(),
      ecoles: async () => ecolesVisibles().map(e => ({ id: e.id, nom: e.nom })),
      cours: async (ecoleId) => {
        const e = (A().data.ecoles || []).find(x => x.id == ecoleId) || {};
        const presents = new Set((A().data.apprenants || []).filter(x => x.ecoleId == ecoleId).map(x => x.cours));
        const mat = /maternelle|^em\b/i.test(String(e.type || '') + ' ' + String(e.nom || '')) || MAT.some(c => presents.has(c));
        const ep = !mat || COURS.some(c => presents.has(c));
        return (ep ? COURS : []).concat(mat ? MAT : []);
      },
      charger: async (ecoleId) => {
        const a = A(), e = (a.data.ecoles || []).find(x => x.id == ecoleId);
        const cl = e && a.classesEcole ? a.classesEcole(e) : { classes: [] };
        const O = global.ClassesOrg;
        const classes = (cl.classes || []).map((c, i) => ({ id: c.id || 'c' + i, cours: O ? O.coursDe(c.cours) : [].concat(c.cours || []), lib: O ? O.libelle(c) : [].concat(c.cours).join('-') }));
        const eleves = (a.data.apprenants || []).filter(x => x.ecoleId == ecoleId).map(x => ({
          id: x.id, nom: String(x.nom || '').toUpperCase(), prenoms: x.prenoms || '', sexe: x.sexe === 'F' ? 'F' : 'G', dateNaiss: x.dateNaiss || '', lieuNaiss: x.lieuNaiss || '',
          matricule: x.matricule || x.npi || '', educmaster: x.matricule || '', statut: x.redoublant === 'Oui' ? 'Redoublant' : 'Nouveau',
          contact: [x.telParent, x.pere || x.mere].filter(Boolean).join(' — '), cours: x.cours, classeId: null }));
        return { classes, eleves };
      },
      ouvrir: (id) => { if (global.openApprenantModal) global.openApprenantModal(id); },
      entete: async (e) => { const full = e ? (A().data.ecoles || []).find(x => x.id == e.id) : null; return A().enteteDocument({ etablissement: full ? full.nom : '' }); },
      excel: async (nom, feuilles) => { if (!global.XlsxEcrire) throw new Error('Tableur indisponible'); A().telecharger(nom + '.xlsx', global.XlsxEcrire.classeur(feuilles)); },
      // modèle d'importation d'EducMaster (le même que « EducMaster » › exporter les élèves) : importable tel quel
      // modèles officiels d'EducMaster (assets/educmaster, copies inchangées ; outils/lots/spec-educmaster.md)
      excelEducmaster: async (ids, o) => {
        const set = new Set(ids.map(String)), l = (A().data.apprenants || []).filter(x => set.has(String(x.id)) && x.cours === o.cours);
        const b = await global.ModeleXlsx.EducMaster.eleves(MODELES, o.cours, l.map(x => ({ nom: x.nom, prenoms: x.prenoms, sexe: x.sexe, dateNaiss: x.dateNaiss, lieuNaiss: x.lieuNaiss, tel: x.telParent, nationalite: x.nationalite, npi: x.npi })));
        A().telecharger(o.nom + '.xlsx', b, XLSX);
      },
      excelNotes: async (o) => {
        if (['CI', 'CP', 'CE1', 'CE2', 'CM1', 'CM2'].indexOf(o.cours) < 0) { alert('Le modèle des notes d’EducMaster concerne le primaire (CI à CM2).'); return; }
        const a = A(), an = a.anneeActive(), E = global.EducMaster;
        const l = (a.data.apprenants || []).filter(x => o.ecole && x.ecoleId == o.ecole.id && x.cours === o.cours);
        const parFeuille = {};
        E.FEUILLES_NOTES.forEach(([nom, cle]) => {
          parFeuille[nom] = l.map(x => { const f = (a.data.notes || []).find(n => String(n.apprenantId) === String(x.id) && n.periode === cle && n.annee === an) || {};
            return { matricule: x.matricule, nom: x.nom, prenoms: x.prenoms, notes: E.MATIERES_MODELE.map(([, k]) => (f[k] === undefined || f[k] === '' || isNaN(Number(f[k])) ? null : Number(f[k]))) }; });
        });
        const b = await global.ModeleXlsx.EducMaster.notes(MODELES, parFeuille);
        a.telecharger('EducMaster_notes_' + nomF((o.ecole ? o.ecole.nom : '') + '_' + o.cours) + '_' + an + '.xlsx', b, XLSX);
      },
      excelAgents: async (o) => exporterAgents(o.ecole ? o.ecole.id : null)
    };
  }
  global.Extra = global.Extra || { pages: {} };
  global.Extra.pages.listesClasse = function () {
    const el = document.getElementById('listesClasse'); if (!el) return;
    if (!global.ListesClasse) { el.textContent = 'Module indisponible : rechargez l’application.'; return; }
    el.textContent = '';
    const titre = document.createElement('div'); titre.className = 'page-title'; titre.textContent = 'Listes de classe';
    const zone = document.createElement('div'); el.append(titre, zone);
    global.ListesClasse.monter(zone, adaptateur()).catch(e => { console.error(e); zone.textContent = 'Les listes de classe n’ont pas pu s’ouvrir.'; });
  };
  global.ListesCS = { adaptateur, exporterAgents };
  global.exporterAgentsEducmaster = () => exporterAgents((document.getElementById('filterEcolePers') || {}).value || null);
})(window);
