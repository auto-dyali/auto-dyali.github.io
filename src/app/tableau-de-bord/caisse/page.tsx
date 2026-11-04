import { ShellApp } from "@/components/shell-app";
import { CaisseModule } from "@/components/backoffice-modules";

export default function CaissePage() {
  return <ShellApp actif="Caisse" salutation="Caisse" sousTitre="Ouverture, mouvements et clôture journalière"><div className="apparaitre"><CaisseModule /></div></ShellApp>;
}
