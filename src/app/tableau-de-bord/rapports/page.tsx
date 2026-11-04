import { ShellApp } from "@/components/shell-app";
import { RapportsModule } from "@/components/backoffice-modules";

export default function RapportsPage() {
  return <ShellApp actif="Rapports" salutation="Rapports & statistiques" sousTitre="Décisions fondées sur vos données"><div className="apparaitre"><RapportsModule /></div></ShellApp>;
}
