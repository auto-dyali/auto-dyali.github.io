-- MISSION 2.14 — PRÉPARATION (NON APPLIQUÉE / NE PAS EXÉCUTER SANS AUTORISATION EXPLICITE)
-- Objectif: corriger les comptes abonnés professionnels a.naji et r.bami
-- État constaté (diagnostic utilisateur): profils existent, roles='client', même establishment_id, 1 établissement, 1 abonnement actif.
-- RÈGLES: ne pas supprimer users/profils/établissements/abonnements/données; ne pas inventer nom/ville garage r.bami;
-- ne pas partager le même établissement entre les deux managers; ne pas modifier sans validation explicite.

BEGIN;

-- 0) SAUVEGARDE / CONTRÔLES AVANT (lecture dans la même transaction logique de vérification; exporter les résultats)
-- 0.1 Profils ciblés
-- select * from public.profiles
-- where id in ('31b0ca43-413b-4559-ab93-bc0637e97bde','72b8d0a6-c4b8-4b35-a5ab-9aca5ee84da2')
--    or lower(email) in ('a.naji@auto-dyali.ma','a.naji@auto-dyia.ma','r.bami@auto-dyali.ma');

-- 0.2 Établissement(s) partagé(s) et abonnement(s)
-- select * from public.establishments where id in (
--   select establishment_id from public.profiles
--   where id in ('31b0ca43-413b-4559-ab93-bc0637e97bde','72b8d0a6-c4b8-4b35-a5ab-9aca5ee84da2')
-- );
-- select * from public.subscriptions where establishment_id in (...);

-- 0.3 Vérifier à quel garage appartiennent réellement les données existantes avant tout rattachement.
-- (clients, vehicles, sales, invoices, employees, stock, work_orders, etc. par establishment_id)

-- 1) DÉCISIONS REQUISES AVANT MUTATION (à renseigner par l'opérateur autorisé)
-- - Confirmer UUID Auth/email réel de a.naji et r.bami.
-- - Déterminer si l'établissement existant est celui de a.naji OU celui de r.bami (pas deviner).
-- - Fournir nom/slug/ville du NOUVEL établissement pour l'autre manager (nom de r.bami inconnu -> obligatoire).
-- - Définir le plan/abonnement du nouvel établissement (copie, nouveau, ou attribution existante) selon règle métier.

-- 2) EXEMPLE DE PLAN (À ADAPTER, placeholders obligatoires)
-- 2.1 Créer le second établissement (si validé)
-- insert into public.establishments (name, slug, city, plan, is_active)
-- values ('<NOM_GARAGE_MANAGER_B>', '<slug-unique>', '<VILLE_OU_NULL>', '<plan>', true)
-- returning id;

-- 2.2 Mettre à jour le profil du manager concerné vers SON établissement et rôle manager
-- update public.profiles
-- set role = 'manager',
--     is_active = true,
--     establishment_id = '<UUID_ETABLISSEMENT_CORRECT>'
-- where id = '<UUID_AUTH_MANAGER>'
--   and role in ('client','manager','employee'); -- garde-fou, vérifier résultat attendu

-- 2.3 Mettre à jour l'autre profil manager vers l'autre établissement (distinct)
-- update public.profiles ... where id = '<UUID_AUTH_AUTRE_MANAGER>';

-- 2.4 Créer/associer abonnement du nouvel établissement si nécessaire (selon schéma subscriptions et règle commerciale)
-- insert into public.subscriptions (establishment_id, plan_code, status, current_period_end, ...)
-- values (...);

-- 3) CONTRÔLES APRÈS (dans la même exécution, avant COMMIT si possible)
-- select id, full_name, email, role, is_active, establishment_id from public.profiles
-- where id in ('31b0ca43-413b-4559-ab93-bc0637e97bde','72b8d0a6-c4b8-4b35-a5ab-9aca5ee84da2');
-- Vérifier que establishment_id sont différents et non nuls, roles='manager', is_active=true.
-- Vérifier établissements distincts et abonnements cohérents.

-- 4) COMMIT / ROLLBACK
-- COMMIT; -- seulement après validation humaine des contrôles avant/après
ROLLBACK; -- laissé en rollback par défaut pour sécurité
