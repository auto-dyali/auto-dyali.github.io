import { ShellApp } from "@/components/shell-app";
import { RecentSalesModule } from "@/components/backoffice-modules";
import { PosModule } from "@/components/pos-module";

export default function PointDeVentePage() {
  return <ShellApp actif="Point de vente" salutation="Point de vente" sousTitre="Pièces, accessoires et prestations"><div className="apparaitre"><div className="mb-6"><p className="text-xs uppercase tracking-[0.2em] text-[#a8bb87]">Commerce</p><h1 className="titre-or mt-1 text-2xl font-extrabold">Ventes & encaissement</h1><p className="mt-1 text-sm text-[#a8bb87]">POS tactile responsive : téléphone, tablette et écran de caisse.</p></div><PosModule /><RecentSalesModule /></div></ShellApp>;
}
