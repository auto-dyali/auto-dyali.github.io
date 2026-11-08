"use client";

import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabase-browser";
import { formatMad } from "@/lib/catalogue-test";

/**
 * Rapports avancés — §4 du cahier des charges (reports_basic / reports_finance).
 * Tous les chiffres sont recalculés à la volée depuis sales, sale_items,
 * products et payments. Aucune donnée fictive.
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
};

type LigneVente = {
  sale_id: string;
  quantity: number;
  unit_price: number;
  product_id: string | null;
  label: string;
};

type Produit = { id: string; name: string; category: string; purchase_price: number; sale_price: number };

type Periode = { cle: string; label: string; jours: number };

const PERIODES: Periode[] = [
  { cle: "30", label: "30 derniers jours", jours: 30 },
  { cle: "90", label: "3 derniers mois", jours: 90 },
  { cle: "365", label: "12 derniers mois", jours: 365 },
  { cle: "tout", label: "Depuis le début", jours: 3650 },
];

export function ReportsAdvancedModule() {
  const [ventes, setVentes] = useState<Vente[]>([]);
  const [lignes, setLignes] = useState<LigneVente[]>([]);
  const [produits, setProduits] = useState<Produit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [periode, setPeriode] = useState("30");

  async function charger() {
    if (!supabase) {
      setError("Supabase n’est pas configuré.");
      setLoading(false);
      return;
    }
    const [ventesReq, lignesReq, produitsReq] = await Promise.all([
      supabase.from("sales").select("id, reference, status, subtotal, discount, tax_total, total, paid_total, created_at").order("created_at", { ascending: false }).limit(2000),
      supabase.from("sale_items").select("sale_id, quantity, unit_price, product_id, label").limit(10000),
      supabase.from("products").select("id, name, category, purchase_price, sale_price").limit(5000),
    ]);
    if (ventesReq.error) setError(ventesReq.error.message);
    else setVentes((ventesReq.data ?? []) as Vente[]);
    if (!lignesReq.error) setLignes((lignesReq.data ?? []) as LigneVente[]);
    if (!produitsReq.error) setProduits((produitsReq.data ?? []) as Produit[]);
    setLoading(false);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void charger(), 0);
    return () => window.clearTimeout(timer);
    // Rechargement initial unique.
  }, []);

  /* ---------------------------------------------------------------
   * Agrégats réels selon la période
   * --------------------------------------------------------------- */
  const ventesPeriode = useMemo(() => {
    if (periode === "tout") return ventes;
    const jours = PERIODES.find((p) => p.cle === periode)?.jours ?? 30;
    const limite = new Date();
    limite.setDate(limite.getDate() - jours);
    return ventes.filter((v) => new Date(v.created_at) >= limite);
  }, [ventes, periode]);

  const lignesPeriode = useMemo(() => {
    const ids = new Set(ventesPeriode.map((v) => v.id));
    return lignes.filter((l) => ids.has(l.sale_id));
  }, [lignes, ventesPeriode]);

  const ventesValides = ventesPeriode.filter((v) => v.status !== "cancelled" && v.status !== "refunded");

  const caTotal = ventesValides.reduce((s, v) => s + Number(v.total), 0);
  const encaisse = ventesValides.reduce((s, v) => s + Number(v.paid_total), 0);
  const resteDu = Math.max(0, caTotal - encaisse);
  const remises = ventesValides.reduce((s, v) => s + Number(v.discount), 0);
  const tvaCollectee = ventesValides.reduce((s, v) => s + Number(v.tax_total), 0);
  const panierMoyen = ventesValides.length ? caTotal / ventesValides.length : 0;

  const produitParId = useMemo(() => {
    const map = new Map<string, Produit>();
    for (const p of produits) map.set(p.id, p);
    return map;
  }, [produits]);

  /** Marge = prix de vente − prix d’achat, sur les lignes liées à un produit. */
  const marge = useMemo(() => {
    let total = 0;
    for (const l of lignesPeriode) {
      if (!l.product_id) continue;
      const p = produitParId.get(l.product_id);
      if (!p) continue;
      total += (Number(l.unit_price) - Number(p.purchase_price)) * Number(l.quantity);
    }
    return total;
  }, [lignesPeriode, produitParId]);

  /** Top 10 des produits par chiffre d’affaires (réel). */
  const topProduits = useMemo(() => {
    const parProduit = new Map<string, { nom: string; qte: number; ca: number }>();
    for (const l of lignesPeriode) {
      const cle = l.product_id ?? `autre:${l.label}`;
      const entry = parProduit.get(cle) ?? {
        nom: l.product_id ? (produitParId.get(l.product_id)?.name ?? l.label) : l.label,
        qte: 0,
        ca: 0,
      };
      entry.qte += Number(l.quantity);
      entry.ca += Number(l.quantity) * Number(l.unit_price);
      parProduit.set(cle, entry);
    }
    return Array.from(parProduit.values()).sort((a, b) => b.ca - a.ca).slice(0, 10);
  }, [lignesPeriode, produitParId]);

  /** Répartition du CA par catégorie (réel). */
  const caParCategorie = useMemo(() => {
    const parCat = new Map<string, number>();
    let total = 0;
    for (const l of lignesPeriode) {
      const cat = l.product_id ? (produitParId.get(l.product_id)?.category ?? "autrep") : "autrep";
      const montant = Number(l.quantity) * Number(l.unit_price);
      parCat.set(cat, (parCat.get(cat) ?? 0) + montant);
      total += montant;
    }
    return Array.from(parCat.entries())
      .map(([cat, montant]) => ({ cat, montant, part: total > 0 ? (montant / total) * 100 : 0 }))
      .sort((a, b) => b.montant - a.montant);
  }, [lignesPeriode, produitParId]);

  const CAT_LABEL: Record<string, string> = {
    piece: "Pièces",
    accessoire: "Accessoires",
    lubrifiant: "Lubrifiants",
    merchandise: "Marchandises",
    pneumatique: "Pneumatiques",
    filtre: "Filtres",
    autrep: "Autres",
  };

  /** Export Excel du rapport courant (données réelles). */
  function exporterRapport() {
    const feuilleVentes = ventesValides.map((v) => ({
      Reference: v.reference,
      Date: new Date(v.created_at).toLocaleDateString("fr-FR"),
      Statut: v.status,
      "Total TTC": Number(v.total),
      Encaisse: Number(v.paid_total),
      Reste: Math.max(0, Number(v.total) - Number(v.paid_total)),
      TVA: Number(v.tax_total),
    }));
    const feuilleTop = topProduits.map((p, index) => ({
      Rang: index + 1,
      Produit: p.nom,
      Quantite: p.qte,
      "CA (MAD)": Math.round(p.ca * 100) / 100,
    }));
    const feuilleCats = caParCategorie.map((c) => ({
      Categorie: CAT_LABEL[c.cat] ?? c.cat,
      "CA (MAD)": Math.round(c.montant * 100) / 100,
      "Part (%)": Math.round(c.part * 10) / 10,
    }));

    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.json_to_sheet(feuilleVentes);
    ws1["!cols"] = [{ wch: 18 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, ws1, "Ventes");
    const ws2 = XLSX.utils.json_to_sheet(feuilleTop);
    ws2["!cols"] = [{ wch: 6 }, { wch: 44 }, { wch: 10 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, ws2, "Top produits");
    const ws3 = XLSX.utils.json_to_sheet(feuilleCats);
    ws3["!cols"] = [{ wch: 18 }, { wch: 14 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, ws3, "Categories");

    const label = PERIODES.find((p) => p.cle === periode)?.label.replace(/\s+/g, "-").toLowerCase() ?? "rapport";
    XLSX.writeFile(wb, `auto-dyali-rapport-${label}.xlsx`);
    setNotice(`Rapport exporté : ${feuilleVentes.length} vente(s), ${feuilleTop.length} produit(s) en tête.`);
  }

  const kpis = [
    { label: "Chiffre d’affaires", valeur: formatMad(caTotal) },
    { label: "Encaissé", valeur: formatMad(encaisse) },
    { label: "Reste à encaisser", valeur: formatMad(resteDu) },
    { label: "Marge brute (produits liés)", valeur: formatMad(marge) },
    { label: "Panier moyen", valeur: formatMad(panierMoyen) },
    { label: "TVA collectée", valeur: formatMad(tvaCollectee) },
    { label: "Remises accordées", valeur: formatMad(remises) },
    { label: "Ventes", valeur: String(ventesValides.length) },
  ];

  return (
    <section className="space-y-6">
      {/* Période + export */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[#A7B7A8]">Pilotage Supabase</p>
          <h1 className="titre-or mt-1 text-2xl font-extrabold">Rapports avancés</h1>
          <p className="mt-1 text-sm text-[#A7B7A8]">Indicateurs recalculés depuis vos ventes réelles.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={periode} onChange={(e) => setPeriode(e.target.value)} className="champ min-h-11 w-56" aria-label="Période du rapport">
            {PERIODES.map((p) => <option key={p.cle} value={p.cle}>{p.label}</option>)}
          </select>
          <button type="button" onClick={exporterRapport} disabled={loading || !ventesValides.length} className="btn-or px-4 py-2.5 text-sm disabled:opacity-40">
            Exporter (.xlsx)
          </button>
        </div>
      </div>

      {notice && <p role="status" className="rounded-lg bg-[#5D9E7F]/10 px-4 py-3 text-sm text-[#7FBF9E]">{notice}</p>}
      {error && <p role="alert" className="rounded-lg bg-[#C5716B]/15 px-4 py-3 text-sm text-[#C5716B]">{error}</p>}

      {/* KPI */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <article key={k.label} className="carte p-5">
            <p className="text-xs text-[#A7B7A8]">{k.label}</p>
            <p className="titre-or mt-1 text-2xl font-extrabold">{loading ? "…" : k.valeur}</p>
          </article>
        ))}
      </div>

      {loading ? (
        <p className="carte p-8 text-center text-sm text-[#A7B7A8]">Calcul des rapports…</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Top produits */}
          <section className="carte overflow-hidden">
            <h2 className="border-b border-[#8FB59B]/10 p-5 font-bold">Top 10 produits (CA)</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-left text-sm">
                <thead className="bg-[#344440]/50 text-xs uppercase text-[#A7B7A8]">
                  <tr>
                    <th className="px-4 py-3">#</th>
                    <th className="px-4 py-3">Produit</th>
                    <th className="px-4 py-3 text-right">Qté</th>
                    <th className="px-4 py-3 text-right">CA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#8FB59B]/10">
                  {topProduits.map((p, index) => (
                    <tr key={`${p.nom}-${index}`}>
                      <td className="px-4 py-3 text-[#A7B7A8]">{index + 1}</td>
                      <td className="max-w-56 truncate px-4 py-3 text-[#E8ECE8]">{p.nom}</td>
                      <td className="px-4 py-3 text-right text-[#A7B7A8]">{p.qte}</td>
                      <td className="px-4 py-3 text-right font-bold text-[#DFE7E2]">{formatMad(p.ca)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!topProduits.length && <p className="p-8 text-center text-sm text-[#A7B7A8]">Aucune vente détaillée sur la période.</p>}
            </div>
          </section>

          {/* CA par catégorie */}
          <section className="carte overflow-hidden">
            <h2 className="border-b border-[#8FB59B]/10 p-5 font-bold">CA par catégorie</h2>
            <ul className="divide-y divide-[#8FB59B]/10">
              {caParCategorie.map((c) => (
                <li key={c.cat} className="px-5 py-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#E8ECE8]">{CAT_LABEL[c.cat] ?? c.cat}</span>
                    <span className="font-bold text-[#DFE7E2]">{formatMad(c.montant)}</span>
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[#344440]">
                    <div className="h-full rounded-full bg-[#8FB59B]" style={{ width: `${Math.min(100, c.part)}%` }} />
                  </div>
                  <p className="mt-1 text-[11px] text-[#A7B7A8]">{Math.round(c.part)} % du CA détaillé</p>
                </li>
              ))}
              {!caParCategorie.length && <li className="p-8 text-center text-sm text-[#A7B7A8]">Aucune donnée sur la période.</li>}
            </ul>
          </section>
        </div>
      )}
    </section>
  );
}
