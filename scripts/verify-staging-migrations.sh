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

# 2. Vérifier les fonctions RPC
echo "=== 2. FONCTIONS RPC DISPONIBLES ==="
supabase functions list --linked 2>&1 | head -30 || true
echo ""

# 3. Vérifier les tables
echo "=== 3. TABLES CRÉÉES ==="
supabase db list --linked 2>&1 | head -40 || true
echo ""

echo ""
echo -e "${GREEN}==============================================${NC}"
echo "Vérifiez que :"
echo "  - Les migrations 0036 à 0043 sont appliquées"
echo "  - Les fonctions RPC sont présentes"
echo "  - Les tables invitations, invitation_events existent"
echo ""
echo "Puis exécutez les tests E2E de création d'abonné."