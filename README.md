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
