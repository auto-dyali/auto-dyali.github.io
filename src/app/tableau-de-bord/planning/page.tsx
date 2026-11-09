import { ShellApp } from "@/components/shell-app";
import { PlanningModule } from "@/components/backoffice-modules";

export default function PlanningPage() {
  return <ShellApp actif="Planning & Rendez-vous" feature="appointments" salutation="Planning & réservations" sousTitre="Rendez-vous et postes de travail"><div className="apparaitre"><PlanningModule /></div></ShellApp>;
}
