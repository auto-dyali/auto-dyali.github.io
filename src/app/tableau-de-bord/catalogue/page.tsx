import { ShellApp } from "@/components/shell-app";
import { CatalogueModule } from "@/components/catalogue-module";

export default function CataloguePage() {
  return (
    <ShellApp
      actif="Catalogue"
      feature="catalogue"
      salutation="Catalogue automobile centralisé"
      sousTitre="Recherche pièce ↔ véhicule et compatibilités validées"
    >
      <div className="apparaitre">
        <CatalogueModule />
      </div>
    </ShellApp>
  );
}
