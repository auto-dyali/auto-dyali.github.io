import { ShellApp } from "@/components/shell-app";
import { QuotesModule } from "@/components/quotes-module";

export default function DevisPage() {
  return (
    <ShellApp
      actif="Devis"
      feature="quotes"
      salutation="Devis commerciaux"
      sousTitre="Création, suivi et conversion en vente"
    >
      <div className="apparaitre">
        <QuotesModule />
      </div>
    </ShellApp>
  );
}
