import { ShellApp } from "@/components/shell-app";
import { ModuleTable, type ModuleRow } from "@/components/module-table";

const employees: ModuleRow[] = [
  { id: "e1", primary: "Mohamed Mechanic", secondary: "EMP-001 · Mécanicien senior", cells: ["Atelier", "08:00", "Présent"], status: "Présent" },
  { id: "e2", primary: "Karim Diesel", secondary: "EMP-002 · Mécanicien", cells: ["Injection", "08:12", "Présent"], status: "Présent" },
  { id: "e3", primary: "Youssef Auto", secondary: "EMP-003 · Technicien diagnostic", cells: ["Électricité", "08:02", "Présent"], status: "Présent" },
  { id: "e4", primary: "Hajar Store", secondary: "EMP-004 · Responsable stock", cells: ["Stock", "—", "Absent"], status: "Absent" },
];

export default function EmployesPage() {
  return <ShellApp actif="Employés" salutation="Employés & ressources humaines" sousTitre="Rôles, pointage et performances"><div className="apparaitre"><div className="mb-6"><p className="text-xs uppercase tracking-[0.2em] text-[#a8bb87]">Ressources humaines</p><h1 className="titre-or mt-1 text-2xl font-extrabold">Équipe</h1><p className="mt-1 text-sm text-[#a8bb87]">Gérez les affectations, le pointage et les permissions par rôle.</p></div><ModuleTable rows={employees} headers={["Département", "Pointage", "Présence"]} placeholder="Rechercher un employé…" actionLabel="Nouvel employé" /></div></ShellApp>;
}
