import { ShellApp } from "@/components/shell-app";
import { FacturationModule } from "@/components/backoffice-modules";

export default function FacturationPage() {
  return <ShellApp actif="Facturation" feature="invoices" salutation="Facturation" sousTitre="Factures et suivi des règlements"><div className="apparaitre"><FacturationModule /></div></ShellApp>;
}
