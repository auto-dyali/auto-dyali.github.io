/**
 * AUTO DYALI — Edge Function `stripe-webhook` (GV5 §79)
 *
 * Vérifie CÔTÉ SERVEUR la signature Stripe (HMAC-SHA256) avant toute écriture.
 * Aucun paiement n'est enregistré ni déclaré confirmé sans cette vérification.
 * Sans STRIPE_WEBHOOK_SECRET, la fonction répond 503 de façon explicite :
 * aucun succès simulé. Idempotence par l'event_id Stripe (unique en base).
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "stripe-signature, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}
function env(n: string): string | null {
  const v = Deno.env.get(n);
  return v && v.trim() ? v.trim() : null;
}

/** HMAC-SHA256 via Web Crypto (available dans le runtime Supabase). */
async function hmacSha256(secret: string, message: string): Promise<string> {
  const cle = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", cle, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(signature), (b) => b.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let dif = 0;
  for (let i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return dif === 0;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { ok: false, error: "POST requis." });

  const secret = env("STRIPE_WEBHOOK_SECRET");
  if (!secret) {
    return json(503, {
      ok: false,
      error: "Stripe non configuré : STRIPE_WEBHOOK_SECRET absent. Aucun événement enregistré.",
    });
  }
  const url = env("SUPABASE_URL");
  const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json(503, { ok: false, error: "Environnement Supabase incomplet." });

  const header = req.headers.get("stripe-signature") ?? "";
  const parties = Object.fromEntries(
    header.split(",").map((p) => {
      const i = p.indexOf("=");
      return [p.slice(0, i).trim(), p.slice(i + 1).trim()];
    }),
  );
  const timestamp = parties["t"] ?? "";
  const attendue = parties["v1"] ?? "";
  if (!/^\d+$/.test(timestamp) || !attendue) {
    return json(400, { ok: false, error: "En-tête Stripe-Signature invalide." });
  }
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (age > 300) return json(400, { ok: false, error: "Signature Stripe expirée (tolérance 5 min)." });

  const brut = await req.text();
  const calculee = await hmacSha256(secret, `${timestamp}.${brut}`);
  if (!constantTimeEqual(calculee, attendue)) {
    return json(400, { ok: false, error: "Signature Stripe invalide : aucun événement enregistré." });
  }

  let evenement: Record<string, unknown>;
  try {
    evenement = JSON.parse(brut) as Record<string, unknown>;
  } catch {
    return json(400, { ok: false, error: "Corps JSON invalide." });
  }
  const eventId = String(evenement.id ?? "");
  const eventType = String(evenement.type ?? "");
  if (!eventId || !eventType) return json(400, { ok: false, error: "Événement Stripe incomplet." });

  const objet = ((evenement.data as Record<string, unknown> | undefined)?.object ?? {}) as Record<string, unknown>;
  const meta = (objet.metadata ?? {}) as Record<string, unknown>;
  const etab = typeof meta.establishment_id === "string" && UUID.test(meta.establishment_id)
    ? meta.establishment_id : null;
  const sub = typeof meta.subscription_id === "string" && UUID.test(meta.subscription_id)
    ? meta.subscription_id : null;
  const montant = typeof objet.amount_total === "number" ? objet.amount_total / 100 : null;
  const devise = typeof objet.currency === "string" ? objet.currency : null;
  const statut = typeof objet.status === "string" ? objet.status : eventType;
  const admin = createAdmin(url, serviceKey);

  const { data, error } = await admin.rpc("admin_record_billing_event", {
    p_event_id: eventId,
    p_event_type: eventType,
    p_establishment_id: etab,
    p_subscription_id: sub,
    p_amount: montant,
    p_currency: devise,
    p_status: statut,
    p_payload: { objet, event_type: eventType },
  });
  if (error) return json(400, { ok: false, error: `Enregistrement refusé : ${error.message}` });

  return json(200, { ok: true, idempotent: Boolean((data as { idempotent?: boolean })?.idempotent), event_id: eventId });
});

// Import statique gardé en bas pour clarté : le client n'est jamais exposé au navigateur.
import { createClient as createAdmin } from "https://esm.sh/@supabase/supabase-js@2.45.4";
