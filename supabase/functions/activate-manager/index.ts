/**
 * AUTO DYALI — Edge Function `activate-manager`
 *
 * Parcours d'activation réel, sans `signUp` inadapté :
 *   1. `preview`  : décrit l'invitation SANS la consommer (jeton non usé) ;
 *   2. `activate` : définit le mot de passe du compte Auth existant via
 *                   `auth.admin.updateUserById` (service_role), consomme
 *                   l'invitation à usage unique, efface le drapeau de
 *                   rotation temporaire et VÉRIFIE la connexion réelle.
 *
 * Sécurité :
 *   - le jeton brut n'est jamais stocké (empreinte SHA-256 en base) ;
 *   - aucune donnée d'un autre établissement n'est renvoyée ;
 *   - aucun mot de passe n'est journalisé ni renvoyé ;
 *   - un jeton expiré / déjà utilisé produit un message explicite.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { sha256Hex } from "../_shared/providers.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TOKEN_REGEX = /^[a-f0-9]{64}$/i;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function fail(status: number, code: string, error: string): Response {
  return json(status, { ok: false, code, error });
}

function env(name: string): string | null {
  const value = Deno.env.get(name);
  return value && value.trim() ? value.trim() : null;
}

function validatePassword(password: unknown, confirmation: unknown): string | null {
  if (typeof password !== "string" || password.length < 10) {
    return "Le mot de passe doit contenir au moins 10 caractères.";
  }
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return "Le mot de passe doit contenir au moins une lettre et un chiffre.";
  }
  if (confirmation !== password) return "Les mots de passe ne correspondent pas.";
  return null;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return fail(405, "method", "Méthode POST requise.");

  try {
    const SUPABASE_URL = env("SUPABASE_URL");
    const SUPABASE_ANON_KEY = env("SUPABASE_ANON_KEY");
    const SUPABASE_SERVICE_ROLE_KEY = env("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
      return fail(500, "server", "Environnement serveur incomplet.");
    }

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return fail(400, "payload", "Corps JSON invalide.");

    const token = typeof body.token === "string" ? body.token.trim() : "";
    if (!TOKEN_REGEX.test(token)) return fail(400, "invalid", "Jeton d'activation invalide.");

    const action = body.action === "activate" ? "activate" : "preview";
    const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    /* ---------- 1. Prévisualisation : aucune consommation ---------- */
    if (action === "preview") {
      const { data, error } = await anon.rpc("admin_invitation_preview", { p_token: token });
      if (error) {
        const message = error.message ?? "Invitation indisponible.";
        const code = /expir/i.test(message)
          ? "expired"
          : /deja|déjà|utilis/i.test(message)
            ? "used"
            : /invalide|inconnu|introuvable/i.test(message)
              ? "invalid"
              : "error";
        return fail(code === "error" ? 500 : 400, code, message);
      }
      return json(200, { ok: true, ...(data as Record<string, unknown>) });
    }

    /* ---------- 2. Activation réelle ---------- */
    const passwordError = validatePassword(body.password, body.passwordConfirm);
    if (passwordError) return fail(400, "weak_password", passwordError);

    const tokenHash = await sha256Hex(token);
    const { data: invitation, error: invitationError } = await admin
      .from("invitations")
      .select("id, email, manager_user_id, establishment_id, status, expires_at")
      .eq("token_hash", tokenHash)
      .maybeSingle();
    if (invitationError) {
      return fail(500, "error", `Lecture de l'invitation impossible : ${invitationError.message}`);
    }
    if (!invitation) return fail(400, "invalid", "Jeton d'activation invalide ou inconnu.");
    if (invitation.status === "accepted") {
      return fail(400, "used", "Cette invitation a déjà été utilisée.");
    }
    if (invitation.status === "cancelled") {
      return fail(400, "invalid", "Cette invitation a été annulée.");
    }
    if (
      invitation.status === "expired" ||
      invitation.status === "failed" ||
      new Date(invitation.expires_at).getTime() < Date.now()
    ) {
      return fail(400, "expired", "Cette invitation a expiré.");
    }
    if (!invitation.manager_user_id) {
      return fail(409, "invalid", "Aucun compte Manager n'est associé à cette invitation.");
    }

    /* 2a. Mot de passe défini par Supabase Auth (jamais stocké en clair). */
    const { error: updateError } = await admin.auth.admin.updateUserById(
      invitation.manager_user_id,
      {
        password: String(body.password),
        email_confirm: true,
      },
    );
    if (updateError) {
      return fail(400, "weak_password", `Définition du mot de passe impossible : ${updateError.message}`);
    }

    /* 2b. Consommation atomique + preuve de rotation (RPC 0036/0039). */
    const { data: accepted, error: acceptError } = await admin.rpc("admin_accept_invitation", {
      p_token: token,
      p_user_id: invitation.manager_user_id,
    });
    if (acceptError) {
      const message = acceptError.message ?? "Activation impossible.";
      const code = /expir/i.test(message)
        ? "expired"
        : /deja|déjà|utilis/i.test(message)
          ? "used"
          : /invalide|inconnu|introuvable|correspond/i.test(message)
            ? "invalid"
            : "error";
      return fail(code === "error" ? 500 : 400, code, message);
    }

    /* 2c. Vérification réelle : la connexion doit fonctionner tout de suite. */
    const { error: signInError } = await anon.auth.signInWithPassword({
      email: invitation.email,
      password: String(body.password),
    });
    if (signInError) {
      return fail(
        500,
        "login_check_failed",
        "Le mot de passe a été enregistré mais la connexion de vérification a échoué. Contactez le support.",
      );
    }
    await anon.auth.signOut().catch(() => undefined);

    /* 2d. Informations de connexion du Manager (aucun secret). */
    const { data: profile } = await admin
      .from("profiles")
      .select("login_id, full_name, establishment_id")
      .eq("id", invitation.manager_user_id)
      .maybeSingle();

    return json(200, {
      ok: true,
      status: "activated",
      email: invitation.email,
      login_id: profile?.login_id ?? null,
      full_name: profile?.full_name ?? null,
      establishment_id: (accepted as Record<string, unknown>)?.establishment_id ?? invitation.establishment_id,
      must_change_password: false,
    });
  } catch (error) {
    return fail(500, "error", `Erreur serveur : ${String((error as Error)?.message ?? error)}`);
  }
});
