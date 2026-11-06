import { ShellApp } from "@/components/shell-app";
import { ParametresModule } from "@/components/backoffice-modules";

export default function ParametresPage() {
  return <ShellApp actif="Paramètres" feature="dashboard" salutation="Paramètres" sousTitre="Configuration de l’établissement et des accès"><div className="apparaitre"><ParametresModule /></div></ShellApp>;
}
