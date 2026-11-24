/**
 * GV5 §103 — Tests unitaires et statiques des deux corrections :
 *   1. renouvellement d'invitation révoquée par une NOUVELLE invitation ;
 *   2. distinction réseau / autorisation / session / serveur / métier.
 *
 * Aucun réseau, aucune écriture base : ces tests verrouillent le code.
 * Les preuves navigateur réelles sont dans docs/sessions/session-1/gv5-103/.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { classerErreur } from "../src/lib/supabase-errors.ts";

const migration = readFileSync("supabase/migrations/20261124131000_admin_create_invitation_renewal.sql", "utf8");
const ef = readFileSync("supabase/functions/send-invitation/index.ts", "utf8");
const fiche = readFileSync("src/components/abonne-workspace.tsx", "utf8");
const liste = readFileSync("src/components/super-admin-invitations-list.tsx", "utf8");
const guard = readFileSync("src/components/super-admin-guard.tsx", "utf8");

test("le RPC refuse de ressusciter une invitation révoquée", () => {
  assert.match(migration, /create or replace function public\.admin_create_invitation_renewal/);
  assert.match(migration, /if not public\.is_saas_admin\(\)/);
  assert.match(migration, /v_old\.status <> 'cancelled'/);
  assert.match(migration, /insert into public\.invitations/);
  assert.doesNotMatch(migration, /update public\.invitations\s+set[^;]*status\s*=\s*'prepared'\s+where id\s*=\s*v_old\.id/is);
  assert.match(migration, /jsonb_build_object\('request_id', p_request_id, 'from_invitation_id', v_old\.id\)/);
});

test("l'Edge Function crée une nouvelle invitation quand l'ancienne est annulée", () => {
  assert.match(ef, /invitation\.status === "cancelled"/);
  assert.doesNotMatch(ef, /if \(invitation\.status === "cancelled"\) return fail\(409/);
  assert.match(ef, /caller\.rpc\("admin_create_invitation_renewal"/);
  assert.match(ef, /p_old_invitation_id: invitation\.id/);
  assert.match(ef, /renewed_from: renewedFrom/);
  assert.match(ef, /p_invitation_id: activeInvitation\.id/);
});

test("l'UI propose le renouvellement au lieu d'un bouton désactivé", () => {
  assert.doesNotMatch(fiche, /disabled=\{envoiEnCours \|\| statut === "accepted" \|\| statut === "cancelled"\}/);
  assert.match(fiche, /disabled=\{envoiEnCours \|\| statut === "accepted"\}/);
  assert.match(fiche, /statut === "cancelled" \? "Renouveler"/);
  assert.doesNotMatch(liste, /inv\.status === "accepted" \|\| inv\.status === "cancelled"/);
  assert.match(liste, /Renouveler e-mail/);
});

test("classement : réseau / timeout", () => {
  for (const e of [
    { message: "TypeError: Failed to fetch" },
    { message: "fetch failed" },
    { message: "Request timeout" },
  ]) {
    assert.equal(classerErreur(e).famille, "reseau", JSON.stringify(e));
  }
  assert.match(classerErreur({ message: "Failed to fetch" }).message, /réseau/i);
});

test("classement : autorisation prioritaire sur réseau", () => {
  const c = classerErreur({ code: "P0001", message: "Accès refusé.", status: 400 });
  assert.equal(c.famille, "autorisation");
  assert.match(c.message, /refusé/i);
  assert.equal(classerErreur({ status: 403, message: "permission denied for table profiles" }).famille, "autorisation");
});

test("classement : session expirée et identifiants invalides", () => {
  assert.equal(classerErreur({ status: 401, message: "JWT expired" }).famille, "session");
  const m = classerErreur({ message: "Invalid login credentials", status: 400 });
  assert.equal(m.famille, "metier");
  assert.match(m.message, /incorrect/i);
});

test("classement : erreur serveur 5xx et erreur métier", () => {
  assert.equal(classerErreur({ status: 500, message: "internal server error" }).famille, "serveur");
  assert.equal(classerErreur({ code: "23505", message: "duplicate key" }).famille, "metier");
  assert.equal(classerErreur(null).famille, "inconnue");
});

test("le garde affiche des messages distincts et reste fail-closed", () => {
  assert.match(guard, /etat === "refuse"/);
  assert.match(guard, /etat === "session"/);
  assert.match(guard, /etat === "indisponible"/);
  assert.match(guard, /Vérification de session impossible/);
  assert.match(guard, /c\.famille === "autorisation"\s*\?\s*"refuse"/);
  assert.match(guard, /c\.famille === "reseau" \|\| c\.famille === "serveur"/);
  assert.match(guard, /Service momentanément indisponible/);
  assert.doesNotMatch(guard, /Accès refusé[^"]*réseau/i);
});
