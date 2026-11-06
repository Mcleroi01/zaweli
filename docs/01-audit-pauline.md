# ZAWELI — Phase 0 : audit du projet Pauline et de l'environnement

> Statut : **livrable de la phase 0, à valider**.
> Date de l'audit : 6 novembre 2026.
> Périmètre : lecture du code, compilation et parcours complet automatisé. Aucune modification du projet Pauline.

---

## 1. Environnement de travail

| Élément | Constat |
| --- | --- |
| Répertoire ouvert | `D:\Academy\Musongela carlo\zaweli` |
| Contenu initial | Un seul fichier : `Template_Paul-main.zip` (363 Ko) |
| Empreinte SHA-256 de l'archive | `a8538d151652088a0da4fdc9a074d35acbd82eb1d70c46d4dd30126cfd1e5b1f` |
| Projet Pauline | **N'existe pas sous forme de dossier.** C'est l'archive ci-dessus (export GitHub du dépôt `kongol12/Template_Paul`). |
| Méthode d'audit | Archive extraite **dans un dossier temporaire hors du projet**, puis installée, compilée et testée. L'archive d'origine est intacte. |
| Outils disponibles | Node 24.16, npm 11.13, Git Bash, PowerShell 5.1, Chrome, Edge, Python 3, ffmpeg |
| Git | Le dossier `zaweli` **n'est pas un dépôt Git**. |
| Autre dossier ouvert | `D:\Academy\Musongela carlo\formation` : support de formation sans rapport avec ZAWELI, qui n'a pas été analysé. |

### Emplacement proposé pour ZAWELI (à confirmer)

Le dossier `zaweli` existe déjà, il a été créé par toi et ne contient que l'archive. Deux options :

- **Option A (recommandée)** : `zaweli/` devient la racine du monorepo. L'archive est déplacée dans `zaweli/references/pauline/Template_Paul-main.zip` sans être modifiée, ou laissée à la racine et ignorée par Git.
- **Option B** : un sous-dossier `zaweli/ZAWELI/` sert de racine et `zaweli/` ne sert que de conteneur.

Windows ne distingue pas `zaweli` de `ZAWELI`. Créer un dossier `ZAWELI` à côté de `zaweli` est donc impossible.
**Aucun déplacement n'a été fait.** Seul le dossier `docs/` a été créé.

> **Décision D1 (6 novembre 2026) : option A.** `zaweli/` est la racine du monorepo.

---

## 2. Identité du projet Pauline

| Élément | Valeur |
| --- | --- |
| Nom affiché dans le README | **Coffret**, « template de carte d'anniversaire interactive » |
| Nom du paquet | `pour-pauline` |
| Type | Application monopage **100 % statique**, sans serveur ni variable d'environnement |
| Taille du code actif | ~1 670 lignes (JSX, JS et CSS) |
| Cible | **Mobile d'abord**, en portrait. Testé par l'auteur sur iPhone (zones de sécurité, encoche). |
| Confidentialité | `noindex, nofollow` dans `index.html` |

### Stack

| Domaine | Outil | Version installée |
| --- | --- | --- |
| UI | React | 19.3.1 |
| Outillage | **Vite 6** (et non Next.js) | 6.4.5 |
| Langage | **JavaScript (JSX)**, sans TypeScript | — |
| Styles | Tailwind CSS 4 (`@tailwindcss/vite`), jetons `@theme` | 4.3.4 |
| Animations | GSAP + `@gsap/react` | 3.15.1 / 2.1.2 |
| Défilement | Lenis | 1.3.27 |
| Polices | Italiana (titres) et Fraunces Variable (texte), auto-hébergées via Fontsource | 5.3.0 |
| Son | Web Audio API (sons **synthétisés**, aucun fichier audio) | — |

`npm ci` donne **0 vulnérabilité**. Le build produit environ 402 Ko de JS (136 Ko gzippés) et 43 Ko de CSS.
`vite build` s'exécute en 1,3 s.

---

## 3. Vérification réelle du fonctionnement

Le parcours a été exécuté de bout en bout dans Chrome headless, en simulant un iPhone (390 × 844, tactile) :

1. Sceau brisé, puis la carte sort de l'enveloppe et le bouton « Je suis prête » apparaît.
2. L'écrin s'ouvre sur la photo et le message.
3. Énigme I : une **mauvaise** réponse a été choisie volontairement. La carte tremble, l'indice s'affiche et le choix est barré. La bonne réponse retourne ensuite la carte sur la photo.
4. Énigmes II et III résolues.
5. Les trois cadeaux sont déballés et trois « Bon pour » apparaissent.
6. La bougie est allumée puis soufflée. Fanfare, confettis, titre « Joyeux anniversaire Pauline » et envol de 8 ballons.
7. Les 8 ballons ont été éclatés, ce qui révèle les 8 vœux et déclenche le bouquet final.
8. Le mot de la fin s'affiche, puis « Revivre la surprise » ramène à l'enveloppe scellée.

**Résultat : 20 interactions, aucune erreur JavaScript et aucune erreur console. Le redémarrage fonctionne.**

Le son n'a pas été vérifié à l'oreille : un navigateur headless ne restitue pas l'audio.
Le parcours n'a pas été testé sur un vrai téléphone.

Défaut visuel observé : sur mobile, les ballons en vol recouvrent partiellement le titre « Joyeux anniversaire Pauline »
pendant l'animation d'entrée. C'est mineur, mais à corriger lors de l'adaptation.

---

## 4. Architecture du code

```text
Template_Paul-main/
├── index.html            Titre, OG et noindex écrits en dur pour « Pauline »
├── public/images/        6 portraits WebP (37 à 69 Ko), photos réelles de Pauline
├── src/
│   ├── main.jsx          Point d'entrée, import des polices
│   ├── App.jsx           Machine à étapes, Lenis, défilement automatique
│   ├── content.js        Tous les textes et chemins de photos
│   ├── index.css         Jetons, « matières » (velours, laque, feuille d'or, cire), keyframes
│   ├── components/       10 composants actifs
│   └── lib/              gsap.js, scroll.js, sound.js
└── _to_delete/           12 composants d'une ancienne version, non importés (code mort)
```

### 4.1 Orchestration (`App.jsx`)

- `opened` (enveloppe ouverte), `step` (dernière étape révélée) et `sealKey` (clé de remontage pour recommencer).
- Les étapes forment un **tableau de fonctions de rendu**. Seules les étapes `0..step` sont montées : le contenu suivant **n'existe pas dans le DOM** tant que l'étape en cours n'est pas terminée.
- Chaque étape reçoit `onNext` et `showNext`. Elle décide elle-même quand afficher « Continuer ».
- À chaque nouvelle étape, défilement automatique vers `#stage-{n}` via Lenis.
- Défilement verrouillé tant que l'enveloppe est fermée. `main` est `inert` et `aria-hidden`.
- Couches globales : grain, barre de progression (`Pearls`), bouton son (`SoundToggle`) et canvas de confettis unique.

### 4.2 Composants

| Composant | Rôle | Données consommées | Couplages en dur |
| --- | --- | --- | --- |
| `Seal` | Enveloppe 3D (CSS), sceau en 2 moitiés, carte qui sort | `content.seal` | Monogramme **« P »** (×2), `aria-label` « Enveloppe pour Pauline » |
| `JewelBox` | Écrin laqué, couvercle 3D, halo, photo en arche | `content.jewel` | Monogramme **« P »**, `alt` de la photo, `id="stage-0"` |
| `Riddle` | Carte réversible (recto énigme, verso photo), 3 choix, indice, confettis | une entrée de `content.riddles` | Réponse = **index dans le contenu, visible côté client** |
| `Gifts` | 3 paquets (`WRAPS`), déballage, tickets « Bon pour » | `content.gifts` (`items` : **chaînes de texte seules**) | `WRAPS` fixe à 3 éléments, `id="stage-4"` |
| `Celebration` | Machine à phases `candle → lit → blown → party → done`, bougie CSS, 8 ballons, vœux flottants | `content.celebration`, `name`, `age` | `BALLOONS` fixe à 8 positions, `alt` de la photo, `id="stage-5"` |
| `Finale` | Photo, prénom, phrase, lettre, signature, recommencer | `content.finale`, `name`, `from` | `alt` de la photo, `id="stage-6"` |
| `Balloon` | Ballon SVG à dégradé radial (3 teintes) | — | — |
| `Confetti` | Canvas plein écran, API impérative `confetti.burst()` / `cannons()` | — | Singleton global de module |
| `Dust` | Poussière dorée sur canvas, en pause hors écran | — | — |
| `ui.jsx` | `ArchPhoto`, `Continue`, `SoundToggle`, `Pearls` | — | — |

### 4.3 Bibliothèques internes

- `lib/gsap.js` enregistre ScrollTrigger, SplitText et useGSAP, fixe l'easing par défaut et expose `reduced()` et `fontsReady()`. **SplitText est enregistré mais n'est utilisé par aucun composant actif** : seul le code mort de `_to_delete` s'en sert.
- `lib/scroll.js` est un registre global de l'instance Lenis, avec verrouillage et retour en haut.
- `lib/sound.js` contient 7 sons synthétisés (`chime`, `sparkle`, `wrong`, `whoosh`, `pop`, `blow`, `fanfare`), un état muet partagé par abonnement et le déverrouillage iOS au premier geste.

### 4.4 Données (`content.js`)

Un seul objet `content` :
`name`, `age`, `from`, `seal`, `jewel`, `riddles[3]`, `gifts.items[3]`, `celebration.wishes[8]`, `finale`, `next`.

Le README documente lui-même les contraintes : **exactement 3 énigmes, 3 cadeaux et 8 vœux**.
Changer ces nombres oblige à modifier `App.jsx` (`STAGES`), `Gifts.jsx` (`WRAPS`) et `Celebration.jsx` (`BALLOONS`).

### 4.5 Assets

- 6 photos WebP de la personne fêtée. Ce sont des **données personnelles** : elles ne doivent pas servir de démonstration publique ZAWELI sans son accord explicite.
- Les matières sont entièrement en CSS : velours, laque, dorure, ivoire, cire, bougie, flamme et fumée. Il n'y a **aucune image décorative** à gérer.
- Les polices sont auto-hébergées, il n'y a donc aucun appel à Google Fonts.

---

## 5. Qualités à préserver

- Une **narration en étapes verrouillées** : la surprise est réellement préservée, puisque le contenu futur n'est pas dans le DOM.
- Une **direction artistique forte et cohérente** (« coffret de haute joaillerie »), obtenue sans images décoratives.
- L'accessibilité est déjà prise en compte : `prefers-reduced-motion` (durées ramenées à 0,01), `focus-visible`, libellés `aria`, `aria-live` sur les indices et `inert` avant l'ouverture.
- La **performance mobile** est bonne : canvas en pause hors écran, DPR plafonné, densité réduite sur mobile, aucun fichier audio.
- L'usage de GSAP est propre : `useGSAP`, `contextSafe` sur les gestionnaires et nettoyage automatique.
- Le son est synthétisé, sans fichier ni question de droits.

---

## 6. Ce qui doit devenir moteur réutilisable, et ce qui reste propre au template

### 6.1 Candidats au moteur (`packages/template-engine`)

| Élément Pauline | Brique moteur proposée | Remarque |
| --- | --- | --- |
| Machine à étapes de `App.jsx` (`step`, `onNext`, `showNext`, montage progressif) | **`ExperienceRunner`** : séquence d'étapes déclarée par le template, progression et redémarrage | Générique : toute expérience à révélation progressive en a besoin |
| `Pearls` | Indicateur de progression (le template fournit l'apparence) | Logique dans le moteur, rendu dans le template |
| `lib/scroll.js` + Lenis + auto-scroll | Service de défilement (verrouillage, `scrollToStage`) | Réutilisable tel quel |
| `lib/gsap.js` (`reduced`, `fontsReady`) | Utilitaires d'animation partagés | Réutilisable tel quel |
| `lib/sound.js` | **Bus audio** : effets, état muet, déverrouillage au geste | À fusionner plus tard avec la **musique** (Spotify / fichiers) sous un même contrôle |
| `Confetti` (API impérative) | Effet partagé `effects.confetti` | Les couleurs sont fournies par le template |
| `Dust` | Effet partagé | Paramétrable |
| Logique de `Riddle` (choix, tentatives, indice, état résolu) | **Moteur d'énigmes** : questions, réponses, tentatives, conditions de déblocage | Le visuel (carte réversible) reste dans le template |
| Logique de `Gifts` (paquets ouverts, tous ouverts → suite) | **Moteur de cadeaux** : liste de cadeaux typés (MONEY, PHYSICAL, INVITATION, VOUCHER, EXPERIENCE), état d'ouverture | Aujourd'hui, un cadeau n'est qu'une **chaîne de texte** : c'est le chantier principal |
| `content.js` | **Schéma de contenu déclaré par le template**, validé (Zod côté web, DTO côté API) | Remplace l'objet statique |

### 6.2 Reste propre au template « Coffret / Pauline »

- Le décor et les matières : velours, laque, feuille d'or, cire et carte ivoire (`index.css`).
- Les mises en scène : enveloppe et sceau, écrin, carte réversible, paquets laqués, bougie, ballons SVG et leurs 8 positions.
- Les polices Italiana et Fraunces.
- Les **timelines GSAP de chaque scène**, à conserver telles quelles et à ne pas réinventer.

### 6.3 Points à refactoriser lors de l'intégration (phase 6)

| # | Problème | Correction proposée |
| --- | --- | --- |
| R1 | Monogramme « P » et textes `alt` / `aria-label` « Pauline » écrits en dur | Les dériver des données (initiale du prénom, `alt` fourni avec chaque photo) |
| R2 | Nombres figés (3 énigmes, 3 cadeaux, 8 ballons) et `id="stage-n"` en dur | Identifiants générés par le runner. Bornes min/max déclarées dans le manifeste du template, avec un nombre exact si le design l'exige (positions des ballons). |
| R3 | **Bonnes réponses en clair dans le bundle** (`answer: 1`) | Acceptable pour du contenu purement affectif. **Interdit** dès qu'une énigme débloque un cadeau à valeur (argent, bon) : la validation doit se faire **côté serveur**. |
| R4 | Cadeaux réduits à du texte | Modèle de cadeau typé et extensible (voir §7) |
| R5 | `index.html` (titre, OG) en dur | Métadonnées générées par la route publique `/g/[slug]` de Next.js |
| R6 | Singletons de module (`confetti`, `lenis`, `sound`) | Acceptables sur une page d'expérience. À encapsuler dans un contexte pour l'aperçu dans le tableau de bord (plusieurs instances, démontage). |
| R7 | JavaScript sans types | Migration en TypeScript au moment du portage |
| R8 | `user-select: none` sur tout le `body` | Le limiter aux zones interactives : empêcher de copier la lettre est une gêne |
| R9 | Code mort `_to_delete/` et SplitText enregistré sans usage | Ne pas porter |
| R10 | Ballons qui recouvrent le titre pendant l'entrée sur mobile | Ajuster positions et délais au portage |
| R11 | Vite + SPA, alors que ZAWELI cible Next.js App Router | Les composants sont 100 % client : ils deviendront des composants `"use client"` rendus par `/g/[slug]`. Aucune dépendance à Vite dans le code des composants. |

---

## 7. Écart entre Pauline et les exigences ZAWELI

| Exigence ZAWELI | État dans Pauline | Effort estimé |
| --- | --- | --- |
| Contenu alimenté par des données | Objet statique `content.js` | Moyen : schéma + chargement par slug |
| Cadeaux typés (MONEY, PHYSICAL, INVITATION, VOUCHER, EXPERIENCE) | Texte libre « Bon pour… » | **Élevé** : modèle de données, formulaires par type, rendu par type dans le ticket |
| Distinction promesse / transfert réel d'argent | Inexistante | **Élevé** : nécessite le prestataire de paiement et un état confirmé côté serveur |
| Énigmes paramétrables avec tentatives et déblocage | 3 énigmes à choix multiple, tentatives illimitées, état en mémoire | Moyen. Élevé si le déblocage protège une valeur. |
| Musique d'ambiance (Spotify / fichier) | Absente. Seulement des effets synthétisés. | Moyen : lecteur + contraintes Spotify (§8) |
| Sections facultatives | Toutes obligatoires | Faible côté runner, à déclarer dans le manifeste |
| Persistance de la progression du destinataire | Aucune (un rechargement fait tout recommencer) | Faible en local, moyen en serveur |
| Versionnement du template | Aucun | Conception moteur (phase 2) |

---

## 8. Contraintes techniques externes identifiées

### MbiyoPay (consulté le 6 novembre 2026 : pages `/`, `/kyc`, `/liens-de-paiements`)

- **Aucune documentation API publique trouvée.** Le menu « APIs » existe, mais aucune référence technique n'est accessible.
  Je n'ai trouvé aucune mention de webhooks signés, de bac à sable, de clés d'idempotence, de remboursements, ni de méthode d'authentification API.
- Le site annonce le mobile money (Vodacom, Airtel, Orange, Africell…), Visa et Mastercard (3-D Secure), les liens de paiement, et du « Payin & Payout » avec paiements en masse.
- Devises annoncées : CDF, USD, EUR, NGN. Pays : RDC, Côte d'Ivoire, Cameroun, Kenya, Nigeria, Ouganda, Europe et USA.
- L'inscription d'un marchand exige un **KYB** : certificat d'incorporation, RCCM, siège social et bénéficiaires effectifs.
- **Conséquence** : impossible de concevoir l'intégration en détail sans la documentation développeur. Elle doit être demandée à MbiyoPay, avec un compte marchand de test.
  Les **cadeaux MONEY avec transfert réel** dépendent en plus de l'API **Payout** et de ses obligations réglementaires (KYC du destinataire, conformité).

### Spotify (à approfondir en phase « Musique »)

- Le lecteur **Spotify Embed** (iframe, avec l'API iFrame pour lecture et pause) est le seul moyen réaliste sans compte du destinataire.
  Il joue des **extraits** aux visiteurs non connectés, et la lecture complète dépend de la connexion Spotify du destinataire. Ce point est à confirmer dans la documentation officielle.
- Le **Web Playback SDK** exige un compte **Premium** et l'authentification **de l'auditeur** : il ne convient donc pas pour un destinataire anonyme.
- L'autoplay avec son est bloqué par les navigateurs : un geste du destinataire est obligatoire. Pauline le fait déjà en déverrouillant l'audio au bris du sceau, et ce geste peut servir de déclencheur unique.
- Pour les fichiers audio hébergés par ZAWELI, il faudra une **bibliothèque libre de droits sous licence documentée**. Un téléversement par l'utilisateur pose la question des droits.

### OpenRouter

Il n'a pas encore été étudié : il ne concerne pas Pauline. Ce sera fait en phase 2 (abstraction du fournisseur IA).

---

## 9. Risques identifiés à ce stade

1. **Paiement** : faute de documentation API publique MbiyoPay, c'est un risque de planning et de faisabilité pour MONEY, SOLO et MULTI-USE.
2. **Cadeau d'argent réel** : il touche à la réglementation (transmission de fonds, KYC, litiges). Recommandation : en MVP, uniquement des **promesses** clairement libellées, ou des paiements encaissés par ZAWELI avec reversement manuel documenté. **Décision à prendre.**
3. **Photos personnelles** : les photos de Pauline ne doivent pas apparaître dans la démo publique. Il faudra des visuels de démonstration dont ZAWELI a les droits.
4. **Changement de stack** (Vite → Next.js) : le risque est faible pour les composants, qui n'utilisent ni routeur ni API Vite. Les singletons demanderont toutefois de l'attention dans l'aperçu.
5. **Spotify** : risque d'expérience décevante (extraits de 30 s) si les attentes ne sont pas cadrées.
6. **Absence de Git** : à initialiser dès la phase 5 pour tracer l'historique du nouveau projet.

---

## 10. Décisions à prendre (phase 0)

| # | Décision | Ma recommandation |
| --- | --- | --- |
| D1 | Racine du monorepo : `zaweli/` (option A) ou `zaweli/ZAWELI/` (option B) | ✅ **Décidé le 6 novembre 2026 : option A**, la racine est `D:\Academy\Musongela carlo\zaweli` |
| D2 | Sort de l'archive `Template_Paul-main.zip` | La déplacer telle quelle vers `references/pauline/` et l'ignorer dans Git |
| D3 | Nom du premier template : « Coffret » (nom du README) ou « Pauline » (nom d'une personne réelle) | **« Coffret »** : un nom de template ne doit pas être un prénom réel |
| D4 | Photos de démonstration du template | Prévoir des visuels sous licence. Ne jamais publier les photos de Pauline. |
| D5 | Initialiser un dépôt Git dans ZAWELI | Oui, en phase 5 |
| D6 | Contact MbiyoPay pour la documentation API et un compte de test | À lancer **dès maintenant**, en parallèle de la conception : c'est le chemin critique |

---

## 11. Éléments non terminés à ce stade

- Le cahier des charges (phase 1), l'architecture (phase 2), le modèle de données (phase 3) et la feuille de route ne sont **pas encore rédigés**. Ils suivent après ta validation de cet audit.
- Le dossier du monorepo n'est **pas encore initialisé** : il attend la décision D1.
- Le son de Pauline n'a pas été vérifié à l'oreille, et le parcours n'a pas été testé sur un appareil physique.
