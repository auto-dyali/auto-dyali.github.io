/**
 * NEW POS CORE — Pricing Engine.
 * Point unique de calcul du ticket : brut → remises ligne → remise globale
 * répartie → bases HT nettes → TVA par taux → TTC.
 * Le Mini-POS ET le POS complet utilisent exactement ce moteur :
 * aucune duplication de calcul n'est permise ailleurs.
 */

import type { LignePanier, RemiseGlobale, Totalities } from "../types";
import { baseLigneNetteCent, remiseLigneCent, remiseGlobaleEffectiveCent, repartitionRemiseGlobale } from "./discount-engine.ts";
import { depuisCentimes } from "./money.ts";
import { groupesTva, tvaLigneCent } from "./tax-engine.ts";

export const REMISE_GLOBALE_VIDE: RemiseGlobale = { pourcent: 0, montantCent: 0 };

/** Calcul complet et déterministe d'un ticket. */
export function calculerTicket(
  lignes: LignePanier[],
  remiseGlobale: RemiseGlobale = REMISE_GLOBALE_VIDE,
  payeCent = 0,
): Totalities {
  const brutCent = lignes.reduce(
    (s, l) => s + Math.round(l.quantite * l.prixUnitaireCent),
    0,
  );
  const remiseLignesCent = lignes.reduce((s, l) => s + remiseLigneCent(l), 0);
  const remiseGlobaleCent = remiseGlobaleEffectiveCent(lignes, remiseGlobale);

  const parts = repartitionRemiseGlobale(lignes, remiseGlobale);
  const lignesNettes = lignes.map((l, i) => {
    const base = baseLigneNetteCent(l);
    // La part de remise globale est bornée à la base nette de la ligne.
    return { baseCent: Math.max(0, base - Math.min(base, Math.max(0, parts[i] ?? 0))), tauxTva: l.tauxTva };
  });

  const baseHtNetCent = lignesNettes.reduce((s, l) => s + l.baseCent, 0);
  const tvaParTaux = groupesTva(lignesNettes);
  const tvaTotalCent = tvaParTaux.reduce((s, g) => s + g.tvaCent, 0);
  const ttcCent = baseHtNetCent + tvaTotalCent;

  const paye = Math.max(0, Math.round(payeCent));
  const resteDuCent = Math.max(0, ttcCent - paye);
  const monnaieRendueCent = Math.max(0, paye - ttcCent);

  return {
    brutCent,
    remiseLignesCent,
    remiseGlobaleCent,
    remiseTotalCent: remiseLignesCent + remiseGlobaleCent,
    baseHtNetCent,
    tauxTva: tvaParTaux.map((g) => g.taux),
    tvaParTaux,
    tvaTotalCent,
    ttcCent,
    payeCent: paye,
    resteDuCent,
    monnaieRendueCent,
  };
}

/** Vérification "ne jamais faire confiance au frontend" : recalcule et compare. */
export function verifierCohere(lignes: LignePanier[], remise: RemiseGlobale, annonce: { subtotal: number; discount: number; tax: number; total: number }): boolean {
  const t = calculerTicket(lignes, remise);
  return (
    Math.abs(t.baseHtNetCent - Math.round(annonce.subtotal * 100)) <= 1 &&
    Math.abs(t.remiseTotalCent - Math.round(annonce.discount * 100)) <= 1 &&
    Math.abs(t.tvaTotalCent - Math.round(annonce.tax * 100)) <= 1 &&
    Math.abs(t.ttcCent - Math.round(annonce.total * 100)) <= 1
  );
}
