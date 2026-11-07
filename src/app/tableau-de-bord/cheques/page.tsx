import { ShellApp } from "@/components/shell-app";
import { ChequesModule } from "@/components/cheques-module";

export default function ChequesPage() {
  return (
    <ShellApp actif="Chèques" feature="cheques" salutation="Chèques et échéances" sousTitre="Garage AUTO DYALI — Agadir">
      <ChequesModule />
    </ShellApp>
  );
}
