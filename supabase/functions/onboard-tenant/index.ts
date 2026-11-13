/**
 * AUTO DYALI — Edge Function `onboard-tenant`
 * Création sécurisée d'un abonné professionnel depuis le Super Admin :
 *   entreprise + établissement + compte Manager (invitation email)
 *   + abonnement + droits du forfait + journal d'audit.
 *
 * STATUT : NON DÉPLOYÉE.
 * Ne pas déployer sans autorisation explicite ni avant l'application
 * contrôlée de `supabase/migrations/0028_..._prepared_NOT_APPLIED.sql`.
 *
 * Architecture des clients (critique pour is_saas_admin()/auth.uid()) :
 *   - caller  : clé ANON + JWT du Super Admin dans Authorization.
 *               Utilisé pour TOUTES les RPC 0028 qui vérifient l'identité
 *               et le rôle côté base (is_saas_admin() -> auth.uid()).
 *   - admin   : clé SERVICE_ROLE, serveur uniquement.
 *               Utilisé EXCLUSIVEMENT pour les opérations Auth Admin
 *               (invitation/suppression du compte Manager) et le contrôle
 *               serveur du rôle du profil appelant. Jamais exposée.
 *
 * Secrets requis : SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const SLUG_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PLANS = new Set(["standard", "silver", "gold"]);

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { ok: false, error: "POST requis" });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) return json(401, { ok: false, error: "Authorization manquante ou invalide" });

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
      return json(500, { ok: false, error: "Environnement serveur incomplet" });
    }

    // --- Client CALLER : identité JWT du Super Admin (auth.uid() côté RPC/RLS) ---
    const caller = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // 1) Vérifier le JWT (validité, expiration, signature) côté serveur.
    const { data: userData, error: userError } = await caller.auth.getUser(token);
    if (userError || !userData?.user) {
      return json(401, { ok: false, error: "Session invalide ou expirée" });
    }
    const callerId = userData.user.id;

    // --- Client ADMIN : service_role, opérations Auth privilégiées uniquement ---
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // 2) Vérifier le rôle saas_admin depuis une source fiable (serveur), pas le frontend.
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("role, is_active")
      .eq("id", callerId)
      .maybeSingle();
    if (profileError) return json(500, { ok: false, error: "Vérification du profil impossible" });
    if (!profile || profile.role !== "saas_admin" || profile.is_active === false) {
      return json(403, { ok: false, error: "Accès refusé : Super Admin actif requis" });
    }

    // 3) Valider l'entrée (jamais faire confiance aux données frontend).
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return json(400, { ok: false, error: "Corps JSON invalide" });

    const {
      requestId, companyName, slug, city, phone, email,
      plan, trialDays, managerName, managerEmail, managerPhone,
    } = body as Record<string, unknown>;

    const requestIdStr = typeof requestId === "string" ? requestId.trim() : "";
    const company = typeof companyName === "string" ? companyName.trim() : "";
    const companySlug = typeof slug === "string" ? slug.trim().toLowerCase() : "";
    const trialRaw = Number(trialDays ?? 14);
    const trial = Number.isFinite(trialRaw) ? Math.trunc(trialRaw) : NaN;
    const mgrName = typeof managerName === "string" ? managerName.trim() : "";
    const mgrEmail = typeof managerEmail === "string" ? managerEmail.trim().toLowerCase() : "";
    const planCode = typeof plan === "string" ? plan.trim().toLowerCase() : "standard";
    const companyEmail = typeof email === "string" ? email.trim().toLowerCase() : "";

    const errors: string[] = [];
    if (!requestIdStr || !UUID_REGEX.test(requestIdStr)) errors.push("requestId invalide (UUID requis).");
    if (!company || company.length < 2) errors.push("Le nom de l'entreprise est obligatoire (2 caractères min.).");
    if (!companySlug || !SLUG_REGEX.test(companySlug)) errors.push("Slug invalide (minuscules, chiffres, tirets).");
    if (!PLANS.has(planCode)) errors.push("Forfait invalide (standard, silver, gold).");
    if (!Number.isFinite(trial) || trial < 0 || trial > 90) errors.push("Durée d'essai invalide (0 à 90 jours).");
    if (!mgrName || mgrName.length < 2) errors.push("Le nom du Manager est obligatoire.");
    if (!mgrEmail || !EMAIL_REGEX.test(mgrEmail)) errors.push("Email du Manager invalide.");
    if (companyEmail && !EMAIL_REGEX.test(companyEmail)) errors.push("Email de l'entreprise invalide.");
    if (errors.length) return json(400, { ok: false, error: errors.join(" ") });

    // 4) Idempotence : RPC appelée via CALLER (is_saas_admin() -> auth.uid() du JWT).
    const { data: existante, error: existErr } = await caller.rpc("admin_find_onboarding_request", {
      p_request_id: requestIdStr,
    });
    if (existErr) {
      // Erreur RPC = dépendance 0028 absente ou refus ; message explicite, pas de création partielle.
      const msg = String(existErr.message ?? "");
      if (msg.includes("Could not find the function") || existErr.code === "PGRST202") {
        return json(503, { ok: false, error: "Onboarding indisponible : migration 0028 non appliquée ou RPC absentes." });
      }
      return json(400, { ok: false, error: `Vérification idempotence impossible : ${msg}` });
    }
    if (existante) return json(200, { ok: true, ...(existante as Record<string, unknown>) });

    // 5) Anti-doublon Auth : vérification via CALLER (RPC protégée saas_admin).
    const { data: existingId, error: findErr } = await caller.rpc("admin_find_user_id_by_email", {
      p_email: mgrEmail,
    });
    if (findErr) {
      const msg = String(findErr.message ?? "");
      if (msg.includes("Could not find the function") || findErr.code === "PGRST202") {
        return json(503, { ok: false, error: "Onboarding indisponible : migration 0028 non appliquée." });
      }
      return json(400, { ok: false, error: `Vérification du compte Manager impossible : ${msg}` });
    }
    if (existingId) {
      return json(409, { ok: false, error: "Un compte existe déjà pour cet email Manager." });
    }

    // 6) Inviter le Manager — opération Auth Admin (service_role, serveur uniquement).
    //    Aucun mot de passe en clair. L'invitation déclenche l'email Supabase.
    const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(mgrEmail, {
      data: { full_name: mgrName },
    });
    if (inviteError || !inviteData?.user) {
      return json(400, {
        ok: false,
        error: `Invitation Manager impossible : ${inviteError?.message ?? "erreur inconnue"}`,
      });
    }
    const invitedUserId = inviteData.user.id;

    // 7) Association atomique via RPC transactionnelle — APPELÉE EN TANT QUE CALLER
    //    (auth.uid() dans la RPC = Super Admin ; audit_log.actor_id correct).
    const { data: result, error: rpcError } = await caller.rpc("admin_onboard_tenant", {
      p_company_name: company,
      p_slug: companySlug,
      p_city: typeof city === "string" ? city.trim() || null : null,
      p_phone: typeof phone === "string" ? phone.trim() || null : null,
      p_email: companyEmail || null,
      p_plan: planCode,
      p_manager_user_id: invitedUserId,
      p_manager_name: mgrName,
      p_manager_phone: typeof managerPhone === "string" ? managerPhone.trim() || null : null,
      p_trial_days: trial,
      p_request_id: requestIdStr,
    });

    if (rpcError) {
      // Compensation : supprimer le compte invité pour éviter un orphelin Auth.
      await admin.auth.admin.deleteUser(invitedUserId).catch(() => undefined);
      return json(400, {
        ok: false,
        error: `Échec de l'onboarding : ${rpcError.message}. L'invitation a été annulée.`,
      });
    }

    // 8) Réponse = résultat réel de la RPC (jamais de succès sans persistance confirmée).
    return json(200, { ok: true, ...(result as Record<string, unknown>) });
  } catch (err) {
    return json(500, { ok: false, error: String((err as Error)?.message ?? err) });
  }
});
