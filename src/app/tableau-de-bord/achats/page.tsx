import { ShellApp } from "@/components/shell-app";
import { AchatsModule } from "@/components/backoffice-modules";

export default function AchatsPage() {
  return <ShellApp actif="Achats" feature="purchasing" salutation="Achats" sousTitre="Commandes fournisseurs et réceptions"><div className="apparaitre"><AchatsModule /></div></ShellApp>;
}
