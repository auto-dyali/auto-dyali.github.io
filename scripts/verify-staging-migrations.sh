#!/bin/bash
# ============================================================================
# SCRIPT DE VÉRIFICATION DES MIGRATIONS SUPABASE STAGING
# AUTO DYALI - GV5 §98
#
# À EXÉCUTER APRÈS L'APPLICATION DES MIGRATIONS 0036→0043
# ============================================================================

set -euo pipefail

PROJECT_REF="yocufscgninxiihwiepa"

# Couleurs
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "=============================================="
echo "  VÉRIFICATION DES MIGRATIONS SUPABASE STAGING"
echo "  Projet : $PROJECT_REF"
echo "=============================================="

# Vérifier que le CLI est disponible
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}ERREUR : supabase CLI non trouvé dans le PATH${NC}"
    exit 1
fi

# Vérifier l'authentification
echo -n "Vérification de l'authentification Supabase... "
if supabase projects list > /dev/null 2>&1; then
    echo "✅ Authentifié"
else
    echo -e "${RED}ERREUR : Non authentifié. Exécutez 'supabase login'${NC}"
    exit 1
fi

# Vérifier le projet cible
echo -n "Vérification du projet... "
PROJECT_INFO=$(supabase projects list 2>&1)
if echo "$PROJECT_INFO" | grep -q "yocufscgninxiihwiepa"; then
    echo "✅ Projet staging 'yocufscgninxiihwiepa' trouvé"
else
    echo -e "${RED}ERREUR : Projet staging non trouvé${NC}"
    echo "$PROJECT_INFO"
    exit 1
fi

echo ""

# 1. Vérifier les migrations appliquées
echo "=== 1. MIGRATIONS APPLIQUÉES ==="
supabase migration list --linked 2>&1 | grep -E "003[6-9]|004[0-3]" || echo "  Aucune migration 0036-0043 trouvée"
echo ""

# 2. Vérifier les fonctions RPC via SQL (pas via Edge Functions)
echo "=== 2. FONCTIONS RPC CRITIQUES ==="
supabase db query --linked <<'SQL' 2>&1 || true
SELECT
    proname AS fonction,
    pronargs AS signature
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
ORDER BY proname;
echo ""

# 3. Vérifier les tables créées
echo "=== 3. TABLES CRÉÉES ==="
supabase db query --linked <<'SQL' 2>&1 || true
SELECT
    table_name
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
echo ""

echo -e "${GREEN}==============================================${NC}"
echo "Vérifiez que :"
echo "  - Les migrations 0036 à 0043 sont appliquées"
echo "  - Les fonctions RPC sont présentes"
echo "  - Les tables invitations, invitation_events existent"
echo ""
echo "Puis exécutez les tests E2E de création d'abonné."