-- Retour arrière migration 104000 (correctif trigger)
-- La version précédente n'existe pas en production : la suppression
-- rétablit l'absence de RPC, pas une ancienne définition.
drop function if exists public.admin_onboard_tenant_v2(text, jsonb, jsonb, jsonb, text[], jsonb, text, timestamptz, text[]);
