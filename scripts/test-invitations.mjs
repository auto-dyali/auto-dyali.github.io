/**
 * AUTO DYALI — Tests unitaires : service d'invitations Manager (e-mail + WhatsApp)
 *
 * Ces tests sont purs (aucune dépendance Supabase, aucun appel réseau).
 * Ils valident la logique métier de validation, normalisation et construction
 * des messages d'invitation.
 *
 * Exécution : node scripts/test-invitations.mjs
 */

import assert from "node:assert/strict";
import {
  validateInvitationInput,
  normalizePhoneMA,
  isValidEmail,
  buildActivationUrl,
  buildEmailInvitationMessage,
  buildWhatsAppInvitationMessage,
} from "../src/lib/invitation.ts";

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`✔ ${name}`);
  } catch (err) {
    failed++;
    console.error(`✘ ${name}: ${err.message}`);
  }
}

// ------------------------------------------------------------------
// 1. validateInvitationInput
// ------------------------------------------------------------------
test("validation : champs valides ne produisent aucune erreur", () => {
  const errors = validateInvitationInput({
    establishmentId: "11111111-1111-1111-1111-111111111111",
    managerFullName: "Youssef Alami",
    managerEmail: "y.alami@garage-atlas.ma",
    planCode: "silver",
    trialDays: 14,
  });
  assert.deepStrictEqual(errors, {});
});

test("validation : establishmentId manquant", () => {
  const errors = validateInvitationInput({
    managerFullName: "Youssef Alami",
    managerEmail: "y.alami@garage-atlas.ma",
    planCode: "silver",
  });
  assert.ok(errors.establishmentId, "establishmentId doit être en erreur");
});

test("validation : nom du manager trop court", () => {
  const errors = validateInvitationInput({
    establishmentId: "11111111-1111-1111-1111-111111111111",
    managerFullName: "X",
    managerEmail: "y.alami@garage-atlas.ma",
    planCode: "silver",
  });
  assert.ok(errors.managerFullName, "managerFullName doit être en erreur");
});

test("validation : email invalide", () => {
  const errors = validateInvitationInput({
    establishmentId: "11111111-1111-1111-1111-111111111111",
    managerFullName: "Youssef Alami",
    managerEmail: "pas-un-email",
    planCode: "silver",
  });
  assert.ok(errors.managerEmail, "managerEmail doit être en erreur");
});

test("validation : forfait invalide", () => {
  const errors = validateInvitationInput({
    establishmentId: "11111111-1111-1111-1111-111111111111",
    managerFullName: "Youssef Alami",
    managerEmail: "y.alami@garage-atlas.ma",
    planCode: "platine",
  });
  assert.ok(errors.planCode, "planCode doit être en erreur");
});

test("validation : téléphone marocain invalide", () => {
  const errors = validateInvitationInput({
    establishmentId: "11111111-1111-1111-1111-111111111111",
    managerFullName: "Youssef Alami",
    managerEmail: "y.alami@garage-atlas.ma",
    planCode: "silver",
    managerPhone: "0123456789",
  });
  assert.ok(errors.managerPhone, "managerPhone doit être en erreur");
});

test("validation : durée d'essai hors bornes", () => {
  const errors = validateInvitationInput({
    establishmentId: "11111111-1111-1111-1111-111111111111",
    managerFullName: "Youssef Alami",
    managerEmail: "y.alami@garage-atlas.ma",
    planCode: "silver",
    trialDays: 100,
  });
  assert.ok(errors.trialDays, "trialDays doit être en erreur");
});

// ------------------------------------------------------------------
// 2. normalizePhoneMA
// ------------------------------------------------------------------
test("normalisation téléphone : 06XXXXXXXX -> +2126XXXXXXXX", () => {
  assert.strictEqual(normalizePhoneMA("0600000000"), "+212600000000");
});

test("normalisation téléphone : +2126XXXXXXXX -> +2126XXXXXXXX", () => {
  assert.strictEqual(normalizePhoneMA("+212600000000"), "+212600000000");
});

test("normalisation téléphone : 002126XXXXXXXX -> +2126XXXXXXXX", () => {
  assert.strictEqual(normalizePhoneMA("00212600000000"), "+212600000000");
});

test("normalisation téléphone : 6XXXXXXXX -> +2126XXXXXXXX", () => {
  assert.strictEqual(normalizePhoneMA("600000000"), "+212600000000");
});

test("normalisation téléphone : 07XXXXXXXX -> +2127XXXXXXXX", () => {
  assert.strictEqual(normalizePhoneMA("0700000000"), "+212700000000");
});

test("normalisation téléphone : null/vide -> null", () => {
  assert.strictEqual(normalizePhoneMA(""), null);
  assert.strictEqual(normalizePhoneMA(null), null);
});

test("normalisation téléphone : invalide -> null", () => {
  assert.strictEqual(normalizePhoneMA("0123456789"), null);
  assert.strictEqual(normalizePhoneMA("060000000"), null); // 9 chiffres
  assert.strictEqual(normalizePhoneMA("06000000000"), null); // 11 chiffres
});

// ------------------------------------------------------------------
// 3. isValidEmail
// ------------------------------------------------------------------
test("email : valide", () => {
  assert.strictEqual(isValidEmail("y.alami@garage-atlas.ma"), true);
});

test("email : vide", () => {
  assert.strictEqual(isValidEmail(""), false);
});

test("email : sans arobase", () => {
  assert.strictEqual(isValidEmail("pasunemail"), false);
});

test("email : sans domaine", () => {
  assert.strictEqual(isValidEmail("y@"), false);
});

// ------------------------------------------------------------------
// 4. buildActivationUrl
// ------------------------------------------------------------------
test("activation URL : construction correcte", () => {
  const url = buildActivationUrl("abc123", "https://auto-dyali.github.io");
  assert.strictEqual(url, "https://auto-dyali.github.io/activer/abc123");
});

test("activation URL : slash final enleve", () => {
  const url = buildActivationUrl("abc123", "https://auto-dyali.github.io/");
  assert.strictEqual(url, "https://auto-dyali.github.io/activer/abc123");
});

// ------------------------------------------------------------------
// 5. buildEmailInvitationMessage
// ------------------------------------------------------------------
test("email : sujet contient le nom de l'etablissement", () => {
  const { subject } = buildEmailInvitationMessage({
    managerFullName: "Youssef Alami",
    establishmentName: "Garage Atlas SARL",
    activationUrl: "https://auto-dyali.github.io/activer/abc123",
  });
  assert.ok(subject.includes("Garage Atlas SARL"), "sujet doit contenir le nom de l'etablissement");
});

test("email : lien d'activation present", () => {
  const { body } = buildEmailInvitationMessage({
    managerFullName: "Youssef Alami",
    establishmentName: "Garage Atlas SARL",
    activationUrl: "https://auto-dyali.github.io/activer/abc123",
  });
  assert.ok(body.includes("https://auto-dyali.github.io/activer/abc123"), "lien d'activation doit etre present");
});

test("email : aucun mot de passe valeur transmise", () => {
  const { body } = buildEmailInvitationMessage({
    managerFullName: "Youssef Alami",
    establishmentName: "Garage Atlas SARL",
    activationUrl: "https://auto-dyali.github.io/activer/abc123",
  });
  const lower = body.toLowerCase();
  // Le texte peut mentionner "mot de passe" comme instruction, mais ne doit
  // jamais contenir de valeur de mot de passe (pattern password: XXX)
  assert.ok(!lower.includes("password:"), "aucun champ password ne doit etre dans l'email");
  assert.ok(!lower.includes("votre mot de passe est"), "aucun mot de passe valeur ne doit etre dans l'email");
});

// ------------------------------------------------------------------
// 6. buildWhatsAppInvitationMessage
// ------------------------------------------------------------------
test("whatsapp : message contient le nom de l'etablissement", () => {
  const msg = buildWhatsAppInvitationMessage({
    managerFullName: "Youssef Alami",
    establishmentName: "Garage Atlas SARL",
    activationUrl: "https://auto-dyali.github.io/activer/abc123",
  });
  assert.ok(msg.includes("Garage Atlas SARL"), "message WhatsApp doit contenir le nom de l'etablissement");
});

test("whatsapp : lien d'activation present", () => {
  const msg = buildWhatsAppInvitationMessage({
    managerFullName: "Youssef Alami",
    establishmentName: "Garage Atlas SARL",
    activationUrl: "https://auto-dyali.github.io/activer/abc123",
  });
  assert.ok(msg.includes("https://auto-dyali.github.io/activer/abc123"), "lien d'activation doit etre present");
});

test("whatsapp : aucun mot de passe valeur transmis", () => {
  const msg = buildWhatsAppInvitationMessage({
    managerFullName: "Youssef Alami",
    establishmentName: "Garage Atlas SARL",
    activationUrl: "https://auto-dyali.github.io/activer/abc123",
  });
  const lower = msg.toLowerCase();
  assert.ok(!lower.includes("password:"), "aucun champ password ne doit etre dans le message WhatsApp");
  assert.ok(!lower.includes("votre mot de passe est"), "aucun mot de passe valeur ne doit etre dans le message WhatsApp");
});

// ------------------------------------------------------------------
// Résultat
// ------------------------------------------------------------------
console.log(`\n${passed} test(s) reussi(s), ${failed} echec(s).`);
process.exit(failed > 0 ? 1 : 0);
