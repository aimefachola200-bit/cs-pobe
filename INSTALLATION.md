# Installer l'application

## Installer depuis Internet (le plus simple)
Adresse : https://aimefachola200-bit.github.io/cs-pobe/  (version École : https://aimefachola200-bit.github.io/cs-pobe/ecole/)
- **PC (Chrome ou Edge)** : ouvrir l'adresse, puis le bouton « Installer » du bandeau vert en bas de l'écran (ou l'icône ⊕ dans la barre d'adresse). Une icône apparaît sur le bureau et dans le menu Démarrer.
- **Android (téléphone ou tablette, Chrome)** : ouvrir l'adresse, toucher « Installer » dans le bandeau vert (ou menu ⋮ → « Installer l'application »). L'icône apparaît sur l'écran d'accueil.
- **iPhone / iPad (Safari)** : ouvrir l'adresse, bouton Partager → « Sur l'écran d'accueil ».
Après la première ouverture, l'application fonctionne sans Internet. Les mises à jour s'installent quand on l'ouvre avec Internet.

L'application fonctionne dans un navigateur, sans internet une fois installée.
Les données restent sur l'appareil.

## Sur un ordinateur — Windows, macOS, Linux

1. Décompressez le dossier reçu, par exemple `cs-pobe` ou `ecole-pobe`.
2. **Windows** : double-cliquez sur `demarrer-windows.bat`.
   **macOS ou Linux** : ouvrez un terminal dans le dossier, puis
   `chmod +x demarrer.sh` une seule fois, et `./demarrer.sh` ensuite.
3. Le navigateur s'ouvre sur `http://localhost:8080`.
4. Laissez la fenêtre noire du serveur ouverte tant que vous travaillez.

Le lanceur cherche Node.js, puis Python. Si aucun des deux n'est présent,
installez Node.js depuis `nodejs.org`, version LTS.

**Pour l'ajouter au bureau** : dans Chrome ou Edge, une fois la page ouverte,
menu ⋮ → *Installer* (ou l'icône d'écran avec une flèche dans la barre
d'adresse). L'application obtient sa propre fenêtre et son raccourci, sans barre
de navigateur.

### Sans lanceur

Vous pouvez ouvrir `index.html` par double-clic. Tout fonctionne, sauf la lecture
des classeurs `.xlsx` : les navigateurs refusent de les décompresser depuis un
fichier local. Les fichiers `.csv` s'importent, eux, dans tous les cas.

## Sur une tablette ou un téléphone Android

L'appareil n'exécute pas de serveur : il faut que l'application soit servie
depuis un ordinateur du même réseau, ou déposée en ligne.

### Depuis un ordinateur du même réseau — sans internet

1. Lancez l'application sur l'ordinateur comme ci-dessus.
2. Relevez l'adresse locale de l'ordinateur :
   - Windows : `ipconfig` dans l'invite de commandes, ligne « Adresse IPv4 » ;
   - macOS ou Linux : `hostname -I` ou `ifconfig`.
   Vous obtenez quelque chose comme `192.168.1.24`.
3. Sur la tablette, connectée au **même réseau** — même box, même partage de
   connexion —, ouvrez Chrome et saisissez `http://192.168.1.24:8080`.
4. Menu ⋮ → **Ajouter à l'écran d'accueil**. Une icône apparaît, et
   l'application s'ouvre en plein écran.

### Depuis un hébergement en ligne

Déposez le dossier sur un hébergement de pages statiques — Netlify Drop convient
et ne demande pas de compte pour un essai : ouvrez `app.netlify.com/drop` et
glissez le dossier. Vous recevez une adresse en `https://…` utilisable depuis
n'importe quel appareil, et l'ajout à l'écran d'accueil fonctionne de la même
façon.

## Sur iPhone ou iPad

Même principe, avec Safari : ouvrez l'adresse, puis bouton **Partager** →
**Sur l'écran d'accueil**. Chrome sur iOS ne propose pas cette option.

## Ce qu'il faut savoir avant de distribuer

**Les données ne circulent pas entre les appareils.** Chaque installation a sa
propre base, dans le navigateur de l'appareil. Une saisie faite sur la tablette
n'apparaît pas sur l'ordinateur.

Pour transporter les données : *Sauvegarde* → **Exporter**, puis **Importer** sur
l'autre appareil. C'est aussi la seule protection contre la perte : vider les
données du navigateur efface tout. Exportez régulièrement.

**Chaque école a sa propre application.** Le dossier `ecole-pobe` est destiné aux
établissements : à la première ouverture, le directeur inscrit le nom de son
école, et les écrans de la circonscription n'y figurent pas. La circonscription
garde `cs-pobe`.

## Hébergement sur GitHub Pages (recommandé pour tablettes et Android)

1. Créez un dépôt GitHub et déposez-y tout le contenu du dossier (branche `main`).
2. *Settings → Pages → Source : GitHub Actions*. Le fichier
   `.github/workflows/pages.yml` publie l'application et régénère la liste des
   fichiers du cache hors ligne.
3. Ouvrez `https://<utilisateur>.github.io/<dépôt>/` sur chaque appareil, puis
   *Installer* (PC) ou *Ajouter à l'écran d'accueil* (Android, tablette).

L'adresse https est indispensable pour la caméra du module Bilans en dehors de
`localhost`.

Conception : Maître Aimé FACHE — Tél. 01 96 51 03 33.
