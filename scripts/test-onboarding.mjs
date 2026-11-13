/**
 * Tests unitaires de la validation d'onboarding entreprise + Manager.
 * Exécution : node --test scripts/test-onboarding.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  slugify,
  isValidEmail,
  isValidSlug,
  validateOnboardingInput,
  isOnboardingValid,
  buildRequestId,
  PLANS,
} from "../src/lib/onboarding.ts";

const base = {
  companyName: "Garage Atlas",
  slug: "garage-atlas",
  city: "Casablanca",
  phone: "0522000000",
  email: "contact@garage-atlas.ma",
  plan: "silver",
  managerName: "Youssef Alami",
  managerEmail: "y.alami@garage-atlas.ma",
  managerPhone: "0600000000",
  trialDays: 14,
};

test("slugify normalise accents, espaces et majuscules", () => {
  assert.equal(slugify("Garage Étoile du Nord"), "garage-etoile-du-nord");
  assert.equal(slugify("  Auto  Plus  "), "auto-plus");
  assert.equal(slugify("A/B -- C"), "a-b-c");
});

test("isValidEmail accepte les emails valides et rejette les invalides", () => {
  assert.equal(isValidEmail("a@b.ma"), true);
  assert.equal(isValidEmail("a@b"), false);
  assert.equal(isValidEmail(""), false);
  assert.equal(isValidEmail("a b@c.ma"), false);
});

test("isValidSlug n'accepte que minuscules/chiffres/tirets", () => {
  assert.equal(isValidSlug("garage-atlas"), true);
  assert.equal(isValidSlug("Garage-Atlas"), false);
  assert.equal(isValidSlug("garage_atlas"), false);
  assert.equal(isValidSlug("-garage"), false);
});

test("un onboarding complet et valide ne produit aucune erreur", () => {
  assert.deepEqual(validateOnboardingInput(base), {});
  assert.equal(isOnboardingValid(base), true);
});

test("les champs obligatoires manquants sont signalés", () => {
  const errors = validateOnboardingInput({
    ...base,
    companyName: "   ",
    managerName: "",
    managerEmail: "",
  });
  assert.ok(errors.companyName);
  assert.ok(errors.managerName);
  assert.ok(errors.managerEmail);
});

test("un email Manager invalide est rejeté", () => {
  const errors = validateOnboardingInput({ ...base, managerEmail: "pas-un-email" });
  assert.ok(errors.managerEmail);
  assert.equal(isOnboardingValid({ ...base, managerEmail: "pas-un-email" }), false);
});

test("un forfait inconnu est rejeté", () => {
  const errors = validateOnboardingInput({ ...base, plan: "platinum" });
  assert.ok(errors.plan);
});

test("une durée d'essai hors bornes est rejetée", () => {
  assert.ok(validateOnboardingInput({ ...base, trialDays: -1 }).trialDays);
  assert.ok(validateOnboardingInput({ ...base, trialDays: 91 }).trialDays);
  assert.equal(validateOnboardingInput({ ...base, trialDays: 0 }).trialDays, undefined);
  assert.equal(validateOnboardingInput({ ...base, trialDays: 90 }).trialDays, undefined);
});

test("buildRequestId génère des identifiants uniques au format UUID", () => {
  const a = buildRequestId();
  const b = buildRequestId();
  assert.match(a, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  assert.match(b, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  assert.notEqual(a, b);
});

// Test de regression : verifier que l'adresse email .ma est syntaxiquement valide
test("adresse email .ma est valide selon le validateur frontend", () => {
  assert.equal(isValidEmail("a.naji@auto-dyali.ma"), true);
  assert.equal(isValidEmail("r.bami@auto-dyali.ma"), true);
});

test("slug est genere correctement depuis le nom d'entreprise", () => {
  assert.equal(slugify("Garage Naji"), "garage-naji");
  assert.equal(slugify("Garage Bami"), "garage-bami");
});

test("forfaits valides sont standard, silver, gold", () => {
  assert.equal(PLANS.includes("standard"), true);
  assert.equal(PLANS.includes("silver"), true);
  assert.equal(PLANS.includes("gold"), true);
});
