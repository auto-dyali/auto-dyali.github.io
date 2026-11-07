import { ShellApp } from "@/components/shell-app";
import { ScanProModule } from "@/components/scan-pro-module";

export default function ScanProPage() {
  return (
    <ShellApp
      actif="Scan Pro"
      feature="pos"
      salutation="Scan Pro"
      sousTitre="Codes-barres et QR codes : générer, associer, tracer."
    >
      <div className="apparaitre">
        <div className="mb-6">
          <p className="text-xs uppercase tracking-[0.2em] text-[#a8bb87]">Commerce</p>
          <h1 className="titre-or mt-1 text-2xl font-extrabold">Scan Pro — administration des codes</h1>
          <p className="mt-1 text-sm text-[#a8bb87]">
            Génération EAN-13 avec clé de contrôle vérifiée, association multi-codes par produit
            (variante, lot, référence OEM) — migration 0023.
          </p>
        </div>
        <ScanProModule />
      </div>
    </ShellApp>
  );
}
