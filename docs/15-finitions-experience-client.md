# ZAWELI — Finitions de l'expérience client

> Statut : **livré, à valider**.
> Date : 20 novembre 2026.
> Entrées : [cahier des charges](02-cahier-des-charges.md) §7.2, §7.4, §7.6, §7.7, §7.9, §7.10, §7.11, §9.4, §11.1.
> Voir aussi : [photos et aperçu](14-photos-et-apercu.md), [paiements](12-paiements-mobile-money.md), [parrainage](13-parrainage-et-cartes-cadeaux.md).

---

## 1. Ce qui a été ajouté

| Fonction | Côté expéditeur | Côté destinataire |
| --- | --- | --- |
| **Code d'accès** (§7.6) | Assistant, étape « Vérifier et publier », panneau « Ouverture et musique ». Le code fait de 4 à 20 caractères, sans tenir compte des majuscules. Seule son empreinte est gardée (scrypt salé), jamais le code, même dans le journal. | La page demande le code ; 10 essais par minute au plus. Le code reste valable pour l'onglet : déballage des cadeaux, réception d'un cadeau d'argent. |
| **Date d'ouverture** (§7.6) | Même panneau, avec le jour et l'heure. | Avant l'heure : « Cette surprise s'ouvrira le … », en français et en anglais. |
| **Musique Audius** (§11.1) | Même panneau : recherche, écoute, choix ou retrait. Seuls les titres librement écoutables sont proposés. | Jamais de démarrage automatique : le premier geste lance la musique. Un bouton la coupe ; le titre et l'artiste sont crédités, avec un lien vers Audius. Si la lecture échoue, l'expérience continue sans musique. |
| **Code d'un bon cadeau** (§9.4) | — | Révélé **au déballage** seulement (avec le code d'accès s'il y en a un). Cette route existait dans l'API, mais aucune page ne l'appelait. |
| **Dupliquer** (§7.4) | « Mes expériences » → Dupliquer → pour qui ? On obtient un nouveau brouillon : même modèle, mêmes textes, mêmes photos, mêmes cadeaux, **sauf l'argent**. | — |
| **Aide à l'écriture** (§7.9) | « ✦ Suggérer un texte » sous les champs marqués par le modèle. On choisit le ton, la longueur et des précisions facultatives, puis on lit la proposition. **Rien n'est inséré sans « Utiliser ce texte ».** | — |
| **Préférences d'e-mail** (§7.2) | Mon compte : rappel 3 jours avant la fin d'une formule, et nouveautés de Zaweli. Les e-mails de paiement et de compte partent toujours. | — |
| **Rappel d'expiration** (§7.11) | Envoyé une seule fois par licence, vérifié toutes les heures, et seulement si la personne ne l'a pas désactivé. | — |
| **Export des données** (§7.2) | Mon compte → « Télécharger mes données » : un fichier JSON avec le profil, les destinataires, les expériences, les cadeaux, les achats, les licences et les cartes cadeaux. | — |
| **Suppression du compte** (§7.2) | Mon compte. On confirme en retapant son adresse. Expériences, liens publics, destinataires et photos (privées et publiques) sont supprimés. S'il existe des achats, le compte est **anonymisé et bloqué** dans Supabase Auth plutôt que supprimé, pour garder les pièces comptables. **Refusé** tant qu'un cadeau d'argent payé attend son destinataire. | Les liens ne s'ouvrent plus. |

Les réglages d'ouverture et la musique s'appliquent **tout de suite**, sans republier.

## 2. Aide à l'écriture : règles

- Elle n'est proposée que sur les champs que le modèle a marqués (`aiAssist`), par exemple le titre de l'écrin ou la phrase finale dans Coffret.
- Il faut une licence active qui a encore des suggestions : le quota de la formule est décompté en base.
- **Une suggestion qui échoue n'est pas décomptée.**
- Les consignes données au modèle interdisent d'inventer des faits précis (dates, lieux, noms). Le texte respecte la longueur du champ.
- Le fournisseur est une interface (`AiProvider`). OpenRouter est branché ; on peut changer de modèle sans toucher au produit.
- 10 suggestions par minute au plus.

**Configuration** : variables `OPENROUTER_API_KEY` et `OPENROUTER_MODEL` de l'API. Le modèle est un identifiant OpenRouter de la forme `fournisseur/modèle`, à choisir par l'équipe ; aucun n'est imposé par défaut. Sans ces deux variables, la fonction répond « indisponible ».

## 3. Autres variables

| Variable | Rôle |
| --- | --- |
| `SUPABASE_SECRET_KEY` | Photos (docs/14) **et** suppression ou anonymisation des comptes (API d'administration de Supabase Auth). |
| `SMTP_URL`, `MAIL_FROM` | E-mails, dont le rappel d'expiration (docs/13 §4). |

## 4. Vérifications exécutées

| Vérification | Résultat |
| --- | --- |
| `apps/api/test/client-experience.spec.ts` | 10 tests : <ul><li>code d'accès (empreinte seulement, rien dans le journal ; 401 puis 403 puis ouverture ; casse ignorée ; code du bon cadeau livré seulement avec le bon code d'accès) ;</li><li>date d'ouverture (423 avec la date, puis ouverture) ;</li><li>musique (source autre qu'Audius refusée ; livrée sans republier, aussi dans l'aperçu ; retirée) ;</li><li>réglages réservés à l'auteur ;</li><li>duplication (contenu, photos, cadeaux recopiés avec de nouveaux identifiants ; destinataire d'un autre compte refusé) ;</li><li>préférences ;</li><li>export ;</li><li>suppression (compte sans achat supprimé ; compte avec achat anonymisé, commande gardée ; refus si de l'argent est en jeu) ;</li><li>rappel d'expiration (une seule fois, préférence respectée).</li></ul> |
| `apps/api/test/ai.spec.ts` | 4 tests : nettoyage et longueur ; prénom, ton et précisions transmis ; rien enregistré dans le brouillon ; quota décompté ; échec non décompté ; champ non prévu, absence de quota et brouillon d'un autre compte refusés. |
| `pnpm test` · `pnpm test:db` | 84 tests pour l'API, 25 pour le moteur, 5 pour Coffret, 4 pour Éclat ; 74 vérifications du schéma |

| Parcours dans le navigateur (banc local) | Vérifiés :<ul><li>envoi d'une vraie photo JPEG : réservation, dépôt, traitement, nouvelle vignette ;</li><li>aperçu dans le cadre téléphone (390 px) ;</li><li>aide à l'écriture : quota épuisé signalé, puis proposition, « 4 suggestions restantes » et insertion seulement après « Utiliser ce texte » ;</li><li>enregistrement d'un code d'accès ;</li><li>recherche Audius réelle, choix d'un titre, crédit et bouton de lecture dans l'aperçu ;</li><li>page « Mon compte » ;</li><li>aucun débordement à 375 px (compte, expériences, assistant) ;</li><li>destinataire : mauvais code refusé, bon code accepté malgré les espaces et les majuscules, puis expérience ouverte ; page de réception de l'argent avec le code gardé ; « s'ouvrira le lundi 23 novembre 2026 à 14:32 » avant la date ;</li><li>duplication vers un autre destinataire, avec ouverture du nouveau brouillon.</li></ul> |

**Non vérifié en conditions réelles** : OpenRouter (clé nécessaire), l'API d'administration de Supabase Auth (clé secrète nécessaire), la lecture Audius dans un vrai navigateur mobile.

## 5. Ce qui reste hors de ce lot

- **Connexion par numéro de téléphone (OTP SMS)** : priorité F, décision C15 ouverte (coût des SMS).
- **Statistique d'ouverture visible par l'expéditeur** et **réponse du destinataire** : priorités S et F, décision C12 ouverte (vie privée).
- **Recadrage guidé des photos** (S) : l'image s'adapte au cadre du modèle, sans recadrage manuel.
- ~~Suppression des instantanés publiés d'un compte supprimé~~ : **fait**. La suppression du compte appelle `app.purge_deleted_account`, qui efface les instantanés publiés et les cadeaux. Les commandes, licences et le journal restent pour la comptabilité. Migration `20261120000500`, vérifié par un test.
