/**
 * GV5 §103 — Vérification de reconstruction sur base vierge (sans Postgres local).
 *
 * L'environnement de travail n'a ni Docker ni binaire Postgres : il est donc
 * IMPOSSIBLE ici d'exécuter réellement `supabase db reset` sur une base locale.
 * Ce script rejoue les fichiers de supabase/migrations/ dans l'ordre, sur un
 * petit modèle de schéma, et vérifie que l'état FINAL contient :
 *   - invitation_events.provider_error ;
 *   - la policy SELECT profiles.saas_admin_select_profiles réservée au SA.
 *
 * Ce n'est PAS une exécution SQL : c'est une preuve de présence/ordre/
 * idempotence des migrations. La preuve d'exécution réelle sur staging est
 * apportée par scripts/verify-staging-migrations.sh (db query --read-only).
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const dir = "supabase/migrations";
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

function clean(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*--.*$/gm, "")
    .trim();
}

const model = { tables: new Set(), columns: new Set(), policies: new Map() };

for (const file of files) {
  const statements = clean(readFileSync(join(dir, file), "utf8"))
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);

  for (const st of statements) {
    let m = st.match(/^create\s+table\s+(?:if\s+not\s+exists\s+)?public\.(\w+)\s*\(([\s\S]*)\)$/i);
    if (m) {
      model.tables.add(m[1]);
      for (const line of m[2].split(",")) {
        const col = line.trim().match(/^([a-z_]\w*)\s+(text|uuid|timestamptz|timestamp|numeric|integer|boolean|jsonb|bigint|date)\b/i);
        if (col) model.columns.add(`${m[1]}.${col[1]}`);
      }
      continue;
    }
    m = st.match(/^alter\s+table\s+(?:only\s+)?public\.(\w+)[\s\S]*?add\s+column\s+(?:if\s+not\s+exists\s+)?(\w+)/i);
    if (m) {
      model.columns.add(`${m[1]}.${m[2]}`);
      continue;
    }
    m = st.match(/^drop\s+policy\s+if\s+exists\s+(\w+)\s+on\s+public\.(\w+)/i);
    if (m) {
      model.policies.delete(`${m[2]}.${m[1]}`);
      continue;
    }
    m = st.match(/^create\s+policy\s+(\w+)\s+on\s+public\.(\w+)([\s\S]*)$/i);
    if (m) {
      const [, name, table, reste] = m;
      model.policies.set(`${table}.${name}`, reste.replace(/\s+/g, " ").trim());
    }
  }
}

const provider = "20261124130000_add_invitation_events_provider_error.sql";
const policy = "20261124130100_saas_admin_select_profiles.sql";

assert.ok(files.includes(provider), `${provider} absent`);
assert.ok(files.includes(policy), `${policy} absent`);
assert.match(provider, /^\d{14}_/, "horodatage de migration attendu");
assert.match(policy, /^\d{14}_/, "horodatage de migration attendu");

const sqlProvider = readFileSync(join(dir, provider), "utf8");
const sqlPolicy = readFileSync(join(dir, policy), "utf8");
assert.match(sqlProvider, /add\s+column\s+if\s+not\s+exists/i, "provider_error doit être idempotent");
assert.match(sqlPolicy, /drop\s+policy\s+if\s+exists/i, "la policy doit être idempotente");
assert.match(sqlPolicy, /for\s+select\s+to\s+authenticated/i, "SELECT uniquement, rôle authenticated");
assert.match(sqlPolicy, /using\s*\(\s*public\.is_saas_admin\(\)\s*\)/i, "garde côté base obligatoire");
assert.doesNotMatch(sqlPolicy, /with\s+check/i, "aucune policy WITH CHECK (écriture) autorisée");

assert.ok(model.columns.has("invitation_events.provider_error"), "provider_error absent de l'état reconstruit");
const rebuilt = model.policies.get("profiles.saas_admin_select_profiles");
assert.ok(rebuilt, "policy saas_admin_select_profiles absente de l'état reconstruit");
assert.match(rebuilt, /public\.is_saas_admin\(\)/i, "la policy reconstruite doit utiliser is_saas_admin()");

console.log(`Migrations lues : ${files.length}`);
console.log("✅ invitation_events.provider_error présent dans l'état reconstruit");
console.log("✅ profiles.saas_admin_select_profiles (SELECT, authenticated, is_saas_admin()) présent");
console.log("✅ les deux migrations sont horodatées et idempotentes");
console.log("NOTE : reconstruction statique — aucun Postgres local disponible (Docker absent).");
