/* eslint-disable */
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
 * Secrets requis (SUPABASE_* standard des Edge Functions) :
 *   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
 * La clé service_role n'est utilisée QUE côté serveur, jamais dans le navigateur.
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

    // 1) Vérifier l'identité de l'appelant (token utilisateur).
    const caller = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false },
    });
    const { data: userData, error: userError } = await caller.auth.getUser();
    if (userError || !userData?.user) return json(401, { ok: false, error: "Session invalide" });

    // 2) Vérifier le rôle saas_admin côté serveur (jamais via le navigateur).
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("role, is_active")
      .eq("id", userData.user.id)
      .maybeSingle();
    if (profileError) return json(500, { ok: false, error: profileError.message });
    if (!profile || profile.role !== "saas_admin" || profile.is_active === false) {
      return json(403, { ok: false, error: "Accès refusé : Super Admin uniquement" });
    }

    // 3) Valider l'entrée.
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return json(400, { ok: false, error: "JSON invalide" });

    const {
      requestId, companyName, slug, city, phone, email,
      plan, trialDays, managerName, managerEmail, managerPhone,
    } = body as Record<string, unknown>;

    const requestIdStr = typeof requestId === "string" ? requestId.trim() : "";
    const company = typeof companyName === "string" ? companyName.trim() : "";
    const companySlug = typeof slug === "string" ? slug.trim().toLowerCase() : "";
    const trial = Number(trialDays ?? 14);
    const mgrName = typeof managerName === "string" ? managerName.trim() : "";
    const mgrEmail = typeof managerEmail === "string" ? managerEmail.trim().toLowerCase() : "";
    const planCode = typeof plan === "string" ? plan : "standard";

    const errors: string[] = [];
    if (!requestIdStr) errors.push("requestId manquant (uuid généré par le client).");
    if (!company) errors.push("Le nom de l'entreprise est obligatoire.");
    if (!companySlug || !SLUG_REGEX.test(companySlug)) errors.push("Slug invalide (minuscules, chiffres, tirets).");
    if (!PLANS.has(planCode)) errors.push("Forfait invalide (standard, silver, gold).");
    if (!Number.isFinite(trial) || trial < 0 || trial > 90) errors.push("Durée d'essai invalide (0 à 90 jours).");
    if (!mgrName) errors.push("Le nom du Manager est obligatoire.");
    if (!mgrEmail || !EMAIL_REGEX.test(mgrEmail)) errors.push("Email du Manager invalide.");
    if (email && typeof email === "string" && email.trim() && !EMAIL_REGEX.test(email.trim())) {
      errors.push("Email de l'entreprise invalide.");
    }
    if (errors.length) return json(400, { ok: false, error: errors.join(" ") });

    // 4) Idempotence : une demande déjà traitée renvoie le résultat enregistré.
    const { data: existante } = await admin.rpc("admin_find_onboarding_request", { p_request_id: requestIdStr });
    if (existante) return json(200, { ok: true, ...(existante as Record<string, unknown>) });

    // 5) Un compte Auth existe déjà pour cet email → refuser (aucun doublon).
    const { data: existingId } = await admin.rpc("admin_find_user_id_by_email", { p_email: mgrEmail });
    if (existingId) {
      return json(409, { ok: false, error: "Un compte Auth existe déjà pour cet email.", existingUserId: existingId });
    }

    // 6) Inviter le Manager (email d'invitation — JAMAIS de mot de passe en clair).
    const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(mgrEmail, {
      data: { full_name: mgrName },
    });
    if (inviteError || !inviteData?.user) {
      return json(400, { ok: false, error: `Invitation impossible : ${inviteError?.message ?? "erreur inconnue"}` });
    }
    const invitedUserId = inviteData.user.id;

    // 7) Association atomique via RPC transactionnelle.
    const { data: result, error: rpcError } = await admin.rpc("admin_onboard_tenant", {
      p_company_name: company,
      p_slug: companySlug,
      p_city: typeof city === "string" ? city : null,
      p_phone: typeof phone === "string" ? phone : null,
      p_email: typeof email === "string" ? email : null,
      p_plan: planCode,
      p_manager_user_id: invitedUserId,
      p_manager_name: mgrName,
      p_manager_phone: typeof managerPhone === "string" ? managerPhone : null,
      p_trial_days: trial,
      p_request_id: requestIdStr,
    });

    if (rpcError) {
      // Compensation : supprimer le compte invité pour éviter un orphelin.
      await admin.auth.admin.deleteUser(invitedUserId).catch(() => undefined);
      return json(400, {
        ok: false,
        error: `Échec de l'onboarding : ${rpcError.message}. L'invitation a été annulée automatiquement.`,
      });
    }

    return json(200, { ok: true, ...(result as Record<string, unknown>) });
  } catch (err) {
    return json(500, { ok: false, error: String((err as Error)?.message ?? err) });
  }
});
