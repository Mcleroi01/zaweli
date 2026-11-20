# ZAWELI — Parrainage et cartes cadeaux

> Statut : **livré, à valider**.
> Date : 20 novembre 2026.
> Décisions du 20 novembre 2026 :
> - un filleul compte à son **premier achat payé** ;
> - le parrain reçoit une **carte cadeau** à 25 puis à 50 filleuls (5 puis 10 USD), utilisable pour payer une formule ;
> - le filleul a une **réduction** sur sa première formule, d'un taux réglable.

---

## 1. Le parcours

1. **Le parrain partage son lien** depuis `/espace/parrainage`, par exemple `https://zaweli.store/?parrain=K7M2Q9XA`. Il peut le copier, le partager depuis son téléphone, l'envoyer sur WhatsApp ou utiliser son QR code. Son code est créé à la première visite de la page.
2. **Le visiteur arrive par le lien.** Le site garde le code dans le navigateur pendant 30 jours, quelle que soit la page d'arrivée.
3. **Il crée son compte**, par e-mail ou avec Google. À la première ouverture de l'espace client, le code est transmis à l'API. Le rattachement est refusé dans trois cas :
   - le compte a plus de 7 jours ;
   - le compte a déjà acheté ;
   - le code est celui de la personne elle-même.
4. **Son premier achat** bénéficie de la réduction de bienvenue, si l'administration l'a réglée. Le détail est affiché avant de payer : prix, réduction, carte cadeau, reste à payer.
5. **Quand ce premier paiement est confirmé** par MbiyoPay, le parrainage devient **actif**. Si le parrain atteint un palier, sa carte cadeau est créée dans la même transaction et un e-mail le prévient.
6. **Le parrain paie une formule avec sa carte** : la case « Utiliser ma carte cadeau » est cochée par défaut.
   - Si la carte couvre tout, la licence est activée sans passer par MbiyoPay.
   - Sinon, il paie le reste par mobile money. Si ce paiement échoue, le montant pris sur la carte lui est rendu.

## 2. Règles et garde-fous

| Règle | Où elle est tenue |
| --- | --- |
| Un filleul n'a qu'un parrain, et jamais lui-même | `app.referrals` (clé = filleul ; contrainte filleul ≠ parrain) |
| Un faux compte ne rapporte rien : seul un **paiement confirmé** qualifie | `ReferralsService.onOrderPaid`, appelé dans la transaction « payée » |
| Un palier ne donne sa carte qu'une fois | Unicité `(propriétaire, "referral:<seuil>")` sur `app.gift_cards` |
| Le solde d'une carte ne passe jamais sous zéro ; chaque dépense ou remise est tracée | `check (balance >= 0)`, `app.gift_card_movements` en ajout seul |
| Une commande payée par carte n'est « payée » que si la carte couvre exactement le crédit annoncé | Fonction SQL `app.settle_credit_order` |
| Une carte ne paie que dans **sa devise** (carte en USD → prix en USD) | Devis et commande (`PaymentsService.pricing`) |

Codes de parrainage : 8 caractères sans 0/O ni 1/I, pour éviter les confusions à la lecture.

## 3. Réglages (administration → Paiements)

| Réglage | Clé | Valeur au départ |
| --- | --- | --- |
| Paliers (filleuls actifs → carte cadeau) | `referrals.reward_tiers` | **25 → 5 USD, 50 → 10 USD** (votre demande) |
| Réduction du filleul sur sa 1re formule | `referrals.referee_discount_rate` | **vide : aucune réduction** tant que l'équipe n'a pas fixé le taux |
| Frais des cadeaux d'argent | `payments.money_fee_rate` | vide (docs/12) |
| Transferts d'argent via Zaweli ouverts | `gifts.money_transfers_enabled` | non |

Chaque modification est inscrite dans le journal d'audit (`setting.updated`).

L'écran affiche aussi :
- les 50 dernières commandes, avec le prix, la réduction, la part payée par carte et la part payée par mobile money ;
- les transferts des cadeaux d'argent ;
- le classement des parrains ;
- un bouton « Revérifier les paiements en attente ».

## 4. Finitions MbiyoPay livrées en même temps

| Sujet | Ce qui est fait |
| --- | --- |
| **Écran Paiements** (administration) | Réglages ci-dessus, URL du webhook à saisir chez MbiyoPay, alerte si `PUBLIC_API_URL` manque, commandes, transferts, revérification manuelle |
| **Vérification automatique** | Toutes les `PAYMENTS_RECONCILE_SECONDS` secondes (120 par défaut), l'API relit chez MbiyoPay les paiements et transferts restés en attente depuis plus d'une minute, sur les dernières 48 heures. Désactivée en test et sans clé. |
| **E-mails** | « Paiement confirmé, ta formule est active » à l'acheteur ; « … a reçu ton cadeau » à l'expéditeur d'un cadeau d'argent ; « Une carte cadeau t'attend » au parrain. Ils sont dans la langue du compte et partent après validation en base, sans jamais bloquer un paiement. Variables : `SMTP_URL` (par exemple `smtps://utilisateur:motdepasse@smtp.fournisseur.com:465`) et `MAIL_FROM`. Sans `SMTP_URL`, l'e-mail est seulement écrit dans le journal de l'API. |

## 5. Vérifications exécutées

| Vérification | Résultat |
| --- | --- |
| `pnpm typecheck` · `pnpm lint` · `pnpm test` | Réussis. 65 tests pour l'API, dont 16 pour les paiements et le parrainage, et 2 pour les e-mails. |
| Parrainage (tests) | <ul><li>code stable ;</li><li>soi-même, code inconnu, double rattachement et compte ancien refusés ;</li><li>réduction de 20 % au premier achat seulement ;</li><li>un paiement échoué ne qualifie pas ;</li><li>palier atteint → une seule carte ;</li><li>formule payée entièrement par carte sans appel à MbiyoPay ;</li><li>paiement partiel échoué → carte rendue, mouvements tracés.</li></ul> |
| Administration (tests) | <ul><li>réservée au rôle admin ;</li><li>réglages enregistrés et journalisés, valeurs invalides refusées ;</li><li>commandes, transferts et parrains listés ;</li><li>la revérification passe en « payée » une commande confirmée dont le webhook s'est perdu.</li></ul> |
| `pnpm test:db` | 73 vérifications du schéma réussies |

**Non vérifié** : le vrai MbiyoPay, en attente de la clé Test, et l'envoi réel par un serveur SMTP.

## 6. À décider ou à faire ensuite

- **Taux de réduction du filleul** : à fixer dans l'administration (aucune réduction tant qu'il est vide).
- **Durée de validité des cartes cadeaux** : la base la prévoit (`expires_at`), mais rien n'est fixé ; aujourd'hui les cartes n'expirent pas.
- **Cartes dans une autre devise** : une carte en USD ne paie pas un prix en CDF. On pourrait convertir avec les taux saisis dans l'administration, si vous le souhaitez.
- **Fraude** : la règle du premier achat payé limite les abus. Si besoin, ajouter un plafond de filleuls par mois ou une vérification manuelle au-delà d'un palier.
