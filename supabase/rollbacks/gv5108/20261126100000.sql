-- Retour arrière de 20261126100000 : retire uniquement les SELECT accordés
-- à service_role sur public.invitations puis public.establishments. Ne touche
-- ni anon, ni authenticated, ni RLS, ni aucune autre table.
-- PRÉPARÉ — NON APPLIQUÉ.

revoke select on public.invitations from service_role;
revoke select on public.establishments from service_role;
