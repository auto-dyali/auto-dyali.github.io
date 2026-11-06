import { ShellApp } from "@/components/shell-app";
import { NotificationsModule } from "@/components/notifications-module";

export default function NotificationsPage() {
  return (
    <ShellApp
      actif="Notifications"
      feature="alerts"
      salutation="Notifications & WhatsApp"
      sousTitre="Contacter vos clients : espace client, WhatsApp, email"
    >
      <div className="apparaitre">
        <NotificationsModule />
      </div>
    </ShellApp>
  );
}
