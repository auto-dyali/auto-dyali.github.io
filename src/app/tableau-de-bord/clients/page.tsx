import { ShellApp } from "@/components/shell-app";
import { ClientsModule } from "@/components/clients-module";

export default function ClientsPage() {
  return <ShellApp actif="Clients" feature="clients" salutation="Gestion des clients" sousTitre="Fiches, véhicules et paiements"><div className="apparaitre"><ClientsModule /></div></ShellApp>;
}
