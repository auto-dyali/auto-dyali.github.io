import { ShellApp } from "@/components/shell-app";
import { PrintProModule } from "@/components/print-pro-module";

export default function PrintProPage() {
  return (
    <ShellApp
      actif="Print Pro"
      feature="pos"
      salutation="Print Pro"
      sousTitre="Imprimantes, tickets et bons d'intervention — par établissement."
    >
      <div className="apparaitre">
        <div className="mb-6">
          <p className="text-xs uppercase tracking-[0.2em] text-[#a8bb87]">Commerce</p>
          <h1 className="titre-or mt-1 text-2xl font-extrabold">Print Pro — gestion des imprimantes</h1>
          <p className="mt-1 text-sm text-[#a8bb87]">
            Thermique 58 / 80 mm et A4/PDF · ESC/POS selon les capacités du navigateur ·
            historique tracé et réimpression.
          </p>
        </div>
        <PrintProModule />
      </div>
    </ShellApp>
  );
}
