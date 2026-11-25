/**
 * AUTO DYALI — Edge Function `onboard-tenant` (contrat v2)
 *
 * Crée un abonné professionnel de bout en bout :
 *   entreprise + établissement + compte Auth Manager + abonnement
 *   + permissions réelles + invitation hachée + transmission e-mail/WhatsApp.
 *
 * Garanties :
 *   - contrat unique validé côté client ET serveur (`_shared/contract.ts`) ;
 *   - identités choisies par le Super Admin, unicité revalidée en base ;
 *   - mot de passe temporaire défini via `auth.admin.createUser` (service_role),
 *     jamais persisté en clair, jamais renvoyé, rotation obligatoire ;
 *   - jeton d'invitation stocké uniquement sous forme SHA-256 ;
 *   - transmission par canaux indépendants, statuts réels enregistrés ;
 *   - idempotence par `requestId` + verrou consultatif côté RPC ;
 *   - compensation : le compte Auth est supprimé si l'onboarding échoue.
 *
 * Secrets attendus (Supabase → Edge Functions → Secrets) :
 *   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY (fournis),
 *   RESEND_API_KEY, EMAIL_FROM (optionnels),
 *   WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_TEMPLATE_NAME
 *   (optionnels), WHATSAPP_TEMPLATE_LANG, WHATSAPP_API_VERSION,
 *   ACTIVATION_BASE_URL (optionnel : origine de la requête par défaut).
 *
 * Sans secrets fournisseur, rien n'est inventé : le statut enregistré est
 * `non_configure`.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import {
  ONBOARDING_CONTRACT_VERSION,
  validateOnboardingPayload,
  type OnboardingPayload,
} from "../_shared/contract.ts";
import {
  deliverInvitation,
  generateInvitationToken,
  sha256Hex,
  type DeliveryResult,
  type FetchLike,
} from "../_shared/providers.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const INVITATION_TTL_DAYS = 7;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function fail(status: number, error: string, fields?: Record<string, string>): Response {
  return json(status, { ok: false, error, ...(fields ? { fields } : {}) });
}

function env(name: string): string | null {
  const value = Deno.env.get(name);
  return value && value.trim() ? value.trim() : null;
}

function errorMessage(error: unknown): string {
  return String((error as { message?: string })?.message ?? error ?? "erreur inconnue");
}

function isMissingFunction(error: unknown): boolean {
  const e = error as { code?: string; message?: string };
  return e?.code === "PGRST202" || /could not find the function/i.test(e?.message ?? "");
}

/**
 * Reprise d'un compte Auth orphelin.
 *
 * Un incident entre `createUser` et la RPC (timeout, coupure réseau) peut
 * laisser un compte sans profil ni établissement. On ne le réutilise que s'il
 * porte la MÊME requête d'onboarding (`onboarding_request_id`) et le même
 * e-mail : jamais un compte quelconque, jamais un doublon d'identité.
 */
async function canAdoptManager(
  admin: ReturnType<typeof createClient>,
  userId: string,
  email: string,
  requestId: string,
): Promise<boolean> {
  const { data, error } = await admin.auth.admin.getUserById(userId);
  const user = data?.user;
  if (error || !user) return false;
  if ((user.email ?? "").toLowerCase() !== email.toLowerCase()) return false;
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  return meta.onboarding_request_id === requestId;
}

/** Traduit le payload validé vers les objets JSON attendus par la RPC. */
function toRpcArgs(
  payload: OnboardingPayload,
  managerUserId: string,
  tokenHash: string,
  expiresAt: string,
) {
  return {
    p_request_id: payload.requestId,
    p_establishment: {
      name: payload.establishment.name,
      legal_name: payload.establishment.legalName,
      slug: payload.establishment.slug,
      activity_type: payload.establishment.activityType,
      professional_id: payload.establishment.professionalId,
      address: payload.establishment.address,
      city: payload.establishment.city,
      region: payload.establishment.region,
      phone: payload.establishment.phone,
      email: payload.establishment.email,
      notes: payload.establishment.notes,
      country: payload.establishment.country,
      legal_info: payload.establishment.legalInfo,
      fiscal_info: payload.establishment.fiscalInfo,
      admin_info: payload.establishment.adminInfo,
      dossier_state: payload.establishment.dossierState,
      complementary_contacts: payload.establishment.complementaryContacts,
    },
    p_manager: {
      user_id: managerUserId,
      full_name: payload.manager.fullName,
      email: payload.manager.email,
      phone: payload.manager.phone,
      login_id: payload.manager.loginId,
    },
    p_subscription: {
      plan: payload.subscription.plan,
      paid_months: payload.subscription.paidDurationMonths,
      trial_days: payload.subscription.trialDurationDays,
      start_date: payload.subscription.startDate,
    },
    p_modules: payload.modules,
    p_permissions: payload.permissions.map((p) => ({
      module: p.module,
      can_view: p.canView,
      can_create: p.canCreate,
      can_edit: p.canEdit,
      can_delete: p.canDelete,
    })),
    p_invitation_token_hash: tokenHash,
    p_invitation_expires_at: expiresAt,
    p_delivery_channels: [
      ...(payload.delivery.email ? ["email"] : []),
      ...(payload.delivery.whatsapp ? ["whatsapp"] : []),
    ],
  };
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return fail(405, "Méthode POST requise.");

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
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

    /* 1) Identité du Super Admin vérifiée côté serveur (jamais le frontend). */
    const { data: userData, error: userError } = await caller.auth.getUser(jwt);
    if (userError || !userData?.user) return fail(401, "Session invalide ou expirée.");
    const callerId = userData.user.id;

    const { data: callerProfile, error: callerProfileError } = await admin
      .from("profiles")
      .select("role, is_active")
      .eq("id", callerId)
      .maybeSingle();
    if (callerProfileError) {
      return fail(500, `Vérification du profil Super Admin impossible : ${callerProfileError.message}`);
    }
    if (!callerProfile || callerProfile.role !== "saas_admin" || callerProfile.is_active === false) {
      return fail(403, "Accès refusé : Super Admin actif requis.");
    }

    /* 2) Contrat unique : validation stricte, clés inconnues refusées. */
    const body = await req.json().catch(() => null);
    const validation = validateOnboardingPayload(body);
    if (!validation.valid || !validation.normalized) {
      return fail(400, "Données d'onboarding invalides.", validation.errors);
    }
    const payload = validation.normalized;

    if (payload.contractVersion !== ONBOARDING_CONTRACT_VERSION) {
      return fail(400, "Version de contrat non supportée.");
    }

    /* 3) Idempotence : une requête déjà terminée renvoie l'état réel. */
    const { data: existingRequest, error: existingError } = await caller.rpc(
      "admin_find_onboarding_request",
      { p_request_id: payload.requestId },
    );
    if (existingError) {
      if (isMissingFunction(existingError)) {
        return fail(503, "Onboarding indisponible : migration 0028 non appliquée.");
      }
      return fail(400, `Vérification d'idempotence impossible : ${errorMessage(existingError)}`);
    }
    const existing = existingRequest as
      | { status?: string; establishment_id?: string | null; manager_user_id?: string | null }
      | null;
    if (existing && existing.status === "completed") {
      const delivery = await readDelivery(admin, existing.establishment_id ?? null);
      return json(200, {
        ok: true,
        idempotent: true,
        status: "completed",
        establishment_id: existing.establishment_id,
        manager_user_id: existing.manager_user_id,
        request_id: payload.requestId,
        delivery,
      });
    }

    /* 4) Unicité (message explicite, sans rien créer). */
    const { data: availability, error: availabilityError } = await caller.rpc(
      "admin_check_identity_available",
      {
        p_professional_id: payload.establishment.professionalId,
        p_login_id: payload.manager.loginId,
        p_manager_email: payload.manager.email,
        p_slug: payload.establishment.slug,
      },
    );
    if (availabilityError) {
      if (isMissingFunction(availabilityError)) {
        return fail(503, "Vérification d'unicité indisponible : migration 0039 non appliquée.");
      }
      return fail(400, `Vérification d'unicité impossible : ${errorMessage(availabilityError)}`);
    }
    const availabilityMap = (availability ?? {}) as Record<string, boolean>;
    const conflicts: Record<string, string> = {};
    if (availabilityMap.professional_id_available === false) {
      conflicts["establishment.professionalId"] = "Cet identifiant professionnel est déjà utilisé.";
    }
    if (availabilityMap.login_id_available === false) {
      conflicts["manager.loginId"] = "Cet identifiant de connexion est déjà utilisé.";
    }
    if (availabilityMap.email_available === false) {
      conflicts["manager.email"] = "Un compte existe déjà pour cet e-mail.";
    }
    if (availabilityMap.slug_available === false) {
      conflicts["establishment.slug"] = "Ce slug est déjà utilisé.";
    }
    if (Object.keys(conflicts).length > 0) {
      return fail(409, "Des identifiants sont déjà utilisés.", conflicts);
    }

    /* 5) Compte Auth Manager : aucun compte existant n'est réutilisé. */
    let managerUserId: string | null = null;

    const { data: foundId, error: findError } = await caller.rpc(
      "admin_find_user_id_by_email",
      { p_email: payload.manager.email },
    );
    if (findError) {
      if (isMissingFunction(findError)) {
        return fail(503, "Onboarding indisponible : migration 0028 non appliquée.");
      }
      return fail(400, `Vérification du compte Manager impossible : ${errorMessage(findError)}`);
    }
    const managerMetadata = {
      full_name: payload.manager.fullName,
      onboarding_request_id: payload.requestId,
    };

    /* Le compte est créé OU repris pour cette requête : dans les deux cas il
       appartient à cette tentative et doit être compensé si la RPC échoue. */
    let managerOwned = false;

    if (typeof foundId === "string" && foundId) {
      if (!(await canAdoptManager(admin, foundId, payload.manager.email, payload.requestId))) {
        return fail(409, "Un compte existe déjà pour cet e-mail Manager. Choisissez un autre e-mail.");
      }
      /* Compte orphelin de la MÊME requête : on reprend l'identité sans doublon. */
      const { error: resumeError } = await admin.auth.admin.updateUserById(foundId, {
        password: payload.manager.temporaryPassword,
        email_confirm: true,
        user_metadata: managerMetadata,
      });
      if (resumeError) {
        return fail(500, `Reprise du compte Manager impossible : ${resumeError.message}`);
      }
      managerUserId = foundId;
      managerOwned = true;
    }

    if (!managerUserId) {
      const { data: createdUser, error: createError } = await admin.auth.admin.createUser({
        email: payload.manager.email,
        password: payload.manager.temporaryPassword,
        email_confirm: true,
        user_metadata: managerMetadata,
      });
      if (createError || !createdUser?.user) {
        const message = createError?.message ?? "création impossible";
        /* Course entre deux essais : reprise uniquement si la requête est identique. */
        if (/already|exists|registered/i.test(message)) {
          const { data: racedId } = await caller.rpc("admin_find_user_id_by_email", {
            p_email: payload.manager.email,
          });
          if (
            typeof racedId === "string" &&
            racedId &&
            (await canAdoptManager(admin, racedId, payload.manager.email, payload.requestId))
          ) {
            const { error: resumeError } = await admin.auth.admin.updateUserById(racedId, {
              password: payload.manager.temporaryPassword,
              email_confirm: true,
              user_metadata: managerMetadata,
            });
            if (!resumeError) {
              managerUserId = racedId;
              managerOwned = true;
            }
          }
        }
        if (!managerUserId) {
          const status = /already|exists|registered/i.test(message) ? 409 : 400;
          return fail(status, `Création du compte Manager impossible : ${message}`);
        }
      } else {
        managerUserId = createdUser.user.id;
        managerOwned = true;
      }
    }

    if (!managerUserId) return fail(500, "Compte Manager non créé.");

    /* 6) Jeton d'invitation : brut transmis, empreinte seule stockée. */
    const token = generateInvitationToken();
    const tokenHash = await sha256Hex(token);
    const expiresAt = new Date(Date.now() + INVITATION_TTL_DAYS * 86_400_000).toISOString();

    /* 7) Persistance transactionnelle (RPC v2). */
    const { data: rpcResult, error: rpcError } = await caller.rpc(
      "admin_onboard_tenant_v2",
      toRpcArgs(payload, managerUserId, tokenHash, expiresAt),
    );

    if (rpcError) {
      /* Compensation : ne jamais laisser un compte Auth sans état cohérent.
         On ne supprime pas si la requête a en réalité été clôturée (réponse
         perdue) : l'état serveur prime sur l'erreur de transport. */
      if (managerOwned && managerUserId) {
        const { data: etat } = await caller.rpc("admin_find_onboarding_request", {
          p_request_id: payload.requestId,
        });
        const dejaTermine = Boolean(
          etat && (etat as { status?: string }).status === "completed",
        );
        if (!dejaTermine) {
          await admin.auth.admin.deleteUser(managerUserId).catch(() => undefined);
        }
      }
      if (isMissingFunction(rpcError)) {
        return fail(503, "Onboarding indisponible : migration 0039 non appliquée.");
      }
      return fail(400, `Échec de l'onboarding : ${rpcError.message}`);
    }

    const result = (rpcResult ?? {}) as Record<string, unknown>;
    const invitationId = typeof result.invitation_id === "string" ? result.invitation_id : null;

    /* 8) Transmission : canaux indépendants, statuts réels, aucune invention. */
    let delivery: DeliveryResult[] = [];
    if (invitationId) {
      const baseUrl =
        env("ACTIVATION_BASE_URL") ??
        req.headers.get("origin") ??
        req.headers.get("referer")?.replace(/\/[^/]*$/, "") ??
        "";
      const activationUrl = baseUrl
        ? `${baseUrl.replace(/\/+$/, "")}/activer/#token=${encodeURIComponent(token)}`
        : "";

      const fetchImpl: FetchLike = (input, init) => fetch(input, init);
      const results = await deliverInvitation({
        channels: [
          ...(payload.delivery.email ? (["email"] as const) : []),
          ...(payload.delivery.whatsapp ? (["whatsapp"] as const) : []),
        ],
        fetchImpl,
        emailConfig: {
          enabled: Boolean(env("RESEND_API_KEY")),
          apiKey: env("RESEND_API_KEY"),
          from: env("EMAIL_FROM"),
          replyTo: env("EMAIL_REPLY_TO"),
        },
        whatsappConfig: {
          enabled: Boolean(env("WHATSAPP_ACCESS_TOKEN")),
          accessToken: env("WHATSAPP_ACCESS_TOKEN"),
          phoneNumberId: env("WHATSAPP_PHONE_NUMBER_ID"),
          templateName: env("WHATSAPP_TEMPLATE_NAME"),
          templateLanguage: env("WHATSAPP_TEMPLATE_LANG"),
          apiVersion: env("WHATSAPP_API_VERSION"),
        },
        message: {
          managerFullName: payload.manager.fullName,
          establishmentName: payload.establishment.name,
          activationUrl,
          recipientEmail: payload.manager.email,
          recipientPhone: payload.manager.phone || null,
          expiresInDays: INVITATION_TTL_DAYS,
        },
      });

      delivery = results;
      for (const r of results) {
        const { error: recordError } = await caller.rpc("admin_record_delivery", {
          p_invitation_id: invitationId,
          p_channel: r.channel,
          p_status: r.status,
          p_provider_ref: r.providerRef ?? null,
          p_provider_error: r.providerError ?? null,
        });
        if (recordError) {
          // On ne masque pas l'échec d'enregistrement, mais la livraison reste
          // rapportée telle qu'elle a été observée.
          r.providerError = [r.providerError, `statut non enregistré : ${recordError.message}`]
            .filter(Boolean)
            .join(" | ");
        }
      }
    }

    // Sans secret fournisseur, la création réussit quand même : l'invitation
    // est préparée et le Super Admin récupère le lien depuis la fiche Manager.
    // Le statut est explicite, jamais « envoyé ».
    const email = delivery.find((d) => d.channel === "email");
    const message =
      email?.status === "non_configure"
        ? "Invitation préparée, e-mail non envoyé (RESEND_API_KEY / EMAIL_FROM absents)."
        : null;

    return json(200, {
      ok: true,
      idempotent: false,
      status: "completed",
      ...result,
      delivery,
      ...(message ? { message, email_sent: false } : {}),
    });
  } catch (error) {
    return fail(500, `Erreur serveur : ${errorMessage(error)}`);
  }
});

/** Relit les statuts de transmission d'un onboarding déjà terminé. */
async function readDelivery(
  admin: ReturnType<typeof createClient>,
  establishmentId: string | null,
): Promise<DeliveryResult[]> {
  if (!establishmentId) return [];
  const { data } = await admin
    .from("invitations")
    .select("email_status, whatsapp_status, email_provider_ref, whatsapp_provider_ref")
    .eq("establishment_id", establishmentId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return [];
  const row = data as Record<string, string | null>;
  return [
    {
      channel: "email",
      status: (row.email_status ?? "non_demande") as DeliveryResult["status"],
      providerRef: row.email_provider_ref,
    },
    {
      channel: "whatsapp",
      status: (row.whatsapp_status ?? "non_demande") as DeliveryResult["status"],
      providerRef: row.whatsapp_provider_ref,
    },
  ];
}
