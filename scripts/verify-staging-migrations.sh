#!/usr/bin/env bash
# =============================================================================
# AUTO DYALI — Vérification réelle de STAGING (lecture seule)
#
#   STAGING autorisé   : yocufscgninxiihwiepa
#   PRODUCTION interdit: nxmsqqoflskfajqrqddw
#
# Interroge PostgreSQL (pg_proc, information_schema, auth.identities) via
# `supabase db query --remote --read-only`. Ne se fie jamais au seul
# frontend ni à `functions list`. Sort en erreur (code 1) au premier écart.
#
# Usage : scripts/verify-staging-migrations.sh
# =============================================================================

set -euo pipefail

STAGING_REF="yocufscgninxiihwiepa"
PRODUCTION_REF="nxmsqqoflskfajqrqddw"
PROJECT_REF="${PROJECT_REF:-$STAGING_REF}"
SQL_FILE="scripts/verify-staging-migrations.sql"

RED='\033[0;31m'; GREEN='\033[0;32m'; BOLD='\033[1m'; NC='\033[0m'
die() { echo -e "${RED}ARRÊT : $*${NC}" >&2; exit 1; }

[ "$PROJECT_REF" = "$PRODUCTION_REF" ] && die "PRODUCTION interdite."
[ "$PROJECT_REF" = "$STAGING_REF" ] || die "Référence non autorisée : $PROJECT_REF"
[ -f "$SQL_FILE" ] || die "Fichier SQL absent : $SQL_FILE"
command -v supabase >/dev/null 2>&1 || die "CLI Supabase introuvable."

echo -e "${BOLD}Vérification réelle — STAGING $STAGING_REF${NC}"

OUTPUT="$(supabase db query --remote="$PROJECT_REF" --read-only --file="$SQL_FILE" 2>&1)" \
  || { echo "$OUTPUT" | tail -20; die "La requête de vérification a échoué."; }

node -e '
const raw = process.argv[1];
const start = raw.indexOf("{");
if (start < 0) { console.error("Sortie non JSON :\n" + raw.slice(0, 500)); process.exit(2); }
const data = JSON.parse(raw.slice(start));
const rows = data.rows || [];
let echecs = 0;
for (const r of rows) {
  const ok = r.ok === true;
  if (!ok) echecs++;
  console.log(`${ok ? "  ✅" : "  ❌"} ${r.controle}${ok ? "" : " — " + r.detail}`);
}
console.log("");
if (echecs > 0) {
  console.log(`ÉCHEC : ${echecs} contrôle(s) en erreur sur ${rows.length}.`);
  process.exit(1);
}
console.log(`SUCCÈS : ${rows.length}/${rows.length} contrôles OK.`);
' "$OUTPUT"

echo
echo -e "${GREEN}STAGING conforme.${NC} Aucune écriture effectuée (lecture seule)."
