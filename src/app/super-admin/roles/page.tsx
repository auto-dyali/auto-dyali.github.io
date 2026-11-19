"use client";

/**
 * AUTO DYALI — Super Admin › Sécurité & permissions
 * Vue réelle des rôles, droits par forfait, isolation multi-tenant et
 * contrôles sensibles. Le masquage UI n'est jamais une protection.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase-browser";
import { ModulePage } from "@/components/super-admin-module-page";
import { ModuleHeader, Chargement, Vide, Erreur } from "@/components/super-admin-page";
import { downloadCsv } from "@/lib/csv-export";
import { FEATURE_LABEL } from "@/lib/features";

const ROLES = ["saas_admin", "manager", "employee", "client"] as const;
const LIBELLES: Record<string, string> = {
  saas_admin: "Super Admin (plateforme)",
  manager: "Manager (propriétaire professionnel)",
  employee: "Employé (atelier)",
  client: "Client final",
};

type ProfileRow = { id: string; full_name: string; role: string; is_active: boolean; establishment_id: string | null };
type PlanFeature = { plan_code: string; feature_key: string; enabled: boolean };

export default function RolesPage() {
  const [rows, setRows] = useState<ProfileRow[]>([]);
  const [features, setFeatures] = useState<PlanFeature[]>([]);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      if (!supabase) return;
      setLoading(true);
      const [p, f] = await Promise.all([
        supabase.from("profiles").select("id, full_name, role, is_active, establishment_id").order("role"),
        supabase.from("plan_features").select("plan_code, feature_key, enabled"),
      ]);
      if (p.error) setErreur(p.error.message);
      else setRows((p.data ?? []) as ProfileRow[]);
      if (f.error) setErreur((prev) => prev ?? f.error.message);
      else setFeatures((f.data ?? []) as PlanFeature[]);
      setLoading(false);
    })();
  }, []);

  const parRole = useMemo(() => {
    const m = new Map<string, { total: number; actifs: number }>();
    for (const r of ROLES) m.set(r, { total: 0, actifs: 0 });
    for (const r of rows) {
      const cur = m.get(r.role) ?? { total: 0, actifs: 0 };
      cur.total += 1;
      if (r.is_active) cur.actifs += 1;
      m.set(r.role, cur);
    }
    return m;
  }, [rows]);

  const admins = rows.filter((r) => r.role === "saas_admin");
  const droitsActifs = features.filter((f) => f.enabled).length;
  const modules = Array.from(new Set(features.map((f) => f.feature_key))).sort();
  const plans = Array.from(new Set(features.map((f) => f.plan_code))).sort();

  function exporter() {
    downloadCsv(
      `auto-dyali-comptes-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Nom", "Rôle", "État", "Établissement"],
      rows.map((r) => [r.full_name, r.role, r.is_active ? "Actif" : "Inactif", r.establishment_id ?? "—"])
    );
  }

  return (
    <ModulePage titre="Sécurité & permissions">
      <ModuleHeader
        surtitre="AUTO DYALI · Moindre privilège · RLS"
        titre="Sécurité & permissions"
        description="Rôles techniques, matrice de droits par forfait, isolation multi-tenant et journalisation. Les contrôles doivent être appliqués côté serveur/RLS ; l’interface ne suffit pas."
        action={
          <>
            <Link href="/super-admin/plans/" className="rounded-lg border border-[#8FB59B]/40 px-4 py-2 text-sm text-[#DFE7E2] hover:bg-[#344440]">Gérer les droits (forfaits)</Link>
            <button type="button" onClick={exporter} className="rounded-lg border border-[#8FB59B]/40 px-4 py-2 text-sm text-[#DFE7E2] hover:bg-[#344440]">Exporter comptes</button>
          </>
        }
      />

      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {ROLES.map((role) => {
          const c = parRole.get(role) ?? { total: 0, actifs: 0 };
          return (
            <article key={role} className="carte-premium p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-[#A7B7A8]">{LIBELLES[role]}</p>
              <p className="titre-or mt-2 text-3xl font-extrabold">{c.total}</p>
              <p className="mt-1 text-[11px] text-[#A7B7A8]">{c.actifs} actif(s)</p>
            </article>
          );
        })}
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        <article className="carte-premium p-5 lg:col-span-2">
          <h2 className="font-bold">Accès par module (forfaits)</h2>
          <p className="mt-1 text-xs text-[#A7B7A8]">
            {droitsActifs} droit(s) activé(s) sur {features.length} entrées ({modules.length} module(s), {plans.length} forfait(s)). La disponibilité réelle = forfait ∩ permissions attribuées (contrôle serveur).
          </p>
          {modules.length === 0 ? (
            <p className="mt-4 text-sm text-[#A7B7A8]">Aucun droit chargé. Vérifiez la table <code>plan_features</code>.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead className="text-xs uppercase text-[#A7B7A8]">
                  <tr>
                    <th className="pb-2 pr-3">Module</th>
                    {plans.map((p) => <th key={p} className="pb-2 px-2 text-center uppercase">{p}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#8FB59B]/10">
                  {modules.map((m) => (
                    <tr key={m}>
                      <td className="py-2 pr-3 text-[#E8ECE8]">{FEATURE_LABEL[m] ?? m}</td>
                      {plans.map((p) => {
                        const on = features.find((f) => f.plan_code === p && f.feature_key === m)?.enabled;
                        return <td key={p} className={`py-2 px-2 text-center ${on ? "text-[#7FBF9E]" : "text-[#6B7B73]"}`}>{on ? "✓" : "—"}</td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>

        <article className="carte-premium p-5">
          <h2 className="font-bold">Super Admins ({admins.length})</h2>
          <p className="mt-1 text-xs text-[#A7B7A8]">Comptes plateforme (rôle saas_admin).</p>
          {admins.length === 0 ? (
            <div className="mt-4"><Vide titre="Aucun Super Admin" detail="Aucun compte saas_admin." /></div>
          ) : (
            <ul className="mt-4 divide-y divide-[#8FB59B]/10">
              {admins.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="font-semibold text-[#E8ECE8] truncate">{a.full_name}</span>
                  <span className={a.is_active ? "text-[#7FBF9E]" : "text-[#C5716B]"}>{a.is_active ? "Actif" : "Inactif"}</span>
                </li>
              ))}
            </ul>
          )}
          <Link href="/super-admin/audit/" className="mt-4 inline-block text-sm text-[#8FB59B] hover:underline">Voir le journal d’activité →</Link>
        </article>
      </section>

      <div className="carte-premium mt-6 border-l-4 border-[#8FB59B]/40 p-5">
        <h2 className="font-bold">RLS, isolation et opérations sensibles</h2>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-[#A7B7A8]">
          <li><strong className="text-[#E8ECE8]">Isolation multi-tenant</strong> : les données métier sont filtrées par établissement (RLS / <code>current_establishment_id()</code>) ; le rôle <code>saas_admin</code> dispose d’un accès plateforme contrôlé.</li>
          <li><strong className="text-[#E8ECE8]">Rôles</strong> : saas_admin (plateforme), manager (propriétaire établissement), employee (atelier), client (final). Aucune promotion automatique.</li>
          <li><strong className="text-[#E8ECE8]">Permissions</strong> : modules du forfait + droits fins (voir/créer/modifier/supprimer) attribués à l’onboarding ; CRUD fin non généralisé aux RLS métier (statut actuel : <code>can_view</code> principalement appliqué).</li>
          <li><strong className="text-[#E8ECE8]">Opérations sensibles</strong> : créations, changements de forfait/statut, invitations et actions admin doivent être journalisés (<code>audit_log</code>) sans secrets.</li>
          <li><strong className="text-[#E8ECE8]">UI ≠ sécurité</strong> : masquer un bouton n’empêche pas une action si l’API/RPC/RLS ne la refuse pas.</li>
        </ul>
      </div>

      {erreur && <div className="mt-4"><Erreur message={erreur} /></div>}
      {loading && <div className="mt-6"><Chargement /></div>}
    </ModulePage>
  );
}
