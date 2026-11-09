/**
 * NEW POS CORE — Sales Engine.
 * Assemble la commande transactionnelle de vente (identique pour Mini-POS
 * et POS complet), génère la référence idempotente unique et gère la
 * file d'attente offline (localStorage) : une vente hors ligne n'est
 * JAMAIS perdue, JAMAIS annoncée synchronisée avant confirmation serveur.
 */

import type { EtatPanier } from "./cart-engine.ts";
import type { LignePanier, Reglement } from "../types";
import { calculerTicket } from "./pricing-engine.ts";
import { statutDeVente } from "./payment-engine.ts";
import { arrondiCent } from "./money.ts";

export type ItemsPayload = {
  product_id: string | null;
  service_id: string | null;
  label: string;
  quantity: number;
  unit_price: number; // HT unitaire (MAD)
  tax_rate: number;
  discount: number; // montant ligne, MAD
};

export type SalePayload = {
  reference: string;
  client_id: string | null;
  vehicle_id: string | null;
  work_order_id: string | null;
  subtotal: number;
  discount: number;
  tax_total: number;
  total: number;
  paid_total: number;
  status: string;
  items: ItemsPayload[];
  payments: { method: string; amount: number }[];
};

export function nouvelleReference(suffixe = ""): string {
  const t = new Date();
  const hh = String(t.getHours()).padStart(2, "0");
  const mm = String(t.getMinutes()).padStart(2, "0");
  const ss = String(t.getSeconds()).padStart(2, "0");
  const rand = Math.random().toString(36).slice(2, 6);
  return `VNT-${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}${String(t.getDate()).padStart(2, "0")}-${hh}${mm}${ss}-${rand}${suffixe}`;
}

/** Ligne → payload item BDD (unit_price HT, discount montant ligne pur). */
export function ligneVersItem(l: LignePanier): ItemsPayload {
  const brut = Math.round(l.quantite * l.prixUnitaireCent);
  const pct = Math.round((brut * Math.max(0, Math.min(100, l.remisePourcent))) / 100);
  const remise = Math.min(brut, pct + Math.max(0, Math.round(l.remiseCent)));
  return {
    product_id: l.productId,
    service_id: l.serviceId,
    label: l.libelle,
    quantity: l.quantite,
    unit_price: l.prixUnitaireCent / 100,
    tax_rate: l.tauxTva,
    discount: remise / 100,
  };
}

/**
 * Construit le payload transactionnel complet du ticket courant.
 * Les totaux sont RECALCULÉS ici depuis les lignes (jamais depuis l'UI),
 * la même recomputation existe côté serveur (migration 0025).
 */
export function construirePayloadVente(
  etat: EtatPanier,
  reglements: Reglement[],
  opts: { payeCent: number; soldeAvoirCent: number },
): { payload: SalePayload; reference: string } | { erreur: string } {
  if (etat.lignes.length === 0) return { erreur: "Le panier est vide." };
  const t = calculerTicket(etat.lignes, etat.remiseGlobale, opts.payeCent);
  const statut = statutDeVente(t, reglements);
  if (statut === "opened" && !etat.client) return { erreur: "Un client est obligatoire pour une vente à crédit." };
  const items = etat.lignes.map(ligneVersItem);
  const payments = reglements
    .filter((r) => r.montantCent > 0)
    .map((r) => ({ method: mapModeBdd(r), amount: r.montantCent / 100 }));
  // payeCent côté moteur = montant dépassé = TTC — centré par le règlement réel.
  const paidTotal = Math.min(t.payeCent, t.ttcCent);
  return {
    payload: {
      reference: nouvelleReference(),
      client_id: etat.client?.id ?? null,
      vehicle_id: etat.vehicule?.id ?? null,
      work_order_id: null,
      subtotal: t.baseHtNetCent / 100,
      discount: t.remiseTotalCent / 100,
      tax_total: t.tvaTotalCent / 100,
      total: t.ttcCent / 100,
      paid_total: paidTotal / 100,
      status: statut,
      items,
      payments,
    },
    reference: nouvelleReference(),
  };
}

function mapModeBdd(r: Reglement): string {
  switch (r.mode) {
    case "especes": return "cash";
    case "visa":
    case "mastercard": return "card";
    case "virement": return "transfer";
    case "mobile": return "mobile";
    case "credit": return "credit";
    case "avoir": return "avoir";
    case "cheque": return "cheque";
  }
}

// File offline indépendante du contexte : Node (tests) ou navigateur (POS).
export type ChargeOffline = { reference: string; payload: SalePayload; cree_le: string };

const CLE = "auto-dyali-pos-file-ventes";

/** Mémoire de repli (Node/tests) si localStorage est absent. */
const memoire = new Map<string, string>();
function lireStockage(): { getItem(k: string): string | null; setItem(k: string, v: string): void } {
  try {
    if (typeof localStorage !== "undefined") return localStorage;
  } catch {
    // contexte restreint
  }
  return {
    getItem: (k) => memoire.get(k) ?? null,
    setItem: (k, v) => { memoire.set(k, v); },
  };
}

export function fileCharge(): ChargeOffline[] {
  try {
    return JSON.parse(lireStockage().getItem(CLE) ?? "[]") as ChargeOffline[];
  } catch {
    return [];
  }
}

function ecrire(file: ChargeOffline[]): void {
  lireStockage().setItem(CLE, JSON.stringify(file));
}

/** Empile un ticket non synchronisé. Guard : jamais de référence en double. */
export function empilerOffline(payload: SalePayload, reference: string): void {
  const file = fileCharge();
  if (file.some((c) => c.reference === reference)) return;
  file.push({ reference, payload, cree_le: new Date().toISOString() });
  ecrire(file);
}

export function retirerOffline(reference: string): void {
  ecrire(fileCharge().filter((c) => c.reference !== reference));
}

export function tailleFile(): number {
  return fileCharge().length;
}

/** Vérifie les invariants d'une payload avant envoi réseau (defense in depth). */
export function payloadValide(p: SalePayload): string[] {
  const e: string[] = [];
  if (!p.items.every((i) => i.quantity > 0 && i.unit_price >= 0)) e.push("quantity / unit_price invalides");
  if (p.total < 0 || p.paid_total < 0) e.push("totaux négatifs");
  if (p.payments.length === 0 && p.status !== "opened") e.push("ventes non-credit sans règlement");
  const sumPaye = p.payments.reduce((s, r) => s + r.amount, 0);
  // La monnaie rendue (trop-perçu espèces) est légitime : l'encaissé peut
  // dépasser le paid_total, jamais l'inverse.
  if (sumPaye + 0.001 < p.paid_total) e.push("somme règlements < paid_total");
  if (p.payments.some((r) => r.amount <= 0)) e.push("règlement ≤ 0");
  return e;
}
