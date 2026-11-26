/**
 * AUTO DYALI — Transmission des invitations (e-mail + WhatsApp Business).
 *
 * Fichier partagé Edge Function / tests Node.
 * Aucune dépendance Deno/Node : `fetch` est injecté.
 *
 * Honnêteté des statuts :
 *   - « accepte_par_fournisseur » = le fournisseur a accepté la requête (HTTP 2xx).
 *   - JAMAIS « délivré » ni « lu » : ces statuts exigent un webhook signé.
 *   - « non_configure » = aucun secret fournisseur présent : rien n'est envoyé,
 *     et on ne prétend pas le contraire.
 *
 * Aucun mot de passe n'est transmis par ces canaux.
 */

import type { DeliveryChannel, DeliveryStatus } from "./contract.ts";



export type DeliveryResult = {
  channel: DeliveryChannel;
  status: DeliveryStatus;
  providerRef?: string | null;
  providerError?: string | null;
  httpStatus?: number | null;
};

export type FetchResponseLike = {
  ok: boolean;
  status: number;
  text: () => Promise<string>;
};

import { LOGO_URL, SUPER_ADMIN_EMAIL, SUPPORT_EMAIL, SUPPORT_WHATSAPP } from "./constants.ts";

export type FetchLike = (
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  },
) => Promise<FetchResponseLike>;

export type EmailConfig = {
  enabled: boolean;
  apiKey?: string | null;
  from?: string | null;
  replyTo?: string | null;
};

export type WhatsAppConfig = {
  enabled: boolean;
  accessToken?: string | null;
  phoneNumberId?: string | null;
  templateName?: string | null;
  templateLanguage?: string | null;
  apiVersion?: string | null;
};

export type InvitationMessageInput = {
  managerFullName: string;
  establishmentName: string;
  activationUrl: string;
  recipientEmail: string;
  recipientPhone?: string | null;
  expiresInDays: number;
};

/** SHA-256 hexadécimal d'un jeton — la base ne stocke que l'empreinte. */
export async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Jeton d'activation à haute entropie (32 octets = 64 caractères hex). */
export function generateInvitationToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function isEmailConfigured(config: EmailConfig | null | undefined): boolean {
  return Boolean(config?.enabled && config.apiKey && config.from);
}

export function isWhatsAppConfigured(
  config: WhatsAppConfig | null | undefined,
): boolean {
  return Boolean(
    config?.enabled && config.accessToken && config.phoneNumberId && config.templateName,
  );
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Prénom et nom séparés pour la formule « Bonjour [Prénom] [Nom] ». */
export function prenomEtNom(fullName: string): { prenom: string; nom: string } {
  const parties = fullName.trim().split(/\s+/).filter(Boolean);
  if (parties.length === 0) return { prenom: "", nom: "" };
  return { prenom: parties[0], nom: parties.slice(1).join(" ") || parties[0] };
}

export function buildEmailInvitationMessage(input: InvitationMessageInput): {
  subject: string;
  text: string;
  html: string;
} {
  const subject = `AUTO DYALI — Activation de votre espace ${input.establishmentName}`;
  const { prenom, nom } = prenomEtNom(input.managerFullName);
  const salutation = [prenom, nom].filter(Boolean).join(" ");
  const text = [
    `Bonjour ${salutation},`,
    "",
    `Votre espace professionnel AUTO DYALI pour « ${input.establishmentName} » est prêt.`,
    "",
    `1. Ouvrez ce lien : ${input.activationUrl}`,
    `2. Choisissez votre mot de passe personnel (le lien expire dans ${input.expiresInDays} jours).`,
    `3. Connectez-vous à AUTO DYALI avec votre e-mail.`,
    "",
    "Ce lien est à usage unique. Aucun mot de passe ne vous est envoyé par e-mail.",
    "",
    `Assistance : ${SUPPORT_EMAIL} — WhatsApp ${SUPPORT_WHATSAPP}`,
    "",
    "L'équipe AUTO DYALI",
  ].join("\n");

  const html = `<!doctype html><html lang="fr"><body style="margin:0;background:#f4f6f4;font-family:Arial,Helvetica,sans-serif;color:#252d2d">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:14px;overflow:hidden">
        <tr><td style="background:#252d2d;padding:22px 28px;color:#e8ece8">
          <img src="${LOGO_URL}" alt="AUTO DYALI" width="132" height="52"
               style="display:block;max-width:100%;height:auto" />
          <div style="font-size:12px;color:#a7b7a8;margin-top:4px">Espace professionnel</div>
        </td></tr>
        <tr><td style="padding:28px">
          <p style="margin:0 0 14px">Bonjour <strong>${escapeHtml(salutation)}</strong>,</p>
          <p style="margin:0 0 14px;line-height:1.6">Votre espace professionnel pour
            <strong>${escapeHtml(input.establishmentName)}</strong> est prêt.</p>
          <p style="margin:0 0 6px;line-height:1.6">1. Activez votre compte et choisissez votre mot de passe personnel :</p>
          <p style="margin:18px 0"><a href="${escapeHtml(input.activationUrl)}"
             style="background:#8fb59b;color:#252d2d;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:bold;display:inline-block">
             Activer mon compte</a></p>
          <p style="margin:0 0 14px;font-size:12px;color:#5d6d5f">Lien à usage unique, valable ${input.expiresInDays} jours.
            Aucun mot de passe ne vous est envoyé par e-mail.</p>
          <p style="margin:0 0 4px;font-size:13px">Assistance : ${SUPPORT_EMAIL} — WhatsApp ${SUPPORT_WHATSAPP}</p>
        </td></tr>
        <tr><td style="background:#f4f6f4;padding:16px 28px;font-size:11px;color:#5d6d5f">
          AUTO DYALI — message automatique, merci de ne pas y répondre directement.
        </td></tr>
      </table>
    </td></tr>
  </table></body></html>`;

  return { subject, text, html };
}

/**
 * Paramètres du modèle WhatsApp Business approuvé.
 * Le modèle doit être de catégorie « utility » et contenir 4 variables :
 * {{1}} nom du Manager, {{2}} établissement, {{3}} lien, {{4}} support.
 */
export function buildWhatsAppTemplateParams(input: InvitationMessageInput): string[] {
  return [
    input.managerFullName,
    input.establishmentName,
    input.activationUrl,
    `${SUPPORT_EMAIL} / ${SUPPORT_WHATSAPP}`,
  ];
}

function truncate(value: string, max = 400): string {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

/** Envoi e-mail via l'API HTTP Resend (aucun SDK, aucun secret exposé). */
export async function sendEmailInvitation(params: {
  config: EmailConfig;
  fetchImpl: FetchLike;
  message: ReturnType<typeof buildEmailInvitationMessage>;
  to: string;
  replyTo?: string | null;
}): Promise<DeliveryResult> {
  if (!isEmailConfigured(params.config)) {
    return {
      channel: "email",
      status: "non_configure",
      providerError: "Fournisseur e-mail non configuré (RESEND_API_KEY / EMAIL_FROM absents).",
    };
  }
  try {
    const response = await params.fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: params.config.from,
        to: [params.to],
        reply_to: params.replyTo ?? params.config.replyTo ?? undefined,
        subject: params.message.subject,
        text: params.message.text,
        html: params.message.html,
      }),
    });

    const body = await response.text();
    if (!response.ok) {
      return {
        channel: "email",
        status: "echec",
        providerError: `Fournisseur e-mail HTTP ${response.status} : ${truncate(body)}`,
        httpStatus: response.status,
      };
    }
    let providerRef: string | null = null;
    try {
      const parsed = JSON.parse(body) as { id?: string };
      providerRef = typeof parsed.id === "string" ? parsed.id : null;
    } catch {
      providerRef = null;
    }
    return {
      channel: "email",
      status: "accepte_par_fournisseur",
      providerRef,
      httpStatus: response.status,
    };
  } catch (error) {
    return {
      channel: "email",
      status: "echec",
      providerError: `Réseau e-mail : ${truncate(String((error as Error)?.message ?? error))}`,
    };
  }
}

/** Envoi WhatsApp via WhatsApp Business Platform (Meta Cloud API). */
export async function sendWhatsAppInvitation(params: {
  config: WhatsAppConfig;
  fetchImpl: FetchLike;
  to: string;
  templateParams: string[];
}): Promise<DeliveryResult> {
  if (!isWhatsAppConfigured(params.config)) {
    return {
      channel: "whatsapp",
      status: "non_configure",
      providerError:
        "WhatsApp Business non configuré (WHATSAPP_ACCESS_TOKEN / WHATSAPP_PHONE_NUMBER_ID / WHATSAPP_TEMPLATE_NAME absents).",
    };
  }
  const version = params.config.apiVersion || "v21.0";
  const url = `https://graph.facebook.com/${version}/${params.config.phoneNumberId}/messages`;
  try {
    const response = await params.fetchImpl(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.config.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: params.to,
        type: "template",
        template: {
          name: params.config.templateName,
          language: { code: params.config.templateLanguage || "fr" },
          components: [
            {
              type: "body",
              parameters: params.templateParams.map((text) => ({ type: "text", text })),
            },
          ],
        },
      }),
    });

    const body = await response.text();
    if (!response.ok) {
      return {
        channel: "whatsapp",
        status: "echec",
        providerError: `WhatsApp HTTP ${response.status} : ${truncate(body)}`,
        httpStatus: response.status,
      };
    }
    let providerRef: string | null = null;
    try {
      const parsed = JSON.parse(body) as { messages?: { id?: string }[] };
      providerRef = parsed.messages?.[0]?.id ?? null;
    } catch {
      providerRef = null;
    }
    return {
      channel: "whatsapp",
      status: "accepte_par_fournisseur",
      providerRef,
      httpStatus: response.status,
    };
  } catch (error) {
    return {
      channel: "whatsapp",
      status: "echec",
      providerError: `Réseau WhatsApp : ${truncate(String((error as Error)?.message ?? error))}`,
    };
  }
}

/**
 * Envoie sur les canaux demandés, en isolant totalement les erreurs :
 * l'échec d'un canal ne peut pas empêcher l'autre.
 */
export async function deliverInvitation(params: {
  channels: DeliveryChannel[];
  emailConfig: EmailConfig;
  whatsappConfig: WhatsAppConfig;
  fetchImpl: FetchLike;
  message: InvitationMessageInput & { recipientPhone?: string | null };
}): Promise<DeliveryResult[]> {
  // Aucune URL d'activation valide => aucun envoi. On préfère un échec
  // explicite à un e-mail/WhatsApp contenant un lien vide.
  if (!/^https?:\/\//i.test(params.message.activationUrl ?? "")) {
    const error = "URL d'activation absente : aucun envoi effectué.";
    return [
      {
        channel: "email",
        status: params.channels.includes("email") ? "echec" : "non_demande",
        providerRef: null,
        providerError: params.channels.includes("email") ? error : null,
      },
      {
        channel: "whatsapp",
        status: params.channels.includes("whatsapp") ? "echec" : "non_demande",
        providerRef: null,
        providerError: params.channels.includes("whatsapp") ? error : null,
      },
    ];
  }

  const tasks: Promise<DeliveryResult>[] = [];

  if (params.channels.includes("email")) {
    tasks.push(
      sendEmailInvitation({
        config: params.emailConfig,
        fetchImpl: params.fetchImpl,
        message: buildEmailInvitationMessage(params.message),
        to: params.message.recipientEmail,
        replyTo: SUPPORT_EMAIL,
      }),
    );
  } else {
    tasks.push(
      Promise.resolve({
        channel: "email" as const,
        status: "non_demande" as const,
        providerRef: null,
        providerError: null,
      }),
    );
  }

  if (params.channels.includes("whatsapp")) {
    if (!params.message.recipientPhone) {
      tasks.push(
        Promise.resolve({
          channel: "whatsapp" as const,
          status: "echec" as const,
          providerError: "Numéro WhatsApp du Manager absent.",
        }),
      );
    } else {
      tasks.push(
        sendWhatsAppInvitation({
          config: params.whatsappConfig,
          fetchImpl: params.fetchImpl,
          to: params.message.recipientPhone,
          templateParams: buildWhatsAppTemplateParams(params.message),
        }),
      );
    }
  } else {
    tasks.push(
      Promise.resolve({
        channel: "whatsapp" as const,
        status: "non_demande" as const,
        providerRef: null,
        providerError: null,
      }),
    );
  }

  return Promise.all(tasks);
}

/* --------------------------------------------------------------------- */
/* Notification du Super Admin (interne + e-mail), sans faux statut.       */
/* --------------------------------------------------------------------- */

export type AdminNotificationInput = {
  establishmentName: string;
  managerFullName: string;
  createdAt: string;
  resultat: string;
};

/** Message français, personnalisé, avec le logo officiel inchangé. */
export function buildAdminNotificationMessage(input: AdminNotificationInput): {
  subject: string;
  text: string;
  html: string;
} {
  const subject = `AUTO DYALI — Nouvel abonné : ${input.establishmentName}`;
  const text = [
    "Bonjour Super Admin,",
    "",
    `Un nouvel abonné vient d'être créé : ${input.establishmentName}.`,
    `Manager : ${input.managerFullName}.`,
    `Date de création : ${input.createdAt}.`,
    `Résultat de l'opération : ${input.resultat}.`,
    "",
    "Ceci est une notification interne au Super Admin AUTO DYALI.",
  ].join("\n");
  const html = `<!doctype html><html lang="fr"><body style="margin:0;background:#f4f6f4;font-family:Arial,Helvetica,sans-serif;color:#252d2d">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px">
    <tr><td align="center"><table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:14px">
      <tr><td style="background:#252d2d;padding:22px 28px">
        <img src="${LOGO_URL}" alt="AUTO DYALI" width="132" height="52" style="display:block;max-width:100%;height:auto" />
      </td></tr>
      <tr><td style="padding:28px">
        <p>Bonjour Super Admin,</p>
        <p>Un nouvel abonné vient d'être créé : <strong>${escapeHtml(input.establishmentName)}</strong>.</p>
        <p>Manager : ${escapeHtml(input.managerFullName)}<br>Date de création : ${escapeHtml(input.createdAt)}<br>Résultat : ${escapeHtml(input.resultat)}</p>
      </td></tr>
    </table></td></tr>
  </table></body></html>`;
  return { subject, text, html };
}

/**
 * Envoi générique via Resend. Le statut `accepte_par_fournisseur` signifie
 * uniquement HTTP 2xx ; aucune livraison finale n'est affirmée.
 */
export async function sendAdminNotificationEmail(params: {
  config: EmailConfig;
  fetchImpl: FetchLike;
  to?: string;
  message: ReturnType<typeof buildAdminNotificationMessage>;
}): Promise<DeliveryResult> {
  if (!isEmailConfigured(params.config)) {
    return {
      channel: "email",
      status: "non_configure",
      providerError: "Fournisseur e-mail non configuré (RESEND_API_KEY / EMAIL_FROM absents).",
    };
  }
  try {
    const response = await params.fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: params.config.from,
        to: [params.to ?? SUPER_ADMIN_EMAIL],
        reply_to: params.replyTo ?? params.config.replyTo ?? SUPPORT_EMAIL,
        subject: params.message.subject,
        text: params.message.text,
        html: params.message.html,
      }),
    });
    if (!response.ok) {
      return {
        channel: "email",
        status: "echec",
        httpStatus: response.status,
        providerError: `Fournisseur e-mail HTTP ${response.status} : ${truncate(await response.text())}`,
      };
    }
    let providerRef: string | null = null;
    try {
      providerRef = (JSON.parse(await response.text()) as { id?: string }).id ?? null;
    } catch {
      providerRef = null;
    }
    return { channel: "email", status: "accepte_par_fournisseur", providerRef, httpStatus: response.status };
  } catch (error) {
    return {
      channel: "email",
      status: "echec",
      providerError: `Réseau e-mail : ${truncate(String((error as Error)?.message ?? error))}`,
    };
  }
}

/**
 * Notification WhatsApp DISTINCTE du Super Admin.
 *
 * Destinataire : secret `SUPER_ADMIN_WHATSAPP` (E.164), jamais déduit des
 * numéros de contact. Modèle : `WHATSAPP_ADMIN_TEMPLATE_NAME` (Utility),
 * 4 variables : établissement, Manager, date, résultat.
 * Aucun envoi sans configuration complète : statut `non_configure`.
 */
export async function sendAdminWhatsAppNotification(params: {
  config: WhatsAppConfig;
  fetchImpl: FetchLike;
  to?: string | null;
  templateParams: string[];
}): Promise<DeliveryResult> {
  if (!params.to || !isWhatsAppConfigured(params.config)) {
    return {
      channel: "whatsapp",
      status: "non_configure",
      providerError:
        "Notification WhatsApp Super Admin non configurée (SUPER_ADMIN_WHATSAPP / WHATSAPP_* / WHATSAPP_ADMIN_TEMPLATE_NAME absents).",
    };
  }
  return sendWhatsAppInvitation({
    config: params.config,
    fetchImpl: params.fetchImpl,
    to: params.to,
    templateParams: params.templateParams,
  });
}
