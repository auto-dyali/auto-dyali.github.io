import { ShellApp } from "@/components/shell-app";
import { AchatsModule } from "@/components/backoffice-modules";
import { AchatsComplementsModule } from "@/components/achats-complements-module";

export default function AchatsPage() {
  return (
    <ShellApp actif="Achats" feature="purchasing" salutation="Achats" sousTitre="Commandes fournisseurs et réceptions">
      <div className="apparaitre space-y-6">
        <AchatsModule />
        <div>
          <h2 className="titre-or mb-3 text-lg font-extrabold">Retours &amp; factures fournisseurs</h2>
          <AchatsComplementsModule />
        </div>
      </div>
    </ShellApp>
  );
}
