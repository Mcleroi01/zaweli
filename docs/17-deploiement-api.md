# ZAWELI — Déploiement de l'API (api.zaweli.store)

> Statut : **prêt, à déployer**.
> Date : 20 novembre 2026.
> Entrées : [API métier](09-api-metier-et-langues.md), [modèle de données](04-modele-de-donnees.md) §8, [espace client](11-espace-client.md) §4.

---

## 1. Pourquoi

Le site et l'administration ne font que **lire et écrire via l'API** (`/v1/…`). Sans elle, l'espace client répond 404 sur `/v1/me/profile`, et l'administration ne peut ni se connecter ni charger de données.

Le site de production a été construit avec une adresse d'API qui pointe vers `zaweli.store` lui-même : ses appels arrivent sur le site Next.js, qui n'a pas de route `/v1`.

## 2. Prérequis (une fois)

1. **Base Supabase** : appliquer toutes les migrations de `supabase/migrations` (`supabase db push`, ou la console SQL dans l'ordre des noms de fichiers).
2. **Utilisateur de connexion de l'API**, dans la console SQL de Supabase, avec un mot de passe fort que vous gardez pour l'étape 4 :
   ```sql
   create role zaweli_api_login login password '<secret fort>' in role zaweli_api;
   ```
   L'API refuse de démarrer en production avec `postgres`.
3. **Sous-domaine** : ne PAS créer `api.zaweli.store` comme simple dossier, ce que vous aviez fait pour l'administration. C'est l'application Node.js de l'étape 3 qui doit le créer ou s'y rattacher. S'il existe déjà comme dossier dans hPanel, le supprimer d'abord.

## 3. Application Node.js sur Hostinger

hPanel → **Sites web → Ajouter → Application Node.js**, depuis le même dépôt GitHub que le site :

| Champ | Valeur |
| --- | --- |
| Domaine | `api.zaweli.store` |
| Version de Node | 22 ou 24 |
| Gestionnaire de paquets | pnpm |
| Dossier racine | la racine du dépôt (pas `apps/api`) : l'API utilise les paquets partagés |
| Commande de build | `pnpm exec turbo run build --filter=@zaweli/api` |
| Fichier d'entrée | `apps/api/server.mjs` |

`server.mjs` met `NODE_ENV=production` si l'hébergeur ne le fait pas, puis lance `apps/api/dist/main.js`.

**Ne réglez pas `NODE_ENV` vous-même** : si `NODE_ENV=production` est posée pendant l'installation, pnpm saute les dépendances de développement, et le build (Nest CLI, TypeScript, Turbo) échoue.

## 4. Variables d'environnement

La liste complète, commentée, est dans [`apps/api/.env.example`](../apps/api/.env.example). En production, le fichier `.env` n'est **pas** lu : saisissez les variables dans le panneau de l'application.

Minimum pour démarrer :

| Variable | Valeur |
| --- | --- |
| `DATABASE_URL` | `postgresql://zaweli_api_login.<ref-projet>:<secret>@<hôte-pooler>:5432/postgres`. Supabase → Connect → **Session pooler** ; Hostinger ne joint pas toujours l'adresse IPv6 directe `db.<ref>.supabase.co`. |
| `SUPABASE_URL` | `https://<ref-projet>.supabase.co` |
| `CORS_ORIGINS` | `https://zaweli.store,https://www.zaweli.store,https://admin.zaweli.store` |
| `PUBLIC_WEB_URL` | `https://zaweli.store` |
| `PUBLIC_API_URL` | `https://api.zaweli.store` |
| `TRUST_PROXY` | `2` (CDN de Hostinger + serveur web) |

Ensuite, selon les fonctions voulues : `SUPABASE_SECRET_KEY` (photos, suspension des comptes), `MBIYOPAY_*` (paiements), `OPENROUTER_*` (aide à l'écriture), `SMTP_URL` (e-mails).

### À propos de `TRUST_PROXY`

Derrière Hostinger, l'API ne voit que l'adresse du mandataire. Sans ce réglage, **tous les visiteurs partagent la même limite** de 120 requêtes par minute, et le site se bloque dès qu'il y a du monde. Ce réglage dit combien de mandataires précèdent l'API :
- s'il est trop bas, la limite reste partagée ;
- s'il est trop haut, un visiteur peut se faire passer pour un autre et contourner la limite.

`2` correspond au schéma habituel de Hostinger. À confirmer si des refus 429 apparaissent sous faible charge.

## 5. Vérifier

```
curl https://api.zaweli.store/v1/health
```

Réponse attendue : `200` avec `"database": { "status": "ok" }`.
- `503` : l'API tourne mais la base ne répond pas (vérifier `DATABASE_URL`, le rôle et le pooler).
- Pas de réponse : voir les journaux de l'application dans hPanel. Une configuration invalide y est détaillée variable par variable (`Configuration invalide : …`).

## 6. Rebrancher le site et l'administration

Les adresses `NEXT_PUBLIC_*` sont **gravées au build** : il faut reconstruire les deux.
1. **Site** (application `zaweli.store`) : `NEXT_PUBLIC_API_URL=https://api.zaweli.store`, puis redéployer.
2. **Administration** : même valeur dans `apps/admin/.env.production.local`, puis rebuild et dépôt de `out/` (doc 10 §7).
3. **Supabase Auth → URL Configuration** : Site URL `https://zaweli.store`, redirections `https://zaweli.store/**` et `https://admin.zaweli.store/**`.
4. **MbiyoPay** (si utilisé) : adresse du webhook `https://api.zaweli.store/v1/webhooks/mbiyopay`.

## 7. Vérifications exécutées (local)

| Vérification | Résultat |
| --- | --- |
| `turbo run build --filter=@zaweli/api` | 5 tâches réussies (paquets partagés et API) |
| `vitest run` (API) | 92 tests réussis, dont la lecture de `TRUST_PROXY` |
| `node apps/api/server.mjs` sans `NODE_ENV` | Démarre en production : journaux JSON, `/v1/health` → 503 sans base. Sans `CORS_ORIGINS`, refuse de démarrer avec un message clair. |
| `apps/api/.env.example` contre la validation | Accepté en développement et en production |

**Non vérifié** : le déploiement réel sur Hostinger (installation pnpm du monorepo, joignabilité du pooler Supabase, nombre réel de mandataires).
