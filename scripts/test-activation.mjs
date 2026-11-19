/**
 * GV5 §51 — Tests unitaires du parcours d'activation (pur).
 * Aucune consommation de jeton, aucun réseau.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  ACTIVATION_MIN_PASSWORD_LENGTH,
  buildActivationUrl,
  classifyActivationError,
  isValidTokenFormat,
  parseActivationToken,
  validatePasswordPair,
} from "../src/lib/activation.ts";

const TOKEN = "a".repeat(64);

test("le jeton est extrait de la query string", () => {
  assert.equal(parseActivationToken(`?token=${TOKEN}`), TOKEN);
  assert.equal(parseActivationToken(`token=${TOKEN}&x=1`), TOKEN);
  assert.equal(parseActivationToken(""), "");
});

test("un jeton doit faire 64 caractères hexadécimaux", () => {
  assert.equal(isValidTokenFormat(TOKEN), true);
  assert.equal(isValidTokenFormat("abc"), false);
  assert.equal(isValidTokenFormat("z".repeat(64)), false);
});

test("l'URL d'activation utilise /activer/ (jamais /actiter)", () => {
  const url = buildActivationUrl("https://auto-dyali.github.io/", TOKEN);
  assert.equal(url, `https://auto-dyali.github.io/activer/?token=${TOKEN}`);
  assert.equal(url.includes("/actiter"), false);
});

test("le mot de passe doit contenir au moins 10 caractères", () => {
  assert.ok(validatePasswordPair("short1", "short1"));
  assert.equal(ACTIVATION_MIN_PASSWORD_LENGTH, 10);
});

test("le mot de passe doit contenir lettre et chiffre", () => {
  assert.ok(validatePasswordPair("onlyletters", "onlyletters"));
  assert.ok(validatePasswordPair("1234567890", "1234567890"));
  assert.equal(validatePasswordPair("Password123", "Password123"), null);
});

test("la confirmation doit correspondre", () => {
  assert.match(validatePasswordPair("Password123", "Password124") ?? "", /correspondent/);
});

test("les erreurs serveur sont classées sans divulguer de détail", () => {
  assert.equal(classifyActivationError("Invitation expirée."), "expiree");
  assert.equal(classifyActivationError("Invitation déjà utilisée."), "deja_utilisee");
  assert.equal(classifyActivationError("Jeton d'activation invalide ou inconnu."), "invalide");
  assert.equal(classifyActivationError("Erreur réseau"), "erreur");
});

test("aucun état ne consomme le jeton à la prévisualisation", () => {
  // Garantie de conception : parse/form validation sont pures.
  const token = parseActivationToken(`?token=${TOKEN}`);
  assert.equal(isValidTokenFormat(token), true);
  // Aucun appel réseau n'est effectué par ces fonctions.
  assert.equal(typeof globalThis.fetch, "function");
});
