# CS Pobè — gestion des écoles

Application locale pour la circonscription scolaire de Pobè. Elle fonctionne
sans réseau : toutes les données restent dans le navigateur de l'ordinateur qui
l'utilise.

## Installer l'application

Le fichier `INSTALLATION.md` détaille la marche à suivre sur ordinateur, sur
tablette et sur Android. En résumé : le lanceur ouvre l'application sur
l'ordinateur ; une tablette du même réseau y accède par l'adresse locale de
l'ordinateur, puis l'ajoute à son écran d'accueil.

## Attribution des classes

*Menu → Attribution des classes.* Chaque cours reçoit son titulaire, choisi parmi
les enseignants en poste de l'école, avec sa salle. L'effectif du cours est repris
du relevé. Le cours tenu de l'enseignant suit son attribution.

Un enseignant attribué à deux cours est **signalé, pas interdit** : les classes
jumelées existent. Quatre indicateurs donnent les cours à pourvoir, les cours
pourvus, les enseignants en poste et ceux sans classe.

## Répertoires et contacts

*Menu → Répertoires et contacts.* Quatre onglets.

**Directeurs par secteur** : les écoles séparées en EP publiques, EP privées, EM
publiques et EM privées, chacune avec son arrondissement, sa zone, son unité
pédagogique, son directeur et son contact. Quatre compteurs disent, secteur par
secteur, combien d'écoles ont un directeur nommé.

**Conseillers pédagogiques** : un par zone, avec son contact et le nombre
d'écoles dont il a la charge. Son nom apparaît ensuite sur les rapports de
visite qu'il signe.

**Unités pédagogiques** : chacune avec son arrondissement, son nombre d'écoles,
son RUP et son co-RUP avec leurs contacts. On peut en ajouter et en retirer.
**Une unité à laquelle des écoles sont rattachées ne peut pas être supprimée** —
l'application dit combien et invite à les rattacher ailleurs d'abord. Renommer
une unité suit les écoles concernées. L'UP Agbarou est ajoutée au référentiel.

**Comité d'évaluation** : ses membres, leur qualité, leur fonction et leur
contact, avec ajout, modification et suppression.

Le bouton *Télécharger* produit les quatre répertoires dans un seul fichier.

## Gestion collégiale

*Menu → Gestion collégiale.* Les onze instances de l'école — APE, AME, comité de
direction, conseil des maîtres, comités de cantine, santé, livre, espace vert,
gouvernement des enfants, genre, réception du matériel — avec leurs membres,
leur fonction, leur sexe, leur contact et leur date d'entrée.

La fonction **responsable des activités sportives (RAS)** figure parmi les
fonctions proposées.

Le tableau de tête indique combien d'instances sont constituées, le nombre de
membres, la part de femmes et les présidents désignés.

## Signatures du personnel

Sur la page *Cachets et signatures*, sous les écoles, chaque agent en poste peut
enregistrer sa signature, tracée à l'écran. Elle sert aux registres, aux relevés
et aux bulletins. Elle reste sur cet ordinateur.

## Lancer l'application

**Windows** — double-cliquez sur `demarrer-windows.bat`.
**macOS et Linux** — `chmod +x demarrer.sh` une fois, puis `./demarrer.sh`.

Le navigateur s'ouvre sur `http://localhost:8080`. Laissez la fenêtre du serveur
ouverte tant que vous travaillez.

Vous pouvez aussi ouvrir `index.html` par double-clic : tout fonctionne, sauf
la lecture des classeurs `.xlsx`, que les navigateurs refusent depuis un fichier
local. Passez par le lanceur pour l'import Excel.

À défaut de Node.js, les lanceurs se rabattent sur Python. Sinon, installez
Node.js depuis nodejs.org, version LTS.

## Ce qui a été corrigé

- **Les filtres et les recherches ne se déclenchaient pas** dans plusieurs pages :
  ils sont maintenant branchés depuis le code, pas depuis le HTML.
- **La liste des écoles s'ajoutait à chaque ouverture** dans certains cas : le
  chargement initial ne se fait qu'une fois, et seulement si la base est vide.
- **Le total des effectifs ne se recalculait pas** quand on saisissait les totaux
  à la main. Il suit maintenant le tableau par âge dès qu'il est rempli.
- **Un courrier changé de sens à l'édition se dupliquait** : il est désormais
  déplacé d'une liste à l'autre.
- **L'acte de retraite plantait** quand le grade était vide.
- **Les noms d'écoles et d'agents apparaissaient sans protection** dans les
  tableaux : un nom contenant un chevron cassait l'affichage. Tout est échappé.
- **Supprimer une école laissait son personnel orphelin** en silence :
  l'application prévient maintenant du nombre d'enregistrements rattachés.
- **Aucune vérification** ne portait sur les salles : les salles utilisées ne
  peuvent plus dépasser les salles existantes.
- **La sauvegarde acceptait n'importe quel fichier JSON** : elle vérifie
  maintenant qu'il s'agit bien d'une sauvegarde de cette application.
- **L'impression sortait toute la page**, menu compris : une feuille de style
  d'impression ne garde plus que le document.

## L'import Excel

*Menu → Import Excel*, ou le bouton **📥 Importer** présent sur chaque page
concernée. Six modèles : écoles, personnel, effectifs, infrastructures,
mobilier, candidats au CEP.

Le fonctionnement est le même à chaque fois :

1. Choisissez ce que vous importez.
2. Déposez le classeur `.xlsx` ou `.csv` dans le cadre, ou cliquez pour le
   choisir.
3. L'application reconnaît les colonnes d'après leur intitulé et vous montre ce
   qu'elle a compris, colonne par colonne. Vous pouvez corriger chaque
   correspondance, ou en ignorer.
4. Un aperçu des huit premières lignes s'affiche.
5. Rien n'est enregistré tant que vous n'avez pas validé.

**Ce que l'application sait reconnaître.** Les intitulés courants et leurs
variantes : « Nom », « Nom et prénoms », « Noms et Prénoms » ; « École »,
« Etablissement », « Affectation » ; « Garçons », « Total G », « Masculin ». Les
accents et la casse n'ont pas d'importance.

**Les dates** sont acceptées au format 12/03/1970, 1970-03-12, ou en numéro de
série Excel. **Le sexe** accepte M, F, Masculin, Féminin, Homme, Femme.

**Le rattachement aux écoles.** Pour le personnel, les effectifs, les
infrastructures, le mobilier et le CEP, la colonne « École » sert à retrouver
l'établissement dans la liste. Le rapprochement tolère la casse et les accents,
et accepte aussi le code de l'école. Une ligne dont l'école reste introuvable est
écartée, et l'application vous dit combien.

**Pas de doublon.** Réimporter le même fichier met à jour les enregistrements
existants au lieu de les recréer. Le rapprochement se fait sur le matricule et le
nom pour le personnel, sur l'école et l'année pour les effectifs, sur l'école et
la désignation pour le mobilier.

## Ce qui vient d'être ajouté

**Années scolaires.** L'année active se choisit dans l'en-tête ; elle sert de
référence partout, notamment pour arrêter les anciennetés au 31 décembre. La page
*Années scolaires* permet d'en ajouter et d'archiver les précédentes. L'année en
cours est 2026-2027.

**Zone et unité pédagogique.** Chaque école y est rattachée, avec deux filtres
supplémentaires dans la liste et deux colonnes dans le tableau. Les unités déjà
saisies sont proposées à la frappe.

**Personnel administratif et personnel de soutien** ont chacun leur page. Un
agent porte désormais une catégorie : enseignant, administratif ou soutien.

**Carrière.** La fiche d'un agent accueille les trois prises de service —
fonction publique, département, école — et les notes d'évaluation de 2022 à 2026.
Les anciennetés et la moyenne des notes se calculent seules et s'affichent
pendant la saisie, arrêtées au 31 décembre de l'année active. L'indice actuel et
l'indice payé sont distingués.

**Analyses et écarts.** Trois tableaux : l'écart entre garçons et filles avec
l'écart type entre écoles ; les classes autorisées comparées aux classes
ouvertes ; et le besoin ou le surplus d'enseignants, une classe valant un maître,
le directeur étant déchargé à partir de six classes. Les écoles dont le personnel
n'est pas encore saisi sont signalées comme telles et sortent du déficit cumulé —
les confondre gonflerait le chiffre de la circonscription sans rien dire de réel.

**Téléchargement.** Chaque module a son bouton : écoles, personnel des trois
catégories, effectifs, infrastructures, mobilier, candidats au CEP, analyses. Le
fichier produit est un CSV encodé en UTF-8 avec point-virgule, qu'Excel ouvre
directement. Les colonnes calculées — anciennetés, moyenne des notes, date de
retraite — y figurent.

## Import des états du personnel de la circonscription

Les fichiers `CS_POBE_FE__ACDPE_2026.xlsx` et `CS_POBE_AME_2026.xlsx` s'importent
tels quels, sans être retouchés : *Import Excel → Personnel*, puis on dépose le
fichier. L'application reconnaît leurs intitulés — « N° Matricule »,
« Nom Poste », « Date 1ère Prise Serv », « Note Evaluation 2024 », « Le Genre »,
« Identifiant A.M.E. »… — et recolle le nom et les prénoms, qui y sont dans deux
colonnes séparées.

Les agents en poste au bureau de la circonscription n'ont pas d'école : plutôt
que de les écarter, l'application les range dans le **personnel administratif**
en conservant leur poste (DAF/CS Pobè, DS/CS Pobè…). Sur les deux fichiers réels,
431 agents sont repris, dont 35 au bureau.

## Les écoles maternelles

La liste est complétée d'après le rapport de fin d'année de la circonscription :
**18 maternelles publiques et 13 privées**, contre 8 privées auparavant. Les
neuf qui manquaient sont ajoutées — Grain de Soleil, Espoir de Pobè, Foursquare,
Réveil du Plateau, Lumière du Plateau, Immaculée Conception, La Sainte Trinité,
et les Jardins d'enfants Divins Trésors — avec leur année de création.

Chaque maternelle porte désormais sa **zone pédagogique** : zone 1 pour les sept
écoles de Pobè, zone 2 pour Okéita, Illoulofin, Ibéré, Ahoyeye et
Onigbolo-Usine, zone 3 pour Abodjoukpa, Akpaté, Eguelou, Igbo-Édé, Ogouba et
Towè.

Une installation déjà en service se complète toute seule à l'ouverture : les
écoles manquantes sont ajoutées, les zones vides renseignées, et **rien de ce
que vous avez saisi n'est touché**. Ouvrir l'application deux fois n'ajoute rien
la seconde fois.

## Effectifs des apprenants

Le fichier `donnees/effectifs-CS-POBE.csv`, livré avec l'application, contient
les effectifs réels de la circonscription tirés de vos statistiques : **150
écoles, publiques et privées, l'effectif de chaque cours par sexe**, du CI au
CM2. Il s'importe depuis *Import Excel → Effectifs* et donne 27 490 apprenants —
24 172 au primaire, 3 318 en maternelle.

Trois écoles privées de vos statistiques manquaient au référentiel : La Sainte
Trinité, Makaz Al Amir et PCA Pobè. Elles sont ajoutées, ce qui porte la
circonscription à 155 écoles.

À la saisie comme à l'import, le **détail par cours commande les totaux** : si
vous renseignez le tableau CI-CM2, les totaux garçons et filles s'en déduisent,
puis le total général. Les valeurs restent modifiables école par école ; corriger
une case de cours met les totaux à jour immédiatement.

Les colonnes par cours partent aussi dans le fichier téléchargé depuis la page
Effectifs.

## Répartition par âge et par sexe

*Analyses → Répartition par âge.* Le relevé d'effectifs de chaque école porte une
grille **âge × cours × sexe**, des moins de 5 ans aux 16 ans et plus. L'onglet la
cumule pour la circonscription : une ligne par tranche, deux colonnes par cours,
et l'ensemble garçons, filles, total. Les tranches que personne n'a renseignées
ne sont pas affichées.

Quatre indicateurs accompagnent le tableau : le nombre d'écoles ayant réellement
ventilé, les apprenants ventilés, la part des **12 ans et plus** — en retard quel
que soit le cours, l'âge normal allant de 6 ans au CI à 11 ans au CM2 — et la
part des moins de 6 ans. Un filtre sépare le public du privé.

Cette même répartition ferme le fichier téléchargé depuis la page Analyses.

## Personnel par statut

*Analyses → Personnel par statut.* Le personnel en poste est ventilé par **statut
— FE, ACDPE, AME, privé — et par rôle**, directeur ou collaborateur, avec les hommes,
les femmes, le total, la part de femmes, le nombre d'écoles concernées et
l'écart type du nombre d'agents par école.

Les **AME ne sont pas répartis par rôle** : ce sont des agents mis à disposition,
sans fonction de direction ; les distinguer aurait créé une ligne vide.

L'écart type est calculé sur **toutes les écoles du périmètre**, celles sans
agent du groupe comptant pour zéro : autrement il ne dirait que la dispersion
là où le groupe est déjà présent, ce qui masquerait sa concentration.

Deux filtres : le cycle — primaire, maternelle, public, privé — et la catégorie
d'agent — enseignant, administratif, soutien. Le fichier téléchargé reprend la
ventilation pour le primaire, pour la maternelle, puis pour l'ensemble.

Sur vos 431 agents, le contraste ressort tout de suite : **30 % de femmes dans le
primaire contre 79 % en maternelle**, et 13,6 % seulement chez les directeurs FE
du primaire.

## En-tête officiel des documents

Toutes les fiches et tous les certificats portent le même en-tête : les armoiries
à gauche, au centre « RÉPUBLIQUE DU BÉNIN », le **filet aux trois couleurs
nationales** — vert, jaune, rouge —, le ministère, la direction départementale du
Plateau, la circonscription et, le cas échéant, l'école.

L'en-tête suit la disposition des imprimés du ministère : les armoiries à
gauche, le ministère et la République au centre séparés par le filet, les
coordonnées à droite ; en dessous, à gauche, la direction départementale, la
circonscription et l'école séparées par les étoiles, puis le numéro d'ordre.

**Les armoiries de la République sont livrées avec l'application** et s'affichent
d'office, sans dépôt ni accès au réseau. La circonscription peut déposer les
siennes, qui prennent alors le pas.

Le sceau ou logo se dépose de la même façon depuis *Cachets et
signatures* : deux images, réduites puis conservées sur cet ordinateur, reprises
ensuite par tous les documents. Tant qu'elles ne sont pas déposées, le drapeau
national tient leur place — l'application ne redessine pas les armoiries, elle
affiche celles qu'on lui donne.

## Fiche d'inscription au CEP

*Menu → Inscription CEP.* La fiche suit le formulaire de la Direction
départementale, sous l'en-tête du **Service des Examens et Concours** :

- l'option — CEP, ou CEP et entrée en 6e ;
- la session et le centre de composition, choisi parmi les sept centres ;
- l'école de provenance, dont la commune, la circonscription, le **statut public
  ou privé coché**, le nom et le contact du directeur sont repris de sa fiche ;
- le candidat, avec le **nom en capitales et les prénoms séparés**, le sexe
  coché, la date et le lieu de naissance, le numéro EDUCMaster et sa **photo** ;
- les **trois établissements choisis** par ordre de préférence ;
- la résidence des parents, les dispenses d'âge et de sport, cochées ;
- les signatures du parent — avec son degré de parenté et son contact — et du
  candidat, puis celle du directeur avec son cachet et le code QR ;
- le cadre **réservé à la DDEMP** : dossier étudié par, code, collationné par.

Le bouton 📋 de la liste des apprenants remplit tout ce que l'école connaît déjà.

## Diplômes reconnus

La fiche d'un agent propose les diplômes du ministère : **CEP, BEPC, BAC,
LICENCE, MAITRISE, MASTERS, DOCTORAT** pour l'académique ; **CEAP, CAP/EP,
CAP/EM, CAFCP, CAIP** pour le professionnel.

## Certificats administratifs

*Menu → Certificats.* Onze modèles, repris des imprimés de la circonscription :

- certificat de présence au poste, signé par le chef de circonscription ou par
  le directeur ;
- certificat de travail ;
- certificat de prise de service, signé par le chef de circonscription ou par le
  directeur ;
- attestation de direction ;
- certificat de prise en charge ;
- **attestation de présence au poste** des agents du programme de pré-insertion :
  période, jours de présence, ponctualité, visas du représentant de l'APE et du
  conseiller pédagogique, et **contreseing du chef de circonscription** avec son
  cachet ;
- **certificat de reprise de service**, visé par le conseiller pédagogique et
  l'APE ;
- **fiche d'évaluation de l'agent contractuel de l'État**, sous l'en-tête de la
  Direction de l'Administration et des Finances, avec les deux grilles de
  notation — supérieur hiérarchique et comité de direction — sur les huit
  critères réglementaires. Les totaux et la classe de performance se calculent :
  16,5 sur 20 donne « Classe II — Bonne performance » ;
- **certificat de scolarité** d'un élève : la liste bascule alors sur les
  apprenants, et le document reprend la filiation, le matricule EDUCMaster, le
  NPI, la classe et les appréciations.

Le certificat **reprend la fiche de l'agent** : état civil, lieu de naissance,
première prise de service, matricule, NIP, corps et grade, affectation, fonction,
indice. Seules les références de l'acte et les mentions propres au certificat
restent à saisir, et elles sont conservées.

Le document sort **au format A4**, avec l'en-tête réglementaire, le numéro
d'ordre, le corps du texte, la formule de clôture, puis le cachet, la signature
et le code QR. Un certificat signé par le directeur porte le cachet de son école ;
signé par le chef de circonscription, celui de la circonscription. L'impression
permet l'enregistrement en PDF.

Le nom du signataire se règle dans *Cachets et signatures* : sans lui, le
certificat le signale au lieu de laisser une ligne muette.

## Fiches officielles

*Menu → Fiches officielles.* On choisit une école et l'une des trois fiches —
recensement annuel, rapport de rentrée, rapport de fin d'année — et **elle se
remplit toute seule** avec ce que l'application sait déjà : identification,
localisation, zone et unité pédagogique, classes autorisées et ouvertes, salles,
effectif par cours et par sexe, état nominatif du personnel enseignant, locaux.

Les rubriques que l'application ne peut pas déduire suivent **le formulaire
officiel, section par section** : environnement socio-économique avec les sept
distances et les cinq états de route, accessibilité, établissements
environnants et eau potable, domaine et commodités, latrines et bibliothèque,
organes de gestion, langues d'enseignement, résultats au CEP, gestion
participative, données financières, puis remplissage et visas. **120 rubriques
pour une école primaire**, 118 pour une maternelle — celle-ci n'a pas de rubrique
CEP mais reçoit ses propres questions sur l'aire de jeu et les modules de
latrines.

Chaque section indique combien de ses rubriques sont renseignées, et un compteur
général donne l'avancement.

Deux totaux se calculent au lieu d'être saisis : le **budget de l'année en
cours**, somme du solde antérieur, de la subvention, des cotisations et des
autres ressources ; et le **taux de réussite au CEP**, à partir des composants et
des admis par sexe.

Une rubrique laissée vide ne figure pas sur le document imprimé — mieux vaut une
fiche courte qu'une page de pointillés.

Un bandeau annonce ce qui manque encore, nommément : « il manque la date de
remplissage », « l'effectif des apprenants ». Les rubriques que l'application ne
peut pas déduire — cantine, gestion collégiale, références des actes, signataires
— se saisissent en dessous. **Elles sont conservées et reprises d'une fiche à
l'autre** : ce qui est renseigné pour le recensement se retrouve sur le rapport
de rentrée.

La fiche s'édite avec son cachet, sa signature et son code QR. Le bouton
d'impression permet de l'enregistrer en PDF, et le bouton Excel produit le même
contenu au format tableur, rubrique par rubrique, avec l'effectif par cours et
l'état du personnel.

## Visites de classe et inspections

*Menu → Visites et inspections.* Deux types : la **visite de classe**, conduite
par le conseiller pédagogique, et l'**inspection d'école**, conduite par le chef
de circonscription.

Le formulaire s'adapte au type retenu.

Pour une **visite de classe** : la date, le jour, l'école, l'enseignant — la
liste suit l'école choisie —, le cours, la **matière**, la séquence observée,
l'effectif présent et la note.

Pour une **inspection d'école** : les seize pièces qu'un inspecteur examine —
registre matricule, registres d'appel, relevés de fréquentation, cahier de
visites, cahier de conférences, registre du courrier, cahiers de textes, fiches
de progression, registre des notes, cahier du conseil des maîtres, registres APE
et AME, cahier de caisse, inventaire, registre de cantine, dossiers du personnel,
emploi du temps — chacune avec son état constaté : tenue à jour, tenue
partiellement, non tenue, inexistante. Une pièce laissée vide n'a pas été
examinée et ne figure pas au rapport.

Dans les deux cas : points forts, points à améliorer et **recommandations**.

Le **rapport de visite** s'édite en A4 sous l'en-tête officiel, et porte le
cachet et la signature de son auteur : le conseiller pédagogique **de la zone de
l'école** pour une visite de classe, le chef de circonscription pour une
inspection. Chaque zone pédagogique a désormais son cachet, aux côtés des trois
services de la circonscription.

Un tableau donne la **couverture par zone** : écoles, enseignants, visites,
inspections, enseignants effectivement visités et part de couverture. Cette part
n'est calculée que là où le personnel est saisi — ailleurs l'application le dit,
plutôt que d'afficher un zéro qui ne voudrait rien dire.

**Les pièces des agents du programme de pré-insertion** — attestation de présence
au poste, certificat de reprise de service — sont contresignées par le conseiller
pédagogique de la zone de l'école. Si la zone n'est pas renseignée, le document
le signale au lieu de faire signer n'importe qui.

## Gestion des carrières

*Menu → Gestion des carrières.* On choisit un agent dans la liste de gauche ; sa
carrière s'affiche à droite : grade, statut, fonction, indices actuel et payé,
les trois anciennetés arrêtées au 31 décembre, la moyenne de ses notes, sa date
de départ et le temps qui l'en sépare.

Le **déroulé de carrière** reconstitue les étapes datées dans l'ordre : entrée
dans la fonction publique, arrivée dans le département, changements d'école,
avancements, prise de service actuelle et, le cas échéant, mutation ou décès.

Le bouton **Avancement** enregistre un changement de grade avec sa date, son
indice et la référence de l'acte. L'ancien grade reste dans le déroulé, et **la
date de retraite est recalculée** : un agent passant de B1-6 à A3-5 voit son
départ reculer du 1er avril 2028 au 1er avril 2030, puisque l'âge passe de 58 à
60 ans.

La **fiche de carrière** s'imprime avec l'état civil, la situation, les
anciennetés, les notes, le déroulé complet, puis le cachet de la Division de
l'Organisation Scolaire et de la Prévision, sa signature et le code QR. Le
fichier téléchargé contient une ligne par agent, avancements et écoles
précédentes compris.

## Situation administrative des enseignants

Chaque agent porte sa situation, visible en tête de ligne : **en poste, affecté
dans une autre école, muté hors circonscription, détaché, admis à la retraite ou
décédé**. Le bouton 🔀 la change.

Pour une **affectation dans la circonscription**, on choisit l'école d'accueil :
l'agent y est rattaché, l'école quittée est conservée dans son historique avec la
date et la référence de l'acte, et sa prise de service dans l'école est mise à
jour. Sans école d'accueil choisie, l'application refuse et propose la mutation
hors circonscription.

Le bouton 🔀 est présent sur les trois pages du personnel — enseignant,
administratif et soutien — et la situation figure en tête de chaque ligne. Après
le changement, l'application reste sur la page où vous étiez.

**Un agent muté, décédé, détaché ou retraité sort des effectifs** : il ne compte
plus dans les enseignants en poste, ni dans le calcul des besoins, ni dans les
prévisions de retraite. Le compter masquerait un poste vacant. Le filtre affiche
par défaut les agents en poste ; « Toutes situations » les montre tous.

## Départ à la retraite

L'âge dépend du grade : 60 ans en catégorie A, 58 en B, 55 en C, D et E. **Un
agent sans grade n'a pas de date de départ** — l'application affiche un tiret au
lieu d'inventer une échéance.

La date effective est le **premier jour du trimestre qui suit l'anniversaire** :

| Né entre | Départ |
|---|---|
| janvier et mars | 1er avril |
| avril et juin | 1er juillet |
| juillet et septembre | 1er octobre |
| octobre et décembre | 1er janvier de l'année suivante |

## Listes des apprenants

*Menu → Listes des apprenants.* Chaque apprenant porte son nom et ses prénoms
séparés, son sexe, sa naissance, son NPI, son matricule EDUCMaster, sa filiation,
son école, son cours, et sa **photo**. La photo est réduite sur l'appareil avant
d'être conservée : une photo d'appareil pèse plusieurs mégaoctets, la mémoire du
navigateur est limitée.

Les apprenants **s'importent depuis un classeur**. Les dates sont acceptées en
19/02/2015 comme en 2015-02-19, et le sexe s'écrit M, G, Masculin, F, Fille — tout
est ramené à la même écriture.

La **liste nominative d'une classe** s'édite en choisissant une école et un cours :
elle porte les photos, le NPI, le matricule, une colonne d'émargement, puis le
cachet, la signature et le code QR. Sans école ni cours, l'application refuse
plutôt que de sortir une liste de toute la circonscription.

Le bouton **📋 de chaque ligne inscrit l'apprenant au CEP** : sa fiche est remplie
avec ses données — nom, naissance, lieu, acte, NPI, père, mère, école, photo —
sans une seule ressaisie. Un apprenant déjà inscrit est signalé au lieu d'être
dupliqué.

Le bouton **EDUCMaster** produit le classeur au format attendu : les apprenants
avec nom et prénoms en colonnes séparées, suivis des enseignants de l'école.

## Notes et bulletins

*Menu → Notes et bulletins.* On choisit une école, un cours et une période, puis
on saisit les notes des onze matières **directement dans le tableau**. Le total,
la moyenne, le nombre de maîtrises, le seuil et le rang se recalculent à la
frappe. Une case laissée vide n'est pas comptée zéro : la matière sort du calcul,
et le seuil s'ajuste — six maîtrises sur neuf matières composées, huit quand les
onze le sont.

Si le cours choisi est le CI et la période la première sommative, l'application
le dit et n'affiche aucun tableau.

Le **bulletin** d'un apprenant s'édite d'un bouton : son identité avec NPI et
matricule, ses onze notes avec l'appréciation de chacune, son total, sa moyenne,
ses matières maîtrisées, son rang dans la classe, la moyenne de la classe et le
seuil atteint ou non — puis le cachet, la signature et le code QR.

Le **relevé de la classe** réunit tous les apprenants sur une page, et le fichier
téléchargé reprend le détail matière par matière.

## Évaluations

*Menu → Évaluations.* Le calendrier de l'année est posé : **six formatives**
mensuelles — octobre, novembre, janvier, février, avril, mai — et **trois
sommatives** trimestrielles en décembre, mars et juin, numérotées de 1 à 3.

**Le CI ne compose pas la première sommative** : il ne figure pas dans la liste
des cours quand cette période est choisie. Les onze matières sont définies :
communication orale, dictée, expression écrite, compréhension de l'écrit,
anglais, mathématique, EST, ES, EA vivant, EA plastique, EPS.

Une matière est maîtrisée à partir de 10 sur 20. Le seuil demande **six
maîtrises sur neuf matières composées**, et **les deux tiers — soit huit — quand
les onze sont composées**.

Chaque relevé porte les inscrits, ceux qui ont composé et ceux qui ont atteint le
seuil, par sexe. Les taux et l'appréciation se calculent, et l'aperçu les montre
pendant la saisie. **Un relevé incohérent est refusé** : on ne peut pas déclarer
plus de reçus que de composants, ni plus de composants que d'inscrits.

Trois synthèses suivent, **par cours, par école et par unité pédagogique**, et le
procès-verbal les réunit avec le cachet, la signature et le code QR. Le fichier
téléchargé contient le détail par école suivi des trois synthèses et de
l'ensemble de la circonscription.

## Examen blanc de la circonscription

*Menu → Examen blanc.* Les **sept centres** sont créés d'office : Pobè centre,
Oké-Ola, Pobè/C, Oké-Ata, Pobè-Nord, Onigbolo, Towé. Chacun se règle — nom du
chef de centre, date de composition, session.

Les candidats s'ajoutent à la main ou **s'importent depuis un classeur** dont les
colonnes reprennent votre relevé : n° d'ordre, noms et prénoms, sexe, école de
provenance, puis les **neuf épreuves** — dictée, communication écrite,
compréhension de l'écrit, mathématique, EST, ES, EA vivant, EA artistique, EPS.
La dictée compte pour elle-même, distincte de la communication écrite. Les
candidats rejoignent le centre affiché à l'écran.

**Tout le reste se calcule.** Total, moyenne, nombre de maîtrises et rang par
candidat ; inscrits, composants et reçus par sexe ; taux de réussite ; moyenne et
écart type du centre ; moyenne, nombre de maîtrises, taux et écart type de chaque
épreuve.

Une épreuve est maîtrisée à partir de **10 sur 20**, et le seuil demande **six
maîtrises sur les neuf épreuves** — six sur huit pour un candidat dispensé d'EPS.
Le nombre de maîtrises exigées ne bouge pas : c'est le nombre d'épreuves
composées qui change. Une case laissée vide n'est pas comptée zéro, l'épreuve
sort du calcul. Un candidat sans aucune note est compté absent, pas recalé.

**Les recommandations sont tirées des chiffres du centre**, pas d'un texte
passe-partout : elles nomment les épreuves sous 60 % avec leur moyenne, signalent
un écart de genre au-delà de dix points, un écart type élevé, ou les absents à
retrouver avant la session.

Le **procès-verbal du centre** s'édite avec le classement complet, le tableau de
participation par sexe, les recommandations, le cachet, la signature et le code
QR. La synthèse du bas réunit les sept centres et la circonscription.

## Affichage

L'en-tête et le menu **restent en place au défilement** : seule la zone de travail
bouge. Sur un écran étroit, tout défile ensemble — figer le menu y mangerait la
moitié de la hauteur utile.

## Cachets, signatures et codes QR

*Menu → Cachets et signatures.* La circonscription et chacune des 155 écoles ont
leur cachet et leur signature.

**Le cachet est dessiné par l'application** : trois lignes — l'arc du haut, le
texte central, l'arc du bas — et une encre bleue, rouge ou noire. L'aperçu se
redessine à la frappe.

Les deux arcs sont **étirés d'une étoile à l'autre**, de sorte que le texte
remplisse la couronne au lieu de flotter au milieu. Le texte central **se replie
sur plusieurs lignes** quand il est long, centré sur le cercle intérieur sans
jamais le traverser : « Le Chef de la Circonscription Scolaire » tient sur trois
lignes et n'atteint que 47 unités pour un cercle intérieur de 68.

La circonscription a **trois cachets**, chacun avec sa signature :

- le **Chef de la Circonscription Scolaire** ;
- le **Secrétariat**, texte central « Le Secrétariat » ;
- la **Division de l'Organisation Scolaire et de la Prévision**, texte central
  « Le C/DOSP ».

Tous trois portent « RÉPUBLIQUE DU BÉNIN » sur l'arc du haut et
« CIRCONSCRIPTION SCOLAIRE DE POBÈ » sur celui du bas, et s'accompagnent du code
QR de vérification.

**La signature se trace à l'écran**, à la souris ou au doigt sur tablette, et
reste enregistrée sur cet ordinateur. Elle est apposée sur les documents que
vous éditez.

**Chaque document porte un code QR de vérification**, un numéro et une empreinte
calculée sur son contenu : deux documents différents ne peuvent pas porter le
même numéro. Le code QR est produit par l'application elle-même, sans réseau ni
bibliothèque — j'ai vérifié qu'un lecteur indépendant le relit correctement.

Les pièces apparaissent déjà au pied de la fiche d'inscription au CEP et de la
notification de départ à la retraite. Le bouton 👁️ de la page montre ce que cela
donne sur un document réel.

## Écoles à CM2 et candidats au CEP

*Menu → Écoles à CM2 et CEP 2027.* La page liste les écoles dont le CM2 compte au
moins un élève au relevé de l'année active — **82 écoles, 2 295 élèves au CM2**,
dont 1 797 dans le public et 498 dans le privé.

Le nombre de candidats se saisit **directement dans le tableau**, une case pour
les garçons, une pour les filles. Le total, le taux de présentation et le
décrochage — l'écart entre l'effectif du CM2 et les candidats déclarés — se
calculent à la frappe. Une école dont le taux tombe sous 80 % passe au rouge.

La synthèse du bas cumule le primaire public, le primaire privé, puis l'ensemble
de la circonscription. Le taux n'est calculé que sur les écoles ayant déclaré
leurs candidats : compter les autres comme zéro donnerait un taux qui ne veut
rien dire.

Le bouton *Télécharger* produit le détail école par école suivi de cette même
synthèse.

## Synthèse par cycle et par secteur

Les classes autorisées et ouvertes ne sont plus additionnées toutes ensemble.
L'onglet *Analyses → Synthèse de la circonscription* les ventile :

- primaire public, primaire privé, puis **ensemble du primaire** ;
- maternelle publique, maternelle privée, puis **ensemble de la maternelle** ;
- enfin **la circonscription**.

Chaque ligne porte les écoles, les classes autorisées et ouvertes avec leur
écart, les salles utilisées, les garçons, les filles, le total, les enseignants
en poste, les enseignants requis et l'écart. Cette même ventilation ferme le
fichier téléchargé depuis le bouton *Télécharger* de la page Analyses.

## Sauvegardez

Les données vivent dans ce navigateur, sur cet ordinateur. Vider le cache, ou
changer de machine, et tout est perdu. Exportez régulièrement depuis
*Sauvegarde* : le fichier JSON produit est votre seule copie.

## Mise à jour — bilans, documents de référence, installation

**Conception : Maître Aimé FACHOLA — Tél. +229 01 96 51 03 33.** Le bandeau du ministère
figure en tête de chaque document imprimé et la mention de conception en pied de
page.

### Bilans trimestriels et annuel — *Menu → Bilans trimestriels / annuel*

Canevas du bilan trimestriel des activités pédagogiques (niveau CS), pour le
**niveau zone** (conseiller pédagogique) et le **niveau circonscription**
(chef de circonscription), en **T1, T2, T3 et annuel**.

- Tableaux 1 à 5 : réseau d'animation, visites et inspections, visites d'écoles,
  suivis de directeurs, séances d'UP, formations, concertations, taux de
  couverture, évaluations d'étape. Les cellules grisées se calculent seules
  (totaux, pourcentages), avec contrôles de cohérence.
- Analyses (6) pré-rédigées à partir des chiffres, à relire et ajuster ; difficultés
  (7) classées par ampleur ; commentaires et perspectives.
- **Σ Consolider** : le bilan annuel cumule les trois trimestres ; le bilan CS
  reprend les bilans de zone.
- **Charger** (JSON), **PDF / Imprimer** (paysage, avec bandeau et annexe photos),
  **Excel** (.xls), **JSON**, **Réinitialiser**, **Supprimer**, **Finaliser**.
- **Appareil photo** : caméra **avant ou arrière** (bouton de bascule), photo native
  du téléphone ou galerie. Les photos sont rangées avec le bilan (IndexedDB),
  légendables, et sorties en annexe du PDF.
- Échange CP → CCS : le CP exporte son bilan en JSON (photos comprises) ; le CCS le
  charge puis consolide.
- Ce menu est réservé à la circonscription ; il n'apparaît pas dans l'application d'école.

### Documents de référence — *Menu → Documents de référence*

Fiches de recensement (maternelle inclusive, primaire avec guide) en PDF, thèmes
2026-2027 (UP, conférences, formations groupées, avec suivi « réalisé »),
planification CI → CM2 (recherche plein texte) et règlement intérieur numérisé.
Tout fonctionne hors ligne.

### Installation et hébergement

Voir `INSTALLATION.md`. Publié sur GitHub Pages (https), l'application s'installe
sur PC, tablette et Android avec son propre cache hors ligne ; la caméra exige
https ou localhost. Après toute modification d'un fichier : `node tools/gen-assets.mjs`.


## Mise à jour — effectifs par âge, synoptique, espaces des divisions, cachets

- **Effectifs par âge, zone et CS** (menu Administration) : effectifs par âge, par sexe et par cours (CI → CM2), avec le total qui est la somme des écoles et des classes de la zone ou de la circonscription ; synthèse par cours ; **courbes d'âge** (garçons / filles, puis une courbe par cours) ; impression / PDF, Excel, export CSV réimportable et import Excel ou CSV.
- **Tableau synoptique** : écoles, classes, salles, enseignants et élèves par secteur (public / privé) et par cycle (EM / EP), pour la circonscription, une zone, une unité pédagogique ou une école ; répartitions par zone, unité pédagogique et arrondissement ; impression et Excel.
- **Espaces des divisions de la CS de Pobè** : Chef de la CS, Secrétariat, C/DOSP et un espace par zone pédagogique (CP) — titulaire, documents officiels (fiches de recensement, rapports de rentrée et de fin d'année, bilan trimestriel, thèmes d'UP 2026-2027, règlement intérieur), documents propres à la division (stockés sur l'appareil), notes et accès rapides.
- **Cachets** : forme rectangulaire à double filet avec armoiries, comme dans l'application memp-cp ; la forme ronde reste disponible (Cachets et signatures → Régler le cachet → Forme du cachet).

Conçu par Maître Aimé FACHOLA — Tél. +229 01 96 51 03 33
