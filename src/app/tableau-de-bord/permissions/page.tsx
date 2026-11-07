import { ShellApp } from "@/components/shell-app";
import { PermissionsModule } from "@/components/permissions-module";

export default function PermissionsPage() {
  return (
    <ShellApp actif="Permissions" feature="advanced_permissions" salutation="Permissions avancées" sousTitre="Garage AUTO DYALI — Agadir">
      <PermissionsModule />
    </ShellApp>
  );
}
