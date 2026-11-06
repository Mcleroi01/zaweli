# ZAWELI — Phase 1 : cahier des charges

> Statut : **v0.2, validé pour passer à la phase 2** (C1, C2 et C7 décidés ; les autres décisions du §15 restent ouvertes).
> Version : 0.2, du 6 novembre 2026.
> Références : [01-audit-pauline.md](01-audit-pauline.md) et la mission initiale.
>
> Convention utilisée dans ce document :
> - **[DÉCIDÉ]** : règle déjà fixée par toi, reprise telle quelle.
> - **[RECO]** : ma recommandation, qui doit être validée avant d'être appliquée.
> - **[OUVERT]** : question commerciale ou produit non tranchée, listée au §15.
>
> Aucun prix, quota chiffré ni devise n'est fixé ici. Ce sont des **paramètres administrables**.

---

## 1. Vision produit

### 1.1 Mission

Permettre à chacun de créer une **expérience numérique unique** pour faire plaisir, célébrer, surprendre,
remercier ou offrir un cadeau. Le destinataire l'ouvre par un simple lien, sans créer de compte.

### 1.2 Proposition de valeur

| Pour… | ZAWELI apporte… |
| --- | --- |
| L'expéditeur | Un rendu digne d'un studio créatif en quelques minutes, sans compétence technique ni risque de « mal faire » le design |
| Le destinataire | Une découverte interactive et émouvante (révélation progressive, énigmes, cadeaux, musique), pas un message de plus |
| L'entreprise (plus tard) | Des communications personnalisées et mémorables à l'image de la marque, à grande échelle |

### 1.3 Positionnement : ce que ZAWELI n'est pas

- **[DÉCIDÉ] Ce n'est pas un éditeur de site.** Pas de glisser-déposer, de constructeur de pages ni de choix libre de couleurs, de polices ou d'animations.
- Ce n'est pas un générateur de cartes de vœux statiques.
- Ce n'est pas un réseau social : les expériences sont privées, accessibles uniquement par lien.

**Le principe central : des expériences conçues par l'équipe ZAWELI, que l'utilisateur personnalise de façon guidée.**
Chaque template est une œuvre fermée qui déclare précisément ce qui peut être personnalisé.

---

## 2. Glossaire

| Terme | Définition |
| --- | --- |
| **Template** | Une expérience conçue et développée par l'équipe ZAWELI (design, structure, animations, interactions). Exemple : « Coffret », issu de Pauline. |
| **Version de template** | Un état figé d'un template : son code de rendu et son schéma de personnalisation. Une expérience publiée reste liée à sa version pour toujours. |
| **Schéma de personnalisation** | La liste déclarée des champs, sections facultatives, limites de médias et options qu'un template accepte. |
| **Expérience** | Une instance personnalisée d'une version de template, créée par un expéditeur pour un destinataire. |
| **Brouillon** | Une expérience non publiée, modifiable et invisible du public. |
| **Publication** | L'action qui rend une expérience accessible par son lien unique. |
| **Expéditeur** | L'utilisateur inscrit qui crée l'expérience. |
| **Destinataire** | La personne qui reçoit le lien. Elle n'a **pas** de compte. |
| **Fiche destinataire** | La personne cible déclarée par l'expéditeur (prénom, et coordonnées si besoin). Elle sert aux règles de licence MULTI-USE. |
| **Cadeau** | Un élément typé (MONEY, PHYSICAL, INVITATION, VOUCHER, EXPERIENCE…) placé dans un **paquet** à ouvrir. |
| **Paquet** | Le contenant visuel d'un cadeau, dont l'apparence et l'animation sont fixées par le template. |
| **Énigme** | Une interaction de déblocage (question, code…) dont le contenu est fourni par l'expéditeur. |
| **Formule** | Une offre commerciale : FREE, SOLO, MULTI-USE, ANNUEL… |
| **Licence** | Le droit concret, acheté ou attribué, issu d'une formule, avec sa validité et ses quotas. |
| **Droit** | Une capacité élémentaire : créer, modifier, publier, utiliser l'IA (voir §8). |

---

## 3. Utilisateurs

| Profil | Description | Besoins clés | Phase |
| --- | --- | --- | --- |
| **Expéditeur particulier** | Personne qui veut faire plaisir à un proche | Simplicité, rendu émouvant, mobile, paiement local (mobile money) | MVP |
| **Destinataire** | Personne qui reçoit le lien, souvent sur téléphone | Aucun compte, chargement rapide, expérience fluide, respect de sa vie privée | MVP |
| **Administrateur ZAWELI** | Équipe interne | Gérer le catalogue, les formules, les licences, les paiements, la modération et les statistiques | MVP (réduit) |
| **Équipe créative ZAWELI** | Développeurs et designers des templates | Publier de nouvelles versions de templates sans casser l'existant | MVP (via le code et le déploiement) |
| **Support** | Assistance client | Consulter un compte, une commande ou une licence, et corriger un problème de paiement | Après le MVP |
| **Client Business** | Entreprise, organisation | Comptes multi-utilisateurs, identité de marque, envois en série, facturation | Futur |

---

## 4. Cas d'utilisation

### 4.1 Particuliers (MVP)

Anniversaire, déclaration d'amour, félicitations (diplôme, réussite), remerciements, surprise, cadeau.
D'autres templates suivront : mariage, invitation à une fête, naissance…

### 4.2 Entreprises (futur, architecture prête dès le MVP)

Vœux de fin d'année aux clients, invitations à des événements, remerciements, anniversaires de collaborateurs,
récompenses, fidélisation, campagnes personnalisées.

**[RECO]** Les besoins Business seront servis dans un **espace distinct** (organisation, membres, envois en série),
et non par des options ajoutées à l'interface des particuliers.

---

## 5. Principes non négociables

| # | Principe |
| --- | --- |
| P1 | **Pas d'éditeur visuel.** L'utilisateur remplit uniquement les champs déclarés par le template. |
| P2 | **La base de données décrit des données, jamais du code.** Ni JavaScript, ni HTML libre, ni composant stocké. Les renderers sont dans le code ZAWELI. |
| P3 | **Les versions sont figées.** Une expérience publiée référence la version exacte du template et continue de s'afficher à l'identique si le template évolue. |
| P4 | **Tout droit est vérifié côté serveur** : éligibilité, quotas, licences, propriété, publication. Le navigateur n'est jamais une source de vérité. |
| P5 | **Une valeur financière n'est jamais validée côté navigateur.** Aucune énigme résolue dans le navigateur ne débloque seule un avantage ayant une valeur. |
| P6 | **Aucun paiement ou transfert n'est affiché comme effectué sans confirmation du prestataire**, reçue par webhook vérifié. |
| P7 | **Le destinataire n'a pas besoin de compte.** |
| P8 | **Les secrets restent côté serveur**, comme les clés Supabase `service_role`, MbiyoPay et OpenRouter. |
| P9 | **L'IA propose, l'utilisateur dispose.** Aucun texte généré n'est appliqué sans relecture et validation. L'IA ne touche jamais au design. |
| P10 | **Les trois interfaces sont distinctes** : SaaS (tableau de bord), templates et page publique du destinataire. |

---

## 6. Parcours

### 6.1 Expéditeur : de la découverte au partage

| # | Étape | Règles et remarques |
| --- | --- | --- |
| 1 | Arrivée sur ZAWELI | Page d'accueil qui explique le concept et montre une démonstration |
| 2 | Catalogue | Filtre par catégorie (anniversaire, amour…) et par formule (« gratuit », « inclus dans MULTI-USE ») |
| 3 | Détail d'un template | Description, sections, nombre de photos demandées, cadeaux possibles, formules compatibles |
| 4 | Démonstration | L'expérience complète avec un **contenu de démonstration sous licence ZAWELI**, jamais des photos personnelles réelles |
| 5 | « Créer avec ce modèle » | Connexion ou inscription si nécessaire. Le template choisi est conservé à travers l'authentification. |
| 6 | **Vérification d'éligibilité (serveur)** | Le serveur indique les licences qui peuvent couvrir cette création. Si aucune ne convient, l'utilisateur peut quand même préparer un brouillon et achètera une formule avant de publier (voir §8.4). |
| 7 | Choix du destinataire | Une fiche destinataire nouvelle ou existante (prénom obligatoire). Cette étape est indispensable pour MULTI-USE. |
| 8 | Personnalisation guidée | Un **assistant en étapes**, construit à partir du schéma du template : textes, photos, énigmes, cadeaux, musique et sections facultatives. Enregistrement automatique du brouillon. |
| 9 | Aide de l'IA (facultatif) | Suggestion de texte pour un champ donné. L'utilisateur la relit, la modifie puis l'accepte. Le quota est décompté côté serveur. |
| 10 | Aperçu | Rendu réel de l'expérience, en lecture seule, avec une bannière « Aperçu » et un passage rapide entre les étapes |
| 11 | Vérification avant publication | Le serveur contrôle les champs obligatoires, les limites de médias et la validité des cadeaux |
| 12 | Paiement si nécessaire | Choix de la formule, puis paiement MbiyoPay. **La licence n'est activée qu'à réception du webhook confirmé.** |
| 13 | Publication | Consommation du droit **dans une transaction SQL**, gel de la version du template et génération du lien |
| 14 | Partage | Lien unique, QR code, bouton de partage natif (WhatsApp, SMS…) et copie du lien |
| 15 | Suivi | L'expérience apparaît dans « Mes expériences ». Statut : publiée, désactivée… |

### 6.2 Destinataire

1. Il ouvre le lien `/g/[slug]` sur n'importe quel appareil, sans compte.
2. Un écran d'entrée apparaît (l'enveloppe dans Coffret). **Le premier geste déverrouille le son et la musique**, comme l'exigent les navigateurs.
3. Il progresse étape par étape. Le contenu suivant n'est chargé qu'une fois l'étape en cours terminée.
4. Énigmes, cadeaux et révélations.
5. Fin, avec la possibilité de revivre l'expérience.

**[RECO]** La progression est mémorisée **localement** dans le navigateur : un rechargement ne fait pas tout recommencer.
Les déblocages qui protègent une valeur sont vérifiés côté serveur (§10.4).

### 6.3 Administrateur

Gestion du catalogue et des versions, des formules et paramètres, des utilisateurs et licences, des paiements, de la modération et des statistiques (§11.9).

---

## 7. Périmètre fonctionnel

Priorités : **M** = indispensable au MVP, **S** = souhaitable au MVP, **F** = futur.

### 7.1 Site public

| Fonction | Priorité |
| --- | --- |
| Accueil, fonctionnement, tarifs, FAQ, contact, CGU, confidentialité | M |
| Catalogue et filtres par catégorie | M |
| Détail d'un template et démonstration | M |
| Blog et contenu marketing | F |
| Langues : français au MVP, anglais ensuite (**[OUVERT]** C14) | M (FR) |

### 7.2 Comptes et authentification (Supabase Auth)

| Fonction | Priorité |
| --- | --- |
| Inscription et connexion par e-mail et mot de passe, vérification de l'e-mail | M |
| Mot de passe oublié | M |
| Connexion Google | S |
| Connexion par numéro de téléphone (OTP SMS) | F (**[OUVERT]** C15 : coût des SMS, mais usage local fort) |
| Profil (nom, langue, préférences de notification) | M |
| Suppression du compte et export des données | S |

### 7.3 Catalogue de templates

| Fonction | Priorité |
| --- | --- |
| Liste des templates publiés : catégories, couverture, démonstration, formules compatibles | M |
| Un template peut avoir plusieurs versions. Une seule est « courante » pour les nouvelles créations. | M |
| Contraintes de licence par template : gratuit, inclus SOLO, inclus MULTI-USE… | M |
| Templates réservés aux entreprises | F |

### 7.4 Création guidée (moteur de personnalisation)

| Fonction | Priorité |
| --- | --- |
| Formulaire **généré à partir du schéma de la version de template** : types de champs, obligatoire ou facultatif, longueurs, nombre de photos | M |
| Assistant découpé en étapes définies par le template, avec indicateur de complétion | M |
| Enregistrement automatique du brouillon, reprise ultérieure | M |
| Sections facultatives activables ou désactivables, **uniquement celles déclarées** | M |
| Options prévues par le template (exemple : variante de palette parmi 2 ou 3 proposées par le designer) | S |
| Validation identique côté client (confort) et côté serveur (autorité) | M |
| Dupliquer une expérience pour un autre destinataire | S |

### 7.5 Aperçu

| Fonction | Priorité |
| --- | --- |
| Rendu réel avec la version de template du brouillon | M |
| Bascule entre mobile et ordinateur | S |
| Accès direct à une étape, sans tout rejouer | S |
| L'aperçu **n'est pas un éditeur** : aucune modification ne s'y fait | M |

### 7.6 Publication et partage

| Fonction | Priorité |
| --- | --- |
| Slug **non devinable** : au moins 10 caractères aléatoires, sans prénom dans l'URL | M |
| QR code téléchargeable (PNG/SVG) | M |
| Partage natif (Web Share API) et copie du lien | M |
| Désactiver ou réactiver une expérience publiée | M |
| Code d'accès facultatif, demandé au destinataire (« À n'ouvrir que si tu es Pauline » devient une vraie protection) | S |
| Date de disponibilité (le lien ne s'ouvre qu'à partir du jour J) | S |
| Page publique en `noindex`, avec un aperçu de partage (OG) neutre qui ne dévoile pas le contenu | M |
| Signalement d'un contenu abusif depuis la page publique | M |

### 7.7 Page du destinataire

| Fonction | Priorité |
| --- | --- |
| Rendu de la version figée du template, à partir des données publiées | M |
| Progression mémorisée localement | M |
| Son et musique activés par un geste, avec coupure possible | M |
| Respect de `prefers-reduced-motion` | M |
| Statistique d'ouverture visible par l'expéditeur (« ouverte le… ») | S (**[OUVERT]** C12 : vie privée) |
| Réponse du destinataire (merci, RSVP pour une invitation) | F |

### 7.8 Médias

| Fonction | Priorité |
| --- | --- |
| Envoi de photos vers Supabase Storage, dans un bucket **privé** | M |
| Contrôle du type réel du fichier (signature, pas seulement l'extension) et de sa taille. Formats : JPEG, PNG, WebP, HEIC converti. | M |
| Conversion côté serveur en WebP à plusieurs tailles, et **suppression des métadonnées EXIF** (position GPS) | M |
| Recadrage simple guidé par le ratio imposé par le template | S |
| Nombre de photos limité **par le template** (minimum et maximum par champ) | M |
| Vidéo | F |
| Modération automatique des images | F (manuelle via signalement au MVP) |

### 7.9 Assistance IA (OpenRouter)

| Fonction | Priorité |
| --- | --- |
| Suggestions de texte pour les champs autorisés : message, lettre, vœux, invitation, ton professionnel | M |
| Paramètres : ton (tendre, drôle, solennel, professionnel), longueur, langue | M |
| Quota par formule, vérifié et décompté côté serveur | M |
| Relecture obligatoire : le texte n'est inséré qu'après acceptation | M |
| Limites de débit par utilisateur et filtres d'abus | M |
| Abstraction du fournisseur, pour changer de modèle sans toucher au produit | M |
| Génération de questions et réponses d'énigmes | S |

### 7.10 Tableau de bord

| Page | Priorité |
| --- | --- |
| Vue d'ensemble : licences actives, brouillons, dernières expériences | M |
| Mes expériences, publiées et désactivées | M |
| Mes brouillons | M |
| Mes destinataires | M |
| Mes licences, avec validité, quotas et destinataires liés | M |
| Mes achats : commandes, statut, reçu | M |
| Mon quota IA | M |
| Paramètres du compte | M |
| Mes cadeaux (`/dashboard/gifts`) : suivi des cadeaux annoncés et de leur statut | S |

### 7.11 Notifications

| Notification | Canal | Priorité |
| --- | --- | --- |
| Vérification du compte, mot de passe | E-mail | M |
| Paiement confirmé et licence activée | E-mail | M |
| Expérience publiée, avec le lien et le QR code | E-mail | S |
| Licence bientôt expirée ou expirée | E-mail | S |
| Expérience ouverte par le destinataire | E-mail | F (dépend de C12) |
| Envoi du lien au destinataire par ZAWELI | E-mail, SMS, WhatsApp | F (**[RECO]** au MVP, c'est l'expéditeur qui partage le lien) |

### 7.12 Administration

Voir §11.9.

---

## 8. Formules, licences et droits

### 8.1 Modèle de droits

**[DÉCIDÉ]** On distingue cinq droits, évalués séparément côté serveur :

| Droit | Signification | Rattaché à |
| --- | --- | --- |
| **CRÉER** | Démarrer un nouveau brouillon destiné à être publié | Licence active (ou droit FREE disponible) |
| **MODIFIER** | Changer le contenu d'un brouillon ou d'une expérience publiée | Licence qui couvre l'expérience, tant qu'elle est valide |
| **PUBLIER** | Rendre une expérience accessible (consomme une création) | Licence active avec un quota disponible |
| **IA** | Utiliser la génération de texte | Quota IA de la licence ou du compte |
| **ACCÈS PUBLIC** | Le destinataire peut ouvrir une expérience déjà publiée | **Indépendant de la licence** (§8.5) |

### 8.2 Ce qui consomme une « création »

**[RECO]** La création est consommée **à la première publication**, et non à l'ouverture d'un brouillon.

- Raison : l'utilisateur peut explorer et préparer sans crainte, et la conversion se fait au moment où la valeur est perçue.
- Garde-fou : un **nombre maximum de brouillons actifs** par compte (paramètre), pour éviter de stocker des médias inutilement.
- La consommation se fait dans une **transaction SQL avec verrouillage**. Deux publications simultanées ne peuvent pas consommer le même droit.

### 8.3 Formules

> Toutes les valeurs (prix, devises, durées, quotas, catalogue inclus) sont des **paramètres administrables**.

#### FREE

| Règle | Valeur |
| --- | --- |
| Créations | **[DÉCIDÉ]** 1 seule par utilisateur, à vie |
| Templates | **[DÉCIDÉ]** Ceux marqués « gratuits » dans le catalogue |
| Vérification | **[DÉCIDÉ]** Côté serveur |
| Après usage | **[DÉCIDÉ]** Une formule payante est nécessaire pour toute nouvelle création |
| Anti-abus | **[RECO]** Gratuit lié au compte vérifié (e-mail confirmé). Le contournement par plusieurs comptes reste possible : le risque est accepté au MVP, et la vérification par téléphone pourra le réduire plus tard. |
| Modification après publication | **[OUVERT]** C3 : je recommande une correction de texte pendant N jours (paramètre) |
| Quota IA | Paramètre (petit) |
| Marque ZAWELI | **[OUVERT]** C4 : mention discrète « Créé avec ZAWELI » à la fin de l'expérience gratuite |

#### SOLO

| Règle | Valeur |
| --- | --- |
| Validité | **[DÉCIDÉ]** 7 jours (paramètre) |
| Démarrage | **[DÉCIDÉ]** Configurable. Par défaut : **confirmation du paiement par webhook** |
| Créations | **[DÉCIDÉ]** 1 création initiale par achat |
| Templates | **[DÉCIDÉ]** Ceux autorisés pour SOLO (paramètre par template) |
| Modification | **[RECO]** Autorisée pendant la validité, puis l'expérience reste publiée en lecture seule |
| Quota IA | Paramètre |

#### MULTI-USE

| Règle | Valeur |
| --- | --- |
| Templates | **[DÉCIDÉ]** Tous |
| Destinataires | **[DÉCIDÉ]** 3 destinataires distincts au maximum (paramètre) |
| Créations | **[DÉCIDÉ]** Illimitées pour ces 3 destinataires, pendant la validité |
| Réutilisation | **[DÉCIDÉ]** Possible pour ces mêmes personnes |
| 4ᵉ destinataire | **[DÉCIDÉ]** Nouvelle licence ou extension |
| Validité | **[OUVERT]** C5 : durée non fixée |
| Définition d'un « destinataire distinct » | **[RECO]** Une **fiche destinataire** déclarée par l'expéditeur, **liée à la licence lors de la première publication**. Une fois liée, elle ne peut plus être remplacée pendant la validité. Son prénom peut être corrigé, mais elle ne peut pas être transformée en une autre personne : la modification est journalisée et limitée. |
| Anti-abus « illimité » | **[RECO]** Plafond technique de publications par jour et par licence (paramètre, élevé) |
| Extension | **[OUVERT]** C6 : l'extension « +1 destinataire » est-elle vendue à l'unité ? |

#### Formule annuelle

**[OUVERT]** C7. Deux options étudiées :

| Option | Description | Avantages | Inconvénients |
| --- | --- | --- | --- |
| A. **MULTI-USE annuel** | Les mêmes règles que MULTI-USE, sur 12 mois | Simple à comprendre, peu de développement | 3 destinataires sur un an, c'est peu pour un utilisateur régulier |
| B. **Formule ANNUELLE distincte** | 12 mois, tous les templates, N destinataires (paramètre plus élevé, ou illimité avec usage raisonnable), quota IA supérieur, nouveautés en avant-première | Fidélise les utilisateurs réguliers, base pour une offre Business | Une offre de plus à expliquer, et l'abus doit être maîtrisé |

**[RECO]** Concevoir le moteur de licences de façon **générique**, avec une formule définie par sa durée, son nombre de destinataires, ses créations, son catalogue autorisé et son quota IA.
A et B ne sont alors que deux configurations, sans développement spécifique.
Côté commercial, je recommande **B pour les particuliers réguliers**, et une offre **Business annuelle** séparée plus tard.
Abonnement à renouvellement automatique ou achat d'une période fixe : **[OUVERT]** C8, car il dépend des capacités de MbiyoPay.

### 8.4 Éligibilité et choix de la licence

- Plusieurs licences peuvent être actives en même temps.
- **[RECO]** À la publication, le serveur propose les licences compatibles (template autorisé, quota, destinataire). Par défaut, il prend celle qui **expire en premier**, et l'utilisateur peut en choisir une autre.
- Le droit FREE n'est utilisé que si l'utilisateur le choisit explicitement, pour qu'il ne le « brûle » pas par erreur.
- Sans licence compatible, l'utilisateur peut finir son brouillon. Le bouton « Publier » mène alors au choix d'une formule.

### 8.5 Expiration

| Situation | Règle |
| --- | --- |
| Droits CRÉER, PUBLIER, MODIFIER et IA après expiration | **[DÉCIDÉ]** Perdus. Un renouvellement est nécessaire. |
| Expériences déjà publiées | **[RECO, conforme à ta recommandation]** Elles **restent accessibles** au destinataire après l'expiration de la licence |
| Exceptions | Désactivation par l'expéditeur, modération (contenu signalé et retiré), demande légale, suppression du compte |
| Durée d'hébergement | **[OUVERT]** C9 : illimitée, ou garantie minimale (par exemple 12 mois) puis archivage ? C'est un paramètre. |
| Brouillons d'une licence expirée | **[RECO]** Conservés N jours (paramètre), publiables après renouvellement |

### 8.6 Commandes, paiements, remboursements

- Une commande porte sur une formule ou une extension. Le **montant et la devise sont calculés par le serveur** à partir du tarif en vigueur, jamais transmis par le navigateur.
- **[DÉCIDÉ]** La licence est activée uniquement par un **webhook vérifié**. Le simple retour sur la page « paiement réussi » ne change rien.
- Les traitements sont **idempotents** : un webhook reçu deux fois n'active qu'une seule licence.
- Le serveur vérifie le montant, la devise, la référence de commande et la transaction auprès du prestataire.
- Remboursements : **[OUVERT]** C10, politique à définir.
- Codes promotionnels : F. L'administration les prévoit, mais ce n'est pas MVP.

---

## 9. Système universel de cadeaux

### 9.1 Principes

- Un template déclare **combien de paquets** il propose (minimum et maximum) et quels **types de cadeaux** il accepte.
- L'expéditeur choisit **le type de chaque cadeau** et remplit **le formulaire propre à ce type**.
- Le template contrôle l'apparence du paquet, son animation et la mise en page de la révélation. L'utilisateur ne fournit que des données.
- Les types sont **extensibles** : un nouveau type s'ajoute avec un schéma de champs, un rendu « carte de révélation » par défaut et des règles de statut, sans modifier les templates existants.

### 9.2 Distinction fondamentale : annonce et réalisation

| Notion | Signification | Ce que le destinataire voit |
| --- | --- | --- |
| **Annonce** | L'expéditeur **promet ou annonce** un cadeau. ZAWELI n'en garantit pas la réalisation. | Un libellé clair, par exemple « Je t'offre… » ou « Un cadeau t'attend… », **jamais** « transféré » ni « livré » |
| **Réalisation confirmée** | Un fait vérifié par un tiers de confiance, par exemple un transfert confirmé par le webhook du prestataire | « Transfert effectué », uniquement dans ce cas |
| **Déclaration de l'expéditeur** | Pour un objet physique, l'expéditeur peut marquer « remis ». ZAWELI ne le vérifie pas. | Une mention neutre, si le template l'affiche |

### 9.3 Types et champs

#### MONEY : cadeau financier

| Champ | Obligatoire | Remarque |
| --- | --- | --- |
| Montant | Oui | Décimal, devise d'une liste administrée |
| Devise | Oui | CDF, USD… (paramètre) |
| Message | Non | Longueur limitée |
| Mode de réception | Oui | « Remise en main propre », « Mobile money (je m'en occupe) », ou « Transfert via ZAWELI » (F) |
| État du transfert | Calculé | Jamais saisi par l'utilisateur |

Statuts :

| Statut | Signification | Qui le fixe |
| --- | --- | --- |
| `ANNOUNCED` | Promesse, sans flux d'argent via ZAWELI | Création |
| `AWAITING_FUNDING` | Transfert via ZAWELI choisi, paiement de l'expéditeur attendu | Serveur |
| `FUNDED` | Paiement de l'expéditeur confirmé par webhook | **Webhook vérifié** |
| `AWAITING_CLAIM` | Le destinataire doit indiquer comment recevoir l'argent | Serveur |
| `TRANSFER_PENDING` | Payout demandé au prestataire | Serveur |
| `TRANSFERRED` | Payout confirmé | **Webhook vérifié** |
| `FAILED`, `CANCELLED`, `REFUNDED` | Échec, annulation ou remboursement | Serveur et webhook |

**[RECO MVP]** Seul `ANNOUNCED` (promesse) est disponible au MVP.
Le transfert réel via ZAWELI dépend de l'API Payout de MbiyoPay, qui n'est pas documentée publiquement, de la réglementation sur la transmission de fonds et du KYC du destinataire.
Le modèle de données le prévoit dès maintenant, mais il n'est **ni proposé ni affiché** tant que ces points ne sont pas levés (**[OUVERT]** C1).

#### PHYSICAL : objet

Champs : nom du cadeau (obligatoire), description, photo (facultative, comptée dans les limites du template), message, modalités de remise (texte libre court : « je te l'apporte samedi », « livré à ton bureau »…).
Statuts : `ANNOUNCED`, `HANDED_OVER` (déclaré par l'expéditeur, jamais présenté comme vérifié), `CANCELLED`.

#### INVITATION

Champs : titre (obligatoire), lieu (obligatoire), date (obligatoire), heure, message, informations pratiques (tenue, accès…), adresse, lien cartographique (URL validée, domaines autorisés).
Option F : ajouter à l'agenda (fichier .ics) et réponse RSVP du destinataire.
Statuts : `ANNOUNCED`, `CANCELLED`, `PAST` (calculé d'après la date).

#### VOUCHER : bon cadeau

Champs : intitulé (obligatoire, par exemple « Un massage »), émetteur ou prestataire (facultatif), valeur (facultative), code du bon (facultatif, **affiché seulement après déballage**), date de validité, conditions d'utilisation, message.
Au MVP, c'est une annonce : ZAWELI **ne vend pas** de bons de partenaires (F).

#### EXPERIENCE

Champs : intitulé (obligatoire, par exemple « Un week-end à… »), description, date ou période (facultative), lieu, message, photo (facultative).
Statuts : `ANNOUNCED`, `CANCELLED`.

#### Types futurs envisagés

Lien numérique (abonnement, carte cadeau en ligne), message vocal, don à une association, cadeau d'un partenaire marchand.

### 9.4 Données sensibles d'un cadeau

- Un code de bon et un montant ne sont **envoyés au navigateur du destinataire qu'au moment du déballage**, et pas dans les données initiales de la page. Ce point est crucial s'ils sont protégés par une énigme (§10.4).
- Les cadeaux sont visibles uniquement par leur propriétaire dans le tableau de bord, et par le destinataire via l'expérience publiée.

---

## 10. Énigmes et surprises

### 10.1 Formes proposées

Le template choisit les formes qu'il accepte :

| Forme | Exemple | Priorité |
| --- | --- | --- |
| Choix multiple | 3 réponses, une seule correcte (modèle Coffret) | M |
| Réponse libre | « Où nous sommes-nous rencontrés ? » Comparaison sans tenir compte de la casse, des accents ni des espaces, avec plusieurs réponses acceptées | S |
| Code secret | Un code à 4 à 8 caractères | S |
| Séquence | Plusieurs énigmes successives, chacune débloquant l'étape suivante | M (Coffret en a 3) |

### 10.2 Ce que l'expéditeur renseigne

Question, choix, bonne(s) réponse(s), indice, puis la photo et le message révélés, dans les limites du template (longueurs, nombre d'énigmes).

### 10.3 Tentatives et progression

- Paramètres déclarés par le template (et éventuellement par l'expéditeur dans ces bornes) : nombre de tentatives avant l'indice, et comportement en cas d'échecs répétés.
- **[RECO]** Pour un contenu affectif, pas de blocage définitif : on affiche l'indice, puis on propose de révéler la réponse. Une énigme ne doit jamais empêcher le destinataire de voir son cadeau.

### 10.4 Sécurité : deux classes d'énigmes

| Classe | Exemple | Validation |
| --- | --- | --- |
| **Affective** | Débloque une photo ou un message | Côté navigateur acceptable. La réponse peut être livrée **hachée** pour ne pas apparaître en clair dans la page. |
| **Protégeant une valeur** | Débloque un code de bon, un montant, une réclamation d'argent | **Côté serveur obligatoire.** La réponse n'est jamais envoyée au navigateur, les tentatives sont limitées par expérience et par adresse, et le contenu protégé n'est livré qu'après validation. |

---

## 11. Exigences fonctionnelles transverses

### 11.1 Musique

| Source | Description | Priorité | Contraintes |
| --- | --- | --- | --- |
| **Bibliothèque ZAWELI** | Pistes **sous licence** (libres de droits ou achetées), classées par ambiance | M | Une licence documentée pour chaque piste. Lecture via un lecteur intégré, avec lecture/pause, volume et coupure. |
| **Spotify** | Lien d'un titre ou d'une playlist, affiché dans le **lecteur officiel Spotify Embed** | S | Le comportement exact (extrait ou titre complet, contrôle via l'API iFrame) **sera vérifié dans la documentation officielle**. Pas de Web Playback SDK (Premium et compte de l'auditeur requis). |
| **Fichier de l'utilisateur** | Téléversement d'un MP3 personnel | F | **[OUVERT]** C11 : risque sur les droits d'auteur. Il faudrait une déclaration de droits par l'utilisateur et une politique de retrait. |

Règles communes :
- Aucun démarrage automatique avec le son : **le premier geste du destinataire lance la musique** (le bris du sceau dans Coffret).
- Un contrôle unique « son » coupe à la fois la musique et les effets sonores.
- La musique est facultative. L'expérience doit être complète sans elle.

### 11.2 Sections facultatives et options

Seules les sections marquées « facultatives » dans le schéma peuvent être masquées. Le template garantit un rendu cohérent quand elles le sont (par exemple, pas de trou dans la progression).

### 11.3 Versions de template

- Un template a des versions publiées **immuables** : rendu, schéma et ressources.
- Les nouvelles créations utilisent la version courante. Un brouillon reste sur la version avec laquelle il a été créé, une migration proposée viendra plus tard (F).
- Une version ne peut être retirée du catalogue que si **aucune expérience publiée** ne l'utilise. Sinon, elle est seulement masquée pour les nouvelles créations.

### 11.4 Journalisation et audit

Sont journalisées : connexions sensibles, publications, consommations de licence, paiements et webhooks, changements de formule et de licence par un administrateur, modération, usage de l'IA (méta-données, sans le contenu par défaut).
Le journal d'audit est en **ajout seul**, sans modification ni suppression.

### 11.5 Modération et signalements

- Un bouton « Signaler » sur chaque page publique.
- L'administration peut désactiver une expérience et suspendre un compte.
- Les CGU interdisent notamment le harcèlement, l'usurpation d'identité, l'arnaque (y compris de faux cadeaux d'argent), et les contenus haineux ou sexuels impliquant des mineurs.

### 11.6 Données personnelles et droit à l'image

- Les photos de tiers sont fréquentes (le destinataire lui-même). L'expéditeur atteste disposer de l'accord des personnes représentées, comme le recommande déjà Pauline.
- Les données sont minimisées : le destinataire n'a pas de compte, et aucune donnée n'est collectée sur lui par défaut.
- Le cadre légal applicable (RDC, RGPD pour les visiteurs européens) doit être vérifié par un juriste : **[OUVERT]** C13.

### 11.7 Paiement : MbiyoPay

- Les moyens annoncés sont le mobile money (Vodacom, Airtel, Orange, Africell…) et les cartes Visa et Mastercard.
- **Prérequis bloquant** : documentation API, environnement de test, authentification, webhooks signés et idempotence. Ils sont à obtenir auprès de MbiyoPay, faute de documentation publique (audit §8).
- Prévoir une **abstraction de prestataire**, pour pouvoir ajouter un second moyen de paiement si MbiyoPay ne couvre pas un besoin.

### 11.8 IA : OpenRouter

- Appels **uniquement depuis l'API** NestJS, jamais depuis le navigateur.
- Abstraction `AiProvider`, avec le modèle choisi par paramètre.
- Les prompts système sont versionnés et propres à chaque type de champ.
- Chaque génération est journalisée (compte, quota, modèle, coût estimé), sans conserver le contenu par défaut.

### 11.9 Administration (MVP réduit)

| Domaine | Fonctions MVP | Futur |
| --- | --- | --- |
| Templates | Publier ou masquer, catégories, couverture, formules compatibles, version courante. **Le design et le code ne s'éditent pas depuis l'administration.** | Statistiques par template |
| Formules | Créer et modifier les paramètres (prix, devise, durée, quotas, destinataires, catalogue) | Promotions et codes |
| Utilisateurs | Recherche, consultation, suspension | Usurpation encadrée pour le support |
| Licences | Consultation, attribution manuelle (geste commercial, journalisée), prolongation | — |
| Paiements | Liste, statut, détail des webhooks, rapprochement | Remboursements |
| Modération | File des signalements, désactivation | — |
| Statistiques | Inscriptions, publications, conversion FREE → payant, chiffre d'affaires | Tableaux avancés |

---

## 12. Exigences non fonctionnelles

| Domaine | Exigence |
| --- | --- |
| **Sécurité** | Tous les points du §5, plus : DTO validés, RLS sur toutes les tables exposées, limitation de débit (authentification, IA, énigmes protégées, webhooks), contrôle de propriété à chaque accès, URLs signées et temporaires pour les médias privés, en-têtes de sécurité (CSP…), dépendances auditées |
| **Performance (destinataire)** | Page publique utilisable sur mobile en 4G moyenne : premier écran interactif en moins de 3 s (**[RECO]** à mesurer), images responsives en WebP, chargement des étapes à la demande |
| **Performance (SaaS)** | Navigation fluide, enregistrement automatique sans blocage |
| **Accessibilité** | Interfaces SaaS : **WCAG 2.2 AA**. Templates : `prefers-reduced-motion`, focus visible, alternatives textuelles fournies avec chaque photo, contrastes vérifiés pour chaque template |
| **Compatibilité** | Safari iOS 16+, Chrome et Samsung Internet sur Android, Chrome, Edge et Firefox récents. Priorité au mobile. |
| **Disponibilité** | Pages publiques des expériences : objectif élevé, servies en cache (CDN) car leur contenu est figé après publication |
| **Observabilité** | Journaux structurés, suivi des erreurs côté web et API, alertes sur les webhooks en échec |
| **Sauvegardes** | Sauvegardes Supabase et procédure de restauration testée avant le lancement |
| **Internationalisation** | Textes de l'interface externalisés dès le départ (même si seul le français existe), formats de date et de devise localisés |
| **Qualité** | TypeScript strict, lint, tests unitaires sur les règles de licence et les cadeaux, tests d'intégration sur les webhooks, tests de bout en bout sur le parcours de création et de publication |

---

## 13. Scénarios de référence

Ils servent de critères d'acceptation : ils deviendront des tests automatisés en phases 5 et suivantes.

| # | Scénario | Résultat attendu |
| --- | --- | --- |
| S1 | Un nouvel utilisateur vérifié publie avec un template gratuit | Publication acceptée, droit FREE consommé, lien et QR générés |
| S2 | Le même utilisateur tente une 2ᵉ publication sans licence | Refus côté serveur, proposition des formules. Le brouillon est conservé. |
| S3 | Deux onglets publient en même temps avec le dernier droit disponible | Une seule publication réussit, l'autre reçoit un refus clair (transaction et verrou) |
| S4 | L'utilisateur arrive sur la page de retour de paiement, mais le webhook n'est pas encore reçu | Page « paiement en cours de confirmation », **aucune licence active** |
| S5 | Le webhook est reçu deux fois | Une seule licence active (idempotence) |
| S6 | Le montant du webhook ne correspond pas à la commande | Licence non activée, alerte administrateur, journalisation |
| S7 | MULTI-USE avec 3 destinataires liés, tentative pour un 4ᵉ | Refus, proposition d'extension ou d'une nouvelle licence |
| S8 | MULTI-USE : 5ᵉ expérience pour un destinataire déjà lié | Acceptée (illimité dans les plafonds anti-abus) |
| S9 | SOLO expiré : l'expéditeur veut modifier son expérience publiée | Modification refusée. **L'expérience reste accessible au destinataire.** |
| S10 | Le destinataire ouvre une expérience dont la licence a expiré | Affichage normal |
| S11 | Cadeau MONEY « promesse » de 50 USD | Le destinataire voit « Je t'offre 50 USD… », **jamais** « transféré » |
| S12 | Énigme affective : mauvaise réponse, puis bonne réponse | Indice, puis révélation de la photo |
| S13 | Énigme qui protège un code de bon | Le code est absent du code source de la page avant validation **serveur**. Tentatives limitées. |
| S14 | Template qui autorise 6 photos au maximum, envoi d'une 7ᵉ | Refus côté client et côté serveur |
| S15 | Fichier `.jpg` qui est en réalité un exécutable | Refus (contrôle de la signature du fichier) |
| S16 | Une nouvelle version du template Coffret est publiée | Les expériences existantes s'affichent à l'identique (version figée) |
| S17 | Quota IA épuisé | Génération refusée côté serveur, saisie manuelle toujours possible |
| S18 | Le destinataire recharge la page à mi-parcours | Il reprend à l'étape atteinte |
| S19 | Un contenu signalé est désactivé par l'administration | La page publique affiche « Cette expérience n'est plus disponible » |

---

## 14. Périmètre du MVP

### 14.1 Inclus

- Site public : accueil, catalogue, détail, démonstration, tarifs, FAQ, pages légales.
- Authentification par e-mail (Google si le temps le permet).
- Moteur de templates versionnés et moteur de personnalisation guidée.
- **Un template : Coffret** (issu de Pauline), avec cadeaux typés en mode **annonce**, énigmes à choix multiple, sections facultatives et musique de la bibliothèque ZAWELI.
- Aperçu, brouillons, publication, lien, QR code et désactivation.
- Formules FREE, SOLO et MULTI-USE paramétrables, licences, règles de consommation côté serveur.
- Paiement MbiyoPay avec webhooks, **sous réserve de la documentation API**.
- IA OpenRouter avec quotas.
- Tableau de bord : expériences, brouillons, destinataires, licences, achats, quota IA, paramètres.
- Administration réduite (§11.9), signalement et modération.
- Journal d'audit et e-mails transactionnels.

### 14.2 Exclus du MVP (préparés dans l'architecture)

Transferts d'argent réels, formule annuelle (selon C7), espace Business, téléversement de musique personnelle, vidéo,
statistiques d'ouverture (selon C12), RSVP, codes promotionnels, envoi du lien par ZAWELI, langues autres que le français, second template.

**[RECO]** Prévoir un **second template simple** juste après le MVP. Il prouvera que le moteur n'est pas taillé uniquement pour Coffret.

---

## 15. Décisions ouvertes

| # | Sujet | Question | Ma recommandation |
| --- | --- | --- | --- |
| C1 | Argent réel | Proposer des transferts réels via ZAWELI ? Quand ? | ✅ **Décidé le 6 novembre 2026** : pas au MVP, seulement des promesses. Étude juridique et API Payout d'abord. |
| C2 | Consommation | Une création est-elle consommée à la publication ou à la création du brouillon ? | ✅ **Décidé le 6 novembre 2026** : à la publication (§8.2) |
| C3 | FREE | Modification possible après publication ? | Correction de texte pendant N jours (paramètre) |
| C4 | FREE | Mention « Créé avec ZAWELI » ? | Oui, discrète, en fin d'expérience. Retirée pour les formules payantes. |
| C5 | MULTI-USE | Durée de validité ? | À fixer par toi (paramètre) |
| C6 | MULTI-USE | Extension « +1 destinataire » vendue à l'unité ? | Oui, si le prix reste inférieur à une nouvelle licence |
| C7 | Annuel | Option A (MULTI-USE annuel) ou B (formule distincte) ? | ✅ **Décidé le 6 novembre 2026** : B, avec un moteur générique qui permet les deux |
| C8 | Annuel | Renouvellement automatique ou période prépayée ? | Prépayée au MVP. Automatique seulement si MbiyoPay gère les paiements récurrents. |
| C9 | Hébergement | Durée de disponibilité des expériences publiées ? | Garantie minimale de 12 mois, puis paramètre (illimité si les coûts de stockage le permettent) |
| C10 | Remboursement | Politique de remboursement ? | Remboursable tant qu'aucune création n'a été publiée avec la licence. À valider juridiquement. |
| C11 | Musique | Autoriser le téléversement de MP3 personnels ? | Non au MVP |
| C12 | Vie privée | Informer l'expéditeur de l'ouverture par le destinataire ? | Oui, uniquement « ouverte / non ouverte » et la date, mentionné dans la politique de confidentialité |
| C13 | Juridique | Cadre légal : protection des données, paiement, transmission de fonds | Consultation d'un juriste avant le lancement commercial |
| C14 | Langues | Anglais au lancement ? | Français seul au MVP, interface prête pour l'i18n |
| C15 | Auth | Connexion par téléphone (OTP SMS) ? | Après le MVP. Utile localement et contre l'abus du FREE, mais coûteuse. |
| C16 | Démonstration | Qui fournit les photos de démonstration sous licence ? | Banque d'images sous licence commerciale, ou séance photo dédiée |
| C17 | Nom du template | « Coffret » ou autre (audit D3) ? | « Coffret » |
| C18 | Brouillons | Nombre maximum de brouillons actifs par compte ? | Paramètre, 5 par défaut |

Décisions de l'audit encore en attente : **D2** (déplacer l'archive vers `references/pauline/`) et **D6** (contacter MbiyoPay).

---

## 16. Hypothèses et risques

| # | Risque | Impact | Mitigation |
| --- | --- | --- | --- |
| R1 | Documentation API MbiyoPay indisponible ou incomplète | Élevé : bloque la monétisation | Contact immédiat. Abstraction du prestataire et alternative identifiée. |
| R2 | Confusion entre promesse et transfert réel d'argent, tentatives d'arnaque | Élevé : réputation et cadre légal | Libellés stricts (§9.2), MONEY réel exclu du MVP, signalement |
| R3 | Expérience musicale décevante avec Spotify (extraits) | Moyen | Bibliothèque ZAWELI comme option principale, Spotify en complément |
| R4 | Moteur trop calqué sur Coffret | Moyen | Second template simple juste après le MVP (§14.2) |
| R5 | Coûts de stockage des médias si l'hébergement est illimité | Moyen | Compression, limites par template, décision C9 |
| R6 | Abus du FREE avec plusieurs comptes | Faible à moyen | Vérification de l'e-mail, puis du téléphone (C15) |
| R7 | Photos de tiers sans consentement | Moyen | Attestation de l'expéditeur, signalement, retrait rapide |
| R8 | Complexité du portage de Coffret de Vite vers Next.js | Faible | Composants 100 % client, sans dépendance à Vite (audit §6.3) |

---

## 17. Indicateurs de succès

Ils sont à suivre dès le lancement, sans objectifs chiffrés fixés ici :

- Taux de complétion du parcours de création (brouillon → publication).
- Conversion du FREE vers une formule payante.
- Taux d'ouverture des liens par les destinataires, et taux de parcours complet.
- Délai moyen de création.
- Paiements en échec et webhooks en erreur (qualité de l'intégration).
- Signalements par millier d'expériences publiées.

---

## 18. Suite

Après validation de ce document, et en particulier des recommandations C2, C7 et C1 :
**phase 2, architecture technique** (`docs/03-architecture-technique.md`).
