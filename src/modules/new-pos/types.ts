/**
 * NEW POS CORE — Types partagés du moteur commercial AUTO DYALI.
 * Une seule source de vérité pour le Mini-POS et le POS complet.
 *
 * Unité monétaire : CENTIMES (entiers). Aucun flottant dans les calculs.
 */

export type ModePaiement =
  | "especes"
  | "visa"
  | "mastercard"
  | "cheque"
  | "virement"
  | "mobile"
  | "credit"
  | "avoir";

/** Mode ENUM Supabase (contrainte DB) — l'UI reste en français, le service mappe. */
export type ModePaiementBdd = "cash" | "card" | "cheque" | "credit" | "transfer" | "mobile" | "avoir";

export type Produit = {
  id: string;
  nom: string;
  marque?: string | null;
  reference?: string | null;
  referenceOem?: string | null;
  codeBarres?: string | null;
  categorie: string;
  familles: string[];
  prixUnitaireCent: number; // vente HT
  tauxTva: number;
  stock: number;
  unite?: string;
  image?: string | null;
  source: "bdd" | "test";
};

export type Prestation = {
  id: string;
  nom: string;
  prixUnitaireCent: number;
  tauxTva: number;
  source: "bdd" | "test";
};

export type Client = {
  id: string;
  code?: string | null;
  nomComplet: string;
  telephone?: string | null;
  email?: string | null;
  genre?: "particulier" | "professionnel";
  soldeDuCent: number;
};

export type Vehicule = {
  id: string;
  clientId: string;
  plaque: string;
  marque: string;
  modele: string;
  annee?: number | null;
  motorisation?: string | null;
  version?: string | null;
  vin?: string | null;
  kilometrage?: number | null;
};

export type LignePanier = {
  id: string;
  productId: string | null;
  serviceId: string | null;
  libelle: string;
  quantite: number; // décimal 2 chiffres max
  prixUnitaireCent: number; // HT unitaire
  remisePourcent: number; // remise ligne en %
  remiseCent: number; // remise ligne fixe (centimes HT)
  tauxTva: number; // %
  unite?: string;
  /** true si la ligne provient d'un stock réel (décrit au panier). */
  stocke?: boolean;
};

export type RemiseGlobale = {
  pourcent: number;
  montantCent: number;
};

export type Reglement = {
  mode: ModePaiement;
  montantCent: number;
  /** Chèque : numéro, banque, date, échéance, statut. */
  cheque?: { numero: string; banque: string; date: string; echeance: string; statut: "en_attente" | "encaisse" };
  /** Carte : référence TPE. Confirmation réelle = badge TPE. */
  carte?: { referenceTpe: string; confirme: boolean };
  /** Virement : référence. Confirmé = c'est vu sur le compte. */
  virement?: { reference: string; confirme: boolean };
  /** Avoir : identifiant du crédit client consommé. */
  avoir?: { disponible: boolean };
};

export type Totalities = {
  brutCent: number; // somme quantité × PU (sans remises)
  remiseLignesCent: number; // remises propres aux lignes
  remiseGlobaleCent: number; // remise ticket répartie
  remiseTotalCent: number;
  baseHtNetCent: number; // base taxable nette de remises
  tauxTva: number[]; // taux présents
  tvaParTaux: { taux: number; baseCent: number; tvaCent: number }[];
  tvaTotalCent: number;
  ttcCent: number;
  payeCent: number;
  resteDuCent: number;
  monnaieRendueCent: number; // trop-perçu espèces
};

export type StatutVente = "opened" | "partial" | "paid" | "cancelled" | "refunded";

export type VenteEnregistree = {
  id: string;
  reference: string;
  status: string;
  totalCent: number;
  payeCent: number;
  clientNom?: string | null;
  createdAt?: string;
};
