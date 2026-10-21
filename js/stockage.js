/* CS Pobè — stockage des données sur l'appareil.
   La mémoire « localStorage » du navigateur est limitée à environ 5 Mo : avec les photos et les signatures de
   centaines d'élèves, elle sature. Les données sont donc tenues dans IndexedDB (plusieurs centaines de Mo,
   et stockage « persistant » demandé au navigateur) ; localStorage n'en garde qu'un double tant qu'il y a la place.
   Au démarrage, la copie la plus récente des deux l'emporte : rien n'est perdu lors du passage à IndexedDB.
   Les scripts de l'application ne sont chargés qu'une fois les données lues. Conception : Maître Aimé FACHE */
(function (global) {
  'use strict';
  const CLE = (global.Config && global.Config.estEcole && global.Config.estEcole()) ? 'ecolePobeData' : 'csPobeData';
  const BASE = 'pobe-donnees', MAGASIN = 'etats';
  let db = null, initial = null, taille = 0, enCours = Promise.resolve();

  function ouvrir() {
    return new Promise(res => {
      try {
        const r = indexedDB.open(BASE, 1);
        r.onupgradeneeded = () => r.result.createObjectStore(MAGASIN);
        r.onsuccess = () => res(r.result);
        r.onerror = () => res(null);
        r.onblocked = () => res(null);
      } catch (e) { res(null); }
    });
  }
  function lireIDB(cle) {
    return new Promise(res => {
      if (!db) return res(null);
      try {
        const q = db.transaction(MAGASIN, 'readonly').objectStore(MAGASIN).get(cle);
        q.onsuccess = () => res(q.result || null); q.onerror = () => res(null);
      } catch (e) { res(null); }
    });
  }
  const lsMaj = () => { try { return +(localStorage.getItem(CLE + ':maj') || 0); } catch (e) { return 0; } };
  const lsJson = () => { try { return localStorage.getItem(CLE); } catch (e) { return null; } };

  const pret = (async () => {
    db = await ouvrir();
    const rec = await lireIDB(CLE);
    const ls = lsJson();
    if (rec && rec.json && (!ls || (rec.maj || 0) >= lsMaj())) initial = rec.json;
    else initial = ls;
    taille = (initial || '').length;
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {}); } catch (e) { /* facultatif */ }
  })();

  /** Enregistre (IndexedDB d'abord, double dans localStorage s'il reste de la place). true si au moins une copie a réussi. */
  function ecrire(json) {
    const maj = Date.now();
    taille = json.length;
    let ok = false;
    if (db) {
      ok = true;
      enCours = new Promise(res => {
        try {
          const t = db.transaction(MAGASIN, 'readwrite');
          t.objectStore(MAGASIN).put({ json, maj }, CLE);
          t.oncomplete = () => res(true);
          t.onerror = t.onabort = () => { res(false); avertir(); };
        } catch (e) { res(false); avertir(); }
      });
    }
    try { localStorage.setItem(CLE, json); localStorage.setItem(CLE + ':maj', String(maj)); ok = true; } catch (e) {
      /* localStorage plein : l'ancien double, devenu périmé, est retiré pour ne pas être relu */
      try { localStorage.removeItem(CLE); localStorage.removeItem(CLE + ':maj'); } catch (e2) { /* rien */ }
    }
    return ok;
  }
  let averti = false;
  function avertir() {
    if (averti) return; averti = true;
    alert("Enregistrement impossible : l'espace de stockage de l'appareil est plein.\nFaites une sauvegarde, puis libérez de la place.");
  }
  function effacer() {
    try { localStorage.removeItem(CLE); localStorage.removeItem(CLE + ':maj'); } catch (e) { /* rien */ }
    return new Promise(res => {
      if (!db) return res();
      try { const t = db.transaction(MAGASIN, 'readwrite'); t.objectStore(MAGASIN).delete(CLE); t.oncomplete = t.onerror = () => res(); } catch (e) { res(); }
    });
  }
  async function estimation() {
    try { if (navigator.storage && navigator.storage.estimate) return await navigator.storage.estimate(); } catch (e) { /* rien */ }
    return null;
  }

  /* Petites valeurs annexes (ex. dossier de sauvegarde automatique), dans la même base. */
  function lireCle(cle) { return lireIDB(cle); }
  function ecrireCle(cle, valeur) {
    return new Promise(res => {
      if (!db) return res(false);
      try { const t = db.transaction(MAGASIN, 'readwrite'); t.objectStore(MAGASIN).put(valeur, cle); t.oncomplete = () => res(true); t.onerror = t.onabort = () => res(false); } catch (e) { res(false); }
    });
  }

  global.Stockage = {
    CLE, pret, ecrire, effacer, estimation, lireCle, ecrireCle,
    get initial() { return initial; },
    get taille() { return taille; },
    get moteur() { return db ? 'IndexedDB' : 'localStorage'; },
    termine: () => enCours
  };

  /* Chargement des scripts de l'application, dans l'ordre, une fois les données lues. */
  global.chargerScripts = function (liste) {
    pret.then(() => liste.reduce((p, src) => p.then(() => new Promise(res => {
      const s = document.createElement('script');
      s.src = src; s.async = false;
      s.onload = res; s.onerror = () => { console.error('Script introuvable : ' + src); res(); };
      document.body.appendChild(s);
    })), Promise.resolve()));
  };
})(window);
