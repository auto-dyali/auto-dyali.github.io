import { ShellApp } from "@/components/shell-app";
import { StockModule } from "@/components/stock-module";

export default function StockPage() {
  return <ShellApp actif="Stock" salutation="Stock & catalogue" sousTitre="Mouvements, lots et alertes"><div className="apparaitre"><StockModule /></div></ShellApp>;
}
