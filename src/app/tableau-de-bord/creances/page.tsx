import { ShellApp } from "@/components/shell-app";
import { EcheancesModule } from "@/components/echeances-module";

export default function EcheancesPage() {
  return (
    <ShellApp actif="Créances" feature="reports_finance" salutation="Créances & dettes" sousTitre="Garage AUTO DYALI — Agadir">
      <EcheancesModule />
    </ShellApp>
  );
}
