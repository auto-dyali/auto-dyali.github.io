"use client";

/**
 * AUTO DYALI — Super Admin › Rôles & permissions
 * Répartition réelle des comptes par rôle (profiles). Aucune promotion
 * automatique du rôle n'est possible depuis le navigateur.
 */

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase-browser";
import { ModulePage } from "@/components/super-admin-module-page";
import { ModuleHeader, Chargement, Vide, Erreur } from "@/components/super-admin-page";
import { downloadCsv } from "@/lib/csv-export";

const ROLES = ["saas_admin", "manager", "employee", "client"] as const;
const LIBELLES: Record<string, string> = {
  saas_admin: "Super Admin (plateforme)",
  manager: "Manager (propriétaire professionnel)",
  employee: "Employé (atelier)",
  client: "Client final",
};

type Row = { id: string; full_name: string; role: string; is_active: boolean; establishment_id: string | null };

export default function RolesPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      if (!supabase) return;
      setLoading(true);
      const { data, error } = await supabase.from("profiles").select("id, full_name, role, is_active, establishment_id").order("role");
      if (error) setErreur(error.message);
      else setRows((data ?? []) as Row[]);
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

  function exporter() {
    downloadCsv(
      `auto-dyali-comptes-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Nom", "Rôle", "État", "Établissement"],
      rows.map((r) => [r.full_name, r.role, r.is_active ? "Actif" : "Inactif", r.establishment_id ?? "—"])
    );
  }

  return (
    <ModulePage titre="Rôles & permissions">
      <ModuleHeader
        surtitre="AUTO DYALI · Moindre privilège"
        titre="Rôles & permissions"
        description="Répartition réelle des comptes par rôle technique. Les rôles ne sont jamais modifiés automatiquement : toute promotion passe par une décision explicite et un rollback possible (migration documentée)."
        action={<button type="button" onClick={exporter} className="rounded-lg border border-[#8FB59B]/40 px-4 py-2 text-sm text-[#DFE7E2] hover:bg-[#344440]">Exporter CSV</button>}
      />

      {/* Compteurs par rôle */}
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

      <div className="carte-premium mt-6 p-5">
        <h2 className="font-bold">Super Admins ({admins.length})</h2>
        <p className="mt-1 text-xs text-[#A7B7A8]">Liste réelle des comptes avec rôle saas_admin. Leur accès est tracé dans le journal d’audit.</p>
        {admins.length === 0 ? (
          <div className="mt-4"><Vide titre="Aucun Super Admin" detail="Aucun compte n’a le rôle saas_admin." /></div>
        ) : (
          <ul className="mt-4 divide-y divide-[#8FB59B]/10">
            {admins.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="font-semibold text-[#E8ECE8]">{a.full_name}</span>
                <span className={a.is_active ? "text-[#7FBF9E]" : "text-[#C5716B]"}>{a.is_active ? "Actif" : "Inactif"}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="carte-premium mt-6 border-l-4 border-[#8FB59B]/40 p-5">
        <h2 className="font-bold">Règles en vigueur</h2>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-[#A7B7A8]">
          <li>saas_admin → accès total à la plateforme, jamais de modification automatique de rôle.</li>
          <li>manager → uniquement son établissement (RLS par current_establishment_id()).</li>
          <li>employee → atelier uniquement ; client final → aucune route professionnelle.</li>
          <li>Toute action sensible est journalisée (audit_log), jamais de secret journalisé.</li>
        </ul>
      </div>

      {erreur && <div className="mt-4"><Erreur message={erreur} /></div>}
      {loading && <div className="mt-6"><Chargement /></div>}
    </ModulePage>
  );
}
