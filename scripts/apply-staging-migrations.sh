#!/usr/bin/env bash
# =============================================================================
# AUTO DYALI — Application contrôlée des correctifs sur STAGING
#
#   STAGING autorisé   : yocufscgninxiihwiepa
#   PRODUCTION interdit: nxmsqqoflskfajqrqddw
#
# Ce script ne fait JAMAIS `supabase db push` en écriture.
# Raison factuelle (vérifiée le 24/11/2026) :
#   `supabase db push --dry-run --remote=yocufscgninxiihwiepa` échoue avec
#   DbPushMissingLocalError : l'historique distant est horodaté
#   (20261118…) alors que les fichiers locaux sont préfixés 0001…0043.
#   Un push tenterait donc de rejouer tout le schéma. Interdit.
#
# Il applique uniquement le fichier de réconciliation idempotent :
#   supabase/reconciliations/20261124_reconcile_manager_onboarding.sql
#
# Usage :
#   scripts/apply-staging-migrations.sh            # contrôles + dry-run, 0 écriture
#   scripts/apply-staging-migrations.sh --apply    # applique après confirmation
# =============================================================================

set -euo pipefail

STAGING_REF="yocufscgninxiihwiepa"
PRODUCTION_REF="nxmsqqoflskfajqrqddw"
PROJECT_REF="${PROJECT_REF:-$STAGING_REF}"
RECONCILE_FILE="supabase/reconciliations/20261124_reconcile_manager_onboarding.sql"
VERIFY_SCRIPT="scripts/verify-staging-migrations.sh"

EXPECTED_MIGRATIONS=(
  "0036_invitations_manager_prepared_NOT_APPLIED.sql"
  "0037_fix_security_p0_prepared_NOT_APPLIED.sql"
  "0038_security_rls_indexes_prepared_NOT_APPLIED.sql"
  "0039_onboarding_identity_v2_prepared_NOT_APPLIED.sql"
  "0040_fix_admin_set_subscription_upsert.sql"
  "0041_add_updated_at_subscriptions.sql"
  "0042_rls_profiles_saas_admin_insert.sql"
  "0043_archive_purge_etablissements.sql"
)

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BOLD='\033[1m'; NC='\033[0m'
die() { echo -e "${RED}ARRÊT : $*${NC}" >&2; exit 1; }
ok()  { echo -e "  ${GREEN}✅${NC} $*"; }
warn(){ echo -e "  ${YELLOW}⚠️ ${NC} $*"; }

APPLY=0
for arg in "$@"; do
  case "$arg" in
    --apply) APPLY=1 ;;
    -h|--help)
      sed -n '2,26p' "$0" | sed 's/^# \{0,1\}//'
      exit 0 ;;
    *) die "Argument inconnu : $arg" ;;
  esac
done

echo -e "${BOLD}AUTO DYALI — Correctifs STAGING${NC}"
echo "  Cible demandée : $PROJECT_REF"
echo

# --- 1. Périmètre -----------------------------------------------------------
[ "$PROJECT_REF" = "$PRODUCTION_REF" ] && die "PRODUCTION ($PRODUCTION_REF) strictement interdite."
[ "$PROJECT_REF" = "$STAGING_REF" ] || die "Seule la référence STAGING $STAGING_REF est autorisée (reçu : $PROJECT_REF)."
ok "Référence = STAGING $STAGING_REF"

# --- 2. Dépôt / CLI / authentification --------------------------------------
[ -d "supabase/migrations" ] || die "Exécutez ce script depuis la racine du dépôt."
command -v supabase >/dev/null 2>&1 || die "CLI Supabase introuvable dans le PATH."
ok "CLI Supabase : $(supabase --version 2>/dev/null | head -1)"

PROJECTS_JSON="$(supabase projects list --output json 2>/dev/null)" || die "CLI non authentifié (supabase login)."
node -e '
const ref = process.argv[1];
const raw = process.argv[2];
const start = raw.indexOf("[");
const end = raw.lastIndexOf("]");
if (start < 0 || end < 0) process.exit(2);
const arr = JSON.parse(raw.slice(start, end + 1));
const p = arr.find((x) => x.ref === ref);
if (!p) process.exit(3);
if (p.name !== "auto-dyali-staging") process.exit(4);
' "$STAGING_REF" "$PROJECTS_JSON" || die "Projet $STAGING_REF absent ou non nommé auto-dyali-staging."
ok "Projet vérifié : auto-dyali-staging ($STAGING_REF)"

# --- 3. Fichiers locaux attendus -------------------------------------------
for m in "${EXPECTED_MIGRATIONS[@]}"; do
  [ -f "supabase/migrations/$m" ] || die "Migration attendue absente : $m"
done
ok "Migrations 0036→0043 présentes (${#EXPECTED_MIGRATIONS[@]} fichiers)"

[ -f "$RECONCILE_FILE" ] || die "Fichier de réconciliation absent : $RECONCILE_FILE"
ok "Réconciliation présente : $RECONCILE_FILE"

# --- 4. Historique distant : constat, pas de push ---------------------------
echo
echo -e "${BOLD}4. Contrôle de l'historique distant${NC}"
set +e
PUSH_DRY_RUN="$(supabase db push --dry-run --remote="$PROJECT_REF" 2>&1)"
PUSH_RC=$?
set -e
if [ $PUSH_RC -ne 0 ]; then
  if echo "$PUSH_DRY_RUN" | grep -q "DbPushMissingLocalError"; then
    warn "db push est INUTILISABLE : versions distantes absentes des fichiers locaux."
    warn "Aucun push ne sera tenté (il rejouerait 0001→0043)."
  else
    echo "$PUSH_DRY_RUN" | tail -20
    die "Le dry-run db push a échoué pour une autre raison."
  fi
else
  warn "Le dry-run db push a réussi. Vérifiez manuellement la liste avant tout push."
  echo "$PUSH_DRY_RUN" | tail -20
  die "Par sécurité, ce script refuse db push. Utilisez la réconciliation idempotente."
fi

# --- 5. Plan d'écriture -----------------------------------------------------
echo
echo -e "${BOLD}5. Plan d'application (une seule écriture)${NC}"
echo "  • Fichier : $RECONCILE_FILE"
echo "  • Effet   : CREATE OR REPLACE de fonctions + réparation d'identités e-mail."
echo "  • Aucune table supprimée, aucune donnée métier supprimée."
echo "  • Idempotent : peut être rejoué sans effet de bord."

if [ "$APPLY" -ne 1 ]; then
  echo
  echo -e "${GREEN}Aucune écriture effectuée (mode contrôle).${NC}"
  echo "Pour appliquer : $0 --apply"
  exit 0
fi

# --- 6. Confirmation explicite ---------------------------------------------
echo
read -r -p "Tapez exactement « STAGING-$PROJECT_REF » pour confirmer : " CONFIRM
[ "$CONFIRM" = "STAGING-$PROJECT_REF" ] || die "Confirmation incorrecte. Rien n'a été appliqué."

# --- 7. Validation syntaxique sans persistance ------------------------------
echo
echo -e "${BOLD}7. Validation SQL en transaction annulée${NC}"
TMP_SQL="$(mktemp)"
trap 'rm -f "$TMP_SQL"' EXIT
{ echo "begin;"; cat "$RECONCILE_FILE"; echo "rollback;"; } > "$TMP_SQL"
supabase db query --remote="$PROJECT_REF" --file="$TMP_SQL" --yes >/dev/null \
  || die "Le SQL est invalide : rien n'a été appliqué."
ok "SQL valide (rollback effectué)"

# --- 8. Application réelle --------------------------------------------------
echo
echo -e "${BOLD}8. Application sur STAGING${NC}"
supabase db query --remote="$PROJECT_REF" --file="$RECONCILE_FILE" --yes >/dev/null \
  || die "Échec de l'application."
ok "Réconciliation appliquée"

# --- 9. Vérification --------------------------------------------------------
echo
if [ -x "$VERIFY_SCRIPT" ] || [ -f "$VERIFY_SCRIPT" ]; then
  bash "$VERIFY_SCRIPT"
else
  warn "Script de vérification introuvable : $VERIFY_SCRIPT"
fi

echo
echo -e "${GREEN}Terminé.${NC} Aucune opération sur la production."
