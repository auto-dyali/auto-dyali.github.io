-- AUTO DYALI — GV5 §77 — Durcissement P0 (STAGING ; production sur autorisation)
--
-- Les RPC `admin_*` héritées étaient exécutables par le rôle anon à cause des
-- privilèges par défaut de Supabase. Leurs garde-fous internes les protègent,
-- mais la surface d'exposition est inutile. On révoque EXECUTE à anon sur
-- toutes sauf `admin_invitation_preview` : celle-ci est appellée sans JWT par
-- l'Edge Function d'activation (aperçu d'un jeton) et ne contient aucun
-- contrôle saas_admin (elle valide le jeton uniquement).
--
-- Aucune donnée n'est modifiée. Aucun appel légitime Super Admin n'est affecté
-- (le frontend et les EF utilisent le rôle authenticated ou service_role).

do $$
declare r record;
begin
  for r in
    select p.oid, p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname like 'admin_%'
      and p.proname <> 'admin_invitation_preview'
      and has_function_privilege('anon', p.oid, 'EXECUTE')
  loop
    -- `public` est le rôle hérité par anon : révoquer seulement anon ne suffit
    -- pas lorsque le privilège vient de public. On révoque donc les deux, puis
    -- on réaccorde explicitement les rôles autorisés.
    execute format('revoke all on function %s from public', r.oid::regprocedure);
    execute format('revoke all on function %s from anon', r.oid::regprocedure);
    execute format('grant execute on function %s to authenticated', r.oid::regprocedure);
    execute format('grant execute on function %s to service_role', r.oid::regprocedure);
  end loop;
end $$;
