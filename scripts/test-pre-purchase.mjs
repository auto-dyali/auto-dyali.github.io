import test from "node:test";
import assert from "node:assert/strict";
import {
  isPrePurchaseValid,
  isValidPhoneMA,
  normalizeEmail,
  prePurchaseDedupKey,
  validatePrePurchaseInput,
  formatMontantMAD,
} from "../src/lib/pre-purchase.ts";

const base = {
  companyName: "Garage Atlas",
  legalName: "Garage Atlas SARL",
  professionalId: "RC12345",
  sector: "Automobile",
  businessType: "Garage mécanique générale",
  address: "12 Rue Mohammed V",
  city: "Casablanca",
  phone: "+212612345678",
  email: "contact@garage-atlas.ma",
  managerName: "Ahmed Naji",
  plan: "standard",
  desiredUsers: 3,
  desiredSites: 1,
  desiredModules: ["Atelier"],
  period: "mensuel",
  acceptTerms: true,
  acceptPrivacy: true,
};

test("pré-achat: formulaire valide de base", () => {
  assert.equal(isPrePurchaseValid(base), true);
  assert.deepEqual(validatePrePurchaseInput(base), {});
});

test("pré-achat: email invalide rejeté", () => {
  const errs = validatePrePurchaseInput({ ...base, email: "invalide" });
  assert.ok(errs.email);
});

test("pré-achat: téléphone Maroc invalide rejeté", () => {
  const errs = validatePrePurchaseInput({ ...base, phone: "12345" });
  assert.ok(errs.phone);
  assert.equal(isValidPhoneMA("+212612345678"), true);
  assert.equal(isValidPhoneMA("0612345678"), true);
});

test("pré-achat: consentements obligatoires", () => {
  const errs = validatePrePurchaseInput({ ...base, acceptTerms: false, acceptPrivacy: false });
  assert.ok(errs.acceptTerms);
  assert.ok(errs.acceptPrivacy);
});

test("pré-achat: forfait/période invalides rejetés", () => {
  const errs = validatePrePurchaseInput({ ...base, plan: "platinum", period: "hebdo" });
  assert.ok(errs.plan);
  assert.ok(errs.period);
});

test("pré-achat: limites utilisateurs/établissements", () => {
  const errs = validatePrePurchaseInput({ ...base, desiredUsers: 0, desiredSites: 0 });
  assert.ok(errs.desiredUsers);
  assert.ok(errs.desiredSites);
});

test("pré-achat: normalisation email et clé de déduplication", () => {
  assert.equal(normalizeEmail("  Contact@Garage.MA  "), "contact@garage.ma");
  assert.equal(prePurchaseDedupKey("A@B.com", "Garage X"), prePurchaseDedupKey("a@b.com", "garage x"));
});

test("pré-achat: formatMontantMAD sans prix inventé", () => {
  assert.equal(formatMontantMAD(null), "Non configuré");
  assert.equal(formatMontantMAD(undefined), "Non configuré");
  const txt = formatMontantMAD(199);
  assert.ok(txt.includes("199"));
});
