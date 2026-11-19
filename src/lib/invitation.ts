/**
 * AUTO DYALI — Utilitaires client des invitations Manager.
 *
 * Ce module est pur (aucun fournisseur, aucun secret, aucune simulation) :
 *   - validation des champs d'invitation ;
 *   - normalisation des numéros WhatsApp ;
 *   - construction de l'URL d'activation `/activer/` ;
 *   - textes d'invitation affichés/testés.
 *
 * L'envoi réel (e-mail Resend / WhatsApp Business Platform) vit exclusivement
 * côté serveur dans `supabase/functions/_shared/providers.ts`, avec des
 * statuts réels ; aucun adaptateur factice ne subsiste ici.
 */

import { buildActivationUrl as buildUrl } from "./activation.ts";
import { SUPPORT_EMAIL, SUPPORT_WHATSAPP } from "../../supabase/functions/_shared/constants.ts";

export const INVITATION_VALIDITY_DAYS = 7;

export type InvitationChannel = "email" | "whatsapp";

export type InvitationCreateInput = {
  establishmentId: string;
  managerFullName: string;
  managerEmail: string;
  managerPhone?: string;
  planCode: string;
  trialDays?: number;
  modules?: string[];
  createdBy?: string;
  sendEmail?: boolean;
  sendWhatsApp?: boolean;
  baseUrl?: string;
};

/**
 * URL d'activation sécurisée. Le jeton brut n'est transmis qu'au destinataire ;
 * la base ne conserve que son empreinte SHA-256.
 */
export function buildActivationUrl(token: string, baseUrl: string): string {
  return buildUrl(baseUrl, token);
}

/**
 * Normalise un numéro de téléphone marocain pour WhatsApp.
 * Accepte : 06XXXXXXXX, 07XXXXXXXX, +2126XXXXXXXX, 002126XXXXXXXX, 6XXXXXXXX.
 * Retourne le format international +2126XXXXXXXX ou null si invalide.
 */
export function normalizePhoneMA(value: string): string | null {
  if (!value) return null;
  const digits = value.replace(/[^0-9+]/g, "");
  let normalized = digits;

  if (normalized.startsWith("+212")) normalized = normalized.slice(4);
  else if (normalized.startsWith("00212")) normalized = normalized.slice(5);
  else if (normalized.startsWith("212") && normalized.length === 12)
    normalized = normalized.slice(3);
  else if ((normalized.startsWith("06") || normalized.startsWith("07")) && normalized.length === 10)
    normalized = normalized.slice(1);
  else if (normalized.startsWith("6") && normalized.length === 9) {
    // déjà sans le 0
  } else if (normalized.startsWith("7") && normalized.length === 9) {
    // déjà sans le 0
  } else return null;

  if (!/^[67][0-9]{8}$/.test(normalized)) return null;
  return `+212${normalized}`;
}

export function isValidEmail(value: string): boolean {
  const v = value.trim();
  if (!v || v.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

/** Valide une relance d'invitation (aucune donnée inventée). */
export function validateInvitationInput(
  input: Partial<InvitationCreateInput>,
): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!input.establishmentId || input.establishmentId.trim().length === 0) {
    errors.establishmentId = "L'établissement est obligatoire.";
  }
  if (!input.managerFullName || input.managerFullName.trim().length < 2) {
    errors.managerFullName = "Le nom complet du manager est obligatoire.";
  }
  if (!isValidEmail(input.managerEmail ?? "")) {
    errors.managerEmail = "L'email professionnel du manager est invalide.";
  }
  if (!input.planCode || !["standard", "silver", "gold"].includes(input.planCode)) {
    errors.planCode = "Le forfait est invalide (standard, silver ou gold).";
  }
  if (input.managerPhone && !normalizePhoneMA(input.managerPhone)) {
    errors.managerPhone = "Numéro de téléphone marocain invalide (ex. 06XXXXXXXX).";
  }
  if (input.trialDays !== undefined && (input.trialDays < 0 || input.trialDays > 365)) {
    errors.trialDays = "La durée d'essai doit être comprise entre 0 et 365 jours.";
  }

  return errors;
}

/** Texte e-mail de l'invitation. Aucun mot de passe n'y figure. */
export function buildEmailInvitationMessage(params: {
  managerFullName: string;
  establishmentName: string;
  activationUrl: string;
  supportContact?: string;
}): { subject: string; body: string } {
  const support = params.supportContact ?? `${SUPPORT_EMAIL} — WhatsApp ${SUPPORT_WHATSAPP}`;
  return {
    subject: `Invitation à activer votre compte AUTO DYALI — ${params.establishmentName}`,
    body: `
Bonjour ${params.managerFullName},

Votre espace professionnel AUTO DYALI pour l'établissement « ${params.establishmentName} » est prêt.

Pour activer votre compte et choisir votre mot de passe personnel, ouvrez ce lien :

${params.activationUrl}

Ce lien est valable ${INVITATION_VALIDITY_DAYS} jours et ne peut être utilisé qu'une seule fois.
Aucun mot de passe ne vous est envoyé par e-mail.

Assistance : ${support}

L'équipe AUTO DYALI
    `.trim(),
  };
}

/** Texte WhatsApp de l'invitation. Aucun mot de passe n'y figure. */
export function buildWhatsAppInvitationMessage(params: {
  managerFullName: string;
  establishmentName: string;
  activationUrl: string;
  supportContact?: string;
}): string {
  const support = params.supportContact ?? `${SUPPORT_EMAIL} / ${SUPPORT_WHATSAPP}`;
  return `
*AUTO DYALI — Activation Manager*

Bonjour ${params.managerFullName},

Votre espace professionnel pour *${params.establishmentName}* est prêt.

Activez votre compte et choisissez votre mot de passe :
${params.activationUrl}

Lien valable ${INVITATION_VALIDITY_DAYS} jours, usage unique. Aucun mot de passe n'est transmis par WhatsApp.

Support : ${support}
    `.trim();
}
