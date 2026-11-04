import { ShellApp } from "@/components/shell-app";
import { VehiculesModule } from "@/components/vehicules-module";

export default function VehiculesPage() {
  return <ShellApp actif="Véhicules" salutation="Parc automobile" sousTitre="Historique et rappels d&apos;entretien"><div className="apparaitre"><VehiculesModule /></div></ShellApp>;
}
