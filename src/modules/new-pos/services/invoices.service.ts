/**
 * NEW POS — Service facturation.
 * Une facture = numéro UNIQUE par établissement, rattachée à une vente réelle.
 * Jamais deux numéros identiques (contrainte unique serveur).
 */

import { supabase } from "@/lib/supabase-browser";

export async function creerFacture(venteId: string, totalCent: number): Promise<{ numero: string | null; erreur: string | null }> {
  if (!supabase) return { numero: null, erreur: "Supabase non configuré." };
  const profilRpc = await supabase.rpc("get_my_profile");
  const establishmentId = profilRpc.data?.[0]?.establishment_id;
  if (!establishmentId) return { numero: null, erreur: "Établissement introuvable." };
  const auj = new Date();
  const seq = Date.now().toString(36).slice(-5).toUpperCase();
  const numero = `FAC-${auj.getFullYear()}${String(auj.getMonth() + 1).padStart(2, "0")}-${seq}`;
  const { error } = await supabase.from("invoices").insert({
    establishment_id: establishmentId,
    sale_id: venteId,
    number: numero,
    total: totalCent / 100,
  });
  if (error) {
    if (error.message.includes("duplicate")) return { numero: null, erreur: "Numéro déjà utilisé — réessayez (référence unique)." };
    return { numero: null, erreur: error.message };
  }
  return { numero, erreur: null };
}
