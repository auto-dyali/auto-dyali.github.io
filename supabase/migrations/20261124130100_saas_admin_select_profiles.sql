-- AUTO DYALI — Migration versionnée du correctif GV5 §102 (commit 4d84113).
-- Le Super Admin doit pouvoir lire les profils Managers : sans cette policy,
-- la liste des abonnés affichait « Aucun manager associé » et le tableau de
-- bord affichait 0 manager (la policy existante dépend de
-- current_establishment_id(), NULL pour un Super Admin).
--
-- Idempotente : DROP POLICY IF EXISTS puis CREATE POLICY.
-- SELECT uniquement. Les policies INSERT/UPDATE existantes restent seules
-- compétentes pour écrire ; la garde est vérifiée côté base via
-- public.is_saas_admin(), jamais depuis le client.

drop policy if exists saas_admin_select_profiles on public.profiles;

create policy saas_admin_select_profiles on public.profiles
  for select to authenticated
  using (public.is_saas_admin());
