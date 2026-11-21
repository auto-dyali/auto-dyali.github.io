"use client";

/**
 * AUTO DYALI — Super Admin › Souscription de forfait (Subscription Studio)
 * Page d'entrée du Subscription Studio MEGA PRO Enterprise Premium.
 */

import { SubscriptionStudio } from "@/components/subscription-studio";
import { ModulePage } from "@/components/super-admin-module-page";
import { ModuleHeader } from "@/components/super-admin-page";
import Link from "next/link";

export default function SouscriptionPage() {
  return (
    <ModulePage titre="Souscription de forfait">
      <ModuleHeader
        surtitre="AUTO DYALI · MEGA PRO Enterprise Premium"
        titre="Subscription Studio"
        description="Créez ou modifiez un abonnement à partir des forfaits réels configurés dans Supabase (STANDARD, SILVER, GOLD). Aucun prix n'est inventé : si un forfait n'a pas de tarif, la confirmation est bloquée."
        action={
          <Link href="/super-admin/plans/" className="rounded-lg border border-[#8FB59B]/40 px-4 py-2 text-sm text-[#DFE7E2] hover:bg-[#344440]">
            Gérer les forfaits
          </Link>
        }
      />
      <SubscriptionStudio />
    </ModulePage>
  );
}
