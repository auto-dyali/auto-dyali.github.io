import { ShellApp } from "@/components/shell-app";
import { ModuleTable, type ModuleRow } from "@/components/module-table";
import { catalogueTest, formatMad } from "@/lib/catalogue-test";

const products: ModuleRow[] = catalogueTest.map((product) => ({
  id: product.sku,
  primary: product.nom,
  secondary: `${product.sku} · ${product.marque} · ${product.categorie}`,
  cells: [String(product.stock), formatMad(product.prix), product.stock < 10 ? "Stock faible" : "Normal"],
  status: product.stock < 10 ? "Stock faible" : "Normal",
}));

export default function StockPage() {
  return <ShellApp actif="Stock" salutation="Stock & catalogue" sousTitre="Mouvements, lots et alertes"><div className="apparaitre"><div className="mb-6"><p className="text-xs uppercase tracking-[0.2em] text-[#a8bb87]">Inventaire de démonstration</p><h1 className="titre-or mt-1 text-2xl font-extrabold">Filtres et lubrifiants</h1><p className="mt-1 text-sm text-[#a8bb87]">Prix indicatifs en dirhams marocains, à remplacer par les tarifs fournisseurs.</p></div><ModuleTable rows={products} headers={["Quantité", "Prix vente", "Alerte"]} placeholder="Référence, marque, produit…" actionLabel="Nouveau produit" /></div></ShellApp>;
}
