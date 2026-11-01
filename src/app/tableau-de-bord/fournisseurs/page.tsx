import { ShellApp } from "@/components/shell-app";
import { ModuleTable, type ModuleRow } from "@/components/module-table";

const suppliers: ModuleRow[] = [
  { id: "s1", primary: "Auto Parts Maroc", secondary: "FOU-001 · +212 522 10 20 30", cells: ["Pièces mécaniques", "18 400 MAD", "Actif"], status: "Actif" },
  { id: "s2", primary: "Pneus Distribution", secondary: "FOU-002 · +212 522 22 33 44", cells: ["Pneumatiques", "7 250 MAD", "Actif"], status: "Actif" },
  { id: "s3", primary: "Diesel Service", secondary: "FOU-003 · +212 661 44 55 66", cells: ["Injection diesel", "3 800 MAD", "À régler"], status: "À régler" },
];

export default function FournisseursPage() {
  return <ShellApp actif="Fournisseurs" salutation="Fournisseurs" sousTitre="Commandes, réceptions et dettes"><div className="apparaitre"><div className="mb-6"><p className="text-xs uppercase tracking-[0.2em] text-[#a8bb87]">Achats</p><h1 className="titre-or mt-1 text-2xl font-extrabold">Fournisseurs</h1><p className="mt-1 text-sm text-[#a8bb87]">Réceptionnez avant facture et rapprochez les documents sans doubler le stock.</p></div><ModuleTable rows={suppliers} headers={["Spécialité", "Solde dû", "État"]} placeholder="Rechercher un fournisseur…" actionLabel="Nouveau fournisseur" /></div></ShellApp>;
}
