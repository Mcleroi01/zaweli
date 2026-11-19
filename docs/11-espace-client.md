# ZAWELI — Espace client : comptes, tableau de bord, création guidée

> Statut : **livré, à valider**.
> Date : 19 novembre 2026.
> Entrées : [cahier des charges](02-cahier-des-charges.md) §6.1, §7.2, §7.4, §7.10, et [maquettes UX](05-maquettes-ux.md) W4 à W10.

---

## 1. Ce qui a été construit

Toutes les pages existent en français (à la racine) et en anglais (sous `/en`), avec les mêmes chemins. Aucune n'est indexée.

| Zone | Pages | Ce qu'elles font |
| --- | --- | --- |
| Accès | `/inscription`, `/connexion`, `/verifier`, `/mot-de-passe` | Inscription par e-mail et mot de passe (8 caractères au moins, lettres et chiffres), **confirmée par un code à 6 chiffres** reçu par e-mail. Aussi : connexion par mot de passe, **connexion Google**, et mot de passe oublié avec un code. La destination est conservée : « Créer avec ce modèle » ramène au modèle après la connexion. |
| Tableau de bord | `/espace` | Licences actives avec leurs jauges, brouillons à reprendre et dernières publications. Un nouvel utilisateur voit « Ta première surprise est offerte ». Un bandeau s'affiche si l'e-mail n'est pas confirmé. |
| | `/espace/experiences` | Filtres par statut. Actions : continuer, copier le lien, **QR code** (PNG ou SVG), désactiver ou réactiver le lien, supprimer. |
| | `/espace/destinataires` | Ajouter, corriger ou supprimer une fiche. Une fiche liée à une licence est signalée et ne peut pas être supprimée. |
| | `/espace/licences` | Validité, créations, destinataires liés et aide à l'écriture |
| | `/espace/compte` | Nom affiché, langue de l'interface et des e-mails, **pays** (facultatif : sans choix, l'API le déduit de la connexion ; il alimente la carte de l'administration), changement de mot de passe, déconnexion |
| Création | `/espace/creer`, puis `/espace/creer/[modèle]` | Choix du modèle, « Pour qui ? » (fiche existante ou nouvelle), langue de l'expérience |
| | `/espace/brouillon/[id]` | **Assistant généré depuis le manifeste** du modèle : étapes avec leur état (✓ ou ⚠), compteurs de caractères, listes bornées, énigmes, scènes facultatives et cadeaux typés avec leur encart de vérité. **Enregistrement automatique**, sans écraser un autre onglet. Puis vérification, choix de la licence (le droit gratuit n'est jamais présélectionné), publication, et partage par copie, partage natif, WhatsApp ou **QR code** téléchargeable en PNG (1024 px) ou en SVG. |

Mise en page (docs/05 §4.2) :
- sur ordinateur, une barre latérale ;
- sur mobile, des onglets en bas (Accueil, Expériences, +, Licences, Compte) ;
- la création n'a pas de navigation globale.

Le ton est le tutoiement en français.

Sur le site public, on trouve aussi :
- un lien « Se connecter » dans l'en-tête ;
- un bouton « Créer avec ce modèle » sur chaque fiche de modèle.

## 2. Sécurité

- **Navigateur :** il ne détient que la session Supabase. Toute donnée passe par l'API, qui vérifie le jeton (JWKS), la propriété, les licences et les quotas.
- **Pages :** elles ne contiennent aucune donnée personnelle. Le contenu est chargé après la connexion.
- **Après connexion :** la destination ne peut être qu'un chemin interne au site, jamais une autre adresse.
- **Droit gratuit :** il est réservé aux comptes à l'e-mail confirmé. Cette règle est vérifiée en base (`app.is_email_confirmed`).
- **Profil :** il reprend à l'inscription la langue de la page et le prénom (migration `20261119000100_signup_profile.sql`). Avec Google, il reprend le nom fourni par Google.

## 3. Vérifications exécutées

| Vérification | Résultat |
| --- | --- |
| `pnpm lint` · `pnpm typecheck` · `pnpm build` | Réussis. Les 24 pages de l'espace (12 par langue) sont construites. |
| `pnpm test` | **77 tests**, dont 44 pour l'API. Nouveaux : profil repris de l'inscription, définition des champs d'un modèle, noms de formules traduits. |
| `pnpm test:db` | **71 vérifications** du schéma |
| Parcours réel dans le navigateur | Avec l'API réelle sur PostgreSQL embarqué, et un serveur d'authentification de test qui émet de vrais jetons ES256 (ce banc n'est pas livré). Vérifiés : <ul><li>inscription ; mot de passe trop faible refusé ;</li><li>mauvais code refusé, bon code accepté ;</li><li>arrivée sur le tableau de bord avec la licence gratuite ;</li><li>création d'une fiche et d'un brouillon ;</li><li>enregistrement automatique et ajout d'un cadeau d'argent ;</li><li>liste de vérification ;</li><li>connexion avec un mauvais mot de passe, puis avec un compte non confirmé (renvoyé vers le code) ;</li><li>pages anglaises ; mobile à 375 px sans débordement.</li></ul> |

**Non vérifié** :
- **Le vrai Supabase.** Il n'existe pas encore de projet hébergé, et Docker est absent ici.
- **Le retour de Google.** Il exige les identifiants OAuth.
- **La publication complète.** Coffret et Éclat exigent des photos, et l'envoi des photos n'est pas encore construit. La publication est donc refusée tant qu'elles manquent, avec un message clair.

## 4. Mise en ligne : réglages Supabase

Dans le projet Supabase hébergé (tableau de bord) :

1. **Auth → Providers → Email** :
   - activer « Confirm email » ;
   - régler la longueur du code (OTP) à 6 ;
   - mot de passe : 8 caractères au moins, lettres et chiffres.
2. **Auth → Email Templates** :
   - pour « Confirm signup » et « Reset password », coller le contenu de [`supabase/templates/confirmation.html`](../supabase/templates/confirmation.html) et [`supabase/templates/recovery.html`](../supabase/templates/recovery.html) ;
   - ces modèles affichent le code (`{{ .Token }}`) dans la langue d'inscription.
3. **Auth → Providers → Google** :
   - coller l'ID client et le secret créés dans Google Cloud Console ;
   - y ajouter l'URI de redirection `https://<projet>.supabase.co/auth/v1/callback`.
4. **Auth → URL Configuration** :
   - site (« Site URL ») : `https://zaweli.store`. C'est l'adresse que Supabase met dans un e-mail quand la redirection demandée n'est pas autorisée : laissée à `http://localhost:3000` (sa valeur par défaut), elle envoie les nouveaux comptes vers localhost ;
   - redirections autorisées : `https://zaweli.store/**` (espace, `/en/espace`, `…/espace/creer/*`), plus `http://localhost:3000/**` pour le développement.
5. **Auth → SMTP** : configurer un fournisseur d'e-mails (A12). L'envoi par défaut de Supabase est très limité.

Variables du site (Hostinger, application `zaweli.store`) :
- `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` : la clé publique ;
- `NEXT_PUBLIC_API_URL`, par exemple `https://api.zaweli.store`.
- `NEXT_PUBLIC_SITE_URL` (facultatif) : origine des liens envoyés par e-mail et des liens de partage. En production, `https://zaweli.store` par défaut ; en développement, l'adresse de la page.

Côté API, `CORS_ORIGINS` doit contenir `https://zaweli.store`.

## 5. Ce qui n'est PAS encore fait

| Sujet | Prochaine étape |
| --- | --- |
| Envoi des photos (recadrage, contrôle du fichier, WebP, suppression des métadonnées EXIF) | Lot « Médias » : il débloque la publication de Coffret et d'Éclat |
| Aperçu réel du brouillon dans un cadre de téléphone (X3) | Route `/preview/[id]` en iframe, qui rendra le modèle avec le contenu du brouillon |
| Paiement des formules (MbiyoPay) | Dès réception de la documentation de leur API |
| Aide à l'écriture (bouton « Suggérer ») | Lot IA (OpenRouter) |
| Mes achats, Mes cadeaux | Après le paiement |
