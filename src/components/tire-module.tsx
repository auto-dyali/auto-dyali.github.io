"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase-browser";
import { formatMad } from "@/lib/catalogue-test";

/**
 * Module pneumatiques AUTO DYALI — §8 du cahier des charges.
 * KPI réels (stock, valeur, prestations), catalogue de pneus avec
 * spécifications techniques (largeur/hauteur/diamètre, indices),
 * prestations de montage depuis les services, création de fiche pneu.
 */

type ProduitPneu = {
  id: string;
  sku: string;
  name: string;
  sale_price: number;
  stock: number;
  spec: SpecPneu | null;
};

type SpecPneu = {
  fabricant: string;
  modele: string | null;
  largeur: number;
  hauteur: number;
  diametre: number;
  indice_charge: number | null;
  indice_vitesse: string | null;
  saison: string;
  type_pneu: string;
};

type Prestation = { id: string; name: string; price: number; duration_min: number; is_active: boolean };

const SAISON_LABEL: Record<string, string> = { ete: "Été", hiver: "Hiver", "4saisons": "4 saisons" };

export function TireModule() {
  const [pneus, setPneus] = useState<ProduitPneu[]>([]);
  const [prestations, setPrestations] = useState<Prestation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [recherche, setRecherche] = useState("");
  const [diametre, setDiametre] = useState("Tous");

  const [ouvert, setOuvert] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    fabricant: "",
    modele: "",
    reference: "",
    largeur: "205",
    hauteur: "55",
    diametre: "16",
    indiceCharge: "91",
    indiceVitesse: "V",
    saison: "4saisons",
    typePneu: "tourisme",
    prixAchat: "",
    prixVente: "",
    stock: "",
  });

  async function charger() {
    if (!supabase) {
      setError("Supabase n’est pas configuré.");
      setLoading(false);
      return;
    }
    const [produitsReq, specsReq, prestationsReq] = await Promise.all([
      supabase.from("products").select("id, sku, name, sale_price, stock").eq("category", "pneumatique").eq("is_active", true).order("name"),
      supabase.from("tire_specs").select("product_id, fabricant, modele, largeur, hauteur, diametre, indice_charge, indice_vitesse, saison, type_pneu"),
      supabase.from("services").select("id, name, price, duration_min, is_active").eq("category", "pneumatiques").order("name"),
    ]);

    if (produitsReq.error && !produitsReq.error.message.includes("does not exist")) {
      setError(produitsReq.error.message);
    } else {
      const specs = new Map<string, SpecPneu>();
      for (const s of (specsReq.data ?? []) as (SpecPneu & { product_id: string })[]) {
        specs.set(s.product_id, s);
      }
      setPneus(
        ((produitsReq.data ?? []) as { id: string; sku: string; name: string; sale_price: number; stock: number }[]).map((p) => ({
          ...p,
          spec: specs.get(p.id) ?? null,
        })),
      );
    }
    if (!prestationsReq.error || prestationsReq.error.message.includes("does not exist")) {
      setPrestations((prestationsReq.data ?? []) as Prestation[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void charger(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  /* ---------------------------------------------------------------
   * KPI réels
   * --------------------------------------------------------------- */
  const unitesStock = pneus.reduce((s, p) => s + (Number(p.stock) || 0), 0);
  const valeurStock = pneus.reduce((s, p) => s + (Number(p.stock) || 0) * Number(p.sale_price), 0);
  const prestationsActives = prestations.filter((p) => p.is_active).length;

  const diametres = useMemo(
    () => ["Tous", ...Array.from(new Set(pneus.map((p) => p.spec?.diametre).filter((d): d is number => !!d))).sort((a, b) => a - b)],
    [pneus],
  );

  const filtres = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return pneus.filter((p) => {
      const okD = diametre === "Tous" || p.spec?.diametre === Number(diametre);
      const texte = `${p.name} ${p.sku} ${p.spec?.fabricant ?? ""} ${p.spec?.modele ?? ""} ${p.spec ? `${p.spec.largeur}/${p.spec.hauteur}R${p.spec.diametre}` : ""}`.toLowerCase();
      return okD && (!q || texte.includes(q));
    });
  }, [pneus, recherche, diametre]);

  /** Dimensions les plus présentes en stock (dimension populaire réelle). */
  const dimensionsPopulaires = useMemo(() => {
    const compte = new Map<string, { qte: number; valeur: number }>();
    for (const p of pneus) {
      if (!p.spec) continue;
      const cle = `${p.spec.largeur}/${p.spec.hauteur}R${p.spec.diametre}`;
      const entry = compte.get(cle) ?? { qte: 0, valeur: 0 };
      entry.qte += Number(p.stock) || 0;
      entry.valeur += (Number(p.stock) || 0) * Number(p.sale_price);
      compte.set(cle, entry);
    }
    return Array.from(compte.entries())
      .sort((a, b) => b[1].qte - a[1].qte)
      .slice(0, 5);
  }, [pneus]);

  /* ---------------------------------------------------------------
   * Création d’un pneu (produit + spécification technique)
   * --------------------------------------------------------------- */
  async function creerPneu(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const { data: profileRows, error: profileError } = await supabase.rpc("get_my_profile");
      const establishmentId = profileRows?.[0]?.establishment_id;
      if (profileError || !establishmentId) throw new Error("Établissement introuvable.");

      const dimension = `${form.largeur}/${form.hauteur}R${form.diametre}`;
      const nom = `${form.fabricant} ${form.modele} ${dimension}`.trim();
      const sku = (form.reference || `PNEU-${Date.now()}`).toUpperCase();

      const { data: produit, error: produitError } = await supabase
        .from("products")
        .insert({
          establishment_id: establishmentId,
          sku,
          name: nom,
          category: "pneumatique",
          purchase_price: Number(form.prixAchat) || 0,
          sale_price: Number(form.prixVente) || 0,
          stock: 0,
          min_stock: 2,
          is_active: true,
        })
        .select("id")
        .single();
      if (produitError || !produit) throw new Error(produitError?.message ?? "Produit non créé.");

      const { error: specError } = await supabase.from("tire_specs").insert({
        establishment_id: establishmentId,
        product_id: produit.id,
        fabricant: form.fabricant,
        modele: form.modele || null,
        reference_fabricant: form.reference || null,
        largeur: Number(form.largeur),
        hauteur: Number(form.hauteur),
        diametre: Number(form.diametre),
        indice_charge: form.indiceCharge ? Number(form.indiceCharge) : null,
        indice_vitesse: form.indiceVitesse || null,
        saison: form.saison,
        type_pneu: form.typePneu,
      });
      if (specError) throw new Error(specError.message);

      const quantite = Number(form.stock) || 0;
      if (quantite > 0) {
        await supabase.from("product_lots").insert({ establishment_id: establishmentId, product_id: produit.id, quantity: quantite });
        await supabase.from("stock_movements").insert({
          establishment_id: establishmentId,
          product_id: produit.id,
          direction: "in",
          quantity: quantite,
          reference: "CRÉATION PNEU",
        });
        await supabase.from("products").update({ stock: quantite }).eq("id", produit.id);
      }

      setNotice(`Fiche pneu « ${nom} » créée${quantite > 0 ? ` avec ${quantite} unité(s) en stock` : ""}.`);
      setOuvert(false);
      setForm({
        fabricant: "", modele: "", reference: "", largeur: "205", hauteur: "55", diametre: "16",
        indiceCharge: "91", indiceVitesse: "V", saison: "4saisons", typePneu: "tourisme",
        prixAchat: "", prixVente: "", stock: "",
      });
      await charger();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Création impossible.");
    } finally {
      setSaving(false);
    }
  }

  const kpis = [
    { label: "Pneus en stock", value: String(unitesStock), icone: "carton" as const },
    { label: "Valeur du stock", value: formatMad(valeurStock), icone: "ca" as const },
    { label: "Références pneus", value: String(pneus.length), icone: "barcode" as const },
    { label: "Prestations actives", value: String(prestationsActives), icone: "cle" as const },
  ];

  return (
    <section className="space-y-6">
      {/* KPI réels */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <article key={k.label} className="carte p-5">
            <p className="text-xs text-[#A7B7A8]">{k.label}</p>
            <p className="titre-or mt-1 text-2xl font-extrabold">{loading ? "…" : k.value}</p>
          </article>
        ))}
      </div>

      {notice && <p role="status" className="rounded-lg bg-[#5D9E7F]/10 px-4 py-3 text-sm text-[#7FBF9E]">{notice}</p>}
      {error && <p role="alert" className="rounded-lg bg-[#C5716B]/15 px-4 py-3 text-sm text-[#C5716B]">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
        {/* Catalogue pneus */}
        <div className="carte min-w-0 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[#A7B7A8]">Catalogue pneumatiques</p>
              <h2 className="titre-or mt-1 text-xl font-extrabold">Pneus en stock</h2>
            </div>
            <button type="button" onClick={() => setOuvert(true)} className="btn-or px-4 py-2 text-sm">+ Nouveau pneu</button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <input
              type="search"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Rechercher : marque, dimension (205/55R16), référence…"
              className="champ min-h-11 min-w-52 flex-1"
              aria-label="Rechercher un pneu"
            />
            <select value={diametre} onChange={(e) => setDiametre(e.target.value)} className="champ min-h-11 w-32" aria-label="Filtrer par diamètre">
              {diametres.map((d) => <option key={d} value={d}>{d === "Tous" ? "Tous diamètres" : `${d} pouces`}</option>)}
            </select>
          </div>

          {loading ? (
            <p className="py-8 text-center text-sm text-[#A7B7A8]">Chargement…</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead className="bg-[#344440]/50 text-xs uppercase text-[#A7B7A8]">
                  <tr>
                    <th className="px-4 py-3">Pneu</th>
                    <th className="px-4 py-3">Dimension</th>
                    <th className="px-4 py-3">Indice</th>
                    <th className="px-4 py-3">Saison</th>
                    <th className="px-4 py-3 text-right">Stock</th>
                    <th className="px-4 py-3 text-right">Prix</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#8FB59B]/10">
                  {filtres.map((p) => (
                    <tr key={p.id}>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-[#E8ECE8]">{p.spec?.fabricant ?? p.name}</span>
                        {p.spec?.modele && <span className="ml-2 text-xs text-[#A7B7A8]">{p.spec.modele}</span>}
                        <span className="block text-[11px] text-[#A7B7A8]">{p.sku}</span>
                      </td>
                      <td className="px-4 py-3 font-mono text-[#D0C6AE]">
                        {p.spec ? `${p.spec.largeur}/${p.spec.hauteur}R${p.spec.diametre}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-[#A7B7A8]">
                        {p.spec?.indice_charge ?? "—"}{p.spec?.indice_vitesse ?? ""}
                      </td>
                      <td className="px-4 py-3 text-[#A7B7A8]">{p.spec ? SAISON_LABEL[p.spec.saison] ?? p.spec.saison : "—"}</td>
                      <td className={`px-4 py-3 text-right font-bold ${Number(p.stock) > 0 ? "text-[#5D9E7F]" : "text-[#C5716B]"}`}>
                        {Number(p.stock) || 0}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-[#D0C6AE]">{formatMad(Number(p.sale_price))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!filtres.length && <p className="py-8 text-center text-sm text-[#A7B7A8]">Aucun pneu ne correspond. Créez une fiche avec « + Nouveau pneu ».</p>}
            </div>
          )}
        </div>

        {/* Dimensions populaires + prestations */}
        <aside className="space-y-6">
          <div className="carte p-5">
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#A7B7A8]">Dimensions populaires</p>
            {dimensionsPopulaires.length === 0 ? (
              <p className="mt-3 text-sm text-[#A7B7A8]">Aucune donnée de stock pour l’instant.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {dimensionsPopulaires.map(([dim, stats]) => (
                  <li key={dim} className="flex items-center justify-between text-sm">
                    <span className="font-mono text-[#D0C6AE]">{dim}</span>
                    <span className="text-[#A7B7A8]">{stats.qte} u. · {formatMad(stats.valeur)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="carte p-5">
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#A7B7A8]">Prestations pneus</p>
            <ul className="mt-3 space-y-2 text-sm">
              {prestations.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2">
                  <span className={p.is_active ? "text-[#E8ECE8]" : "text-[#A7B7A8] line-through"}>{p.name}</span>
                  <span className="font-bold text-[#D0C6AE]">{p.price > 0 ? formatMad(p.price) : "Gratuit"}</span>
                </li>
              ))}
              {!prestations.length && <li className="text-[#A7B7A8]">Aucune prestation — exécutez la migration 0013.</li>}
            </ul>
            <p className="mt-3 text-[11px] leading-4 text-[#A7B7A8]">
              Ajoutez des pneus au ticket depuis le POS (catégorie Pneumatique) pour cumuler ventes et montages.
            </p>
          </div>
        </aside>
      </div>

      {/* Modale création pneu */}
      {ouvert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-5">
          <form onSubmit={(e) => void creerPneu(e)} className="carte max-h-[90vh] w-full max-w-2xl overflow-y-auto p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[#A7B7A8]">Catalogue pneumatique</p>
                <h2 className="titre-or mt-1 text-xl font-extrabold">Nouvelle fiche pneu</h2>
              </div>
              <button type="button" onClick={() => setOuvert(false)} className="text-2xl text-[#A7B7A8]" aria-label="Fermer">×</button>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <label className="text-xs text-[#A7B7A8] sm:col-span-2">Fabricant *
                <input required className="champ mt-1 min-h-11" placeholder="Michelin, Continental, Pirelli…" value={form.fabricant} onChange={(e) => setForm({ ...form, fabricant: e.target.value })} />
              </label>
              <label className="text-xs text-[#A7B7A8]">Modèle
                <input className="champ mt-1 min-h-11" placeholder="Primacy 4" value={form.modele} onChange={(e) => setForm({ ...form, modele: e.target.value })} />
              </label>
              <label className="text-xs text-[#A7B7A8]">Référence fabricant
                <input className="champ mt-1 min-h-11" placeholder="Ex. 1234567" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
              </label>
              <label className="text-xs text-[#A7B7A8]">Largeur (mm) *
                <input required type="number" min="100" max="450" className="champ mt-1 min-h-11" value={form.largeur} onChange={(e) => setForm({ ...form, largeur: e.target.value })} />
              </label>
              <label className="text-xs text-[#A7B7A8]">Hauteur (%) *
                <input required type="number" min="25" max="95" className="champ mt-1 min-h-11" value={form.hauteur} onChange={(e) => setForm({ ...form, hauteur: e.target.value })} />
              </label>
              <label className="text-xs text-[#A7B7A8]">Diamètre (pouces) *
                <input required type="number" min="10" max="26" className="champ mt-1 min-h-11" value={form.diametre} onChange={(e) => setForm({ ...form, diametre: e.target.value })} />
              </label>
              <label className="text-xs text-[#A7B7A8]">Indice de charge
                <input type="number" min="0" className="champ mt-1 min-h-11" value={form.indiceCharge} onChange={(e) => setForm({ ...form, indiceCharge: e.target.value })} />
              </label>
              <label className="text-xs text-[#A7B7A8]">Indice de vitesse
                <select className="champ mt-1 min-h-11" value={form.indiceVitesse} onChange={(e) => setForm({ ...form, indiceVitesse: e.target.value })}>
                  {["N", "P", "Q", "R", "S", "T", "U", "H", "V", "W", "Y"].map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </label>
              <label className="text-xs text-[#A7B7A8]">Saison
                <select className="champ mt-1 min-h-11" value={form.saison} onChange={(e) => setForm({ ...form, saison: e.target.value })}>
                  <option value="4saisons">4 saisons</option>
                  <option value="ete">Été</option>
                  <option value="hiver">Hiver</option>
                </select>
              </label>
              <label className="text-xs text-[#A7B7A8]">Type
                <select className="champ mt-1 min-h-11" value={form.typePneu} onChange={(e) => setForm({ ...form, typePneu: e.target.value })}>
                  <option value="tourisme">Tourisme</option>
                  <option value="utilitaire">Utilitaire</option>
                  <option value="poids_lourd">Poids lourd</option>
                  <option value="moto">Moto</option>
                  <option value="agricole">Agricole</option>
                  <option value="engin">Engin de chantier</option>
                </select>
              </label>
              <label className="text-xs text-[#A7B7A8]">Prix d’achat (MAD)
                <input type="number" min="0" step="0.01" className="champ mt-1 min-h-11" value={form.prixAchat} onChange={(e) => setForm({ ...form, prixAchat: e.target.value })} />
              </label>
              <label className="text-xs text-[#A7B7A8]">Prix de vente (MAD) *
                <input required type="number" min="0" step="0.01" className="champ mt-1 min-h-11" value={form.prixVente} onChange={(e) => setForm({ ...form, prixVente: e.target.value })} />
              </label>
              <label className="text-xs text-[#A7B7A8]">Stock initial
                <input type="number" min="0" className="champ mt-1 min-h-11" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
              </label>
            </div>

            <p className="mt-3 text-[11px] leading-4 text-[#A7B7A8]">
              Exemple de dimension : 205 / 55 R16 — la fiche est rattachée au stock réel du POS.
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setOuvert(false)} className="rounded-lg px-4 py-2 text-sm text-[#A7B7A8]">Annuler</button>
              <button type="submit" disabled={saving} className="btn-or px-4 py-2 text-sm disabled:opacity-40">{saving ? "Création…" : "Créer la fiche pneu"}</button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
