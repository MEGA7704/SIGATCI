# SIGAT V1.6 — correction runtime Cloudflare

Cette version utilise un bootstrap D1 léger pour fiabiliser `/api/login`. Testez d’abord `/api/ping`, puis `/api/health`.

# SIGAT — Système Intégré de Gestion Administrative et Technique

Projet Cloudflare Pages + GitHub pour une plateforme privée hiérarchique utilisée par les **Directions Régionales**, **Directions Départementales**, **Cantonnements** et **Postes des Eaux et Forêts (PEF)**.

## Principes inclus

- séparation des données par `organization_id` ;
- remontée hiérarchique Direction Régionale → Direction Départementale → Cantonnement → PEF ;
- PEF isolés entre eux ;
- Super Admin séparé des comptes métier ;
- authentification réelle via `POST /api/login` ;
- vérification des mots de passe uniquement côté serveur dans `public/_worker.js` ;
- PBKDF2-SHA-256 avec sel individuel stocké uniquement dans D1 ;
- aucun hash/sel retourné au navigateur ;
- sessions dans KV, cookie `HttpOnly; Secure; SameSite=Lax` ;
- jeton CSRF obligatoire pour les écritures authentifiées ;
- limitation des tentatives par IP et compte pendant 15 minutes ;
- `session_version` pour invalider toutes les sessions après modification/réinitialisation d’un mot de passe ;
- journal des actions sensibles dans D1 ;
- pages séparées pour les modules afin de charger les données à la demande ;
- pagination côté serveur via `/api/load` ;
- plans FREE / STANDARD / BUSINESS ;
- popup Free à la connexion puis toutes les 15 minutes ;
- paiement Wave ouvrant le montant correspondant, sans activation automatique du plan.

## Bindings Cloudflare déjà configurés

### KV

- Binding : `SIGAT_KV`
- Namespace : `SIGAT-KV`
- ID : `8f9ad9cb99bd44b880731cb156c2e00b`

### D1

- Binding : `SIGAT_DB`
- Base : `sigat-d1`
- ID : `ad83e08b-cee9-450e-977d-be4af688656e`

Ces valeurs sont déjà présentes dans `wrangler.toml`.

## 1. Installer Wrangler

```bash
npm install
```

## 2. Appliquer la migration D1

En local :

```bash
npm run db:migrate:local
```

Sur la base distante :

```bash
npm run db:migrate:remote
```

La migration `migrations/0001_init.sql` crée les tables de sécurité, d’abonnement et les tables métier principales.

## 3. Configurer le Super Admin sans publier son mot de passe

**Aucun mot de passe Super Admin n’est fourni dans ce dépôt.**

Configurer les secrets dans Cloudflare. Exemple avec Wrangler selon votre environnement de déploiement :

```bash
wrangler secret put SIGAT_SUPERADMIN_USERNAME
wrangler secret put SIGAT_SUPERADMIN_EMAIL
wrangler secret put SIGAT_SUPERADMIN_PASSWORD
```

Pour un projet Pages géré depuis le tableau de bord Cloudflare, ajouter ces valeurs dans les **Variables et secrets** du projet en choisissant le mode secret pour le mot de passe.

Le compte Super Admin est créé automatiquement côté serveur lors de la première tentative de connexion si aucun Super Admin n’existe et si les secrets sont présents.

> Ne mettez jamais la vraie valeur de `SIGAT_SUPERADMIN_PASSWORD` dans GitHub, le README, `wrangler.toml`, `.dev.vars` committé, une page HTML ou un script navigateur.

## 4. Développement local

Pour les tests locaux, créer un fichier `.dev.vars` non committé :

```text
SIGAT_SUPERADMIN_USERNAME=...
SIGAT_SUPERADMIN_EMAIL=...
SIGAT_SUPERADMIN_PASSWORD=...
```

Puis :

```bash
npm run dev
```

## 5. Déploiement

Le dossier de sortie Pages est `public/` et contient `public/_worker.js` en mode Advanced Worker.

Vous pouvez relier le dépôt GitHub à Cloudflare Pages ou lancer :

```bash
npm run deploy
```

Vérifier dans Cloudflare que les bindings suivants sont visibles par le projet :

- `SIGAT_KV`
- `SIGAT_DB`

et que les secrets Super Admin sont configurés.

## Plans SIGAT

| Plan | Durée | Prix | Accès |
|---|---:|---:|---|
| FREE | 20 jours | 0 FCFA | Complet |
| STANDARD | 30 jours | 20 600 FCFA | Complet |
| BUSINESS | 365 jours | 181 000 FCFA | Complet |

Le bouton Wave utilise :

- Standard : `https://pay.wave.com/m/M_ci_Enx-2JNAklk-/c/ci/?amount=20600`
- Business : `https://pay.wave.com/m/M_ci_Enx-2JNAklk-/c/ci/?amount=181000`

Le clic ou le paiement **ne modifie pas lui-même l’abonnement**. Seule la route Super Admin protégée peut activer un plan.

## Hiérarchie

- une Direction Régionale peut consulter ses Directions Départementales, leurs Cantonnements et les PEF descendants ;
- une Direction Départementale peut consulter ses Cantonnements et les PEF descendants ;
- un Cantonnement peut consulter les PEF directement rattachés ;
- un PEF ne peut consulter que ses propres données ;
- la structure supérieure est en consultation pour les données subordonnées : la modification est réservée au propriétaire de la donnée ;
- le serveur calcule toujours le périmètre à partir de la session, jamais à partir d’un `organization_id` librement fourni par le navigateur.

## Mot de passe oublié

La page de connexion contient **Mot de passe oublié ?** :

- un Administrateur demande l’assistance du Super Admin ;
- un utilisateur normal demande l’assistance de l’Administrateur de sa structure.

Le mot de passe actuel n’est jamais affiché. La réinitialisation produit un mot de passe temporaire affiché une seule fois et force un changement à la prochaine connexion.

## Structure principale

```text
public/
  _worker.js
  index.html
  dashboard/
  personnel/
  missions/
  ...
  superadmin/
  assets/
migrations/
  0001_init.sql
wrangler.toml
```

## Important avant mise en production

1. appliquer la migration D1 ;
2. configurer les secrets Super Admin ;
3. tester la connexion et la réinitialisation de mot de passe ;
4. vérifier le rattachement hiérarchique de chaque structure ;
5. configurer le domaine HTTPS définitif ;
6. réaliser une revue de sécurité et des tests fonctionnels sur une préproduction avant de charger des données administratives réelles.

## Diagnostic rapide si la connexion affiche « Erreur interne du serveur »

Cette version vérifie automatiquement la présence des bindings et initialise le schéma D1 au premier appel API si les tables principales sont absentes.

Après déploiement, ouvrez :

```text
https://VOTRE-DOMAINE/api/health
```

Le diagnostic doit indiquer :

- `dbBinding: true`
- `kvBinding: true`
- `schemaReady: true`
- `superAdminUsernameConfigured: true`
- `superAdminPasswordConfigured: true`
- `superAdminExists: true` après la première tentative de connexion.

Si `dbBinding` ou `kvBinding` vaut `false`, ajoutez les bindings `SIGAT_DB` et `SIGAT_KV` dans les paramètres Cloudflare du projet puis redéployez.


## Hiérarchie multi-services — V1.2

La plateforme prend en charge quatre niveaux, du plus haut au plus bas : **Direction Régionale → Direction Départementale → Cantonnement → PEF**. Chaque structure saisit ses propres données. Les vues supérieures sont calculées par rattachement hiérarchique, sans duplication des données. La confidentialité horizontale reste appliquée : une structure ne peut pas lire une structure indépendante hors de son sous-arbre.

Pour une base D1 déjà créée avec une version antérieure, cette version ajoute automatiquement le champ de compatibilité `service_type` au premier appel API. Il n'est donc pas nécessaire de supprimer la base existante.


## Correctif V1.3 — connexion Super Admin

Cette version corrige une incompatibilité possible avec les bases D1 créées par une version antérieure : l'index `service_type` pouvait être créé avant l'ajout de la colonne correspondante sur une base partiellement initialisée. L'initialisation répare maintenant d'abord le schéma minimal, ajoute les colonnes manquantes, puis applique le schéma complet.

La route `/api/health` effectue également une réparation non destructive du schéma et retourne `runtimeReady: true` lorsque D1/KV sont utilisables.

Le secret Cloudflare `SIGAT_SUPERADMIN_PASSWORD` sert aussi de mécanisme de récupération côté serveur : si le compte Super Admin existe mais que son ancien hash est incomplet ou obsolète, une connexion avec l'identifiant et le mot de passe actuellement configurés dans les secrets Cloudflare répare le hash automatiquement. Le secret n'est jamais envoyé au navigateur ni stocké en clair dans D1.

Après déploiement :

1. ouvrir `https://VOTRE-DOMAINE/api/health` ;
2. vérifier `dbBinding`, `kvBinding`, `runtimeReady`, `schemaReady` à `true` ;
3. vérifier `superAdminUsernameConfigured` et `superAdminPasswordConfigured` à `true` ;
4. revenir à la page de connexion et utiliser exactement l'identifiant et le mot de passe définis dans les Variables et secrets Cloudflare.


## Correctif V1.7 — bootstrap D1
Après le premier déploiement, ouvrir `/api/health` une fois. La route initialise le noyau D1 et crée le compte Super Admin à partir des secrets Cloudflare si nécessaire. Le mot de passe n'est jamais inclus dans le dépôt.


## Correctif V1.8 — PBKDF2 Cloudflare
Cloudflare Workers limite actuellement PBKDF2 à 100 000 itérations. Cette version utilise 100 000 itérations pour la création et la vérification des nouveaux mots de passe. Le mot de passe Super Admin reste fourni uniquement par les secrets Cloudflare et n’est jamais publié dans le dépôt.


## V1.9 — Rattachement après inscription
L'inscription ne demande plus le code du service supérieur. Le **code unique de la structure est généré automatiquement et aléatoirement côté serveur** (préfixes PEF, CEF, DDEF ou DREF). Après activation, l'Administrateur de chaque structure choisit son rattachement dans **Paramètres > Rattachement hiérarchique**. Le serveur ne propose que les services supérieurs actifs et compatibles avec le niveau de la structure : PEF → Cantonnement → Direction Départementale → Direction Régionale.


## V1.11 — Ergonomie, impressions PDF et photo agent

- Protection contre les doubles clics : déduplication des requêtes d’écriture et garde visuelle sur les boutons.
- Popups professionnels uniformisés pour confirmations, informations, archivages et réinitialisations sensibles.
- Impression professionnelle A4 / Enregistrer en PDF disponible sur chaque enregistrement et sur les listes visibles.
- Personnel : importation d’une photo JPG/PNG/WEBP dans le popup Ajouter/Modifier Agent, compression automatique et affichage sur la fiche agent imprimée.
- Popups d’ajout Administration / Activités techniques / Environnement / Gestion disposés en grille compacte sans défilement interne sur ordinateur ; défilement uniquement en secours sur petit écran.


## V1.13 — Autorisations d’absence
La section Absences est désormais une section de rédaction et de gestion des autorisations d’absence, avec durée calculée automatiquement et impression PDF A4 conforme au modèle administratif fourni.


## V1.14 — Impressions officielles

La section **Paramètres > En-tête des imprimés** permet à chaque Administrateur de structure de définir les mentions administratives, la référence, l’emblème et le bloc de signature utilisés sur les impressions/PDF. Les imprimés n’affichent plus le bandeau SIGAT et leur pied de page indique le nom de la structure ainsi que la date et l’heure d’impression.


## V1.15 — Convocations, impression unique et suppression

- La section **Convocations** reprend le formulaire administratif : civilité, nom et prénoms, profession, domicile, date/heure de présentation, motif, instruction et personne/service à voir.
- Le PDF **CONVOCATION** utilise l’en-tête officiel de la structure, un titre souligné et espacé, un corps central justifié et la signature du responsable dans la zone inférieure droite.
- Tous les imprimés utilisent désormais un titre souligné et une présentation centrale plus homogène.
- Correction du déclenchement d’impression en double : une seule fenêtre d’impression est lancée par clic.
- Ajout d’une action **Supprimer** avec confirmation professionnelle. La suppression est définitive et journalisée côté serveur.

## V1.16 — Convocations et date/signature des PDF
- Nouveau corps officiel des convocations conforme au modèle fourni.
- Formulaire Convocation adapté.
- Corps des documents : interligne 1,15 ; espacement des paragraphes 1,7 em.
- Date retirée de l'en-tête et déplacée sous la forme « Fait à …, le … » au-dessus de la signature.

## V1.17 — Convocations
La présentation PDF des convocations a été alignée sur le modèle administratif fourni : introduction centrée, tableau d'identification, objet, personne à voir, mention de présence, date en bas et bloc signature à droite. Le popup d'édition a également été adapté à cette formule.

## V1.19 — Marges des imprimés et suppression du pied de page

Tous les imprimés A4 utilisent désormais une marge uniforme de **1,5 cm sur les quatre côtés**. Le pied de page automatique contenant le nom de la structure et la date/heure d'impression a été supprimé. L'en-tête administratif reste inchangé.


## V1.20 — Marges et typographie des imprimés

Tous les imprimés A4 utilisent désormais :
- marge haute : **1,5 cm** ;
- marge basse : **1,2 cm** ;
- marge gauche : **1,2 cm** ;
- marge droite : **1,2 cm** ;
- titres : **Cooper Black, 20 pt** ;
- corps de texte : **Arial Narrow, 13 pt** ;
- signature : **Arial Narrow, 13 pt**.

L’en-tête administratif reste inchangé et le pied de page automatique reste supprimé.

## V1.21 — Date et signature flexibles
La zone « Fait à ..., le ... » et la signature sont désormais en flux d'impression flexible : elles ne recouvrent plus le corps du texte, ne s'empilent plus et sont repoussées vers le bas lorsque l'espace le permet. Si le document est long, le bloc reste groupé et se place après le contenu ou sur la page suivante.


## V1.22 — Autorisations d’absence
Correction ciblée des PDF d’autorisations d’absence : titre Cooper Black 22 pt, corps Arial Narrow 14 pt, interligne 1,5. Les autres imprimés restent inchangés.

## V1.23 — AMPLIATIONS et menu principal mobile
- **Paramètres > En-tête des imprimés** contient maintenant une section **AMPLIATIONS** pour enregistrer la liste des destinataires à faire apparaître en bas des documents.
- Chaque popup Ajouter / Modifier propose **Afficher AMPLIATIONS sur le PDF** : l'utilisateur décide document par document si le bloc doit être imprimé.
- Lorsqu'il est activé, **AMPLIATIONS** apparaît de façon flexible en bas à gauche, sur la même ligne que la zone **Fait à… / signature** placée à droite.
- Le menu principal est désormais accessible sur téléphone grâce à un bouton **Menu** avec navigation verticale et sous-menus tactiles. La correction couvre les espaces de structure, les paramètres d'impression et le Super Admin.


## V1.24 — Ampliations : tirets et nombres
La section AMPLIATIONS ajoute automatiquement un tiret devant chaque destinataire et permet d’indiquer un nombre / nombre d’exemplaires correspondant à chaque ligne.


## V1.25 — Ampliations
La colonne « Nombres / exemplaires » a été rapprochée des destinataires tout en conservant un alignement vertical régulier des nombres sur les PDF et dans l’aperçu.

## V1.26 — Présentation AMPLIATIONS
- Titre AMPLIATIONS : 14 pt.
- Liste : 12 pt.
- Colonne des nombres fixe et parfaitement alignée verticalement.


## V1.27 — Stages : mise en stage et fin de stage
- La page **Stages** contient désormais deux vues dans la même page : **Mise en stage** et **Fin de stage**.
- Chaque vue possède son propre bouton d'ajout et son registre filtré.
- Le popup **Ajouter mise en stage** reprend les champs du modèle fourni : stagiaire, qualité, matricule, note de service, date et origine de la note, début/heure, durée, fin et thème.
- Le popup **Ajouter fin de stage** reprend les champs du modèle fourni : stagiaire, qualité, matricule, niveau, période de stage, lettre de mise en stage et date de la lettre.
- Les PDF **ATTESTATION DE MISE EN STAGE** et **ATTESTATION DE FIN DE STAGE** sont rédigés automatiquement selon les formules fournies, avec titre encadré, en-tête officiel SIGAT, date/signature flexibles et option AMPLIATIONS.
- Les anciens enregistrements de stages sans type explicite sont conservés et apparaissent dans **Fin de stage** pour compatibilité.


## V1.28 — Préremplissage intelligent
Le formulaire **Fin de stage** propose désormais les stages en cours et préremplit automatiquement les informations connues, tout en laissant tous les champs modifiables. Un moteur de suggestions et de préremplissage contextuel est aussi actif dans les autres modules lorsque des données déjà enregistrées peuvent être réutilisées sans ambiguïté.

## V1.29 — Documents administratifs regroupés
- Documents administratifs contient désormais Cessation de service, Reprise de service et Autorisations d’absence dans une même page.
- Cessation et Reprise disposent chacune de leur registre, bouton d’ajout, formulaire métier et PDF administratif.
- Reprise de service peut être préremplie intelligemment à partir d’une cessation existante.
- Autorisations d’absence est déplacée sans perte de données ; l’ancienne URL redirige vers le nouvel emplacement.

## V1.30 — Certificats de cessation et reprise adaptés aux modèles
- Les formulaires **Cessation de service** et **Reprise de service** ont été réorganisés selon les deux modèles administratifs fournis.
- Ajout du champ **Option** pour restituer des mentions comme « Moniteur des PVA (Option Eaux et Forêts) ».
- La **Reprise de service** comprend maintenant la nature du congé / absence, proposée par défaut comme « congé administratif ».
- Le préremplissage intelligent d’une reprise depuis une cessation récupère l’identité, la situation administrative, l’option, le poste d’origine, la date de cessation et les références connues.
- Les deux PDF reprennent la rédaction des exemples tout en conservant l’en-tête, les marges, la signature flexible et les ampliations configurées.


## V1.31 — Documents administratifs : mutation / congé
Ajout des sous-registres Cessation de service / congé et Prise de service / mutation, renommage des registres existants Cessation de service / mutation et Reprise de service / congé, formulaires et PDF adaptés aux modèles fournis, avec préremplissage intelligent.


## V1.32 — Convocations liées aux procès-verbaux

- La page **Convocations** comporte désormais deux espaces dans la même page : **Convocations** et **Procès-verbaux des rencontres**.
- Chaque ligne de convocation dispose d’un bouton **Procès-verbal** qui ouvre le PV déjà lié ou prépare un nouveau PV.
- Le popup du PV sélectionne la convocation d’origine et préremplit automatiquement la personne convoquée, la profession, le domicile, la date, l’heure, l’objet et le responsable ; tous ces champs restent modifiables.
- Le PV gère également le lieu, l’heure de fin, les personnes présentes, le déroulement/résumé, les conclusions/décisions et les observations.
- Un seul PV actif est autorisé par convocation afin d’éviter les doublons.
- Les PV peuvent être consultés, imprimés en PDF, modifiés, archivés et supprimés.
- Une convocation possédant encore un PV ne peut pas être supprimée avant suppression du PV lié.
- L’impression du PV reprend l’en-tête administratif, la mise en page A4, la date/signature flexible et les ampliations facultatives déjà configurées dans SIGAT.

### V1.33 — Popup Procès-verbal responsive
Le formulaire d'ajout/modification d'un procès-verbal est maintenant présenté en 2 colonnes sur PC/tablette et 1 colonne sur téléphone. Le popup est limité à la hauteur de l'écran et son contenu défile verticalement sans dépasser la fenêtre de l'utilisateur.


## V1.34 — Ampliations modifiables par document
- Chaque formulaire de rédaction affiche les AMPLIATIONS préremplies depuis les paramètres de la structure.
- Les destinataires et les nombres/exemplaires peuvent être modifiés directement dans le document.
- Ces modifications sont enregistrées uniquement dans le document concerné (`data_json`) et ne modifient pas les paramètres généraux ni les autres documents.
- L'utilisateur conserve le choix d'afficher ou non les AMPLIATIONS sur le PDF.
- Les anciens documents sans personnalisation continuent d'utiliser les ampliations générales de la structure.

## V1.35 — Demande d’explication
La section **Documents administratifs** intègre désormais un espace **Demande d’explication** avec préremplissage intelligent depuis le Personnel, formulaire dédié et PDF à deux colonnes **TEXTE / RÉPONSE** conforme au modèle administratif fourni. Les réponses peuvent être complétées ultérieurement par modification du document.


## V1.36 — En-têtes et AMPLIATIONS
- En-têtes : 12 pt, interligne 1,5.
- N°/numéro de référence : rouge et gras ; suffixe administratif conservé en noir.
- AMPLIATIONS : titre 12 pt ; liste et nombres 10 pt sans gras.

## V1.37 — En-têtes 10 pt et référence ciblée
- Tous les en-têtes d’impression utilisent désormais une taille de 10 pt avec un interligne de 1.
- Dans la référence administrative, le préfixe `N°` reste noir.
- Seuls les chiffres du numéro de référence sont affichés en rouge et en gras.
- Le `/` et le suffixe administratif restent noirs.
- L’aperçu des paramètres d’impression est aligné sur ces nouvelles règles.

## V1.38 — Page de connexion
- Nouvelle image d'arrière-plan plein écran sur la page de connexion, responsive PC/téléphone.
- Suppression de la note relative à la vérification serveur des mots de passe et au mot de passe du Super Admin.


## V1.39 — Hiérarchie et codes de service automatiques

- ordre hiérarchique officiel SIGAT, du plus bas au plus haut : **PEF → Cantonnement → Direction Départementale → Direction Régionale** ;
- rattachements compatibles : PEF vers Cantonnement, Cantonnement vers Direction Départementale, Direction Départementale vers Direction Régionale ; la Direction Régionale est le niveau supérieur ;
- les anciens liens hiérarchiques incompatibles sont détachés automatiquement sans supprimer les données métier ;
- le **Code unique du service** est généré automatiquement, aléatoirement et côté serveur, avec contrôle d’unicité D1 ;
- préfixes automatiques : `PEF-`, `CEF-`, `DDEF-`, `DREF-` ;
- suppression du texte de hiérarchie devenu obsolète sur la page de connexion.

## V1.40 — Personnel
- Tableau Personnel réorganisé selon les 13 colonnes métier demandées, avec numéro d’ordre automatique.
- Formulaire Agent adapté aux mêmes informations.
- Impression de la liste générale du personnel en A4 paysage, avec titre dynamique de la structure.
- Le PDF récupère l’ensemble du personnel accessible, au-delà de la seule page de 25 lignes affichée.


## V1.41 — Personnel : liste compacte sans défilement + photo
La liste écran du personnel tient dans la largeur disponible sans défilement horizontal et sans retour à la ligne. Les colonnes secondaires sont masquées de façon responsive mais restent disponibles dans la fiche détaillée et le PDF général. L’importation de la photo de l’agent est rétablie dans le formulaire.


## V1.42 — Personnel : Fonction et lisibilité
Ajout de la Fonction à la liste et au formulaire Personnel, avec boutons/textes légèrement agrandis tout en conservant une ligne horizontale sans défilement.

### V1.43 — Personnel : colonnes visibles ciblées
La liste générale du personnel affiche uniquement N° d’ordre, Nom et prénoms, Sexe (M/F), Matricule, Emploi, Fonction, Date de naissance, Numéro de téléphone, Date de prise de service dans la Région de Gbêkê et Actions. Les autres champs restent disponibles dans les fiches et formulaires.

## V1.44 — Correction fiche de renseignement de l’agent
- Suppression des informations répétées dans la fiche PDF individuelle du personnel.
- Le bloc supérieur conserve une seule fois : Nom et Prénoms, Matricule, Emploi, Fonction et Photo.
- Le bloc inférieur affiche uniquement les informations complémentaires : Sexe, Date de naissance, dates de prise de service, Grade, Classe, Échelon, Handicap et Téléphone.
- Aucune donnée n’est supprimée de la fiche ; seule la présentation est corrigée.

## V1.45 — Fiche de renseignement de l’agent
- Refonte de la fiche individuelle du personnel en A4 portrait.
- Présentation structurée en 5 blocs : Identité, Situation professionnelle, Informations administratives, Situation particulière, Coordonnées.
- Photo de l’agent mise en valeur dans le bloc Identité.
- Suppression de toute répétition des informations.
- Ajout d’une zone « Signature de l’agent » sur la fiche.
- Conservation de l’en-tête administratif SIGAT et de la référence du document.
- Mise en page compacte afin de tenir sur une page A4 portrait.


## V1.46 — Sensibilisations et logo SIGAT
Voir `CORRECTION_V1_46_SENSIBILISATIONS_LOGO.txt`.

## V1.47 — Exploitation forestière
- Réorganisation de la page en quatre espaces : **Recherche parcellaire**, **Situation de la pépinière**, **Plantations forestières créées** et **Reboisement**.
- Chaque espace reste dans la même page et dispose de son bouton d’ajout et de son registre.
- Formulaires adaptés aux champs métier demandés, avec coordonnées X/Y séparées.
- Le champ **Entreprise responsable du reboisement** apparaît uniquement pour le type **compensatoires suivis**.
- Recherche générale dans toutes les données JSON du registre et filtres par année, date, sous-préfecture, localité, essence et type de reboisement selon le contexte.
- Dans **Situation de la pépinière**, les plants distribués sont synchronisés à partir du nombre total de plants des reboisements de la même structure et de la même essence ; les plants disponibles sont calculés automatiquement.
- Pour les plantations et reboisements, le nombre total de plants est proposé automatiquement à partir de `superficie × densité` lorsque ce champ est encore vide, tout en restant modifiable.
- Les tableaux sont compacts, responsives et conçus pour rester dans la largeur de l’écran.

## V1.48 — Transformation du bois
La section Transformation du bois regroupe désormais, dans une même page, les exploitants de produits secondaires, les quantités de produits secondaires exploités et les unités de transformation/déligneuses/menuiseries/dépôts-ventes. Les formulaires, champs conditionnels, recherches, filtres, tableaux et impressions ont été adaptés aux nouveaux registres.

## V1.49 — Réorganisation Produits secondaires / Transformation du bois
Les registres « Exploitants de produits secondaires » et « Qté de produits secondaires exploités » ont été déplacés de Transformation du bois vers la page Produits secondaires, avec conservation des fonctions CRUD, recherche, filtres et impression. Transformation du bois ne présente plus que les unités de transformation, déligneuses, menuiseries et dépôts-ventes.

## V1.50 — Feux de brousse, Faune, Missions et Formations
Voir `CORRECTION_V1_50_FEUX_FAUNE_MISSIONS_FORMATIONS.txt`.

- Feux de brousse : quatre registres intégrés avec formulaires et filtres contextuels.
- Faune : observations des animaux et conflits homme-faune dans la même page.
- Missions : dispositions, missions réalisées et répression des infractions ; sélection intelligente des missions et du personnel, numérotation automatique des missions réalisées.
- Répression : gestion des photos et P-V lié à chaque affaire avec impression.
- Formations : thèmes normalisés, option « autres », statistiques hommes/femmes et observations.


## V1.51 — Activités du MINEF
Ajout d’une page dédiée dans Activités techniques pour enregistrer et suivre les activités du MINEF et les activités externes, avec formulaire conditionnel, filtres, tableau, impression et gestion complète des enregistrements.


## V1.52 — Feux de brousse : comités créés, redynamisés et renouvelés
Ordre des onglets corrigé et préremplissage intelligent des comités redynamisés/renouvelés depuis le registre des comités créés.

## V1.53 — Correction Activités du MINEF
Le formulaire Activités du MINEF masque désormais complètement le champ Statut. Le champ Cadre MINEF est affiché uniquement pour « activités du MINEF » et masqué/vidé pour « activités externes au MINEF ».


## V1.54 — Cadre de l’activité MINEF conditionnel
- Dans **Activités du MINEF**, le champ **Cadre de l’activité MINEF** apparaît uniquement lorsque **Type d’activité = activités du MINEF**.
- Pour **activités externes au MINEF**, ce champ est masqué, désactivé et sa valeur est vidée afin qu’elle ne soit pas enregistrée par erreur.
- Correction CSS renforcée pour garantir le masquage dans le popup sur ordinateur et téléphone.

## V1.55 — Harmonisation générale des popups et tableaux
- Tous les formulaires métier en popup sont présentés en 2 colonnes sur PC/tablette et 1 colonne sur téléphone.
- Les popups respectent la taille de l'écran et utilisent un défilement vertical interne seulement lorsque nécessaire.
- Le champ visuel « Statut » est supprimé de tous les formulaires métier ; la valeur technique reste gérée automatiquement en arrière-plan.
- Le texte « Assistance intelligente SIGAT… » est supprimé, sans désactiver le préremplissage intelligent.
- Les tableaux utilisent toute la largeur disponible sans barre de défilement horizontale, avec colonnes et actions adaptées à l'écran.


## V1.56 — Popup Disposition de mission
- Suppression du bloc « Chef de mission » dans « Ajouter — Disposition de mission de contrôle ».
- Suppression du bloc « AMPLIATIONS du document » uniquement pour ce formulaire.

## V1.57 — Tableaux adaptatifs sans archivage
- Tableaux métier justifiés sur 100 % du cadre, sans défilement horizontal.
- Colonnes affichées selon les champs des formulaires dédiés ; colonnes secondaires masquées lorsque nécessaire.
- Données longues condensées sur une ligne avec ellipse, accessibles intégralement via « Voir ».
- Suppression de tous les boutons d’archivage visibles du programme.

## V1.58 — Formations : popup simplifié
- Dans le popup Ajouter / Modifier — Formation, suppression de la section « Participant à ajouter ».
- Suppression de toute la section « AMPLIATIONS du document » uniquement pour les formulaires Formation.
- Les champs métier de la formation (date, thème, effectifs H/F et observations) sont conservés.
- Les autres modules et leurs ampliations restent inchangés.

## V1.59 — Rapports et bilans consolidés
La section Rapports et bilans consolide désormais les registres et travaux du service dans un document unique. Le filtre de période gère les vues mensuelle, trimestrielle, semestrielle, annuelle et personnalisée. L'impression produit un bilan complet en A4 paysage avec l'en-tête administratif et la signature configurés.

## V1.60 — Sélection des tableaux du bilan et P-V d’infraction
- Rapports et bilans : sélection individuelle des tableaux à inclure dans le document consolidé, avec Tout sélectionner / Tout désélectionner et aperçu réactif.
- P-V d’infraction : suppression des champs N°, date, lieu, personne mise en cause et du sélecteur chef de mission ; affaire/personne, objet de l’infraction et objets saisis sont désormais alimentés automatiquement depuis l’affaire liée et protégés contre la modification manuelle.


## V1.61 — Correction ciblée Mission de contrôle réalisée
- Suppression du champ dupliqué « Chef de mission » dans le popup Ajouter / Modifier — Mission de contrôle réalisée.
- Conservation d’un seul champ Chef de mission, alimenté par la liste du Personnel.

## Correction V1.62 — suppression des champs « Service source »
- Suppression de tous les champs, colonnes et mentions visibles « Service source » / « Source » liés à la structure d’origine dans les tableaux, fiches de consultation, rapports et impressions.
- Suppression de la statistique « Structures sources » dans Rapports et bilans.
- Les informations techniques `source_organization` restent conservées côté application pour la sécurité, le périmètre hiérarchique et les préremplissages automatiques ; elles ne sont plus affichées comme champ à l’utilisateur.

## V1.63 — Répression des infractions et P-V détaillés
- Formulaire « Répression des infractions » restructuré selon le canevas opérationnel : liaison mission oui/non, contrôle, personne mise en cause, saisies, exposé des faits, déclaration, constatations, observations, conclusion et suite donnée.
- Mission liée : numéro/intitulé, chef et participants sont repris automatiquement depuis la mission de contrôle réalisée.
- Procès-verbal d’infraction : les informations de l’affaire liée (personne, objet, objets saisis, contrôle, identité, saisie) sont synchronisées automatiquement et protégées contre les divergences ; les zones narratives du P-V restent modifiables.
- Impression « Répression des infractions » en 8 sections et « Procès-verbal d’infraction » en 9 sections, avec en-tête SIGAT, ampliations éventuelles et signature du chef de mission.
- Compatibilité maintenue avec les anciennes affaires utilisant le champ historique « type et numéro de pièce ».


## V1.64 — Menu Activités techniques
- Suppression dans le menu principal « Activités techniques » des rubriques visibles : Contrôles, Infractions et Saisies.
- Les modules, données et routes techniques correspondants ne sont pas supprimés afin de préserver l’historique et les fonctions qui peuvent les référencer.

## V1.65 — Répression des infractions / Procès-verbal d’infraction
- Adaptation complète du formulaire « Répression des infractions » au nouveau canevas administratif.
- Séparation des objets, produits et matériels saisis.
- Affichage intelligent du chef de mission et des agents lorsque l’affaire est liée à une mission réalisée.
- Refonte des impressions « REPRESSION DES INFRACTIONS » et « PROCES-VERBAL D’INFRACTION » selon les textes fournis.
- Synchronisation automatique du P-V avec les données de l’affaire liée ; les parties rédactionnelles du P-V restent modifiables.

## V1.68 — Ordre de mission et P-V lié
- Ajout d'un espace « Ordre de mission » dans Missions, sur la même ligne que les autres boutons.
- Page dédiée : `/missions/ordre-de-mission/`.
- Numérotation automatique des ordres de mission et génération d'un P-V lié depuis la colonne Actions.
- Préremplissage automatique du P-V à partir de l'ordre de mission.
- Modèles d'impression ORDRE DE MISSION et PROCES-VERBAL DE MISSION.

## V1.69 — correction critique boutons et menu horizontal

Cette version corrige une erreur de syntaxe JavaScript introduite dans la gestion du P-V lié à l’ordre de mission. Cette erreur empêchait entièrement `app.js` de se charger : le menu horizontal n’était donc pas injecté et les boutons métier restaient inactifs.

Corrections :
- chaînes `agents_mission` et `moyens_deplacement` réparées dans `manageOrderMissionPv()` ;
- validation de tous les fichiers JavaScript en mode ES Module ;
- références `app.js` et `styles.css` passées à `v=1.69` sur toutes les pages afin de forcer le rechargement du navigateur/CDN ;
- fonctions Ordre de mission / P-V conservées.

## V1.70 — Ordre de mission : formulaire et impression adaptés
- Corps de l'ORDRE DE MISSION fixé à 13 pt avec interligne 1,5.
- Formulaire Ajouter / Modifier adapté au modèle fourni : équipe issue du Personnel, résidence d’affectation, localité de mission, objectif, dates de départ/retour et deux moyens de déplacement avec immatriculation.
- Ajout d’un aperçu automatique de l’équipe avec Nom et prénoms, Matricule, Corps et Fonction.
- Le PDF présente désormais l’équipe sous forme de tableau professionnel à 4 colonnes et reprend la localité de mission séparément de l’objectif.
- Les informations Matricule / Corps / Fonction des agents sont synchronisées automatiquement depuis le module Personnel et restent attachées à l’ordre de mission.


## V1.71 — Mise en forme stricte Ordre de mission / P-V de mission
- Corps des deux documents en Arial Narrow 13 pt, interligne 1,5.
- Ordre de mission reproduit la disposition fournie : N° centré, tableau équipe, résidence, destination, objectif encadré, dates et moyens de déplacement en deux colonnes.
- Le P-V de mission reprend exactement le même bloc d’identification de mission avant ses rubriques rédactionnelles.
- Le P-V récupère désormais aussi les matricules, corps, fonctions, destination et deux moyens de déplacement de l’ordre lié.
- Version des assets portée à 1.71 pour neutraliser les anciens caches navigateur/Cloudflare.


## V1.72 — Ordre de mission / PV de mission
- Corps des documents ORDRE DE MISSION et PROCES-VERBAL DE MISSION en Arial Narrow 14 pt.
- Interligne maintenu à 1,5 sur tout le corps, tableaux, blocs et signature associés.
- Version des ressources passée à 1.72 pour forcer le rechargement après déploiement.


## V1.73 — Ordre de mission et P-V
Correction effective du CSS embarqué d’impression : Arial Narrow 14 pt, interligne 1,5, mise en page structurée conforme au modèle fourni.


## V1.74 — Référence administrative
Ajout du champ « Référence administrative » sur tous les popups de création et de création de P-V. La valeur est propre à chaque document et alimente l'en-tête de l'impression.


## V1.75 — Suppression des rubriques obsolètes
- Missions : retrait de « Disposition des missions de contrôle » et « Missions de contrôle réalisées » avec leur logique associée.
- Missions : conservation de « Ordre de mission » et « Répression des infractions » ; la répression est désormais autonome dans le module Missions.
- Activités techniques : retrait définitif de Contrôles, Infractions et Saisies.
- Gestion : retrait définitif de Finances et Archives.
- Suppression des pages, routes API, configurations, rapports, compteurs de tableau de bord et schémas de création correspondants.
- Les bases D1 déjà déployées ne sont pas purgées automatiquement afin d’éviter toute perte de données historiques ; les anciennes tables ne sont plus exposées par l’application.

## V1.76 — Mon compte, permissions et suppression du Reboisement
- Environnement : suppression définitive de la rubrique Reboisement, de sa page, de ses filtres, rapports, traitements et dépendances applicatives.
- Exploitation forestière : retrait de l’ancien sous-module Reboisement ; la pépinière ne dépend plus de ce module et calcule les plants disponibles à partir des quantités produites et distribuées saisies.
- Mon compte : intégration de la Gestion des utilisateurs / membres et de l’Abonnement SIGAT.
- Sécurité Administrateur : l’Administrateur ne peut ni réinitialiser, ni désactiver, ni supprimer son propre compte ; ces actions restent réservées au Super Admin.
- Gestion des membres : l’Administrateur peut créer, réinitialiser, activer/désactiver et supprimer les comptes Membre/Consultation de sa structure.
- Permissions : lors de la création et ensuite depuis « Accès », l’Administrateur choisit page par page les droits Voir / Modifier. Les droits sont contrôlés dans l’interface et sur les API serveur.
- Connexion : suppression des informations internes sur les rôles dans « Mot de passe oublié » et détection automatique du responsable de réinitialisation.
- Connexion : verrouillage du bouton pendant l’authentification afin d’empêcher les doubles clics et requêtes répétées.
- Compatibilité D1 : les éventuelles anciennes données Reboisement déjà stockées ne sont pas supprimées automatiquement, mais elles ne sont plus exposées par l’application.
