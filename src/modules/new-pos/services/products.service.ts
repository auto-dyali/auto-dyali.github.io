/**
 * NEW POS — Service catalogue (produits + prestations).
 * Une seule source de vérité pour Mini-POS et POS complet.
 * Repli catalogue de test EXPLICITEMENT marqué `source: "test"` —
 * jamais présenté comme donnée réelle.
 */

import type { Prestation, Produit } from "../types";
import { versCentimes } from "../core/money.ts";
import { catalogueTest } from "../../../lib/catalogue-test.ts";
import { supabase } from "../../../lib/supabase-browser.ts";

export type ResultatCatalogue = {
  produits: Produit[];
  prestations: Prestation[];
  mode: "bdd" | "test";
  erreur?: string | null;
  /** Familles dérivées des catégories réelles. */
  familles: { cle: string; libelle: string }[];
};

const LIBELLE_FAMILLE: Record<string, string> = {
  piece: "Pièces", accessoire: "Accessoires", accessoires: "Accessoires", lubrifiant: "Lubrifiants",
  filtre: "Filtration", filters: "Filtration", pneumatique: "Pneumatiques", pneus: "Pneumatiques",
  merchandise: "Merchandising", autrep: "Divers", moteur: "Moteur", freinage: "Freinage",
  embrayage: "Embrayage", suspension: "Suspension", electricite: "Électricité",
  batterie: "Batteries", refroidissement: "Refroidissement",
  climatisation: "Climatisation", jantes: "Jantes", carrosserie: "Carrosserie",
  eclairage: "Éclairage", injection: "Injection", outillage: "Outillage",
  main_oeuvre: "Services", autres: "Divers", vidange: "Vidange",
  // Familles obligatoires du catalogue automobile universel (Phase 2).
  entretien: "Vidange et entretien", pompes: "Pompes et alimentation",
  diagnostic: "Diagnostic électronique", mecanique: "Mécanique générale",
  distribution: "Distribution", peinture: "Peinture",
  piece_occasion: "Pièces occasion", prestations: "Prestations et forfaits",
  equilibrage: "Jantes et équilibrage", transmission: "Embrayage et transmission",
};

function libelleFamille(cle: string): string {
  return LIBELLE_FAMILLE[cle] ?? cle.charAt(0).toUpperCase() + cle.slice(1);
}

/** Sous-catégorie extensible d'un produit (logique pure, sans changement de schéma). */
export function sousCategorie(p: { categorie: string; nom: string }): string {
  const cat = (p.categorie ?? "").toLowerCase();
  const nom = (p.nom ?? "").toLowerCase();
  if (cat.includes("filtre")) {
    if (nom.includes("huile")) return "Filtre à huile";
    if (nom.includes("air")) return "Filtre à air";
    if (nom.includes("carburant") || nom.includes("fioul")) return "Filtre à carburant";
    if (nom.includes("habitacle")) return "Filtre habitacle";
    return "Filtres";
  }
  if (cat.includes("lubrifiant")) {
    if (nom.includes("5w") || nom.includes("10w") || nom.includes("15w") || nom.includes("0w")) return "Huiles moteur";
    return "Lubrifiants";
  }
  if (cat.includes("pneu")) return "Pneus";
  if (cat.includes("jante")) return "Jantes et équilibrage";
  if (cat.includes("frein")) return "Freinage";
  if (cat.includes("batterie")) return "Batteries";
  if (cat.includes("injection")) return "Injection et injecteurs";
  if (cat.includes("climatisation")) return "Climatisation";
  if (cat.includes("refroidissement")) return "Refroidissement";
  if (cat.includes("main_oeuvre") || cat.includes("service")) return "Main-d'œuvre";
  return libelleFamille(cat);
}

/** Règles métier produit : pas de doublon SKU/code-barres dans la liste. */
export function doublonsProduits(produits: { reference?: string | null; codeBarres?: string | null }[]): string[] {
  const refs = new Set<string>();
  const codes = new Set<string>();
  const doublons: string[] = [];
  for (const p of produits) {
    const r = (p.reference ?? "").trim().toUpperCase();
    if (r) {
      if (refs.has(r)) doublons.push(`reference dupliquée : ${r}`);
      refs.add(r);
    }
    const c = (p.codeBarres ?? "").trim();
    if (c) {
      if (codes.has(c)) doublons.push(`code-barres dupliqué : ${c}`);
      codes.add(c);
    }
  }
  return doublons;
}

export async function chargerCatalogue(): Promise<ResultatCatalogue> {
  if (!supabase) {
    return catalogueTestResultat("Supabase non configuré — catalogue de démonstration uniquement.");
  }
  // 1) Produits — colonnes 0021 d'abord, repli colonnes de base.
  type ProduitRow = {
    id: string; sku: string; barcode: string | null; name: string; category: string;
    brand?: string | null; manufacturer_ref?: string | null; oem_ref?: string | null;
    image_url?: string | null; sale_price: number; stock: number; tax_rate: number; unit?: string;
  };
  let req: { data: ProduitRow[] | null; error: { message: string } | null } = await supabase
    .from("products")
    .select("id, sku, barcode, name, category, brand, manufacturer_ref, oem_ref, image_url, sale_price, stock, tax_rate, unit")
    .eq("is_active", true)
    .order("name");
  if (req.error && /does not exist|column/i.test(req.error.message)) {
    req = (await supabase
      .from("products")
      .select("id, sku, barcode, name, category, sale_price, stock, tax_rate")
      .eq("is_active", true)
      .order("name")) as { data: ProduitRow[] | null; error: { message: string } | null };
  }
  if (req.error) {
    return catalogueTestResultat(`Chargement produits impossible : ${req.error.message}`);
  }
  // 2) Prestations (seconde source de vente : jamais touchée au stock).
  const reqServices = await supabase
    .from("services")
    .select("id, name, price")
    .eq("is_active", true)
    .order("name");

  const produits: Produit[] = (req.data ?? []).map((p: Record<string, unknown>) => {
    const categorie = String(p.category ?? "autres").toLowerCase();
    return {
      id: String(p.id),
      nom: String(p.name ?? ""),
      marque: (p.brand as string | null) ?? null,
      reference: String(p.sku ?? "") || (p.manufacturer_ref as string | null),
      referenceOem: (p.oem_ref as string | null) ?? null,
      codeBarres: (p.barcode as string | null) ?? null,
      categorie,
      familles: [categorie],
      prixUnitaireCent: versCentimes(Number(p.sale_price ?? 0)),
      tauxTva: Number(p.tax_rate ?? 20),
      stock: Number(p.stock ?? 0),
      unite: (p.unit as string) ?? undefined,
      image: (p.image_url as string | null) ?? null,
      source: "bdd",
    };
  });

  const prestations: Prestation[] = (reqServices.data ?? []).map((s: Record<string, unknown>) => ({
    id: String(s.id),
    nom: String(s.name ?? ""),
    prixUnitaireCent: versCentimes(Number(s.price ?? 0)),
    tauxTva: 20,
    source: "bdd",
  }));

  const familles = [...new Set(produits.map((p) => p.categorie))]
    .sort()
    .map((cle) => ({ cle, libelle: libelleFamille(cle) }));

  return { produits, prestations, mode: "bdd", familles, erreur: null };
}

function catalogueTestResultat(erreur: string): ResultatCatalogue {
  const produits: Produit[] = catalogueTest.map((p, i) => {
    const cle = p.categorie === "Filtre" ? "filtre" : p.categorie === "Lubrifiant" ? "lubrifiant"
      : p.categorie === "Pneumatique" ? "pneumatique" : p.categorie === "Pièce" ? "piece"
        : p.categorie === "Accessoire" ? "accessoire" : "autres";
    return {
      id: `test-${i}`,
      nom: p.nom,
      marque: p.marque,
      reference: p.sku,
      codeBarres: p.barcode ?? null,
      categorie: cle,
      familles: [cle],
      prixUnitaireCent: versCentimes(p.prix),
      tauxTva: 20,
      stock: p.stock,
      source: "test",
    };
  });
  return {
    produits,
    prestations: [],
    mode: "test",
    familles: [...new Set(produits.map((p) => p.categorie))].sort().map((cle) => ({ cle, libelle: libelleFamille(cle) })),
    erreur,
  };
}

/** Recherche instantanée : nom, réf, OEM, marque, dimensions pneu, code-barres. */
export function rechercherProduits(produits: Produit[], q: string): Produit[] {
  const termes = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (termes.length === 0) return produits;
  return produits.filter((p) => {
    const cible = `${p.nom} ${p.marque ?? ""} ${p.reference ?? ""} ${p.referenceOem ?? ""} ${p.codeBarres ?? ""} ${p.categorie}`.toLowerCase();
    return termes.every((t) => cible.includes(t));
  });
}
