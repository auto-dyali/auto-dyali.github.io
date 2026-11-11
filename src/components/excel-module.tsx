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

type VoitureLigne = {
  immatriculation: string;
  vin: string;
  marque: string;
  modele: string;
  version: string | null;
  annee: number | null;
  motorisation: string | null;
  carburant: string | null;
  cylindree: number | null;
  boite_vitesses: string | null;
  couleur: string | null;
  date_mise_en_circulation: string | null;
  kilometrage: number | null;
  client_id: string;
};

type VoitureDbRow = {
  id: string;
  plate: string;
  brand: string;
  model: string;
  year: number | null;
  mileage: number | null;
  status: string;
  client_id: string | null;
  vin: string | null;
};

type RapportImportVehicules = {
  total: number;
  importees: number;
  doublons: number;
  erreurs: { ligne: number; motif: string }[];
  clients_rapproches: number;
  clients_inconnus: number;
};

const CATEGORIES = ["piece", "accessoire", "lubrifiant", "merchandise", "autrep", "pneumatique", "filtre"];

export function ExcelModule() {
  const [produits, setProduits] = useState<ProduitLigne[]>([]);
  const [clients, setClients] = useState<{ id: string; code: string | null; full_name: string; phone: string | null; email: string | null }[]>([]);
  const [voitures, setVoitures] = useState<VoitureLigne[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [rapport, setRapport] = useState<RapportImport | RapportImportVehicules | null>(null);
  const [progression, setProgression] = useState("");
  const fichierRef = useRef<HTMLInputElement>(null);

  async function charger() {
    if (!supabase) {
      setError("Supabase n’est pas configuré.");
      setLoading(false);
      return;
    }
    const [produitsReq, clientsReq, voituresReq] = await Promise.all([
      supabase.from("products").select("id, sku, name, category, purchase_price, sale_price, stock").eq("is_active", true).order("name"),
      supabase.from("clients").select("id, code, full_name, phone, email").order("full_name").limit(5000),
      supabase.from("vehicles").select("id, plate, brand, model, year, mileage, status, client_id, vin").order("created_at", { ascending: false }),
    ]);
    if (produitsReq.error) setError(produitsReq.error.message);
    else setProduits((produitsReq.data ?? []) as ProduitLigne[]);
    if (!clientsReq.error) setClients((clientsReq.data ?? []) as typeof clients);
    if (!voituresReq.error) setVoitures((voituresReq.data ?? []).map((v: VoitureDbRow) => ({
  immatriculation: v.plate,
  vin: v.vin ?? "",
  marque: v.brand,
  modele: v.model,
  version: null,
  annee: v.year,
  motorisation: null,
  carburant: null,
  cylindree: null,
  boite_vitesses: null,
  couleur: null,
  date_mise_en_circulation: null,
  kilometrage: v.mileage,
  client_id: v.client_id ?? "",
})));
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

  function exporterVoitures() {
    const donnees = voitures.map((v) => ({
      Immatriculation: v.immatriculation,
      VIN: v.vin,
      Marque: v.marque,
      Modèle: v.modele,
      Version: v.version ?? "",
      Année: v.annee ?? "",
      Motorisation: v.motorisation ?? "",
      Carburant: v.carburant ?? "",
      "Cylindrée": v.cylindree ?? "",
      "Boîte de vitesses": v.boite_vitesses ?? "",
      Couleur: v.couleur ?? "",
      "Date mise en circulation": v.date_mise_en_circulation ?? "",
      Kilométrage: v.kilometrage ?? "",
      Client: v.client_id ?? "",
    }));
    const ws = XLSX.utils.json_to_sheet(donnees);
    ws["!cols"] = [
      { wch: 18 }, { wch: 40 }, { wch: 30 }, { wch: 30 }, { wch: 10 },
      { wch: 8 }, { wch: 20 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
      { wch: 16 }, { wch: 24 }, { wch: 14 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Voitures");
    const date = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `auto-dyali-voitures-${date}.xlsx`);
    setNotice(`Export ${donnees.length} voiture(s) générée.`);
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

  function modeleVoitures() {
    const ws = XLSX.utils.json_to_sheet([
      { Immatriculation: "AB-123-CD", VIN: "VF1ZZZ1KZBX123456", Marque: "Renault", Modèle: "Megane", Version: "Dynamique", Année: "2020", Motorisation: "Essence", Carburant: "Essence", Cylindrée: "1600", "Boîte de vitesses": "Boîte automatique", Couleur: "Rouge", "Date mise en circulation": "2020-03-15", Kilométrage: "45000", Client: "C1" },
    ]);
    ws["!cols"] = [
      { wch: 18 }, { wch: 40 }, { wch: 30 }, { wch: 30 }, { wch: 10 }, { wch: 8 }, { wch: 20 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 24 }, { wch: 14 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Voitures");
    XLSX.writeFile(wb, "auto-dyali-modele-voitures.xlsx");
    setNotice("Modèle véhicules téléchargé — remplissez-le puis importez-le.");
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

  /* ---------------------------------------------------------------
   * Import véhicules (Phase 5.4)
   * --------------------------------------------------------------- */
  async function importerVoituresFichier(file: File) {
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

      const rapportCalcule: RapportImportVehicules = {
        total: lignes.length,
        importees: 0,
        doublons: 0,
        erreurs: [],
        clients_rapproches: 0,
        clients_inconnus: 0,
      };

      // Récupération des clients existants pour rapprochement
      const { data: clientsData, error: clientsError } = await supabase
        .from("clients")
        .select("id, code, full_name, phone")
        .order("full_name");
      if (clientsError) throw new Error("Impossible de charger les clients: " + clientsError.message);
      const clientsExistants = clientsData ?? [];

      // Cartes de rapprochement par téléphone/code
      const clientsParTelephone = new Map<string, string>();
      const clientsParCode = new Map<string, string>();
      for (const c of clientsExistants) {
        if (c.phone) clientsParTelephone.set(c.phone.toLowerCase(), c.id);
        if (c.code) clientsParCode.set(c.code.toLowerCase(), c.id);
      }

      // Établissement de l'utilisateur
      const { data: profileRows } = await supabase.rpc("get_my_profile");
      const etablissementId = profileRows?.[0]?.establishment_id;
      if (!etablissementId) throw new Error("Établissement introuvable.");

      const immatriculationsFichier = new Set<string>();
      const vinsFichier = new Set<string>();

      for (let i = 0; i < lignes.length; i++) {
        const ligne = lignes[i];
        const numero = i + 2;

        const getCol = (name: string) =>
          String(ligne[name] ?? ligne[name.toLowerCase()] ?? "").trim();

      const immatriculation = getCol("immatriculation") || "";
      const vin = getCol("vin") || "";
      const marque = getCol("marque") || getCol("Marque") || "";
      const modele = getCol("modele") || getCol("Modèle") || "";
      const version = getCol("version") || "";
      const anneeStr = getCol("annee") || getCol("Annee") || "";
      const motorisation = getCol("motorisation") || getCol("Motorisation") || "";
      const carburant = getCol("carburant") || getCol("Carburant") || "";
      const cylindreeStr = getCol("cylindree") || getCol("Cylindree") || "";
      const boite_vitesses = getCol("boite_vitesses") || getCol("Boite_vitesses") || getCol("Boîte_vitesses") || "";
      const couleur = getCol("couleur") || getCol("Couleur") || "";
      const date_mise_en_circulation = getCol("date_mise_en_circulation") || getCol("Date_mise_en_circulation") || "";
      const kilometrageStr = getCol("kilometrage") || getCol("Kilométrage") || "";

      // Validation champs obligatoires
      if (!immatriculation) {
        rapportCalcule.erreurs.push({ ligne: numero, motif: "Immatriculation manquante ligne " + numero });
        rapportCalcule.importees += 0;
        continue;
      }
      if (!marque) {
        rapportCalcule.erreurs.push({ ligne: numero, motif: "Marque manquante ligne " + numero });
        rapportCalcule.importees += 0;
        continue;
      }
      if (!modele) {
        rapportCalcule.erreurs.push({ ligne: numero, motif: "Modèle manquante ligne " + numero });
        rapportCalcule.importees += 0;
        continue;
      }

      // Normalisation immatriculation
      const immatriculationNorm = immatriculation.replace(/\s/g, "").toUpperCase();

      // Détection doublons dans le fichier
      if (immatriculationsFichier.has(immatriculationNorm)) {
        rapportCalcule.doublons += 1;
        continue;
      }
      if (vin && vinsFichier.has(vin.toLowerCase().trim())) {
        rapportCalcule.doublons += 1;
        continue;
      }
      immatriculationsFichier.add(immatriculationNorm);
      if (vin && vin.trim()) vinsFichier.add(vin.toLowerCase().trim());

      // Vérification doublons véhicule existant (même établissement)
      const immatExiste = await supabase
        .from("vehicles")
        .select("id, plate")
        .eq("establishment_id", etablissementId)
        .eq("plate", immatriculationNorm)
        .maybeSingle();
      const vinExiste = vin && (await supabase
        .from("vehicles")
        .select("id, vin")
        .eq("establishment_id", etablissementId)
        .eq("vin", vin.toLowerCase().trim())
        .maybeSingle());

      if (immatExiste || (vin && vinExiste)) {
        rapportCalcule.doublons += 1;
        continue;
      }

      // Rapprochement client
      let clientId = "";
      let clientInconnu = true;
      const clientPhone = getCol("client_phone") || "";
      if (clientPhone && clientsParTelephone.has(clientPhone.toLowerCase())) {
        clientId = clientsParTelephone.get(clientPhone.toLowerCase()) ?? "";
        clientInconnu = false;
        rapportCalcule.clients_rapproches += 1;
      } else if (clientPhone && clientsParCode.has(clientPhone.toLowerCase())) {
        clientId = clientsParCode.get(clientPhone.toLowerCase()) ?? "";
        clientInconnu = false;
        rapportCalcule.clients_rapproches += 1;
      } else if (!clientPhone) {
        clientId = "";
        clientInconnu = true;
        rapportCalcule.clients_inconnus += 1;
      } else {
        rapportCalcule.clients_inconnus += 1;
      }

      // Parsing des champs numériques
      const annee = anneeStr ? Number(anneeStr) : null;
      const cylindree = cylindreeStr ? Number(cylindreeStr) : null;
      const kilometrage = kilometrageStr ? Math.max(0, Number(kilometrageStr)) : 0;

      // Insertion véhicule
      const { data: véhicule, error: insertError } = await supabase
        .from("vehicles")
        .insert({
          establishment_id: etablissementId,
          client_id: clientId,
          plate: immatriculationNorm,
          brand: marque.trim(),
          model: modele.trim(),
          year: annee,
          mileage: kilometrage,
          status: "actif",
          vin: vin.trim() || null,
          color: couleur.trim() || null,
          fuel: carburant.trim() || null,
          gearbox: boite_vitesses.trim() || null,
          registration_date: date_mise_en_circulation ? new Date(date_mise_en_circulation) : null,
        })
        .select("id")
        .single();

      if (insertError || !véhicule) {
        rapportCalcule.erreurs.push({ ligne: numero, motif: insertError?.message ?? "Insertion véhicule échouée" });
        rapportCalcule.importees += 0;
        continue;
      }

      rapportCalcule.importees += 1;
      if (i % 10 === 0) setProgression(`Import véhicules en cours… ${i + 1}/${lignes.length}`);
    }

    setProgression("");
    setRapport(rapportCalcule);
    setNotice(
      `Import véhicules terminé : ${rapportCalcule.importees} importée(s), ${rapportCalcule.doublons} doublon(s) ignoré(s), ${rapportCalcule.erreurs.length} erreur(s). ${rapportCalcule.clients_rapproches} client(s) rapproché(s), ${rapportCalcule.clients_inconnus} client(s) inconnu(s).`
    );
    await charger();
    setImporting(false);
  } catch (e) {
    setError(e instanceof Error ? e.message : "Import véhicules impossible.");
    setProgression("");
    setImporting(false);
  }
}

  /* ---------------------------------------------------------------
   * Render
   * --------------------------------------------------------------- */
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
          <p className="text-xs text-[#A7B7A8]">Véhicules exportables</p>
          <p className="titre-or mt-1 text-2xl font-extrabold">{loading ? "…" : voitures.length}</p>
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
            <button type="button" onClick={exporterClients} disabled={loading || !clients.length} className="rounded-lg border border-[#8FB59B]/40 px-4 py-2.5 text-sm text-[#DFE7E2] disabled:opacity-40">
              Exporter les clients (.xlsx)
            </button>
            <button type="button" onClick={exporterVoitures} disabled={loading || !voitures.length} className="rounded-lg border border-[#8FB59B]/40 px-4 py-2.5 text-sm text-[#DFE7E2] disabled:opacity-40">
              Exporter les voitures (.xlsx)
            </button>
          </div>
        </section>

        {/* Import véhicules (Phase 5.4) */}
        <section className="carte p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-[#A7B7A8]">Import</p>
          <h2 className="titre-or mt-1 text-xl font-extrabold">Importer des véhicules</h2>
          <p className="mt-2 text-sm leading-6 text-[#A7B7A8]">
            Colonnes attendues : <strong className="text-[#DFE7E2]">Immatriculation, VIN, Marque, Modèle, Année, Motorisation, Carburant, Cylindrée, Boîte de vitesses, Couleur, Date mise en circulation, Kilométrage, Client (code)</strong>.
            Les doublons (immatriculation ou VIN déjà présent) sont ignorés — aucun doublon n&apos;est créé.
            Le rapprochement client se fait par téléphone ou code si fourni.
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
                  if (file) void importerVoituresFichier(file);
                }}
              />
            </label>
            <button type="button" onClick={modeleVoitures} className="rounded-lg border border-[#8FB59B]/40 px-4 py-2.5 text-sm text-[#DFE7E2]">
              Télécharger le modèle
            </button>
          </div>
          <p className="text-xs text-[#7FBF9E] mt-2">
            Le modèle contient les en-têtes exacts attendus. Remplissez-le puis importez-le.
          </p>
        </section>

        {/* Import produits (existant) */}
        <section className="carte p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-[#A7B7A8]">Import</p>
          <h2 className="titre-or mt-1 text-xl font-extrabold">Importer un catalogue</h2>
          <p className="mt-2 text-sm leading-6 text-[#A7B7A8]">
            Colonnes attendues : <strong className="text-[#DFE7E2]">SKU, Nom, Categorie, Prix achat, Prix vente, Stock</strong>.
            Les doublons (SKU déjà présent) sont ignorés — aucun doublon n&apos;est créé.
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
            <button type="button" onClick={modeleProduits} className="rounded-lg border border-[#8FB59B]/40 px-4 py-2.5 text-sm text-[#DFE7E2]">
              Télécharger le modèle
            </button>
          </div>
        </section>
      </div>

      {/* Rapport d'erreurs */}
      {rapport && 'importees' in rapport && (
        <section className="carte overflow-hidden">
          <div className="border-b border-[#8FB59B]/10 p-5">
            <h2 className="font-bold">Rapport d&apos;import véhicules</h2>
            <p className="mt-1 text-xs text-[#A7B7A8]">
              {rapport.total} ligne(s) lue(s) — {rapport.importees} importée(s), {rapport.doublons} doublon(s) ignoré(s), {rapport.erreurs.length} erreur(s).
              {rapport.clients_rapproches} client(s) rapproché(s), {rapport.clients_inconnus} client(s) inconnu(s).
            </p>
          </div>
          {rapport.erreurs.length ? (
            <div className="max-h-80 overflow-y-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#344440]/50 text-xs uppercase text-[#A7B7A8]">
                  <tr><th className="px-5 py-3">Ligne</th><th className="px-5 py-3">Motif</th></tr>
                </thead>
                <tbody className="divide-y divide-[#8FB59B]/10">
                  {rapport.erreurs.map((err, index) => (
                    <tr key={`${err.ligne}-${index}`}><td className="px-5 py-3 font-mono text-[#DFE7E2]">{err.ligne}</td><td className="px-5 py-3 text-[#C5716B]">{err.motif}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="p-6 text-sm text-[#5D9E7F]">Aucune erreur — toutes les lignes valides ont été traitées.</p>
          )}
          <p className="mt-2 text-xs text-[#8FB59B]">
            Les doublons (immatriculation ou VIN déjà présent dans l&apos;établissement) sont ignorés.
            Le rapprochement client se fait par téléphone si fourni.
          </p>
        </section>
      )}
      {rapport && 'importees' in rapport && rapport.total && rapport.importees === 0 && rapport.doublons === 0 && rapport.erreurs.length === 0 && (
        <p className="mt-2 text-xs text-[#8FB59B]">
          Aucune donnée valide à traiter.
        </p>
      )}
    </section>
  );
}
