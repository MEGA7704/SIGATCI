# SIGAT V1.6 — correction runtime Cloudflare

Cette version utilise un bootstrap D1 léger pour fiabiliser `/api/login`. Testez d’abord `/api/ping`, puis `/api/health`.

# SIGAT — Système Intégré de Gestion Administrative et Technique

Projet Cloudflare Pages + GitHub pour une plateforme privée hiérarchique utilisée par les **Directions Régionales**, **Cantonnements** et **Postes des Eaux et Forêts (PEF)**.

## Principes inclus

- séparation des données par `organization_id` ;
- remontée hiérarchique Direction Régionale → Cantonnement → PEF ;
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

- une Direction Régionale peut consulter ses Cantonnements et les PEF descendants ;
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

La plateforme prend en charge quatre niveaux : **Direction Départementale → Direction Régionale → Cantonnement → PEF**. Chaque structure saisit ses propres données. Les vues supérieures sont calculées par rattachement hiérarchique, sans duplication des données. La confidentialité horizontale reste appliquée : une structure ne peut pas lire une structure indépendante hors de son sous-arbre.

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
L'inscription ne demande plus le code du service supérieur. Après activation, l'Administrateur de chaque structure choisit son rattachement dans **Paramètres > Rattachement hiérarchique**. Le serveur ne propose que les services supérieurs actifs et compatibles avec le niveau de la structure.


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
