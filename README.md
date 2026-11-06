# ZAWELI

Plateforme SaaS de création et de partage d'expériences numériques personnalisées : anniversaires,
déclarations, félicitations, invitations, remerciements et cadeaux. Elle s'adresse aux particuliers et aux entreprises.

> Le nom « ZAWELI » est provisoire.

## Démarrage rapide

Prérequis : Node.js 22.12 ou plus, pnpm 9, et Docker Desktop démarré.

```bash
pnpm install
```

```bash
pnpm db:start
```

```bash
pnpm env:local
```

```bash
pnpm dev
```

- Site : http://localhost:3000 (`/status` affiche l'état de l'API et de la base)
- API : http://localhost:4000/v1/health
- Démonstration de Coffret : http://localhost:3000/templates/coffret/demo
- Supabase Studio : http://127.0.0.1:54323

Pour publier une vraie expérience en local : `pnpm templates:sync` puis `pnpm demo:seed`. Après chaque redémarrage de Supabase, relancer `pnpm env:local`.

Détails, commandes et vérifications : [`docs/06-fondation-technique.md`](docs/06-fondation-technique.md).

## État du projet

| Phase | Livrable | Statut |
| --- | --- | --- |
| 0 — Audit Pauline et environnement | [`docs/01-audit-pauline.md`](docs/01-audit-pauline.md) | ✅ Rédigé |
| 1 — Conception produit | [`docs/02-cahier-des-charges.md`](docs/02-cahier-des-charges.md) | ✅ v0.2 validée (C1, C2 et C7 décidés) |
| 2 — Architecture technique | [`docs/03-architecture-technique.md`](docs/03-architecture-technique.md) | ✅ v0.1 validée (A1 à A16) |
| 3 — Modèle de données | [`docs/04-modele-de-donnees.md`](docs/04-modele-de-donnees.md), `supabase/` | ✅ Validée. 10 migrations, appliquées sur le vrai Supabase local. |
| 4 — Maquettes du SaaS | [`docs/05-maquettes-ux.md`](docs/05-maquettes-ux.md) + [`docs/maquettes/wireframes.html`](docs/maquettes/wireframes.html) | 📝 Structure livrée. Direction visuelle U1 à valider. |
| 5 — Fondation technique | [`docs/06-fondation-technique.md`](docs/06-fondation-technique.md) | ✅ Livrée et commitée |
| 6 — Premier template (« Coffret », issu de Pauline) | [`docs/07-template-coffret.md`](docs/07-template-coffret.md) | 📝 Livré, à valider. Parcours complet vérifié dans Chrome depuis la base. 39 tests unitaires et 11 e2e réussis. |

## Structure

```text
zaweli/
├── apps/
│   ├── web/              Next.js 16 : site public, tableau de bord, création, administration, /g/[slug]
│   └── api/              NestJS 12 : API REST /v1
├── packages/
│   ├── config/           tsconfig et ESLint partagés
│   ├── shared-types/     Codes d'erreur et contrats d'API (Zod)
│   ├── template-engine/  Manifestes, DSL de champs, validation du contenu
│   └── ui/               Design system du SaaS
├── templates/coffret/    Premier template officiel (issu de Pauline)
├── supabase/             config.toml, migrations, seed local, tests
├── scripts/              Outils de développement
└── docs/
```

## Référence

`Template_Paul-main.zip` est le projet Pauline, la référence fonctionnelle du premier template.
**Il ne doit jamais être modifié.** Il se trouve à la racine et est ignoré par Git. Son déplacement vers
`references/pauline/` est proposé (décision D2) mais n'a pas encore été validé.
