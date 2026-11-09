/**
 * NEW POS CORE — Discount Engine.
 * Remises par ligne (% ou montant fixe HT) + remise globale du ticket
 * répartie proportionnellement sur les lignes (sans perte de centime).
 * Pure : aucune dépendance UI, base de données ou React.
 */

import type { LignePanier, RemiseGlobale } from "../types";
import { repartir } from "./money.ts";

/** Montant exact de la remise d'une ligne (base brute ligne), centimes HT. */
export function remiseLigneCent(ligne: LignePanier): number {
  const brut = Math.round(ligne.quantite * ligne.prixUnitaireCent);
  const pct = Math.round((brut * Math.max(0, Math.min(100, ligne.remisePourcent))) / 100);
  const fixe = Math.max(0, Math.min(brut - pct, Math.max(0, Math.round(ligne.remiseCent))));
  return Math.min(brut, pct + fixe);
}

/** Base HT nette d'une ligne, après remise ligne (avant remise globale). */
export function baseLigneNetteCent(ligne: LignePanier): number {
  return Math.round(ligne.quantite * ligne.prixUnitaireCent) - remiseLigneCent(ligne);
}

/** Clamorise la remise globale pour ne jamais dépasser le total HT brut. */
export function remiseGlobaleEffectiveCent(
  lignes: LignePanier[],
  remise: RemiseGlobale,
): number {
  const brut = lignes.reduce((s, l) => s + Math.round(l.quantite * l.prixUnitaireCent), 0);
  const remLignes = lignes.reduce((s, l) => s + remiseLigneCent(l), 0);
  const dispo = Math.max(0, brut - remLignes);
  const pct = Math.round((brut * Math.max(0, Math.min(100, remise.pourcent))) / 100);
  return Math.min(dispo, pct + Math.max(0, Math.round(remise.montantCent)));
}

/**
 * Répartition de la remise globale par ligne (proportionnel à la base nette
 * ligne). La dernière ligne absorbe le reste d'arrondi : somme = total exact.
 */
export function repartitionRemiseGlobale(lignes: LignePanier[], remise: RemiseGlobale): number[] {
  const total = remiseGlobaleEffectiveCent(lignes, remise);
  if (total === 0 || lignes.length === 0) return lignes.map(() => 0);
  const basesNettes = lignes.map((l) => baseLigneNetteCent(l));
  const parts = repartir(total, basesNettes);
  // Garde-fou : jamais une part > base nette de la ligne.
  const plafonnees: number[] = [];
  let trop = 0;
  for (let i = 0; i < parts.length; i++) {
    const admis = Math.min(Math.max(0, parts[i]), Math.max(0, basesNettes[i]));
    plafonnees.push(admis);
    trop += parts[i] - admis;
  }
  if (trop > 0) {
    for (let i = 0; i < plafonnees.length && trop > 0; i++) {
      const marge = basesNettes[i] - plafonnees[i];
      const ajout = Math.min(marge, trop);
      plafonnees[i] += ajout;
      trop -= ajout;
    }
  }
  return plafonnees;
}
