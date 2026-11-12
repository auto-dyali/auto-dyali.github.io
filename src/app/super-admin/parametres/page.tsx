"use client";

/**
 * AUTO DYALI — Super Admin › Paramètres système
 * Aucune option "factice" : uniquement des paramètres réellement
 * branchés (plans, droits, stockage, essai) ou un renvoi explicite
 * vers la ressource qui les porte.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase-browser";
import { ModulePage } from "@/components/super-admin-module-page";
import { ModuleHeader, Chargement, Erreur } from "@/components/super-admin-page";
import { formatMontant } from "@/lib/csv-export";

type Plan = { code: string; label: string; price_monthly: number | null; trial_days: number; max_users: number; max_sites: number; storage_mb: number };
type Count = { feature_key: string; plan_code: string; enabled: boolean };

export default function ParametresPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [features, setFeatures] = useState<Count[]>([]);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      if (!supabase) return;
      setLoading(true);
      const [p, f] = await Promise.all([
        supabase.from("plans").select("code, label, price_monthly, trial_days, max_users, max_sites, storage_mb").order("price_monthly"),
        supabase.from("plan_features").select("plan_code, feature_key, enabled"),
      ]);
      if (p.error) setErreur(p.error.message);
      else setPlans((p.data ?? []) as Plan[]);
      if (f.error) setErreur(f.error.message);
      else setFeatures((f.data ?? []) as Count[]);
      setLoading(false);
    })();
  }, []);

  const droitsActifs = features.filter((f) => f.enabled).length;

  return (
    <ModulePage titre="Paramètres système">
      <ModuleHeader
        surtitre="AUTO DYALI · Configuration plateforme"
        titre="Paramètres système"
        description="Configuration réellement active : forfaits, droits, essai et limites sont en base. Toute édition se fait depuis Plans (RPC journalisées)."
      />

      {erreur && <div className="mt-4"><Erreur message={erreur} /></div>}

      {loading ? (
        <div className="mt-6"><Chargement /></div>
      ) : (
        <>
          {/* Identité de la plateforme (réel) */}
          <div className="carte-premium mt-6 p-5">
            <h2 className="font-bold">Identité de la plateforme</h2>
            <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              <li className="flex justify-between gap-3 rounded-lg bg-[#2C3735] px-4 py-2"><span className="text-[#A7B7A8]">Nom</span><span className="font-semibold text-[#E8ECE8]">AUTO DYALI</span></li>
              <li className="flex justify-between gap-3 rounded-lg bg-[#2C3735] px-4 py-2"><span className="text-[#A7B7A8]">Logo officiel</span><span className="font-semibold text-[#E8ECE8]">public/images/branding/logo.webp</span></li>
              <li className="flex justify-between gap-3 rounded-lg bg-[#2C3735] px-4 py-2"><span className="text-[#A7B7A8]">Rôles techniques</span><span className="font-semibold text-[#E8ECE8]">saas_admin · manager · employee · client</span></li>
              <li className="flex justify-between gap-3 rounded-lg bg-[#2C3735] px-4 py-2"><span className="text-[#A7B7A8]">Droits configurés</span><span className="font-semibold text-[#E8ECE8]">{droitsActifs}</span></li>
            </ul>
          </div>

          {/* Forfaits en vigueur (réels) */}
          <div className="carte mt-6 overflow-hidden">
            <div className="border-b border-[#8FB59B]/10 p-5">
              <h2 className="font-bold">Forfaits en vigueur</h2>
              <p className="mt-1 text-xs text-[#A7B7A8]">Prix, essai et limites réellement lus depuis plans — pour modifier : Plans &amp; fonctionnalités.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead className="bg-[#344440]/50 text-xs uppercase text-[#A7B7A8]"><tr><th className="px-5 py-3">Forfait</th><th className="px-5 py-3">Prix mensuel</th><th className="px-5 py-3">Essai</th><th className="px-5 py-3">Utilisateurs</th><th className="px-5 py-3">Sites</th><th className="px-5 py-3">Stockage</th></tr></thead>
                <tbody className="divide-y divide-[#8FB59B]/10">
                  {plans.map((p) => (
                    <tr key={p.code}>
                      <td className="px-5 py-3 font-semibold">{p.label}</td>
                      <td className="px-5 py-3 text-[#A7B7A8]">{p.price_monthly != null ? formatMontant(p.price_monthly) : "non configuré"}</td>
                      <td className="px-5 py-3 text-[#A7B7A8]">{p.trial_days} j</td>
                      <td className="px-5 py-3 text-[#A7B7A8]">{p.max_users}</td>
                      <td className="px-5 py-3 text-[#A7B7A8]">{p.max_sites}</td>
                      <td className="px-5 py-3 text-[#A7B7A8]">{p.storage_mb} Mo</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <Link href="/super-admin/plans/" className="btn-or px-4 py-2 text-sm">Modifier plans &amp; droits</Link>
            <Link href="/super-admin/audit/" className="rounded-lg border border-[#8FB59B]/40 px-4 py-2 text-sm text-[#DFE7E2] hover:bg-[#344440]">Voir le journal d’audit</Link>
            <Link href="/super-admin/sauvegarde/" className="rounded-lg border border-[#8FB59B]/40 px-4 py-2 text-sm text-[#DFE7E2] hover:bg-[#344440]">Exports &amp; sauvegarde</Link>
          </div>
        </>
      )}
    </ModulePage>
  );
}
