"use client";

/**
 * AUTO DYALI — Super Admin › Entreprises & abonnés professionnels
 * Liste réelle des établissements, abonnement courant, recherche,
 * filtres, export CSV, suspension/réactivation et changement de forfait
 * via les RPC sécurisées (journalisées côté serveur).
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase-browser";
import { ModulePage } from "@/components/super-admin-module-page";
import { ModuleHeader, Chargement, Vide, Erreur } from "@/components/super-admin-page";
import { downloadCsv, dateFrCourte } from "@/lib/csv-export";

type Sub = { status: string | null; plan_code: string | null; trial_ends_at: string | null; current_period_end: string | null };
type Row = {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  phone: string | null;
  email: string | null;
  plan: string;
  is_active: boolean;
  created_at: string;
  suspended_at: string | null;
  subscriptions: Sub[] | null;
};

const STATUT_ABO: Record<string, string> = {
  trial: "Essai",
  active: "Actif",
  past_due: "En retard",
  suspended: "Suspendu",
  expired: "Expiré",
  cancelled: "Résilié",
};

export default function EntreprisesPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [recherche, setRecherche] = useState("");
  const [filtreEtat, setFiltreEtat] = useState<"tous" | "actifs" | "suspendus">("tous");
  const [filtrePlan, setFiltrePlan] = useState<string>("tous");
  const [traitement, setTraitement] = useState<string | null>(null);

  useEffect(() => {
    void charger();
  }, []);

  async function charger() {
    if (!supabase) return;
    setLoading(true);
    setErreur(null);
    const { data, error } = await supabase
      .from("establishments")
      .select("id, name, slug, city, phone, email, plan, is_active, created_at, suspended_at, subscriptions(status, plan_code, trial_ends_at, current_period_end)")
      .order("created_at", { ascending: false });
    if (error) setErreur(error.message);
    else setRows((data ?? []) as unknown as Row[]);
    setLoading(false);
  }

  const visibles = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return rows.filter((r) => {
      if (filtreEtat === "actifs" && !r.is_active) return false;
      if (filtreEtat === "suspendus" && r.is_active) return false;
      if (filtrePlan !== "tous" && r.plan !== filtrePlan) return false;
      if (!q) return true;
      return [r.name, r.slug, r.city, r.phone, r.email, r.plan]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [rows, recherche, filtreEtat, filtrePlan]);

  async function basculer(row: Row) {
    if (!supabase) return;
    setTraitement(row.id);
    setNotice(null);
    setErreur(null);
    const { error } = await supabase.rpc("admin_set_establishment_status", {
      p_establishment_id: row.id,
      p_active: !row.is_active,
    });
    if (error) setErreur(error.message);
    else setNotice(row.is_active ? `« ${row.name} » suspendue (données conservées).` : `« ${row.name} » réactivée.`);
    await charger();
    setTraitement(null);
  }

  async function changerPlan(row: Row, plan: string) {
    if (!supabase) return;
    setTraitement(row.id);
    setNotice(null);
    setErreur(null);
    const { error } = await supabase.rpc("admin_change_plan", { p_establishment_id: row.id, p_plan: plan });
    if (error) setErreur(error.message);
    else setNotice(`Forfait de « ${row.name} » mis à jour et journalisé.`);
    await charger();
    setTraitement(null);
  }

  function exporter() {
    downloadCsv(
      `auto-dyali-entreprises-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Entreprise", "Slug", "Ville", "Téléphone", "Email", "Forfait", "État", "Abonnement", "Inscription"],
      visibles.map((r) => {
        const sub = r.subscriptions?.[0];
        return [
          r.name,
          r.slug,
          r.city,
          r.phone,
          r.email,
          r.plan.toUpperCase(),
          r.is_active ? "Actif" : "Suspendu",
          sub?.status ? STATUT_ABO[sub.status] ?? sub.status : "—",
          dateFrCourte(r.created_at),
        ];
      })
    );
  }

  return (
    <ModulePage titre="Entreprises">
      <ModuleHeader
        surtitre="AUTO DYALI · Abonnés professionnels"
        titre="Entreprises & abonnés"
        description="Liste réelle des établissements, abonnement courant, suspension/réactivation et changement de forfait — actions journalisées côté serveur."
        action={
          <>
            <button type="button" onClick={exporter} className="rounded-lg border border-[#8FB59B]/40 px-4 py-2 text-sm text-[#DFE7E2] hover:bg-[#344440]">Exporter CSV</button>
            <Link href="/super-admin/onboarding/" className="btn-or px-4 py-2 text-sm">+ Nouvel abonné</Link>
          </>
        }
      />

      {/* Filtres */}
      <div className="carte-premium mt-6 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs text-[#A7B7A8]">
          Recherche
          <input type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Entreprise, slug, ville, téléphone…" className="champ mt-1 min-h-11 w-full" aria-label="Rechercher une entreprise" />
        </label>
        <label className="text-xs text-[#A7B7A8]">
          État
          <select value={filtreEtat} onChange={(e) => setFiltreEtat(e.target.value as typeof filtreEtat)} className="champ mt-1 min-h-11">
            <option value="tous">Tous</option>
            <option value="actifs">Actifs</option>
            <option value="suspendus">Suspendus</option>
          </select>
        </label>
        <label className="text-xs text-[#A7B7A8]">
          Forfait
          <select value={filtrePlan} onChange={(e) => setFiltrePlan(e.target.value)} className="champ mt-1 min-h-11">
            <option value="tous">Tous</option>
            <option value="standard">STANDARD</option>
            <option value="silver">SILVER</option>
            <option value="gold">GOLD</option>
          </select>
        </label>
        <div className="flex items-end">
          <p className="text-xs text-[#A7B7A8]"><span className="text-lg font-extrabold text-[#E8ECE8]">{visibles.length}</span> / {rows.length} entreprises</p>
        </div>
      </div>

      {notice && <p role="status" className="mt-4 rounded-lg bg-[#5D9E7F]/10 px-4 py-3 text-sm text-[#7FBF9E]">{notice}</p>}
      {erreur && <div className="mt-4"><Erreur message={erreur} /></div>}

      {loading ? (
        <div className="mt-6"><Chargement /></div>
      ) : visibles.length === 0 ? (
        <div className="mt-6"><Vide titre="Aucune entreprise" detail={recherche ? "Aucun résultat pour cette recherche." : "Aucun établissement enregistré."} /></div>
      ) : (
        <div className="carte mt-6 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-[#344440]/50 text-xs uppercase text-[#A7B7A8]">
                <tr>
                  <th className="px-5 py-3">Entreprise</th>
                  <th className="px-5 py-3">Ville</th>
                  <th className="px-5 py-3">Forfait</th>
                  <th className="px-5 py-3">Abonnement</th>
                  <th className="px-5 py-3">État</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#8FB59B]/10">
                {visibles.map((r) => {
                  const sub = r.subscriptions?.[0];
                  return (
                    <tr key={r.id}>
                      <td className="px-5 py-4">
                        <p className="font-semibold">{r.name}</p>
                        <p className="text-[11px] text-[#A7B7A8]">{r.slug} · inscrite le {dateFrCourte(r.created_at)}</p>
                      </td>
                      <td className="px-5 py-4 text-[#A7B7A8]">{r.city ?? "—"}</td>
                      <td className="px-5 py-4">
                        <select aria-label={`Forfait de ${r.name}`} className="champ min-h-9 py-1 text-xs uppercase" value={r.plan} disabled={traitement === r.id} onChange={(e) => void changerPlan(r, e.target.value)}>
                          <option value="standard">STANDARD</option>
                          <option value="silver">SILVER</option>
                          <option value="gold">GOLD</option>
                        </select>
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-xs">{sub?.status ? STATUT_ABO[sub.status] ?? sub.status : "—"}</p>
                        {sub?.current_period_end && <p className="text-[11px] text-[#A7B7A8]">échéance {dateFrCourte(sub.current_period_end)}</p>}
                      </td>
                      <td className={`px-5 py-4 font-semibold ${r.is_active ? "text-[#5D9E7F]" : "text-[#C5716B]"}`}>{r.is_active ? "Actif" : "Suspendu"}</td>
                      <td className="px-5 py-4 text-right">
                        <button type="button" disabled={traitement === r.id} onClick={() => void basculer(r)} className={`rounded-lg border px-3 py-1.5 text-xs ${r.is_active ? "border-[#C5716B]/40 text-[#C5716B] hover:bg-[#C5716B]/10" : "border-[#5D9E7F]/40 text-[#5D9E7F] hover:bg-[#5D9E7F]/10"} disabled:opacity-40`}>
                          {traitement === r.id ? "…" : r.is_active ? "Suspendre" : "Réactiver"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </ModulePage>
  );
}
