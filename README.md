# SIGAT V1.79 — Deux types de service, sans rattachement

SIGAT fonctionne désormais avec **deux types de service seulement** :

- **Poste des Eaux et Forêts (PEF)** ;
- **Cantonnement**.

Chaque structure est totalement indépendante. Il n’existe plus de relation parent/enfant entre structures, plus de service supérieur à sélectionner, plus de remontée automatique des données d’une structure vers une autre et plus de vue consolidée entre services.

## Architecture actuelle

- séparation stricte des données par `organization_id` ;
- chaque PEF consulte et gère uniquement ses propres données ;
- chaque Cantonnement consulte et gère uniquement ses propres données ;
- aucun rattachement entre PEF et Cantonnement ;
- aucune rubrique de gestion des structures subordonnées ;
- aucun paramètre de service supérieur ;
- Super Admin séparé des comptes métier ;
- authentification via `POST /api/login` ;
- mots de passe vérifiés uniquement côté serveur ;
- sessions stockées dans KV avec cookie sécurisé ;
- contrôle CSRF pour les écritures authentifiées ;
- permissions de lecture/modification appliquées côté interface et côté serveur ;
- journalisation des opérations sensibles dans D1.

## Types de service autorisés

Les inscriptions, les validations serveur, les listes Super Admin et les abonnements n’acceptent que :

- `PEF` — Poste des Eaux et Forêts ;
- `CANTONNEMENT` — Cantonnement.

Les anciens types de structure devenus incompatibles ne sont plus proposés ni autorisés à se connecter. Les anciennes données métier ne sont pas supprimées automatiquement.

## Installation

Installer les dépendances :

```bash
npm install
```

Appliquer les migrations D1 en local :

```bash
npm run db:migrate:local
```

Appliquer les migrations sur la base distante :

```bash
npm run db:migrate:remote
```

## Configuration du Super Admin

Aucun mot de passe Super Admin n’est fourni dans le dépôt. Configurer les secrets Cloudflare :

```bash
wrangler secret put SIGAT_SUPERADMIN_USERNAME
wrangler secret put SIGAT_SUPERADMIN_EMAIL
wrangler secret put SIGAT_SUPERADMIN_PASSWORD
```

Ne jamais publier le mot de passe Super Admin dans GitHub, `wrangler.toml`, une page HTML ou un script navigateur.

## Développement local

Créer un fichier `.dev.vars` non committé :

```text
SIGAT_SUPERADMIN_USERNAME=...
SIGAT_SUPERADMIN_EMAIL=...
SIGAT_SUPERADMIN_PASSWORD=...
```

Puis lancer :

```bash
npm run dev
```

## Déploiement Cloudflare Pages

Le dossier de sortie est `public/` et contient `public/_worker.js`.

Déploiement manuel :

```bash
npm run deploy
```

Vérifier que les bindings suivants sont configurés dans le projet Cloudflare :

- `SIGAT_KV` ;
- `SIGAT_DB`.

Vérifier également la présence des secrets du Super Admin.

## Contrôle après déploiement

Ouvrir :

```text
https://VOTRE-DOMAINE/api/health
```

Puis vérifier que D1, KV et le runtime sont opérationnels. Tester ensuite :

1. une inscription PEF ;
2. une inscription Cantonnement ;
3. le refus de tout type de service non autorisé ;
4. la connexion d’un compte actif ;
5. l’isolation des données entre deux structures distinctes ;
6. la gestion des utilisateurs et permissions depuis « Mon compte ».

## Compatibilité avec une ancienne base D1

Au démarrage, SIGAT neutralise les anciens liens parent/enfant lorsque l’ancienne colonne correspondante existe. Cette opération ne supprime pas les données métier. Les anciens comptes rattachés à un type de service qui n’est plus autorisé ne sont plus acceptés à la connexion.
