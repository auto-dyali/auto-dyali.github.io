/**
 * GV5 — Tests ciblés de la migration additive des notifications Super Admin.
 * Contrôles statiques : structure, RLS, idempotence, statuts honnêtes, rollback.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const migration = read("supabase/migrations/20261126000000_super_admin_notifications.sql");
const rollback = read("supabase/rollbacks/gv5108/20261126000000.sql");
const onboard = read("supabase/functions/onboard-tenant/index.ts");
const providers = read("supabase/functions/_shared/providers.ts");
const constants = read("supabase/functions/_shared/constants.ts");

test("table additive, aucun objet existant modifié", () => {
  assert.match(migration, /create table if not exists public\.super_admin_notifications/);
  for (const champ of [
    "id", "source_request_id", "title", "body", "payload", "created_at",
    "read_at", "inapp_status", "email_status", "whatsapp_status",
  ]) assert.ok(migration.includes(champ), `champ ${champ}`);
  assert.doesNotMatch(migration, /alter table public\.(profiles|establishments|invitations)/);
  assert.doesNotMatch(migration, /drop table/);
});

test("RLS réservée au Super Admin, aucun accès Manager/anon", () => {
  assert.match(migration, /enable row level security/);
  assert.match(migration, /for select to authenticated[\s\S]*?public\.is_saas_admin\(\)/);
  assert.match(migration, /for update to authenticated[\s\S]*?public\.is_saas_admin\(\)/);
  assert.doesNotMatch(migration, /for insert/);
  assert.match(migration, /revoke all on table public\.super_admin_notifications from public, anon, authenticated/);
  assert.match(migration, /grant select, update on table public\.super_admin_notifications to authenticated/);
});

test("RPC service_role, validation et idempotence", () => {
  assert.match(migration, /function public\.admin_notify_new_subscriber\(p_payload jsonb\)/);
  assert.match(migration, /security definer/);
  assert.match(migration, /auth\.role\(\)[^\n]*service_role/);
  assert.match(migration, /source_request_id invalide/);
  assert.match(migration, /create unique index if not exists super_admin_notifications_source_request_id_key/);
  assert.match(migration, /on conflict \(source_request_id\) do update/);
  assert.match(migration, /xmax = 0/);
  assert.match(migration, /grant execute on function public\.admin_notify_new_subscriber\(jsonb\) to service_role/);
  assert.match(migration, /revoke all on function public\.admin_notify_new_subscriber\(jsonb\) from public, anon, authenticated/);
});

test("statuts honnêtes : jamais de livraison déclarée", () => {
  assert.match(migration, /email_status[^\n]*non_configure/);
  assert.match(migration, /whatsapp_status[^\n]*non_configure/);
  assert.doesNotMatch(migration, /'livre'|'livré'|'delivered'/);
  assert.match(migration, /Statut de canal invalide/);
  assert.match(providers, /status: "accepte_par_fournisseur"/);
  assert.match(providers, /HTTP 2xx/);
});

test("notification non bloquante pour la création", () => {
  assert.match(onboard, /admin\.rpc\("admin_notify_new_subscriber"/);
  assert.match(onboard, /status: "indisponible"/);
  assert.match(onboard, /super_admin_notification/);
  assert.match(onboard, /catch \(erreur\)/);
  assert.match(onboard, /sendAdminNotificationEmail/);
});

test("logo officiel, e-mail Super Admin et formule française", () => {
  assert.match(constants, /SUPER_ADMIN_EMAIL = "admin@auto-dyali\.ma"/);
  assert.match(constants, /LOGO_URL = "https:\/\/auto-dyali\.github\.io\/images\/branding\/logo\.webp"/);
  assert.match(providers, /<img src="\$\{LOGO_URL\}"/);
  /* Correction obligatoire : le message s'adresse au Super Admin. */
  assert.match(providers, /Bonjour Super Admin,/);
  assert.doesNotMatch(providers, /Bonjour \$\{input\.managerFullName\},/);
  assert.match(providers, /sendAdminWhatsAppNotification/);
  assert.match(onboard, /WHATSAPP_ADMIN_TEMPLATE_NAME/);
  assert.match(onboard, /SUPER_ADMIN_WHATSAPP/);
  const ui = read("src/components/super-admin-notifications.tsx");
  const tableau = read("src/app/super-admin/page.tsx");
  assert.match(tableau, /<SuperAdminNotifications \/>/);
  assert.match(ui, /super_admin_notifications/);
  assert.match(ui, /Debout|Super Admin|notifications/);
  assert.match(providers, /establishmentName/);
  assert.match(providers, /createdAt/);
  assert.match(providers, /resultat/);
});

test("rollback limité aux objets créés", () => {
  assert.match(rollback, /drop function if exists public\.admin_notify_new_subscriber/);
  assert.match(rollback, /drop policy if exists super_admin_notifications_sa_/);
  assert.match(rollback, /drop table if exists public\.super_admin_notifications/);
  assert.doesNotMatch(rollback, /drop table public\.(profiles|establishments|invitations)/);
});
