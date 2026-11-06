import { ShellApp } from "@/components/shell-app";
import { SupportModule } from "@/components/support-module";

export default function SupportPage() {
  return (
    <ShellApp
      actif="Support"
      feature="support"
      salutation="Support & tickets"
      sousTitre="Assistance AUTO DYALI et suivi de vos demandes"
    >
      <div className="apparaitre">
        <SupportModule />
      </div>
    </ShellApp>
  );
}
