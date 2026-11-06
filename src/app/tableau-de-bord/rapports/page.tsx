import { ShellApp } from "@/components/shell-app";
import { ReportsAdvancedModule } from "@/components/reports-advanced-module";

export default function RapportsPage() {
  return (
    <ShellApp
      actif="Rapports"
      feature="reports_basic"
      salutation="Rapports & statistiques"
      sousTitre="Décisions fondées sur vos données"
    >
      <div className="apparaitre">
        <ReportsAdvancedModule />
      </div>
    </ShellApp>
  );
}
