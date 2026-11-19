-- GV5 §61 — 004_rls_policy_review.sql
-- STATUT : SCRIPT DE REVUE — LECTURE SEULE. Aucune modification de policy.
-- Les décisions de modification sont documentées dans GV5_61_AUDIT_RLS_COMPLET.md.

-- 1. Toutes les politiques avec expressions USING / WITH CHECK
select schemaname, tablename, policyname, permissive, cmd,
       array_to_string(roles,',') roles, qual as using_expr, with_check
from pg_policies where schemaname='public'
order by tablename, policyname;

-- 2. Tables SANS aucune politique (exposition potentielle)
select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind in ('r','v','m') and c.relrowsecurity
  and not exists (select 1 from pg_policy p where p.polrelid=c.oid)
order by c.relname;

-- 3. Vérifier les politiques RESTRICTIVE (attendu : 0 avant 0038)
select count(*) as restrictive_policies from pg_policies
where schemaname='public' and permissive='RESTRICTIVE';

-- 4. Vues susceptibles de contourner RLS (attendu : 0)
select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind in ('v','m');

-- NOTE : FORCE ROW LEVEL SECURITY non activé (décision §51 maintenue).
-- Le activer globalement casserait les RPC SECURITY DEFINER (owner postgres).
-- Les politiques restrictives de rotation sont prévues dans la migration 0039.
