-- Retour arrière de 20261126040000 : retire uniquement le SELECT accordé
-- à service_role sur public.profiles. Ne touche ni anon, ni authenticated,
-- ni RLS, ni aucune autre table.
-- PRÉPARÉ — NON APPLIQUÉ.

revoke select on public.profiles from service_role;
