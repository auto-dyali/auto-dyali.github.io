import { ShellApp } from "@/components/shell-app";
import { ModuleTable, type ModuleRow } from "@/components/module-table";

const sales: ModuleRow[] = [
  { id: "sale1", primary: "VNT-2025-0184", secondary: "Ahmed Belkacem · aujourd'hui 10:42", cells: ["Pièces + prestation", "1 250 MAD", "Payée"], status: "Payée" },
  { id: "sale2", primary: "VNT-2025-0183", secondary: "Vente comptoir · aujourd'hui 09:18", cells: ["Accessoires", "680 MAD", "Payée"], status: "Payée" },
  { id: "sale3", primary: "VNT-2025-0182", secondary: "Rachid Alaoui · hier 16:30", cells: ["Pneumatiques", "2 400 MAD", "Partielle"], status: "Partielle" },
];

export default function PointDeVentePage() {
  return <ShellApp actif="Point de vente" salutation="Point de vente" sousTitre="Pièces, accessoires et prestations"><div className="apparaitre"><div className="mb-6"><p className="text-xs uppercase tracking-[0.2em] text-[#a8bb87]">Commerce</p><h1 className="titre-or mt-1 text-2xl font-extrabold">Ventes & encaissement</h1><p className="mt-1 text-sm text-[#a8bb87]">Le POS doit fonctionner indépendamment de l&apos;atelier.</p></div><ModuleTable rows={sales} headers={["Type", "Total", "Paiement"]} placeholder="Référence ou client…" actionLabel="Nouvelle vente" /></div></ShellApp>;
}
