/**
 * NEW POS CORE — Payment Engine.
 * Règlements mixtes (N modes dans la même vente), statuts de vente,
 * monnaie à rendre, règles de confirmation réelle :
 *   - un chèque NON encaissé n'est pas une espèce disponible ;
 *   - un virement NON confirmé n'est pas un encaissement définitif ;
 *   - jamais marquer une vente "paid" tant qu'un solde reste dû ;
 *   - jamais considérer un paiement en attente comme confirmé.
 * Pure : centimes entiers.
 */

import type { ModePaiement, ModePaiementBdd, Reglement, StatutVente, Totalities } from "../types";

export const MOYENS_PRINCIPAUX: ModePaiement[] = ["especes", "visa", "mastercard", "cheque"];
export const MOYENS_SECONDAIRES: ModePaiement[] = ["virement", "mobile", "credit", "avoir"];

/** Étiquettes FR (interface). */
export const MODE_LABEL: Record<ModePaiement, string> = {
  especes: "Espèces",
  visa: "Visa",
  mastercard: "Mastercard",
  cheque: "Chèque",
  virement: "Virement",
  mobile: "Paiement mobile",
  credit: "Crédit client",
  avoir: "Avoir client",
};

/** Mapping vers l'ENUM Supabase payment_method. */
export const MODE_BDD: Record<ModePaiement, ModePaiementBdd> = {
  especes: "cash",
  visa: "card",
  mastercard: "card",
  cheque: "cheque",
  virement: "transfer",
  mobile: "mobile",
  credit: "credit",
  avoir: "avoir",
};

const MODES_NON_ESPECES = new Set<ModePaiement>(["cheque", "virement", "credit", "avoir", "mobile"]);

/** Un règlement est-il un encaissement immédiat et certain ? */
export function estEncaissementCertain(r: Reglement): boolean {
  if (r.mode === "especes" || r.mode === "visa" || r.mode === "mastercard") return true;
  if (r.mode === "cheque") return r.cheque?.statut === "encaisse";
  if (r.mode === "virement") return r.virement?.confirme === true;
  if (r.mode === "avoir") return r.avoir?.disponible === true;
  return false; // mobile, credit : jamais certain sans confirmation
}

/** Somme des règlements réellement encaissés (montant certain). */
export function totalEncaisseCertainCent(reglements: Reglement[]): number {
  return reglements
    .filter(estEncaissementCertain)
    .reduce((s, r) => s + r.montantCent, 0);
}

/** Espèces versées (pour la monnaie à rendre : uniquement le mode espèces). */
function especesVerseCent(reglements: Reglement[]): number {
  return reglements.filter((r) => r.mode === "especes").reduce((s, r) => s + r.montantCent, 0);
}

/**
 * Monnaie à rendre : l'excédent d'espèces par rapport à ce qui DOIT être
 * couvert (TTC − encaissements non-espèces certains). Un trop-perçu en
 * carte/chèque ne REND RIEN — alerte à l'écran.
 */
export function monnaieARendreCent(ttCCent: number, reglements: Reglement[]): number {
  const nonEspeces = reglements
    .filter((r) => r.mode !== "especes" && estEncaissementCertain(r))
    .reduce((s, r) => s + r.montantCent, 0);
  const resteACouvrir = Math.max(0, ttCCent - nonEspeces);
  return Math.max(0, especesVerseCent(reglements) - resteACouvrir);
}

/** Statut de vente dérivé : jamais "paid" tant qu'un solde reste dû. */
export function statutDeVente(t: Totalities, reglements: Reglement[]): StatutVente {
  if (t.resteDuCent <= 0) return "paid";
  const certain = totalEncaisseCertainCent(reglements);
  if (certain <= 0) return "opened"; // crédit pur / rien d'encaissé
  return "partial";
}

/**
 * Contrôle d'intégrité avant validation. Renvoie la liste des erreurs
 * bloquantes (vide = OK). Règles serveur dupliquées côté client par prudence,
 * le serveur reste juge final.
 */
export function validerReglements(
  t: Totalities,
  reglements: Reglement[],
  opts: { clientPresente: boolean; autoriseCredit: boolean; soldeAvoirCent: number },
): string[] {
  const erreurs: string[] = [];
  if (reglements.length === 0 && t.resteDuCent > 0) {
    // Crédit pur : autorisé si client + permission.
    if (!opts.clientPresente) erreurs.push("Un client est obligatoire pour une vente à crédit.");
    if (!opts.autoriseCredit) erreurs.push("Permission refusée : vente à crédit non autorisée.");
    return erreurs;
  }
  for (const r of reglements) {
    if (r.montantCent <= 0) erreurs.push(`${MODE_LABEL[r.mode]} : montant invalide.`);
    if (r.mode === "cheque" && (!r.cheque?.numero || !r.cheque?.banque)) erreurs.push("Chèque : numéro et banque obligatoires.");
    if (r.mode === "virement" && !r.virement?.reference) erreurs.push("Virement : référence obligatoire.");
    if (r.mode === "credit" && !opts.autoriseCredit) erreurs.push("Permission refusée : vente à crédit non autorisée.");
    if (r.mode === "credit" && !opts.clientPresente) erreurs.push("Un client est obligatoire pour un crédit.");
    if (r.mode === "avoir") {
      if (!opts.clientPresente) erreurs.push("Un client est obligatoire pour utiliser un avoir.");
      if (r.montantCent > opts.soldeAvoirCent) erreurs.push("Avoir : solde disponible insuffisant.");
    }
  }
  const encaisse = totalEncaisseCertainCent(reglements) + reglements.filter((r) => !estEncaissementCertain(r)).reduce((s, r) => s + r.montantCent, 0);
  const especesSeules = especesVerseCent(reglements);
  const nonEspeces = encaisse - especesSeules;
  if (especesSeules > Math.max(0, t.ttcCent - nonEspeces)) {
    // trop-perçu espèces : c'est la monnaie, pas une erreur — contrôlé plus bas.
  }
  if (nonEspeces > t.ttcCent) {
    erreurs.push("Le règlement dépasse le total à payer (hors monnaie d'espèces).");
  }
  return erreurs;
}

/** Payload normalisé vers la BDD (nom de colonne, montant décimal). */
export function reglementsVersBdd(reglements: Reglement[]): { method: ModePaiementBdd; amount: number }[] {
  return reglements
    .filter((r) => r.montantCent > 0)
    .map((r) => ({ method: MODE_BDD[r.mode], amount: r.montantCent / 100 }));
}
