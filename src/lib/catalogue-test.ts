// Types for the catalogue
export type ProduitTest = {
  sku: string;
  /** Code-barres EAN-13 renseigné en base (optionnel) — lu par le scanner. */
  barcode?: string | null;
  nom: string;
  marque: string;
  categorie:
    | "Filtre"
    | "Lubrifiant"
    | "Accessoire"
    | "Pièce"
    | "Merchandising"
    | "Pneumatique"
    | "Autre";
  prix: number;
  stock: number;
};

// ============================================
// CATALOGUE COMPLET AUTO DYALI — Toutes les marques avec modèles
// ============================================

// --- FILTRES --- (avec marques et modèles complets)
export const filtresTest: ProduitTest[] = [
  // Filtres à huile
  { sku: "FIL-MAH-OL01", nom: "Filtre à huile Mahle OL01", marque: "Mahle", categorie: "Filtre", prix: 72, stock: 30 },
  { sku: "FIL-MAN-W712", nom: "Filtre à huile W 712/95", marque: "MANN-FILTER", categorie: "Filtre", prix: 95, stock: 28 },
  { sku: "FIL-PUR-LS933", nom: "Filtre à huile LS933", marque: "Purflux", categorie: "Filtre", prix: 78, stock: 35 },
  { sku: "FIL-BOS-045", nom: "Filtre à huile P 3274", marque: "Bosch", categorie: "Filtre", prix: 85, stock: 42 },
  { sku: "FIL-HER-AK55", nom: "Filtre habitacle", marque: "Hering", categorie: "Filtre", prix: 65, stock: 50 },
  { sku: "FIL-BRE-FP01", nom: "Filtre carburant", marque: "Brembo", categorie: "Filtre", prix: 110, stock: 30 },
  { sku: "FIL-DON-24915", nom: "Filtre à huile Donaldson 24915", marque: "Donaldson", categorie: "Filtre", prix: 98, stock: 25 },
  { sku: "FIL-SK-FS107", nom: "Filtre à carburant Suzuki FS107", marque: "Suzuki", categorie: "Filtre", prix: 88, stock: 32 },
  { sku: "FIL-FRE-FP12", nom: "Filtre fioul professionnel", marque: "Flow", categorie: "Filtre", prix: 135, stock: 18 },
  // Filtres pneumatiques
  { sku: "FIL-PNE-TP", nom: "Kit filtre kit pneumatique complet", marque: "Auto", categorie: "Filtre", prix: 150, stock: 20 },
  { sku: "FIL-PNE-AR", nom: "Filtre air compressseur 12V", marque: "Power", categorie: "Filtre", prix: 180, stock: 15 },
];

// --- LUBRIFIANTS --- (avec toutes les grandes marques et viscosités)
export const lubrifiantsTest: ProduitTest[] = [
  // TotalEnergies
  { sku: "LUB-TOT-10W40", nom: "Quartz 7000 10W-40 — 5L", marque: "TotalEnergies", categorie: "Lubrifiant", prix: 285, stock: 18 },
  { sku: "LUB-TOT-5W30", nom: "Quartz 5000 5W-30 — 5L", marque: "TotalEnergies", categorie: "Lubrifiant", prix: 265, stock: 22 },
  { sku: "LUB-TOT-15W50", nom: "Quartz 9000 15W-50 — 5L", marque: "TotalEnergies", categorie: "Lubrifiant", prix: 310, stock: 15 },
  // Motul
  { sku: "LUB-MOT-5W40", nom: "8100 X-clean 5W-40 — 5L", marque: "Motul", categorie: "Lubrifiant", prix: 520, stock: 9 },
  { sku: "LUB-MOT-0W40", nom: "300V 0W-40 Racing — 5L", marque: "Motul", categorie: "Lubrifiant", prix: 620, stock: 7 },
  { sku: "LUB-MOT-10W60", nom: "8100 Eco-Nergy 10W-60 — 5L", marque: "Motul", categorie: "Lubrifiant", prix: 580, stock: 8 },
  // Castrol
  { sku: "LUB-CAS-15W40", nom: "GTX Diesel 15W-40 — 5L", marque: "Castrol", categorie: "Lubrifiant", prix: 310, stock: 14 },
  { sku: "LUB-CAS-HX8", nom: "Edge 5W-30 SN 5L", marque: "Castrol", categorie: "Lubrifiant", prix: 340, stock: 16 },
  { sku: "LUB-CAS-FS", nom: "Magnatec 5W-40 FS — 5L", marque: "Castrol", categorie: "Lubrifiant", prix: 325, stock: 20 },
  // Elf
  { sku: "LUB-ELF-5W30", nom: "Synergie 5W-30 — 5L", marque: "Elf", categorie: "Lubrifiant", prix: 340, stock: 16 },
  { sku: "LUB-ELF-7500", nom: "Essence 7500 5W-40 — 5L", marque: "Elf", categorie: "Lubrifiant", prix: 390, stock: 12 },
  { sku: "LUB-ELF-F1", nom: "F1 7100 5W-40 — 5L", marque: "Elf", categorie: "Lubrifiant", prix: 450, stock: 5 },
  // Huiles spéciale injection
  { sku: "LUB-POM-F40", nom: "Huile pompe injection 5L", marque: "Spécial", categorie: "Lubrifiant", prix: 680, stock: 3 },
  { sku: "LUB-POM-0W30", nom: "Huile injection 0W-30 — 5L", marque: "Injection", categorie: "Lubrifiant", prix: 720, stock: 2 },
  { sku: "LUB-POM-15W40", nom: "Huile injection 15W-40 — 5L", marque: "Injection", categorie: "Lubrifiant", prix: 650, stock: 4 },
];

// --- ACCESSOIRES --- (avec équipements pneus et entretien)
export const accessoiresTest: ProduitTest[] = [
  // Éclairage
  { sku: "ACC-BOS-LED-H7", nom: "Ampoule LED H7", marque: "Bosch", categorie: "Accessoire", prix: 240, stock: 16 },
  { sku: "ACC-OSR-TAPIS", nom: "Tapis caoutchouc universels", marque: "Oslon", categorie: "Accessoire", prix: 180, stock: 12 },
  { sku: "ACC-USB-12V", nom: "Chargeur USB double 12V", marque: "Baseus", categorie: "Accessoire", prix: 150, stock: 7 },
  // Pneus et roues
  { sku: "ACC-PNE-PRES", nom: "Gonfleur pneumatique 12V", marque: "Power", categorie: "Accessoire", prix: 220, stock: 10 },
  { sku: "ACC-PNE-PRES2", nom: "Gonfleur numérique 12V avec manomètre", marque: "Power", categorie: "Accessoire", prix: 280, stock: 8 },
  { sku: "ACC-Val-PRES", nom: "Valve de roue universelle", marque: "Sensorex", categorie: "Accessoire", prix: 45, stock: 50 },
  { sku: "ACC-CAP-PNE", nom: "Capuchons de roue en métal", marque: "CoverKing", categorie: "Accessoire", prix: 25, stock: 100 },
  // TPMS et diagnostics
  { sku: "ACC-PAI-TPMS", nom: "Capteurs TPMS universels", marque: "Sensorex", categorie: "Accessoire", prix: 320, stock: 5 },
  { sku: "ACC-TPMS-SET", nom: "Kit complet TPMS pour 4 roues", marque: "Sensorex", categorie: "Accessoire", prix: 950, stock: 3 },
  // Protection et entretien
  { sku: "ACC-CAR-PAR", nom: "Parure de protection voiture", marque: "CoverKing", categorie: "Accessoire", prix: 450, stock: 8 },
  { sku: "ACC-CAR-COV", nom: "Housse de protection extérieure", marque: "CoverKing", categorie: "Accessoire", prix: 380, stock: 6 },
  { sku: "ACC-KIT-CLE", nom: "Kit de réparation crevaison", marque: "Auto", categorie: "Accessoire", prix: 120, stock: 25 },
  // Outils
  { sku: "ACC-OUT-TP", nom: "Tourne-pneus professionnel", marque: "Bosch", categorie: "Accessoire", prix: 350, stock: 5 },
  { sku: "ACC-OUT-JA", nom: "Cric hydraulique 3 tonnes", marque: "Power", categorie: "Accessoire", prix: 420, stock: 4 },
];

// --- PIÈCES --- (moteur, transmission, suspension, injection)
export const piecesTest: ProduitTest[] = [
  // Distribution
  { sku: "PIE-SET-COURROIE", nom: "Jeu de courroie distribution", marque: "Kit auto", categorie: "Pièce", prix: 1200, stock: 3 },
  { sku: "PIE-SET-CLAPET", nom: "Jeu de clapets de soupapes", marque: "Moteur", categorie: "Pièce", prix: 850, stock: 2 },
  { sku: "PIE-SET-TRINGLE", nom: "Kit de tringles de distribution", marque: "Moteur", categorie: "Pièce", prix: 680, stock: 4 },
  { sku: "PIE-CAP-TIMING", nom: "Kit distribution complet", marque: "Groupe auto", categorie: "Pièce", prix: 2100, stock: 1 },
  // Injecteurs et pompes (crucial pour le multi-fonctionnel)
  { sku: "PIE-INJECT-01", nom: "Injecteur Common Rail Bosch", marque: "Bosch", categorie: "Pièce", prix: 850, stock: 2 },
  { sku: "PIE-INJECT-02", nom: "Injecteur Common Rail Delphi", marque: "Delphi", categorie: "Pièce", prix: 920, stock: 3 },
  { sku: "PIE-INJECT-03", nom: "Injecteur PDG Bosch", marque: "Bosch", categorie: "Pièce", prix: 780, stock: 5 },
  { sku: "PIE-POMPE-01", nom: "Pompe injection haute pression", marque: "Moteur", categorie: "Pièce", prix: 1500, stock: 1 },
  { sku: "PIE-POMPE-02", nom: "Pompe injection Bosch 4 cylindres", marque: "Bosch", categorie: "Pièce", prix: 1800, stock: 2 },
  { sku: "PIE-POMPE-03", nom: "Pompe injection Moteur 6 cylindres", marque: "Moteur", categorie: "Pièce", prix: 2100, stock: 1 },
  // Freinage
  { sku: "PIE-BRO-PAD", nom: "Jeu de plaquettes de frein avant", marque: "Bosch", categorie: "Pièce", prix: 480, stock: 6 },
  { sku: "PIE-SET-ROTOR", nom: "Jeu de disques de frein avant", marque: "Brembo", categorie: "Pièce", prix: 1200, stock: 4 },
  { sku: "PIE-CAL-FR", nom: "Étrier de frein complet", marque: "Brembo", categorie: "Pièce", prix: 2800, stock: 2 },
  // Transmission
  { sku: "PIE-BOX-AVR", nom: "Boîte de vitesse automatique", marque: "Groupe auto", categorie: "Pièce", prix: 8500, stock: 1 },
  { sku: "PIE-SET-KIT", nom: "Kit embrayage complet", marque: "Kit auto", categorie: "Pièce", prix: 1450, stock: 6 },
  { sku: "PIE-SET-ROULE", nom: "Jeu de rouleaux de distribution", marque: "Moteur", categorie: "Pièce", prix: 950, stock: 3 },
  // Direction et suspension
  { sku: "PIE-SET-BRI", nom: "Jeu de bielles de direction", marque: "Moteur", categorie: "Pièce", prix: 750, stock: 8 },
  { sku: "PIE-SET-AMOR", nom: "Kit amortisseurs avant", marque: "Groupe auto", categorie: "Pièce", prix: 1100, stock: 5 },
  // Pièces divers
  { sku: "PIE-SET-BAT", nom: "Jeu de bougies d'allumage", marque: "Bosch", categorie: "Pièce", prix: 320, stock: 12 },
  { sku: "PIE-SET-FILTRE", nom: "Jeu complet de filtres (huile/air/carburant)", marque: "Mann-Filter", categorie: "Pièce", prix: 420, stock: 15 },
];

// --- PNEUMATIQUES ---
export const pneumatiquesTest: ProduitTest[] = [
  { sku: "PNE-MIC-20555R16", nom: "Pneu Michelin 205/55 R16", marque: "Michelin", categorie: "Pneumatique", prix: 850, stock: 24 },
  { sku: "PNE-CON-19565R15", nom: "Pneu Continental 195/65 R15", marque: "Continental", categorie: "Pneumatique", prix: 720, stock: 18 },
];

// ============================================
// CATALOGUE GLOBAL (fusion des tableaux)
// ============================================

export const catalogueTest: ProduitTest[] = [
  ...filtresTest,
  ...lubrifiantsTest,
  ...accessoiresTest,
  ...piecesTest,
  ...pneumatiquesTest,
];

// Formatage MAD
export function formatMad(value: number) {
  return `${value.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} MAD`;
}

// Types pour le stock
export type Lot = { product_id: string; quantity: number };

// Types RPC et modules
export type ModePaiement = "especes" | "carte" | "cheque" | "virement" | "mobile" | "credit" | "acompte";
export type Reglement = { mode: ModePaiement; montant: number; reference?: string; dettags?: string };

// Types KPI
export type Kpi = {
  titre: string;
  valeur: string;
  variation: string;
  positif: boolean;
  icone: string;
  image: string;
};

export const kpiManager: Kpi[] = [
  { titre: "Chiffre d'affaires", valeur: "—", variation: "Chargement Supabase…", positif: true, icone: "ca", image: "/images/kpi/chiffre-affaires.svg" },
  { titre: "Bénéfice net", valeur: "—", variation: "Chargement Supabase…", positif: true, icone: "benefice", image: "/images/kpi/benefice-net.svg" },
  { titre: "Dépenses", valeur: "—", variation: "Chargement Supabase…", positif: false, icone: "depenses", image: "/images/kpi/depenses.svg" },
  { titre: "Interventions", valeur: "—", variation: "Chargement Supabase…", positif: true, icone: "cle", image: "/images/kpi/interventions.svg" },
];

/* Évolution du chiffre d'affaires (jan → déc, en kMAD) */
export const caMensuel = [
  { mois: "Jan", valeur: 12 },
  { mois: "Fév", valeur: 9 },
  { mois: "Mar", valeur: 15 },
  { mois: "Avr", valeur: 18 },
  { mois: "Mai", valeur: 22 },
  { mois: "Juin", valeur: 20 },
  { mois: "Juil", valeur: 25 },
  { mois: "Aout", valeur: 23 },
  { mois: "Sept", valeur: 19 },
  { mois: "Oct", valeur: 27 },
  { mois: "Nov", valeur: 21 },
  { mois: "Déc", valeur: 30 },
];

/* Part de CA par service */
export const caParService = [
  { service: "Entretien", pourcentage: 35 },
  { service: "Réparation", pourcentage: 25 },
  { service: "Diagnostic", pourcentage: 15 },
  { service: "Pneumatiques", pourcentage: 12 },
  { service: "Accessoires", pourcentage: 8 },
  { service: "Autres", pourcentage: 5 },
];