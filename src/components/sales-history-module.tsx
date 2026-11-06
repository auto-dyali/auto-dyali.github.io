"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase-browser";
import { formatMad } from "@/lib/catalogue-test";

/**
 * Historique des ventes — §6 du cahier des charges.
 * - Liste réelle des ventes (table sales).
 * - Encaissement ultérieur des ventes à crédit / partielles.
 * - Génération de facture (table invoices, numéro unique).
 * - Retour / avoir : annulation de la vente + retour en stock + remboursement tracé.
 */

type Vente = {
  id: string;
  reference: string;
  status: string;
  subtotal: number;
  discount: number;
  tax_total: number;
  total: number;
  paid_total: number;
  created_at: string;
  client_id: string | null;
  client_nom?: string | null;
  invoice_number?: string | null;
};

type Facture = { id: string; number: string; total: number; issued_at: string; sale_id: string };

const STATUTS: Record<string, { label: string; classe: string }> = {
  open: { label: "À encaisser", classe: "bg-[#d6b66f]/15 text-[#e9d998]" },
  partial: { label: "Partiel", classe: "bg-[#d6b66f]/20 text-[#e9d998]" },
  paid: { label: "Payée", classe: "bg-[#38a987]/20 text-[#69d3a8]" },
  refunded: { label: "Remboursée", classe: "bg-[#d66868]/15 text-[#d66868]" },
  cancelled: { label: "Annulée", classe: "bg-[#21464b] text-[#a8bb87]" },
};

const METHODES: { cle: string; label: string }[] = [
  { cle: "cash", label: "Espèces" },
  { cle: "card", label: "Carte" },
  { cle: "cheque", label: "Chèque" },
  { cle: "transfer", label: "Virement" },
  { cle: "mobile", label: "Mobile" },
];

export function SalesHistoryModule() {
  const [ventes, setVentes] = useState<Vente[]>([]);
  const [factures, setFactures] = useState<Facture[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [traitement, setTraitement] = useState<string | null>(null);

  const [recherche, setRecherche] = useState("");
  const [filtre, setFiltre] = useState("tous");

  // Encaissement différé
  const [encaissement, setEncaissement] = useState<Vente | null>(null);
  const [montantRecu, setMontantRecu] = useState("");
  const [methode, setMethode] = useState("cash");

  // Retour
  const [retour, setRetour] = useState<Vente | null>(null);
  const [motifRetour, setMotifRetour] = useState("");

  async function charger() {
    if (!supabase) {
      setError("Supabase n’est pas configuré.");
      setLoading(false);
      return;
    }
    const [ventesReq, facturesReq] = await Promise.all([
      supabase
        .from("sales")
        .select("id, reference, status, subtotal, discount, tax_total, total, paid_total, created_at, client_id, clients(full_name)")
        .order("created_at", { ascending: false })
        .limit(200),
      supabase.from("invoices").select("id, number, total, issued_at, sale_id"),
    ]);
    if (ventesReq.error) setError(ventesReq.error.message);
    else {
      const rows = (ventesReq.data ?? []) as unknown as (Vente & { clients: { full_name: string } | null })[];
      setVentes(rows.map((v) => ({ ...v, client_nom: v.clients?.full_name ?? null })));
    }
    if (!facturesReq.error) setFactures((facturesReq.data ?? []) as Facture[]);
    setLoading(false);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void charger(), 0);
    return () => window.clearTimeout(timer);
    // Rechargement initial unique.
  }, []);

  const factureParVente = useMemo(() => {
    const map = new Map<string, string>();
    for (const f of factures) map.set(f.sale_id, f.number);
    return map;
  }, [factures]);

  const ventesFiltrees = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return ventes.filter((v) => {
      const okF =
        filtre === "tous" ||
        (filtre === "du" && ["open", "partial"].includes(v.status)) ||
        v.status === filtre;
      const okQ = !q || v.reference.toLowerCase().includes(q) || (v.client_nom ?? "").toLowerCase().includes(q) || (factureParVente.get(v.id) ?? "").toLowerCase().includes(q);
      return okF && okQ;
    });
  }, [ventes, recherche, filtre, factureParVente]);

  const totalDu = ventes
    .filter((v) => ["open", "partial"].includes(v.status))
    .reduce((s, v) => s + Math.max(0, Number(v.total) - Number(v.paid_total)), 0);

  /* ---------------------------------------------------------------
   * Actions
   * --------------------------------------------------------------- */
  async function encaisserVente() {
    if (!supabase || !encaissement) return;
    setError(null);
    const reste = Math.max(0, Number(encaissement.total) - Number(encaissement.paid_total));
    const montant = Number(montantRecu) || 0;
    if (montant <= 0) { setError("Saisissez le montant encaissé."); return; }
    if (montant > reste + 0.001) { setError(`Montant supérieur au reste dû (${formatMad(reste)}).`); return; }

    setTraitement(encaissement.id);
    try {
      const { data: profileRows } = await supabase.rpc("get_my_profile");
      const establishmentId = profileRows?.[0]?.establishment_id;
      if (!establishmentId) throw new Error("Établissement introuvable.");
      const { data: sessionData } = await supabase.auth.getSession();

      const { error: payError } = await supabase.from("payments").insert({
        establishment_id: establishmentId,
        sale_id: encaissement.id,
        method: methode,
        amount: montant,
        received_by: sessionData.session?.user.id ?? null,
      });
      if (payError) throw new Error(payError.message);

      const nouveauTotal = Number(encaissement.paid_total) + montant;
      const statut = nouveauTotal >= Number(encaissement.total) - 0.001 ? "paid" : "partial";
      const { error: majError } = await supabase
        .from("sales")
        .update({ paid_total: nouveauTotal, status: statut })
        .eq("id", encaissement.id);
      if (majError) throw new Error(majError.message);

      setNotice(`Encaissement de ${formatMad(montant)} enregistré pour ${encaissement.reference} — ${statut === "paid" ? "vente soldée" : `reste ${formatMad(Number(encaissement.total) - nouveauTotal)}`}.`);
      setEncaissement(null);
      setMontantRecu("");
      await charger();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Encaissement impossible.");
    } finally {
      setTraitement(null);
    }
  }

  async function genererFacture(vente: Vente) {
    if (!supabase) return;
    setTraitement(vente.id);
    setError(null);
    try {
      const { data: profileRows } = await supabase.rpc("get_my_profile");
      const establishmentId = profileRows?.[0]?.establishment_id;
      if (!establishmentId) throw new Error("Établissement introuvable.");

      // Numéro dérivé de la vente (unique par vente → pas de collision possible)
      const suffixe = vente.reference.split("-").slice(-2).join("-");
      const numero = `FAC-${new Date().getFullYear()}-${suffixe}`;
      const { error: insertError } = await supabase.from("invoices").insert({
        establishment_id: establishmentId,
        sale_id: vente.id,
        number: numero,
        total: vente.total,
        issued_at: new Date().toISOString().slice(0, 10),
      });
      if (insertError) throw new Error(insertError.message);
      setNotice(`Facture ${numero} générée pour la vente ${vente.reference}.`);
      await charger();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Génération impossible.");
    } finally {
      setTraitement(null);
    }
  }

  async function imprimerFacture(vente: Vente) {
    if (!supabase) return;
    const numero = factureParVente.get(vente.id);
    const { data: items } = await supabase.from("sale_items").select("label, quantity, unit_price, tax_rate").eq("sale_id", vente.id);
    const fenetre = window.open("", "_blank", "width=760,height=840");
    if (!fenetre) { setError("Autorisez les fenêtres pop-up pour imprimer."); return; }
    const lignesHtml = (items ?? [])
      .map((l) => `<tr><td>${l.label}</td><td style="text-align:center">${l.quantity}</td><td style="text-align:right">${formatMad(Number(l.unit_price))}</td></tr>`)
      .join("");
    fenetre.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${numero ?? vente.reference}</title>
<style>body{font-family:ui-sans-serif,system-ui;font-size:14px;width:640px;margin:32px auto;color:#111}
h1{font-size:22px;margin:0}table{width:100%;border-collapse:collapse;margin-top:16px}
td,th{padding:8px;border-bottom:1px solid #ddd;text-align:left}.totaux{margin-top:16px;margin-left:auto;width:280px}
.totaux div{display:flex;justify-content:space-between;padding:4px 0}.tt{font-weight:bold;font-size:16px}
.muted{color:#666;font-size:12px}</style></head><body>
<h1>${numero ? `Facture ${numero}` : `Vente ${vente.reference}`}</h1>
<p class="muted">Client : ${vente.client_nom ?? "Comptoir"} — ${new Date(vente.created_at).toLocaleDateString("fr-FR")}</p>
<table><thead><tr><th>Désignation</th><th style="text-align:center">Qté</th><th style="text-align:right">PU</th></tr></thead><tbody>${lignesHtml}</tbody></table>
<div class="totaux">
<div><span>Total HT</span><span>${formatMad(Number(vente.subtotal))}</span></div>
${Number(vente.discount) > 0 ? `<div><span>Remise</span><span>− ${formatMad(Number(vente.discount))}</span></div>` : ""}
<div><span>TVA</span><span>${formatMad(Number(vente.tax_total))}</span></div>
<div class="tt"><span>Total TTC</span><span>${formatMad(Number(vente.total))}</span></div>
<div><span>Payé</span><span>${formatMad(Number(vente.paid_total))}</span></div>
${Number(vente.total) - Number(vente.paid_total) > 0.001 ? `<div><span>Reste dû</span><span>${formatMad(Number(vente.total) - Number(vente.paid_total))}</span></div>` : ""}
</div>
<p class="muted">AUTO DYALI — merci de votre confiance.</p></body></html>`);
    fenetre.document.close();
    fenetre.focus();
    fenetre.print();
  }

  async function retournerVente() {
    if (!supabase || !retour) return;
    setTraitement(retour.id);
    setError(null);
    try {
      const { data: profileRows } = await supabase.rpc("get_my_profile");
      const establishmentId = profileRows?.[0]?.establishment_id;
      if (!establishmentId) throw new Error("Établissement introuvable.");
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id ?? null;

      // 1) Retour en stock + mouvements
      const { data: items } = await supabase.from("sale_items").select("product_id, quantity").eq("sale_id", retour.id);
      for (const ligne of (items ?? []) as { product_id: string | null; quantity: number }[]) {
        if (!ligne.product_id) continue;
        await supabase.from("stock_movements").insert({
          establishment_id: establishmentId,
          product_id: ligne.product_id,
          direction: "in",
          quantity: ligne.quantity,
          reference: `RETOUR ${retour.reference}`,
          actor_id: userId,
        });
        // Remise à jour du stock réel (lecture + incrémentation défensive,
        // la RPC decrement_product_stock ne sait que décrémenter).
        const { data: produit } = await supabase.from("products").select("stock").eq("id", ligne.product_id).single();
        if (produit) {
          await supabase.from("products").update({ stock: Number(produit.stock) + ligne.quantity }).eq("id", ligne.product_id);
        }
      }

      // 2) Remboursement tracé (paiement négatif) si un montant avait été payé
      if (Number(retour.paid_total) > 0) {
        await supabase.from("payments").insert({
          establishment_id: establishmentId,
          sale_id: retour.id,
          method: "cash",
          amount: -Number(retour.paid_total),
          received_by: userId,
        });
      }

      // 3) Vente marquée remboursée
      const { error: majError } = await supabase
        .from("sales")
        .update({ status: "refunded", paid_total: 0 })
        .eq("id", retour.id);
      if (majError) throw new Error(majError.message);

      setNotice(
        `Vente ${retour.reference} remboursée et retournée en stock${motifRetour.trim() ? ` — motif : ${motifRetour.trim()}` : ""}.`,
      );
      setRetour(null);
      setMotifRetour("");
      await charger();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Retour impossible.");
    } finally {
      setTraitement(null);
    }
  }

  return (
    <section className="space-y-6">
      {/* KPI réels */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <article className="carte p-5">
          <p className="text-xs text-[#a8bb87]">Ventes</p>
          <p className="titre-or mt-1 text-2xl font-extrabold">{loading ? "…" : ventes.length}</p>
        </article>
        <article className="carte p-5">
          <p className="text-xs text-[#a8bb87]">Reste à encaisser</p>
          <p className="titre-or mt-1 text-2xl font-extrabold">{loading ? "…" : formatMad(totalDu)}</p>
        </article>
        <article className="carte p-5">
          <p className="text-xs text-[#a8bb87]">Factures générées</p>
          <p className="titre-or mt-1 text-2xl font-extrabold">{loading ? "…" : factures.length}</p>
        </article>
        <article className="carte p-5">
          <p className="text-xs text-[#a8bb87]">Remboursées</p>
          <p className="titre-or mt-1 text-2xl font-extrabold">{loading ? "…" : ventes.filter((v) => v.status === "refunded").length}</p>
        </article>
      </div>

      {notice && <p role="status" className="rounded-lg bg-[#38a987]/10 px-4 py-3 text-sm text-[#69d3a8]">{notice}</p>}
      {error && <p role="alert" className="rounded-lg bg-[#d66868]/15 px-4 py-3 text-sm text-[#d66868]">{error}</p>}

      <div className="carte overflow-hidden">
        <div className="border-b border-[#d6b66f]/10 p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-[#a8bb87]">Caisse & documents</p>
          <h2 className="titre-or mt-1 text-xl font-extrabold">Historique des ventes</h2>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-[#d6b66f]/10 p-4">
          <input
            type="search"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Rechercher : vente, facture, client…"
            className="champ min-h-10 min-w-48 flex-1"
            aria-label="Rechercher une vente"
          />
          <select value={filtre} onChange={(e) => setFiltre(e.target.value)} className="champ min-h-10 w-52" aria-label="Filtrer les ventes">
            <option value="tous">Toutes</option>
            <option value="du">À encaisser</option>
            <option value="paid">Payées</option>
            <option value="refunded">Remboursées</option>
            <option value="cancelled">Annulées</option>
          </select>
        </div>

        {loading ? (
          <p className="p-6 text-sm text-[#a8bb87]">Chargement des ventes…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-[#21464b]/50 text-xs uppercase text-[#a8bb87]">
                <tr>
                  <th className="px-5 py-3">Vente</th>
                  <th className="px-5 py-3">Client</th>
                  <th className="px-5 py-3">Statut</th>
                  <th className="px-5 py-3 text-right">Total</th>
                  <th className="px-5 py-3 text-right">Payé</th>
                  <th className="px-5 py-3">Facture</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#d6b66f]/10">
                {ventesFiltrees.map((v) => {
                  const info = STATUTS[v.status] ?? STATUTS.open;
                  const reste = Math.max(0, Number(v.total) - Number(v.paid_total));
                  const numero = factureParVente.get(v.id);
                  const encaissable = ["open", "partial"].includes(v.status);
                  const retournable = v.status !== "refunded" && v.status !== "cancelled";
                  return (
                    <tr key={v.id}>
                      <td className="px-5 py-4 font-semibold text-[#e9d998]">
                        {v.reference}
                        <span className="block text-[11px] font-normal text-[#a8bb87]">{new Date(v.created_at).toLocaleString("fr-FR")}</span>
                      </td>
                      <td className="px-5 py-4 text-[#f8ecc9]">{v.client_nom ?? "Comptoir"}</td>
                      <td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${info.classe}`}>{info.label}</span></td>
                      <td className="px-5 py-4 text-right font-bold text-[#e9d998]">{formatMad(Number(v.total))}</td>
                      <td className="px-5 py-4 text-right">
                        <span className={reste > 0.001 ? "font-bold text-[#d66868]" : "text-[#38a987]"}>{formatMad(Number(v.paid_total))}</span>
                        {reste > 0.001 && <span className="block text-[11px] text-[#d6b66f]">reste {formatMad(reste)}</span>}
                      </td>
                      <td className="px-5 py-4 text-[#a8bb87]">{numero ?? "—"}</td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap justify-end gap-1.5">
                          {encaissable && (
                            <button
                              type="button"
                              onClick={() => { setEncaissement(v); setMontantRecu(String(reste.toFixed(2))); setError(null); }}
                              className="btn-or px-2.5 py-1.5 text-xs"
                            >
                              Encaisser
                            </button>
                          )}
                          {!numero && v.status !== "cancelled" && (
                            <button
                              type="button"
                              disabled={traitement === v.id}
                              onClick={() => void genererFacture(v)}
                              className="rounded-lg border border-[#d6b66f]/40 px-2.5 py-1.5 text-xs text-[#e9d998] disabled:opacity-40"
                            >
                              Facture
                            </button>
                          )}
                          <button type="button" onClick={() => void imprimerFacture(v)} className="rounded-lg border border-[#d6b66f]/40 px-2.5 py-1.5 text-xs text-[#e9d998]">
                            Imprimer
                          </button>
                          {retournable && (
                            <button
                              type="button"
                              onClick={() => { setRetour(v); setMotifRetour(""); setError(null); }}
                              className="rounded-lg border border-[#d66868]/40 px-2.5 py-1.5 text-xs text-[#d66868]"
                            >
                              Retour
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!ventesFiltrees.length && <p className="p-8 text-center text-sm text-[#a8bb87]">Aucune vente — encaissez depuis le POS.</p>}
          </div>
        )}
      </div>

      {/* Modale encaissement */}
      {encaissement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-5">
          <div className="carte w-full max-w-sm p-6">
            <p className="text-xs uppercase tracking-[0.2em] text-[#a8bb87]">Encaissement différé</p>
            <h2 className="titre-or mt-1 text-xl font-extrabold">{encaissement.reference}</h2>
            <p className="mt-2 text-sm text-[#a8bb87]">
              Reste dû : <strong className="text-[#e9d998]">{formatMad(Math.max(0, Number(encaissement.total) - Number(encaissement.paid_total)))}</strong>
            </p>

            <label className="mt-4 block text-xs text-[#a8bb87]">Mode de paiement
              <select className="champ mt-1 min-h-11" value={methode} onChange={(e) => setMethode(e.target.value)}>
                {METHODES.map((m) => <option key={m.cle} value={m.cle}>{m.label}</option>)}
              </select>
            </label>
            <label className="mt-3 block text-xs text-[#a8bb87]">Montant encaissé (MAD)
              <input type="number" min="0.01" step="0.01" className="champ mt-1 min-h-11" value={montantRecu} onChange={(e) => setMontantRecu(e.target.value)} />
            </label>

            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setEncaissement(null)} className="rounded-lg px-4 py-2 text-sm text-[#a8bb87]">Annuler</button>
              <button type="button" onClick={() => void encaisserVente()} disabled={traitement === encaissement.id} className="btn-or px-4 py-2 text-sm disabled:opacity-40">
                {traitement === encaissement.id ? "Enregistrement…" : "Encaisser"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modale retour */}
      {retour && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-5">
          <div className="carte w-full max-w-md p-6">
            <p className="text-xs uppercase tracking-[0.2em] text-[#d66868]">Retour & avoir</p>
            <h2 className="titre-or mt-1 text-xl font-extrabold">Rembourser {retour.reference}</h2>
            <p className="mt-3 text-sm leading-6 text-[#a8bb87]">
              La vente sera marquée <strong className="text-[#f8ecc9]">remboursée</strong>, les articles retournés en stock
              et le montant payé ({formatMad(Number(retour.paid_total))}) tracé comme remboursement de caisse.
            </p>
            <label className="mt-4 block text-xs text-[#a8bb87]">Motif (optionnel)
              <input className="champ mt-1 min-h-11" value={motifRetour} onChange={(e) => setMotifRetour(e.target.value)} placeholder="Produit défectueux, erreur de caisse…" />
            </label>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setRetour(null)} className="rounded-lg px-4 py-2 text-sm text-[#a8bb87]">Annuler</button>
              <button type="button" onClick={() => void retournerVente()} disabled={traitement === retour.id} className="rounded-lg bg-[#d66868] px-4 py-2 text-sm font-bold text-white disabled:opacity-40">
                {traitement === retour.id ? "Traitement…" : "Confirmer le remboursement"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
