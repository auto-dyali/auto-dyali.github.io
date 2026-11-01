import { ShellApp } from "@/components/shell-app";
import { ModuleTable, type ModuleRow } from "@/components/module-table";

const clients: ModuleRow[] = [
  { id: "cl1", primary: "Ahmed Belkacem", secondary: "CL-0001 · +212 661 000 001", cells: ["2 véhicules", "1 250 MAD", "Actif"], status: "Actif" },
  { id: "cl2", primary: "Fatima Zahra", secondary: "CL-0002 · +212 661 000 002", cells: ["1 véhicule", "0 MAD", "Actif"], status: "Actif" },
  { id: "cl3", primary: "Rachid Alaoui", secondary: "CL-0003 · +212 661 000 003", cells: ["1 véhicule", "680 MAD", "À relancer"], status: "À relancer" },
  { id: "cl4", primary: "Sanae Bennis", secondary: "CL-0004 · +212 661 000 004", cells: ["3 véhicules", "0 MAD", "Actif"], status: "Actif" },
];

export default function ClientsPage() {
  return <ShellApp actif="Clients" salutation="Gestion des clients" sousTitre="Fiches, véhicules et paiements"><div className="apparaitre"><div className="mb-6"><p className="text-xs uppercase tracking-[0.2em] text-[#a8bb87]">CRM garage</p><h1 className="titre-or mt-1 text-2xl font-extrabold">Clients</h1><p className="mt-1 text-sm text-[#a8bb87]">Centralisez les informations et l&apos;historique de vos clients.</p></div><ModuleTable rows={clients} headers={["Véhicules", "Solde", "Statut"]} placeholder="Rechercher un client…" actionLabel="Nouveau client" /></div></ShellApp>;
}
