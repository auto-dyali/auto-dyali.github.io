"use client";

/**
 * AUTO DYALI — Super Admin › Invitations Manager
 *
 * Suivi des invitations envoyées aux managers (e-mail et WhatsApp),
 * avec statut d'envoi, d'expiration et d'activation.
 *
 * Dépendances :
 *  - Migration 0036 (tables invitations, invitation_events, RPC)
 *  - Edge Function d'envoi d'invitation (à déployer)
 *
 * Sans ces éléments, un message explicite s'affiche.
 */

import { SuperAdminInvitationsList } from "@/components/super-admin-invitations-list";
import { ModulePage } from "@/components/super-admin-module-page";
import { ModuleHeader } from "@/components/super-admin-page";

export default function InvitationsPage() {
  return (
    <ModulePage titre="Invitations Manager">
      <ModuleHeader
        surtitre="AUTO DYALI · Super Admin"
        titre="Invitations"
        description="Suivi des invitations Manager : e-mail, WhatsApp, statut d'envoi et activation des comptes."
      />
      <div className="mt-6">
        <SuperAdminInvitationsList />
      </div>
    </ModulePage>
  );
}
