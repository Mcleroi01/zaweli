# ZAWELI — Paiements mobile money (MbiyoPay) et musique (Audius)

> Statut : **livré en sandbox, à valider**.
> Date : 20 novembre 2026.
> Entrées : [cahier des charges](02-cahier-des-charges.md) §6.1 (étape 12), §8.6, §9.3 (MONEY), §11.1 ; documentation MbiyoPay (Collect, Send, Check Status, Finalize, Webhooks, Sandbox), lue le 20 novembre 2026 ; spécification OpenAPI d'Audius (`https://api.audius.co/v1/swagger.yaml`).

---

## 1. Ce qui a été construit

| Parcours | Où | Ce qui se passe |
| --- | --- | --- |
| **Acheter une formule** | `/espace/acheter` (et `/en/espace/acheter`) | Le client choisit une formule, puis la devise s'il y en a plusieurs. Il donne ensuite son pays, son réseau et son numéro. Le serveur fixe le montant à partir du prix en vigueur et envoie la demande de paiement (pay-in). La page suit le statut toutes les 3 secondes. Selon le réseau, elle affiche l'étape à faire : valider sur le téléphone, continuer sur la page Wave, suivre des consignes ou saisir un code. **La licence n'est créée que lorsque MbiyoPay confirme le paiement.** |
| **Mes achats** | `/espace/achats` | Liste des commandes avec leur statut. Une commande en attente peut être reprise. |
| **Cadeau d'argent « via Zaweli »** | Assistant, étape Cadeaux | Nouveau mode de remise : « Via Zaweli : je paie maintenant, la personne le reçoit sur son mobile money ». L'expéditeur paie le **montant offert + les frais**. Tant que ce n'est pas payé, la publication est refusée. Une fois payé, le cadeau ne peut plus être modifié ni supprimé. |
| **Réception par le destinataire** | `/g/<lien>/recevoir/<cadeau>` | Au déballage, le ticket du cadeau propose « Recevoir l'argent ». Le destinataire donne son nom et son numéro, sans créer de compte, et Zaweli lui envoie le montant (payout). Si l'envoi échoue, il peut réessayer avec un autre numéro. « Transfert confirmé » ne s'affiche qu'une fois l'envoi confirmé. |
| **Musique (préparée)** | API `GET /v1/music/audius/search?q=` | Recherche dans le catalogue ouvert d'Audius. Seuls les titres lisibles librement sont gardés. Ce n'est **pas encore affiché** dans l'assistant (voir §6). |

Statuts d'un cadeau d'argent : `AWAITING_FUNDING` → (paiement confirmé) `FUNDED` → `AWAITING_CLAIM` → (le destinataire indique son numéro) `TRANSFER_PENDING` → (envoi confirmé) `TRANSFERRED`. Si l'envoi échoue, le cadeau passe à `FAILED`, et le destinataire peut réessayer. La base contrôle chaque transition et l'acteur qui la fait (historique dans `gift_status_history`).

## 2. Sécurité et vérité des montants

- **Rien n'est « payé » sur la foi du navigateur ni d'un webhook.** Chaque confirmation **relit la transaction chez MbiyoPay** avec notre clé (`GET /merchant/transactions/{id}`). Elle est ensuite appliquée dans une transaction SQL dont l'acteur est `provider`. Les déclencheurs refusent tout autre acteur pour `paid`, `succeeded` ou `FUNDED`/`TRANSFERRED`.
- **Webhook** `POST /v1/webhooks/mbiyopay` :
  - la signature (`Signature`, HMAC-SHA256 hexadécimal du corps brut) est vérifiée et journalisée (`webhook_events`) ;
  - un faux webhook ne peut que déclencher une vérification de plus ;
  - un webhook authentique déjà traité est ignoré ;
  - en cas d'erreur, la réponse 500 fait renvoyer le webhook.
- **Montants** :
  - ils sont calculés par le serveur, en centimes (jamais en nombres à virgule flottante) ;
  - un paiement reçu inférieur au prix, ou dans une autre devise, n'active rien : la commande passe à `disputed` et une entrée d'audit est créée.
- **Pas de double paiement** :
  - une clé d'idempotence par tentative d'achat ;
  - un seul transfert ouvert par cadeau et par sens (index unique en base).
- **Données personnelles** : le numéro complet ne sert qu'à l'appel à MbiyoPay. Zaweli n'en garde que les 4 derniers chiffres. Le nom du bénéficiaire n'est pas conservé.
- **Consignes du réseau** : elles arrivent en HTML, mais seul leur texte est affiché. Le HTML n'est jamais injecté dans la page.
- **Réception sans compte** : le lien de l'expérience sert de clé. Il ne doit être partagé qu'avec la personne. Un seul envoi peut être en cours à la fois, avec un débit limité (5 essais par minute).

## 3. Frais (choix : c'est l'expéditeur qui paie)

L'expéditeur paie : **montant offert × (1 + taux)**, arrondi au-dessus (à l'unité pour CDF, XOF, XAF, GNF, UGX, RWF, TZS). Le destinataire reçoit exactement le montant offert.

Le taux se règle dans `app.app_settings`, clé `payments.money_fee_rate` (par exemple `"0.04"` pour 4 %). **Il est vide par défaut : tant qu'il ne l'est plus, aucun cadeau d'argent ne peut être payé.** Il doit couvrir les frais de collecte (déduits de ce que Zaweli reçoit) et les frais d'envoi (débités du solde MbiyoPay). Ces frais figurent dans le tableau de bord MbiyoPay ; la documentation n'en publie pas la grille.

```sql
update app.app_settings set value = '"0.04"' where key = 'payments.money_fee_rate';
update app.app_settings set value = 'true'   where key = 'gifts.money_transfers_enabled';
```

## 4. Configuration

API (`apps/api/.env`) :

| Variable | Rôle |
| --- | --- |
| `MBIYOPAY_API_KEY` | Clé **Test** (sandbox) ou **Live** du tableau de bord MbiyoPay. Sans elle, le paiement est simplement indisponible. |
| `MBIYOPAY_MODE` | `sandbox` (par défaut) ou `live` : doit correspondre à la clé. En sandbox, un bandeau « Mode test » est affiché aux clients. |
| `MBIYOPAY_WEBHOOK_SECRET` | Secret saisi dans MbiyoPay → Paramètres → Webhooks. Obligatoire en production. |
| `PUBLIC_API_URL` | Adresse publique de l'API, par exemple `https://api.zaweli.store`. Les webhooks partent vers `<PUBLIC_API_URL>/v1/webhooks/mbiyopay`. **Obligatoire pour les envois d'argent** (MbiyoPay l'exige pour un payout). |
| `MBIYOPAY_BASE_URL` | `https://dashboard.mbiyo.africa/api/v1` par défaut (même adresse en sandbox). |
| `AUDIUS_API_KEY` | Facultative : la recherche publique d'Audius fonctionne sans clé. |

Côté MbiyoPay :
- enregistrer l'URL du webhook et son secret ;
- pour les payouts en live, faire approuver le KYC de l'entreprise.

## 5. Tester en sandbox

1. Mettre la clé **Test** dans `MBIYOPAY_API_KEY`, avec `MBIYOPAY_MODE=sandbox`.
2. Choisir un numéro de test selon le résultat voulu :
   - **succès** : se termine par 0000, 1111 ou 2222 (par exemple `0970000000`, Vodacom RDC) ;
   - **attente** : se termine par 3333 ou 4444 ;
   - **échec** : se termine par 5555 ou 9999.
3. **En local**, les webhooks de MbiyoPay ne peuvent pas joindre `localhost`. Ce n'est pas bloquant : chaque page de suivi relit le statut chez MbiyoPay toutes les 3 secondes. Pour tester aussi les webhooks, exposer l'API par un tunnel (par exemple Cloudflare Tunnel) et mettre son adresse dans `PUBLIC_API_URL`.

## 6. Musique avec Audius : ce qui est prêt

Vérifié sur la spécification OpenAPI et sur une vraie réponse :
- `GET https://api.audius.co/v1/tracks/search?query=…&limit=…&sort_method=relevant` fonctionne sans clé ;
- la lecture se fait par `GET /v1/tracks/{track_id}/stream`, qui redirige vers un fichier MP3 et accepte `Range` ; c'est donc utilisable comme source d'un lecteur audio ;
- `api_key` est facultative. Elle n'est exigée que pour les titres réservés à certaines applications.

Côté Zaweli :

| Élément | Fichier |
| --- | --- |
| Choix musical enregistré comme une **référence** (identifiant, titre, artiste, lien audius.co, durée, pochette), jamais comme un fichier copié | `packages/shared-types/src/music.ts` (`musicChoiceSchema`, `audiusStreamUrl`) |
| Recherche filtrée : titres payants, réservés, masqués ou supprimés écartés | `apps/api/src/music/audius.service.ts` |
| Route `GET /v1/music/audius/search` (session obligatoire, 30 appels par minute) | `apps/api/src/music/music.controller.ts` |

Ce qui reste à faire pour l'offrir aux clients :
- déclarer un champ « musique » dans le manifeste des templates ;
- ajouter un sélecteur dans l'assistant (recherche, écoute, choix) ;
- dans le template, lancer la lecture au premier geste du destinataire (§11.1), avec le crédit de l'artiste et un lien vers la page audius.co.

Les conditions d'utilisation et d'attribution d'Audius n'ont pas été trouvées dans sa documentation. Elles sont **à vérifier avant la mise en ligne**.

## 7. Vérifications exécutées

| Vérification | Résultat |
| --- | --- |
| `pnpm typecheck` · `pnpm lint` · `pnpm test` | Réussis : 58 tests pour l'API, dont 11 pour les paiements et 3 pour Audius ; 25 pour le moteur de templates, dont le bouton « Recevoir l'argent ». |
| Tests des paiements (`apps/api/test/payments.spec.ts`) | Vérifié avec une fausse passerelle MbiyoPay, sur les vraies migrations : <ul><li>licence activée seulement après confirmation ;</li><li>un faux webhook « successful » ne change rien ;</li><li>webhook rejoué sans double licence ;</li><li>refus du réseau, puis échec ;</li><li>devise ou réseau refusés ;</li><li>montant reçu insuffisant → `disputed` ;</li><li>cadeau : frais, publication bloquée, paiement unique, verrouillage, réception, échec puis nouvel essai, `TRANSFERRED`, historique complet, numéro tronqué.</li></ul> |
| `pnpm test:db` | Vérifications du schéma réussies |
| Parcours réel dans le navigateur | Fait sur un banc local : l'API compilée sur PostgreSQL embarqué, avec une fausse passerelle qui imite la sandbox MbiyoPay (ce banc n'est pas livré). Vérifiés : <ul><li>achat de Solo en CDF : « Payé ✓ », puis licence proposée à la publication ;</li><li>paiement d'un cadeau de 20 USD : 0,80 de frais, total 20,80, verrouillage, étape Cadeaux validée ;</li><li>publication, puis QR code affiché ;</li><li>page de réception sur mobile (375 px, sans débordement) : envoi en cours, puis « C'est reçu ».</li></ul> |

**Non vérifié** :
- **Le vrai MbiyoPay sandbox**, faute de clé de test ici. Le format des réponses suit la documentation ; le premier essai avec la clé Test le confirmera.
- **L'encodage exact de la signature** des webhooks. La documentation donne un exemple Node.js (HMAC du JSON ré-encodé) et un exemple PHP (`json_encode`), qui peuvent différer du corps brut. L'API accepte les deux formes. De toute façon, une signature invalide n'a pas d'effet, puisque la transaction est relue chez MbiyoPay.

## 8. Ce qui n'est PAS encore fait

L'écran Paiements de l'administration, la revérification automatique et les e-mails sont livrés depuis : voir [docs/13](13-parrainage-et-cartes-cadeaux.md) §4.

| Sujet | Prochaine étape |
| --- | --- |
| Remboursement d'un cadeau payé mais jamais reçu, ou d'une expérience supprimée | À définir (C10). Aujourd'hui, une expérience qui contient un cadeau payé ne peut pas être supprimée. |
| Musique Audius dans l'assistant et les templates | Voir §6 |
