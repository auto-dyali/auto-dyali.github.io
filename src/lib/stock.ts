/**
 * AUTO DYALI — Stock / Achats (logique pure).
 * Contrôles de réception : une quantité reçue ne peut jamais être négative
 * ni supérieure à la quantité commandée. Une commande n'est « entièrement
 * reçue » que si chaque ligne est entièrement reçue.
 */

export function validerReceptionItem(commande: number, recue: number): string[] {
  const erreurs: string[] = [];
  if (!Number.isFinite(commande) || commande < 0) erreurs.push("Quantité commandée invalide.");
  if (!Number.isFinite(recue) || recue < 0) erreurs.push("Quantité reçue invalide (négative).");
  if (recue > commande) erreurs.push("Quantité reçue supérieure à la quantité commandée.");
  return erreurs;
}

/** Statut dérivé après réception d'une ligne. */
export function statutLigneReception(commande: number, recue: number): "non_recue" | "partielle" | "recue" {
  if (recue <= 0) return "non_recue";
  if (recue >= commande) return "recue";
  return "partielle";
}

/** Une commande est entièrement reçue seulement si chaque ligne l'est. */
export function commandeEntièrementRecue(lignes: { quantity: number; received_quantity: number }[]): boolean {
  return lignes.length > 0 && lignes.every((l) => Number(l.received_quantity) >= Number(l.quantity) && Number(l.quantity) > 0);
}
