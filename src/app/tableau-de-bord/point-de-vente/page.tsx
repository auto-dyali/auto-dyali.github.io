"use client";

import { ShellApp } from "@/components/shell-app";
import { FullPos } from "@/modules/new-pos/full-pos/full-pos";

export default function PointDeVentePage() {
  return (
    <ShellApp actif="Point de vente" feature="pos" salutation="Point de vente" sousTitre="Pièces, accessoires et prestations">
      <div className="apparaitre">
        <FullPos />
      </div>
    </ShellApp>
  );
}
