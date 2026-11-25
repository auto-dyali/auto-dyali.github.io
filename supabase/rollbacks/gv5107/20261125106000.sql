-- Retour arrière migration 106000 (lien d'activation)
drop function if exists public.admin_issue_activation_link(uuid);
