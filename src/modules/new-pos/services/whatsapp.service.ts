/**
 * NEW POS — Service WhatsApp.
 * AUCUN envoi simulé : sans consentement client ni jeton WhatsApp Business
 * configuré, rien n'est marqué "envoyé" — l'état reste "échec/attente"
 * avec la raison réelle. Consentements séparés : service ≠ marketing.
 * L'espace client lit les notifications in-app (table existante).
 */

import { supabase } from "@/lib/supabase-browser";

export type TypeNotification =
  | "rendez_vous" | "intervention" | "vehicule_pret" | "entretien"
  | "verification_3_mois" | "facture" | "rappel_paiement" | "promotion";

export type TypeConsentement = "service" | "marketing";

export const NOTIF_LABEL: Record<TypeNotification, string> = {
  rendez_vous: "Rendez-vous", intervention: "Intervention", vehicule_pret: "Véhicule prêt",
  entretien: "Entretien", verification_3_mois: "Vérification après 3 mois", facture: "Facture",
  rappel_paiement: "Rappel de paiement", promotion: "Promotions",
};

/** Notification marketing → consentement marketing. Les autres → service. */
export function consentementRequis(t: TypeNotification): TypeConsentement {
  return t === "promotion" ? "marketing" : "service";
}

/** Consentement client (colonne clients.consents — migration 0025). */
async function consentementOk(clientId: string, genre: TypeConsentement): Promise<boolean> {
  if (!supabase) return false;
  const { data, error } = await supabase
    .from("clients")
    .select("consents")
    .eq("id", clientId)
    .maybeSingle();
  if (error || !data) return false; // colonne absente ou erreur → consentement inconnu = refus
  return (data.consents as Record<string, string> | null)?.[genre] === "oui";
}

export async function envoyerNotification(
  clientId: string,
  type: TypeNotification,
  texte: string,
): Promise<{ ok: boolean; canal: "whatsapp" | "in_app" | null; etat: "envoye" | "attente" | "echec"; erreur?: string }> {
  if (!supabase) return { ok: false, canal: null, etat: "echec", erreur: "Supabase non configuré." };

  // Consentement réel avant tout envoi.
  const genre = consentementRequis(type);
  if (!(await consentementOk(clientId, genre))) {
    return { ok: true, canal: null, etat: "echec", erreur: `Consentement « ${genre} » absent pour ce client.` };
  }

  // 1) Notification in-app (toujours réelle — l'espace client la lit).
  const { error: eNotif } = await supabase.from("client_notifications").insert({
    client_id: clientId,
    title: NOTIF_LABEL[type],
    body: texte,
  });
  if (eNotif) return { ok: false, canal: null, etat: "echec", erreur: eNotif.message };

  // 2) WhatsApp : UNIQUEMENT si un jeton d'API Business est configuré côté
  //    serveur/webhook. JAMAIS de jeton dans le frontend.
  const jeton = typeof process !== "undefined" ? process.env.WHATSAPP_BUSINESS_TOKEN : undefined;
  const phoneId = typeof process !== "undefined" ? process.env.WHATSAPP_PHONE_ID : undefined;
  if (!jeton || !phoneId) {
    return { ok: true, canal: "in_app", etat: "attente", erreur: "WhatsApp Business non configuré — livraison in-app possible ; envoi WhatsApp en attente." };
  }

  // Envoi réel — capable d'échouer honnêtement.
  try {
    const client = await supabase.from("clients").select("phone").eq("id", clientId).single();
    const telTo = client.data?.phone?.replace(/[^\d+]/g, "");
    if (!telTo) return { ok: true, canal: "in_app", etat: "echec", erreur: "Téléphone client manquant — WhatsApp non envoyé." };
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${phoneId}/messages`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${jeton}`, "Content-Type": "application/json" },
        body: JSON.stringify({ messaging_product: "whatsapp", to: telTo, type: "text", text: { body: texte } }),
      },
    );
    if (!res.ok) return { ok: true, canal: "in_app", etat: "echec", erreur: `API WhatsApp : statut ${res.status}` };
    return { ok: true, canal: "whatsapp", etat: "envoye" };
  } catch (e) {
    return { ok: true, canal: "in_app", etat: "echec", erreur: `Expédition WhatsApp impossible : ${e instanceof Error ? e.message : "réseau"}` };
  }
}
