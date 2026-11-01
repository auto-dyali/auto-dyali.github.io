import { ShellApp } from "@/components/shell-app";
import { ModuleTable, type ModuleRow } from "@/components/module-table";

const workOrders: ModuleRow[] = [
  { id: "or45", primary: "OR-2025-045", secondary: "Renault Clio · 98765-B-1", cells: ["Vidange + filtres", "Mohamed", "En cours"], status: "En cours" },
  { id: "or46", primary: "OR-2025-046", secondary: "Toyota Corolla · 12345-A-5", cells: ["Diagnostic", "Youssef", "À faire"], status: "À faire" },
  { id: "or47", primary: "OR-2025-047", secondary: "Dacia Sandero · 45678-C-9", cells: ["Pneumatiques", "Karim", "À faire"], status: "À faire" },
  { id: "or44", primary: "OR-2025-044", secondary: "BMW Série 3 · 77788-E-2", cells: ["Freinage", "Mohamed", "Terminé"], status: "Terminé" },
];

export default function AtelierPage() {
  return <ShellApp actif="Atelier" salutation="Atelier & ordres de réparation" sousTitre="Affectations et contrôle qualité"><div className="apparaitre"><div className="mb-6"><p className="text-xs uppercase tracking-[0.2em] text-[#a8bb87]">Production</p><h1 className="titre-or mt-1 text-2xl font-extrabold">Ordres de réparation</h1><p className="mt-1 text-sm text-[#a8bb87]">Créez, affectez et suivez les interventions de votre atelier.</p></div><ModuleTable rows={workOrders} headers={["Prestation", "Mécanicien", "Statut"]} placeholder="Rechercher un OR, véhicule…" actionLabel="Nouvelle intervention" /></div></ShellApp>;
}
