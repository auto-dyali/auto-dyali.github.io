-- ROLLBACK GV5 §77 / 001 — restaure l'exécution anon sur les RPC admin héritées.
-- À n'utiliser que si l'activation sans JWT devait à nouveau passer par anon
-- pour une RPC supplémentaire (aucune autre que admin_invitation_preview
-- n'est concernée aujourd'hui).

do $$
declare r record;
begin
  for r in
    select p.oid
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname like 'admin_%'
      and p.proname <> 'admin_invitation_preview'
      and not has_function_privilege('anon', p.oid, 'EXECUTE')
  loop
    execute format('grant execute on function %s to anon', r.oid::regprocedure);
  end loop;
end $$;
