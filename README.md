# SIGAT V1.95 — Exploitation forestière sans Référence administrative

Le champ **Référence administrative** est supprimé uniquement des popups **Recherche parcellaire**, **Site de pépinière**, **Production de pépinière**, **Plantation forestière créée** et **Reboisement**. Il ne s’affiche plus non plus dans leurs impressions/PDF. Les autres formulaires et documents SIGAT conservent leur logique de référence administrative. Aucune migration D1 n’est nécessaire.

---

# SIGAT V1.94 — Situation de la pépinière

La rubrique **Situation de la pépinière** est désormais structurée en trois sous-sections : **Sites de pépinière et responsables**, **Production de pépinières**, et **Distribution et situation générale**. Les productions sont rattachées intelligemment aux sites enregistrés. La situation générale calcule automatiquement, par essence, les plants produits, les plants distribués depuis **Reboisement** et **Plantations forestières créées**, puis les plants disponibles. Les anciennes lignes de pépinière sont conservées comme productions historiques. Aucune migration D1 n’est requise.

---

# SIGAT V1.92 — Répression d’infraction / Chef de mission

Dans le popup **Ajouter — Répression d’infraction**, le sélecteur simple **Chef de mission** est supprimé. Le champ intelligent **Chef de mission** est conservé et reste la seule sélection du chef à la création. La valeur choisie continue d’être enregistrée pour les rapports et impressions. Aucun autre champ n’est modifié.

---

# SIGAT V1.89 — Convocation / Référence administrative

Correction ciblée du popup **Ajouter — Convocation** : remplacement de « Référence / N° » par **Référence administrative** au même emplacement, sans doublon. Le champ intelligent **Personne déjà enregistrée dans le personnel** est supprimé, tandis que le champ manuel **Nom et Prénoms de la personne convoquée** est conservé et reste obligatoire.

---

# SIGAT V1.88

Correction ciblée des formulaires **Mise en stage** et **Fin de stage** : remplacement de « Référence / N° attestation » par **Référence administrative** au même emplacement et sans doublon. Pour **Fin de stage**, le champ manuel « Nom et Prénoms du stagiaire » est supprimé tandis que le champ intelligent **Stage en cours à clôturer** est conservé et utilisé pour reprendre l’identité du stagiaire.

---

# SIGAT V1.87

Correction ciblée des formulaires **Demande d’explication** et **Autorisation d’absence** : suppression des champs manuels de nom d’agent au profit des sélecteurs intelligents, et remplacement de « Référence / N° » par « Référence administrative » pour les autorisations d’absence, sans doublon.

# SIGAT V1.86 — Demande d’explication / Référence administrative

## Correction V1.86 — Demande d’explication

Dans le popup **Ajouter — Demande d’explication**, l’ancien champ **Référence / N°** est remplacé, à la même position, par **Référence administrative**. Le champ administratif dynamique qui était ajouté séparément est désactivé pour ce seul formulaire afin d’éviter tout doublon. La même logique est conservée en modification et la valeur continue d’être utilisée dans les listes et les impressions. Aucun autre champ du formulaire n’est modifié.

---

# SIGAT V1.84 — Correction Reprise de service / congé

## Correction V1.84 — Reprise de service / congé

Dans le popup **Ajouter — Reprise de service / congé**, les champs de saisie manuelle **Référence / N° certificat** et **Nom et Prénoms de l’agent** ne sont plus affichés. Le champ intelligent **Cessation de service / congé existante** est conservé sans modification et continue à préremplir automatiquement l’identité de l’agent ainsi que les informations du congé. Les autres champs et traitements restent inchangés.

---

# SIGAT V1.83 — Correction Cessation de service / congé

SIGAT fonctionne désormais avec **deux types de service seulement** :

- **Poste des Eaux et Forêts (PEF)** ;
- **Cantonnement**.

Chaque structure est totalement indépendante. Il n’existe plus de relation parent/enfant entre structures, plus de service supérieur à sélectionner, plus de remontée automatique des données d’une structure vers une autre et plus de vue consolidée entre services.



## Correction V1.83 — Cessation de service / congé

Dans le popup **Ajouter — Cessation de service / congé**, les champs de saisie manuelle **Référence / N° certificat** et **Nom et Prénoms de l’agent** ne sont plus affichés. Le champ intelligent **Agent concerné** est conservé sans modification et continue à préremplir l’identité et la situation administrative de l’agent sélectionné. Les autres champs et traitements du formulaire restent inchangés.

## Correction V1.82 — Cessation de service / mutation

Dans le popup **Ajouter — Cessation de service / mutation**, les champs de saisie manuelle **Référence / N° certificat** et **Nom et Prénoms de l’agent** ne sont plus affichés. Le champ intelligent **Agent concerné** est conservé et sert à sélectionner l’agent puis à préremplir son identité et sa situation administrative. Les autres champs du formulaire restent inchangés.

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


## Correctif V1.80 — Personnel
Le formulaire d’ajout/modification des agents a été aligné sur les informations administratives demandées : référence administrative, identité, naissance, photo, matricule, emploi, fonction, catégorie, grade, classe, échelon, prises de service, handicap, situation matrimoniale et téléphone.


## Correctif V1.81 — Mentions administratives des imprimés

La section Paramètres > En-tête des imprimés intègre désormais les champs Direction régionale et Direction départementale. Ils sont affichés dans l’ordre administratif entre le Cabinet du Ministre et le Cantonnement, puis repris automatiquement sur les imprimés. Ces champs ne modifient pas les types de service autorisés, qui restent uniquement PEF et Cantonnement.

## Correctif V1.85 — Prise de service / mutation
Dans le popup Ajouter / Modifier « Prise de service / mutation », le champ manuel « Référence / N° certificat » et le sélecteur intelligent « Cessation de service / mutation existante » ont été supprimés. Le champ manuel « Nom et Prénoms de l’agent » est conservé et reste obligatoire. Les autres champs et traitements restent inchangés.

## Évolution V1.99 — Traçabilité, pilotage et dossier agent

SIGAT V1.99 ajoute un journal des opérations consultable par l’Administrateur, la traçabilité des impressions, un tableau de bord dynamique filtrable par mois/trimestre/année, une recherche globale dans le menu horizontal et un dossier administratif numérique consolidé pour chaque agent. Les résultats, indicateurs et éléments du dossier respectent les permissions du compte connecté et l’isolation des données de la structure.
