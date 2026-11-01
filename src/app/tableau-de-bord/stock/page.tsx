import { ShellApp } from "@/components/shell-app";
import { ModuleTable, type ModuleRow } from "@/components/module-table";

const products: ModuleRow[] = [
  { id: "p1", primary: "Filtre à huile Bosch", secondary: "FILT-045 · Pièce neuve", cells: ["42", "85 MAD", "Normal"], status: "Normal" },
  { id: "p2", primary: "Pneu Michelin 205/55R16", secondary: "PN-MIC-205 · Pneumatique", cells: ["4", "950 MAD", "Stock faible"], status: "Stock faible" },
  { id: "p3", primary: "Injecteur Bosch reconditionné", secondary: "INJ-CR-001 · Injection diesel", cells: ["2", "1 850 MAD", "Normal"], status: "Normal" },
  { id: "p4", primary: "Batterie 70Ah", secondary: "BAT-070 · Électricité", cells: ["0", "720 MAD", "Rupture"], status: "Rupture" },
];

export default function StockPage() {
  return <ShellApp actif="Stock" salutation="Stock & catalogue" sousTitre="Mouvements, lots et alertes"><div className="apparaitre"><div className="mb-6"><p className="text-xs uppercase tracking-[0.2em] text-[#a8bb87]">Inventaire</p><h1 className="titre-or mt-1 text-2xl font-extrabold">Produits et pièces</h1><p className="mt-1 text-sm text-[#a8bb87]">Neuf, occasion et reconditionné avec traçabilité par établissement.</p></div><ModuleTable rows={products} headers={["Quantité", "Prix vente", "Alerte"]} placeholder="Référence, code-barres, pièce…" actionLabel="Nouveau produit" /></div></ShellApp>;
}
