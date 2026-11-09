/**
 * NEW POS CORE — Monnaie entière.
 * Tout montant est un nombre entier de centimes de MAD.
 * Interdits absolus : floats dans les calculs, ± cumulés d'erreurs d'arrondi.
 */

/** Convertit un prix "affiché" (ex. 129.9, 129,90, "129.90") en centimes entiers. */
export function versCentimes(valeur: number | string): number {
  if (typeof valeur === "number") {
    if (!Number.isFinite(valeur)) return 0;
    return Math.round(valeur * 100);
  }
  const netto = String(valeur).trim().replace(/\s/g, "").replace(",", ".");
  const n = Number.parseFloat(netto);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

/** Centimes → montant décimal en MAD (API REST Supabase, affichage). */
export function depuisCentimes(cent?: number | null): number {
  return Math.round(cent ?? 0) / 100;
}

/** Affichage professionnel en MAD. */
export function afMAD(cent?: number | null): string {
  const v = Math.round(cent ?? 0) / 100;
  return `${v.toFixed(2).replace(".", ",")} MAD`;
}

/** Arrondi fiscal : au centime le plus proche, à partir d'un calcul exact. */
export function arrondiCent(quotient: number): number {
  return Math.round(quotient);
}

/** Part proportionnelle sécurisée : la dernière part reçoit le reste. */
export function repartir(totalACentrer: number, poids: number[]): number[] {
  const n = poids.length;
  if (n === 0) return [];
  const sum = poids.reduce((a, b) => a + b, 0);
  if (sum <= 0) {
    const part = Math.round(totalACentrer / n);
    const parts = new Array(n).fill(part);
    parts[n - 1] = totalACentrer - part * (n - 1);
    return parts;
  }
  const parts: number[] = [];
  let cumule = 0;
  for (let i = 0; i < n - 1; i++) {
    const p = Math.round((totalACentrer * poids[i]) / sum);
    parts.push(p);
    cumule += p;
  }
  parts.push(totalACentrer - cumule);
  return parts;
}
