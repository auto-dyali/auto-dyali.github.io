/**
 * GV5 §51 — Tests unitaires du CONTRAT UNIQUE d'onboarding (v2).
 *
 * Source unique : `supabase/functions/_shared/contract.ts`.
 * Le client ne fait que le ré-exporter (`src/lib/onboarding-contract.ts`).
 * Aucun réseau, aucune base : tests purs.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  ONBOARDING_CONTRACT_VERSION,
  validateOnboardingPayload,
  formatOnboardingError,
  paidDurationToMonths,
  trialDurationToDays,
  computeSubscriptionDates,
} from "../supabase/functions/_shared/contract.ts";
import * as clientContract from "../src/lib/onboarding-contract.ts";

const REQUEST_ID = "3f1c8d2a-9b4e-4c7a-8f2d-1a2b3c4d5e6f";

function payload(overrides = {}) {
  return {
    contractVersion: 2,
    requestId: REQUEST_ID,
    establishment: {
      name: "Garage Atlas",
      legalName: "Garage Atlas SARL",
      slug: "garage-atlas",
      activityType: "Mécanique générale",
      professionalId: "ADY-PRO-AB12CD",
      address: "12 Rue Mohammed V",
      city: "Casablanca",
      region: "Casablanca-Settat",
      phone: "+212522000000",
      email: "contact@garage-atlas.ma",
      notes: "",
    },
    manager: {
      fullName: "Youssef Alami",
      email: "y.alami@garage-atlas.ma",
      phone: "+212600000000",
      loginId: "y.alami",
      temporaryPassword: "TempPass123!",
      temporaryPasswordConfirm: "TempPass123!",
    },
    subscription: {
      plan: "silver",
      paidDuration: "1an",
      paidDurationMonths: 12,
      trialDuration: "15",
      trialDurationDays: 15,
      startDate: "2026-11-17",
    },
    modules: ["clients", "dashboard"],
    permissions: [
      { module: "dashboard", canView: true, canCreate: true, canEdit: true, canDelete: false },
      { module: "clients", canView: true, canCreate: true, canEdit: true, canDelete: false },
    ],
    delivery: { email: true, whatsapp: true },
    ...overrides,
  };
}

test("client et Edge Function partagent le MÊME contrat (aucune copie)", () => {
  assert.equal(clientContract.validateOnboardingPayload, validateOnboardingPayload);
  assert.equal(clientContract.ONBOARDING_CONTRACT_VERSION, ONBOARDING_CONTRACT_VERSION);
});

test("un payload v2 complet est valide et normalisé", () => {
  const result = validateOnboardingPayload(payload());
  assert.equal(result.valid, true, JSON.stringify(result.errors));
  assert.ok(result.normalized);
  assert.equal(result.normalized.contractVersion, 2);
  assert.equal(result.normalized.establishment.professionalId, "ADY-PRO-AB12CD");
  assert.equal(result.normalized.manager.loginId, "y.alami");
  assert.deepEqual(result.normalized.modules, ["clients", "dashboard"]);
  assert.equal(result.normalized.permissions.length, 2);
});

test("version de contrat incorrecte refusée", () => {
  const result = validateOnboardingPayload(payload({ contractVersion: 1 }));
  assert.equal(result.valid, false);
  assert.ok(result.errors.contractVersion);
});

test("request_id non UUID refusé", () => {
  const result = validateOnboardingPayload(payload({ requestId: "resend-1" }));
  assert.equal(result.valid, false);
  assert.ok(result.errors.requestId);
});

test("clé inconnue refusée (jamais ignorée silencieusement)", () => {
  const result = validateOnboardingPayload(payload({ manager_password: "secret" }));
  assert.equal(result.valid, false);
  assert.ok(result.errors["_unknown.manager_password"]);
});

test("champ manager ignoré auparavant est maintenant validé", () => {
  const p = payload();
  p.manager.loginId = "ab";
  const result = validateOnboardingPayload(p);
  assert.equal(result.valid, false);
  assert.ok(result.errors["manager.loginId"]);
});

test("identifiant professionnel invalide refusé", () => {
  const p = payload();
  p.establishment.professionalId = "a b";
  const result = validateOnboardingPayload(p);
  assert.ok(result.errors["establishment.professionalId"]);
});

test("mot de passe temporaire trop faible refusé", () => {
  const p = payload();
  p.manager.temporaryPassword = "abc";
  p.manager.temporaryPasswordConfirm = "abc";
  const result = validateOnboardingPayload(p);
  assert.ok(result.errors["manager.temporaryPassword"]);
});

test("confirmation de mot de passe différente refusée", () => {
  const p = payload();
  p.manager.temporaryPasswordConfirm = "AutrePass123!";
  const result = validateOnboardingPayload(p);
  assert.ok(result.errors["manager.temporaryPasswordConfirm"]);
});

test("aucun module sélectionné est refusé (évite un abonné sans droits)", () => {
  const p = payload();
  p.modules = [];
  p.permissions = [];
  const result = validateOnboardingPayload(p);
  assert.equal(result.valid, false);
  assert.ok(result.errors.modules);
});

test("modules sans permission associée refusés", () => {
  const p = payload();
  p.permissions = [{ module: "dashboard", canView: true, canCreate: false, canEdit: false, canDelete: false }];
  const result = validateOnboardingPayload(p);
  assert.equal(result.valid, false);
  assert.ok(result.errors.permissions);
});

test("permission sur un module non sélectionné refusée", () => {
  const p = payload();
  p.permissions.push({ module: "stock", canView: true, canCreate: false, canEdit: false, canDelete: false });
  const result = validateOnboardingPayload(p);
  assert.equal(result.valid, false);
  assert.ok(result.errors.permissions);
});

test("permission vide (aucune action) refusée", () => {
  const p = payload();
  p.permissions[0] = { module: "dashboard", canView: false, canCreate: false, canEdit: false, canDelete: false };
  const result = validateOnboardingPayload(p);
  assert.equal(result.valid, false);
});

test("au moins un canal de transmission requis", () => {
  const p = payload();
  p.delivery = { email: false, whatsapp: false };
  const result = validateOnboardingPayload(p);
  assert.ok(result.errors.delivery);
});

test("WhatsApp sans numéro refusé", () => {
  const p = payload();
  p.manager.phone = "";
  const result = validateOnboardingPayload(p);
  assert.ok(result.errors["manager.phone"]);
});

test("durée payante personnalisée hors bornes refusée", () => {
  const p = payload();
  p.subscription.paidDuration = "personnalisee";
  p.subscription.paidDurationMonths = 130;
  const result = validateOnboardingPayload(p);
  assert.ok(result.errors["subscription.paidDurationMonths"]);
});

test("essai de 365 jours accepté, 366 refusé", () => {
  const ok = payload();
  ok.subscription.trialDuration = "personnalisee";
  ok.subscription.trialDurationDays = 365;
  assert.equal(validateOnboardingPayload(ok).valid, true);
  const ko = payload();
  ko.subscription.trialDuration = "personnalisee";
  ko.subscription.trialDurationDays = 366;
  assert.equal(validateOnboardingPayload(ko).valid, false);
});

test("dates de période calculées (mois et essai)", () => {
  assert.equal(paidDurationToMonths("2ans", 24), 24);
  assert.equal(paidDurationToMonths("personnalisee", 7), 7);
  assert.equal(trialDurationToDays("aucun", 0), 0);
  assert.equal(trialDurationToDays("personnalisee", 45), 45);
  const dates = computeSubscriptionDates("2026-01-31", 1, 15);
  assert.equal(dates.paidEndDate, "2026-02-28");
  assert.equal(dates.trialEndDate, "2026-02-15");
});

test("formatOnboardingError expose les erreurs de champ", () => {
  const message = formatOnboardingError({
    error: "Données invalides.",
    fields: { "manager.loginId": "déjà utilisé" },
  });
  assert.match(message, /Données invalides/);
  assert.match(message, /manager.loginId/);
});

test("aucun secret n'est présent dans le message d'erreur formaté", () => {
  const message = formatOnboardingError({ error: "Échec" });
  assert.equal(/TempPass123/.test(message), false);
});
