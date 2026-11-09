/**
 * AUTO DYALI — Finance (logique pure).
 * Ne jamais présenter `CA − dépenses` comme un bénéfice net.
 * Le résultat net n'est calculable que si le coût des marchandises
 * vendues (coût historique au moment de la vente) est disponible.
 */

export type LigneVenteFinance = {
  quantity: number;
  unitPrice: number; // HT unitaire (MAD)
  taxRate: number;
  discount: number; // montant ligne (MAD)
  /** Coût unitaire historique au moment de la vente (MAD), si connu. */
  coutUnitaire?: number | null;
};

export type ResumeFinance = {
  chiffreAffairesHT: number;
  tvaCollectee: number;
  coutMarchandises: number | null; // null si coût inconnu (ne pas inventer)
  margeBrute: number | null;
  depenses: number;
  resultatIntermediaire: number; // CA − dépenses (PAS un bénéfice net)
  resultatNet: number | null; // null sans coût des marchandises
};

/** Totaux financiers d'un ensemble de lignes de vente (montants en MAD). */
export function resumeFinance(lignes: LigneVenteFinance[], depenses: number): ResumeFinance {
  let ca = 0;
  let tva = 0;
  let cout = 0;
  let coutConnu = true;
  for (const l of lignes) {
    const brut = (l.quantity * l.unitPrice) - (l.discount ?? 0);
    ca += brut;
    tva += Math.round((brut * (l.taxRate ?? 0)) / 100 * 100) / 100;
    if (l.coutUnitaire == null) coutConnu = false;
    else cout += l.quantity * Number(l.coutUnitaire);
  }
  const coutMarchandises = coutConnu ? Math.round(cout * 100) / 100 : null;
  return {
    chiffreAffairesHT: Math.round(ca * 100) / 100,
    tvaCollectee: Math.round(tva * 100) / 100,
    coutMarchandises,
    margeBrute: coutMarchandises == null ? null : Math.round((ca - coutMarchandises) * 100) / 100,
    depenses: Math.round(depenses * 100) / 100,
    resultatIntermediaire: Math.round((ca - depenses) * 100) / 100,
    resultatNet: coutMarchandises == null ? null : Math.round((ca - coutMarchandises - depenses) * 100) / 100,
  };
}

/** Libellé honnête pour l'interface (jamais « bénéfice net » sans coût). */
export function libelleResultat(r: ResumeFinance): string {
  return r.resultatNet == null
    ? "Résultat intermédiaire — coût des marchandises manquant, pas un bénéfice net"
    : "Résultat net (coût historique connu)";
}
