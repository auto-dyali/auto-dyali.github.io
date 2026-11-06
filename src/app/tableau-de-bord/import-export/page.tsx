import { ShellApp } from "@/components/shell-app";
import { ExcelModule } from "@/components/excel-module";

export default function ImportExportPage() {
  return (
    <ShellApp
      actif="Import / Export"
      feature="excel"
      salutation="Import / export Excel"
      sousTitre="Catalogue produits et clients au format .xlsx"
    >
      <div className="apparaitre">
        <ExcelModule />
      </div>
    </ShellApp>
  );
}
