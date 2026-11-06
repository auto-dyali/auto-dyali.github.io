import { ShellApp } from "@/components/shell-app";
import { FournisseursModule } from "@/components/suppliers-module";

export default function FournisseursPage() {
  return (
    <ShellApp
      actif="Fournisseurs"
      feature="suppliers"
      salutation="Fournisseurs"
      sousTitre="Commandes, réceptions et dettes"
    >
      <div className="apparaitre">
        <FournisseursModule />
      </div>
    </ShellApp>
  );
}
