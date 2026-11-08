"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase-browser";
import { formatMad } from "@/lib/catalogue-test";
import { useProfil } from "@/lib/features";
import { modeleTicketHtml, ticketEscpos, type DonneesTicket } from "@/lib/print-pro";
import {
  chargerImprimantes,
  compterImpressions,
  envoyerEscpos,
  etablissementCourant,
  imprimanteParDefaut,
  journaliserImpression,
  ouvrirImpressionNavigateur,
} from "@/lib/print-pro-client";

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
  open: { label: "À encaisser", classe: "bg-[#8FB59B]/15 text-[#DFE7E2]" },
  partial: { label: "Partiel", classe: "bg-[#8FB59B]/20 text-[#DFE7E2]" },
  paid: { label: "Payée", classe: "bg-[#5D9E7F]/20 text-[#7FBF9E]" },
  refunded: { label: "Remboursée", classe: "bg-[#C5716B]/15 text-[#C5716B]" },
  cancelled: { label: "Annulée", classe: "bg-[#344440] text-[#A7B7A8]" },
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

  /* ---------------------------------------------------------------
   * Permission remboursement (module pos ou caisse · can_edit) :
   * acte sensible vérifié côté client AVANT toute exécution.
   * --------------------------------------------------------------- */
  const profil = useProfil();
  const [permRows, setPermRows] = useState<{ module: string; can_edit: boolean }[] | null>(null);

  useEffect(() => {
    if (!supabase || !profil.role) return;
    const client = supabase;
    let vivant = true;
    const timer = window.setTimeout(() => {
      if (profil.is(["manager", "saas_admin"])) { setPermRows([]); return; }
      void client
        .from("permissions")
        .select("module, can_edit")
        .eq("role", profil.role)
        .in("module", ["pos", "caisse"])
        .then(({ data }) => { if (vivant) setPermRows((data ?? []) as { module: string; can_edit: boolean }[]); });
    }, 0);
    return () => { vivant = false; window.clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rôle isolé : profil est un objet recréé à chaque rendu
  }, [profil.role]);

  const roleConnue = profil.role !== null;
  const estManager = profil.is(["manager", "saas_admin"]);
  const peutRembourser =
    !roleConnue || estManager || (permRows?.some((r) => r.can_edit) ?? false);

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

  /** Réimpression TRACÉE du ticket d'une vente passée :
   *  données réelles rechargées (articles + règlements), numéro de vente
   *  initial conservé, compteur de réimpressions journalisé (0024). */
  async function imprimerTicketVente(vente: Vente) {
    if (!supabase || traitement === vente.id) return;
    setTraitement(vente.id);
    setError(null);
    try {
      const [etab, itemsReq, paymentsReq, venteReq] = await Promise.all([
        etablissementCourant(),
        supabase.from("sale_items").select("label, quantity, unit_price, tax_rate, discount").eq("sale_id", vente.id),
        supabase.from("payments").select("method, amount").eq("sale_id", vente.id).order("paid_at"),
        supabase.from("sales").select("vehicle_id").eq("id", vente.id).single(),
      ]);
      if (itemsReq.error) throw new Error(itemsReq.error.message);

      let vehicule: string | null = null;
      const vehicleId = venteReq.data?.vehicle_id;
      if (vehicleId) {
        const { data: v } = await supabase.from("vehicles").select("plate, brand, model").eq("id", vehicleId).single();
        if (v) vehicule = `${v.plate} — ${v.brand ?? ""} ${v.model ?? ""}`.trim();
      }

      const imprimantesListe = etab ? await chargerImprimantes(etab.id) : [];
      const imprimante = imprimanteParDefaut(imprimantesListe, "ticket_vente");
      const format = imprimante?.format ?? "80mm";
      const langue = imprimante?.langue_defaut ?? "fr";
      const copies = imprimante?.copies_par_defaut ?? 1;
      const reimpression = await compterImpressions(vente.reference, "ticket_vente");

      const total = Number(vente.total);
      const paye = Number(vente.paid_total);
      const donnees: DonneesTicket = {
        reference: vente.reference,
        date: new Date(vente.created_at).toLocaleString("fr-FR"),
        caissier: null,
        client: vente.client_nom ?? null,
        vehicule,
        lignes: (itemsReq.data ?? []).map((l) => ({
          nom: l.label,
          quantite: Number(l.quantity),
          prix: Number(l.unit_price),
          remisePct: Number(l.discount) || 0,
          tvaPct: Number(l.tax_rate) || 0,
        })),
        remiseTicket: Number(vente.discount),
        totalTTC: total,
        reglements: (paymentsReq.data ?? []).map((p) => ({ methode: p.method, montant: Number(p.amount) })),
        paye,
        reste: Math.max(0, Math.round((total - paye) * 100) / 100),
        monnaie: 0,
        referenceTransaction: vente.id.slice(0, 8),
        reimpression: reimpression > 0 ? reimpression + 1 : null,
      };

      const etabSource = etab
        ? { nom: etab.nom, adresse: etab.adresse, ville: etab.ville, telephone: etab.telephone, email: etab.email }
        : { nom: "AUTO DYALI", adresse: null, ville: null, telephone: null, email: null };

      if (format === "A4" || !imprimante || imprimante.connexion === "navigateur" || imprimante.connexion === "reseau") {
        const html = modeleTicketHtml(donnees, etabSource, langue, format, { copies });
        const res = ouvrirImpressionNavigateur(html);
        if (!res.ok) throw new Error(res.message ?? "Impression impossible.");
        setNotice(
          reimpression > 0
            ? `Réimpression n°${reimpression + 1} du ticket ${vente.reference} — numéro initial conservé.`
            : `Ticket ${vente.reference} envoyé au dialogue d'impression.`,
        );
      } else {
        const payload = ticketEscpos(donnees, etabSource, format);
        const res = await envoyerEscpos(payload, imprimante, `ticket-${vente.reference}.bin`);
        setNotice(res.message ?? `Ticket envoyé via ${imprimante.connexion}.`);
      }
      if (etab) {
        await journaliserImpression(
          etab.id, imprimante,
          { documentType: "ticket_vente", reference: vente.reference, saleId: vente.id, reimpression: reimpression > 0 ? reimpression + 1 : 0 },
          format, langue, copies,
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Réimpression du ticket impossible.");
    } finally {
      setTraitement(null);
    }
  }

  async function retournerVente() {
    if (!supabase || !retour) return;
    // Garde-fou : permission de remboursement vérifiée avant exécution.
    if (!peutRembourser) {
      setError("Permission refusée : le remboursement n'est pas autorisé pour votre rôle.");
      return;
    }
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
          <p className="text-xs text-[#A7B7A8]">Ventes</p>
          <p className="titre-or mt-1 text-2xl font-extrabold">{loading ? "…" : ventes.length}</p>
        </article>
        <article className="carte p-5">
          <p className="text-xs text-[#A7B7A8]">Reste à encaisser</p>
          <p className="titre-or mt-1 text-2xl font-extrabold">{loading ? "…" : formatMad(totalDu)}</p>
        </article>
        <article className="carte p-5">
          <p className="text-xs text-[#A7B7A8]">Factures générées</p>
          <p className="titre-or mt-1 text-2xl font-extrabold">{loading ? "…" : factures.length}</p>
        </article>
        <article className="carte p-5">
          <p className="text-xs text-[#A7B7A8]">Remboursées</p>
          <p className="titre-or mt-1 text-2xl font-extrabold">{loading ? "…" : ventes.filter((v) => v.status === "refunded").length}</p>
        </article>
      </div>

      {notice && <p role="status" className="rounded-lg bg-[#5D9E7F]/10 px-4 py-3 text-sm text-[#7FBF9E]">{notice}</p>}
      {error && <p role="alert" className="rounded-lg bg-[#C5716B]/15 px-4 py-3 text-sm text-[#C5716B]">{error}</p>}

      <div className="carte overflow-hidden">
        <div className="border-b border-[#8FB59B]/10 p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-[#A7B7A8]">Caisse & documents</p>
          <h2 className="titre-or mt-1 text-xl font-extrabold">Historique des ventes</h2>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-[#8FB59B]/10 p-4">
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
          <p className="p-6 text-sm text-[#A7B7A8]">Chargement des ventes…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-[#344440]/50 text-xs uppercase text-[#A7B7A8]">
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
              <tbody className="divide-y divide-[#8FB59B]/10">
                {ventesFiltrees.map((v) => {
                  const info = STATUTS[v.status] ?? STATUTS.open;
                  const reste = Math.max(0, Number(v.total) - Number(v.paid_total));
                  const numero = factureParVente.get(v.id);
                  const encaissable = ["open", "partial"].includes(v.status);
                  const retournable = v.status !== "refunded" && v.status !== "cancelled";
                  return (
                    <tr key={v.id}>
                      <td className="px-5 py-4 font-semibold text-[#DFE7E2]">
                        {v.reference}
                        <span className="block text-[11px] font-normal text-[#A7B7A8]">{new Date(v.created_at).toLocaleString("fr-FR")}</span>
                      </td>
                      <td className="px-5 py-4 text-[#E8ECE8]">{v.client_nom ?? "Comptoir"}</td>
                      <td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${info.classe}`}>{info.label}</span></td>
                      <td className="px-5 py-4 text-right font-bold text-[#DFE7E2]">{formatMad(Number(v.total))}</td>
                      <td className="px-5 py-4 text-right">
                        <span className={reste > 0.001 ? "font-bold text-[#C5716B]" : "text-[#5D9E7F]"}>{formatMad(Number(v.paid_total))}</span>
                        {reste > 0.001 && <span className="block text-[11px] text-[#8FB59B]">reste {formatMad(reste)}</span>}
                      </td>
                      <td className="px-5 py-4 text-[#A7B7A8]">{numero ?? "—"}</td>
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
                              className="rounded-lg border border-[#8FB59B]/40 px-2.5 py-1.5 text-xs text-[#DFE7E2] disabled:opacity-40"
                            >
                              Facture
                            </button>
                          )}
                          <button type="button" onClick={() => void imprimerTicketVente(v)} disabled={traitement === v.id} className="rounded-lg border border-[#8FB59B]/40 px-2.5 py-1.5 text-xs text-[#DFE7E2] disabled:opacity-40">
                            Ticket
                          </button>
                          <button type="button" onClick={() => void imprimerFacture(v)} className="rounded-lg border border-[#8FB59B]/40 px-2.5 py-1.5 text-xs text-[#DFE7E2]">
                            Imprimer
                          </button>
                          {retournable && peutRembourser && (
                            <button
                              type="button"
                              onClick={() => { setRetour(v); setMotifRetour(""); setError(null); }}
                              className="rounded-lg border border-[#C5716B]/40 px-2.5 py-1.5 text-xs text-[#C5716B]"
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
            {!ventesFiltrees.length && <p className="p-8 text-center text-sm text-[#A7B7A8]">Aucune vente — encaissez depuis le POS.</p>}
          </div>
        )}
      </div>

      {/* Modale encaissement */}
      {encaissement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-5">
          <div className="carte w-full max-w-sm p-6">
            <p className="text-xs uppercase tracking-[0.2em] text-[#A7B7A8]">Encaissement différé</p>
            <h2 className="titre-or mt-1 text-xl font-extrabold">{encaissement.reference}</h2>
            <p className="mt-2 text-sm text-[#A7B7A8]">
              Reste dû : <strong className="text-[#DFE7E2]">{formatMad(Math.max(0, Number(encaissement.total) - Number(encaissement.paid_total)))}</strong>
            </p>

            <label className="mt-4 block text-xs text-[#A7B7A8]">Mode de paiement
              <select className="champ mt-1 min-h-11" value={methode} onChange={(e) => setMethode(e.target.value)}>
                {METHODES.map((m) => <option key={m.cle} value={m.cle}>{m.label}</option>)}
              </select>
            </label>
            <label className="mt-3 block text-xs text-[#A7B7A8]">Montant encaissé (MAD)
              <input type="number" min="0.01" step="0.01" className="champ mt-1 min-h-11" value={montantRecu} onChange={(e) => setMontantRecu(e.target.value)} />
            </label>

            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setEncaissement(null)} className="rounded-lg px-4 py-2 text-sm text-[#A7B7A8]">Annuler</button>
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
            <p className="text-xs uppercase tracking-[0.2em] text-[#C5716B]">Retour & avoir</p>
            <h2 className="titre-or mt-1 text-xl font-extrabold">Rembourser {retour.reference}</h2>
            <p className="mt-3 text-sm leading-6 text-[#A7B7A8]">
              La vente sera marquée <strong className="text-[#E8ECE8]">remboursée</strong>, les articles retournés en stock
              et le montant payé ({formatMad(Number(retour.paid_total))}) tracé comme remboursement de caisse.
            </p>
            <label className="mt-4 block text-xs text-[#A7B7A8]">Motif (optionnel)
              <input className="champ mt-1 min-h-11" value={motifRetour} onChange={(e) => setMotifRetour(e.target.value)} placeholder="Produit défectueux, erreur de caisse…" />
            </label>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setRetour(null)} className="rounded-lg px-4 py-2 text-sm text-[#A7B7A8]">Annuler</button>
              <button type="button" onClick={() => void retournerVente()} disabled={traitement === retour.id} className="rounded-lg bg-[#C5716B] px-4 py-2 text-sm font-bold text-white disabled:opacity-40">
                {traitement === retour.id ? "Traitement…" : "Confirmer le remboursement"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
