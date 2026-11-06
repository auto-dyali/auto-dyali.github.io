import { ShellApp } from "@/components/shell-app";
import { EmployesModule } from "@/components/employes-module";

export default function EmployesPage() {
  return <ShellApp actif="Employés" feature="employees" salutation="Employés & ressources humaines" sousTitre="Rôles, pointage et performances"><div className="apparaitre"><EmployesModule /></div></ShellApp>;
}
