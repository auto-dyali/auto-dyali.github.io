/**
 * GV5 §51 — Tests STATIQUES des migrations préparées (aucune application).
 *
 * Ils ne remplacent pas une exécution Postgres : ils verrouillent les
 * garanties de sécurité et empêchent la réapparition des défauts constatés
 * au §50 (syntaxe cassée, jeton en clair, FORCE RLS, permissions vides).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const migrations = join(here, "..", "supabase", "migrations");

function read(name) {
  return readFileSync(join(migrations, name), "utf8");
}

const m0036 = read("0036_invitations_manager_prepared_NOT_APPLIED.sql");
const m0037 = read("0037_fix_security_p0_prepared_NOT_APPLIED.sql");
const m0038 = read("0038_security_rls_indexes_prepared_NOT_APPLIED.sql");
const m0039 = read("0039_onboarding_identity_v2_prepared_NOT_APPLIED.sql");

function assertDollarQuotesBalanced(sql, name) {
  const count = (sql.match(/\$\$/g) ?? []).length;
  assert.equal(count % 2, 0, `${name} : nombre de délimiteurs $$ impair (${count})`);
}

test("0036 : syntaxe délimitée (aucune ligne parasite)", () => {
  assertDollarQuotesBalanced(m0036, "0036");
  assert.equal(/SQL\s*["']\)/i.test(m0036), false);
  assert.equal(/"\s*\)\s*;?/.test(m0036.split("\n").slice(0, 5).join("\n")), false);
});

test("0036 : le jeton n'est stocké qu'en empreinte SHA-256", () => {
  assert.match(m0036, /token_hash\s+text not null unique/);
  assert.equal(/^\s*token\s+text/m.test(m0036), false, "aucune colonne token en clair");
  assert.match(m0036, /hash_invitation_token/);
  assert.match(m0036, /sha256/);
});

test("0036 : statuts indépendants par canal", () => {
  assert.match(m0036, /email_status/);
  assert.match(m0036, /whatsapp_status/);
  assert.match(m0036, /accepte_par_fournisseur/);
  assert.match(m0036, /non_configure/);
});

test("0036 : prévisualisation sans consommation + usage unique", () => {
  assert.match(m0036, /admin_invitation_preview/);
  assert.match(m0036, /Aucune consommation/);
  assert.match(m0036, /status = 'accepted'/);
  assert.match(m0036, /admin_accept_invitation/);
  assert.match(m0036, /expires_at < now\(\)/);
});

test("0036 : relance idempotente par request_id", () => {
  assert.match(m0036, /admin_prepare_resend/);
  assert.match(m0036, /last_request_id/);
  assert.match(m0036, /already/);
});

test("0036 : aucun EXECUTE PUBLIC injustifié", () => {
  const grants = m0036.match(/grant execute[^;]+;/gi) ?? [];
  for (const grant of grants) {
    assert.equal(/\bto\s+public\b/i.test(grant), false, grant);
  }
  assert.match(m0036, /grant execute on function public\.admin_invitation_preview\(text\) to anon, authenticated/);
});

test("0036 : aucun mot de passe en clair dans les invitations", () => {
  assert.equal(/password_hash/i.test(m0036), false);
  assert.equal(/password\s+text/i.test(m0036), false);
});

test("0037 : FORCE ROW LEVEL SECURITY retiré (casserait les RPC)", () => {
  const m0037Code = m0037
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");
  assert.equal(
    /alter\s+table[\s\S]{0,120}?force\s+row\s+level\s+security/i.test(m0037Code),
    false,
    "aucune instruction ALTER TABLE ... FORCE ROW LEVEL SECURITY",
  );
  assert.match(m0037, /NON ACTIVÉ/);
  assert.match(m0037, /revoke all on function public\.is_saas_admin\(\)/);
});

test("0037 : les 16 révocations sont conservées", () => {
  const revokes = m0037.match(/revoke all on function public\./g) ?? [];
  assert.ok(revokes.length >= 16, `révocations trouvées : ${revokes.length}`);
});

test("0038 : aucune désactivation de RLS", () => {
  assert.equal(/disable\s+row\s+level\s+security/i.test(m0038), false);
});

test("0039 : identités persistées et uniques", () => {
  assert.match(m0039, /professional_id/);
  assert.match(m0039, /establishments_professional_id_key/);
  assert.match(m0039, /profiles_login_id_key/);
  assert.match(m0039, /must_change_password/);
});

test("0039 : rotation de mot de passe appliquée par RLS restrictive", () => {
  assert.match(m0039, /create policy password_rotation_required/);
  assert.match(m0039, /as restrictive for all/);
  assert.match(m0039, /admin_complete_password_change/);
  assert.match(m0039, /<=\s*v_profile\.temporary_password_issued_at/);
});

test("0039 : permissions réellement écrites et appliquées", () => {
  assert.match(m0039, /insert into public\.permissions/);
  assert.match(m0039, /p_permissions/);
  assert.match(m0039, /jsonb_array_elements\(p_permissions\)/);
  assert.match(m0039, /my_permissions\(\)/);
  assert.match(m0039, /create or replace function public\.has_feature/);
});

test("0039 : onboarding v2 idempotent et sans second signUp", () => {
  assert.match(m0039, /admin_onboard_tenant_v2/);
  assert.match(m0039, /pg_advisory_xact_lock/);
  assert.match(m0039, /idempotent/);
});

test("0039 : résolution login → e-mail réservée aux comptes actifs", () => {
  assert.match(m0039, /resolve_login_email/);
  assert.match(m0039, /p\.is_active = true/);
  assert.match(m0039, /grant execute on function public\.resolve_login_email\(text\) to anon, authenticated/);
});

test("0039 : aucun EXECUTE PUBLIC sur les fonctions sensibles", () => {
  const grants = m0039.match(/grant execute[^;]+;/gi) ?? [];
  for (const grant of grants) {
    assert.equal(/\bto\s+public\b/i.test(grant), false, grant);
  }
});

test("aucune migration ne contient de secret fournisseur", () => {
  for (const sql of [m0036, m0037, m0038, m0039]) {
    assert.equal(/re_[A-Za-z0-9]{16,}/.test(sql), false);
    assert.equal(/WHATSAPP_ACCESS_TOKEN\s*=\s*\S+/.test(sql), false);
  }
});

test("0036/0039 équilibrent leurs blocs $$", () => {
  assertDollarQuotesBalanced(m0036, "0036");
  assertDollarQuotesBalanced(m0037, "0037");
  assertDollarQuotesBalanced(m0038, "0038");
  assertDollarQuotesBalanced(m0039, "0039");
});
