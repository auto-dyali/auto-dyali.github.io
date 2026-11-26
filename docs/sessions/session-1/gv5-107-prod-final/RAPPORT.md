# GV5 §107-PROD-FINAL — Rapport de phase 0/1/2 (ARRÊT GO-1)

Branche `gv5-107-prod-final`, créée depuis `b7635de`. `main` = `81ca143`. **Aucune écriture en production, aucun merge, aucun déploiement.**

## 1. Cause racine exacte

Le message affiché en production (« RPC de diagnostic absente… migration 0039 ») est produit par `src/app/super-admin/onboarding/page.tsx` (lignes 312-318 du code déployé) lorsque l'appel `supabase.rpc("admin_identity_v2_health")` renvoie `PGRST202`. La RPC n'est **pas** définie dans `0039` : elle est définie dans `supabase/security/remediation_583/001_identity_health.sql`, puis versionnée dans `20261124132000_reconcile_manager_onboarding.sql`. Le message frontend mentionne 0039 car c'est l'ensemble des objets d'identité v2 que le diagnostic vérifie.

Cause : la base de production n'a reçu ni 0039 ni les réconciliations §101. Le précontrôle fait donc correctement son travail ; **aucune modification du front n'est nécessaire ni autorisée**.

## 2. Vérification indépendante des hypothèses (lecture seule, PRODUCTION)

| Affirmation du rapport précédent | Vérification | Résultat |
|---|---|---|
| `invitations`, `invitation_events` absentes | `pg_tables` | **Confirmé** (0 ligne sur ces 2 noms) |
| Colonnes `professional_id`, `login_id`, `must_change_password` absentes | `information_schema.columns` | **Confirmé** (0 ligne) |
| RPC absentes | `pg_proc` | **Confirmé** : seules `admin_find_onboarding_request` et `admin_find_user_id_by_email` existent ; 12 RPC requises absentes |
| `onboard-tenant` v1 | `supabase functions list` | **Confirmé** (v1, `verify_jwt=true`) |
| `send-invitation`, `activate-manager` absentes | idem | **Confirmé** (1 seule fonction déployée) |
| Aucune migration appliquée | `information_schema.tables` sur `supabase_migrations` | **Confirmé** (`tables_hist=0`, table absente) — l'hypothèse « table standard `schema_migrations` » est la bonne, elle n'existe pas en production |
| Plans | `select * from plans` | **Nuance** : `standard` a `price_monthly/yearly = 0.00` (pas NULL), `silver/gold` NULL. Aucun prix inventé |
| Comptages | SQL | 2 établissements, 1 profil (SA), 2 abonnements |
| Fournisseur e-mail | noms des secrets | Aucun secret RESEND/EMAIL/SMTP |
| Front déployé | API GitHub Actions | Dernier run Pages réussi sur `81ca143`, identique à `main` — **aucun écart** |

## 3. Définition exacte du diagnostic et cohérence

`admin_identity_v2_health()` : `plpgsql`, `SECURITY DEFINER`, `search_path=public`, `if coalesce(is_saas_admin(),false) is not true then raise 'Accès refusé'`. Renvoie 9 booléens : `establishments_professional_id`, `profiles_login_id`, `profiles_must_change_password`, `fn_admin_check_identity_available`, `fn_admin_onboard_tenant_v2`, `fn_get_my_profile`, `fn_get_my_security_state`, `fn_resolve_login_email`, `fn_must_change_password`. Droits : `REVOKE ALL FROM public, anon`, `GRANT EXECUTE TO authenticated`. Vérifié sur staging : SA 200 / 9 true, anonyme 401 `permission denied`. Le front doit passer d'un message bloquant à la suite du formulaire quand ces 9 clés sont `true` ; le message n'est pas masqué, il disparaît parce que la condition devient fausse.

## 4. Chaîne de création — étapes manquantes

Interface → `admin_identity_v2_health` / `admin_check_identity_available` → EF `onboard-tenant` v3 → `admin_find_onboarding_request`, `admin_find_user_id_by_email`, `admin_onboard_tenant_v2`, `admin_record_delivery` → Auth (création user) → tables `establishments`, `subscriptions`, `profiles`, `permissions`, `invitations` → fiche Manager. En production, l'étape qui échoue est la toute première (diagnostic RPC absente) ; toutes les RPC v2 et les tables d'invitation manquent ensuite. Le parcours ne peut pas démarrer.

Provisionnement Manager : compte Auth (EF) / profil (RPC v2) / rattachement `establishment_id` (RPC v2) / mot de passe temporaire + `must_change_password` (colonnes + RLS) / activation (lien à usage unique) / invitation (table + EF `send-invitation`). **Défaut D confirmé** : aucun moyen de récupérer le lien d'activation sans fournisseur e-mail. Corrigé par la RPC `admin_issue_activation_link()` (nouveau jeton, hash seul stocké, ancien lien invalidé, Super Admin uniquement) et un bouton « Copier le lien d'activation » dans la fiche. Vérifié sur staging : 200 avec URL valide, 401 pour un anonyme ; aucun jeton affiché ni journalisé.

## 5. Incohérence des stratégies tranchée

`RAPPORT_ANALYSE.md` citait un fichier unique `20261125100000_prod_minimal_onboarding.sql` : **ce fichier n'existe pas**. Les fichiers réellement présents et rejoués en CI sont **sept** : `20261125100000` (invitations), `101000` (identité v2), `102000` (diagnostic), `102500` (colonnes admin avant pré-contrôle), `103000` (champs admin), `104000` (correctif trigger), `106000` (lien d'activation). Stratégie retenue : **les sept, dans cet ordre**, jamais les deux stratégies en même temps. Le défaut de `103000` (pré-contrôle exigeant ses propres colonnes) a été reproduit en CI, corrigé par `102500`, sans éditer `103000` déjà appliquée sur staging.

## 6. Répétition et preuves

- CI `migrations-real` (branche `gv5-107-prod-final`) : job `real-supabase` **success** (base vierge, deux resets, parcours complet, activation, artefact `schema-local`), job `rejeu forme production` : baseline + 7 migrations **deux passages success**, contrôle diagnostic et droits **success**.
- Le parcours navigateur complet sur la base « forme production » reste **BLOQUÉ** (NON TESTÉ) : le baseline minimal ne reproduit pas le trigger `handle_new_auth_user` ni les policies RLS de production ; le test échoue au précontrôle faute d'état applicatif complet. Les mêmes corrections ont été rejouées avec succès sur le vrai Supabase local (job `real-supabase`) et sur **STAGING** (parcours navigateur complet : précontrôle vert, création 200, fiche, modification 200, 0 appel production). Action attendue : fournir une copie réelle du schéma de production (ou autoriser le baseline local à inclure trigger/policies) pour rejouer ce parcours sur « forme production ».
- STAGING : 7 migrations appliquées deux fois sans erreur ; diagnostic SA 200/9 true, anon 401 ; isolation A/B 1 établissement visible par Manager, RPC admin refusées, anonyme 0 ligne ; nettoyage `ZZ-TEST-GV5107` 0 résidu.
- Tests locaux : `npm test` 191/191, `tsc` OK, lint 0 erreur, build production 0 occurrence STAGING / 2 occurrences production, aucune clé `service_role`.

## 7. Sauvegarde et historique

- Schéma : `/tmp/adq/gv5107final_backup/backup_schema.json` — sha256 `719841ca695a22d24f73c24c84e39413a7deab577d89b14891e0046cc71b1b3a`.
- Données : `/tmp/adq/gv5107final_backup/backup_data.jsonl` — sha256 `54d208036eaa1d28de2fda3d0d56204207c4ce756e88e6f12cb8743cc109af1c`. Stockés hors dépôt, jamais dans un artefact.
- Somme de contrôle des `establishments`/`subscriptions`/`profiles` des 2 garages + SA : `8cf57f71c55260bf…` (à comparer après application).
- Stratégie historique proposée, **non exécutée** : créer `supabase_migrations.schema_migrations` puis enregistrer une version `baseline` représentant l'état actuel, puis les 7 versions correctives. À valider explicitement (GO-2/GO-3).

## 8. BLOQUÉ — actions attendues

1. **GO-1** : valider ce diagnostic et la stratégie à sept migrations.
2. **GO-2** : autoriser l'application en production après sauvegarde vérifiée.
3. **GO-3** : autoriser la PR vers `main` si le front doit changer (il ne change pas pour l'instant).
4. **GO-4** : ouvrir vous-même la session Super Admin et fournir les preuves de création.
5. Fournisseur e-mail production : nommer le fournisseur et fournir son secret via le dashboard Supabase, ou accepter le lien copiable sans e-mail.

## 9. Verdict

**NON TERMINÉ.** La cause est identifiée et la correction est répétée en LOCAL et STAGING ; aucune écriture de production n'a été faite. Le passage à « TERMINÉ » exige GO-1 → GO-2 → application → vérification par le propriétaire.

**Suite (25/11) :** la stratégie passe à **8 migrations** avec la corrective `20261125108000` (pgcrypto / `search_path`), validée sur base de test. Voir `RAPPORT_PREPARATION_PROD.md` et `docs/RM-GV5_REGISTRE_MAITRE.md`. Le workflow de répétition abandonné a été retiré. Aucune écriture production.
