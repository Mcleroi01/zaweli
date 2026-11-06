# ZAWELI — Phase 5 : fondation technique

> Statut : **livrée, à valider**.
> Date : 6 novembre 2026.
> Résultat : un monorepo qui **démarre réellement** : une API NestJS connectée au vrai Supabase local, un site Next.js qui l'interroge, et des tests automatisés à tous les niveaux.

---

## 1. Ce qui a été construit

```text
zaweli/
├── apps/
│   ├── api/              NestJS 12 : /v1/health, /v1/me, auth JWKS, erreurs, limitation de débit
│   └── web/              Next.js 16.4 : accueil provisoire, /status (santé réelle de l'API)
├── packages/
│   ├── config/           tsconfig et ESLint partagés
│   ├── shared-types/     Codes d'erreur métier et contrats d'API (Zod 4)
│   ├── template-engine/  Manifeste, DSL de champs, validation du contenu, empreinte
│   └── ui/               Jetons U1 (proposition), Button, Badge
├── supabase/
│   ├── config.toml       Supabase local (seeds lus dans ./seed/*.sql)
│   ├── migrations/       10 migrations
│   ├── seed/             Développement local uniquement
│   └── tests/            Tests PGlite du schéma
├── scripts/supabase-env.mjs   Génère les .env locaux depuis `supabase status`
├── turbo.json · pnpm-workspace.yaml · package.json
└── docs/
```

`templates/` est déclaré dans l'espace de travail, mais encore vide : Coffret y arrive en phase 6.

---

## 2. Versions retenues, vérifiées le 6 novembre 2026

| Outil | Version | Remarque |
| --- | --- | --- |
| Node.js | 24.16 (minimum 22.12) | Kysely et Vitest 5 exigent Node 22 ou plus |
| pnpm | 9.12.2 | Déjà présent sur le poste |
| Turborepo | 2.11.10 | |
| **TypeScript** | **6.0.3** (5.9 côté web, version de create-next-app) | **Pas la 7.0** : `typescript-eslint` ne la supporte pas encore (< 6.1), et la CLI NestJS utilise la 6.0 |
| Next.js | 16.4.5 | Généré par `create-next-app`. `cacheComponents` et `partialPrefetching` sont actifs. |
| React | 19.3 | |
| NestJS | 12.4.0 | Généré par `@nestjs/cli` : **ESM**, Vitest et oxlint |
| Zod | 4.6.7 | |
| Kysely / pg | 0.29.8 / 8.23.1 | |
| jose | 6.2.15 | Vérification des JWT par JWKS |
| Tailwind CSS | 4 | Via le chargeur Turbopack généré par Next 16.4 |
| Supabase CLI | 3.0.0 | PostgreSQL 17 en local |
| Docker | 29.9.2 | Décision A15 |

---

## 3. Écarts par rapport à l'architecture (phase 2)

| # | Prévu | Réalisé | Pourquoi |
| --- | --- | --- | --- |
| E1 | `nestjs-zod` pour les DTO (A5) | **`StandardSchemaValidationPipe` natif de NestJS 12** | `nestjs-zod` 5.5 ne supporte que NestJS 10 et 11. NestJS 12 valide directement les schémas Zod (Standard Schema), sans dépendance. |
| E2 | Données de référence dans `seed/` | **Migration `20261106001000_reference_data.sql`** | `supabase db push` n'exécute jamais les seeds : les types de cadeaux et catégories n'auraient pas existé en production |
| E3 | ESLint partout | ESLint (paquets et web), **oxlint** (API) | C'est le linter généré par la CLI NestJS 12, en mode `--type-aware` |
| E4 | Vérification JWT « à confirmer » | **JWKS uniquement (ES256)** | Supabase signe désormais avec des clés asymétriques publiées : l'API n'a **aucun secret** à détenir pour vérifier une session |
| E5 | Clés Supabase `anon` / `service_role` | Clés **`sb_publishable_…`** (web) et **`sb_secret_…`** (tests e2e seulement) | Nouveau modèle de clés de Supabase. Les anciennes clés existent encore mais ne sont pas utilisées. |
| E6 | Types Kysely générés | **Écrits à la main** pour la seule table utilisée (`app.user_roles`) | La génération (`kysely-codegen`) arrive en phase 6 avec les premières vraies tables métier |

Les documents 03 et 04 ont été mis à jour pour E1 et E2.

---

## 4. Lancer le projet

Prérequis : Node 22.12 ou plus, pnpm 9, Docker Desktop **démarré**.

1. Installer les dépendances :
```bash
pnpm install
```
2. Démarrer Supabase local. Le premier lancement télécharge les images, soit plusieurs Go :
```bash
pnpm db:start
```
3. Générer `apps/api/.env` et `apps/web/.env.local` :
```bash
pnpm env:local
```
4. Lancer l'API (http://localhost:4000/v1) et le site (http://localhost:3000) :
```bash
pnpm dev
```

Ouvre ensuite http://localhost:3000/status : l'API et la base doivent apparaître comme opérationnelles.
Supabase Studio est sur http://127.0.0.1:54323 et Mailpit (e-mails locaux) sur http://127.0.0.1:54324.

### Commandes utiles

| Commande | Effet |
| --- | --- |
| `pnpm db:reset` | Recrée la base locale : 10 migrations, puis le seed local |
| `pnpm db:status` | URLs et clés locales |
| `pnpm db:stop` | Arrête Supabase |
| `pnpm lint` · `pnpm typecheck` · `pnpm build` | Tous les paquets, avec le cache Turborepo |
| `pnpm test` | Tests unitaires (moteur de templates, API) |
| `pnpm test:db` | Schéma SQL sur PostgreSQL embarqué (PGlite) : **sans Docker** |
| `pnpm test:e2e` | API contre le **vrai** Supabase local (nécessite `db:start` et `env:local`) |

> **Si `docker` est introuvable** dans un terminal ouvert avant l'installation de Docker, ferme-le et rouvre-le pour recharger le `PATH`.

---

## 5. Vérifications réellement exécutées

| Vérification | Résultat |
| --- | --- |
| `supabase start`, puis `supabase db reset` | Les 10 migrations et le seed s'appliquent sur PostgreSQL 17 réel |
| `pnpm lint` | 7 tâches réussies, 0 erreur |
| `pnpm typecheck` | 7 tâches réussies |
| `pnpm test` | **23 tests** : 13 pour le moteur de templates, 10 pour l'API |
| `pnpm test:db` | **68 vérifications** du schéma réussies |
| `pnpm test:e2e` | **10 tests** contre le vrai Supabase, réussis **deux fois** (dont une fois après `db reset`) |
| `pnpm build` | API compilée, site construit (`/` statique, `/status` en rendu partiel) |
| Démarrage réel | `node dist/main.js` et `next start` : `/v1/health` → `ok`, `/v1/me` sans jeton → 401, `/status` affiche « Opérationnelle » et « OK » |
| Chrome headless | `/` et `/status` à 1280 px et 390 px : aucune erreur console, aucun débordement horizontal |
| Secrets | Aucune clé dans les 120 fichiers suivis par Git. `.env` et l'archive Pauline sont ignorés. |

### Ce que couvrent les tests de bout en bout

- Santé, format d'erreur unique, identifiant de requête, en-têtes de sécurité.
- **Authentification réelle** : un utilisateur est créé dans Supabase Auth et connecté. Son jeton ES256 est vérifié par JWKS. Un jeton falsifié ou absent reçoit un 401.
- Profil créé automatiquement par le déclencheur sur `auth.users`.
- Le schéma `app` est **invisible** depuis l'API REST publique de Supabase, et le rôle de l'API ne peut pas effacer le journal d'audit.
- **S3, enfin vérifié sur un vrai PostgreSQL** : deux connexions publient en même temps avec le dernier droit d'une licence. La seconde **attend le verrou**, puis est refusée avec `LICENSE_PUBLICATION_LIMIT_REACHED`. Le compteur final vaut 1.

---

## 6. Ce qui n'est PAS encore fait

- **Aucune fonctionnalité métier exposée par l'API** (expériences, licences, paiements, IA). Seuls `/v1/health` et `/v1/me` existent.
- **Pas de pages d'authentification** dans le web (inscription, connexion) : c'est la phase « Authentification complète ».
- Le site n'affiche qu'une **page d'accueil provisoire** : la vraie (W1) attend la validation de U1.
- `templates/coffret` n'existe pas encore : c'est la phase 6.
- Pas de CI GitHub Actions (A16) : il faut d'abord un dépôt distant.
- Pas de déploiement : Vercel et l'hébergeur de l'API restent à choisir (A14).
- **Aucun commit** : le dépôt Git est initialisé, l'historique est vide.
- Avertissement d'installation sans effet : `@vitest/coverage-v8` 4.x laissé par la CLI NestJS face à Vitest 5. La couverture de code n'est pas utilisée pour l'instant.

---

## 7. Sécurité en place dès maintenant

- L'API **refuse de démarrer** si sa configuration est invalide. En production, elle refuse le super-utilisateur `postgres` et exige des origines CORS explicites.
- Garde d'authentification **globale** : une route est protégée par défaut. Il faut `@Public()` pour l'ouvrir.
- Vérification des jetons par **clés publiques** : aucun secret de signature côté API.
- Limitation de débit globale (120 requêtes par minute et par client, à affiner par route).
- `helmet` côté API et en-têtes de sécurité côté Next.
- Erreurs inattendues : réponse 500 générique, sans détail technique, et trace complète dans les journaux.
- L'API se connecte avec `zaweli_api_login` (rôle restreint), jamais `postgres`, même en local.
