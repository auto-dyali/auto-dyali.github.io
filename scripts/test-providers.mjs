/**
 * GV5 §51 — Tests SIMULÉS des adaptateurs de transmission.
 *
 * `fetch` est injecté : AUCUN appel réseau réel, aucun message réel envoyé.
 * On vérifie surtout l'indépendance des canaux et l'honnêteté des statuts.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  buildAdminNotificationMessage,
  buildEmailInvitationMessage,
  buildWhatsAppTemplateParams,
  deliverInvitation,
  generateInvitationToken,
  isEmailConfigured,
  isWhatsAppConfigured,
  sendEmailInvitation,
  sendAdminNotificationEmail,
  sendAdminWhatsAppNotification,
  sendWhatsAppInvitation,
  sha256Hex,
} from "../supabase/functions/_shared/providers.ts";

const message = {
  managerFullName: "Youssef Alami",
  establishmentName: "Garage Atlas",
  activationUrl: "https://auto-dyali.github.io/activer/?token=abc",
  recipientEmail: "y.alami@garage-atlas.ma",
  recipientPhone: "+212600000000",
  expiresInDays: 7,
};

function response(ok, status, body) {
  return { ok, status, text: async () => body };
}

const emailConfig = { enabled: true, apiKey: "re_fake", from: "no-reply@auto-dyali.ma" };
const whatsappConfig = {
  enabled: true,
  accessToken: "meta_fake",
  phoneNumberId: "123456",
  templateName: "invitation_manager",
  templateLanguage: "fr",
};

test("un jeton d'invitation est aléatoire et fait 64 caractères hex", () => {
  const a = generateInvitationToken();
  const b = generateInvitationToken();
  assert.match(a, /^[a-f0-9]{64}$/);
  assert.notEqual(a, b);
});

test("le hachage SHA-256 est stable et ne révèle pas le jeton", async () => {
  const token = generateInvitationToken();
  const hash = await sha256Hex(token);
  assert.match(hash, /^[a-f0-9]{64}$/);
  assert.notEqual(hash, token);
  assert.equal(await sha256Hex(token), hash);
});

test("le message e-mail ne contient aucun mot de passe", () => {
  const email = buildEmailInvitationMessage(message);
  assert.match(email.subject, /Garage Atlas/);
  assert.match(email.text, /activer\/\?token=/);
  assert.equal(/mot de passe temporaire/i.test(email.text), false);
  assert.equal(/TempPass/.test(email.text), false);
});

test("le modèle WhatsApp contient 4 variables dans l'ordre attendu", () => {
  const params = buildWhatsAppTemplateParams(message);
  assert.equal(params.length, 4);
  assert.equal(params[0], "Youssef Alami");
  assert.equal(params[1], "Garage Atlas");
  assert.match(params[2], /activer/);
  assert.match(params[3], /@/);
});

test("configurations incomplètes détectées (aucun faux positif)", () => {
  assert.equal(isEmailConfigured({ enabled: true, apiKey: "x" }), false);
  assert.equal(isWhatsAppConfigured({ enabled: true, accessToken: "x" }), false);
  assert.equal(isEmailConfigured(emailConfig), true);
  assert.equal(isWhatsAppConfigured(whatsappConfig), true);
});

test("e-mail : succès fournisseur => accepte_par_fournisseur (pas « délivré »)", async () => {
  const result = await sendEmailInvitation({
    config: emailConfig,
    fetchImpl: async () => response(true, 200, '{"id":"em_123"}'),
    message: buildEmailInvitationMessage(message),
    to: message.recipientEmail,
  });
  assert.equal(result.channel, "email");
  assert.equal(result.status, "accepte_par_fournisseur");
  assert.equal(result.providerRef, "em_123");
});

test("e-mail : erreur HTTP => echec avec statut et message", async () => {
  const result = await sendEmailInvitation({
    config: emailConfig,
    fetchImpl: async () => response(false, 422, '{"message":"invalid from"}'),
    message: buildEmailInvitationMessage(message),
    to: message.recipientEmail,
  });
  assert.equal(result.status, "echec");
  assert.equal(result.httpStatus, 422);
  assert.match(result.providerError ?? "", /422/);
});

test("e-mail non configuré => non_configure (aucune invention)", async () => {
  const result = await sendEmailInvitation({
    config: { enabled: false, apiKey: null, from: null },
    fetchImpl: async () => response(true, 200, "{}"),
    message: buildEmailInvitationMessage(message),
    to: message.recipientEmail,
  });
  assert.equal(result.status, "non_configure");
});

test("WhatsApp : succès fournisseur => identifiant de message conservé", async () => {
  const result = await sendWhatsAppInvitation({
    config: whatsappConfig,
    fetchImpl: async () => response(true, 200, '{"messages":[{"id":"wamid.1"}]}'),
    to: message.recipientPhone,
    templateParams: buildWhatsAppTemplateParams(message),
  });
  assert.equal(result.channel, "whatsapp");
  assert.equal(result.status, "accepte_par_fournisseur");
  assert.equal(result.providerRef, "wamid.1");
});

test("WhatsApp non configuré => non_configure", async () => {
  const result = await sendWhatsAppInvitation({
    config: { enabled: false },
    fetchImpl: async () => response(true, 200, "{}"),
    to: message.recipientPhone,
    templateParams: [],
  });
  assert.equal(result.status, "non_configure");
});

test("canaux indépendants : l'échec WhatsApp ne bloque pas l'e-mail", async () => {
  const fetchImpl = async (url) => {
    if (url.includes("graph.facebook.com")) return response(false, 500, '{"error":"meta down"}');
    return response(true, 200, '{"id":"em_ok"}');
  };
  const results = await deliverInvitation({
    channels: ["email", "whatsapp"],
    fetchImpl,
    emailConfig,
    whatsappConfig,
    message,
  });
  const email = results.find((r) => r.channel === "email");
  const whatsapp = results.find((r) => r.channel === "whatsapp");
  assert.equal(email?.status, "accepte_par_fournisseur");
  assert.equal(whatsapp?.status, "echec");
});

test("canaux indépendants : l'échec e-mail ne bloque pas WhatsApp", async () => {
  const fetchImpl = async (url) => {
    if (url.includes("api.resend.com")) return response(false, 503, "unavailable");
    return response(true, 200, '{"messages":[{"id":"wamid.ok"}]}');
  };
  const results = await deliverInvitation({
    channels: ["email", "whatsapp"],
    fetchImpl,
    emailConfig,
    whatsappConfig,
    message,
  });
  assert.equal(results.find((r) => r.channel === "email")?.status, "echec");
  assert.equal(results.find((r) => r.channel === "whatsapp")?.status, "accepte_par_fournisseur");
});

test("canal non demandé => non_demande, jamais envoyé", async () => {
  const results = await deliverInvitation({
    channels: ["email"],
    fetchImpl: async () => response(true, 200, '{"id":"x"}'),
    emailConfig,
    whatsappConfig,
    message,
  });
  assert.equal(results.find((r) => r.channel === "whatsapp")?.status, "non_demande");
});

test("WhatsApp demandé sans numéro => echec explicite, e-mail intact", async () => {
  const results = await deliverInvitation({
    channels: ["email", "whatsapp"],
    fetchImpl: async () => response(true, 200, '{"id":"x"}'),
    emailConfig,
    whatsappConfig,
    message: { ...message, recipientPhone: null },
  });
  assert.equal(results.find((r) => r.channel === "email")?.status, "accepte_par_fournisseur");
  assert.equal(results.find((r) => r.channel === "whatsapp")?.status, "echec");
});

test("le succès n'est jamais annoncé sans réponse 2xx", async () => {
  const result = await sendEmailInvitation({
    config: emailConfig,
    fetchImpl: async () => {
      throw new Error("network down");
    },
    message: buildEmailInvitationMessage(message),
    to: message.recipientEmail,
  });
  assert.equal(result.status, "echec");
  assert.match(result.providerError ?? "", /Réseau/);
});

test("URL d'activation absente : aucun envoi, échec explicite", async () => {
  const results = await deliverInvitation({
    channels: ["email", "whatsapp"],
    fetchImpl: async () => response(true, 200, '{"id":"x"}'),
    emailConfig,
    whatsappConfig,
    message: { ...message, activationUrl: "" },
  });
  assert.equal(results.find((r) => r.channel === "email")?.status, "echec");
  assert.equal(results.find((r) => r.channel === "whatsapp")?.status, "echec");
  assert.match(results[0].providerError ?? "", /URL d'activation absente/);
});


test("notification Super Admin : non configurée sans secret, jamais livrée", async () => {
  const msg = buildAdminNotificationMessage({
    establishmentName: "Garage Atlas",
    managerFullName: "Youssef Alami",
    createdAt: "2026-11-26T00:00:00Z",
    resultat: "création confirmée",
  });
  assert.match(msg.text, /Garage Atlas/);
  assert.match(msg.text, /Youssef Alami/);
  assert.match(msg.html, /images\/branding\/logo\.webp/);
  const nonConfigure = await sendAdminNotificationEmail({
    config: { enabled: false, apiKey: null, from: null },
    fetchImpl: async () => { throw new Error("aucun appel réseau attendu"); },
    message: msg,
  });
  assert.equal(nonConfigure.status, "non_configure");
});

test("notification Super Admin : HTTP 2xx = accepté par le fournisseur seulement", async () => {
  const msg = buildAdminNotificationMessage({
    establishmentName: "Garage Atlas",
    managerFullName: "Youssef Alami",
    createdAt: "2026-11-26T00:00:00Z",
    resultat: "création confirmée",
  });
  const result = await sendAdminNotificationEmail({
    config: { enabled: true, apiKey: "cle-de-test", from: "expediteur@exemple.invalid" },
    fetchImpl: async () => ({ ok: true, status: 200, text: async () => '{"id":"prov-test"}' }),
    message: msg,
  });
  assert.equal(result.status, "accepte_par_fournisseur");
  assert.equal(result.providerRef, "prov-test");
  assert.notEqual(result.status, "livre");
});


test("WhatsApp Super Admin distinct : non configuré sans destinataire ni modèle", async () => {
  const result = await sendAdminWhatsAppNotification({
    config: { enabled: false },
    fetchImpl: async () => { throw new Error("aucun appel réseau attendu"); },
    to: null,
    templateParams: ["Garage Atlas", "Youssef Alami", "date", "création confirmée"],
  });
  assert.equal(result.status, "non_configure");
  assert.match(result.providerError ?? "", /Super Admin non configurée/);
});

test("WhatsApp Super Admin : HTTP 2xx = accepté, jamais livré", async () => {
  const result = await sendAdminWhatsAppNotification({
    config: {
      enabled: true,
      accessToken: "jeton-de-test",
      phoneNumberId: "id-de-test",
      templateName: "modele_admin_test",
    },
    fetchImpl: async () => ({ ok: true, status: 200, text: async () => '{"messages":[{"id":"wa-test"}]}' }),
    to: "+212600000000",
    templateParams: ["Garage Atlas", "Youssef Alami", "date", "création confirmée"],
  });
  assert.equal(result.status, "accepte_par_fournisseur");
  assert.notEqual(result.status, "livre");
});
