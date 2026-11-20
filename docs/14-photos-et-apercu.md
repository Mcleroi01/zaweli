# ZAWELI — Photos et aperçu du brouillon

> Statut : **livré, à valider**.
> Date : 20 novembre 2026.
> Entrées : [cahier des charges](02-cahier-des-charges.md) §7.5 (aperçu) et §7.8 (médias), architecture A11.

---

## 1. Photos

Parcours, dans l'assistant (champs photo, listes de photos, photos des énigmes) :

1. **Choix du fichier** : le sélecteur n'accepte que JPEG, PNG et WebP. Sur iPhone, une photo HEIC est alors convertie en JPEG par le téléphone.
2. **Préparation dans le navigateur** : l'image est redressée selon l'orientation du téléphone et réduite à 2 560 px sur le plus grand côté. Cela économise les données mobiles.
3. **Envoi direct à Supabase Storage**, sur une adresse signée émise par l'API (`POST /v1/media/uploads`). Le fichier ne transite pas par l'API.
4. **Traitement par l'API** (`POST /v1/media/{id}/complete`) :
   - le vrai type du fichier est vérifié par sa signature, jamais par son extension ;
   - le fichier doit faire moins de 25 Mo et 60 mégapixels ;
   - l'image est redressée puis convertie en **WebP en 3 tailles** (480, 960 et 1 600 px de large), **sans aucune métadonnée** : ni EXIF, ni position GPS, ni modèle de téléphone ;
   - le fichier d'origine est supprimé.
5. **Description obligatoire** : elle est lue aux personnes qui ne voient pas l'image. Elle est pré-remplie avec le nom du champ et modifiable. Les listes de photos ont aussi une légende facultative.
6. **À la publication**, chaque photo est copiée dans le stockage public, sous un chemin aléatoire qui ne contient aucun identifiant de compte. Les brouillons restent privés : les vignettes passent par des adresses temporaires d'une heure.

Stockage (déjà créé par la migration 0900) : `uploads` (privé, fichiers bruts), `media` (privé, variantes des brouillons), `published` (public).

Limite : trois fois le nombre de photos prévu par le modèle, par expérience. Cela laisse de la marge pour remplacer des photos.

**Configuration** : variable `SUPABASE_SECRET_KEY` de l'API, la clé secrète (service role) du projet Supabase, jamais exposée au navigateur. Sans elle, l'envoi de photos est indisponible ; le reste fonctionne.

## 2. Aperçu du brouillon

- Le bouton **« Aperçu »** est dans l'en-tête de l'assistant. Il enregistre le brouillon puis ouvre l'aperçu dans un nouvel onglet.
- L'API (`GET /v1/experiences/{id}/preview`) construit la charge avec **le même moteur que la publication**, à partir du brouillon. Rien n'est publié ni consommé.
- Une photo en cours de traitement, ou un cadeau supprimé, est simplement omis.
- Les champs encore vides sont complétés par **l'exemple du modèle**, et la bannière l'indique (par exemple « 3 éléments non remplis : exemple du modèle »).
- Deux affichages :
  - **Téléphone** : l'expérience tourne dans un cadre de 390 px, une vraie fenêtre mobile ;
  - **Plein écran**.

## 3. Correction au passage : scènes facultatives masquées

Masquer une scène facultative, par exemple « Les cadeaux » dans Coffret, n'empêche plus la publication. Ses champs ne sont plus exigés tant qu'elle est masquée, et ils redeviennent obligatoires si elle est gardée (`compileContentSchema`, test dans `coffret.test.ts`).

## 4. Vérifications exécutées

| Vérification | Résultat |
| --- | --- |
| `apps/api/test/media.spec.ts` | Avec un vrai traitement sharp sur un JPEG de 3 000 × 2 000 px qui porte des coordonnées GPS et l'orientation 6 : <ul><li>sortie WebP aux bonnes largeurs, image redressée, aucun EXIF ;</li><li>fichier d'origine supprimé ;</li><li>faux fichier image refusé ;</li><li>photos d'un autre compte inaccessibles ;</li><li>publication : 4 copies publiques sous des chemins aléatoires, aucun identifiant de compte dans la page publique.</li></ul> |
| `pnpm test` (tous les paquets) · `pnpm test:db` | 70 tests pour l'API ; 25 pour le moteur, 5 pour Coffret, 4 pour Éclat ; 73 vérifications du schéma |

**Non vérifié** :
- l'envoi réel vers votre projet Supabase Storage (il faut la clé secrète) ;
- ~~l'aperçu et l'envoi de photos dans le navigateur~~ : vérifiés depuis sur le banc local (docs/15 §4). Une vraie photo a été envoyée, traitée, puis affichée en vignette ; l'aperçu s'affiche dans un cadre téléphone de 390 px.
