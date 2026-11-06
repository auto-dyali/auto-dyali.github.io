import { ShellApp } from "@/components/shell-app";
import { TireModule } from "@/components/tire-module";

export default function PneumatiquesPage() {
  return (
    <ShellApp
      actif="Pneumatiques"
      feature="tires"
      salutation="Module pneumatiques"
      sousTitre="Catalogue, dimensions et prestations de montage"
    >
      <div className="apparaitre">
        <TireModule />
      </div>
    </ShellApp>
  );
}
