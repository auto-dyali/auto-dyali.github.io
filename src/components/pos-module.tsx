"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { catalogueTest, formatMad, type ProduitTest } from "@/lib/catalogue-test";
import { supabase } from "@/lib/supabase-browser";
import { ScanChamp } from "@/components/scan-champ";
import type { NomIcone } from "@/components/icones";
import { useProfil } from "@/lib/features";
import { PaveNumerique } from "@/components/pave-numerique";
import {
  modeleTicketHtml,
  ticketEscpos,
  type DonneesTicket,
  type Etablissement,
} from "@/lib/print-pro";
import {
  chargerImprimantes,
  compterImpressions,
  envoyerEscpos,
  etablissementCourant,
  imprimanteParDefaut,
  journaliserImpression,
  ouvrirImpressionNavigateur,
  type ImprimanteRow,
} from "@/lib/print-pro-client";

/**
 * MINI-POS AUTO DYALI — ergonomie PHARMA+ / logique métier automobile.
 *
 * 3 zones : catégories automobiles (gauche) · catalogue intelligent
 * (centre) · panier + bouton PAIEMENT fixe (droite).
 *
 * - Catégories dynamiques : uniquement les familles présentes au catalogue.
 * - Recherche multi-champs : désignation, EAN, réf fabricant, OEM, marque,
 *   dimensions (pneus), catégorie, compatibilité déclarée.
 * - Sélecteur véhicule Marque → Modèle → Année → Motorisation → Version
 *   (vehicle_catalog) ; n'affiche comme compatibles QUE les compatibilités
 *   vérifiées (part_compatibilities.verified) — jamais une compat inventée.
 * - Panier : produits ET prestations (services + lignes libres) ; remise et
 *   TVA par ligne ; les prestations ne touchent jamais au stock.
 * - Client + véhicule optionnels (vente magasin possible), création rapide
 *   si autorisée, historique et interventions si les permissions le permettent.
 * - Bouton PAIEMENT fixe en bas du panier → panneau compact (espèces, carte,
 *   chèque, virement, mobile, partiel, crédit) sans quitter le POS.
 * - Encaissement transactionnel via RPC create_pos_sale (migration 0021),
 *   repli multi-inserts si la migration n'est pas encore appliquée.
 * - Anti double-encaissement : verrou + référence unique en base.
 */

/* ---------------------------------------------------------------------
 * Familles automobiles (catégories produits administrables : une famille
 * n'apparaît que si le catalogue en contient — rien n'est imposé).
 * --------------------------------------------------------------------- */
const FAMILLES: Record<string, string> = {
  moteur: "Pièces moteur",
  piece: "Pièces détachées",
  filtre: "Filtration",
  lubrifiant: "Lubrifiants et huiles",
  freinage: "Freinage",
  embrayage: "Embrayage et transmission",
  suspension: "Suspension et direction",
  electricite: "Électricité et électronique",
  batterie: "Batterie et démarrage",
  refroidissement: "Refroidissement",
  climatisation: "Climatisation",
  pneumatique: "Pneumatiques",
  jantes: "Jantes",
  accessoire: "Accessoires",
  carrosserie: "Carrosserie",
  eclairage: "Éclairage",
  injection: "Injection",
  outillage: "Outillage",
  main_oeuvre: "Main-d'œuvre et prestations",
  merchandise: "Marchandises",
  autrep: "Autres produits",
  autres: "Autres catégories",
};

const ORDRE_FAMILLES = [
  "moteur", "piece", "filtre", "lubrifiant", "freinage", "embrayage",
  "suspension", "electricite", "batterie", "refroidissement", "climatisation",
  "pneumatique", "jantes", "accessoire", "carrosserie", "eclairage",
  "injection", "outillage", "merchandise", "autrep", "autres",
];

/** Clé de catégorie réservée : vue des prestations (main-d'œuvre). */
const CAT_SERVICES = "__services__";

type ModePaiement = "especes" | "carte" | "cheque" | "virement" | "mobile" | "partiel" | "credit";

/** Correspondance UI → enum payment_method de la base. */
const METHODE_BDD: Record<string, string> = {
  especes: "cash",
  carte: "card",
  cheque: "cheque",
  virement: "transfer",
  mobile: "mobile",
};

const MODES: { cle: ModePaiement; label: string }[] = [
  { cle: "especes", label: "Espèces" },
  { cle: "carte", label: "Carte" },
  { cle: "cheque", label: "Chèque" },
  { cle: "virement", label: "Virement" },
  { cle: "mobile", label: "Mobile" },
  { cle: "partiel", label: "Partiel" },
  { cle: "credit", label: "Crédit" },
];

/* ------------------------------------------------------------------
 * Navigation interne du POS — barre latérale fixe (PC)
 * 12 entrées métier. Chaque entrée garde la même logique métier ;
 * seule la vue affichée change (catalogue / panier / clients / …).
 * ------------------------------------------------------------------ */
type PosSection =
  | "catalogue" | "panier" | "clients" | "vehicules" | "historique"
  | "devis" | "interventions" | "paiements" | "imprimantes" | "parametres";
const POS_NAV: { cle: PosSection; label: string; icone: NomIcone; href?: string }[] = [
  { cle: "catalogue", label: "Catalogue", icone: "carton" },
  { cle: "panier", label: "Panier", icone: "carton" },
  { cle: "clients", label: "Clients", icone: "client" },
  { cle: "vehicules", label: "Véhicules", icone: "voiture" },
  { cle: "historique", label: "Historique", icone: "historique", href: "/tableau-de-bord/historique-ventes" },
  { cle: "devis", label: "Devis", icone: "rapport", href: "/tableau-de-bord/devis" },
  { cle: "interventions", label: "Tickets intervention", icone: "cle" },
  { cle: "paiements", label: "Paiements", icone: "ca" },
  { cle: "imprimantes", label: "Imprimantes", icone: "imprimante", href: "/tableau-de-bord/print-pro" },
  { cle: "parametres", label: "Paramètres POS", icone: "plus" },
];

const TVA_OPTIONS = [0, 7, 10, 14, 20];
const REMISE_OPTIONS = [0, 5, 10, 15, 20, 25];

type Produit = {
  id: string;
  sku: string;
  barcode?: string | null;
  nom: string;
  marque: string;
  refFab?: string | null;
  refOem?: string | null;
  image?: string | null;
  categorieCle: string;
  categorieLibelle: string;
  prix: number;
  stock: number;
  tva: number;
};

type Prestation = { id: string; nom: string; categorie: string; prix: number; duree: number };

type Ligne = {
  cle: string;
  type: "produit" | "service" | "libre";
  produitId: string | null;
  serviceId: string | null;
  nom: string;
  detail: string | null;
  prix: number;
  quantite: number;
  remisePct: number;
  tva: number;
};

type Reglement = { methode: "especes" | "carte" | "cheque" | "virement" | "mobile"; montant: number };

type ClientOption = { id: string; full_name: string };
type VehiculeOption = { id: string; plate: string; brand: string; model: string; year: number | null };
type PermRow = { module: string; can_create: boolean; can_edit: boolean; can_view: boolean };

type LigneCatalogue = {
  id: string;
  generation: string | null;
  year_from: number | null;
  year_to: number | null;
  fuel: string | null;
  engine_code: string | null;
  version: string | null;
};

type Recu = {
  reference: string;
  date: string;
  lignes: { nom: string; quantite: number; prix: number; reference?: string | null; remisePct?: number; tva?: number }[];
  sousTotal: number;
  remise: number;
  tva: number;
  total: number;
  paye: number;
  reste: number;
  monnaie: number;
  client: string | null;
  vehicule: string | null;
  /** Détails du véhicule (marque/modèle) si connus. */
  vehiculeDetails?: string | null;
  /** Règlements réellement enregistrés (méthode = clé BDD). */
  reglements?: { methode: string; montant: number }[];
  /** Référence de transaction (id de vente tronqué) si connue. */
  referenceTransaction?: string | null;
  /** Nom du caissier (profil connecté). */
  caissier?: string | null;
  /** Compteur de réimpression (rempli avant impression). */
  reimpression?: number | null;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

function nouvelleCle() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `l-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
}

/** Catégorie du catalogue hors-ligne (ProduitTest) → clé famille. */
function cleCategorieTest(c: ProduitTest["categorie"]): string {
  switch (c) {
    case "Filtre": return "filtre";
    case "Lubrifiant": return "lubrifiant";
    case "Accessoire": return "accessoire";
    case "Pièce": return "piece";
    case "Merchandising": return "merchandise";
    case "Pneumatique": return "pneumatique";
    default: return "autres";
  }
}

/** Libellé de catégorie de prestation (services.category). */
function libelleService(c: string): string {
  const map: Record<string, string> = {
    vidange: "Vidange", pneumatiques: "Pneumatiques", freinage: "Freinage",
    reparation: "Réparation", diagnostic: "Diagnostic", autre: "Autre",
  };
  return map[c] ?? c;
}

export function PosModule() {
  const profil = useProfil();

  /* ---------------------------------------------------------------
   * État du POS
   * --------------------------------------------------------------- */
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [produits, setProduits] = useState<Produit[]>([]);
  const [prestations, setPrestations] = useState<Prestation[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  // Recherche & catégories
  const [recherche, setRecherche] = useState("");
  const [categorie, setCategorie] = useState("Toutes");

  // Sélecteur véhicule (Marque → Modèle → Année → Motorisation → Version)
  const [vehOuvert, setVehOuvert] = useState(false);
  const [vehMarque, setVehMarque] = useState("");
  const [vehModele, setVehModele] = useState("");
  const [vehAnnee, setVehAnnee] = useState("");
  const [vehMoteur, setVehMoteur] = useState("");
  const [vehVersion, setVehVersion] = useState("");
  const [marques, setMarques] = useState<string[]>([]);
  const [modeles, setModeles] = useState<string[]>([]);
  const [lignesCatalogue, setLignesCatalogue] = useState<LigneCatalogue[]>([]);
  const [compatVehicule, setCompatVehicule] = useState<Map<string, boolean>>(new Map());
  const [afficherTous, setAfficherTous] = useState(false);
  const [compatTexte, setCompatTexte] = useState<Map<string, string>>(new Map());
  const [tireDims, setTireDims] = useState<Map<string, string>>(new Map());

  // Client / véhicule de la vente (optionnels)
  const [clientId, setClientId] = useState("");
  const [vehiculeId, setVehiculeId] = useState("");
  const [vehiculesClient, setVehiculesClient] = useState<VehiculeOption[]>([]);
  const [ordresOuverts, setOrdresOuverts] = useState<{ id: string; reference: string }[]>([]);
  const [workOrderId, setWorkOrderId] = useState("");
  const [histClient, setHistClient] = useState<number | null>(null);
  const [histVehicule, setHistVehicule] = useState<number | null>(null);

  // Permissions (remise / crédit / création rapide)
  const [permRows, setPermRows] = useState<PermRow[] | null>(null);

  // Finances globales (remise ticket) — la TVA est par ligne
  const [pourcentageRemise, setPourcentageRemise] = useState(0);
  const [remiseMontant, setRemiseMontant] = useState(0);

  // Paiement
  const [panneauPaiement, setPanneauPaiement] = useState(false);
  const [modePaiement, setModePaiement] = useState<ModePaiement>("especes");
  const [reglements, setReglements] = useState<Reglement[]>([]);
  const [montantRecu, setMontantRecu] = useState("");
  const [derniereVente, setDerniereVente] = useState<Recu | null>(null);

  // Smartphone : panier en feuille + barre fixe
  const [panierMobile, setPanierMobile] = useState(false);

  // Section courante du POS (catalogue / panier / clients / …)
  const [posSection, setPosSection] = useState<PosSection>("catalogue");

  // Création rapide client / véhicule
  const [modalClient, setModalClient] = useState(false);
  const [formClient, setFormClient] = useState({ nom: "", tel: "" });
  const [modalVehicule, setModalVehicule] = useState(false);
  const [formVehicule, setFormVehicule] = useState({ plaque: "", marque: "", modele: "", annee: "" });
  const [savingModal, setSavingModal] = useState(false);

  /** Verrou anti double-encaissement (ventes en double). */
  const verrouEncaissement = useRef(false);

  /* --- Print Pro : établissement + imprimantes (0024, silencieux si absente) --- */
  const [etabInfo, setEtabInfo] = useState<Etablissement | null>(null);
  const [imprimantes, setImprimantes] = useState<ImprimanteRow[]>([]);
  const [paveOuvert, setPaveOuvert] = useState(false);
  const [impressionEnCours, setImpressionEnCours] = useState(false);

  useEffect(() => {
    let vivant = true;
    const timer = window.setTimeout(async () => {
      try {
        const e = await etablissementCourant();
        if (!vivant) return;
        setEtabInfo(e ? { ...e, url_verification: null } : null);
        if (e) setImprimantes(await chargerImprimantes(e.id));
      } catch {
        /* 0024 pas encore exécutée : impression via dialogue navigateur par défaut */
      }
    }, 200);
    return () => { vivant = false; window.clearTimeout(timer); };
  }, []);

  /* ---------------------------------------------------------------
   * Permissions (rôle + table permissions, module pos/clients/vehicules)
   * --------------------------------------------------------------- */
  useEffect(() => {
    if (!supabase || !profil.role) return;
    const client = supabase;
    let vivant = true;
    // Court-circuit manager différé (pas de setState synchrone dans l'effet).
    const timer = window.setTimeout(() => {
      if (profil.is(["manager", "saas_admin"])) { setPermRows([]); return; }
      void client
        .from("permissions")
        .select("module, can_create, can_edit, can_view")
        .eq("role", profil.role)
        .then(({ data }) => { if (vivant) setPermRows((data ?? []) as PermRow[]); });
    }, 0);
    return () => { vivant = false; window.clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- role isolé : profil est un objet recréé à chaque rendu
  }, [profil.role]);

  const roleConnue = profil.role !== null;
  const estManager = profil.is(["manager", "saas_admin"]);
  const aDroit = (module: string, champ: "can_create" | "can_edit" | "can_view") =>
    !roleConnue || estManager || (permRows?.some((r) => r.module === module && r[champ]) ?? false);
  const posEdit = aDroit("pos", "can_edit");
  const peutCreerClient = aDroit("clients", "can_create");
  const peutVoirHistClient = aDroit("clients", "can_view");
  const peutVoirInterventions = aDroit("atelier", "can_view");
  const peutCreerVehicule =
    !roleConnue ||
    estManager ||
    (permRows?.some((r) => (r.module === "vehicules" || r.module === "vehicles") && r.can_create) ?? false);

  /* ---------------------------------------------------------------
   * Chargements initiaux : produits, clients, prestations, index
   * --------------------------------------------------------------- */
  useEffect(() => {
    const timer = window.setTimeout(() => void charger(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function charger() {
    if (!supabase) {
      setProduits(
        catalogueTest.map((p) => ({
          id: "",
          sku: p.sku,
          barcode: p.barcode ?? null,
          nom: p.nom,
          marque: p.marque,
          refFab: null,
          refOem: null,
          image: null,
          categorieCle: cleCategorieTest(p.categorie),
          categorieLibelle: p.categorie,
          prix: p.prix,
          stock: p.stock,
          tva: 20,
        })),
      );
      setLoading(false);
      return;
    }

    // 1) Produits avec les nouvelles colonnes (0021) — repli si absentes.
    const reqComplete = await supabase
      .from("products")
      .select("id, sku, barcode, name, category, brand, manufacturer_ref, oem_ref, image_url, sale_price, stock, tax_rate")
      .eq("is_active", true)
      .order("name");
    let reqProduits: typeof reqComplete = reqComplete;
    if (reqProduits.error && reqProduits.error.message.includes("does not exist")) {
      reqProduits = (await supabase
        .from("products")
        .select("id, sku, barcode, name, category, sale_price, stock, tax_rate")
        .eq("is_active", true)
        .order("name")) as unknown as typeof reqComplete;
    }

    const [reqClients, reqServices, reqDims, reqCompat] = await Promise.all([
      supabase.from("clients").select("id, full_name").order("full_name").limit(200),
      supabase.from("services").select("id, name, category, price, duration_min").eq("is_active", true).order("name"),
      supabase.from("tire_specs").select("product_id, largeur, hauteur, diametre, indice_charge, indice_vitesse, saison").limit(1000),
      supabase.from("part_compatibilities").select("product_id, verified, vehicle_catalog(brand, model)").eq("verified", true).limit(1000),
    ]);

    if (!reqProduits.error && reqProduits.data?.length) {
      setProduits(
        reqProduits.data.map((p: Record<string, unknown>) => {
          const cle = String(p.category ?? "autres").toLowerCase();
          return {
            id: String(p.id),
            sku: String(p.sku),
            barcode: (p.barcode as string | null) ?? null,
            nom: String(p.name),
            marque: ((p.brand as string | null) || String(p.name).split(" ")[0] || "Marque"),
            refFab: (p.manufacturer_ref as string | null) ?? null,
            refOem: (p.oem_ref as string | null) ?? null,
            image: (p.image_url as string | null) ?? null,
            categorieCle: cle,
            categorieLibelle: FAMILLES[cle] ?? cle,
            prix: Number(p.sale_price) || 0,
            stock: Number(p.stock) || 0,
            tva: p.tax_rate == null ? 20 : Number(p.tax_rate),
          };
        }),
      );
    } else {
      // Repli catalogue de test (hors ligne / aucun produit en base).
      setProduits(
        catalogueTest.map((p) => ({
          id: "",
          sku: p.sku,
          barcode: p.barcode ?? null,
          nom: p.nom,
          marque: p.marque,
          refFab: null,
          refOem: null,
          image: null,
          categorieCle: cleCategorieTest(p.categorie),
          categorieLibelle: p.categorie,
          prix: p.prix,
          stock: p.stock,
          tva: 20,
        })),
      );
    }

    if (!reqClients.error && reqClients.data) setClients(reqClients.data as ClientOption[]);
    if (!reqServices.error && reqServices.data) {
      setPrestations(
        reqServices.data.map((s: { id: string; name: string; category: string; price: number; duration_min: number }) => ({
          id: s.id,
          nom: s.name,
          categorie: s.category,
          prix: Number(s.price) || 0,
          duree: Number(s.duration_min) || 0,
        })),
      );
    }

    // Index dimensions pneus (recherche « dimensions »).
    if (!reqDims.error && reqDims.data) {
      const m = new Map<string, string>();
      for (const t of reqDims.data as { product_id: string; largeur: number; hauteur: number; diametre: number; indice_charge: number | null; indice_vitesse: string | null; saison: string }[]) {
        const ind = t.indice_charge && t.indice_vitesse ? ` ${t.indice_charge}${t.indice_vitesse}` : "";
        m.set(t.product_id, `${t.largeur}/${t.hauteur} R${t.diametre}${ind}`);
      }
      setTireDims(m);
    }

    // Index compatibilités vérifiées (recherche « compatibilité »).
    if (!reqCompat.error && reqCompat.data) {
      const m = new Map<string, string>();
      for (const c of (reqCompat.data ?? []) as unknown as { product_id: string; vehicle_catalog: { brand: string; model: string } | null }[]) {
        if (!c.vehicle_catalog) continue;
        const txt = `${c.vehicle_catalog.brand} ${c.vehicle_catalog.model}`;
        const prec = m.get(c.product_id);
        if (!prec) m.set(c.product_id, txt);
        else if (!prec.includes(txt)) m.set(c.product_id, `${prec} · ${txt}`);
      }
      setCompatTexte(m);
    }

    setLoading(false);
  }

  /* ---------------------------------------------------------------
   * Sélecteur véhicule : cascade serveur Marque → Modèle → Détails
   * --------------------------------------------------------------- */
  useEffect(() => {
    if (!vehOuvert || !supabase || marques.length) return;
    void supabase.from("vehicle_catalog").select("brand").order("brand").then(({ data, error }) => {
      if (error || !data) return;
      const vues = new Set<string>();
      const liste: string[] = [];
      for (const r of data as { brand: string }[]) {
        if (!vues.has(r.brand)) { vues.add(r.brand); liste.push(r.brand); }
      }
      setMarques(liste);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehOuvert]);

  useEffect(() => {
    if (!supabase || !vehMarque) {
      const t = window.setTimeout(() => setModeles([]), 0);
      return () => window.clearTimeout(t);
    }
    let vivant = true;
    void supabase.from("vehicle_catalog").select("model").eq("brand", vehMarque).order("model").then(({ data, error }) => {
      if (!vivant || error || !data) return;
      const vues = new Set<string>();
      const liste: string[] = [];
      for (const r of data as { model: string }[]) {
        if (!vues.has(r.model)) { vues.add(r.model); liste.push(r.model); }
      }
      setModeles(liste);
    });
    return () => { vivant = false; };
  }, [vehMarque]);

  useEffect(() => {
    if (!supabase || !vehMarque || !vehModele) {
      const t = window.setTimeout(() => setLignesCatalogue([]), 0);
      return () => window.clearTimeout(t);
    }
    let vivant = true;
    void supabase
      .from("vehicle_catalog")
      .select("id, generation, year_from, year_to, fuel, engine_code, version")
      .eq("brand", vehMarque)
      .eq("model", vehModele)
      .limit(500)
      .then(({ data, error }) => {
        if (!vivant || error || !data) return;
        setLignesCatalogue(data as LigneCatalogue[]);
      });
    return () => { vivant = false; };
  }, [vehMarque, vehModele]);

  /** Années couvertes par les lignes du modèle (ranges year_from..year_to). */
  const annees = useMemo(() => {
    const set = new Set<number>();
    const courant = new Date().getFullYear();
    for (const l of lignesCatalogue) {
      const debut = l.year_from ?? (l.year_to ? l.year_to - 15 : null);
      const fin = l.year_to ?? (l.year_from ? Math.max(l.year_from, courant) : null);
      if (debut == null || fin == null) continue;
      for (let y = Math.max(debut, courant - 30); y <= Math.min(fin, courant + 2); y++) set.add(y);
    }
    return Array.from(set).sort((a, b) => b - a);
  }, [lignesCatalogue]);

  /** Lignes du catalogue correspondant à l'année choisie. */
  const lignesAnnee = useMemo(() => {
    if (!vehAnnee) return [];
    const an = Number(vehAnnee);
    return lignesCatalogue.filter((l) => {
      const debut = l.year_from ?? 0;
      const fin = l.year_to ?? 9999;
      return an >= debut && an <= fin;
    });
  }, [lignesCatalogue, vehAnnee]);

  const moteurs = useMemo(() => {
    const vus = new Set<string>();
    const liste: string[] = [];
    for (const l of lignesAnnee) {
      const cle = l.engine_code ?? "";
      if (!vus.has(cle)) { vus.add(cle); liste.push(cle); }
    }
    return liste.sort();
  }, [lignesAnnee]);

  const versions = useMemo(() => {
    const vus = new Set<string>();
    const liste: string[] = [];
    for (const l of lignesAnnee) {
      if (vehMoteur && (l.engine_code ?? "") !== vehMoteur) continue;
      const cle = l.version ?? "";
      if (!vus.has(cle)) { vus.add(cle); liste.push(cle); }
    }
    return liste.sort();
  }, [lignesAnnee, vehMoteur]);

  /** Lignes vehicle_catalog finement sélectionnées → ids pour compat. */
  const idsCatalogue = useMemo(() => {
    if (!vehMarque || !vehModele || !vehAnnee) return [];
    return lignesAnnee
      .filter((l) => {
        if (vehMoteur && (l.engine_code ?? "") !== vehMoteur) return false;
        if (vehVersion && (l.version ?? "") !== vehVersion) return false;
        return true;
      })
      .map((l) => l.id);
  }, [lignesAnnee, vehMarque, vehModele, vehAnnee, vehMoteur, vehVersion]);

  useEffect(() => {
    if (!supabase || !idsCatalogue.length) {
      const t = window.setTimeout(() => setCompatVehicule(new Map()), 0);
      return () => window.clearTimeout(t);
    }
    let vivant = true;
    void supabase
      .from("part_compatibilities")
      .select("product_id, verified, vehicle_catalog_id")
      .in("vehicle_catalog_id", idsCatalogue)
      .limit(2000)
      .then(({ data, error }) => {
        if (!vivant || error || !data) return;
        const m = new Map<string, boolean>();
        for (const r of data as { product_id: string; verified: boolean }[]) {
          m.set(r.product_id, (m.get(r.product_id) ?? false) || r.verified);
        }
        setCompatVehicule(m);
      });
    return () => { vivant = false; };
  }, [idsCatalogue]);

  const vehiculeActif = Boolean(vehMarque && vehModele && vehAnnee);
  const vehiculeLibelle = vehiculeActif
    ? `${vehMarque} ${vehModele} ${vehAnnee}${vehMoteur ? ` · ${vehMoteur}` : ""}${vehVersion ? ` · ${vehVersion}` : ""}`
    : null;

  function reinitVehicule() {
    setVehMarque(""); setVehModele(""); setVehAnnee(""); setVehMoteur(""); setVehVersion("");
    setLignesCatalogue([]); setCompatVehicule(new Map()); setAfficherTous(false);
  }

  /* ---------------------------------------------------------------
   * Véhicules du client + historique (si permissions le permettent)
   * --------------------------------------------------------------- */
  useEffect(() => {
    if (!supabase) return;
    let vivant = true;
    if (!clientId) {
      const t = window.setTimeout(() => {
        setVehiculesClient([]); setVehiculeId(""); setHistClient(null); setOrdresOuverts([]); setWorkOrderId("");
      }, 0);
      return () => { vivant = false; window.clearTimeout(t); };
    }
    void (async () => {
      const [ventes, vehs] = await Promise.all([
        supabase!.from("sales").select("id", { count: "exact", head: true }).eq("client_id", clientId),
        supabase!.from("vehicles").select("id, plate, brand, model, year").eq("client_id", clientId).order("plate"),
      ]);
      if (!vivant) return;
      setHistClient(ventes.error ? null : ventes.count ?? 0);
      setVehiculesClient(vehs.error ? [] : ((vehs.data ?? []) as VehiculeOption[]));
      setVehiculeId("");
      setOrdresOuverts([]); setWorkOrderId("");
    })();
    return () => { vivant = false; };
  }, [clientId]);

  useEffect(() => {
    if (!supabase) return;
    let vivant = true;
    if (!vehiculeId) {
      const t = window.setTimeout(() => {
        setHistVehicule(null); setOrdresOuverts([]); setWorkOrderId("");
      }, 0);
      return () => { vivant = false; window.clearTimeout(t); };
    }
    void (async () => {
      const [interventions, ordres] = await Promise.all([
        supabase!.from("work_orders").select("id", { count: "exact", head: true }).eq("vehicle_id", vehiculeId),
        supabase!.from("work_orders").select("id, reference, status").eq("vehicle_id", vehiculeId)
          .in("status", ["pending", "in_progress", "waiting_parts"]).limit(50),
      ]);
      if (!vivant) return;
      setHistVehicule(interventions.error ? null : interventions.count ?? 0);
      setOrdresOuverts(ordres.error ? [] : ((ordres.data ?? []) as { id: string; reference: string }[]));
      setWorkOrderId("");
    })();
    return () => { vivant = false; };
  }, [vehiculeId]);

  /* ---------------------------------------------------------------
   * Catalogue : catégories dynamiques, recherche multi-champs,
   * filtre véhicule (compatibilités vérifiées uniquement)
   * --------------------------------------------------------------- */
  const categoriesSidebar = useMemo(() => {
    const presents = new Set(produits.map((p) => p.categorieCle));
    const liste = ORDRE_FAMILLES.filter((c) => presents.has(c)).map((c) => ({ cle: c, libelle: FAMILLES[c] }));
    // Familles créées par l'administrateur hors de la liste de référence.
    for (const c of presents) {
      if (!ORDRE_FAMILLES.includes(c)) liste.push({ cle: c, libelle: FAMILLES[c] ?? c });
    }
    if (prestations.length) liste.push({ cle: CAT_SERVICES, libelle: "Main-d'œuvre et prestations" });
    return liste;
  }, [produits, prestations]);

  const catalogueFiltre = useMemo(() => {
    if (categorie === CAT_SERVICES) return [];
    const q = recherche.trim().toLowerCase();
    return produits.filter((p) => {
      if (categorie !== "Toutes" && p.categorieCle !== categorie) return false;
      if (!q) return true;
      const dims = tireDims.get(p.id) ?? "";
      const compat = compatTexte.get(p.id) ?? "";
      return [p.nom, p.sku, p.barcode ?? "", p.marque, p.refFab ?? "", p.refOem ?? "",
        p.categorieLibelle, dims, compat].join(" ").toLowerCase().includes(q);
    });
  }, [produits, recherche, categorie, tireDims, compatTexte]);

  const prestationsFiltre = useMemo(() => {
    if (categorie !== CAT_SERVICES) return [];
    const q = recherche.trim().toLowerCase();
    return prestations.filter((s) => !q || `${s.nom} ${libelleService(s.categorie)}`.toLowerCase().includes(q));
  }, [prestations, recherche, categorie]);

  /** Avec un véhicule choisi : seules les compatibilités VÉRIFIÉES
   *  sont présentées comme compatibles (jamais une compat non vérifiée). */
  const catalogueVehicule = useMemo(() => {
    if (!vehiculeActif || afficherTous) return catalogueFiltre;
    return catalogueFiltre.filter((p) => compatVehicule.get(p.id) === true);
  }, [catalogueFiltre, vehiculeActif, afficherTous, compatVehicule]);

  const nbCompatibles = useMemo(
    () => (vehiculeActif ? catalogueFiltre.filter((p) => compatVehicule.get(p.id) === true).length : 0),
    [catalogueFiltre, vehiculeActif, compatVehicule],
  );

  /* ---------------------------------------------------------------
   * Totaux : remise par ligne + remise ticket, TVA agrégée par ligne
   * --------------------------------------------------------------- */
  const sousTotal = useMemo(
    () => round2(lignes.reduce((s, l) => { const b = l.prix * l.quantite; return s + b - (b * l.remisePct) / 100; }, 0)),
    [lignes],
  );
  const totalRemise = useMemo(() => {
    const pct = Math.max(0, Math.min(pourcentageRemise, 100));
    return round2(Math.max(0, Math.min((sousTotal * pct) / 100 + remiseMontant, sousTotal)));
  }, [sousTotal, pourcentageRemise, remiseMontant]);
  const baseHT = round2(sousTotal - totalRemise);
  const ratioRemise = sousTotal > 0 ? baseHT / sousTotal : 0;
  const montantTVA = useMemo(
    () => round2(lignes.reduce((s, l) => {
      const b = l.prix * l.quantite * (1 - l.remisePct / 100);
      return s + (b * ratioRemise * l.tva) / 100;
    }, 0)),
    [lignes, ratioRemise],
  );
  const totalTTC = round2(baseHT + montantTVA);

  const montantRegle = useMemo(() => round2(reglements.reduce((s, r) => s + r.montant, 0)), [reglements]);
  const montantRecuNum = Number(montantRecu) || 0;
  const estEspeces = reglements.length === 1 && reglements[0]?.methode === "especes";
  const monnaieRendue = estEspeces ? Math.max(0, round2(montantRecuNum - montantRegle)) : 0;
  const resteDu = modePaiement === "credit" ? totalTTC : Math.max(0, round2(totalTTC - montantRegle));

  /* ---------------------------------------------------------------
   * Panier : produits, prestations, lignes libres
   * --------------------------------------------------------------- */
  function majLigne(cle: string, patch: Partial<Ligne>) {
    setLignes((cur) => cur.map((l) => (l.cle === cle ? { ...l, ...patch } : l)));
  }

  function ajouterProduit(p: Produit) {
    setErreur(null);
    const memeArticle = (l: Ligne) =>
      l.type === "produit" && (l.produitId === p.id || (!p.id && l.nom === p.nom));
    const dansTicket = lignes.filter(memeArticle).reduce((s, l) => s + l.quantite, 0);
    if (p.stock > 0 && dansTicket >= p.stock) {
      setErreur(`Stock insuffisant pour « ${p.nom} » : ${p.stock} unité(s) disponible(s).`);
      return;
    }
    const dims = tireDims.get(p.id);
    const refs = [p.refFab ? `Réf ${p.refFab}` : null, p.refOem ? `OEM ${p.refOem}` : null]
      .filter(Boolean).join(" · ");
    const detail = dims || refs || null;
    setLignes((cur) => {
      const idx = cur.findIndex(memeArticle);
      if (idx >= 0) return cur.map((l, i) => (i === idx ? { ...l, quantite: l.quantite + 1 } : l));
      return [...cur, {
        cle: nouvelleCle(), type: "produit", produitId: p.id || null, serviceId: null,
        nom: p.nom, detail, prix: p.prix, quantite: 1, remisePct: 0, tva: p.tva,
      }];
    });
  }

  function ajouterPrestation(s: Prestation) {
    setErreur(null);
    setLignes((cur) => {
      const idx = cur.findIndex((l) => l.type === "service" && l.serviceId === s.id);
      if (idx >= 0) return cur.map((l, i) => (i === idx ? { ...l, quantite: l.quantite + 1 } : l));
      return [...cur, {
        cle: nouvelleCle(), type: "service", produitId: null, serviceId: s.id,
        nom: s.nom,
        detail: s.duree > 0 ? `${s.duree} min · ${libelleService(s.categorie)}` : libelleService(s.categorie),
        prix: s.prix, quantite: 1, remisePct: 0, tva: 20,
      }];
    });
  }

  function ajouterPrestationLibre() {
    setErreur(null);
    setLignes((cur) => [...cur, {
      cle: nouvelleCle(), type: "libre", produitId: null, serviceId: null,
      nom: "Prestation personnalisée", detail: "Prix à définir",
      prix: 0, quantite: 1, remisePct: 0, tva: 20,
    }]);
  }

  function retirerLigne(cle: string) {
    setLignes((cur) => cur.flatMap((l) =>
      l.cle !== cle ? [l] : l.quantite > 1 ? [{ ...l, quantite: l.quantite - 1 }] : [],
    ));
  }

  function supprimerLigne(cle: string) {
    setLignes((cur) => cur.filter((l) => l.cle !== cle));
  }

  function augmenterLigne(l: Ligne) {
    if (l.type === "produit") {
      const p = produits.find((x) => x.id === l.produitId);
      if (p && p.stock > 0 && l.quantite >= p.stock) {
        setErreur(`Stock insuffisant pour « ${p.nom} » : ${p.stock} unité(s).`);
        return;
      }
    }
    majLigne(l.cle, { quantite: l.quantite + 1 });
  }

  /* ---------------------------------------------------------------
   * Scan (douchette / caméra via ScanChamp)
   * --------------------------------------------------------------- */
  function traiterCode(code: string) {
    const propre = code.replace(/[^\dA-Za-z]/g, "");
    if (!propre) return;
    const produit =
      produits.find((p) => p.sku.toLowerCase() === propre.toLowerCase()) ??
      produits.find((p) => (p.barcode ?? "").toLowerCase() === propre.toLowerCase());
    if (produit) {
      ajouterProduit(produit);
      setMessage(`Code ${propre} : ${produit.nom} ajouté au ticket.`);
      setErreur(null);
    } else {
      setErreur(`Code-barres ${propre} introuvable dans le catalogue.`);
    }
  }

  /* ---------------------------------------------------------------
   * Création rapide client / véhicule (si permission)
   * --------------------------------------------------------------- */
  async function creerClientRapide() {
    if (!supabase || savingModal) return;
    const nom = formClient.nom.trim();
    if (!nom) { setErreur("Le nom du client est requis."); return; }
    setSavingModal(true); setErreur(null);
    try {
      const { data: profileRows, error: profileError } = await supabase.rpc("get_my_profile");
      const establishmentId = profileRows?.[0]?.establishment_id;
      if (profileError || !establishmentId) throw new Error("Établissement introuvable.");
      const { data: cree, error } = await supabase.from("clients").insert({
        establishment_id: establishmentId,
        code: `CLI-${String(Date.now()).slice(-6)}`,
        full_name: nom,
        phone: formClient.tel.trim() || null,
      }).select("id, full_name").single();
      if (error || !cree) throw new Error(error?.message ?? "Création du client impossible.");
      setClients((cur) => [...cur, cree as ClientOption].sort((a, b) => a.full_name.localeCompare(b.full_name)));
      setClientId(cree.id);
      setFormClient({ nom: "", tel: "" });
      setModalClient(false);
      setMessage(`Client « ${nom} » créé et sélectionné.`);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Création du client impossible.");
    } finally {
      setSavingModal(false);
    }
  }

  async function creerVehiculeRapide() {
    if (!supabase || savingModal) return;
    if (!clientId) { setErreur("Sélectionnez d'abord un client."); return; }
    const f = formVehicule;
    if (!f.plaque.trim() || !f.marque.trim() || !f.modele.trim()) {
      setErreur("Immatriculation, marque et modèle sont requis.");
      return;
    }
    setSavingModal(true); setErreur(null);
    try {
      const { data: profileRows, error: profileError } = await supabase.rpc("get_my_profile");
      const establishmentId = profileRows?.[0]?.establishment_id;
      if (profileError || !establishmentId) throw new Error("Établissement introuvable.");
      const { data: cree, error } = await supabase.from("vehicles").insert({
        establishment_id: establishmentId,
        client_id: clientId,
        plate: f.plaque.trim().toUpperCase(),
        brand: f.marque.trim(),
        model: f.modele.trim(),
        year: f.annee ? Number(f.annee) : null,
        mileage: 0,
        status: "active",
      }).select("id, plate, brand, model, year").single();
      if (error || !cree) throw new Error(error?.message ?? "Création du véhicule impossible.");
      setVehiculesClient((cur) => [...cur, cree as VehiculeOption]);
      setVehiculeId(cree.id);
      setFormVehicule({ plaque: "", marque: "", modele: "", annee: "" });
      setModalVehicule(false);
      setMessage(`Véhicule ${cree.plate} créé et sélectionné.`);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Création du véhicule impossible.");
    } finally {
      setSavingModal(false);
    }
  }

  /* ---------------------------------------------------------------
   * Paiement : panneau compact, modes, règlements multiples
   * --------------------------------------------------------------- */
  function choisirMode(m: ModePaiement) {
    setModePaiement(m);
    setMontantRecu("");
    if (m === "credit") setReglements([]);
    else if (m === "partiel") setReglements([{ methode: "especes", montant: 0 }]);
    else setReglements([{ methode: m as Reglement["methode"], montant: totalTTC }]);
  }

  function ouvrirPaiement() {
    if (!lignes.length || saving) return;
    setErreur(null); setMessage(null); setDerniereVente(null);
    choisirMode("especes");
    setPanneauPaiement(true);
  }

  function ajouterReglement() {
    setReglements((cur) => [...cur, { methode: "carte", montant: Math.max(0, round2(totalTTC - montantRegle)) }]);
  }

  function majReglement(i: number, patch: Partial<Reglement>) {
    setReglements((cur) => cur.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function supprimerReglement(i: number) {
    setReglements((cur) => cur.filter((_, idx) => idx !== i));
  }

  function fermerPaiement() {
    setPanneauPaiement(false);
    setErreur(null);
    setMontantRecu("");
    setReglements([]);
    setModePaiement("especes");
  }

  function fermerRecu() {
    setDerniereVente(null);
    setPanneauPaiement(false);
    setErreur(null);
    setMontantRecu("");
    setReglements([]);
    setModePaiement("especes");
  }

  /* ---------------------------------------------------------------
   * Encaissement transactionnel (RPC 0021) + repli ancien chemin
   * --------------------------------------------------------------- */
  type ItemVente = {
    product_id: string | null; service_id: string | null; label: string;
    quantity: number; unit_price: number; tax_rate: number; discount: number;
  };
  type PaymentVente = { method: string; amount: number };

  async function encaisserLegacy(args: { reference: string; items: ItemVente[]; payments: PaymentVente[]; status: string }) {
    if (!supabase) return;
    const { data: profileRows, error: profileError } = await supabase.rpc("get_my_profile");
    const establishmentId = profileRows?.[0]?.establishment_id;
    if (profileError || !establishmentId) throw new Error("Établissement introuvable.");

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id ?? null;

    // 1) Vente (repli sans vehicle_id si la colonne 0021 n'existe pas encore).
    const base: Record<string, unknown> = {
      establishment_id: establishmentId,
      client_id: clientId || null,
      work_order_id: workOrderId || null,
      reference: args.reference,
      status: args.status,
      subtotal: baseHT,
      discount: totalRemise,
      tax_total: montantTVA,
      total: totalTTC,
      paid_total: montantRegle,
    };
    let vente = await supabase.from("sales").insert({ ...base, vehicle_id: vehiculeId || null }).select("id").single();
    if (vente.error && vente.error.message.includes("vehicle_id")) {
      vente = await supabase.from("sales").insert(base).select("id").single();
    }
    if (vente.error || !vente.data) throw new Error(vente.error?.message ?? "La vente n'a pas pu être créée.");
    const saleId = vente.data.id as string;

    // 2) Lignes (produits + services + libres)
    const { error: linesError } = await supabase.from("sale_items").insert(
      args.items.map((it) => ({
        establishment_id: establishmentId,
        sale_id: saleId,
        product_id: it.product_id,
        service_id: it.service_id,
        label: it.label,
        quantity: it.quantity,
        unit_price: it.unit_price,
        tax_rate: it.tax_rate,
        discount: it.discount,
      })),
    );
    if (linesError) throw new Error(linesError.message);

    // 3) Règlements (jusqu'à N modes → règlement mixte)
    if (args.payments.length) {
      const { error: payError } = await supabase.from("payments").insert(
        args.payments.map((p) => ({
          establishment_id: establishmentId,
          sale_id: saleId,
          method: p.method,
          amount: p.amount,
          received_by: userId,
        })),
      );
      if (payError) throw new Error(payError.message);
    }

    // 4) Mouvements de stock + décrément : PRODUITS UNIQUEMENT.
    //    Les prestations (service_id) et lignes libres ne touchent jamais au stock.
    for (const l of lignes) {
      if (l.type !== "produit" || !l.produitId) continue;
      const { error: moveError } = await supabase.from("stock_movements").insert({
        establishment_id: establishmentId,
        product_id: l.produitId,
        direction: "out",
        quantity: l.quantite,
        reference: args.reference,
        actor_id: userId,
      });
      if (moveError) throw new Error(moveError.message);
      const p = produits.find((x) => x.id === l.produitId);
      const nouveauStock = Math.max(0, (p?.stock ?? 0) - l.quantite);
      const { error: stockError } = await supabase.from("products")
        .update({ stock: nouveauStock })
        .eq("id", l.produitId);
      if (stockError) throw new Error(stockError.message);
    }
  }

  async function encaisser() {
    if (verrouEncaissement.current) return; // anti vente en double
    setErreur(null);
    setMessage(null);

    if (!supabase) { setErreur("Supabase n'est pas configuré : encaissement impossible."); return; }
    if (!lignes.length) { setErreur("Ticket vide."); return; }
    if (modePaiement === "credit" && !clientId) {
      setErreur("Un client est obligatoire pour une vente à crédit."); return;
    }
    if (modePaiement === "credit" && !posEdit) {
      setErreur("Permission refusée : la vente à crédit n'est pas autorisée pour votre rôle."); return;
    }
    if (totalRemise > 0 && !posEdit) {
      setErreur("Permission refusée : la remise n'est pas autorisée pour votre rôle."); return;
    }
    if (modePaiement === "partiel" && (montantRegle <= 0 || montantRegle >= totalTTC)) {
      setErreur("Saisissez un montant de paiement partiel strictement inférieur au total."); return;
    }
    if (modePaiement !== "partiel" && modePaiement !== "credit" && montantRegle < totalTTC - 0.005) {
      setErreur(`Montant insuffisant : il manque ${formatMad(round2(totalTTC - montantRegle))}. Utilisez le mode Partiel pour un encaissement incomplet.`); return;
    }
    if (estEspeces && montantRecuNum > 0 && montantRecuNum < montantRegle - 0.005) {
      setErreur(`Espèces insuffisantes : il manque ${formatMad(round2(montantRegle - montantRecuNum))}.`); return;
    }

    verrouEncaissement.current = true;
    setSaving(true);

    try {
      const reference = `VNT-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
      const status = modePaiement === "credit" ? "open" : montantRegle >= totalTTC - 0.005 ? "paid" : "partial";
      const items: ItemVente[] = lignes.map((l) => ({
        product_id: l.type === "produit" ? l.produitId : null,
        service_id: l.type === "service" ? l.serviceId : null,
        label: l.nom,
        quantity: l.quantite,
        unit_price: l.prix,
        tax_rate: l.tva,
        discount: l.remisePct,
      }));
      const payments: PaymentVente[] = reglements
        .filter((r) => r.montant > 0)
        .map((r) => ({ method: METHODE_BDD[r.methode], amount: round2(r.montant) }));

      // ---- Voie transactionnelle (migration 0021) ----
      const { data: saleId, error: rpcError } = await supabase.rpc("create_pos_sale", {
        p_reference: reference,
        p_client_id: clientId || null,
        p_vehicle_id: vehiculeId || null,
        p_work_order_id: workOrderId || null,
        p_subtotal: baseHT,
        p_discount: totalRemise,
        p_tax_total: montantTVA,
        p_total: totalTTC,
        p_paid_total: montantRegle,
        p_status: status,
        p_items: items,
        p_payments: payments,
      });

      if (rpcError) {
        const msg = rpcError.message.toLowerCase();
        const rpcAbsente =
          rpcError.code === "42883" || rpcError.code === "PGRST202" ||
          msg.includes("could not find the function") || msg.includes("could not find function");
        // Une erreur de permission venue du serveur ne doit JAMAIS basculer
        // sur le repli (sinon le garde-fous serait contournable).
        if (!rpcAbsente) throw new Error(rpcError.message);
        await encaisserLegacy({ reference, items, payments, status });
      } else if (!saleId) {
        throw new Error("L'encaissement n'a pas renvoyé de vente.");
      }

      const recu: Recu = {
        reference,
        date: new Date().toLocaleString("fr-FR"),
        lignes: lignes.map((l) => ({ nom: l.nom, quantite: l.quantite, prix: l.prix, reference: l.detail, remisePct: l.remisePct, tva: l.tva })),
        sousTotal,
        remise: totalRemise,
        tva: montantTVA,
        total: totalTTC,
        paye: montantRegle,
        reste: Math.max(0, round2(totalTTC - montantRegle)),
        monnaie: monnaieRendue,
        client: clients.find((c) => c.id === clientId)?.full_name ?? null,
        vehicule: vehiculeLibelle,
        reglements: payments.length ? payments.map((p) => ({ methode: p.method, montant: p.amount })) : [{ methode: METHODE_BDD[reglements[0]?.methode ?? "especes"], montant: montantRegle }],
        referenceTransaction: typeof saleId === "string" ? saleId.slice(0, 8) : null,
        caissier: profil.fullName || null,
      };
      setDerniereVente(recu);
      setMessage(`Vente ${reference} enregistrée — ${formatMad(totalTTC)}${recu.reste > 0 ? `, reste à payer : ${formatMad(recu.reste)}` : ""}.`);
      setLignes([]);
      setPourcentageRemise(0);
      setRemiseMontant(0);
      setMontantRecu("");
      setReglements([]);
      setModePaiement("especes");
      setClientId("");
      setVehiculeId("");
      setWorkOrderId("");
      setPanierMobile(false);
      void charger(); // recharger les stocks à jour
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Erreur lors de l'encaissement.");
    } finally {
      verrouEncaissement.current = false;
      setSaving(false);
    }
  }

  /* ---------------------------------------------------------------
   * Devis depuis le panier (sans toucher au stock)
   * --------------------------------------------------------------- */
  async function creerDevisDepuisTicket() {
    if (verrouEncaissement.current) return;
    setErreur(null);
    setMessage(null);
    if (!supabase) { setErreur("Supabase n'est pas configuré : devis impossible."); return; }
    if (!lignes.length) { setErreur("Ticket vide."); return; }

    verrouEncaissement.current = true;
    setSaving(true);
    try {
      const { data: profileRows, error: profileError } = await supabase.rpc("get_my_profile");
      const establishmentId = profileRows?.[0]?.establishment_id;
      if (profileError || !establishmentId) throw new Error("Établissement introuvable.");

      const identifiant = typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase()
        : `T${lignes.length}${Date.now().toString().slice(-4)}`;
      const reference = `DEV-${new Date().getFullYear()}-${identifiant}`;

      const base: Record<string, unknown> = {
        establishment_id: establishmentId,
        client_id: clientId || null,
        reference,
        status: "draft",
        subtotal: baseHT,
        discount: totalRemise,
        tax_total: montantTVA,
        total: totalTTC,
        valid_until: new Date(Date.now() + 15 * 86400_000).toISOString().slice(0, 10),
      };
      let devis = await supabase.from("quotes").insert({ ...base, vehicle_id: vehiculeId || null }).select("id").single();
      if (devis.error && devis.error.message.includes("vehicle_id")) {
        devis = await supabase.from("quotes").insert(base).select("id").single();
      }
      if (devis.error || !devis.data) throw new Error(devis.error?.message ?? "Devis non créé.");

      const { error: itemsError } = await supabase.from("quote_items").insert(
        lignes.map((l, index) => ({
          establishment_id: establishmentId,
          quote_id: devis.data.id,
          product_id: l.type === "produit" ? l.produitId : null,
          service_id: l.type === "service" ? l.serviceId : null,
          label: l.nom,
          quantity: l.quantite,
          unit_price: l.prix,
          tax_rate: l.tva,
          discount: l.remisePct,
          position: index,
        })),
      );
      if (itemsError) throw new Error(itemsError.message);

      setMessage(`Devis ${reference} créé — suivi et conversion depuis la page Devis.`);
      setLignes([]);
      setPourcentageRemise(0);
      setRemiseMontant(0);
      setMontantRecu("");
      setReglements([]);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Création du devis impossible.");
    } finally {
      verrouEncaissement.current = false;
      setSaving(false);
    }
  }

  /* ---------------------------------------------------------------
   * Impression (Print Pro) — ticket d'aperçu + reçu après encaissement.
   * Voie choisie selon la configuration : dialogue navigateur (toujours
   * disponible), ESC/POS USB/Bluetooth quand configuré et supporté.
   * --------------------------------------------------------------- */
  function etabImprimable(): Etablissement {
    return etabInfo ?? { nom: "AUTO DYALI", adresse: null, ville: null, telephone: null, email: null, url_verification: null };
  }

  function construireDonneesTicket(recu: Recu): DonneesTicket {
    return {
      reference: recu.reference,
      date: recu.date,
      caissier: recu.caissier ?? null,
      client: recu.client,
      vehicule: recu.vehicule,
      vehiculeDetails: recu.vehiculeDetails ?? null,
      lignes: recu.lignes.map((l) => ({
        nom: l.nom,
        reference: l.reference ?? null,
        quantite: l.quantite,
        prix: l.prix,
        remisePct: l.remisePct ?? undefined,
        tvaPct: l.tva ?? undefined,
      })),
      remiseTicket: recu.remise,
      totalTTC: recu.total,
      reglements: (recu.reglements ?? [{ methode: "especes", montant: recu.paye }]),
      paye: recu.paye,
      reste: recu.reste,
      monnaie: recu.monnaie,
      referenceTransaction: recu.referenceTransaction ?? null,
      reimpression: recu.reimpression ?? null,
    };
  }

  /** Impression du reçu : numéro de vente initial conservé, réimpression
   *  comptée et journalisée (print_jobs, migration 0024). */
  async function imprimerRecuEnrichi(recu: Recu) {
    if (impressionEnCours) return;
    setImpressionEnCours(true);
    setErreur(null);
    try {
      const imprimante = imprimanteParDefaut(imprimantes, "ticket_vente");
      const format = imprimante?.format ?? "80mm";
      const langue = imprimante?.langue_defaut ?? "fr";
      const copies = imprimante?.copies_par_defaut ?? 1;
      const reimpression = await compterImpressions(recu.reference, "ticket_vente");
      const donnees = construireDonneesTicket(recu);
      donnees.reimpression = reimpression > 0 ? reimpression + 1 : null;

      if (format === "A4" || !imprimante || imprimante.connexion === "navigateur" || imprimante.connexion === "reseau") {
        const html = modeleTicketHtml(donnees, etabImprimable(), langue, format, { copies });
        const res = ouvrirImpressionNavigateur(html);
        if (!res.ok) throw new Error(res.message ?? "Impression impossible.");
        setMessage(
          reimpression > 0
            ? `Réimpression n°${reimpression + 1} du ticket ${recu.reference} — numéro initial conservé.`
            : `Ticket ${recu.reference} envoyé au dialogue d'impression.`,
        );
      } else {
        const payload = ticketEscpos(donnees, etabImprimable(), format);
        const res = await envoyerEscpos(payload, imprimante, `ticket-${recu.reference}.bin`);
        setMessage(res.message ?? `Ticket envoyé via ${imprimante.connexion}.`);
      }
      if (etabInfo?.id) {
        await journaliserImpression(
          etabInfo.id, imprimante,
          { documentType: "ticket_vente", reference: recu.reference, reimpression: reimpression > 0 ? reimpression + 1 : 0 },
          format, langue, copies,
        );
      }
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Impression impossible.");
    } finally {
      setImpressionEnCours(false);
    }
  }

  function imprimerTicket() {
    if (!lignes.length) return;
    const recuApercu: Recu = {
      reference: "APERÇU — pas une vente",
      date: new Date().toLocaleString("fr-FR"),
      lignes: lignes.map((l) => ({ nom: l.nom, quantite: l.quantite, prix: l.prix, reference: l.detail, remisePct: l.remisePct, tva: l.tva })),
      sousTotal,
      remise: totalRemise,
      tva: montantTVA,
      total: totalTTC,
      paye: montantRegle,
      reste: Math.max(0, round2(totalTTC - montantRegle)),
      monnaie: monnaieRendue,
      client: clients.find((c) => c.id === clientId)?.full_name ?? null,
      vehicule: vehiculeLibelle,
      reglements: [{ methode: METHODE_BDD[reglements[0]?.methode ?? "especes"] ?? "especes", montant: montantRegle }],
      caissier: profil.fullName || null,
    };
    const imprimante = imprimanteParDefaut(imprimantes, "ticket_vente");
    const format = imprimante?.format ?? "80mm";
    const html = modeleTicketHtml(construireDonneesTicket(recuApercu), etabImprimable(), imprimante?.langue_defaut ?? "fr", format, { copies: 1 });
    const res = ouvrirImpressionNavigateur(html);
    if (!res.ok) setErreur(res.message ?? "Impression impossible.");
  }

  return (
    <section className="grid gap-5 xl:grid-cols-[13rem_1fr_23rem]">
      {/* En-tête compacte mobile (cachée sur PC) */}
      <div className="xl:hidden sticky top-0 z-40 flex items-center justify-between gap-2 border-b border-[#8FB59B]/20 px-4 py-3 bg-[#252D2D]/90 backdrop-blur-md">
        <button
          type="button"
          onClick={() => setPanierMobile(true)}
          className="min-h-10 min-w-10 shrink-0 rounded-lg border border-[#8FB59B]/40 flex items-center justify-center text-[#DFE7E2]"
          aria-label="Ouvrir le panier"
        >
          🛒
        </button>
        <h1 className="titre-or text-base font-extrabold flex-1 text-center">AUTO DYALI POS</h1>
        <button
          type="button"
          onClick={ouvrirPaiement}
          disabled={!lignes.length || saving}
          className={`min-h-10 min-w-10 shrink-0 rounded-lg border border-[#8FB59B]/40 flex items-center justify-center px-2 text-xs font-bold transition ${
            !lignes.length || saving ? "text-[#8FB59B]/40" : "bg-[#8FB59B] text-[#252D2D]"
          }`}
          aria-label="Paiement"
        >
          PAY
        </button>
      </div>
      {/* ------------------------------------------------------------
       * Zone 1 — Barre latérale POS fixe (toujours visible sur PC)
       * ------------------------------------------------------------ */}
      <aside className="carte h-fit p-3 hidden xl:flex">
        <div className="flex flex-col gap-2">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#A7B7A8] mb-1">POS</p>
          {POS_NAV.map((n) => {
            const actif = posSection === n.cle;
            return (
              <button
                key={n.cle}
                type="button"
                onClick={() => { if (!n.href) setPosSection(n.cle); }}
                className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition touch-manipulation ${
                  actif ? "bg-[#8FB59B] font-bold text-[#252D2D]" : "text-[#E8ECE8]/80 hover:bg-[#344440] hover:text-[#E8ECE8]"
                }`}
                aria-pressed={actif}
              >
                <span className="shrink-0 text-xl">{n.icone === "carton" ? "📦" : n.icone === "client" ? "👤" : n.icone === "voiture" ? "🚗" : n.icone === "historique" ? "🕒" : n.icone === "rapport" ? "📄" : n.icone === "ca" ? "💳" : n.icone === "imprimante" ? "🖨️" : n.icone === "cle" ? "🔧" : n.icone === "plus" ? "⚙️" : "📋"}</span>
                {n.label}
              </button>
            );
          })}
        </div>
      </aside>

      {/* ------------------------------------------------------------
       * Zone 2 — Catalogue intelligent (centre)
       * ------------------------------------------------------------ */}
      <div className="carte min-w-0 p-4 sm:p-5">
        <div className="mb-4">
          <p className="text-xs uppercase tracking-[0.2em] text-[#A7B7A8]">Vente tactile</p>
          <h2 className="titre-or mt-1 text-xl font-extrabold">Catalogue automobile</h2>
          <p className="mt-1 text-xs text-[#A7B7A8]">
            {loading
              ? "Chargement du catalogue Supabase…"
              : categorie === CAT_SERVICES
                ? `${prestationsFiltre.length} prestation(s) — cliquez pour ajouter au panier.`
                : `${catalogueVehicule.length} produit(s) — cliquez pour ajouter au panier.`}
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <label className="text-[10px] uppercase tracking-[0.2em] text-[#A7B7A8] shrink-0">Famille</label>
            <button
              type="button"
              onClick={() => setCategorie("Toutes")}
              className={`shrink-0 rounded-lg px-3 py-2 text-xs transition ${
                categorie === "Toutes" ? "bg-[#8FB59B] font-bold text-[#252D2D]" : "text-[#E8ECE8]/80 hover:bg-[#344440]"
              }`}
            >
              Toutes
            </button>
            {categoriesSidebar.map((cat) => (
              <button
                key={cat.cle}
                type="button"
                onClick={() => setCategorie(cat.cle)}
                className={`shrink-0 rounded-lg px-3 py-2 text-xs transition ${
                  categorie === cat.cle ? "bg-[#8FB59B] font-bold text-[#252D2D]" : "text-[#E8ECE8]/80 hover:bg-[#344440]"
                }`}
              >
                {cat.libelle}
              </button>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2 border-t border-[#8FB59B]/10 pt-3">
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#A7B7A8] shrink-0">Scan</p>
            <div className="flex-1">
              <ScanChamp onCode={traiterCode} placeholder="EAN-13, QR, code-barres…" />
            </div>
            <p className="text-[10px] text-[#A7B7A8]">📷 caméra</p>
          </div>
        </div>

        {/* Sélecteur véhicule facultatif : Marque → Modèle → Année → Motorisation → Version */}
        <div className="rounded-xl border border-[#8FB59B]/15 bg-[#344440]/40 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setVehOuvert(!vehOuvert)}
              className="min-h-9 rounded-lg border border-[#8FB59B]/40 px-3 text-xs font-semibold text-[#DFE7E2]"
              aria-expanded={vehOuvert}
            >
              🚗 Sélecteur véhicule (facultatif) {vehOuvert ? "▲" : "▼"}
            </button>
            {vehiculeActif && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-[#DFE7E2]">{vehiculeLibelle}</span>
                <button type="button" onClick={reinitVehicule} className="min-h-7 min-w-7 rounded bg-[#344440] text-xs text-[#C5716B]" aria-label="Réinitialiser le véhicule">✕</button>
              </div>
            )}
          </div>

          {vehOuvert && (
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
              <label className="text-[10px] uppercase tracking-wide text-[#A7B7A8]">
                Marque
                <select
                  value={vehMarque}
                  onChange={(e) => { setVehMarque(e.target.value); setVehModele(""); setVehAnnee(""); setVehMoteur(""); setVehVersion(""); }}
                  className="champ mt-1 min-h-10 py-1 text-sm normal-case tracking-normal"
                >
                  <option value="">{marques.length ? "Choisir…" : "Chargement…"}</option>
                  {marques.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </label>
              <label className="text-[10px] uppercase tracking-wide text-[#A7B7A8]">
                Modèle
                <select
                  value={vehModele}
                  disabled={!vehMarque}
                  onChange={(e) => { setVehModele(e.target.value); setVehAnnee(""); setVehMoteur(""); setVehVersion(""); }}
                  className="champ mt-1 min-h-10 py-1 text-sm normal-case tracking-normal disabled:opacity-50"
                >
                  <option value="">{vehMarque ? (modeles.length ? "Choisir…" : "Aucun modèle") : "—"}</option>
                  {modeles.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </label>
              <label className="text-[10px] uppercase tracking-wide text-[#A7B7A8]">
                Année
                <select
                  value={vehAnnee}
                  disabled={!vehModele}
                  onChange={(e) => { setVehAnnee(e.target.value); setVehMoteur(""); setVehVersion(""); }}
                  className="champ mt-1 min-h-10 py-1 text-sm normal-case tracking-normal disabled:opacity-50"
                >
                  <option value="">{vehModele ? (annees.length ? "Choisir…" : "Aucune année") : "—"}</option>
                  {annees.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </label>
              <label className="text-[10px] uppercase tracking-wide text-[#A7B7A8]">
                Motorisation
                <select
                  value={vehMoteur}
                  disabled={!vehAnnee}
                  onChange={(e) => { setVehMoteur(e.target.value); setVehVersion(""); }}
                  className="champ mt-1 min-h-10 py-1 text-sm normal-case tracking-normal disabled:opacity-50"
                >
                  <option value="">Toutes motorisations</option>
                  {moteurs.filter((m) => m !== "").map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </label>
              <label className="text-[10px] uppercase tracking-wide text-[#A7B7A8]">
                Version
                <select
                  value={vehVersion}
                  disabled={!vehAnnee}
                  onChange={(e) => setVehVersion(e.target.value)}
                  className="champ mt-1 min-h-10 py-1 text-sm normal-case tracking-normal disabled:opacity-50"
                >
                  <option value="">Toutes versions</option>
                  {versions.filter((v) => v !== "").map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </label>
            </div>
          )}

          {vehiculeActif && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#8FB59B]/10 pt-2">
              <p className="text-xs text-[#A7B7A8]">
                <strong className="text-[#7FBF9E]">{nbCompatibles}</strong> pièce(s) avec compatibilité{" "}
                <strong className="text-[#7FBF9E]">vérifiée</strong> pour ce véhicule.
              </p>
              <label className="flex items-center gap-1.5 text-[11px] text-[#A7B7A8]">
                <input
                  type="checkbox"
                  checked={afficherTous}
                  onChange={(e) => setAfficherTous(e.target.checked)}
                  className="accent-[#8FB59B]"
                />
                Afficher aussi les pièces sans compatibilité vérifiée
              </label>
            </div>
          )}
        </div>

        {/* Scan douchette / caméra */}
        <div className="mt-4">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#A7B7A8]">Scan douchette / caméra</p>
          <div className="mt-1.5">
            <ScanChamp onCode={traiterCode} placeholder="EAN-13, QR, code-barres…" />
          </div>
        </div>

        {/* Recherche multi-champs */}
        <input
          type="search"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="Désignation, EAN, réf fabricant, OEM, marque, dimension, catégorie, compatibilité…"
          className="champ mt-3 min-h-11 w-full"
          aria-label="Rechercher un produit ou une prestation"
        />

        {message && <p role="status" className="mt-3 rounded-lg bg-[#5D9E7F]/10 px-3 py-2 text-xs text-[#7FBF9E]">{message}</p>}
        {erreur && <p role="alert" className="mt-3 rounded-lg bg-[#C5716B]/15 px-3 py-2 text-xs text-[#C5716B]">{erreur}</p>}

        {/* Grille : prestations (main-d'œuvre) ou produits */}
        {categorie === CAT_SERVICES ? (
          <div className="mt-4 grid max-h-[52vh] grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3 2xl:grid-cols-4">
            {prestationsFiltre.map((s) => (
              <article
                key={s.id}
                className="flex min-h-32 flex-col rounded-xl border border-[#8FB59B]/15 bg-[#344440]/60 p-3"
              >
                <span className="text-[10px] uppercase text-[#A7B7A8]">{libelleService(s.categorie)}</span>
                <strong className="mt-1 text-sm leading-4 text-[#E8ECE8]">{s.nom}</strong>
                <span className="mt-1 text-[10px] text-[#8DA298]">{s.duree > 0 ? `${s.duree} min` : "Durée libre"}</span>
                <div className="mt-auto flex items-end justify-between gap-2 pt-2">
                  <span className="text-sm font-bold text-[#DFE7E2]">{formatMad(s.prix)}</span>
                  <button
                    type="button"
                    onClick={() => ajouterPrestation(s)}
                    className="min-h-9 rounded-lg bg-[#8FB59B] px-3 text-xs font-bold text-[#252D2D]"
                  >
                    Ajouter
                  </button>
                </div>
              </article>
            ))}
            {!prestationsFiltre.length && !loading && (
              <p className="col-span-full py-6 text-center text-sm text-[#A7B7A8]">
                Aucune prestation enregistrée — utilisez « Prestation libre » dans le panier.
              </p>
            )}
            <div className="col-span-full">
              <button
                type="button"
                onClick={ajouterPrestationLibre}
                className="min-h-10 w-full rounded-lg border border-dashed border-[#8FB59B]/40 px-3 text-xs text-[#DFE7E2]"
              >
                + Prestation personnalisée (prix à définir)
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4 grid max-h-[52vh] grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3 2xl:grid-cols-4">
            {catalogueVehicule.map((p) => {
              const dims = tireDims.get(p.id);
              const compatOk = vehiculeActif ? compatVehicule.get(p.id) : undefined;
              const compatDeclar = compatTexte.get(p.id);
              return (
                <article
                  key={p.id || p.sku}
                  className="flex min-h-40 flex-col rounded-xl border border-[#8FB59B]/15 bg-[#344440]/60 p-3"
                >
                  {p.image ? (
                    /* eslint-disable-next-line @next/next/no-img-element -- photo produit externe (URL libre), non optimisable à l'avance */
                    <img src={p.image} alt="" loading="lazy" className="mb-2 h-16 w-16 rounded-lg object-cover" />
                  ) : (
                    <div className="mb-2 flex h-16 w-16 items-center justify-center rounded-lg bg-[#252D2D] text-xl font-extrabold text-[#8FB59B]">
                      {p.nom.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="text-[10px] uppercase text-[#A7B7A8]">{p.categorieLibelle}</span>
                  <strong className="mt-0.5 text-sm text-[#E8ECE8]">{p.marque}</strong>
                  <span className="text-xs leading-4 text-[#E8ECE8]/80">{p.nom}</span>
                  <span className="mt-1 text-[10px] text-[#8DA298]">
                    Réf {p.refFab ?? p.sku}{p.refOem ? ` · OEM ${p.refOem}` : ""}
                  </span>
                  {dims && <span className="text-[10px] font-semibold text-[#DFE7E2]">{dims}</span>}
                  {vehiculeActif ? (
                    compatOk === true ? (
                      <span className="mt-1 text-[10px] font-semibold text-[#7FBF9E]">✓ Compatibilité vérifiée</span>
                    ) : compatOk === false ? (
                      <span className="mt-1 text-[10px] text-[#8FB59B]">Compatibilité non vérifiée</span>
                    ) : (
                      <span className="mt-1 text-[10px] text-[#8DA298]">Aucune compatibilité vérifiée pour ce véhicule</span>
                    )
                  ) : compatDeclar ? (
                    <span className="mt-1 truncate text-[10px] text-[#8DA298]">Compat. : {compatDeclar}</span>
                  ) : null}
                  <div className="mt-auto flex items-end justify-between gap-2 pt-2">
                    <span>
                      <span className="block text-sm font-bold text-[#DFE7E2]">{formatMad(p.prix)}</span>
                      <span className={`text-[10px] ${p.stock > 0 ? "text-[#8DA298]" : "text-[#C5716B]"}`}>
                        {p.stock > 0 ? `stock ${p.stock}` : "rupture"}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => ajouterProduit(p)}
                      className="min-h-9 rounded-lg bg-[#8FB59B] px-3 text-xs font-bold text-[#252D2D]"
                    >
                      Ajouter
                    </button>
                  </div>
                </article>
              );
            })}
            {!catalogueVehicule.length && !loading && (
              <p className="col-span-full py-8 text-center text-sm text-[#A7B7A8]">
                Aucun produit ne correspond — vérifiez la recherche ou décochez le filtre véhicule.
              </p>
            )}
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------
       * Zone 3 — Panier + PAIEMENT fixe (droite) ; feuille plein écran
       * sur smartphone (bouton fixe en bas).
       * ------------------------------------------------------------ */}
      <aside
        className={`${
          panierMobile ? "fixed inset-0 z-40 flex overflow-y-auto" : "hidden xl:flex"
        } carte flex-col p-4 sm:p-5 xl:sticky xl:top-24 xl:inset-auto xl:z-auto xl:h-fit`}
      >
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-bold text-[#E8ECE8]">Panier</h2>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-[#344440] px-2 py-1 text-xs text-[#A7B7A8]">
              {lignes.length} article{lignes.length > 1 ? "s" : ""}
            </span>
            {lignes.length > 0 && (
              <button
                type="button"
                onClick={() => { setLignes([]); setErreur(null); }}
                className="text-[11px] text-[#C5716B] underline"
              >
                Vider
              </button>
            )}
            <button
              type="button"
              onClick={() => setPanierMobile(false)}
              className="min-h-8 min-w-8 rounded-lg bg-[#344440] text-sm text-[#DFE7E2] xl:hidden"
              aria-label="Fermer le panier"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Client optionnel (obligatoire au crédit) + historique */}
        <label className="mt-3 block text-[10px] uppercase tracking-[0.15em] text-[#A7B7A8]">
          Client {modePaiement === "credit" && <span className="text-[#C5716B]">(obligatoire au crédit)</span>}
          <span className="mt-1 flex gap-1">
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="champ min-h-10 flex-1 py-1 text-sm normal-case tracking-normal"
            >
              <option value="">Client comptoir (anonyme)</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
            </select>
            <button
              type="button"
              onClick={() => setModalClient(true)}
              disabled={!peutCreerClient}
              title={peutCreerClient ? "Créer un nouveau client" : "Permission requise : création de client"}
              className="min-h-10 shrink-0 rounded-lg border border-[#8FB59B]/40 px-2.5 text-xs text-[#DFE7E2] disabled:cursor-not-allowed disabled:opacity-40"
            >
              + Client
            </button>
          </span>
        </label>
        {peutVoirHistClient && histClient !== null && histClient > 0 && (
          <p className="mt-1 text-[10px] text-[#8DA298]">{histClient} vente(s) précédente(s) pour ce client</p>
        )}

        {/* Véhicule optionnel (vente magasin sans véhicule possible) */}
        {clientId && (
          <>
            <label className="mt-2 block text-[10px] uppercase tracking-[0.15em] text-[#A7B7A8]">
              Véhicule (optionnel)
              <span className="mt-1 flex gap-1">
                <select
                  value={vehiculeId}
                  onChange={(e) => setVehiculeId(e.target.value)}
                  className="champ min-h-10 flex-1 py-1 text-sm normal-case tracking-normal"
                >
                  <option value="">Aucun véhicule (achat magasin)</option>
                  {vehiculesClient.map((v) => (
                    <option key={v.id} value={v.id}>{v.plate} — {v.brand} {v.model}{v.year ? ` (${v.year})` : ""}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setModalVehicule(true)}
                  disabled={!peutCreerVehicule}
                  title={peutCreerVehicule ? "Ajouter un véhicule à ce client" : "Permission requise : création de véhicule"}
                  className="min-h-10 shrink-0 rounded-lg border border-[#8FB59B]/40 px-2.5 text-xs text-[#DFE7E2] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  + Véhicule
                </button>
              </span>
            </label>
            {vehiculeId && peutVoirInterventions && histVehicule !== null && histVehicule > 0 && (
              <p className="mt-1 text-[10px] text-[#8DA298]">{histVehicule} intervention(s) précédente(s) sur ce véhicule</p>
            )}
            {vehiculeId && peutVoirInterventions && ordresOuverts.length > 0 && (
              <label className="mt-2 block text-[10px] uppercase tracking-[0.15em] text-[#A7B7A8]">
                Ordre de réparation (optionnel)
                <select
                  value={workOrderId}
                  onChange={(e) => setWorkOrderId(e.target.value)}
                  className="champ mt-1 min-h-10 py-1 text-sm normal-case tracking-normal"
                >
                  <option value="">Aucun ordre associé</option>
                  {ordresOuverts.map((o) => <option key={o.id} value={o.id}>{o.reference}</option>)}
                </select>
              </label>
            )}
          </>
        )}

        {/* Lignes : produits ET prestations, remise + TVA par ligne */}
        <div className="mt-3 flex max-h-56 flex-col gap-2 overflow-y-auto">
          {lignes.length === 0 ? (
            <p className="py-6 text-center text-sm text-[#A7B7A8]">Aucun article sélectionné.</p>
          ) : (
            lignes.map((l) => (
              <div key={l.cle} className="border-b border-[#8FB59B]/10 pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#E8ECE8]">
                      {l.type === "service" ? "🔧 " : l.type === "libre" ? "🛠 " : ""}{l.nom}
                    </p>
                    {l.detail && <p className="truncate text-[10px] text-[#A7B7A8]">{l.detail}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => supprimerLigne(l.cle)}
                    className="min-h-10 min-w-10 touch-manipulation rounded bg-[#C5716B]/15 text-sm text-[#C5716B]"
                    aria-label={`Supprimer ${l.nom}`}
                  >
                    ✕
                  </button>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => retirerLigne(l.cle)}
                    className="min-h-10 min-w-10 touch-manipulation rounded-lg bg-[#344440] text-base text-[#8FB59B]"
                    aria-label={`Retirer une unité de ${l.nom}`}
                  >
                    −
                  </button>
                  <span className="w-7 text-center text-sm text-[#E8ECE8]">{l.quantite}</span>
                  <button
                    type="button"
                    onClick={() => augmenterLigne(l)}
                    className="min-h-10 min-w-10 touch-manipulation rounded-lg bg-[#344440] text-base text-[#8FB59B]"
                    aria-label={`Ajouter une unité de ${l.nom}`}
                  >
                    +
                  </button>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={l.prix}
                    disabled={!posEdit}
                    onChange={(e) => majLigne(l.cle, { prix: Math.max(0, Number(e.target.value) || 0) })}
                    className="champ min-h-9 w-20 px-1 py-0.5 text-xs disabled:opacity-50"
                    aria-label={`Prix unitaire de ${l.nom}`}
                    title={posEdit ? "Prix unitaire" : "Permission requise pour modifier le prix"}
                  />
                  <span className="ml-auto text-sm font-bold text-[#DFE7E2]">
                    {formatMad(round2(l.prix * l.quantite * (1 - l.remisePct / 100)))}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-1.5">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={l.remisePct}
                    disabled={!posEdit}
                    onChange={(e) => majLigne(l.cle, { remisePct: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })}
                    className="champ min-h-9 w-14 px-1 py-0.5 text-xs disabled:opacity-50"
                    aria-label={`Remise en % de ${l.nom}`}
                    title={posEdit ? "Remise de la ligne (%)" : "Permission requise pour la remise"}
                  />
                  <span className="text-[10px] text-[#A7B7A8]">% remise</span>
                  <select
                    value={l.tva}
                    onChange={(e) => majLigne(l.cle, { tva: Number(e.target.value) })}
                    className="champ min-h-7 w-[4.5rem] py-0.5 text-xs"
                    aria-label={`TVA de ${l.nom}`}
                  >
                    {TVA_OPTIONS.map((t) => <option key={t} value={t}>TVA {t}%</option>)}
                  </select>
                  {l.type === "libre" && (
                    <input
                      value={l.nom}
                      onChange={(e) => majLigne(l.cle, { nom: e.target.value })}
                      className="champ min-h-7 flex-1 px-1 py-0.5 text-xs"
                      aria-label="Nom de la prestation libre"
                      placeholder="Nom de la prestation"
                    />
                  )}
                </div>
              </div>
            ))
          )}
        </div>
        <button
          type="button"
          onClick={ajouterPrestationLibre}
          className="mt-2 min-h-9 w-full rounded-lg border border-dashed border-[#8FB59B]/40 text-xs text-[#DFE7E2]"
        >
          + Prestation libre (montage, main-d&apos;œuvre…)
        </button>

        {/* Remise ticket (permission) */}
        <div className="mt-3 space-y-2 border-t border-[#8FB59B]/20 pt-3">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="text-[#A7B7A8]">
              Remise ticket {!posEdit && <span className="text-[#C5716B]">(permission requise)</span>}
            </span>
            <div className="flex gap-1">
              {REMISE_OPTIONS.map((pct) => (
                <button
                  key={pct}
                  type="button"
                  disabled={!posEdit}
                  onClick={() => { setPourcentageRemise(pct); setRemiseMontant(0); }}
                  className={`rounded px-2 py-1 text-xs disabled:opacity-40 ${
                    pourcentageRemise === pct ? "bg-[#8FB59B] font-bold text-[#252D2D]" : "bg-[#344440] text-[#8FB59B]"
                  }`}
                >
                  {pct}%
                </button>
              ))}
            </div>
          </div>
          <label className="flex items-center justify-between gap-2 text-xs">
            <span className="text-[#A7B7A8]">Remise (MAD)</span>
            <input
              type="number"
              min="0"
              step="1"
              disabled={!posEdit}
              value={remiseMontant}
              onChange={(e) => setRemiseMontant(Math.max(0, Number(e.target.value) || 0))}
              className="champ min-h-8 w-24 py-1 text-xs disabled:opacity-50"
            />
          </label>
        </div>

        {/* Récapitulatif */}
        <div className="mt-3 grid grid-cols-2 gap-1 border-t border-[#8FB59B]/20 pt-3 text-xs">
          <span className="text-[#A7B7A8]">Sous-total HT</span><span className="text-right">{formatMad(sousTotal)}</span>
          {totalRemise > 0 && (<><span className="text-[#A7B7A8]">Remises</span><span className="text-right text-[#8FB59B]">− {formatMad(totalRemise)}</span></>)}
          <span className="text-[#A7B7A8]">TVA (par ligne)</span><span className="text-right">{formatMad(montantTVA)}</span>
          <span className="text-sm font-bold text-[#E8ECE8]">Total TTC</span>
          <span className="text-right text-lg font-extrabold text-[#DFE7E2]">{formatMad(totalTTC)}</span>
        </div>

        {/* Actions secondaires */}
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={imprimerTicket}
            disabled={!lignes.length}
            className="min-h-11 flex-1 rounded-lg border border-[#8FB59B]/40 px-3 text-sm text-[#DFE7E2] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Imprimer
          </button>
          <button
            type="button"
            onClick={() => void creerDevisDepuisTicket()}
            disabled={saving || !lignes.length}
            className="min-h-11 flex-1 rounded-lg border border-[#8FB59B]/40 px-3 text-sm text-[#DFE7E2] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Devis
          </button>
        </div>

        {/* Bouton PAIEMENT fixe en bas du panier */}
        <div className="mt-3">
          <button
            type="button"
            onClick={ouvrirPaiement}
            disabled={!lignes.length || saving}
            className="btn-or min-h-12 w-full text-sm font-bold disabled:cursor-not-allowed disabled:opacity-40"
          >
            PAIEMENT{lignes.length ? ` — ${formatMad(totalTTC)}` : ""}
          </button>
        </div>

        {message && <p role="status" className="mt-2 text-xs text-[#8DA298]">{message}</p>}
        {erreur && <p role="alert" className="mt-2 text-xs text-[#C5716B]">{erreur}</p>}
      </aside>

      {/* Barre de navigation fixe smartphone — 5 accès métiers toujours accessibles */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex border-t border-[#8FB59B]/20 bg-[#1D2424]/95 p-1 backdrop-blur-md xl:hidden safe-bas">
        {[
          { label: "Catalogue", icone: "📦", onClick: () => { setPanierMobile(false); setPosSection("catalogue"); } },
          { label: "Panier", icone: "🛒", onClick: () => setPanierMobile(true) },
          { label: "Clients", icone: "👤", onClick: () => { setModalClient(true); } },
          { label: "Paiement", icone: "💳", onClick: () => { setPanierMobile(false); ouvrirPaiement(); }, disabled: !lignes.length || saving },
          { label: "Menu", icone: "☰", onClick: () => { /* Menu complet disponible dans la barre latérale du shell (hamburger en haut à gauche) */ } },
        ].map((item, i) => (
          <button
            key={i}
            type="button"
            onClick={item.onClick}
            disabled={item.disabled}
            className={`flex-1 flex flex-col items-center justify-center gap-1 rounded-lg px-2 py-2 text-xs transition touch-manipulation ${
              item.disabled
                ? "opacity-40 text-[#8FB59B]/40"
                : "bg-[#344440] text-[#DFE7E2] hover:bg-[#41524E]"
            }`}
            aria-pressed={item.disabled ? undefined : false}
          >
            <span className="text-[16px]">{item.icone}</span>
            <span className={item.disabled ? "text-[#8FB59B]/40" : "font-bold"}>{item.label}</span>
          </button>
        ))}
      </nav>
      <div className="h-24 xl:hidden" aria-hidden="true" />

      {/* ------------------------------------------------------------
       * Panneau de paiement compact (sans quitter le POS)
       * ------------------------------------------------------------ */}
      {panneauPaiement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4" role="dialog" aria-modal="true" aria-label="Encaissement">
          {derniereVente ? (
            /* ---- Reçu après encaissement ---- */
            <div className="carte max-h-[90vh] w-full max-w-md overflow-y-auto p-5">
              <div className="flex items-center justify-between">
                <h2 className="titre-or text-lg font-extrabold">Vente enregistrée</h2>
                <button type="button" onClick={fermerRecu} className="text-2xl text-[#A7B7A8]" aria-label="Fermer le reçu">×</button>
              </div>
              <p className="mt-1 text-xs text-[#A7B7A8]">{derniereVente.reference} — {derniereVente.date}</p>
              {derniereVente.client && <p className="mt-1 text-xs text-[#E8ECE8]/80">Client : {derniereVente.client}</p>}
              {derniereVente.vehicule && <p className="text-xs text-[#E8ECE8]/80">Véhicule : {derniereVente.vehicule}</p>}
              <div className="mt-3 grid grid-cols-2 gap-1 text-xs">
                <span className="text-[#A7B7A8]">Total TTC</span>
                <span className="text-right font-extrabold text-[#DFE7E2]">{formatMad(derniereVente.total)}</span>
                <span className="text-[#A7B7A8]">Payé</span>
                <span className="text-right">{formatMad(derniereVente.paye)}</span>
                {derniereVente.reste > 0 && (
                  <><span className="text-[#A7B7A8]">Reste à payer</span><span className="text-right text-[#8FB59B]">{formatMad(derniereVente.reste)}</span></>
                )}
                {derniereVente.monnaie > 0 && (
                  <><span className="text-[#A7B7A8]">Monnaie rendue</span><span className="text-right text-[#7FBF9E]">{formatMad(derniereVente.monnaie)}</span></>
                )}
              </div>
              <div className="mt-3 flex max-h-40 flex-col gap-1 overflow-y-auto">
                {derniereVente.lignes.map((l, i) => (
                  <div key={`${l.nom}-${i}`} className="flex justify-between gap-2 text-xs">
                    <span className="truncate text-[#E8ECE8]/80">{l.quantite} × {l.nom}</span>
                    <span className="shrink-0 text-[#DFE7E2]">{formatMad(round2(l.prix * l.quantite))}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => void imprimerRecuEnrichi(derniereVente)}
                  disabled={impressionEnCours}
                  className="min-h-11 flex-1 rounded-lg border border-[#8FB59B]/40 px-3 text-sm text-[#DFE7E2] disabled:opacity-40"
                >
                  {impressionEnCours ? "Impression…" : "Imprimer le ticket"}
                </button>
                <button type="button" onClick={fermerRecu} className="btn-or min-h-11 flex-1 text-sm font-bold">
                  Nouvelle vente
                </button>
              </div>
            </div>
          ) : (
            /* ---- Formulaire d'encaissement ---- */
            <div className="carte max-h-[90vh] w-full max-w-lg overflow-y-auto p-5">
              <div className="flex items-center justify-between">
                <h2 className="titre-or text-lg font-extrabold">Encaissement</h2>
                <button type="button" onClick={fermerPaiement} className="text-2xl text-[#A7B7A8]" aria-label="Fermer l'encaissement">×</button>
              </div>

              {/* Récapitulatif */}
              <div className="mt-3 grid grid-cols-2 gap-1 text-xs">
                <span className="text-[#A7B7A8]">Sous-total HT</span><span className="text-right">{formatMad(sousTotal)}</span>
                {totalRemise > 0 && (<><span className="text-[#A7B7A8]">Remises</span><span className="text-right text-[#8FB59B]">− {formatMad(totalRemise)}</span></>)}
                <span className="text-[#A7B7A8]">TVA</span><span className="text-right">{formatMad(montantTVA)}</span>
                <span className="text-sm font-bold text-[#E8ECE8]">Total TTC</span>
                <span className="text-right text-lg font-extrabold text-[#DFE7E2]">{formatMad(totalTTC)}</span>
              </div>

              {/* Modes */}
              <p className="mt-4 text-[10px] uppercase tracking-[0.15em] text-[#A7B7A8]">Mode de paiement</p>
              <div className="mt-2 grid grid-cols-4 gap-1.5">
                {MODES.map((m) => (
                  <button
                    key={m.cle}
                    type="button"
                    onClick={() => choisirMode(m.cle)}
                    className={`min-h-11 touch-manipulation rounded-lg px-1 py-2 text-[11px] transition ${
                      modePaiement === m.cle ? "bg-[#8FB59B] font-bold text-[#252D2D]" : "bg-[#344440] text-[#8FB59B] hover:bg-[#41524E]"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              {/* Règlements (1 ou N modes → règlement mixte) */}
              {modePaiement !== "credit" && (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] uppercase tracking-[0.15em] text-[#A7B7A8]">
                      Règlements{reglements.length > 1 ? " · mixtes" : ""}
                    </p>
                    <button type="button" onClick={ajouterReglement} className="text-[11px] text-[#DFE7E2] underline">
                      + Autre mode
                    </button>
                  </div>
                  {reglements.map((r, i) => {
                    const montantVerrouille = modePaiement !== "partiel" && reglements.length === 1;
                    return (
                      <div key={`reg-${i}`} className="flex items-center gap-2">
                        <select
                          value={r.methode}
                          disabled={montantVerrouille}
                          onChange={(e) => majReglement(i, { methode: e.target.value as Reglement["methode"] })}
                          className="champ min-h-10 flex-1 py-1 text-sm disabled:opacity-60"
                          aria-label={`Mode de paiement ${i + 1}`}
                        >
                          <option value="especes">Espèces</option>
                          <option value="carte">Carte</option>
                          <option value="cheque">Chèque</option>
                          <option value="virement">Virement</option>
                          <option value="mobile">Mobile</option>
                        </select>
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          value={r.montant || ""}
                          disabled={montantVerrouille}
                          onChange={(e) => majReglement(i, { montant: Math.max(0, Number(e.target.value) || 0) })}
                          placeholder={montantVerrouille ? String(totalTTC) : "Montant"}
                          className="champ min-h-10 w-28 py-1 text-sm disabled:opacity-60"
                          aria-label={`Montant du règlement ${i + 1}`}
                        />
                        {reglements.length > 1 && (
                          <button
                            type="button"
                            onClick={() => supprimerReglement(i)}
                            className="min-h-10 min-w-10 touch-manipulation rounded bg-[#C5716B]/15 text-sm text-[#C5716B]"
                            aria-label="Retirer ce règlement"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Montants : reçu, monnaie, reste */}
              <div className="mt-3 space-y-1.5 rounded-lg bg-[#344440]/40 p-2.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-[#A7B7A8]">Montant réglé</span>
                  <span className="font-bold text-[#DFE7E2]">{formatMad(montantRegle)}</span>
                </div>
                {estEspeces && (
                  <label className="flex items-center justify-between gap-2">
                    <span className="text-[#A7B7A8]">Montant reçu (MAD)</span>
                    <span className="flex gap-1">
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        inputMode="decimal"
                        value={montantRecu}
                        onChange={(e) => setMontantRecu(e.target.value)}
                        placeholder={String(totalTTC)}
                        className="champ min-h-10 w-24 py-1 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => setPaveOuvert(!paveOuvert)}
                        aria-label={paveOuvert ? "Masquer le pavé numérique" : "Ouvrir le pavé numérique tactile"}
                        className={`min-h-10 min-w-10 touch-manipulation rounded-lg border border-[#8FB59B]/40 text-lg ${paveOuvert ? "bg-[#8FB59B]/25 text-[#DFE7E2]" : "bg-[#344440] text-[#8FB59B]"}`}
                      >
                        ⌨
                      </button>
                    </span>
                  </label>
                )}
                {estEspeces && paveOuvert && (
                  <PaveNumerique
                    valeur={montantRecu}
                    onChangement={setMontantRecu}
                    ariaLabel="Saisie tactile du montant reçu"
                  />
                )}
                {estEspeces && montantRecuNum > 0 && (
                  <div className="flex justify-between">
                    <span className="text-[#A7B7A8]">Monnaie à rendre</span>
                    <span className="font-bold text-[#7FBF9E]">{formatMad(monnaieRendue)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-[#A7B7A8]">Reste dû</span>
                  <span className="font-bold text-[#8FB59B]">{formatMad(resteDu)}</span>
                </div>
                {modePaiement === "credit" && (
                  <p className="leading-4 text-[#DFE7E2]">
                    Crédit client : aucun encaissement maintenant — encaissement ultérieur depuis l&apos;historique des ventes.
                  </p>
                )}
                {modePaiement === "partiel" && (
                  <p className="leading-4 text-[#A7B7A8]">Paiement partiel : le reste restera dû sur la vente.</p>
                )}
              </div>

              {erreur && <p role="alert" className="mt-3 rounded-lg bg-[#C5716B]/15 px-3 py-2 text-xs text-[#C5716B]">{erreur}</p>}

              {/* Actions */}
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={fermerPaiement}
                  className="min-h-11 flex-1 rounded-lg border border-[#8FB59B]/40 px-3 text-sm text-[#DFE7E2]"
                >
                  Retour au ticket
                </button>
                <button
                  type="button"
                  onClick={() => void encaisser()}
                  disabled={saving}
                  className="btn-or min-h-11 flex-[2] text-sm font-bold disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {saving
                    ? "Enregistrement…"
                    : modePaiement === "credit"
                      ? `Vente à crédit ${formatMad(totalTTC)}`
                      : modePaiement === "partiel"
                        ? `Encaisser ${formatMad(montantRegle)}`
                        : `Encaisser ${formatMad(totalTTC)}`}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------
       * Création rapide : client
       * ------------------------------------------------------------ */}
      {modalClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-5" role="dialog" aria-modal="true" aria-label="Nouveau client">
          <form
            onSubmit={(e) => { e.preventDefault(); void creerClientRapide(); }}
            className="carte w-full max-w-md p-6"
          >
            <h2 className="titre-or text-xl font-extrabold">Nouveau client</h2>
            <div className="mt-4 grid gap-3">
              <input
                required
                className="champ min-h-11"
                placeholder="Nom complet *"
                value={formClient.nom}
                onChange={(e) => setFormClient({ ...formClient, nom: e.target.value })}
              />
              <input
                className="champ min-h-11"
                placeholder="Téléphone"
                value={formClient.tel}
                onChange={(e) => setFormClient({ ...formClient, tel: e.target.value })}
              />
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" onClick={() => setModalClient(false)} className="rounded-lg px-4 py-2 text-sm text-[#A7B7A8]">
                Annuler
              </button>
              <button disabled={savingModal} type="submit" className="btn-or px-4 py-2 text-sm">
                {savingModal ? "Enregistrement…" : "Créer et sélectionner"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ------------------------------------------------------------
       * Création rapide : véhicule
       * ------------------------------------------------------------ */}
      {modalVehicule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-5" role="dialog" aria-modal="true" aria-label="Nouveau véhicule">
          <form
            onSubmit={(e) => { e.preventDefault(); void creerVehiculeRapide(); }}
            className="carte w-full max-w-md p-6"
          >
            <h2 className="titre-or text-xl font-extrabold">Nouveau véhicule</h2>
            <div className="mt-4 grid gap-3">
              <input
                required
                className="champ min-h-11"
                placeholder="Immatriculation *"
                value={formVehicule.plaque}
                onChange={(e) => setFormVehicule({ ...formVehicule, plaque: e.target.value })}
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  required
                  className="champ min-h-11"
                  placeholder="Marque *"
                  value={formVehicule.marque}
                  onChange={(e) => setFormVehicule({ ...formVehicule, marque: e.target.value })}
                />
                <input
                  required
                  className="champ min-h-11"
                  placeholder="Modèle *"
                  value={formVehicule.modele}
                  onChange={(e) => setFormVehicule({ ...formVehicule, modele: e.target.value })}
                />
              </div>
              <input
                type="number"
                min="1900"
                max="2100"
                className="champ min-h-11"
                placeholder="Année"
                value={formVehicule.annee}
                onChange={(e) => setFormVehicule({ ...formVehicule, annee: e.target.value })}
              />
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" onClick={() => setModalVehicule(false)} className="rounded-lg px-4 py-2 text-sm text-[#A7B7A8]">
                Annuler
              </button>
              <button disabled={savingModal} type="submit" className="btn-or px-4 py-2 text-sm">
                {savingModal ? "Enregistrement…" : "Créer et sélectionner"}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
