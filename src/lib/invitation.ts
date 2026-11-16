"use server";

/**
 * AUTO DYALI — Service d'invitations Manager (e-mail + WhatsApp)
 *
 * Architecture : adaptateurs de fournisseurs, interchangeables.
 * Aucun secret n'est exposé côté client. L'envoi réel se fait côté serveur
 * (Edge Function ou route serveur) avec les clés configurées de manière
 * sécurisée (jamais dans le dépôt, jamais dans les logs).
 *
 * Statuts d'invitation :
 *   preparée    → invitation créée, envoi non demandé
 *   envoyee     → envoi demandé aux fournisseurs
 *   confirmee   → confirmation de livraison reçue d'au moins un fournisseur
 *   echec       → tous les envois ont échoué
 *   acceptee    → manager a cliqué sur le lien d'activation
 *   expiree     → jeton expiré (7 jours) sans activation
 *   annulee     → invitation annulée par le Super Admin
 */

export type InvitationChannel = "email" | "whatsapp";
export type InvitationStatus =
  | "preparée"
  | "envoyee"
  | "confirmee"
  | "echec"
  | "acceptee"
  | "expiree"
  | "annulee";

export type InvitationSendResult = {
  channel: InvitationChannel;
  status: "sent_requested" | "sent_confirmed" | "sent_failed";
  providerRef?: string;
  providerError?: string;
  sentAt?: string;
};

export type InvitationCreateInput = {
  establishmentId: string;
  managerFullName: string;
  managerEmail: string;
  managerPhone?: string;
  planCode: string;
  trialDays?: number;
  modules?: string[];
  createdBy: string;
  sendEmail?: boolean;
  sendWhatsApp?: boolean;
  baseUrl?: string;
};

/**
 * Résultat de création d'invitation (côté serveur, après appel RPC).
 * Le jeton est généré côté base par admin_invite_manager.
 */
export type InvitationCreated = {
  status: "preparée";
  invitationId: string;
  token: string;
  email: string;
  establishmentId: string;
  plan: string;
  expiresAt: string;
};

/**
 * Génère l'URL d'activation sécurisée.
 * Le jeton est un UUID hexadécimal généré côté base (gen_invitation_token).
 */
export function buildActivationUrl(token: string, baseUrl: string): string {
  const cleanBase = baseUrl.replace(/\/$/, "");
  return `${cleanBase}/activer/${encodeURIComponent(token)}`;
}

/**
 * Normalise un numéro de téléphone marocain pour WhatsApp.
 * Accepte : 06XXXXXXXX, +2126XXXXXXXX, 002126XXXXXXXX, 6XXXXXXXX.
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
  else if (normalized.startsWith("06") && normalized.length === 10)
    normalized = normalized.slice(1);
  else if (normalized.startsWith("07") && normalized.length === 10)
    normalized = normalized.slice(1);
  else if (normalized.startsWith("6") && normalized.length === 9) {
    // déjà sans le 0
  } else return null;

  // Doit être 9 chiffres commençant par 6 ou 7
  if (!/^[67][0-9]{8}$/.test(normalized)) return null;
  return `+212${normalized}`;
}

/**
 * Vérifie si un email est valide (format simple).
 */
export function isValidEmail(value: string): boolean {
  const v = value.trim();
  if (!v || v.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

/**
 * Valide les champs de création d'invitation.
 * Retourne un objet d'erreurs vide si tout est valide.
 */
export function validateInvitationInput(input: Partial<InvitationCreateInput>): Record<string, string> {
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
  if (input.trialDays !== undefined && (input.trialDays < 0 || input.trialDays > 90)) {
    errors.trialDays = "La durée d'essai doit être comprise entre 0 et 90 jours.";
  }

  return errors;
}

/**
 * Interface d'un fournisseur d'envoi d'invitation.
 * Chaque fournisseur (e-mail, WhatsApp) implémente cet interface.
 */
export interface InvitationProvider {
  channel: InvitationChannel;
  name: string;
  isConfigured(): boolean;
  sendInvitation(params: {
    to: string;
    managerFullName: string;
    establishmentName: string;
    activationUrl: string;
    supportContact?: string;
  }): Promise<{
    status: "sent_requested" | "sent_confirmed" | "sent_failed";
    providerRef?: string;
    providerError?: string;
  }>;
}

/**
 * Adaptateur e-mail (à configurer avec un fournisseur réel : SMTP, Resend, etc.).
 * Aucun secret ici : la configuration est injectée côté serveur.
 */
export class EmailInvitationProvider implements InvitationProvider {
  channel: InvitationChannel = "email";
  name = "Email";

  private configured: boolean;

  constructor(configured = false) {
    this.configured = configured;
  }

  isConfigured(): boolean {
    return this.configured;
  }

  async sendInvitation(params: {
    to: string;
    managerFullName: string;
    establishmentName: string;
    activationUrl: string;
    supportContact?: string;
  }): Promise<{
    status: "sent_requested" | "sent_confirmed" | "sent_failed";
    providerRef?: string;
    providerError?: string;
  }> {
    if (!this.configured) {
      return {
        status: "sent_failed",
        providerError: "Fournisseur e-mail non configuré. Clé API manquante côté serveur.",
      };
    }
    // L'implémentation réelle appelle l'API du fournisseur (ex. Resend, SendGrid, SMTP).
    // Le corps du message ne contient jamais le mot de passe, uniquement le lien d'activation.
    return {
      status: "sent_requested",
      providerRef: undefined,
    };
  }
}

/**
 * Adaptateur WhatsApp (à configurer avec WhatsApp Business API).
 * Respecte le consentement et les modèles de messages approuvés.
 */
export class WhatsAppInvitationProvider implements InvitationProvider {
  channel: InvitationChannel = "whatsapp";
  name = "WhatsApp";

  private configured: boolean;

  constructor(configured = false) {
    this.configured = configured;
  }

  isConfigured(): boolean {
    return this.configured;
  }

  async sendInvitation(params: {
    to: string;
    managerFullName: string;
    establishmentName: string;
    activationUrl: string;
    supportContact?: string;
  }): Promise<{
    status: "sent_requested" | "sent_confirmed" | "sent_failed";
    providerRef?: string;
    providerError?: string;
  }> {
    if (!this.configured) {
      return {
        status: "sent_failed",
        providerError: "Fournisseur WhatsApp non configuré. Clé API WhatsApp Business manquante côté serveur.",
      };
    }
    // L'implémentation réelle appelle l'API WhatsApp Business (modèle de message approuvé).
    // Le numéro doit être au format international (+212...).
    return {
      status: "sent_requested",
      providerRef: undefined,
    };
  }
}

/**
 * Construit le message d'invitation e-mail (en français, professionnel).
 * Aucun mot de passe n'est inclus dans le message.
 */
export function buildEmailInvitationMessage(params: {
  managerFullName: string;
  establishmentName: string;
  activationUrl: string;
  supportContact?: string;
}): { subject: string; body: string } {
  const support = params.supportContact ?? "support@auto-dyali.ma";
  return {
    subject: `Invitation à activer votre compte AUTO DYALI — ${params.establishmentName}`,
    body: `
Bonjour ${params.managerFullName},

Votre compte Manager pour l'établissement "${params.establishmentName}" a été créé sur AUTO DYALI.

Pour définir votre mot de passe et accéder à votre espace professionnel, cliquez sur le lien ci-dessous :

${params.activationUrl}

Ce lien est valide pendant 7 jours et ne peut être utilisé qu'une seule fois.
Aucun mot de passe ne vous a été transmis par email.

Si vous n'êtes pas à l'origine de cette demande, ignorez ce message ou contactez le support : ${support}

Cordialement,
L'équipe AUTO DYALI
    `.trim(),
  };
}

/**
 * Construit le message d'invitation WhatsApp (format court, professionnel).
 * Aucun mot de passe n'est inclus.
 */
export function buildWhatsAppInvitationMessage(params: {
  managerFullName: string;
  establishmentName: string;
  activationUrl: string;
  supportContact?: string;
}): string {
  const support = params.supportContact ?? "support@auto-dyali.ma";
  return `
*AUTO DYALI — Invitation Manager*

Bonjour ${params.managerFullName},

Votre compte Manager pour l'établissement *${params.establishmentName}* a été créé sur AUTO DYALI.

Activez votre compte et définissez votre mot de passe :
${params.activationUrl}

Lien valide 7 jours, usage unique. Aucun mot de passe n'est transmis par WhatsApp.

Support : ${support}
    `.trim();
}
