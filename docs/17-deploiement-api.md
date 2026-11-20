# ZAWELI — Déploiement de l'API sur Hostinger

> Statut : **prêt, à déployer**.
> Date : 20 novembre 2026.
> Entrées : [API métier](09-api-metier-et-langues.md), [modèle de données](04-modele-de-donnees.md) §8, [espace client](11-espace-client.md) §4.

---

## 1. Le principe : une seule application Node.js

Hostinger n'accepte qu'**une** application Node.js, celle de `zaweli.store`. L'API tourne donc **dans le même processus que le site** :

- `apps/web/server.mjs` sert le site (Next.js) ;
- il monte l'API (NestJS, `apps/api/dist`) sous **`https://zaweli.store/v1/…`**.

Il n'y a **pas** de sous-domaine `api.zaweli.store` : le sous-domaine et son dossier `public_html/api` peuvent être supprimés dans hPanel.

| Situation | Comportement |
| --- | --- |
| `DATABASE_URL` absente | Le site fonctionne, l'API n'est pas montée, `/v1/…` répond 503. |
| Configuration de l'API invalide | Le site **reste en ligne**. `/v1/…` répond 503, et le journal dit quelle variable pose problème (`API non montée : Configuration invalide : …`). |
| Tout est réglé | Le journal affiche `API montée sous /v1.` |

## 2. Prérequis (une fois)

1. **Base Supabase** : appliquer toutes les migrations de `supabase/migrations` (`supabase db push`, ou la console SQL dans l'ordre des noms de fichiers).
2. **Utilisateur de connexion de l'API**, dans la console SQL de Supabase, avec un mot de passe fort que vous gardez pour l'étape 4 :
   ```sql
   create role zaweli_api_login login password '<secret fort>' in role zaweli_api;
   ```
   L'API refuse de démarrer en production avec `postgres`.

## 3. Réglages de l'application `zaweli.store` (hPanel → Node.js)

| Champ | Valeur |
| --- | --- |
| Commande de build | `pnpm exec turbo run build --filter=@zaweli/web --filter=@zaweli/api`, ou `pnpm build`, qui construit tout le dépôt |
| Fichier d'entrée | `apps/web/server.mjs` (inchangé) |

Si la commande de build ne construit que le site, le journal affiche `apps/api/dist manquant`.

**Ne réglez pas `NODE_ENV` vous-même** : posée pendant l'installation, elle fait sauter les outils de build. `server.mjs` la met à `production` au démarrage.

## 4. Variables d'environnement (même application)

La liste complète, commentée, est dans [`apps/api/.env.example`](../apps/api/.env.example). Elles s'ajoutent à celles du site, dans le panneau de la même application.

| Variable | Valeur |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | **`https://zaweli.store`**, l'adresse du site lui-même. Gravée au build : redéployer après l'avoir changée. |
| `DATABASE_URL` | `postgresql://zaweli_api_login.<ref-projet>:<secret>@<hôte-pooler>:5432/postgres`. Supabase → Connect → **Session pooler** ; Hostinger ne joint pas toujours l'adresse IPv6 directe. |
| `SUPABASE_URL` | `https://<ref-projet>.supabase.co` |
| `CORS_ORIGINS` | `https://zaweli.store,https://www.zaweli.store,https://admin.zaweli.store` |
| `PUBLIC_WEB_URL` | `https://zaweli.store` |
| `PUBLIC_API_URL` | `https://zaweli.store` |
| `TRUST_PROXY` | `2` (CDN de Hostinger + serveur web) |

Ensuite, selon les fonctions voulues : `SUPABASE_SECRET_KEY` (photos, suspension des comptes), `MBIYOPAY_*` (paiements), `OPENROUTER_*` (aide à l'écriture), `SMTP_URL` (e-mails).

`PORT` n'est pas à régler pour l'API : c'est celui du site qui sert.

### À propos de `TRUST_PROXY`

Derrière Hostinger, l'API ne voit que l'adresse du mandataire. Sans ce réglage, **tous les visiteurs partagent la même limite** de 120 requêtes par minute. Ce réglage dit combien de mandataires précèdent l'API :
- s'il est trop bas, la limite reste partagée ;
- s'il est trop haut, un visiteur peut se faire passer pour un autre et contourner la limite.

`2` correspond au schéma habituel de Hostinger. À confirmer si des refus 429 apparaissent sous faible charge.

## 5. Vérifier

```
curl https://zaweli.store/v1/health
```

Réponse attendue : `200` avec `"database": { "status": "ok" }`.
- `503` avec `"database": { "status": "down" }` : l'API tourne, mais la base ne répond pas. Vérifier `DATABASE_URL`, le rôle et le pooler.
- `503` avec `SERVICE_UNAVAILABLE` : l'API n'est pas montée. La raison est dans le journal de l'application.

## 6. Administration et services externes

1. **Administration** : `NEXT_PUBLIC_API_URL=https://zaweli.store` dans `apps/admin/.env.production.local`, puis rebuild et dépôt de `out/` dans `public_html/admin` (doc 10 §7).
2. **Supabase Auth → URL Configuration** : Site URL `https://zaweli.store`, redirections `https://zaweli.store/**` et `https://admin.zaweli.store/**`.
3. **MbiyoPay** (si utilisé) : adresse du webhook `https://zaweli.store/v1/webhooks/mbiyopay`.

## 7. Hébergeur dédié (plus tard)

Si l'API part un jour sur sa propre machine, `apps/api/server.mjs` la lance seule, sur `PORT`. Il suffira de changer `NEXT_PUBLIC_API_URL` et `PUBLIC_API_URL`, puis de retirer `DATABASE_URL` de l'application du site.

## 8. Vérifications exécutées (local)

| Vérification | Résultat |
| --- | --- |
| Build du site et de l'API | Réussi |
| `vitest run` (API) | 92 tests réussis |
| `node apps/web/server.mjs`, avec les variables de l'API | <ul><li>Journal « API montée sous /v1 ».</li><li>`/v1/health` → 503 JSON (aucune base locale), `/v1/me/profile` → 401 sans jeton.</li><li>Pré-requête CORS depuis `admin.zaweli.store` → 204 avec la bonne origine.</li><li>`/`, `/tarifs`, `/llms.txt` → 200.</li></ul> |
| Même chose avec une configuration invalide | Le site répond 200, `/v1/health` répond 503, et le journal donne la raison. |

**Non vérifié** :
- le déploiement réel sur Hostinger ;
- la joignabilité du pooler Supabase depuis Hostinger ;
- le nombre réel de mandataires.
