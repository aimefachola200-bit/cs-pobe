/* CS Pobè / Mon école — mot de passe d'accès de l'appareil (verrou, déconnexion après inactivité) et copies de sauvegarde
   automatiques (instantanés locaux, restauration contrôlée). Moteurs communs : js/securite.js, js/sauvegarde-auto.js.
   Conception : Maître Aimé FACHOLA */
(function (global) {
  'use strict';
  const A = () => global.AppBridge;
  if (!A() || !global.Securite || !global.SauvegardeAuto) return;
  const ecole = !!(global.Config && global.Config.estEcole && global.Config.estEcole());
  const titre = ecole ? 'Mon école' : 'CS Pobè', couleur = '#006633';
  const V = global.Securite.verrou({ app: A().CLE_STOCKAGE, titre, couleur, minutes: 20 });
  const S = global.SauvegardeAuto.installer({
    app: A().CLE_STOCKAGE, titre, couleur, garder: 10, intervalleH: 20,
    rappel: false,   // l'application a déjà son rappel hebdomadaire (Échanges et sauvegarde)
    lire: async () => JSON.stringify(A().data),
    restaurer: async (texte) => {
      const o = JSON.parse(texte);
      if (!A().COLLECTIONS.some(c => Array.isArray(o[c]))) throw new Error('Ces données ne sont pas celles de ' + titre + '.');
      A().COLLECTIONS.forEach(c => { A().data[c] = Array.isArray(o[c]) ? o[c] : []; });
      A().saveData();
      setTimeout(() => location.reload(), 600);
    }
  });
  global.SecuriteCS = { verrou: V, sauvegardes: S };
  /* entrée de menu, sous le guide d'utilisation */
  function menu() {
    const g = document.getElementById('menuGuide');
    if (!g || document.getElementById('menuSecurite')) return;
    const d = document.createElement('div');
    d.className = 'menu-item'; d.id = 'menuSecurite'; d.setAttribute('role', 'button'); d.tabIndex = 0; d.dataset.securite = 'menu';
    d.innerHTML = '<span class="icon">' + (global.Icones ? global.Icones.icone('cadenas', { taille: 18 }) : '') + '</span> Sécurité et sauvegardes';
    d.onclick = ouvrir; d.onkeydown = (e) => { if (e.key === 'Enter') ouvrir(); };
    g.after(d);
  }
  function ouvrir() {
    A().openModal('Sécurité et sauvegardes',
      '<p>' + (V.actif() ? 'Un <b>mot de passe d’accès</b> protège cette application : il est demandé à l’ouverture et après 20 minutes sans action.'
        : 'Aucun mot de passe d’accès : toute personne qui prend cet appareil voit les données (élèves, personnel). Il est conseillé d’en définir un.') + '</p>'
      + '<div class="text-center mt-15"><button class="btn btn-primary" id="secuMdp">' + (V.actif() ? 'Changer ou retirer le mot de passe d’accès' : 'Définir un mot de passe d’accès') + '</button> '
      + (V.actif() ? '<button class="btn" id="secuVerrou">Verrouiller maintenant</button>' : '') + '</div>'
      + '<hr><p>Copies automatiques : l’application garde sur l’appareil les 10 dernières copies de vos données (une par jour d’utilisation). '
      + 'Pour une copie hors de l’appareil, utilisez aussi « Sauvegarder maintenant » (Échanges et sauvegarde).</p>'
      + '<div class="text-center mt-15"><button class="btn btn-info" id="secuCopies">Copies et restauration</button></div>');
    document.getElementById('secuMdp').onclick = () => { A().closeModal(); V.regler().then(() => {}); };
    const vb = document.getElementById('secuVerrou'); if (vb) vb.onclick = () => { A().closeModal(); V.verrouiller(); };
    document.getElementById('secuCopies').onclick = () => { A().closeModal(); S.fenetre(); };
  }
  menu();
  V.demarrer();
  /* rappel unique et discret si aucun mot de passe d'accès n'est défini (une fois par semaine au plus) */
  try {
    const k = 'secuRappel:' + A().CLE_STOCKAGE, der = localStorage.getItem(k);
    if (!V.actif() && (!der || Date.now() - new Date(der).getTime() > 7 * 86400000)) {
      localStorage.setItem(k, new Date().toISOString());
      setTimeout(() => {
        const b = document.createElement('div'); b.dataset.securite = 'rappel';
        b.style.cssText = 'position:fixed;left:12px;right:12px;top:70px;z-index:9998;max-width:520px;margin:0 auto;background:#fff;border:2px solid ' + couleur + ';border-radius:12px;padding:10px 12px;font:14px/1.4 system-ui,Arial,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.2);display:flex;gap:8px;align-items:center;flex-wrap:wrap';
        b.innerHTML = '<span style="flex:1;min-width:200px">Protégez les données de cet appareil par un mot de passe d’accès.</span><button type="button" data-a="oui" style="min-height:36px;border:0;border-radius:8px;background:' + couleur + ';color:#fff;padding:0 12px;cursor:pointer">Définir</button><button type="button" data-a="non" style="min-height:36px;border:1px solid #D0D5DD;border-radius:8px;background:#fff;padding:0 10px;cursor:pointer">Plus tard</button>';
        b.querySelector('[data-a="oui"]').onclick = () => { b.remove(); V.regler(); };
        b.querySelector('[data-a="non"]').onclick = () => b.remove();
        document.body.append(b);
      }, 3000);
    }
  } catch (e) { /* stockage indisponible */ }
})(window);
