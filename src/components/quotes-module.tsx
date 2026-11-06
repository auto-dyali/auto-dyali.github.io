"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase-browser";
import { catalogueTest, formatMad, type ProduitTest } from "@/lib/catalogue-test";

/**
 * Module Devis AUTO DYALI — §6 du cahier des charges.
 * Création de devis (pièces + main-d'œuvre), envoi, acceptation,
 * conversion en vente depuis le POS (offre STANDARD).
 */

type DevisLigne = {
  id: string;
  label: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
};

type Devis = {
  id: string;
  reference: string;
  status: string;
  client_id: string | null;
  client_nom?: string | null;
  subtotal: number;
  discount: number;
  tax_total: number;
  total: number;
  valid_until: string | null;
  notes: string | null;
  converted_sale_id: string | null;
  created_at: string;
};

type Client = { id: string; full_name: string };
type Produit = ProduitTest & { id: string };

const STATUTS: Record<string, { label: string; classe: string }> = {
  draft: { label: "Brouillon", classe: "bg-[#21464b] text-[#e9d998]" },
  sent: { label: "Envoyé", classe: "bg-[#d6b66f]/15 text-[#e9d998]" },
  accepted: { label: "Accepté", classe: "bg-[#38a987]/15 text-[#69d3a8]" },
  converted: { label: "Converti en vente", classe: "bg-[#38a987]/20 text-[#69d3a8]" },
  expired: { label: "Expiré", classe: "bg-[#d66868]/15 text-[#d66868]" },
  cancelled: { label: "Annulé", classe: "bg-[#d66868]/15 text-[#d66868]" },
};

let compteurLignes = 0;

export function QuotesModule() {
  const [devis, setDevis] = useState<Devis[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [produits, setProduits] = useState<Produit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [ouvert, setOuvert] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filtreStatut, setFiltreStatut] = useState("tous");
  const [recherche, setRecherche] = useState("");

  const [clientId, setClientId] = useState("");
  const [validite, setValidite] = useState("");
  const [notes, setNotes] = useState("");
  const [remise, setRemise] = useState(0);
  const [tauxTVA, setTauxTVA] = useState(20);
  const [lignes, setLignes] = useState<DevisLigne[]>([]);
  const [rechercheProduit, setRechercheProduit] = useState("");

  async function charger() {
    if (!supabase) {
      setError("Supabase n’est pas configuré.");
      setLoading(false);
      return;
    }
    const [devisReq, clientsReq, produitsReq] = await Promise.all([
      supabase
        .from("quotes")
        .select("id, reference, status, client_id, subtotal, discount, tax_total, total, valid_until, notes, converted_sale_id, created_at, clients(full_name)")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase.from("clients").select("id, full_name").order("full_name").limit(300),
      supabase.from("products").select("id, sku, name, sale_price, stock").eq("is_active", true).order("name").limit(500),
    ]);

    if (devisReq.error && !devisReq.error.message.includes("does not exist")) {
      setError(devisReq.error.message);
    } else {
      const rows = (devisReq.data ?? []) as unknown as (Devis & { clients: { full_name: string } | null })[];
      setDevis(rows.map((d) => ({ ...d, client_nom: d.clients?.full_name ?? null })));
    }
    if (!clientsReq.error) setClients((clientsReq.data ?? []) as Client[]);
    if (!produitsReq.error && produitsReq.data?.length) {
      setProduits(
        produitsReq.data.map((p) => ({
          id: p.id,
          sku: p.sku,
          nom: p.name,
          marque: p.name.split(" ")[0] || "",
          categorie: "Pièce" as const,
          prix: Number(p.sale_price),
          stock: Number(p.stock) || 0,
        })),
      );
    } else {
      setProduits(catalogueTest.map((p) => ({ ...p, id: "" })));
    }
    setLoading(false);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void charger(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  /* ---------------------------------------------------------------
   * Lignes du devis en cours
   * --------------------------------------------------------------- */
  function ajouterProduit(produit: Produit) {
    setLignes((courantes) => {
      const existante = courantes.find((l) => l.id === `p-${produit.sku}`);
      if (existante) {
        return courantes.map((l) => (l.id === `p-${produit.sku}` ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [
        ...courantes,
        { id: `p-${produit.sku}`, label: `${produit.marque ? `${produit.marque} — ` : ""}${produit.nom}`, quantity: 1, unit_price: produit.prix, tax_rate: tauxTVA },
      ];
    });
    setRechercheProduit("");
  }

  function ajouterPrestation() {
    compteurLignes += 1;
    setLignes((courantes) => [
      ...courantes,
      { id: `s-${compteurLignes}`, label: "Prestation (main-d’œuvre)", quantity: 1, unit_price: 0, tax_rate: tauxTVA },
    ]);
  }

  function majLigne(id: string, champ: keyof DevisLigne, valeur: string | number) {
    setLignes((courantes) => courantes.map((l) => (l.id === id ? { ...l, [champ]: valeur } : l)));
  }

  function supprimerLigne(id: string) {
    setLignes((courantes) => courantes.filter((l) => l.id !== id));
  }

  const sousTotal = useMemo(() => lignes.reduce((s, l) => s + l.quantity * l.unit_price, 0), [lignes]);
  const montantRemise = Math.min(Math.max(0, remise), sousTotal);
  const totalHT = sousTotal - montantRemise;
  const montantTVA = Math.round(totalHT * tauxTVA) / 100;
  const totalTTC = Math.round((totalHT + montantTVA) * 100) / 100;

  const produitsFiltres = useMemo(() => {
    const q = rechercheProduit.trim().toLowerCase();
    if (!q) return [];
    return produits.filter((p) => p.nom.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)).slice(0, 8);
  }, [produits, rechercheProduit]);

  /* ---------------------------------------------------------------
   * Actions sur les devis
   * --------------------------------------------------------------- */
  async function creerDevis(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    if (!lignes.length) { setError("Ajoutez au moins une ligne au devis."); return; }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const { data: profileRows, error: profileError } = await supabase.rpc("get_my_profile");
      const establishmentId = profileRows?.[0]?.establishment_id;
      if (profileError || !establishmentId) throw new Error("Établissement introuvable.");

      const reference = `DEV-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
      const { data: devisCree, error: devisError } = await supabase
        .from("quotes")
        .insert({
          establishment_id: establishmentId,
          client_id: clientId || null,
          reference,
          status: "draft",
          subtotal: totalHT,
          discount: montantRemise,
          tax_total: montantTVA,
          total: totalTTC,
          valid_until: validite || null,
          notes: notes || null,
        })
        .select("id")
        .single();
      if (devisError || !devisCree) throw new Error(devisError?.message ?? "Devis non créé.");

      const { error: itemsError } = await supabase.from("quote_items").insert(
        lignes.map((l, index) => ({
          establishment_id: establishmentId,
          quote_id: devisCree.id,
          label: l.label,
          quantity: l.quantity,
          unit_price: l.unit_price,
          tax_rate: l.tax_rate,
          discount: 0,
          position: index,
        })),
      );
      if (itemsError) throw new Error(itemsError.message);

      setNotice(`Devis ${reference} créé.`);
      setOuvert(false);
      setLignes([]);
      setClientId("");
      setRemise(0);
      setNotes("");
      setValidite("");
      await charger();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Création du devis impossible.");
    } finally {
      setSaving(false);
    }
  }

  async function changerStatut(devisSel: Devis, statut: string) {
    if (!supabase) return;
    setError(null);
    const { error: majError } = await supabase
      .from("quotes")
      .update({ status: statut, updated_at: new Date().toISOString() })
      .eq("id", devisSel.id);
    if (majError) setError(majError.message);
    else {
      setNotice(`Devis ${devisSel.reference} → ${STATUTS[statut]?.label ?? statut}.`);
      await charger();
    }
  }

  async function convertirEnVente(devisSel: Devis) {
    if (!supabase) return;
    setError(null);
    setNotice(null);
    try {
      const { data: items, error: itemsError } = await supabase
        .from("quote_items")
        .select("product_id, label, quantity, unit_price, tax_rate")
        .eq("quote_id", devisSel.id)
        .order("position");
      if (itemsError) throw new Error(itemsError.message);
      if (!items?.length) throw new Error("Ce devis ne contient aucune ligne.");

      const { data: profileRows } = await supabase.rpc("get_my_profile");
      const establishmentId = profileRows?.[0]?.establishment_id;
      if (!establishmentId) throw new Error("Établissement introuvable.");
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id ?? null;

      const reference = `VNT-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
      const { data: sale, error: saleError } = await supabase
        .from("sales")
        .insert({
          establishment_id: establishmentId,
          client_id: devisSel.client_id,
          reference,
          status: devisSel.total <= 0 ? "paid" : "open",
          subtotal: devisSel.subtotal,
          discount: devisSel.discount,
          tax_total: devisSel.tax_total,
          total: devisSel.total,
          paid_total: 0,
        })
        .select("id")
        .single();
      if (saleError || !sale) throw new Error(saleError?.message ?? "Vente non créée.");

      const { error: linesError } = await supabase.from("sale_items").insert(
        items.map((l) => ({
          establishment_id: establishmentId,
          sale_id: sale.id,
          product_id: l.product_id,
          label: l.label,
          quantity: l.quantity,
          unit_price: l.unit_price,
          tax_rate: l.tax_rate,
          discount: 0,
        })),
      );
      if (linesError) throw new Error(linesError.message);

      // Sortie de stock pour les lignes liées à un produit
      for (const ligne of items) {
        if (!ligne.product_id) continue;
        await supabase.from("stock_movements").insert({
          establishment_id: establishmentId,
          product_id: ligne.product_id,
          direction: "out",
          quantity: ligne.quantity,
          reference,
          actor_id: userId,
        });
        await supabase.rpc("decrement_product_stock", { p_product_id: ligne.product_id, p_quantity: ligne.quantity });
      }

      const { error: quoteError } = await supabase
        .from("quotes")
        .update({ status: "converted", converted_sale_id: sale.id, updated_at: new Date().toISOString() })
        .eq("id", devisSel.id);
      if (quoteError) throw new Error(quoteError.message);

      setNotice(`Devis ${devisSel.reference} converti en vente ${reference}. Encaissez depuis le POS.`);
      await charger();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Conversion impossible.");
    }
  }

  async function imprimerDevis(devisSel: Devis) {
    if (!supabase) return;
    const { data: items } = await supabase.from("quote_items").select("label, quantity, unit_price, tax_rate").eq("quote_id", devisSel.id).order("position");
    const fenetre = window.open("", "_blank", "width=760,height=840");
    if (!fenetre) { setError("Autorisez les fenêtres pop-up pour imprimer le devis."); return; }
    const lignesHtml = (items ?? [])
      .map((l) => `<tr><td>${l.label}</td><td style="text-align:center">${l.quantity}</td><td style="text-align:right">${formatMad(Number(l.unit_price))}</td></tr>`)
      .join("");
    fenetre.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Devis ${devisSel.reference}</title>
<style>body{font-family:ui-sans-serif,system-ui;font-size:14px;width:640px;margin:32px auto;color:#111}
h1{font-size:22px;margin:0}table{width:100%;border-collapse:collapse;margin-top:16px}
td,th{padding:8px;border-bottom:1px solid #ddd;text-align:left}.totaux{margin-top:16px;margin-left:auto;width:280px}
.totaux div{display:flex;justify-content:space-between;padding:4px 0}.tt{font-weight:bold;font-size:16px}
.muted{color:#666;font-size:12px}</style></head><body>
<h1>Devis ${devisSel.reference}</h1><p class="muted">Client : ${devisSel.client_nom ?? "Comptoir"} — édité le ${new Date().toLocaleDateString("fr-FR")}${devisSel.valid_until ? ` — valable jusqu’au ${new Date(devisSel.valid_until).toLocaleDateString("fr-FR")}` : ""}</p>
<table><thead><tr><th>Désignation</th><th style="text-align:center">Qté</th><th style="text-align:right">PU</th></tr></thead><tbody>${lignesHtml}</tbody></table>
<div class="totaux">
<div><span>Sous-total</span><span>${formatMad(Number(devisSel.subtotal))}</span></div>
${Number(devisSel.discount) > 0 ? `<div><span>Remise</span><span>− ${formatMad(Number(devisSel.discount))}</span></div>` : ""}
<div><span>TVA</span><span>${formatMad(Number(devisSel.tax_total))}</span></div>
<div class="tt"><span>Total TTC</span><span>${formatMad(Number(devisSel.total))}</span></div>
</div>
${devisSel.notes ? `<p class="muted">Notes : ${devisSel.notes}</p>` : ""}
<p class="muted">AUTO DYALI — devis non contractuel tant que non accepté.</p></body></html>`);
    fenetre.document.close();
    fenetre.focus();
    fenetre.print();
  }

  /* ---------------------------------------------------------------
   * Rendu
   * --------------------------------------------------------------- */
  const devisFiltres = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return devis.filter((d) => {
      const okS = filtreStatut === "tous" || d.status === filtreStatut;
      const okQ = !q || d.reference.toLowerCase().includes(q) || (d.client_nom ?? "").toLowerCase().includes(q);
      return okS && okQ;
    });
  }, [devis, filtreStatut, recherche]);

  const totalEnCours = devisFiltres.reduce((s, d) => s + Number(d.total), 0);

  return (
    <section className="space-y-6">
      {/* KPI réels */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <article className="carte p-5">
          <p className="text-xs text-[#a8bb87]">Devis au total</p>
          <p className="titre-or mt-1 text-2xl font-extrabold">{loading ? "…" : devis.length}</p>
        </article>
        <article className="carte p-5">
          <p className="text-xs text-[#a8bb87]">En attente (brouillon + envoyé)</p>
          <p className="titre-or mt-1 text-2xl font-extrabold">
            {loading ? "…" : devis.filter((d) => d.status === "draft" || d.status === "sent").length}
          </p>
        </article>
        <article className="carte p-5">
          <p className="text-xs text-[#a8bb87]">Acceptés / convertis</p>
          <p className="titre-or mt-1 text-2xl font-extrabold">
            {loading ? "…" : devis.filter((d) => d.status === "accepted" || d.status === "converted").length}
          </p>
        </article>
        <article className="carte p-5">
          <p className="text-xs text-[#a8bb87]">Valeur affichée</p>
          <p className="titre-or mt-1 text-2xl font-extrabold">{loading ? "…" : formatMad(totalEnCours)}</p>
        </article>
      </div>

      {notice && <p role="status" className="rounded-lg bg-[#38a987]/10 px-4 py-3 text-sm text-[#69d3a8]">{notice}</p>}
      {error && <p role="alert" className="rounded-lg bg-[#d66868]/15 px-4 py-3 text-sm text-[#d66868]">{error}</p>}

      <div className="carte overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-[#d6b66f]/10 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[#a8bb87]">Gestion commerciale</p>
            <h2 className="titre-or mt-1 text-xl font-extrabold">Devis</h2>
          </div>
          <button type="button" onClick={() => { setOuvert(true); setError(null); setNotice(null); }} className="btn-or px-4 py-2 text-sm">
            + Nouveau devis
          </button>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-[#d6b66f]/10 p-4">
          <input
            type="search"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Rechercher : référence, client…"
            className="champ min-h-10 min-w-48 flex-1"
            aria-label="Rechercher un devis"
          />
          <select value={filtreStatut} onChange={(e) => setFiltreStatut(e.target.value)} className="champ min-h-10 w-52" aria-label="Filtrer par statut">
            <option value="tous">Tous les statuts</option>
            {Object.entries(STATUTS).map(([cle, info]) => <option key={cle} value={cle}>{info.label}</option>)}
          </select>
        </div>

        {loading ? (
          <p className="p-6 text-sm text-[#a8bb87]">Chargement des devis…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="bg-[#21464b]/50 text-xs uppercase text-[#a8bb87]">
                <tr>
                  <th className="px-5 py-3">Référence</th>
                  <th className="px-5 py-3">Client</th>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Statut</th>
                  <th className="px-5 py-3 text-right">Total TTC</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#d6b66f]/10">
                {devisFiltres.map((d) => {
                  const info = STATUTS[d.status] ?? STATUTS.draft;
                  const actions = (
                    <div className="flex flex-wrap justify-end gap-1.5">
                      <button type="button" onClick={() => void imprimerDevis(d)} className="rounded-lg border border-[#d6b66f]/40 px-2.5 py-1.5 text-xs text-[#e9d998]">Imprimer</button>
                      {d.status === "draft" && (
                        <button type="button" onClick={() => void changerStatut(d, "sent")} className="rounded-lg border border-[#d6b66f]/40 px-2.5 py-1.5 text-xs text-[#e9d998]">Envoyer</button>
                      )}
                      {(d.status === "draft" || d.status === "sent") && (
                        <>
                          <button type="button" onClick={() => void changerStatut(d, "accepted")} className="rounded-lg bg-[#38a987]/15 px-2.5 py-1.5 text-xs text-[#69d3a8]">Accepter</button>
                          <button type="button" onClick={() => void convertirEnVente(d)} className="btn-or px-2.5 py-1.5 text-xs">Convertir en vente</button>
                        </>
                      )}
                      {d.status === "accepted" && (
                        <button type="button" onClick={() => void convertirEnVente(d)} className="btn-or px-2.5 py-1.5 text-xs">Convertir en vente</button>
                      )}
                      {d.status === "draft" && (
                        <button type="button" onClick={() => void changerStatut(d, "cancelled")} className="rounded-lg border border-[#d66868]/40 px-2.5 py-1.5 text-xs text-[#d66868]">Annuler</button>
                      )}
                    </div>
                  );
                  return (
                    <tr key={d.id}>
                      <td className="px-5 py-4 font-semibold text-[#e9d998]">{d.reference}</td>
                      <td className="px-5 py-4 text-[#f8ecc9]">{d.client_nom ?? "Comptoir"}</td>
                      <td className="px-5 py-4 text-[#a8bb87]">{new Date(d.created_at).toLocaleDateString("fr-FR")}</td>
                      <td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${info.classe}`}>{info.label}</span></td>
                      <td className="px-5 py-4 text-right font-bold text-[#e9d998]">{formatMad(Number(d.total))}</td>
                      <td className="px-5 py-4">{actions}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!devisFiltres.length && (
              <p className="p-8 text-center text-sm text-[#a8bb87]">
                Aucun devis. Créez le premier avec « + Nouveau devis » (tables quotes — migration 0013).
              </p>
            )}
          </div>
        )}
      </div>

      {/* Modale nouveau devis */}
      {ouvert && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-5">
          <form onSubmit={(e) => void creerDevis(e)} className="carte my-4 w-full max-w-3xl p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[#a8bb87]">Offre STANDARD</p>
                <h2 className="titre-or mt-1 text-xl font-extrabold">Nouveau devis</h2>
              </div>
              <button type="button" onClick={() => setOuvert(false)} className="text-2xl text-[#a8bb87]" aria-label="Fermer">×</button>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <label className="text-xs text-[#a8bb87] sm:col-span-2">Client
                <select value={clientId} onChange={(e) => setClientId(e.target.value)} className="champ mt-1 min-h-11">
                  <option value="">Client comptoir (anonyme)</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                </select>
              </label>
              <label className="text-xs text-[#a8bb87]">Valable jusqu’au
                <input type="date" value={validite} onChange={(e) => setValidite(e.target.value)} className="champ mt-1 min-h-11" />
              </label>
            </div>

            {/* Ajout de lignes */}
            <div className="mt-4 rounded-xl border border-[#d6b66f]/15 bg-[#21464b]/40 p-4">
              <p className="text-[10px] uppercase tracking-[0.15em] text-[#a8bb87]">Ajouter une ligne</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <input
                  type="search"
                  value={rechercheProduit}
                  onChange={(e) => setRechercheProduit(e.target.value)}
                  placeholder="Rechercher une pièce…"
                  className="champ min-h-10 min-w-48 flex-1"
                  aria-label="Rechercher une pièce pour le devis"
                />
                <button type="button" onClick={ajouterPrestation} className="rounded-lg border border-[#d6b66f]/40 px-3 py-2 text-xs text-[#e9d998]">
                  + Prestation
                </button>
              </div>
              {produitsFiltres.length > 0 && (
                <ul className="mt-2 divide-y divide-[#d6b66f]/10 rounded-lg bg-[#193a40]">
                  {produitsFiltres.map((p) => (
                    <li key={p.sku}>
                      <button type="button" onClick={() => ajouterProduit(p)} className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-[#21464b]">
                        <span className="truncate text-[#f8ecc9]">{p.nom}</span>
                        <span className="shrink-0 font-bold text-[#e9d998]">{formatMad(p.prix)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Lignes */}
            <div className="mt-4 space-y-2">
              {lignes.map((l) => (
                <div key={l.id} className="flex flex-wrap items-end gap-2 rounded-lg border border-[#d6b66f]/10 p-2">
                  <label className="min-w-40 flex-1 text-[10px] uppercase text-[#a8bb87]">
                    Désignation
                    <input value={l.label} onChange={(e) => majLigne(l.id, "label", e.target.value)} className="champ mt-1 min-h-9 py-1 text-sm normal-case tracking-normal" />
                  </label>
                  <label className="w-20 text-[10px] uppercase text-[#a8bb87]">
                    Qté
                    <input type="number" min="1" value={l.quantity} onChange={(e) => majLigne(l.id, "quantity", Math.max(1, Number(e.target.value) || 1))} className="champ mt-1 min-h-9 py-1 text-sm" />
                  </label>
                  <label className="w-28 text-[10px] uppercase text-[#a8bb87]">
                    PU (MAD)
                    <input type="number" min="0" step="0.01" value={l.unit_price} onChange={(e) => majLigne(l.id, "unit_price", Math.max(0, Number(e.target.value) || 0))} className="champ mt-1 min-h-9 py-1 text-sm" />
                  </label>
                  <span className="w-24 pb-2 text-right text-sm font-bold text-[#e9d998]">{formatMad(l.quantity * l.unit_price)}</span>
                  <button type="button" onClick={() => supprimerLigne(l.id)} className="min-h-8 min-w-8 rounded bg-[#d66868]/15 text-xs text-[#d66868]" aria-label={`Supprimer la ligne ${l.label}`}>✕</button>
                </div>
              ))}
              {!lignes.length && <p className="py-3 text-center text-sm text-[#a8bb87]">Aucune ligne — recherchez une pièce ou ajoutez une prestation.</p>}
            </div>

            {/* Totaux */}
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <label className="text-xs text-[#a8bb87]">Remise (MAD)
                <input type="number" min="0" step="1" value={remise} onChange={(e) => setRemise(Math.max(0, Number(e.target.value) || 0))} className="champ mt-1 min-h-11" />
              </label>
              <label className="text-xs text-[#a8bb87]">TVA
                <select value={tauxTVA} onChange={(e) => setTauxTVA(Number(e.target.value))} className="champ mt-1 min-h-11">
                  {[0, 7, 10, 14, 20].map((t) => <option key={t} value={t}>{t} %</option>)}
                </select>
              </label>
              <div className="flex flex-col justify-end pb-1 text-sm">
                <div className="flex justify-between"><span className="text-[#a8bb87]">HT</span><span>{formatMad(totalHT)}</span></div>
                <div className="flex justify-between"><span className="text-[#a8bb87]">TVA</span><span>{formatMad(montantTVA)}</span></div>
                <div className="flex justify-between font-extrabold text-[#e9d998]"><span>TTC</span><span>{formatMad(totalTTC)}</span></div>
              </div>
            </div>

            <label className="mt-3 block text-xs text-[#a8bb87]">
              Notes (optionnel)
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="champ mt-1 w-full py-2 text-sm" placeholder="Conditions, garanties…" />
            </label>

            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setOuvert(false)} className="rounded-lg px-4 py-2 text-sm text-[#a8bb87]">Annuler</button>
              <button type="submit" disabled={saving || !lignes.length} className="btn-or px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40">
                {saving ? "Création…" : "Créer le devis"}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
