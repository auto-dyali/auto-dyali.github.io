/**
 * AUTO DYALI — GV5 §112 — Suppression définitive d'un abonné de test.
 *
 * Sécurité :
 *  - JWT vérifié deux fois (passerelle Supabase + auth.getUser ici) ;
 *  - la RPC SQL revérifie is_saas_admin et le marquage is_test ;
 *  - les comptes Auth ne sont supprimés qu'APRÈS le succès SQL ;
 *  - clé service_role lue côté serveur, jamais journalisée ni renvoyée.
 *
 * Aucun secret, aucun nom, aucun e-mail n'est écrit dans les journaux.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const fail = (status: number, message: string) => json({ ok: false, error: message }, status);

const env = (name: string) => Deno.env.get(name) ?? "";

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return fail(405, "Méthode POST requise.");

  const authorisation = req.headers.get("Authorization") ?? "";
  const jwt = authorisation.startsWith("Bearer ") ? authorisation.slice(7) : "";
  if (!jwt) return fail(401, "Session Super Admin requise.");

  let corps: Record<string, unknown>;
  try {
    corps = await req.json();
  } catch {
    return fail(400, "Corps JSON invalide.");
  }
  const establishmentId = typeof corps.establishmentId === "string" ? corps.establishmentId : "";
  const confirmName = typeof corps.confirmName === "string" ? corps.confirmName : "";
  const dryRun = corps.dryRun !== false;
  if (!/^[0-9a-f-]{36}$/i.test(establishmentId) || !confirmName) {
    return fail(400, "Paramètres incomplets.");
  }

  const url = env("SUPABASE_URL");
  const anon = env("SUPABASE_ANON_KEY");
  const service = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anon || !service) {
    return fail(503, "Configuration serveur incomplète.");
  }

  try {
    const appelant = createClient(url, anon, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: utilisateur, error: jwtError } = await appelant.auth.getUser(jwt);
    if (jwtError || !utilisateur?.user) return fail(401, "Session invalide.");

    const { data, error } = await appelant.rpc("admin_purge_establishment", {
      p_establishment_id: establishmentId,
      p_confirm_name: confirmName,
      p_dry_run: dryRun,
    });
    if (error) {
      const message = error.message ?? "refusé";
      const statut = /ACCES_REFUSE/i.test(message) ? 403
        : /INTROUVABLE|NOM_DE_CONFIRMATION|NON_MARQUE_TEST|PROTEGE/i.test(message) ? 400
        : /COMPTABLES|INCOMPLETE/i.test(message) ? 409 : 400;
      return fail(statut, message);
    }

    const resultat = (data ?? {}) as Record<string, unknown>;
    if (dryRun) return json({ ok: true, dry_run: true, ...resultat });

    /* SQL réussi : nettoyage Auth, avec reprise idempotente des échecs. */
    const admin = createClient(url, service, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const comptes = Array.isArray(resultat.comptes_auth_a_supprimer)
      ? (resultat.comptes_auth_a_supprimer as unknown[]).filter(
          (v): v is string => typeof v === "string",
        )
      : [];
    let supprimes = 0;
    const aNettoyer: string[] = [];
    for (const compte of comptes) {
      const { error: deleteError } = await admin.auth.admin.deleteUser(compte);
      if (deleteError) aNettoyer.push(compte);
      else supprimes++;
    }

    return json({
      ok: true,
      dry_run: false,
      comptes_supprimes: supprimes,
      comptes_a_nettoyer: aNettoyer.length,
      ...resultat,
      comptes_auth_a_supprimer: undefined,
    });
  } catch (erreur) {
    return fail(500, `Erreur serveur : ${(erreur as Error)?.message ?? "inconnue"}`);
  }
});
