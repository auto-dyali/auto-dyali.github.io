import { ShellApp } from "@/components/shell-app";
import { ModuleTable, type ModuleRow } from "@/components/module-table";

const appointments: ModuleRow[] = [
  { id: "a1", primary: "09:00 · Ahmed Belkacem", secondary: "BMW Série 3 · 77788-E-2", cells: ["Diagnostic", "Youssef", "Confirmé"], status: "Confirmé" },
  { id: "a2", primary: "11:00 · Fatima Zahra", secondary: "Peugeot 208 · 32101-D-3", cells: ["Vidange", "Mohamed", "Confirmé"], status: "Confirmé" },
  { id: "a3", primary: "14:00 · Rachid Alaoui", secondary: "Dacia Sandero · 45678-C-9", cells: ["Pneumatiques", "Karim", "En attente"], status: "En attente" },
];

export default function PlanningPage() {
  return <ShellApp actif="Planning" salutation="Planning & réservations" sousTitre="Rendez-vous et postes de travail"><div className="apparaitre"><div className="mb-6"><p className="text-xs uppercase tracking-[0.2em] text-[#a8bb87]">Organisation</p><h1 className="titre-or mt-1 text-2xl font-extrabold">Planning du jour</h1><p className="mt-1 text-sm text-[#a8bb87]">Affectez les employés et les postes selon les disponibilités réelles.</p></div><ModuleTable rows={appointments} headers={["Prestation", "Responsable", "État"]} placeholder="Client ou immatriculation…" actionLabel="Nouveau rendez-vous" /></div></ShellApp>;
}
