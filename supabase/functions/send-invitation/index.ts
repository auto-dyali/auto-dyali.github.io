/**
 * AUTO DYALI — Edge Function `send-invitation` (relance par canal)
 *
 * Version AUTONOME : aucun import partagé, afin que le code local soit
 * exactement celui déployé. Relance une invitation existante sur un ou
 * plusieurs canaux, de façon idempotente. Un nouveau jeton est émis à
 * chaque relance réelle (l'ancien lien devient invalide) ; seul le SHA-256
 * est stocké. Chaque résultat fournisseur est enregistré séparément.
 *
 * Aucun statut « délivré » / « lu » n'est inventé : `accepte_par_fournisseur`
 * signifie uniquement que l'API a accepté la requête (HTTP 2xx).
 * Sans secret fournisseur, le statut est `non_configure` et rien n'est envoyé.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const INVITATION_TTL_DAYS = 7;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function fail(status: number, error: string): Response {
  return json(status, { ok: false, error });
}

function env(name: string): string | null {
  const value = Deno.env.get(name);
  return value && value.trim() ? value.trim() : null;
}

/** Jeton brut à 256 bits : jamais persisté. */
function generateInvitationToken(): string {
  const octets = new Uint8Array(32);
  crypto.getRandomValues(octets);
  return Array.from(octets, (o) => o.toString(16).padStart(2, "0")).join("");
}

/** Empreinte SHA-256 du jeton : seul ce hash est transmis à la base. */
async function sha256Hex(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (o) => o.toString(16).padStart(2, "0")).join("");
}

type DeliveryResult = {
  channel: "email" | "whatsapp";
  status: string;
  providerRef?: string | null;
  providerError?: string | null;
};

type Message = {
  managerFullName: string;
  establishmentName: string;
  activationUrl: string;
  recipientEmail: string;
  recipientPhone: string | null;
  expiresInDays: number;
};

/**
 * Fournisseur de test SANS SECRET : quand EMAIL_PROVIDER=smtp, on envoie via
 * le serveur SMTP local de la pile Supabase (Inbucket). Le chemin Resend et
 * le comportement par défaut restent inchangés. L'import est dynamique pour
 * ne jamais casser le déploiement Resend si deno.land est inaccessible.
 */
async function sendViaSmtpTest(message: Message): Promise<DeliveryResult> {
  // Client SMTP minimal, sans authentification ni TLS : le serveur de test
  // local (Mailpit/Inbucket) n'accepte aucun secret et n'est pas exposé.
  let conn: Deno.Conn | null = null;
  try {
    conn = await Deno.connect({
      hostname: Deno.env.get("SMTP_HOST") ?? "127.0.0.1",
      port: Number(Deno.env.get("SMTP_PORT") ?? 54325),
    });
    const encode = new TextEncoder();
    const decode = new TextDecoder();
    const lire = async (): Promise<string> => {
      let reponse = "";
      for (;;) {
        const lignes = reponse.split(/\r?\n/).filter((l) => l.length > 0);
        if (lignes.length > 0 && /^\d{3} /.test(lignes[lignes.length - 1])) {
          return lignes.join("\n");
        }
        const octets = new Uint8Array(2048);
        const n = await conn!.read(octets);
        if (n === null) throw new Error("SMTP fermé par le serveur");
        reponse += decode.decode(octets.subarray(0, n));
      }
    };
    const cmd = async (ligne: string): Promise<string> => {
      await conn!.write(encode.encode(`${ligne}\r\n`));
      return lire();
    };
    await lire(); // 220
    await cmd("EHLO gv5.local");
    await cmd("MAIL FROM:<test@gv5.local>");
    await cmd(`RCPT TO:<${message.recipientEmail}>`);
    await cmd("DATA");
    const html = `<p>Bonjour ${message.managerFullName},</p><p>Activez votre compte : <a href="${message.activationUrl}">Activer mon compte</a></p><p>Ce lien expire dans ${message.expiresInDays} jours.</p>`;
    await conn.write(
      encode.encode(
        `From: test@gv5.local\r\nTo: ${message.recipientEmail}\r\nSubject: Votre accès AUTO DYALI — ${message.establishmentName}\r\nContent-Type: text/html; charset=utf-8\r\n\r\n${html}\r\n.\r\n`,
      ),
    );
    await lire();
    await cmd("QUIT");
    return { channel: "email", status: "accepte_par_fournisseur", providerRef: "smtp-test" };
  } catch (erreur) {
    return { channel: "email", status: "echec", providerError: String((erreur as Error)?.message ?? erreur) };
  } finally {
    conn?.close();
  }
}

async function deliverEmail(apiKey: string | null, from: string | null, message: Message): Promise<DeliveryResult> {
  if (Deno.env.get("EMAIL_PROVIDER") === "smtp") {
    return sendViaSmtpTest(message);
  }
  if (!apiKey || !from) {
    return {
      channel: "email",
      status: "non_configure",
      providerError: "Fournisseur e-mail non configuré (RESEND_API_KEY / EMAIL_FROM absents).",
    };
  }
  try {
    const reponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        from,
        to: [message.recipientEmail],
        subject: `Votre accès AUTO DYALI — ${message.establishmentName}`,
        html: `<p>Bonjour ${message.managerFullName},</p><p>Votre accès à <strong>${message.establishmentName}</strong> est prêt. Activez votre compte en définissant votre mot de passe :</p><p><a href="${message.activationUrl}">Activer mon compte</a></p><p>Ce lien expire dans ${message.expiresInDays} jours.</p>`,
      }),
    });
    if (!reponse.ok) {
      return { channel: "email", status: "echec", providerError: `Resend HTTP ${reponse.status}` };
    }
    const corps = (await reponse.json().catch(() => ({}))) as { id?: string };
    return { channel: "email", status: "accepte_par_fournisseur", providerRef: corps.id ?? null };
  } catch (erreur) {
    return { channel: "email", status: "echec", providerError: String((erreur as Error)?.message ?? erreur) };
  }
}

async function deliverWhatsapp(
  accessToken: string | null,
  phoneNumberId: string | null,
  templateName: string | null,
  templateLanguage: string | null,
  apiVersion: string | null,
  message: Message,
): Promise<DeliveryResult> {
  if (!accessToken || !phoneNumberId || !templateName) {
    return {
      channel: "whatsapp",
      status: "non_configure",
      providerError:
        "WhatsApp Business non configuré (WHATSAPP_ACCESS_TOKEN / WHATSAPP_PHONE_NUMBER_ID / WHATSAPP_TEMPLATE_NAME absents).",
    };
  }
  if (!message.recipientPhone) {
    return { channel: "whatsapp", status: "echec", providerError: "Numéro WhatsApp du Manager absent." };
  }
  try {
    const version = apiVersion ?? "21.0";
    const reponse = await fetch(
      `https://graph.facebook.com/${version}/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: message.recipientPhone,
          type: "template",
          template: {
            name: templateName,
            language: { code: templateLanguage ?? "fr" },
            components: [
              {
                type: "body",
                parameters: [
                  { type: "text", text: message.managerFullName },
                  { type: "text", text: message.establishmentName },
                  { type: "text", text: message.activationUrl },
                  { type: "text", text: String(message.expiresInDays) },
                ],
              },
            ],
          },
        }),
      },
    );
    if (!reponse.ok) {
      return { channel: "whatsapp", status: "echec", providerError: `Meta HTTP ${reponse.status}` };
    }
    const corps = (await reponse.json().catch(() => ({}))) as { messages?: { id?: string }[] };
    return {
      channel: "whatsapp",
      status: "accepte_par_fournisseur",
      providerRef: corps.messages?.[0]?.id ?? null,
    };
  } catch (erreur) {
    return { channel: "whatsapp", status: "echec", providerError: String((erreur as Error)?.message ?? erreur) };
  }
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return fail(405, "Méthode POST requise.");

  try {
    const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
    if (!jwt) return fail(401, "Authorization manquante.");

    const SUPABASE_URL = env("SUPABASE_URL");
    const SUPABASE_ANON_KEY = env("SUPABASE_ANON_KEY");
    const SUPABASE_SERVICE_ROLE_KEY = env("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
      return fail(500, "Environnement serveur incomplet.");
    }

    const caller = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: userError } = await caller.auth.getUser(jwt);
    if (userError || !userData?.user) return fail(401, "Session invalide ou expirée.");
    const { data: callerProfile } = await admin
      .from("profiles")
      .select("role, is_active")
      .eq("id", userData.user.id)
      .maybeSingle();
    if (!callerProfile || callerProfile.role !== "saas_admin" || callerProfile.is_active === false) {
      return fail(403, "Accès refusé : Super Admin actif requis.");
    }

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return fail(400, "Corps JSON invalide.");

    // `invitationId` est la clé canonique ; `invitation_id` est acceptée pour
    // compatibilité avec les anciens appels.
    const invitationId =
      typeof body.invitationId === "string"
        ? body.invitationId.trim()
        : typeof body.invitation_id === "string"
          ? body.invitation_id.trim()
          : "";
    if (!UUID_REGEX.test(invitationId)) return fail(400, "invitationId invalide (UUID requis).");

    const rawChannels = Array.isArray(body.channels) ? body.channels : [];
    const channels = [...new Set(rawChannels.filter((c): c is string => c === "email" || c === "whatsapp"))];
    if (channels.length === 0) {
      return fail(400, "Sélectionnez au moins un canal (email ou whatsapp).");
    }

    const requestId =
      typeof body.requestId === "string" && UUID_REGEX.test(body.requestId.trim())
        ? body.requestId.trim()
        : crypto.randomUUID();

    const { data: invitation, error: invitationError } = await admin
      .from("invitations")
      .select(
        "id, email, manager_full_name, manager_phone, status, establishment_id, expires_at, last_request_id, email_status, whatsapp_status, email_provider_ref, whatsapp_provider_ref",
      )
      .eq("id", invitationId)
      .maybeSingle();
    if (invitationError) return fail(500, `Lecture de l'invitation impossible : ${invitationError.message}`);
    if (!invitation) return fail(404, "Invitation introuvable.");
    if (invitation.status === "accepted") return fail(409, "Cette invitation a déjà été acceptée.");

    /* Idempotence : même requestId ⇒ même résultat, aucun nouvel envoi.
       Une invitation révoquée est exclue : elle est renouvelée par une
       NOUVELLE invitation, jamais ressuscitée. */
    if (invitation.last_request_id === requestId && invitation.status !== "cancelled") {
      return json(200, {
        ok: true,
        idempotent: true,
        invitation_id: invitation.id,
        delivery: [
          { channel: "email", status: invitation.email_status, providerRef: invitation.email_provider_ref },
          { channel: "whatsapp", status: invitation.whatsapp_status, providerRef: invitation.whatsapp_provider_ref },
        ],
      });
    }

    const { data: establishment } = await admin
      .from("establishments")
      .select("id, name")
      .eq("id", invitation.establishment_id)
      .maybeSingle();

    const token = generateInvitationToken();
    const tokenHash = await sha256Hex(token);
    const expiresAt = new Date(Date.now() + INVITATION_TTL_DAYS * 86_400_000).toISOString();

    let activeInvitation = invitation;
    let renewedFrom: string | null = null;

    if (invitation.status === "cancelled") {
      // Sécurité : l'ancien jeton reste invalide (ligne `cancelled` inchangée).
      // Le RPC crée une nouvelle invitation avec la nouvelle empreinte.
      const { data: renewed, error: renewError } = await caller.rpc("admin_create_invitation_renewal", {
        p_old_invitation_id: invitation.id,
        p_request_id: requestId,
        p_token_hash: tokenHash,
        p_expires_at: expiresAt,
        p_channels: channels,
      });
      if (renewError) {
        return fail(400, `Renouvellement impossible : ${renewError.message}`);
      }
      if (!renewed?.invitation_id) {
        return fail(500, "Renouvellement sans identifiant d'invitation.");
      }
      renewedFrom = invitation.id;
      activeInvitation = {
        ...invitation,
        id: renewed.invitation_id,
        status: "prepared",
        expires_at: renewed.expires_at ?? expiresAt,
        last_request_id: requestId,
        email_status: channels.includes("email") ? "en_attente" : invitation.email_status,
        whatsapp_status: channels.includes("whatsapp") ? "en_attente" : invitation.whatsapp_status,
      };
    } else {
      const { error: prepareError } = await caller.rpc("admin_prepare_resend", {
        p_invitation_id: invitation.id,
        p_request_id: requestId,
        p_token_hash: tokenHash,
        p_expires_at: expiresAt,
        p_channels: channels,
      });
      if (prepareError) {
        return fail(400, `Préparation de la relance impossible : ${prepareError.message}`);
      }
    }

    const baseUrl = env("ACTIVATION_BASE_URL") ?? req.headers.get("origin") ?? "";
    const activationUrl = `${baseUrl.replace(/\/+$/, "")}/activer/?token=${encodeURIComponent(token)}`;

    const message: Message = {
      managerFullName: activeInvitation.manager_full_name,
      establishmentName: establishment?.name ?? "votre établissement",
      activationUrl,
      recipientEmail: activeInvitation.email,
      recipientPhone: activeInvitation.manager_phone ?? null,
      expiresInDays: INVITATION_TTL_DAYS,
    };

    const results: DeliveryResult[] = [];
    for (const canal of channels) {
      if (canal === "email") {
        results.push(await deliverEmail(env("RESEND_API_KEY"), env("EMAIL_FROM"), message));
      } else {
        results.push(
          await deliverWhatsapp(
            env("WHATSAPP_ACCESS_TOKEN"),
            env("WHATSAPP_PHONE_NUMBER_ID"),
            env("WHATSAPP_TEMPLATE_NAME"),
            env("WHATSAPP_TEMPLATE_LANG"),
            env("WHATSAPP_API_VERSION"),
            message,
          ),
        );
      }
    }

    for (const r of results) {
      const { error: recordError } = await caller.rpc("admin_record_delivery", {
        p_invitation_id: activeInvitation.id,
        p_channel: r.channel,
        p_status: r.status,
        p_provider_ref: r.providerRef ?? null,
        p_provider_error: r.providerError ?? null,
      });
      if (recordError) {
        r.providerError = [r.providerError, `statut non enregistré : ${recordError.message}`]
          .filter(Boolean)
          .join(" | ");
      }
    }

    return json(200, {
      ok: true,
      idempotent: false,
      invitation_id: activeInvitation.id,
      renewed_from: renewedFrom,
      expires_at: activeInvitation.expires_at ?? expiresAt,
      delivery: results,
    });
  } catch (error) {
    return fail(500, `Erreur serveur : ${String((error as Error)?.message ?? error)}`);
  }
});
