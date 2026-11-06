# ZAWELI — Phase 6 : premier template, Coffret (issu de Pauline)

> Statut : **livrée, à valider**.
> Date : 6 novembre 2026.
> Résultat : Pauline est devenue **Coffret 1.0.0**, un template officiel versionné. Il est alimenté par les données ZAWELI (et non plus par `content.js`), il intègre le **système universel de cadeaux**, et il fonctionne de bout en bout, de la base de données jusqu'à la page du destinataire.

---

## 1. Ce qui a été livré

| Élément | Emplacement | Rôle |
| --- | --- | --- |
| Manifeste Coffret 1.0.0 | `templates/coffret/src/manifest.ts` | 19 champs déclarés, 7 étapes d'assistant, 5 sections (3 facultatives), limites de photos |
| Renderer Coffret | `templates/coffret/src/renderer/` | Seal, JewelBox, Riddle, Gifts, Celebration, Finale, Balloon, portés en TypeScript |
| Styles Coffret | `templates/coffret/src/styles.css` | Matières de Pauline, encapsulées et préfixées |
| Démonstration | `templates/coffret/src/demo.ts` | Textes de Pauline, **illustrations générées**, prénom fictif (« Amani ») |
| Moteur, partie schéma | `packages/template-engine/src/schema/` | Champ `riddleList`, registre des 5 types de cadeaux, formulation de vérité, charge publique, empreinte des réponses |
| Moteur, partie React | `packages/template-engine/src/react/` | Moteur d'étapes générique, runtime, bus audio, défilement, confettis, poussière |
| API | `GET /v1/public/experiences/:slug` | Sert l'instantané publié au destinataire, sans compte |
| Scripts | `pnpm templates:sync`, `pnpm demo:seed` | Manifestes vers la base (avec contrôle d'immutabilité), et une expérience de démonstration publiée en local |
| Web | `/templates/coffret/demo`, `/g/[slug]` | Démonstration publique (statique), page du destinataire |

---

## 2. Ce qui a été conservé à l'identique

- **Toutes les timelines GSAP** : sceau brisé et carte qui sort, couvercle de l'écrin, carte d'énigme réversible, déballage des paquets, bougie, envol des ballons, mot de la fin.
- **Toutes les matières CSS** : velours, laque, feuille d'or, cire, carte ivoire, ticket, bougie, flamme, fumée.
- **Les 7 sons synthétisés** : carillon, scintillement, erreur, souffle, ballon, bougie, fanfare.
- **Les polices** Italiana et Fraunces, auto-hébergées.
- **Le parcours** : enveloppe, écrin, 1 à 3 énigmes, cadeaux, bougie et 8 ballons, lettre, et « Revivre la surprise ».

La comparaison visuelle des captures avant et après portage montre un rendu identique.

---

## 3. Ce qui a changé, et pourquoi

| # | Avant (Pauline) | Après (Coffret 1.0.0) |
| --- | --- | --- |
| Données | Constantes dans `src/content.js` | **Champs déclarés dans le manifeste**, validés côté serveur, puis servis dans une charge publique figée à la publication |
| Cadeaux | 3 phrases « Bon pour… » | **1 à 3 cadeaux typés** (argent, objet, invitation, bon, expérience). Le paquet reste celui de Pauline, le ticket affiche la formulation du moteur. |
| Cadeau d'argent | — | Toujours présenté comme **une promesse** (« ce montant n'a pas transité par ZAWELI »). « Transfert confirmé » n'apparaît que pour un statut `TRANSFERRED`, qui ne peut être posé que par le prestataire (garantie SQL). |
| R1 | Monogramme « P » et textes « Pauline » en dur | Initiale et textes dérivés du prénom, texte alternatif fourni avec chaque photo |
| R2 | 3 énigmes et 3 cadeaux exactement, `id="stage-4"` en dur | 1 à 3 énigmes, 1 à 3 cadeaux. Identifiants générés par le moteur. Les 8 ballons restent fixes (exigés par le manifeste : 8 vœux exactement). |
| R3 | Bonne réponse en clair (`answer: 1`) | **Empreinte SHA-256** salée par instantané, vérifiée par le runtime (classe « affective » : protection contre la lecture du code source, pas contre un attaquant) |
| R5 | `index.html` en dur | Métadonnées générées. L'aperçu de partage de `/g/…` est **neutre** et ne dévoile ni le prénom ni le contenu. |
| R6 | Singletons globaux | Encapsulés dans le moteur (`audioBus`, défilement, confettis). L'aperçu en iframe est prévu (A4). |
| R7 | JavaScript | TypeScript strict |
| R8 | `user-select: none` sur toute la page | Limité aux boutons : la lettre se copie |
| R9 | Code mort `_to_delete/` | Non porté |
| R10 | Ballons devant le titre | Le texte passe au-dessus des ballons, qui restent cliquables (vérifié dans Chrome) |
| R11 | Application Vite | Composants clients rendus par Next.js 16 |
| Progression | Un rechargement faisait tout recommencer | **Mémorisée localement** (S18). Après l'enveloppe, on reprend à l'étape atteinte. |
| Sections | Toutes obligatoires | Écrin, énigmes et cadeaux peuvent être masqués par l'expéditeur (validé par le schéma) |

---

## 4. Isolation entre SaaS et template

- Les jetons Tailwind de Coffret sont **préfixés** (`cf-gold`, `cf-ivory`…). Sans préfixe, le `gold` de Coffret (#d9ac55) aurait écrasé celui du SaaS (#b8862f).
- Les règles sont encapsulées sous `[data-template="coffret"]`, et les animations sont préfixées `cf-`.
- La feuille de styles n'est chargée **que** lorsque le renderer est affiché (import dynamique par version).
- Le thème Tailwind est importé en mode **référence** : la feuille de Coffret ne redéclare aucune variable globale du SaaS. J'ai corrigé ce point pendant cette phase, après avoir constaté que `--font-sans` était remplacé sur les pages d'expérience.

Vérifié dans Chrome : sur `/` et `/status`, la feuille de Coffret n'est pas chargée, et le fond et la police du SaaS sont intacts. Sur la démonstration, la feuille est chargée et `body` garde la police du SaaS.

---

## 5. Lancer la démonstration et une vraie expérience

Démonstration publique (sans base) : http://localhost:3000/templates/coffret/demo

Vraie expérience publiée depuis la base locale :

1. Démarrer Supabase local :
```bash
pnpm db:start
```
2. Générer les fichiers d'environnement. **La clé locale change à chaque redémarrage de Supabase**, il faut donc relancer cette commande à chaque fois :
```bash
pnpm env:local
```
3. Copier les manifestes en base :
```bash
pnpm templates:sync
```
4. Publier une expérience de démonstration (le script affiche son lien `/g/…`) :
```bash
pnpm demo:seed
```
5. Lancer l'API et le site :
```bash
pnpm dev
```

`pnpm demo:seed` refuse de s'exécuter ailleurs que sur la base locale. Il passe par le vrai chemin de données :
- un utilisateur Supabase Auth ;
- un destinataire ;
- trois cadeaux typés, soumis aux contrôles SQL (statut initial, montant, décision C1) ;
- la consommation d'un droit de licence (`app.consume_publication`) ;
- un instantané figé et un lien public.

---

## 6. Vérifications réellement exécutées

| Vérification | Résultat |
| --- | --- |
| `pnpm lint`, `pnpm typecheck` | 9 paquets réussis |
| `pnpm test` | **39 tests** : 24 pour le moteur, 5 pour Coffret, 10 pour l'API |
| `pnpm test:e2e` | **11 tests** contre le vrai Supabase, dont la nouvelle route publique : sert l'instantané, ne fait fuir ni le brouillon ni la partie protégée, même 404 pour une expérience désactivée ou inexistante, lien mal formé refusé |
| `pnpm test:db` | 68 vérifications du schéma |
| `pnpm build` | Démonstration prérendue en statique, `/g/[slug]` en rendu partiel |
| `templates:sync` joué deux fois | « ajouté » puis « inchangé » |
| **Parcours complet dans Chrome** (390 × 844, tactile) sur `/g/…` depuis la base | 0 erreur. Mauvaise réponse puis bonne, 3 cadeaux déballés, bougie, 8 ballons, lettre, redémarrage. **Reprise après rechargement (S18)**. Ticket argent : « promesse », jamais « transféré », « payé » ni « livré ». |
| Même parcours sur la démonstration | 0 erreur, aucun débordement horizontal |
| Garde-fou d'immutabilité | L'empreinte de Coffret 1.0.0 est figée dans un test (`78e3cf4d…`) : une modification du manifeste publié fait échouer les tests |

**Non vérifié** : le son à l'oreille (navigateur headless) et un téléphone réel.

---

## 7. Ce qui n'est pas encore fait

- **Création par l'utilisateur** : aucun assistant de personnalisation ni aucune API de brouillons, médias ou publication. La seule expérience réelle est celle créée par `pnpm demo:seed`. Ce sera le chantier « création guidée », avec l'authentification.
- **Construction de la charge publique côté API** : `buildPublicPayload` existe et il est testé, mais il n'est pas encore appelé par une route de publication.
- **Code d'accès** (`access_code_hash`) : non géré. Une expérience protégée par code **n'est pas servie** plutôt que servie sans contrôle.
- **Code d'un bon** (`VOUCHER.code`) : prévu comme donnée protégée, mais sa révélation via l'API n'est pas implémentée. Le ticket ne l'affiche donc pas.
- **Musique** : la sélection du manifeste n'est pas encore déclarée. Le bus audio est prêt à l'accueillir.
- **Aperçu en iframe** (`/preview/[draftId]`) : il viendra avec l'assistant.
- Les **photos de démonstration** sont des illustrations générées, en attendant des visuels sous licence (décision C16).

---

## 8. Ajouter une version ou un template

- **Corriger Coffret** sans changer ses champs : créer `coffret@1.0.1`, avec un nouveau manifeste, une nouvelle entrée dans `manifests` et dans le registre web. Le renderer 1.0.0 reste en place pour les expériences déjà publiées.
- **Nouveau template** : un nouveau paquet `templates/<slug>` (manifeste, renderer, styles préfixés, démonstration), une entrée dans le registre `apps/web/src/experiences/registry.tsx` et dans le script de synchronisation. **Aucune modification du moteur n'est nécessaire** si les types de champs existants suffisent.
