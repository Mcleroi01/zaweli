# ZAWELI — API métier et deux langues (français, anglais)

> Statut : **livrée, à valider**.
> Date : 18 novembre 2026.
> Entrées : [cahier des charges](02-cahier-des-charges.md) §6 à §13, [architecture](03-architecture-technique.md) §4, §6 et §7, [modèle de données](04-modele-de-donnees.md).

---

## 1. Ce qui a été construit

L'API NestJS expose désormais le parcours complet de l'expéditeur, de la fiche destinataire à la publication du lien. Elle s'appuie sur le schéma SQL existant : les règles de licence restent garanties par la base.

| Domaine | Points d'accès (`/v1`) | Règles appliquées |
| --- | --- | --- |
| Profil | `GET/PATCH /me/profile` | Langue `fr` ou `en`, nom affiché, préférences. L'e-mail vérifié est lu en base. |
| Catalogue | `GET /catalog/categories`, `GET /catalog/templates[?category=]`, `GET /catalog/templates/:slug` | Seuls les modèles publiés ayant une version courante sont visibles. Les textes sont traduits. |
| Formules | `GET /plans` | Formules actives et publiques, avec leurs prix en vigueur |
| Destinataires | `GET/POST /recipients`, `PATCH/DELETE /recipients/:id` | Propriété stricte. Une fiche liée à une licence n'est pas supprimable, et la renommer est journalisé (§8.3, MULTI-USE). |
| Brouillons | `GET/POST /experiences`, `GET/PATCH/DELETE /experiences/:id` | Le contenu est validé contre le manifeste de **sa** version figée. Le nombre de brouillons est plafonné (C18). La révision lue évite qu'un onglet en écrase un autre. |
| Cadeaux | `POST /experiences/:id/gifts`, `PATCH/DELETE …/gifts/:giftId`, `POST …/gifts/:giftId/status` | Les données sont validées par type. Le modèle doit accepter le type, dans la limite de son nombre de cadeaux. La base contrôle les statuts et l'acteur : un cadeau d'argent ne peut jamais passer à « transféré » (C1). |
| Licences | `GET /licenses`, `GET /experiences/:id/eligibility` | Le droit FREE est créé à la demande, pour un e-mail vérifié. Les candidates sont triées par date d'expiration, et FREE exige un choix explicite (§8.4). |
| Publication | `POST /experiences/:id/publish` | Une seule transaction : verrou, validation, choix de la licence, `app.consume_publication`, instantané public et protégé, lien de 12 caractères, audit. Le double clic est idempotent. Une republication ne consomme rien. |
| Désactivation | `POST /experiences/:id/disable`, `/enable` | Le lien renvoie la même 404 qu'un lien inexistant. Une suspension par la modération reste prioritaire. |
| Destinataire (public) | `GET /public/experiences/:slug`, `POST …/gifts/:giftId/reveal`, `POST …/reports` | Le statut des cadeaux est toujours le statut courant. Les données protégées (code d'un bon) ne sont livrées qu'au déballage. Les signalements sont limités en débit, et l'adresse IP n'est pas conservée en clair. |
| Administration | `GET /admin/reports`, `POST /admin/reports/:id/resolve`, `POST /admin/experiences/:id/suspend` et `/unsuspend`, `GET/POST /admin/plans`, `PATCH /admin/plans/:code`, `POST /admin/plans/:code/prices`, `PATCH /admin/templates/:slug`, `POST /admin/licenses` | Rôle `admin` lu en base. Chaque geste passe sous l'acteur `admin` et est journalisé. Un nouveau prix clôt l'ancien, et l'historique est conservé. |

## 2. Deux langues

| Couche | Mise en œuvre |
| --- | --- |
| Langues | `packages/shared-types/src/i18n.ts` : `LOCALES = ["fr", "en"]`, français par défaut. Ajouter une langue fait échouer la compilation tant que chaque dictionnaire n'est pas complété. |
| Langue d'une requête | `?lang=en`, sinon `Accept-Language` (pondérations respectées), sinon le français. L'API renvoie l'en-tête `Content-Language`. |
| Messages d'erreur | `packages/shared-types/src/messages.ts` : chaque code métier a une phrase en français **et** en anglais. Le code reste stable, seul le message change. Le web peut afficher ces mêmes textes. |
| Catalogue et formules | Colonne `translations` (JSON) sur les catégories, les modèles, les formules et les types de cadeaux. La colonne d'origine, en français, sert de repli. Les catégories et les types de cadeaux ont déjà leur traduction anglaise. |
| Expérience | `experiences.locale` : la langue des textes **fixes** du modèle vus par le destinataire (par exemple « Je t'offre » ou « I'm giving you »). Elle est écrite dans l'instantané publié et lue par le runtime. Les formulations des cadeaux (`describeGift`) existent dans les deux langues. |
| Profil | `profiles.locale` est limité à `fr` ou `en`. Il sert de langue par défaut aux nouvelles expériences. |

Migration : `supabase/migrations/20261118000100_i18n.sql`. Elle ajoute aussi `app.is_email_confirmed(uuid)`, qui permet à l'API de lire la vérification de l'e-mail sans accès à `auth.users`.

## 3. Vérifications exécutées

| Vérification | Résultat |
| --- | --- |
| `pnpm test` | **67 tests**, dont **22 tests d'intégration** de l'API métier |
| `pnpm test:db` | **69 vérifications** du schéma, dont la nouvelle migration |
| `pnpm lint` · `pnpm typecheck` · `pnpm build` | Tous réussis : API, paquets et site |

Les tests d'intégration (`apps/api/test/backend.spec.ts`) démarrent la **vraie application NestJS** : gardes, validation, filtre d'erreurs et contrôleurs. Ils tournent sur les **vraies migrations**, exécutées par PostgreSQL 16 embarqué (PGlite), **sans Docker**. Seule la vérification du jeton Supabase est simulée.

Scénarios du cahier des charges couverts : S1, S2, S7, S8, S9, S10, S11, S13, S14 et S19. S'y ajoutent les deux langues, la propriété, les révisions concurrentes, les photos non prêtes, le plafond de brouillons et l'administration des prix.

## 4. Ce qui n'est PAS encore fait

| Sujet | Raison | Prochaine étape |
| --- | --- | --- |
| Envoi des photos (`/media/upload-url`, finalisation, `sharp`, EXIF) | Nécessite Supabase Storage réel | Lot « Médias ». La publication exige déjà des photos prêtes (`MEDIA_NOT_READY`). |
| Commandes et paiement MbiyoPay | Documentation de l'API MbiyoPay toujours absente (décision D6) : aucun adaptateur simulé | Abstraction `PaymentProvider`, puis adaptateur dès réception de la documentation |
| Aide à l'écriture (OpenRouter) | Clé et choix du modèle à fournir | Les fonctions de quota existent en base (`reserve_ai_generation`) |
| Code d'accès et date de disponibilité | Une expérience protégée par un code n'est pas servie (choix prudent) | Point d'accès de déverrouillage, limité en débit |
| E-mails transactionnels | Fournisseur à choisir (A12) | Langue de l'e-mail = langue du profil |
| Interface anglaise du site | Hors de ce lot : le backend est prêt | Routes `/en/...`, textes externalisés, balises `hreflang` |
| Déploiement de l'API | Supabase hébergé et hébergeur de l'API à choisir (A14) | `node apps/api/dist/main.js`, avec ses variables d'environnement |
| Valeurs commerciales | Prix, durées et quotas relèvent de toi | Les créer par `POST /v1/admin/plans` et `/prices` |
