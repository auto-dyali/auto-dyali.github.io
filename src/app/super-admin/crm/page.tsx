"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase-browser";
import { CrmModule, CrmShell } from "@/components/crm-module";

export default function CrmPage() {
  const router = useRouter();
  const [etat, setEtat] = useState<"chargement" | "ok" | "refuse">("chargement");

  useEffect(() => {
    let vivant = true;
    const verifier = async () => {
      if (!supabase) { if (vivant) setEtat("refuse"); return; }
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) { router.replace("/connexion/"); return; }
      const { data: roleData } = await supabase.rpc("get_my_profile");
      if (!vivant) return;
      if (roleData?.[0]?.role && roleData[0].role !== "saas_admin") {
        setEtat("refuse");
        return;
      }
      setEtat("ok");
    };
    const timer = window.setTimeout(() => void verifier(), 0);
    return () => { vivant = false; window.clearTimeout(timer); };
  }, [router]);

  if (etat === "refuse") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#102b32] p-6 text-center">
        <p className="text-sm text-[#d66868]">Accès refusé : le CRM est réservé à l’administrateur de la plateforme.</p>
        <button type="button" onClick={() => router.replace("/connexion/")} className="btn-or px-5 py-2 text-sm">Revenir à la connexion</button>
      </main>
    );
  }

  if (etat === "chargement") {
    return <main className="flex min-h-screen items-center justify-center bg-[#102b32] text-sm text-[#a8bb87]">Vérification de la session…</main>;
  }

  return (
    <CrmShell>
      <div className="apparaitre">
        <CrmModule />
      </div>
    </CrmShell>
  );
}
