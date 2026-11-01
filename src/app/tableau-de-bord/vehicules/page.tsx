import { ShellApp } from "@/components/shell-app";
import { ModuleTable, type ModuleRow } from "@/components/module-table";

const vehicles: ModuleRow[] = [
  { id: "v1", primary: "BMW Série 3", secondary: "77788-E-2 · Ahmed Belkacem", cells: ["2023", "42 300 km", "En atelier"], status: "En atelier" },
  { id: "v2", primary: "Peugeot 208", secondary: "32101-D-3 · Sanae Bennis", cells: ["2022", "31 820 km", "En atelier"], status: "En atelier" },
  { id: "v3", primary: "Dacia Sandero", secondary: "45678-C-9 · Rachid Alaoui", cells: ["2020", "68 100 km", "En atelier"], status: "En atelier" },
  { id: "v4", primary: "Toyota Corolla", secondary: "12345-A-5 · Ahmed Belkacem", cells: ["2021", "54 600 km", "Disponible"], status: "Disponible" },
];

export default function VehiculesPage() {
  return <ShellApp actif="Véhicules" salutation="Parc automobile" sousTitre="Historique et rappels d&apos;entretien"><div className="apparaitre"><div className="mb-6"><p className="text-xs uppercase tracking-[0.2em] text-[#a8bb87]">Gestion automobile</p><h1 className="titre-or mt-1 text-2xl font-extrabold">Véhicules</h1><p className="mt-1 text-sm text-[#a8bb87]">Suivez chaque véhicule, son kilométrage et son historique d&apos;interventions.</p></div><ModuleTable rows={vehicles} headers={["Mise en circulation", "Kilométrage", "Statut"]} placeholder="Rechercher une plaque, marque…" actionLabel="Nouveau véhicule" /></div></ShellApp>;
}
