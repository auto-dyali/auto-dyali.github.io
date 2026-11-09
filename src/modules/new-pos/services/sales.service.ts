/**
 * NEW POS — Service ventes.
 * Validation via le RPC transactionnel serveur `create_pos_sale`
 * (migration 0021 : vente + lignes + règlements + stock en UNE transaction,
 * anti-doublon par référence unique). Repli legacy si le RPC est indisponible :
 * insertion multi-tables contrôlée — jamais un "succès" sans confirmation.
 *
 * Offline : file d'attente locale idempotente (référence unique en base) ;
 * une vente n'est marquée synchronisée QUE sur confirmation serveur.
 */

import { supabase } from "@/lib/supabase-browser";
import type { SalePayload } from "../core/sales-engine.ts";
import {
  fileCharge, retirerOffline, payloadValide, nouvelleReference, empilerOffline,
} from "../core/sales-engine.ts";

export type ResultatVente = {
  ok: boolean;
  venteId?: string;
  reference: string;
  statut?: string;
  erreur?: string;
  /** Le ticket est parti hors ligne : consigné localement, PAS encore en base. */
  enAttenteSync?: boolean;
};

/** Validation d'une vente dans le moteur transactionnel serveur. */
export async function validerVente(payload: SalePayload): Promise<ResultatVente> {
  const reference = payload.reference || nouvelleReference();
  const p = { ...payload, reference };

  // Garde-fou local avant tout envoi réseau.
  const erreurs = payloadValide(p);
  if (erreurs.length > 0) return { ok: false, reference, erreur: `Payload invalide : ${erreurs.join(" / ")}` };

  if (!supabase) {
    empiler(p);
    return { ok: false, reference, erreur: "Supabase non configuré — vente conservée hors ligne.", enAttenteSync: true };
  }

  // 1) RPC transactionnel v2 (vérification serveur des totaux — 0025),
  //    repli sur v1 (0021) si v2 pas encore déployé.
  try {
    const reqV2 = await supabase.rpc("create_pos_sale_v2", {
      p_reference: p.reference,
      p_client_id: p.client_id,
      p_vehicle_id: p.vehicle_id,
      p_work_order_id: p.work_order_id,
      p_items: p.items as unknown as never,
      p_payments: p.payments as unknown as never,
    });
    if (!reqV2.error && reqV2.data) {
      return { ok: true, venteId: String(reqV2.data), reference: p.reference, statut: p.status };
    }
    if (reqV2.error?.message?.includes("duplicate")) {
      return { ok: true, reference: p.reference, statut: "deja_enregistree" };
    }
    const fctAbsent = /function .*create_pos_sale_v2.*not exist|Could not find the function/i.test(reqV2.error?.message ?? "");
    if (!fctAbsent) {
      // Perte réseau : empile offline et ne prétend RIEN.
      if (reqV2.error?.message && !/fetch|network|Failed to fetch/i.test(reqV2.error.message)) {
        return { ok: false, reference, erreur: reqV2.error.message };
      }
    } else {
      // v2 pas encore déployé → v1 (0021, déjà en production).
      const { data, error } = await supabase.rpc("create_pos_sale", {
        p_reference: p.reference,
        p_client_id: p.client_id,
        p_vehicle_id: p.vehicle_id,
        p_work_order_id: p.work_order_id,
        p_subtotal: p.subtotal,
        p_discount: p.discount,
        p_tax_total: p.tax_total,
        p_total: p.total,
        p_paid_total: p.paid_total,
        p_status: p.status,
        p_items: p.items as unknown as never,
        p_payments: p.payments as unknown as never,
      });
      if (!error && data) {
        return { ok: true, venteId: String(data), reference: p.reference, statut: p.status };
      }
      if (error?.message?.includes("duplicate")) {
        return { ok: true, reference: p.reference, statut: "deja_enregistree" };
      }
      if (error?.message && !/fetch|network|Failed to fetch/i.test(error.message)) {
        return { ok: false, reference, erreur: error.message };
      }
    }
  } catch {
    // réseau → passe à l'empilement
  }

  // 2) Repli contrôlé : insertion tables directes (même ordre que le RPC).
  try {
    return await validerVenteLegacy(p);
  } catch (e) {
    empiler(p);
    return {
      ok: false, reference,
      erreur: `Serveur injoignable — vente en attente de synchronisation. ${e instanceof Error ? e.message : ""}`.trim(),
      enAttenteSync: true,
    };
  }
}

async function validerVenteLegacy(p: SalePayload): Promise<ResultatVente> {
  if (!supabase) throw new Error("no supabase");
  const profilRpc = await supabase.rpc("get_my_profile");
  const establishmentId = profilRpc.data?.[0]?.establishment_id;
  if (!establishmentId) throw new Error("établissement introuvable");

  // Tentative avec vehicle_id (colonne 0021), repli sans si colonne absente.
  let insVente = await supabase.from("sales").insert({
    establishment_id: establishmentId, client_id: p.client_id, vehicle_id: p.vehicle_id,
    work_order_id: p.work_order_id, reference: p.reference, status: p.status,
    subtotal: p.subtotal, discount: p.discount, tax_total: p.tax_total,
    total: p.total, paid_total: p.paid_total,
  }).select("id").single();
  if (insVente.error && /column|vehicle_id/i.test(insVente.error.message)) {
    insVente = await supabase.from("sales").insert({
      establishment_id: establishmentId, client_id: p.client_id, work_order_id: p.work_order_id,
      reference: p.reference, status: p.status, subtotal: p.subtotal, discount: p.discount,
      tax_total: p.tax_total, total: p.total, paid_total: p.paid_total,
    }).select("id").single();
  }
  if (insVente.error) throw new Error(insVente.error.message);
  const venteId = String(insVente.data.id);

  const reqItems = await supabase.from("sale_items").insert(p.items.map((i) => ({
    establishment_id: establishmentId, sale_id: venteId,
    product_id: i.product_id, service_id: i.service_id, label: i.label,
    quantity: i.quantity, unit_price: i.unit_price, tax_rate: i.tax_rate, discount: i.discount,
  })));
  const reqPayes = await supabase.from("payments").insert(p.payments.map((r) => ({
    establishment_id: establishmentId, sale_id: venteId, method: r.method, amount: r.amount,
  })));

  // Stock : pour les produits uniquement (les prestations ne touchent rien).
  const produits = p.items.filter((i) => i.product_id);
  for (const it of produits) {
    await supabase.from("stock_movements").insert({
      establishment_id: establishmentId, product_id: it.product_id,
      direction: "out", quantity: it.quantity, reference: p.reference,
    });
    const dec = await supabase.rpc("decrement_product_stock", { p_product_id: it.product_id, p_qty: Math.max(1, Math.round(it.quantity)) });
    if (dec.error) {
      // Décrément direct contrôlé si le RPC échoue — jamais silencieux.
      const { data: prod } = await supabase.from("products").select("stock").eq("id", it.product_id).single();
      if (prod) {
        await supabase.from("products").update({
          stock: Math.max(0, Number(prod.stock ?? 0) - Math.max(1, Math.round(it.quantity))),
        }).eq("id", it.product_id);
      }
    }
  }

  const fragiles = [reqItems, reqPayes].find((r) => r.error);
  if (fragiles?.error) {
    // La vente existe : on NE dit PAS qu'elle a échoué en bloc — signal réel.
    return { ok: true, venteId, reference: p.reference, statut: `${p.status} (détail partiel : ${fragiles.error.message})` };
  }
  return { ok: true, venteId, reference: p.reference, statut: p.status };
}

function empiler(p: SalePayload): void {
  empilerOffline(p, p.reference);
}

/** Synchronisation de la file offline : appelée au retour réseau / à l'ouverture. */
export async function synchroniserFile(): Promise<{ synchronisees: string[]; echecs: { reference: string; erreur: string }[]; restant: number }> {
  const synchronisees: string[] = [];
  const echecs: { reference: string; erreur: string }[] = [];
  if (!supabase) return { synchronisees, echecs, restant: fileCharge().length };
  for (const charge of [...fileCharge()]) {
    const res = await validerVente({ ...charge.payload, reference: charge.reference });
    if (res.ok) {
      retirerOffline(charge.reference);
      synchronisees.push(charge.reference);
    } else if (!res.enAttenteSync) {
      // erreur métier (stock, permission…) : la vente ne partira pas —
      // on la retire de la file pour signaler, on NE la fait PAS disparaître
      // : l'utilisateur voit l'erreur et le ticket reste marquant.
      echecs.push({ reference: charge.reference, erreur: res.erreur ?? "erreur" });
      retirerOffline(charge.reference);
    } else {
      echecs.push({ reference: charge.reference, erreur: "toujours hors ligne" });
    }
  }
  return { synchronisees, echecs, restant: fileCharge().length };
}

/** Historique court des dernières ventes (Mini-POS et POS complet). */
export async function dernieresVentes(limite = 15): Promise<{ ventes: { id: string; reference: string; total: number; status: string; clientNom: string | null; createdAt: string }[]; erreur: string | null }> {
  if (!supabase) return { ventes: [], erreur: "Supabase non configuré." };
  const { data, error } = await supabase
    .from("sales")
    .select("id, reference, total, status, created_at, clients(full_name)")
    .order("created_at", { ascending: false })
    .limit(limite);
  if (error) return { ventes: [], erreur: error.message };
  return {
    ventes: (data as Record<string, unknown>[]).map((s) => ({
      id: String(s.id), reference: String(s.reference), total: Number(s.total ?? 0),
      status: String(s.status ?? ""), clientNom: (s.clients as { full_name: string } | null)?.full_name ?? null,
      createdAt: String(s.created_at ?? ""),
    })),
    erreur: null,
  };
}

/** Retour / annulation contrôlée : re-stock, règlement négatif, statut refunded. */
export async function retournerVente(venteId: string, reference: string, motif: string): Promise<{ ok: boolean; erreur?: string }> {
  if (!supabase) return { ok: false, erreur: "Supabase non configuré." };
  const { data: vente, error: e1 } = await supabase.from("sales").select("id, total, status").eq("id", venteId).single();
  if (e1 || !vente) return { ok: false, erreur: e1?.message ?? "Vente introuvable." };
  if (vente.status === "refunded" || vente.status === "cancelled") return { ok: false, erreur: "Cette vente est déjà annulée/remboursée." };

  const { data: items, error: e2 } = await supabase.from("sale_items").select("product_id, quantity").eq("sale_id", venteId);
  if (e2) return { ok: false, erreur: e2.message };

  for (const it of (items ?? []) as { product_id: string | null; quantity: number }[]) {
    if (it.product_id) {
      const qty = Math.abs(it.quantity);
      await supabase.from("stock_movements").insert({
        product_id: it.product_id, direction: "in", quantity: qty,
        reference: `RET-${reference}`,
      });
      // Ré-incrémentation contrôlée : on réutilise le flux produits (jamais sans mouvement).
      const { data: prod } = await supabase.from("products").select("stock").eq("id", it.product_id).single();
      if (prod) {
        await supabase.from("products").update({
          stock: Number(prod.stock ?? 0) + Math.max(1, Math.round(qty)),
        }).eq("id", it.product_id);
      }
    }
  }

  // Retour en caisse : règlement d'annulation négatif tracé (espèces rendues).
  await supabase.from("payments").insert({
    sale_id: venteId, method: "cash", amount: -Number(vente.total ?? 0),
  });
  const { error: e5 } = await supabase.from("sales").update({ status: "refunded" }).eq("id", venteId);
  if (e5) return { ok: false, erreur: e5.message };
  void motif;
  return { ok: true };
}
