/**
 * GV5 §51 — Tests STATIQUES des Edge Functions (aucun déploiement, aucun réseau).
 *
 * Ils verrouillent les garanties de sécurité du parcours :
 *   - pas de second `signUp` à l'activation ;
 *   - mot de passe défini par `auth.admin.updateUserById` uniquement ;
 *   - contrat partagé importé, jamais dupliqué ;
 *   - jeton d'invitation haché avant stockage ;
 *   - canaux de transmission indépendants et statuts réels ;
 *   - relance idempotente par `requestId`.
 *
 * Ces tests ne remplacent PAS une exécution Supabase réelle : ils empêchent
 * seulement la réapparition des défauts constatés au §50.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const functions = join(here, "..", "supabase", "functions");

function read(rel) {
  return readFileSync(join(functions, rel), "utf8");
}

const onboard = read("onboard-tenant/index.ts");
const activate = read("activate-manager/index.ts");
const resend = read("send-invitation/index.ts");
const contract = read("_shared/contract.ts");
const providers = read("_shared/providers.ts");

test("onboard-tenant utilise le contrat partagé, pas une copie", () => {
  assert.match(onboard, /from "\.\.\/_shared\/contract\.ts"/);
  assert.match(onboard, /validateOnboardingPayload/);
  assert.equal(/const CONTRACT_TOP_LEVEL_KEYS/.test(onboard), false);
});

test("aucune Edge Function ne contient de clé service_role en dur", () => {
  for (const source of [onboard, activate, resend]) {
    assert.equal(/eyJ[A-Za-z0-9_-]{20,}\./.test(source), false);
    assert.match(source, /(Deno\.env\.get|env)\("SUPABASE_SERVICE_ROLE_KEY"\)/);
  }
});

test("onboard-tenant crée le compte Auth côté serveur et compense en cas d'échec", () => {
  assert.match(onboard, /auth\.admin\.createUser/);
  assert.match(onboard, /auth\.admin\.deleteUser/);
  assert.match(onboard, /password:\s*payload\.manager\.temporaryPassword/);
  assert.equal(/console\.(log|info|debug)/.test(onboard), false);
});

test("onboard-tenant appelle la RPC v2 avec les permissions réelles", () => {
  assert.match(onboard, /admin_onboard_tenant_v2/);
  assert.match(onboard, /p_permissions/);
  assert.match(onboard, /p_invitation_token_hash/);
  assert.match(onboard, /admin_check_identity_available/);
});

test("le jeton brut n'est jamais stocké : hachage avant la RPC", () => {
  for (const source of [onboard, resend]) {
    assert.match(source, /generateInvitationToken\(\)/);
    assert.match(source, /sha256Hex\(token\)/);
    assert.match(source, /tokenHash/);
    assert.equal(/p_token:\s*token\b/.test(source), false);
  }
  assert.match(contract, /permissions/);
  assert.match(providers, /sha256/);
});

test("activation : aucun second signUp, mot de passe défini par Auth Admin", () => {
  assert.equal(/auth\.signUp\s*\(/.test(activate), false);
  assert.equal(/\.signUp\s*\(/.test(activate), false);
  assert.match(activate, /auth\.admin\.updateUserById/);
  assert.match(activate, /admin_accept_invitation/);
});

test("activation : la prévisualisation ne consomme pas le jeton", () => {
  assert.match(activate, /action === "preview"/);
  const previewBlock = activate.slice(
    activate.indexOf('if (action === "preview")'),
    activate.indexOf("/* ---------- 2. Activation réelle"),
  );
  assert.match(previewBlock, /admin_invitation_preview/);
  assert.equal(/admin_accept_invitation/.test(previewBlock), false);
  assert.equal(/updateUserById/.test(previewBlock), false);
});

test("activation : la connexion est réellement vérifiée après activation", () => {
  assert.match(activate, /signInWithPassword/);
  assert.match(activate, /signOut/);
});

test("activation : expiration et usage unique refusés explicitement", () => {
  assert.match(activate, /status === "accepted"/);
  assert.match(activate, /expires_at\)\.getTime\(\) < Date\.now\(\)/);
});

test("relance : idempotente par requestId et par canal", () => {
  assert.match(resend, /last_request_id/);
  assert.match(resend, /admin_prepare_resend/);
  assert.match(resend, /channels/);
  assert.match(resend, /idempotent:\s*true/);
});

test("transmission : chaque canal est enregistré séparément", () => {
  for (const source of [onboard, resend]) {
    assert.match(source, /admin_record_delivery/);
    assert.match(source, /for \(const r of results\)/);
  }
  assert.match(providers, /non_configure/);
  assert.match(providers, /accepte_par_fournisseur/);
});

test("aucun composant client n'appelle service_role ni ne journalise un mot de passe", () => {
  const page = readFileSync(
    join(here, "..", "src", "app", "super-admin", "onboarding", "page.tsx"),
    "utf8",
  );
  assert.equal(/SERVICE_ROLE/.test(page), false);
  assert.equal(/console\.(log|info|debug)\([^)]*temporaryPassword/.test(page), false);
  assert.match(page, /supabase\.functions\.invoke\("onboard-tenant"/);
});

test("le dossier abonné affiche les identités professionnelle et Manager", () => {
  const page = readFileSync(
    join(here, "..", "src", "app", "super-admin", "entreprises", "page.tsx"),
    "utf8",
  );
  assert.match(page, /professional_id/);
  assert.match(page, /login_id/);
  assert.match(page, /managerOf/);
  assert.match(page, /select\("\*, subscriptions/);
  assert.match(page, /Repli si l'embed `profiles` est refusé/);
});
