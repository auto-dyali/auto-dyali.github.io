/**
 * NEW POS CORE — Tax Engine.
 * TVA marocaine : exonérée (0%), 7%, 10%, 14%, 20 % — taux configurables
 * au-delà (chaque ligne porte son taux). Calcul par ligne sur la base HT
 * nette de remise, regroupement par taux pour l'affichage et la facture.
 * Pure : centimes entiers uniquement.
 */

export const TAUX_TVA_STANDARDS = [0, 7, 10, 14, 20] as const;

export function tauxValide(taux: number): boolean {
  return Number.isFinite(taux) && taux >= 0 && taux <= 100 && Math.round(taux * 100) === taux * 100;
}

/** TVA d'une ligne : base HT nette × taux. */
export function tvaLigneCent(baseNetteCent: number, taux: number): number {
  if (!tauxValide(taux)) throw new Error(`Taux TVA invalide : ${taux}`);
  return Math.round((baseNetteCent * taux) / 100);
}

/** Groupes de TVA du ticket : [{taux, base, tva}] triés par taux croissant. */
export function groupesTva(
  lignesNettes: { baseCent: number; tauxTva: number }[],
): { taux: number; baseCent: number; tvaCent: number }[] {
  const map = new Map<number, { baseCent: number; tvaCent: number }>();
  for (const l of lignesNettes) {
    if (!tauxValide(l.tauxTva)) throw new Error(`Taux TVA invalide : ${l.tauxTva}`);
    const g = map.get(l.tauxTva) ?? { baseCent: 0, tvaCent: 0 };
    g.baseCent += l.baseCent;
    g.tvaCent += tvaLigneCent(l.baseCent, l.tauxTva);
    map.set(l.tauxTva, g);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a - b)
    .map(([taux, g]) => ({ taux, baseCent: g.baseCent, tvaCent: g.tvaCent }));
}
