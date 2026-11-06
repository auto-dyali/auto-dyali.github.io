import { ShellApp } from "@/components/shell-app";
import { SalesHistoryModule } from "@/components/sales-history-module";

export default function HistoriqueVentesPage() {
  return (
    <ShellApp
      actif="Historique des ventes"
      feature="pos"
      salutation="Historique des ventes"
      sousTitre="Encaissements différés, factures et retours"
    >
      <div className="apparaitre">
        <SalesHistoryModule />
      </div>
    </ShellApp>
  );
}
