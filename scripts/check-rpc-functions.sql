-- ============================================================================
# SCRIPT DE VÉRIFICATION DES FONCTIONS RPC SUPABASE
# AUTO DYALI - GV5 §98
#
# À EXÉCUTER APRÈS L'APPLICATION DES MIGRATIONS 0036→0043
# ============================================================================

-- 1. Vérifier les fonctions RPC critiques
SELECT
    p.proname AS fonction,
    n.nspname AS schema,
    CASE WHEN p.prokind = 'f' THEN 'FONCTION' ELSE 'PROCÉDURE' END AS type,
    pg_get_function_arguments(p.oid) AS signature,
    pg_get_function_identity_arguments(p.oid) AS signature_detaillee
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'admin_identity_v2_health',
    'admin_check_identity_available',
    'admin_onboard_tenant_v2',
    'admin_invitation_preview',
    'admin_accept_invitation',
    'admin_record_delivery',
    'admin_prepare_resend',
    'admin_set_subscription',
    'admin_update_establishment',
    'admin_update_manager',
    'admin_get_abonne_details',
    'admin_set_permissions',
    'admin_revoke_invitation'
  )
ORDER BY p.proname;

-- 2. Vérifier les tables créées
SELECT
    table_name,
    table_schema
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'invitations',
    'invitation_events',
    'establishments',
    'profiles',
    'subscriptions',
    'onboarding_requests',
    'permissions'
  )
ORDER BY table_name;

-- 3. Vérifier les colonnes d'identité critiques
SELECT
    table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('establishments', 'profiles', 'invitations')
  AND column_name IN (
    'professional_id',
    'login_id',
    'must_change_password',
    'temporary_password_issued_at',
    'temporary_password_expires_at',
    'password_changed_at',
    'token_hash',
    'manager_user_id',
    'establishment_id'
  )
ORDER BY table_name, column_name;

-- 4. Vérifier les politiques RLS sur profiles
SELECT
    polname AS politique,
    polcmd AS type_commande,
    pg_get_expr(polqual, polrelid) AS condition
FROM pg_policy
WHERE polrelid = 'public.profiles'::regclass
ORDER BY polname;

-- 5. Vérifier les contraintes uniques
SELECT
    conname AS contrainte,
    conrelid::regclass AS table,
    contype AS type,
    conkey::oid[] AS colonnes
FROM pg_constraint
WHERE conrelid = 'public.profiles'::regclass
  AND contype = 'u'
ORDER BY conname;