#!/bin/bash
# ============================================================================
# SCRIPT D'APPLICATION DES MIGRATIONS SUPABASE STAGING
# AUTO DYALI - GV5 §98
#
# À EXÉCUTER UNIQUEMENT SUR VOTRE MAC AVEC LE CLI SUPABASE DÉJÀ AUTHENTIFIÉ
# NE JAMAIS UTILISER SUR PRODUCTION
# ============================================================================

set -euo pipefail

PROJECT_REF="yocufscgninxiihwiepa"
MIGRATIONS_DIR="supabase/migrations"

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# ============================================================================
# VÉRIFICATIONS PRÉLIMINAIRES
# ============================================================================

echo "=============================================="
echo "  APPLICATION DES MIGRATIONS SUPABASE STAGING"
echo "  Projet : $PROJECT_REF"
echo "  Mission : GV5 §98 - Création des abonnés"
echo "=============================================="

# Vérifier que nous sommes dans le bon répertoire
if [ ! -f "supabase/migrations/0036_invitations_manager_prepared_NOT_APPLIED.sql" ]; then
    echo -e "${RED}ERREUR : Vous devez exécuter ce script depuis la racine du dépôt AUTO DYALI${NC}"
    exit 1
fi

# Vérifier que le CLI Supabase est disponible
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}ERREUR : supabase CLI non trouvé dans le PATH${NC}"
    echo "Installez-le avec : npm install -g supabase@latest"
    exit 1
fi

echo "✅ CLI Supabase : $(supabase --version)"

# Vérifier l'authentification
echo -n "Vérification de l'authentification Supabase... "
if supabase projects list > /dev/null 2>&1; then
    echo "✅ Authentifié"
else
    echo -e "${RED}ERREUR : Non authentifié. Exécutez 'supabase login'${NC}"
    exit 1
fi

# Vérifier le projet cible
echo ""
echo "Vérification du projet staging..."
PROJECT_INFO=$(supabase projects list 2>&1)
if echo "$PROJECT_INFO" | grep -q "yocufscgninxiihwiepa"; then
    echo "✅ Projet staging 'yocufscgninxiihwiepa' trouvé"
else
    echo -e "${RED}ERREUR : Projet staging non trouvé. Vérifiez votre authentification.${NC}"
    echo "Projets trouvés :"
    echo "$PROJECT_INFO"
    exit 1
fi

# Vérifier les fichiers de migration
echo ""
echo "Vérification des fichiers de migration..."
MIGRATIONS=(
    "0036_invitations_manager_prepared_NOT_APPLIED.sql"
    "0037_fix_security_p0_prepared_NOT_APPLIED.sql"
    "0038_security_rls_indexes_prepared_NOT_APPLIED.sql"
    "0039_onboarding_identity_v2_prepared_NOT_APPLIED.sql"
    "0040_fix_admin_set_subscription_upsert.sql"
    "0041_add_updated_at_subscriptions.sql"
    "0042_rls_profiles_saas_admin_insert.sql"
    "0043_archive_purge_etablissements.sql"
)

for m in "${MIGRATIONS[@]}"; do
    if [ -f "supabase/migrations/$m" ]; then
        echo "  ✅ $m"
    else
        echo -e "${RED}ERREUR : Fichier $m introuvable${NC}"
        exit 1
    fi
done

echo ""
echo -e "${YELLOW}⚠️  ATTENTION : Vous allez appliquer 8 migrations sur STAGING${NC}"
echo "   Projet : yocufscgninxiihwiepa"
echo "   Ordre : 0036 → 0037 → 0038 → 0039 → 0040 → 0041 → 0042 → 0043"
echo ""
read -p "Confirmer l'application ? (oui/non) : " confirm
if [ "$confirm" != "oui" ]; then
    echo "Annulation."
    exit 0
fi

# Appliquer chaque migration
for migration in 0036 0037 0038 0039 0040 0041 0042 0043; do
    MIG_FILE="supabase/migrations/${migration}_*.sql"

    if ! ls $MIG_FILE > /dev/null 2>&1; then
        echo -e "${RED}ERREUR : Fichier $migration introuvable${NC}"
        exit 1
    fi

    echo ""
    echo "=============================================="
    echo "  Application de $migration"
    echo "=============================================="

    supabase db push --linked 2>&1 | while IFS= read -r line; do
        echo "  $line"
    done

    if [ ${PIPESTATUS[0]} -ne 0 ]; then
        echo -e "${RED}ERREUR : Échec de l'application de $migration${NC}"
        exit 1
    fi

    echo "  ✅ $migration appliquée avec succès"
done

echo ""
echo -e "${GREEN}==============================================${NC}"
echo -e "${GREEN}  TOUTES LES MIGRATIONS ONT ÉTÉ APPLIQUÉES${NC}"
echo -e "${GREEN}==============================================${NC}"

echo ""
echo "=== Vérification des RPC ==="
supabase functions list --linked 2>&1 | head -20 || true

echo ""
echo "Migration terminée avec succès."