"use client";

import { useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabase-browser";

/**
 * Import / Export Excel — §7 du cahier des charges.
 * - Export réel des produits/clients vers un fichier .xlsx.
 * - Import contrôlé : détection des doublons (SKU existant),
 *   rapport d’erreurs ligne par ligne, aucun doublon créé à l’aveugle.
 */

type ProduitLigne = {
  id: string;
  sku: string;
  name: string;
  category: string;
  purchase_price: number;
  sale_price: number;
  stock: number;
};

type RapportImport = {
  total: number;
  crees: number;
  doublons: number;
  erreurs: { ligne: number; motif: string }[];
};

const CATEGORIES = ["piece", "accessoire", "lubrifiant", "merchandise", "autrep", "pneumatique", "filtre"];

export function ExcelModule() {
  const [produits, setProduits] = useState<ProduitLigne[]>([]);
  const [clients, setClients] = useState<{ id: string; code: string | null; full_name: string; phone: string | null; email: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [rapport, setRapport] = useState<RapportImport | null>(null);
  const [progression, setProgression] = useState("");
  const fichierRef = useRef<HTMLInputElement>(null);

  async function charger() {
    if (!supabase) {
      setError("Supabase n’est pas configuré.");
      setLoading(false);
      return;
    }
    const [produitsReq, clientsReq] = await Promise.all([
      supabase.from("products").select("id, sku, name, category, purchase_price, sale_price, stock").eq("is_active", true).order("name"),
      supabase.from("clients").select("id, code, full_name, phone, email").order("full_name").limit(5000),
    ]);
    if (produitsReq.error) setError(produitsReq.error.message);
    else setProduits((produitsReq.data ?? []) as ProduitLigne[]);
    if (!clientsReq.error) setClients((clientsReq.data ?? []) as typeof clients);
    setLoading(false);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void charger(), 0);
    return () => window.clearTimeout(timer);
    // Rechargement initial unique ; charger() est rappelé manuellement après import.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------------------------------------------------------
   * Export
   * --------------------------------------------------------------- */
  function exporterProduits() {
    const donnees = produits.map((p) => ({
      SKU: p.sku,
      Nom: p.name,
      Categorie: p.category,
      "Prix achat": Number(p.purchase_price),
      "Prix vente": Number(p.sale_price),
      Stock: Number(p.stock),
    }));
    const ws = XLSX.utils.json_to_sheet(donnees);
    ws["!cols"] = [{ wch: 18 }, { wch: 44 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 8 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Produits");
    const date = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `auto-dyali-produits-${date}.xlsx`);
    setNotice(`Export ${donnees.length} produit(s) généré.`);
    setRapport(null);
  }

  function exporterClients() {
    const donnees = clients.map((c) => ({
      Code: c.code ?? "",
      "Nom complet": c.full_name,
      Téléphone: c.phone ?? "",
      Email: c.email ?? "",
    }));
    const ws = XLSX.utils.json_to_sheet(donnees);
    ws["!cols"] = [{ wch: 12 }, { wch: 40 }, { wch: 18 }, { wch: 30 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Clients");
    const date = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `auto-dyali-clients-${date}.xlsx`);
    setNotice(`Export ${donnees.length} client(s) généré.`);
  }

  function modeleProduits() {
    const ws = XLSX.utils.json_to_sheet([
      { SKU: "FIL-001", Nom: "Filtre à huile Bosch", Categorie: "filtre", "Prix achat": 45, "Prix vente": 75, Stock: 12 },
    ]);
    ws["!cols"] = [{ wch: 18 }, { wch: 44 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 8 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Produits");
    XLSX.writeFile(wb, "auto-dyali-modele-import.xlsx");
    setNotice("Modèle téléchargé — remplissez-le puis importez-le.");
  }

  /* ---------------------------------------------------------------
   * Import contrôlé (doublons détectés, rapport d’erreurs)
   * --------------------------------------------------------------- */
  async function importerFichier(file: File) {
    if (!supabase) return;
    setImporting(true);
    setError(null);
    setNotice(null);
    setRapport(null);
    try {
      const buffer = await file.arrayBuffer();
      const classeur = XLSX.read(buffer, { type: "array" });
      const premiereFeuille = classeur.SheetNames[0];
      if (!premiereFeuille) throw new Error("Le fichier ne contient aucune feuille.");
      const lignes = XLSX.utils.sheet_to_json<Record<string, unknown>>(classeur.Sheets[premiereFeuille], { defval: "" });

      const { data: profileRows } = await supabase.rpc("get_my_profile");
      const establishmentId = profileRows?.[0]?.establishment_id;
      if (!establishmentId) throw new Error("Établissement introuvable.");

      // Référence des SKUs existants → détection de doublons
      const skusExistants = new Set(produits.map((p) => p.sku.toLowerCase()));

      const rapportCalcule: RapportImport = { total: lignes.length, crees: 0, doublons: 0, erreurs: [] };

      for (let i = 0; i < lignes.length; i++) {
        const ligne = lignes[i];
        const numero = i + 2; // +1 pour l’en-tête Excel, +1 pour l’index 0
        const sku = String(ligne["SKU"] ?? ligne["sku"] ?? ligne["Référence"] ?? "").trim();
        const nom = String(ligne["Nom"] ?? ligne["nom"] ?? ligne["Name"] ?? "").trim();
        const categorie = String(ligne["Categorie"] ?? ligne["categorie"] ?? ligne["Catégorie"] ?? "piece").trim().toLowerCase();
        const prixAchat = Number(ligne["Prix achat"] ?? ligne["prix achat"] ?? 0) || 0;
        const prixVente = Number(ligne["Prix vente"] ?? ligne["prix vente"] ?? 0) || 0;
        const stock = Math.max(0, Math.round(Number(ligne["Stock"] ?? ligne["stock"] ?? 0) || 0));

        if (!sku) { rapportCalcule.erreurs.push({ ligne: numero, motif: "SKU manquant" }); continue; }
        if (!nom) { rapportCalcule.erreurs.push({ ligne: numero, motif: "Nom manquant" }); continue; }
        if (!CATEGORIES.includes(categorie)) {
          rapportCalcule.erreurs.push({ ligne: numero, motif: `Catégorie inconnue « ${categorie} » (valeurs : ${CATEGORIES.join(", ")})` });
          continue;
        }
        if (prixVente <= 0) { rapportCalcule.erreurs.push({ ligne: numero, motif: "Prix de vente invalide" }); continue; }

        // Doublon : on ne crée JAMAIS un doublon incertain
        if (skusExistants.has(sku.toLowerCase())) {
          rapportCalcule.doublons += 1;
          continue;
        }

        const { data: produit, error: insertError } = await supabase
          .from("products")
          .insert({
            establishment_id: establishmentId,
            sku,
            name: nom,
            category: categorie,
            purchase_price: prixAchat,
            sale_price: prixVente,
            stock: 0,
            is_active: true,
          })
          .select("id")
          .single();
        if (insertError || !produit) {
          rapportCalcule.erreurs.push({ ligne: numero, motif: insertError?.message ?? "Insertion échouée" });
          continue;
        }

        if (stock > 0) {
          await supabase.from("product_lots").insert({ establishment_id: establishmentId, product_id: produit.id, quantity: stock });
          await supabase.from("stock_movements").insert({
            establishment_id: establishmentId,
            product_id: produit.id,
            direction: "in",
            quantity: stock,
            reference: "IMPORT EXCEL",
          });
          await supabase.from("products").update({ stock }).eq("id", produit.id);
        }
        skusExistants.add(sku.toLowerCase());
        rapportCalcule.crees += 1;
        if (i % 10 === 0) setProgression(`Import en cours… ${i + 1}/${lignes.length}`);
      }

      setProgression("");
      setRapport(rapportCalcule);
      setNotice(`Import terminé : ${rapportCalcule.crees} créé(s), ${rapportCalcule.doublons} doublon(s) ignoré(s), ${rapportCalcule.erreurs.length} erreur(s).`);
      await charger();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import impossible.");
      setProgression("");
    } finally {
      setImporting(false);
      if (fichierRef.current) fichierRef.current.value = "";
    }
  }

  return (
    <section className="space-y-6">
      {/* KPI réels */}
      <div className="grid gap-4 sm:grid-cols-3">
        <article className="carte p-5">
          <p className="text-xs text-[#A7B7A8]">Produits exportables</p>
          <p className="titre-or mt-1 text-2xl font-extrabold">{loading ? "…" : produits.length}</p>
        </article>
        <article className="carte p-5">
          <p className="text-xs text-[#A7B7A8]">Clients exportables</p>
          <p className="titre-or mt-1 text-2xl font-extrabold">{loading ? "…" : clients.length}</p>
        </article>
        <article className="carte p-5">
          <p className="text-xs text-[#A7B7A8]">Dernier import</p>
          <p className="titre-or mt-1 text-2xl font-extrabold">{rapport ? `${rapport.crees} créés` : "—"}</p>
        </article>
      </div>

      {notice && <p role="status" className="rounded-lg bg-[#5D9E7F]/10 px-4 py-3 text-sm text-[#7FBF9E]">{notice}</p>}
      {error && <p role="alert" className="rounded-lg bg-[#C5716B]/15 px-4 py-3 text-sm text-[#C5716B]">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Export */}
        <section className="carte p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-[#A7B7A8]">Export</p>
          <h2 className="titre-or mt-1 text-xl font-extrabold">Télécharger des fichiers Excel</h2>
          <p className="mt-2 text-sm leading-6 text-[#A7B7A8]">
            Données réelles de votre base Supabase — aucun échantillon fictif.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button type="button" onClick={exporterProduits} disabled={loading || !produits.length} className="btn-or px-4 py-2.5 text-sm disabled:opacity-40">
              Exporter les produits (.xlsx)
            </button>
            <button type="button" onClick={exporterClients} disabled={loading || !clients.length} className="rounded-lg border border-[#8FB59B]/40 px-4 py-2.5 text-sm text-[#D0C6AE] disabled:opacity-40">
              Exporter les clients (.xlsx)
            </button>
          </div>
        </section>

        {/* Import */}
        <section className="carte p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-[#A7B7A8]">Import</p>
          <h2 className="titre-or mt-1 text-xl font-extrabold">Importer un catalogue</h2>
          <p className="mt-2 text-sm leading-6 text-[#A7B7A8]">
            Colonnes attendues : <strong className="text-[#D0C6AE]">SKU, Nom, Categorie, Prix achat, Prix vente, Stock</strong>.
            Les doublons (SKU déjà présent) sont ignorés — aucun doublon n’est créé.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <label className={`btn-or cursor-pointer px-4 py-2.5 text-sm ${importing ? "opacity-50" : ""}`}>
              {importing ? (progression || "Import…") : "Choisir un fichier .xlsx"}
              <input
                ref={fichierRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                disabled={importing}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void importerFichier(file);
                }}
              />
            </label>
            <button type="button" onClick={modeleProduits} className="rounded-lg border border-[#8FB59B]/40 px-4 py-2.5 text-sm text-[#D0C6AE]">
              Télécharger le modèle
            </button>
          </div>
        </section>
      </div>

      {/* Rapport d’erreurs */}
      {rapport && (
        <section className="carte overflow-hidden">
          <div className="border-b border-[#8FB59B]/10 p-5">
            <h2 className="font-bold">Rapport d’import</h2>
            <p className="mt-1 text-xs text-[#A7B7A8]">
              {rapport.total} ligne(s) lue(s) — {rapport.crees} créée(s), {rapport.doublons} doublon(s) ignoré(s), {rapport.erreurs.length} erreur(s).
            </p>
          </div>
          {rapport.erreurs.length ? (
            <div className="max-h-72 overflow-y-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#344440]/50 text-xs uppercase text-[#A7B7A8]">
                  <tr><th className="px-5 py-3">Ligne</th><th className="px-5 py-3">Motif</th></tr>
                </thead>
                <tbody className="divide-y divide-[#8FB59B]/10">
                  {rapport.erreurs.map((err, index) => (
                    <tr key={`${err.ligne}-${index}`}>
                      <td className="px-5 py-3 font-mono text-[#D0C6AE]">{err.ligne}</td>
                      <td className="px-5 py-3 text-[#C5716B]">{err.motif}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="p-6 text-sm text-[#5D9E7F]">Aucune erreur — toutes les lignes valides ont été traitées.</p>
          )}
        </section>
      )}
    </section>
  );
}
