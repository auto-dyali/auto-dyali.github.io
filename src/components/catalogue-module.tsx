"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase-browser";
import { ScanChamp } from "@/components/scan-champ";
import { formatMad } from "@/lib/catalogue-test";

/**
 * Catalogue automobile centralisé — §7 du cahier des charges.
 * Recherche pièce ↔ véhicule, déclaration de compatibilité avec
 * source obligatoire + validation (jamais de compatibilité inventée).
 */

type Produit = { id: string; sku: string; barcode: string | null; name: string; category: string; sale_price: number; stock: number };

type Vehicule = {
  id: string;
  brand: string;
  model: string;
  generation: string | null;
  year_from: number | null;
  year_to: number | null;
  fuel: string | null;
  engine_code: string | null;
  displacement: number | null;
  vehicle_type: string;
};

type Compat = {
  id: string;
  product_id: string;
  product_nom?: string | null;
  product_sku?: string | null;
  position: string | null;
  source: string;
  verified: boolean;
  notes: string | null;
};

const FUEL_LABEL: Record<string, string> = { essence: "Essence", diesel: "Diesel", hybride: "Hybride", electrique: "Électrique", gpl: "GPL" };
const TYPE_LABEL: Record<string, string> = { voiture: "Voiture", utilitaire: "Utilitaire", camion: "Camion", bus: "Bus", remorque: "Remorque", moto: "Moto", agricole: "Agricole", engin: "Engin" };

export function CatalogueModule() {
  const [produits, setProduits] = useState<Produit[]>([]);
  const [vehicules, setVehicules] = useState<Vehicule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Recherche véhicule
  const [marque, setMarque] = useState("");
  const [modele, setModele] = useState("");
  const [moteur, setMoteur] = useState("");
  const [vehiculeSelectionne, setVehiculeSelectionne] = useState<Vehicule | null>(null);
  const [compat, setCompat] = useState<Compat[]>([]);

  // Recherche pièce
  const [rechercheProduit, setRechercheProduit] = useState("");
  const [produitSelectionne, setProduitSelectionne] = useState<Produit | null>(null);

  // Déclaration compatibilité
  const [source, setSource] = useState("");
  const [position, setPosition] = useState("");
  const [notes, setNotes] = useState("");
  const [verified, setVerified] = useState(true);
  const [saving, setSaving] = useState(false);

  async function charger() {
    if (!supabase) {
      setError("Supabase n’est pas configuré.");
      setLoading(false);
      return;
    }
    const [produitsReq, vehiculesReq] = await Promise.all([
      supabase.from("products").select("id, sku, barcode, name, category, sale_price, stock").eq("is_active", true).order("name").limit(1000),
      supabase.from("vehicle_catalog").select("id, brand, model, generation, year_from, year_to, fuel, engine_code, displacement, vehicle_type").order("brand").order("model").limit(1000),
    ]);
    if (produitsReq.error && !produitsReq.error.message.includes("does not exist")) setError(produitsReq.error.message);
    else setProduits((produitsReq.data ?? []) as Produit[]);
    if (!vehiculesReq.error) setVehicules((vehiculesReq.data ?? []) as Vehicule[]);
    setLoading(false);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void charger(), 0);
    return () => window.clearTimeout(timer);
    // Rechargement initial unique.
  }, []);

  /* ---------------------------------------------------------------
   * Filtres
   * --------------------------------------------------------------- */
  const marques = useMemo(() => Array.from(new Set(vehicules.map((v) => v.brand))).sort(), [vehicules]);

  const modeles = useMemo(() => {
    if (!marque) return [];
    return Array.from(new Set(vehicules.filter((v) => v.brand === marque).map((v) => v.model))).sort();
  }, [vehicules, marque]);

  const moteurs = useMemo(() => {
    if (!marque || !modele) return [];
    const codes = vehicules
      .filter((v) => v.brand === marque && v.model === modele)
      .map((v) => v.engine_code ?? "—");
    return Array.from(new Set(codes)).sort();
  }, [vehicules, marque, modele]);

  const vehiculesFiltres = useMemo(() => {
    if (!marque || !modele) return [];
    return vehicules.filter(
      (v) =>
        v.brand === marque &&
        v.model === modele &&
        (!moteur || moteur === "—" ? !v.engine_code : v.engine_code === moteur),
    );
  }, [vehicules, marque, modele, moteur]);

  const produitsFiltres = useMemo(() => {
    const q = rechercheProduit.trim().toLowerCase();
    if (!q) return [];
    return produits
      .filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || (p.barcode ?? "").includes(q))
      .slice(0, 8);
  }, [produits, rechercheProduit]);

  /* ---------------------------------------------------------------
   * Compatibilités du véhicule sélectionné
   * --------------------------------------------------------------- */
  async function chargerCompat(vehicleId: string) {
    if (!supabase) return;
    const { data, error: reqError } = await supabase
      .from("part_compatibilities")
      .select("id, product_id, position, source, verified, notes, products(name, sku)")
      .eq("vehicle_catalog_id", vehicleId)
      .order("created_at", { ascending: false });
    if (reqError && !reqError.message.includes("does not exist")) { setError(reqError.message); return; }
    const rows = (data ?? []) as unknown as (Compat & { products: { name: string; sku: string } | null })[];
    setCompat(rows.map((c) => ({ ...c, product_nom: c.products?.name ?? null, product_sku: c.products?.sku ?? null })));
  }

  function selectionnerVehicule(v: Vehicule) {
    setVehiculeSelectionne(v);
    setMarque(v.brand);
    setModele(v.model);
    setMoteur(v.engine_code ?? "—");
    void chargerCompat(v.id);
  }

  /* ---------------------------------------------------------------
   * Scan code-barres : sélectionne directement la pièce scannée
   * --------------------------------------------------------------- */
  function scannerPiece(code: string) {
    const trouve =
      produits.find((p) => (p.barcode ?? "") === code) ??
      produits.find((p) => p.sku.toLowerCase() === code.toLowerCase());
    if (trouve) {
      setProduitSelectionne(trouve);
      setRechercheProduit(trouve.name);
      setNotice(`Code ${code} : pièce « ${trouve.name} » sélectionnée.`);
      setError(null);
    } else {
      setError(`Code-barres ${code} introuvable dans le catalogue. Vérifiez le code ou ajoutez la pièce.`);
    }
  }

  /* ---------------------------------------------------------------
   * Déclaration de compatibilité (source obligatoire)
   * --------------------------------------------------------------- */
  async function declarerCompat() {
    if (!supabase || !vehiculeSelectionne || !produitSelectionne) return;
    if (!source.trim()) { setError("Une source est obligatoire : catalogue fabricant, référence OEM, validation technique…"); return; }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const { data: profileRows } = await supabase.rpc("get_my_profile");
      const establishmentId = profileRows?.[0]?.establishment_id;
      if (!establishmentId) throw new Error("Établissement introuvable.");
      const { data: sessionData } = await supabase.auth.getSession();

      const { error: insertError } = await supabase.from("part_compatibilities").insert({
        establishment_id: establishmentId,
        product_id: produitSelectionne.id,
        vehicle_catalog_id: vehiculeSelectionne.id,
        position: position.trim() || null,
        source: source.trim(),
        verified,
        verified_by: verified ? sessionData.session?.user.id ?? null : null,
        notes: notes.trim() || null,
      });
      if (insertError) {
        if (insertError.code === "23505") throw new Error("Cette compatibilité existe déjà pour ce véhicule.");
        throw new Error(insertError.message);
      }
      setNotice(
        `${produitSelectionne.name} → ${vehiculeSelectionne.brand} ${vehiculeSelectionne.model} déclaré (${verified ? "validé" : "non validé"} — source : ${source.trim()}).`,
      );
      setSource("");
      setPosition("");
      setNotes("");
      setProduitSelectionne(null);
      setRechercheProduit("");
      await chargerCompat(vehiculeSelectionne.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Déclaration impossible.");
    } finally {
      setSaving(false);
    }
  }

  async function supprimerCompat(compatSel: Compat) {
    if (!supabase) return;
    const { error: delError } = await supabase.from("part_compatibilities").delete().eq("id", compatSel.id);
    if (delError) setError(delError.message);
    else if (vehiculeSelectionne) await chargerCompat(vehiculeSelectionne.id);
  }

  return (
    <section className="space-y-6">
      {notice && <p role="status" className="rounded-lg bg-[#5D9E7F]/10 px-4 py-3 text-sm text-[#7FBF9E]">{notice}</p>}
      {error && <p role="alert" className="rounded-lg bg-[#C5716B]/15 px-4 py-3 text-sm text-[#C5716B]">{error}</p>}

      {/* Recherche par véhicule */}
      <section className="carte p-5">
        <p className="text-xs uppercase tracking-[0.2em] text-[#A7B7A8]">Étape 1 — Rechercher par véhicule</p>
        <h2 className="titre-or mt-1 text-xl font-extrabold">Catalogue véhicules</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <label className="text-xs text-[#A7B7A8]">Marque
            <select
              className="champ mt-1 min-h-11"
              value={marque}
              onChange={(e) => { setMarque(e.target.value); setModele(""); setMoteur(""); setVehiculeSelectionne(null); setCompat([]); }}
            >
              <option value="">Toutes</option>
              {marques.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </label>
          <label className="text-xs text-[#A7B7A8]">Modèle
            <select
              className="champ mt-1 min-h-11"
              value={modele}
              disabled={!marque}
              onChange={(e) => { setModele(e.target.value); setMoteur(""); setVehiculeSelectionne(null); setCompat([]); }}
            >
              <option value="">Tous</option>
              {modeles.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </label>
          <label className="text-xs text-[#A7B7A8]">Motorisation
            <select className="champ mt-1 min-h-11" value={moteur} disabled={!modele} onChange={(e) => setMoteur(e.target.value)}>
              <option value="">Toutes</option>
              {moteurs.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </label>
        </div>

        {vehiculesFiltres.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {vehiculesFiltres.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => selectionnerVehicule(v)}
                className={`rounded-lg border px-3 py-2 text-xs transition ${
                  vehiculeSelectionne?.id === v.id
                    ? "border-[#8FB59B] bg-[#8FB59B] font-bold text-[#252D2D]"
                    : "border-[#8FB59B]/30 text-[#DFE7E2] hover:bg-[#344440]"
                }`}
              >
                {v.brand} {v.model} · {v.generation ?? "—"} · {v.engine_code ?? "—"} {v.year_from ? `(${v.year_from}${v.year_to ? `–${v.year_to}` : ""})` : ""}
              </button>
            ))}
          </div>
        )}
        {marque && modele && !vehiculesFiltres.length && !loading && (
          <p className="mt-4 text-sm text-[#A7B7A8]">Aucune motorisation pour ce modèle. Exécutez la migration 0016 pour le catalogue de référence.</p>
        )}
        {loading && <p className="mt-4 text-sm text-[#A7B7A8]">Chargement du catalogue…</p>}
      </section>

      {vehiculeSelectionne && (
        <div className="grid gap-6 lg:grid-cols-[1fr_24rem]">
          {/* Compatibilités déclarées */}
          <section className="carte overflow-hidden">
            <div className="border-b border-[#8FB59B]/10 p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-[#A7B7A8]">Étape 2 — Pièces compatibles</p>
              <h2 className="titre-or mt-1 text-xl font-extrabold">
                {vehiculeSelectionne.brand} {vehiculeSelectionne.model}
                <span className="ml-2 text-sm font-normal text-[#A7B7A8]">
                  {TYPE_LABEL[vehiculeSelectionne.vehicle_type] ?? vehiculeSelectionne.vehicle_type}
                  {vehiculeSelectionne.fuel ? ` · ${FUEL_LABEL[vehiculeSelectionne.fuel] ?? vehiculeSelectionne.fuel}` : ""}
                  {vehiculeSelectionne.displacement ? ` · ${vehiculeSelectionne.displacement} cm³` : ""}
                  {vehiculeSelectionne.generation ? ` · ${vehiculeSelectionne.generation}` : ""}
                </span>
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="bg-[#344440]/50 text-xs uppercase text-[#A7B7A8]">
                  <tr>
                    <th className="px-5 py-3">Pièce</th>
                    <th className="px-5 py-3">Position</th>
                    <th className="px-5 py-3">Source</th>
                    <th className="px-5 py-3">Validation</th>
                    <th className="px-5 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#8FB59B]/10">
                  {compat.map((c) => (
                    <tr key={c.id}>
                      <td className="px-5 py-4">
                        <p className="font-semibold text-[#E8ECE8]">{c.product_nom ?? "Produit supprimé"}</p>
                        <p className="text-[11px] text-[#A7B7A8]">{c.product_sku}</p>
                      </td>
                      <td className="px-5 py-4 text-[#A7B7A8]">{c.position ?? "—"}</td>
                      <td className="px-5 py-4 text-[#A7B7A8]">{c.source}</td>
                      <td className="px-5 py-4">
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${c.verified ? "bg-[#5D9E7F]/20 text-[#7FBF9E]" : "bg-[#8FB59B]/15 text-[#DFE7E2]"}`}>
                          {c.verified ? "✓ Validée" : "Non confirmée"}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button type="button" onClick={() => void supprimerCompat(c)} className="rounded-lg border border-[#C5716B]/40 px-2.5 py-1.5 text-xs text-[#C5716B]">
                          Retirer
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!compat.length && (
                <p className="p-8 text-center text-sm text-[#A7B7A8]">
                  Aucune compatibilité déclarée. Ajoutez une pièce à droite — source et validation obligatoires.
                </p>
              )}
            </div>
          </section>

          {/* Déclaration */}
          <aside className="carte h-fit p-5">
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#A7B7A8]">Déclarer une compatibilité</p>

            <div className="mt-3">
              <label className="text-xs text-[#A7B7A8]">Pièce
                <input
                  type="search"
                  value={rechercheProduit}
                  onChange={(e) => { setRechercheProduit(e.target.value); setProduitSelectionne(null); }}
                  placeholder="Rechercher : nom, référence…"
                  className="champ mt-1 min-h-10"
                />
              </label>
              <div className="mt-2">
                <ScanChamp onCode={scannerPiece} placeholder="Scanner la pièce (EAN-13)…" />
              </div>
              {produitsFiltres.length > 0 && !produitSelectionne && (
                <ul className="mt-1 max-h-44 divide-y divide-[#8FB59B]/10 overflow-y-auto rounded-lg bg-[#2C3735]">
                  {produitsFiltres.map((p) => (
                    <li key={p.id}>
                      <button type="button" onClick={() => { setProduitSelectionne(p); setRechercheProduit(p.name); }} className="w-full px-3 py-2 text-left text-sm hover:bg-[#344440]">
                        <span className="block truncate text-[#E8ECE8]">{p.name}</span>
                        <span className="text-[11px] text-[#A7B7A8]">{p.sku} · {formatMad(p.sale_price)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {produitSelectionne && (
                <p className="mt-2 rounded-lg bg-[#344440] px-3 py-2 text-xs text-[#DFE7E2]">
                  ✓ {produitSelectionne.name} <span className="text-[#A7B7A8]">({produitSelectionne.sku})</span>
                </p>
              )}
            </div>

            <label className="mt-3 block text-xs text-[#A7B7A8]">
              Position (optionnel)
              <input value={position} onChange={(e) => setPosition(e.target.value)} placeholder="essieu avant, avant…" className="champ mt-1 min-h-10" />
            </label>

            <label className="mt-3 block text-xs text-[#8FB59B]">
              Source * (obligatoire)
              <input
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder="Catalogue fabricant, référence OEM, validation technique…"
                className="champ mt-1 min-h-10"
              />
            </label>

            <label className="mt-3 block text-xs text-[#A7B7A8]">
              Notes
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="champ mt-1 py-2 text-sm" />
            </label>

            <label className="mt-3 flex items-center gap-2 text-xs text-[#E8ECE8]">
              <input type="checkbox" checked={verified} onChange={(e) => setVerified(e.target.checked)} className="h-4 w-4 accent-[#8FB59B]" />
              Validée par un technicien
            </label>
            <p className="mt-2 text-[11px] leading-4 text-[#A7B7A8]">
              Une compatibilité non validée est affichée comme « non confirmée » — jamais présentée comme certaine.
            </p>

            <button
              type="button"
              onClick={() => void declarerCompat()}
              disabled={saving || !produitSelectionne || !source.trim()}
              className="btn-or mt-4 w-full px-4 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saving ? "Enregistrement…" : "Déclarer la compatibilité"}
            </button>
          </aside>
        </div>
      )}

      {!vehiculeSelectionne && (
        <p className="carte p-6 text-sm text-[#A7B7A8]">
          Sélectionnez un véhicule ci-dessus pour voir et déclarer les pièces compatibles. Le catalogue de référence
          (marques, motorisations) est alimenté par la migration <code>0016</code> — les compatibilités sont
          déclarées par vos soins, avec source et validation.
        </p>
      )}
    </section>
  );
}
