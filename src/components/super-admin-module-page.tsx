"use client";

/**
 * Conteneur partagé des modules Super Admin :
 * garde d'accès + shell (sidebar/topbar) + déconnexion + compteur d'audit.
 */

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase-browser";
import { SuperAdminGuard } from "@/components/super-admin-guard";
import { SuperAdminShell } from "@/components/super-admin-shell";

export function ModulePage({ children, titre }: { children: ReactNode; titre: string }) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<number | undefined>(undefined);

  useEffect(() => {
    let vivant = true;
    void (async () => {
      if (!supabase) return;
      const { count } = await supabase.from("audit_log").select("id", { count: "exact", head: true });
      if (vivant && typeof count === "number") setNotifications(count);
    })();
    return () => {
      vivant = false;
    };
  }, []);

  async function logout() {
    await supabase?.auth.signOut();
    router.replace("/connexion/");
  }

  return (
    <SuperAdminGuard titre={titre}>
      <SuperAdminShell onLogout={() => void logout()} notifications={notifications}>
        <div className="mx-auto max-w-7xl p-5 lg:p-10">{children}</div>
      </SuperAdminShell>
    </SuperAdminGuard>
  );
}
