# ZAWELI — Espace d'administration (admin.zaweli.store)

> Statut : **livré, à valider**.
> Date : 18 novembre 2026.
> Entrées : [cahier des charges](02-cahier-des-charges.md) §6.3, §11.4 et §11.9, [maquettes](05-maquettes-ux.md) W12, [API métier](09-api-metier-et-langues.md).

---

## 1. Ce qui a été construit

Une application à part, `apps/admin` (Next.js 16), servie sur le sous-domaine **admin.zaweli.store**. Le code de l'administration n'est jamais livré au site public, et les deux applications se déploient et redémarrent indépendamment.

| Écran | Contenu |
| --- | --- |
| Tableau de bord `/` | Chiffre d'affaires converti, nouveaux comptes, nouveaux abonnements, publications, avec la variation par rapport à la période précédente. Aussi : conversion gratuit → payant, clients payants, part des comptes dont le pays est connu, signalements ouverts. Graphiques : chiffre d'affaires par jour, inscriptions, publications et abonnements. Carte des comptes, premiers pays et continents. |
| Carte du monde `/carte` | Carte choroplèthe : comptes, nouveaux comptes, clients payants ou chiffre d'affaires. Totaux par continent, classement, tableau de tous les pays (recherche et tri). |
| Revenus `/revenus` | Total converti par jour, semaine ou mois. Un graphique par devise d'origine (leurs échelles ne se comparent pas). Panier moyen. Saisie des taux de change et de la devise de référence. |
| Abonnements `/abonnements` | Licences par formule et par statut, licences actives par origine, nouveaux abonnements sur la période, échéances des 30 prochains jours. |
| Calendrier `/calendrier` | Le mois jour par jour : un indicateur au choix, les fins de licence, les nouveaux taux et prix. Détail d'un jour au clic. |
| Journal d'audit `/audit` | Lecture seule, du plus récent au plus ancien. Filtres par action, acteur, objet, dates et identifiant. Pagination par curseur, détail de chaque entrée. |

Interface en français, au vouvoiement (U3). Le thème gris ardoise sépare nettement l'administration de l'espace client (W12). L'affichage suit le réglage clair ou sombre de l'ordinateur.

## 2. Accès et sécurité

- **Connexion** : Supabase Auth (mot de passe, ou lien envoyé par e-mail). Seul un compte existant peut se connecter : `shouldCreateUser: false`.
- **Autorisation** : l'API lit le rôle `admin` dans `app.user_roles` à **chaque** requête (`RolesGuard`). L'écran d'accès refusé n'est qu'un confort : la vraie barrière est dans l'API.
- **Aucune mise en cache** : `server.mjs` impose `Cache-Control: private, no-store` sur toutes les pages, sauf `/_next/static`.
- **Aucune indexation** : `X-Robots-Tag: noindex`, `robots.txt` interdit tout.
- **Aucun affichage dans un cadre** : `X-Frame-Options: DENY`, et `Referrer-Policy: no-referrer`.
- **Écritures journalisées** : nouveau taux (`exchange_rate.created`) et changement de devise de référence (`settings.reference_currency_changed`), sous l'acteur `admin`.

Pour donner le rôle à un compte (SQL, une fois, par un administrateur de la base) :

```sql
insert into app.user_roles (user_id, role) values ('<uuid du compte>', 'admin');
```

## 3. Pays et continents

| Donnée | Règle |
| --- | --- |
| Pays du compte | `profiles.country_code` (ISO 3166-1 alpha-2) et `country_source` (`declared` ou `detected`). |
| Déclaré | `PATCH /v1/me/profile { "countryCode": "CD" }`. Il l'emporte toujours. `null` l'efface et rend la main à la détection. |
| Détecté | Lu dans l'en-tête du CDN, `GEO_COUNTRY_HEADER` (par défaut `cf-ipcountry`), à la lecture du profil. Seulement si le compte n'a aucun pays. Les valeurs non géographiques (`XX`, `T1`, `EU`) sont ignorées. |
| Pays d'une vente | `orders.country_code`, figé à l'achat. Le chiffre d'affaires par pays ne change donc pas si le compte déménage. À défaut, le pays du compte. |
| Continent | Déduit du pays (`packages/shared-types/src/geo.ts`, géoscheme ONU M49). Deux choix courants : l'Amérique centrale et les Caraïbes sont rattachées à l'Amérique du Nord, Chypre à l'Europe. La liste couvre les 249 codes ISO plus XK, vérifiés contre `i18n-iso-countries`. |
| Noms | `Intl.DisplayNames` en français. Aucune liste de noms n'est recopiée. |

> **Fait le 20 novembre 2026** : le formulaire d'inscription demande le pays (facultatif, pré-rempli d'après la langue du navigateur). Il est transmis dans les métadonnées d'inscription, et le profil le reprend comme pays **déclaré** (migration `20261120000500`). Chaque commande fige le pays du payeur mobile money ; une commande payée par carte cadeau prend le pays du compte.
> **Hébergement** : vérifier quel en-tête de pays le CDN de Hostinger transmet. Sinon, laisser `GEO_COUNTRY_HEADER` vide : la détection est alors désactivée, et seul le pays déclaré compte.

## 4. Chiffre d'affaires et devises

- **Comptées** : les commandes au statut `paid`, datées par `paid_at`. Un remboursement passe la commande à `refunded` et la retire du chiffre.
- **Montants d'origine** : toujours exacts, par devise. Ils restent la référence comptable.
- **Total converti** : exprimé dans la devise de référence (`app_settings.finance.reference_currency`, USD par défaut). Il utilise, pour chaque vente, le **dernier taux en vigueur le jour du paiement** (`app.exchange_rates`, saisi et daté dans l'écran Revenus).
- **Devise sans taux** : elle n'est **jamais estimée**. Elle sort de tous les totaux de la réponse, et l'écran l'annonce (`missingRates`).
- **Historique** : les taux sont en ajout seul (déclencheur et privilèges). On en ajoute un nouveau à une autre date, on ne modifie jamais un ancien. Après un changement de devise de référence, il faut saisir les taux vers la nouvelle devise. Les anciens restent consultables.
- **Fuseau horaire** : « par jour » se découpe dans le fuseau du navigateur de l'équipe (paramètre `tz`). Une vente payée à 23 h 30 UTC compte le lendemain à Kinshasa.

## 5. Points d'accès ajoutés (`/v1`, rôle `admin`)

| Point d'accès | Rôle |
| --- | --- |
| `GET /admin/insights/overview?from&to&tz` | Chiffres de la période et de la période précédente de même durée |
| `GET /admin/insights/timeseries?from&to&tz&interval=day\|week\|month` | Séries complètes (périodes vides incluses) |
| `GET /admin/insights/geo?from&to&tz` | Par pays, par continent, et « pays inconnu » |
| `GET /admin/insights/subscriptions` | Licences par formule et statut, par origine, échéances à 30 jours |
| `GET /admin/insights/calendar?month=AAAA-MM&tz` | Les jours du mois et leurs évènements |
| `GET /admin/audit?action&actorType&entityType&actorId&entityId&from&to&cursor&limit` | Journal, du plus récent au plus ancien (curseur = dernier identifiant reçu) |
| `GET /admin/audit/facets` | Actions et types d'objets présents, pour les filtres |
| `GET /admin/exchange-rates`, `POST /admin/exchange-rates`, `PUT /admin/exchange-rates/reference` | Taux et devise de référence (journalisés ; doublon de date → 409 `EXCHANGE_RATE_EXISTS`) |

Périodes : 400 jours au plus. Les fuseaux et les dates sont validés (400 sinon). Contrats partagés : `packages/shared-types/src/admin-insights.ts`. Migration : `supabase/migrations/20261118000200_admin_insights.sql`.

## 6. Données de démonstration

`NEXT_PUBLIC_ADMIN_DEMO=1` remplace l'API par un générateur **déterministe et fictif** (`apps/admin/src/lib/demo.ts`). Il applique les mêmes règles que l'API : conversion au jour du paiement, devise sans taux exclue, écritures journalisées. Un bandeau « Données de démonstration » s'affiche sur chaque page.

Le mode démo est **impossible en production** : la condition porte aussi sur `NODE_ENV`, évaluée au build, et le générateur n'est chargé que dans cette branche.

## 7. Déploiement (Hostinger)

1. Créer une seconde application Node.js sur le sous-domaine `admin.zaweli.store`. Fichier d'entrée : `apps/admin/server.mjs`, commande de build : `pnpm exec turbo run build --filter=@zaweli/admin`.
2. Variables : `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (voir `apps/admin/.env.example`). Elles sont lues **au build**.
3. API : ajouter `https://admin.zaweli.store` à `CORS_ORIGINS`, et appliquer la migration `20261118000200_admin_insights.sql`.
4. Supabase Auth : ajouter `https://admin.zaweli.store` aux URL de redirection autorisées (lien de connexion par e-mail).
5. Donner le rôle `admin` aux comptes de l'équipe (§2).

## 8. Vérifications

- API : `apps/api/test/admin-insights.spec.ts`, 9 tests, sur les vraies migrations (PGlite). Ils couvrent les rôles, la validation des périodes, la conversion et les taux manquants, le découpage par fuseau, les pays et continents, les abonnements, le calendrier, l'audit paginé et la détection du pays.
- Base : `pnpm test:db`, migrations et RLS de la nouvelle table.
- Interface : vérifiée en mode démo. Les six écrans s'affichent sans débordement horizontal à 360, 390, 768 et 1024 px. La saisie d'un taux, le refus d'un doublon, le calendrier, les filtres et la pagination de l'audit fonctionnent.
- Graphiques : palette validée (daltonisme, contraste) sur les surfaces claire et sombre de l'administration. Chaque graphique a sa légende et son tableau de données.

## 9. Ce qui reste (hors de ce lot)

- Les écrans de gestion du MVP (§11.9) sont livrés : voir [docs/16](16-gestion-administration.md) et [docs/13](13-parrainage-et-cartes-cadeaux.md) §4 pour l'écran Paiements.
- Taux de change automatiques : volontairement absents. Brancher une source exigerait de choisir un fournisseur.
