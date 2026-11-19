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
  isValidRequestId,
  validateOnboardingInput,
  isOnboardingValid,
  buildRequestId,
  genererIdentifiantProfessionnel,
  PLANS,
} from "../src/lib/onboarding.ts";

const base = {
  companyName: "Garage Atlas",
  slug: "garage-atlas",
  city: "Casablanca",
  phone: "0522000000",
  email: "contact@garage-atlas.ma",
  plan: "silver",
  abonnementDuree: "1an",
  abonnementDureePersonnalisee: 12,
  essaiDuree: "15",
  essaiDureePersonnalisee: 15,
  managerName: "Youssef Alami",
  managerEmail: "y.alami@garage-atlas.ma",
  managerPhone: "0600000000",
  managerLoginId: "y.alami",
  managerPassword: "MonPass123!",
  managerPasswordConfirm: "MonPass123!",
  legalName: "Garage Atlas SARL",
  activityType: "Garage mécanique générale",
  professionalId: "RC123456",
  address: "12 Rue Mohammed V",
  region: "Casablanca-Settat",
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
  assert.ok(validateOnboardingInput({ ...base, essaiDuree: "personnalisee", essaiDureePersonnalisee: -1 }).essaiDureePersonnalisee);
  assert.ok(validateOnboardingInput({ ...base, essaiDuree: "personnalisee", essaiDureePersonnalisee: 366 }).essaiDureePersonnalisee);
  assert.equal(validateOnboardingInput({ ...base, essaiDuree: "15" }).essaiDureePersonnalisee, undefined);
  assert.equal(validateOnboardingInput({ ...base, essaiDuree: "60" }).essaiDureePersonnalisee, undefined);
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

test("isValidRequestId valide un UUID v4 et rejette les formats invalides", () => {
  const id = buildRequestId();
  assert.equal(isValidRequestId(id), true);
  assert.equal(isValidRequestId("not-a-uuid"), false);
  assert.equal(isValidRequestId(""), false);
  assert.equal(isValidRequestId("11111111-1111-1111-1111-111111111111"), false);
});

test("un email d'entreprise invalide est signalé quand renseigné", () => {
  const errors = validateOnboardingInput({ ...base, email: "contact@garage" });
  assert.ok(errors.email);
});

test("un email d'entreprise vide est accepté (champ optionnel)", () => {
  const errors = validateOnboardingInput({ ...base, email: "" });
  assert.equal(errors.email, undefined);
});

test("une durée d'essai non finie est rejetée", () => {
  const errors = validateOnboardingInput({ ...base, essaiDuree: "personnalisee", essaiDureePersonnalisee: Number.NaN });
  assert.ok(errors.essaiDureePersonnalisee);
});

test("le slug est trimé avant validation", () => {
  const errors = validateOnboardingInput({ ...base, slug: "  garage-atlas  " });
  assert.equal(errors.slug, undefined);
});

test("identifiant de connexion Manager obligatoire", () => {
  const errors = validateOnboardingInput({ ...base, managerLoginId: "" });
  assert.ok(errors.managerLoginId);
});

test("identifiant de connexion trop court est rejeté", () => {
  const errors = validateOnboardingInput({ ...base, managerLoginId: "ab" });
  assert.ok(errors.managerLoginId);
});

test("identifiant de connexion avec caractères invalides est rejeté", () => {
  const errors = validateOnboardingInput({ ...base, managerLoginId: "USER@NAME" });
  assert.ok(errors.managerLoginId);
});

test("identifiant de connexion valide est accepté", () => {
  const errors = validateOnboardingInput({ ...base, managerLoginId: "y.alami" });
  assert.equal(errors.managerLoginId, undefined);
});

test("mot de passe initial obligatoire", () => {
  const errors = validateOnboardingInput({ ...base, managerPassword: "" });
  assert.ok(errors.managerPassword);
});

test("mot de passe trop court est rejeté", () => {
  const errors = validateOnboardingInput({ ...base, managerPassword: "abc" });
  assert.ok(errors.managerPassword);
});

test("mot de passe valide est accepté", () => {
  const errors = validateOnboardingInput({ ...base, managerPassword: "MonPass123!" });
  assert.equal(errors.managerPassword, undefined);
});

test("confirmation de mot de passe obligatoire", () => {
  const errors = validateOnboardingInput({ ...base, managerPassword: "MonPass123!", managerPasswordConfirm: "" });
  assert.ok(errors.managerPasswordConfirm);
});

test("confirmation de mot de passe non correspondante est rejetée", () => {
  const errors = validateOnboardingInput({ ...base, managerPassword: "MonPass123!", managerPasswordConfirm: "AutrePass123!" });
  assert.ok(errors.managerPasswordConfirm);
});

test("mot de passe et confirmation identiques sont acceptés", () => {
  const errors = validateOnboardingInput({ ...base, managerPassword: "MonPass123!", managerPasswordConfirm: "MonPass123!" });
  assert.equal(errors.managerPassword, undefined);
  assert.equal(errors.managerPasswordConfirm, undefined);
});

test("genererIdentifiantProfessionnel génère un identifiant au format ADY-PRO-XXXXXX", () => {
  const id1 = genererIdentifiantProfessionnel();
  const id2 = genererIdentifiantProfessionnel();
  assert.match(id1, /^ADY-PRO-[0-9A-F]{6}$/);
  assert.match(id2, /^ADY-PRO-[0-9A-F]{6}$/);
  assert.notEqual(id1, id2);
});
