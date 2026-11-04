import { ShellApp } from "@/components/shell-app";
import { FournisseursModule } from "@/components/backoffice-modules";

export default function FournisseursPage() {
  return <ShellApp actif="Fournisseurs" salutation="Fournisseurs" sousTitre="Commandes, réceptions et dettes"><div className="apparaitre"><FournisseursModule /></div></ShellApp>;
}
