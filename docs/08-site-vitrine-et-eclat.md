# ZAWELI — Site vitrine, template Éclat et premières notes MbiyoPay

> Statut : **livré, à valider**.
> Date : 6 novembre 2026.
> Demande : rendre les interfaces vues par les clients cohérentes et professionnelles (pas « fait par une IA »), utiliser GSAP avec finesse, ajouter la page Fifi aux templates, et mettre en ligne la présentation des services.

---

## 1. Site vitrine (public)

| Page | URL | Contenu |
| --- | --- | --- |
| Accueil | `/` | Ouverture éditoriale avec deux vrais écrans de produit, bandeau des occasions, **parcours épinglé** au défilement (6 scènes de Coffret), les deux modèles, les cadeaux, « en trois temps », entreprises (à venir), questions, appel final |
| Modèles | `/modeles` | Catalogue en deux colonnes décalées, couvertures réelles |
| Fiche modèle | `/modeles/coffret`, `/modeles/eclat` | Pitch, caractéristiques **lues dans le manifeste**, **démo réelle jouable dans un téléphone** (iframe), étapes de l'assistant, temps forts |
| Démonstration | `/modeles/<slug>/demo` | L'expérience complète, sans habillage du site |
| Tarifs | `/tarifs` | Les 4 formules et leurs règles **déjà décidées**, sans aucun prix (« Prix à l'ouverture »), et ce qui reste acquis à l'expiration |
| Questions | `/questions` | 7 réponses, accessibles sans JavaScript (`details` / `summary`) |
| Destinataire | `/g/<lien>` | Inchangé |

### Direction visuelle (U1 affinée)

- **Typographie** : Fraunces en grande taille optique (axes `SOFT` et `WONK` sur les mots en italique) et **Instrument Sans** pour le texte. J'ai écarté Inter, devenue la signature des sites générés.
- **Couleurs** : papier chaud `#f6f1e8`, encre `#1a1311`, bordeaux profond `#6d0f1d`, or retenu `#a8823f`, sections de nuit `#140d0c`.
- **Langage graphique** : filets d'un pixel, index éditoriaux « (01) », grille de 12 colonnes, mises en page asymétriques. **Aucun** dégradé décoratif, emoji ni grille d'icônes.
- **Visuels** : uniquement de **vraies captures** des deux templates, prises dans les démonstrations (14 images WebP, environ 500 Ko).
- **Ton** : tutoiement, phrases courtes et précises, aucune promesse que le produit ne tient pas encore. « La création en ligne ouvre prochainement » et « Prix à l'ouverture » sont dits clairement.

### Mouvement (GSAP)

- Titres révélés ligne par ligne (SplitText avec masque), au chargement ou à l'entrée dans l'écran.
- Images dévoilées par un masque (`clip-path`) avec un léger zoom arrière.
- Parallaxe douce sur les téléphones de l'ouverture.
- **Parcours épinglé** sur ordinateur : le texte avance, l'écran du téléphone change et une barre de progression se remplit. Sur mobile, c'est une pile simple.
- Bandeau des occasions en boucle continue, défilement doux (Lenis), en-tête qui se retire quand on descend.
- Tout est désactivé si l'utilisateur préfère réduire les animations.

### Corrections faites pendant la revue visuelle

- Sur mobile, la virgule après « *moment* » passait seule en début de ligne : l'italique et sa ponctuation sont maintenant insécables.
- Dans le parcours épinglé, le fondu enchaîné superposait deux écrans : transition raccourcie, l'écran reste net.
- Sur les tarifs, le titre « Multi-usage » se coupait et l'étiquette était écrasée : l'étiquette passe au-dessus du titre.

---

## 2. Template Éclat 1.0.0 (issu de la page Fifi)

- `templates/eclat` : la scénographie de Fifi est **conservée**. On y trouve l'intro en rideau avec SplitText, le portrait sous arche avec ses pétales, la réussite (date monumentale, frise, photos), la galerie asymétrique et sa visionneuse, la lettre, le moment magique (fleur dessinée et pétales) et le final.
- **33 champs** et **6 sections** : `achievement`, `gallery`, `letter` et `magic` sont facultatives. Les numéros de chapitre se recalculent selon les sections affichées.
- Le moteur gagne trois types de champs : `textList` (paragraphes), `photoList` (photos légendées) et `entryList` (étapes titre et texte). L'empreinte de Coffret est **inchangée**.
- La démonstration utilise un personnage fictif (« Nadia ») et des compositions graphiques. **Aucune photo de Fifi, aucun texte personnel** : la lettre d'excuses n'a pas été reprise.
- Styles isolés comme ceux de Coffret : jetons `ec-`, encapsulation sous `[data-template="eclat"]`, thème Tailwind en référence, polices auto-hébergées (Cormorant Garamond, Manrope, Pinyon Script).
- Garde-fou d'immutabilité : empreinte `1474ddd8…` figée dans un test. `pnpm templates:sync` a bien ajouté `eclat@1.0.0`.
- Écart assumé : le code porté de Fifi s'écarte de `noUncheckedIndexedAccess` (accès aux tableaux). L'option est désactivée pour ce seul paquet, plutôt que de réécrire du code d'animation éprouvé.

---

## 3. Vérifications exécutées

| Vérification | Résultat |
| --- | --- |
| `pnpm lint`, `pnpm typecheck` | 11 paquets réussis |
| `pnpm test` | 43 tests : 24 pour le moteur, 5 pour Coffret, 4 pour Éclat, 10 pour l'API |
| `pnpm test:e2e` | 11 tests contre Supabase local |
| `pnpm test:db` | 68 vérifications |
| `pnpm build` | Toutes les pages vitrines prérendues en statique |
| Chrome, ordinateur (1440 px) et mobile (390 px) | Accueil, modèles, fiches, tarifs et questions : 0 erreur, 0 débordement horizontal |
| Parcours complet d'Éclat (ordinateur et mobile) | Intro, 6 chapitres numérotés 01 à 06, visionneuse (flèches, Échap), moment magique, redémarrage : 0 erreur |

**Non vérifié** : un vrai téléphone, et un retour humain sur le design. Une capture ne remplace pas un regard.

---

## 4. MbiyoPay : ce que dit la documentation

Sources lues : <https://dashboard.mbiyo.africa/docs/guide/introduction> et la collection Postman publiée par MbiyoPay. Les pages du menu (Authentification, Webhooks, Erreurs…) **n'étaient pas lisibles** par mon outil, car leurs liens n'étaient pas exposés.

| Sujet | Trouvé |
| --- | --- |
| Base | `https://dashboard.mbiyo.africa`, API sous `/api/v1/…`. Pas d'hôte de test distinct repéré. |
| Authentification | Jeton porteur avec une clé API « live ou test » (`Authorization: Bearer <clé>`). C'est déduit de la collection Postman, à confirmer. |
| Paiement entrant | `POST /api/v1/merchant/payin`, avec `amount`, `currency`, `payment_method: "mobile_money"`, `order_id`, `callback_url`, et `metadata.phone_number`, `metadata.network`, `metadata.country_code` |
| Paiement sortant | `POST /api/v1/merchant/payout`, même forme. `metadata.beneficiary` est vu dans certains exemples. |
| Statut | `GET /api/v1/merchant/transactions/:reference`. Liste filtrable par statut (`pending`, `successful`, `failed`, `cancelled`). |
| Étape OTP | `POST /api/v1/merchant/transactions/:id/finalize` avec `{ "otp": … }`, pour certains flux |
| Webhooks | Seul `POST …/transactions/:id/resend-webhook` est visible. **Format, signature et politique de relance : NON TROUVÉS.** |
| RDC | Vodacom, Airtel, Orange, Africell, en CDF et USD. D'autres pays d'Afrique sont couverts. |
| Montants | La documentation indique des montants en plus petite unité (÷ 100), alors que les exemples ressemblent à des unités pleines. **Contradiction à lever.** |
| Idempotence, remboursements, numéros de test, frais | **Non trouvés** |

**Conséquence** : l'abstraction `PaymentProvider` de l'architecture (A10) est compatible, puisque `createPayment` correspond à `payin`, `fetchStatus` à `transactions/:reference`, et le rapprochement est possible.
**Bloquant avant tout code** : la **vérification de signature des webhooks**. Sans elle, une licence ne peut pas être activée en sécurité (principe P6). Il faut demander à MbiyoPay la page Webhooks complète (en-tête, algorithme, secret) et la règle exacte des montants.

---

## 5. PostgreSQL installé sur le poste

Il ne gêne pas Supabase local : Supabase utilise ses propres ports (54321 à 54324) et tourne dans Docker. Le PostgreSQL du poste écoute en général sur 5432. **Rien à changer**, à moins que tu veuilles l'utiliser pour autre chose.
