import { ShellApp } from "@/components/shell-app";
import { AtelierModule } from "@/components/atelier-module";

export default function AtelierPage() {
  return <ShellApp actif="Atelier & Interventions" feature="workshop" salutation="Atelier & ordres de réparation" sousTitre="Affectations et contrôle qualité"><div className="apparaitre"><AtelierModule /></div></ShellApp>;
}
