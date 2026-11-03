export type ProduitTest = {
  sku: string;
  nom: string;
  marque: string;
  categorie: "Filtre" | "Lubrifiant" | "Accessoire";
  prix: number;
  stock: number;
};

// Tarifs de démonstration en MAD, à confirmer avec les fournisseurs du garage.
export const catalogueTest: ProduitTest[] = [
  { sku: "FIL-BOS-045", nom: "Filtre à huile P 3274", marque: "Bosch", categorie: "Filtre", prix: 85, stock: 42 },
  { sku: "FIL-MAN-W712", nom: "Filtre à huile W 712/95", marque: "MANN-FILTER", categorie: "Filtre", prix: 95, stock: 28 },
  { sku: "FIL-PUR-LS933", nom: "Filtre à huile LS933", marque: "Purflux", categorie: "Filtre", prix: 78, stock: 35 },
  { sku: "LUB-TOT-10W40", nom: "Quartz 7000 10W-40 — 5L", marque: "TotalEnergies", categorie: "Lubrifiant", prix: 285, stock: 18 },
  { sku: "LUB-MOT-5W40", nom: "8100 X-clean 5W-40 — 5L", marque: "Motul", categorie: "Lubrifiant", prix: 520, stock: 9 },
  { sku: "LUB-CAS-15W40", nom: "GTX Diesel 15W-40 — 5L", marque: "Castrol", categorie: "Lubrifiant", prix: 310, stock: 14 },
  { sku: "ACC-OSR-TAPIS", nom: "Tapis caoutchouc universels", marque: "Oslon", categorie: "Accessoire", prix: 180, stock: 12 },
  { sku: "ACC-BOS-LED-H7", nom: "Ampoule LED H7", marque: "Bosch", categorie: "Accessoire", prix: 240, stock: 16 },
  { sku: "ACC-USB-12V", nom: "Chargeur USB double 12V", marque: "Baseus", categorie: "Accessoire", prix: 150, stock: 7 },
];

export function formatMad(value: number) {
  return `${value.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} MAD`;
}
