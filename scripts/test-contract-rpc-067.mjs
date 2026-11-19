/**
 * GV5 §67 — Test de cohérence statique du contrat v2.
 * Vérifie que les paramètres envoyés par l EF onboard-tenant (toRpcArgs)
 * correspondent à la signature de admin_onboard_tenant_v2 (migration 0039),
 * et que les clés JSON imbriquées sont celles lues par la RPC.
 * AUCUN réseau. Test purement local de cohérence de code.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ef = readFileSync("supabase/functions/onboard-tenant/index.ts", "utf8");
const mig = readFileSync("supabase/migrations/0039_onboarding_identity_v2_prepared_NOT_APPLIED.sql", "utf8");

// Paramètres attendus de la RPC (signature dans 0039)
const rpcParams = [
  "p_request_id","p_establishment","p_manager","p_subscription",
  "p_modules","p_permissions","p_invitation_token_hash",
  "p_invitation_expires_at","p_delivery_channels",
];

test("toRpcArgs envoie exactement les 9 paramètres de la RPC v2", () => {
  const block = ef.slice(ef.indexOf("function toRpcArgs"), ef.indexOf("Deno.serve"));
  for (const param of rpcParams) {
    assert.ok(block.includes(param + ":"), `paramètre ${param} manquant dans toRpcArgs`);
  }
  // Aucun paramètre surnuméraire introduit par erreur
  const sent = [...block.matchAll(/\b(p_[a-z_]+)\s*:/g)].map(m => m[1]);
  for (const s of sent) assert.ok(rpcParams.includes(s), `paramètre inattendu ${s}`);
});

test("la signature de la RPC contient les 9 paramètres", () => {
  const start = mig.indexOf("function public.admin_onboard_tenant_v2(");
  const sig = mig.slice(start, mig.indexOf("returns jsonb", start));
  for (const param of rpcParams) assert.ok(sig.includes(param), `paramètre ${param} absent de la signature RPC`);
});

test("clés JSON imbriquées envoyées = clés lues par la RPC", () => {
  const keys = ["professional_id","slug","legal_name","activity_type","address","city","region","phone","email","notes",
                "user_id","full_name","login_id","plan","paid_months","trial_days","start_date"];
  const block = ef.slice(ef.indexOf("function toRpcArgs"), ef.indexOf("Deno.serve"));
  for (const k of keys) assert.ok(block.includes(k + ":"), `clé ${k} absente de toRpcArgs`);
  for (const k of keys) assert.ok(mig.includes(">>'" + k + "'"), `clé ${k} jamais lue par la RPC`);
});

test("permissions can_view/can_create/can_edit/can_delete cohérentes", () => {
  const block = ef.slice(ef.indexOf("function toRpcArgs"), ef.indexOf("Deno.serve"));
  for (const k of ["can_view","can_create","can_edit","can_delete"]) {
    assert.ok(block.includes(k + ":"), `permission ${k} absente`);
  }
  assert.ok(mig.includes("can_view") && mig.includes("can_create") && mig.includes("can_edit") && mig.includes("can_delete"));
});

test("contrat v2: aucun mot de passe transmis à la RPC", () => {
  const block = ef.slice(ef.indexOf("function toRpcArgs"), ef.indexOf("Deno.serve"));
  assert.ok(!block.includes("temporaryPassword"), " mot de passe temporaire ne doit jamais être envoyé à la RPC");
});
