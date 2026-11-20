# ZAWELI — Écrans de gestion de l'administration

> Statut : **livré, à valider**.
> Date : 20 novembre 2026.
> Entrées : [cahier des charges](02-cahier-des-charges.md) §6.3, §7.6, §8.3, §11.9 ; [espace d'administration](10-espace-administration.md) §9.

---

## 1. Écrans

| Écran | Adresse | Ce qu'on y fait |
| --- | --- | --- |
| **Utilisateurs** | `/utilisateurs` | <ul><li>Recherche par adresse, nom, identifiant ou code de parrainage, et filtre « suspendus ».</li><li>Fiche du compte : langue, pays, rôles, licences, achats, expériences.</li><li>**Suspendre** avec un motif interne, ou **rétablir**.</li><li>**Offrir une licence** (motif journalisé) ou **retirer** une licence.</li></ul> |
| **Formules et prix** | `/formules` | <ul><li>Liste des formules, prix en vigueur et historique.</li><li>**Modification champ par champ** : seuls les champs touchés partent.</li><li>Nouveau prix : il clôt l'ancien prix de la même devise.</li><li>Création d'une formule : inactive et cachée par défaut.</li></ul> |
| **Modèles** | `/modeles` | <ul><li>Statut (brouillon, publié, caché, retiré), ordre d'affichage, étiquettes d'accès.</li><li>Versions, nombre d'expériences.</li><li>Le design et le code d'un modèle ne s'éditent jamais ici : ils viennent du dépôt.</li></ul> |
| **Modération** | `/moderation` | <ul><li>Signalements à traiter, retirés ou classés, avec le lien vers l'expérience.</li><li>**Retirer l'expérience** ou **classer sans suite**, motif journalisé.</li><li>Liste des expériences retirées, avec **rétablir**.</li></ul> |

Chaque action est faite sous l'acteur `admin` et inscrite dans le journal d'audit. En mode démonstration, ces écrans sont vides et refusent les écritures : ils ont besoin de l'API réelle.

## 2. Suspension d'un compte

- L'API refuse **tout** jeton du compte, même encore valide : une session Supabase dure jusqu'à une heure (`ACCOUNT_SUSPENDED`, 403).
- Supabase Auth bloque la connexion (`ban_duration`), si `SUPABASE_SECRET_KEY` est réglée.
- Le motif reste interne. Un administrateur ne peut pas suspendre son propre compte.
- Les expériences publiées du compte restent en ligne. Pour en retirer une, passer par la Modération.

Migration : `20261120000400_admin_management.sql` ajoute `profiles.suspended_at` et `profiles.suspension_reason`.

## 3. Correction des formules (rappel)

Modifier un champ d'une formule remettait les autres à leur valeur par défaut : formule désactivée, cachée, durée effacée. C'est corrigé dans le commit `0662d9c`. L'écran Formules n'envoie de toute façon que les champs modifiés. Vérifié dans le navigateur : en changeant « Suggestions IA » de la formule gratuite, seul ce champ a bougé.

## 4. Routes ajoutées

`GET /v1/admin/users`, `GET /v1/admin/users/{id}`, `POST /v1/admin/users/{id}/suspend` et `/unsuspend`, `POST /v1/admin/licenses/{id}/revoke`, `GET /v1/admin/templates`, `GET /v1/admin/experiences/suspended`.

Les autres routes existaient déjà (doc 09) : signalements, retrait et rétablissement d'une expérience, formules et prix, modèles, licences offertes.

## 5. Vérifications exécutées

| Vérification | Résultat |
| --- | --- |
| `apps/api/test/admin-management.spec.ts` | 5 tests : <ul><li>recherche (adresse, nom, identifiant ; `%` n'est pas un joker ; réservée aux admins) ;</li><li>suspension (jetons refusés, Supabase appelé, refus sur soi-même, journal) puis rétablissement ;</li><li>licence offerte puis retirée ;</li><li>modèles (versions, étiquettes, statut) ;</li><li>signalement → retrait → liste des retirées → rétablissement.</li></ul> |
| Parcours dans le navigateur (banc local) | <ul><li>Recherche et fiche d'un compte, suspension, licence offerte.</li><li>Modification d'un seul champ d'une formule, sans effet sur les autres.</li><li>Modèles, modération.</li><li>Aucun débordement à 375 px.</li></ul> |

## 6. Hors de ce lot

- Rôle `support` en lecture seule : le rôle existe en base, mais toutes ces routes exigent `admin`.
- Remboursements (C10) : à définir.
