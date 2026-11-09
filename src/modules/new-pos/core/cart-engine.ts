/**
 * NEW POS CORE — Cart Engine.
 * État du panier + opérateurs purs (immuables). Le panier est un simple
 * tableau de lignes + une remise globale : verifiable, sérialisable offline.
 */

import type { LignePanier, Produit, Prestation, RemiseGlobale, Vehicule, Client } from "../types";
import { REMISE_GLOBALE_VIDE } from "./pricing-engine.ts";

export type EtatPanier = {
  lignes: LignePanier[];
  remiseGlobale: RemiseGlobale;
  client: Client | null;
  vehicule: Vehicule | null;
};

/** Panier vide (client/véhicule null). */
export function panierVide(): EtatPanier {
  return { lignes: [], remiseGlobale: { ...REMISE_GLOBALE_VIDE }, client: null, vehicule: null };
}

export function idLigne(): string {
  return `l${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/** Ajoute un produit (fusible : deux lignes produit identiques fusionnent si remise identique). */
export function ajouterProduit(
  etat: EtatPanier,
  p: Produit,
  quantite = 1,
): EtatPanier {
  if (p.stock > 0 && quantite > p.stock) return etat; // refus silencieux contrôlé par l'UI
  const existante = etat.lignes.find(
    (l) => l.productId === p.id && l.tauxTva === p.tauxTva && l.prixUnitaireCent === p.prixUnitaireCent && l.remisePourcent === 0 && l.remiseCent === 0,
  );
  if (existante) {
    return {
      ...etat,
      lignes: etat.lignes.map((l) =>
        l.productId === p.id && l.tauxTva === p.tauxTva
          ? { ...l, quantite: arrondi2(l.quantite + quantite) }
          : l,
      ),
    };
  }
  const ligne: LignePanier = {
    id: idLigne(),
    productId: p.id,
    serviceId: null,
    libelle: p.nom,
    quantite: arrondi2(quantite),
    prixUnitaireCent: p.prixUnitaireCent,
    remisePourcent: 0,
    remiseCent: 0,
    tauxTva: p.tauxTva,
    unite: p.unite,
    stocke: true,
  };
  return { ...etat, lignes: [...etat.lignes, ligne] };
}

/** Ajoute une prestation du catalogue services. */
export function ajouterPrestation(etat: EtatPanier, p: Prestation, quantite = 1): EtatPanier {
  const ligne: LignePanier = {
    id: idLigne(),
    productId: null,
    serviceId: p.id,
    libelle: p.nom,
    quantite: arrondi2(quantite),
    prixUnitaireCent: p.prixUnitaireCent,
    remisePourcent: 0,
    remiseCent: 0,
    tauxTva: p.tauxTva,
    stocke: false,
  };
  return { ...etat, lignes: [...etat.lignes, ligne] };
}

/** Ajoute une prestation libre (saisie manuelle nom + prix HT HT). */
export function ajouterPrestationLibre(etat: EtatPanier, libelle: string, prixUnitaireCent: number, tauxTva = 0): EtatPanier {
  const nom = libelle.trim();
  if (!nom || prixUnitaireCent <= 0) return etat;
  const ligne: LignePanier = {
    id: idLigne(),
    productId: null,
    serviceId: null,
    libelle: nom,
    quantite: 1,
    prixUnitaireCent,
    remisePourcent: 0,
    remiseCent: 0,
    tauxTva,
    stocke: false,
  };
  return { ...etat, lignes: [...etat.lignes, ligne] };
}

function arrondi2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function majQuantite(etat: EtatPanier, idLigne: string, quantite: number): EtatPanier {
  const q = arrondi2(Math.max(0, quantite));
  return { ...etat, lignes: etat.lignes.flatMap((l) => (l.id === idLigne ? (q > 0 ? [{ ...l, quantite: q }] : []) : [l])) };
}

export function incrementerQuantite(etat: EtatPanier, id: string, delta = 1): EtatPanier {
  const l = etat.lignes.find((x) => x.id === id);
  if (!l) return etat;
  return majQuantite(etat, id, l.quantite + delta);
}

export function majRemiseLigne(etat: EtatPanier, id: string, opts: { pourcent?: number; montantCent?: number }): EtatPanier {
  return {
    ...etat,
    lignes: etat.lignes.map((l) =>
      l.id === id
        ? {
            ...l,
            remisePourcent: Math.max(0, Math.min(100, opts.pourcent ?? l.remisePourcent)),
            remiseCent: Math.max(0, opts.montantCent ?? l.remiseCent),
          }
        : l,
    ),
  };
}

export function majLigneTva(etat: EtatPanier, id: string, tauxTva: number): EtatPanier {
  return { ...etat, lignes: etat.lignes.map((l) => (l.id === id ? { ...l, tauxTva } : l)) };
}

export function majPrixUnitaire(etat: EtatPanier, id: string, prixUnitaireCent: number): EtatPanier {
  return {
    ...etat,
    lignes: etat.lignes.map((l) => (l.id === id ? { ...l, prixUnitaireCent: Math.max(0, Math.round(prixUnitaireCent)) } : l)),
  };
}

export function majLibelle(etat: EtatPanier, id: string, libelle: string): EtatPanier {
  return { ...etat, lignes: etat.lignes.map((l) => (l.id === id ? { ...l, libelle } : l)) };
}

export function supprimerLigne(etat: EtatPanier, id: string): EtatPanier {
  return { ...etat, lignes: etat.lignes.filter((l) => l.id !== id) };
}

export function viderPanier(): EtatPanier {
  return panierVide();
}

export function majRemiseGlobale(etat: EtatPanier, remise: RemiseGlobale): EtatPanier {
  return { ...etat, remiseGlobale: { pourcent: Math.max(0, Math.min(100, remise.pourcent)), montantCent: Math.max(0, remise.montantCent) } };
}

export function majClient(etat: EtatPanier, client: Client | null): EtatPanier {
  if (!client) return { ...etat, client: null, vehicule: null };
  // Un changement de client reset le véhicule (véhicule rattaché à un client).
  const vehiculeCoherent = etat.vehicule && etat.vehicule.clientId === client.id ? etat.vehicule : null;
  return { ...etat, client, vehicule: vehiculeCoherent };
}

export function majVehicule(etat: EtatPanier, vehicule: Vehicule | null): EtatPanier {
  return { ...etat, vehicule };
}
