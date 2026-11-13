"use client";

/**
 * AUTO DYALI — Super Admin › Abonnements & renouvellements
 * Lecture réelle du cycle de vie (trial → active → past_due → suspended
 * → expired / cancelled). Les transitions passent par les RPC journalisées
 * (admin_renew_subscription / admin_reactivate_subscription /
 * admin_expire_subscription — migrations 0026) — aucune écriture simulée.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase-browser";
import { ModulePage } from "@/components/super-admin-module-page";
import { ModuleHeader, Chargement, Vide, Erreur } from "@/components/super-admin-page";
import { downloadCsv, dateFrCourte } from "@/lib/csv-export";
import { useNotification } from "@/lib/use-notification";

type Sub = {
  id: string;
  establishment_id: string;
  plan_code: string;
  status: string;
  started_at: string;
  trial_ends_at: string | null;
  current_period_end: string | null;
  cancelled_at: string | null;
  created_at: string;
  establishments: { name: string; slug: string } | null;
};

const STATUT: Record<string, string> = {
  trial: "Essai",
  active: "Actif",
  past_due: "En retard",
  suspended: "Suspendu",
  expired: "Expiré",
  cancelled: "Résilié",
};

const CHAMPS_RENDELLE = ["trial", "past_due", "active"] as const;

export default function AbonnementsPage() {
  const [rows, setRows] = useState<Sub[]>([]);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [recherche, setRecherche] = useState("");
  const [filtreStatut, setFiltreStatut] = useState<string>("tous");
  const [traitement, setTraitement] = useState<string | null>(null);
  const { success: toastSuccess, error: toastError } = useNotification();

  async function charger() {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("subscriptions")
      .select("id, establishment_id, plan_code, status, started_at, trial_ends_at, current_period_end, cancelled_at, created_at, establishments(name, slug)")
      .order("created_at", { ascending: false });
    if (error) setErreur(error.message);
    else setRows((data ?? []) as unknown as Sub[]);
  };

  useEffect(() => {
    void (async () => {
      await charger();
      setLoading(false);
    })();
  }, []);

  const compteurs = useMemo(() => {
    const c: Record<string, number> = { trial: 0, active: 0, past_due: 0, suspended: 0, expired: 0, cancelled: 0 };
    for (const r of rows) c[r.status] = (c[r.status] ?? 0) + 1;
    return c;
  }, [rows]);

  const bientot = useMemo(() => {
    const d = new Date();
    const limite = new Date(d.getTime() + 7 * 86400_000);
    return rows.filter((r) => {
      const fin = r.current_period_end ?? r.trial_ends_at;
      if (!fin) return false;
      const f = new Date(fin);
      return ["trial", "active", "past_due"].includes(r.status) && f <= limite;
    }).length;
  }, [rows]);

  const visibles = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return rows.filter((r) => {
      if (filtreStatut !== "tous" && r.status !== filtreStatut) return false;
      if (!q) return true;
      return [r.establishments?.name, r.establishments?.slug, r.plan_code, r.status]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [rows, recherche, filtreStatut]);

  async function renouveler(r: Sub) {
    if (!supabase) return;
    setTraitement(`renew-${r.establishment_id}`);
    const { error } = await supabase.rpc("admin_renew_subscription", {
      p_establishment_id: r.establishment_id,
      p_months: 12,
    });
    setTraitement(null);
    if (error) toastError({ title: "Erreur renouvellement", message: error.message });
    else {
      toastSuccess({ title: "Renouvellement", message: `Renouvellement de l'abonnement de ${r.establishments?.name ?? r.establishment_id} programmé (12 mois).` });
      await charger();
    }
  };

  async function reactiver(r: Sub) {
    if (!supabase) return;
    setTraitement(`reactivate-${r.establishment_id}`);
    const { error } = await supabase.rpc("admin_reactivate_subscription", { p_establishment_id: r.establishment_id });
    setTraitement(null);
    if (error) toastError({ title: "Erreur réactivation", message: error.message });
    else {
      toastSuccess({ title: "Réactivation", message: `Abonnement de ${r.establishments?.name ?? r.establishment_id} réactivé.` });
      await charger();
    }
  };

  async function expirer(r: Sub) {
    if (!supabase) return;
    setTraitement(`expire-${r.establishment_id}`);
    const { error } = await supabase.rpc("admin_expire_subscription", { p_establishment_id: r.establishment_id });
    setTraitement(null);
    if (error) toastError({ title: "Erreur expiration", message: error.message });
    else {
      toastSuccess({ title: "Expiration", message: `Abonnement de ${r.establishments?.name ?? r.establishment_id} expiré (l'établissement et ses données sont conservés).` });
      await charger();
    }
  }

  function exporter() {
    downloadCsv(
      `auto-dyali-abonnements-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Entreprise", "Forfait", "Statut", "Début", "Fin essai", "Échéance", "Résilié le"],
      visibles.map((r) => [
        r.establishments?.name ?? r.establishment_id,
        r.plan_code.toUpperCase(),
        STATUT[r.status] ?? r.status,
        dateFrCourte(r.started_at),
        dateFrCourte(r.trial_ends_at),
        dateFrCourte(r.current_period_end),
        dateFrCourte(r.cancelled_at),
      ])
    );
  }

  return (
    <ModulePage titre="Abonnements">
      <ModuleHeader
        surtitre="AUTO DYALI · Cycle de vie"
        titre="Abonnements & renouvellements"
        description="Vue réelle des abonnements (essai, actif, en retard, suspendu, expiré, résilié). Les transitions de cycle de vie passent par les RPC journalisées (0026)."
        action={
          <>
            <Link href="/super-admin/entreprises/" className="rounded-lg border border-[#8FB59B]/40 px-4 py-2 text-sm text-[#DFE7E2] hover:bg-[#344440]">Gérer les forfaits</Link>
            <button type="button" onClick={exporter} className="rounded-lg border border-[#8FB59B]/40 px-4 py-2 text-sm text-[#DFE7E2] hover:bg-[#344440]">Exporter CSV</button>
          </>
        }
      />

      {/* Compteurs réels */}
      <section className="mt-6 grid gap-3 grid-cols-2 sm:grid-cols-4 lg:grid-cols-7">
        {Object.entries(STATUT).map(([cle, label]) => (
          <button key={cle} type="button" onClick={() => setFiltreStatut(filtreStatut === cle ? "tous" : cle)} className={`carte-premium p-3 text-center transition ${filtreStatut === cle ? "ring-2 ring-[#8FB59B]" : ""}`}>
            <p className="titre-or text-xl font-extrabold">{compteurs[cle] ?? 0}</p>
            <p className="mt-1 text-[10px] uppercase tracking-wide text-[#A7B7A8]">{label}</p>
          </button>
        ))}
      </section>
      {bientot > 0 && (
        <p className="mt-3 rounded-lg bg-[#D6A34D]/10 px-4 py-2 text-xs text-[#D6A34D]">{bientot} abonnement(s) arrive(nt) à échéance sous 7 jours — action requise depuis Entreprises.</p>
      )}

      <div className="carte-premium mt-4 grid gap-3 p-4 sm:grid-cols-3">
        <label className="text-xs text-[#A7B7A8] sm:col-span-2">
          Recherche
          <input type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Entreprise, forfait…" className="champ mt-1 min-h-11 w-full" aria-label="Rechercher un abonnement" />
        </label>
        <label className="text-xs text-[#A7B7A8]">
          Filtre actif
          <select value={filtreStatut} onChange={(e) => setFiltreStatut(e.target.value)} className="champ mt-1 min-h-11 w-full">
            <option value="tous">Tous les statuts</option>
            {Object.entries(STATUT).map(([cle, label]) => <option key={cle} value={cle}>{label}</option>)}
          </select>
        </label>
      </div>

      {erreur && <div className="mt-4"><Erreur message={erreur} /></div>}

      {loading ? (
        <div className="mt-6"><Chargement /></div>
      ) : visibles.length === 0 ? (
        <div className="mt-6"><Vide titre="Aucun abonnement" detail={filtreStatut !== "tous" ? "Aucun abonnement dans ce statut." : "Aucun abonnement enregistré."} /></div>
      ) : (
        <div className="carte mt-6 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="bg-[#344440]/50 text-xs uppercase text-[#A7B7A8]">
                <tr><th className="px-5 py-3">Entreprise</th><th className="px-5 py-3">Forfait</th><th className="px-5 py-3">Statut</th><th className="px-5 py-3">Échéance</th><th className="px-5 py-3">Inscrit le</th><th className="px-5 py-3">Actions</th></tr>
              </thead>
              <tbody className="divide-y divide-[#8FB59B]/10">
                {visibles.map((r) => (
                  <tr key={r.id}>
                    <td className="px-5 py-4"><p className="font-semibold">{r.establishments?.name ?? "—"}</p><p className="text-[11px] text-[#A7B7A8]">{r.establishments?.slug}</p></td>
                    <td className="px-5 py-4 uppercase">{r.plan_code}</td>
                    <td className="px-5 py-4">{STATUT[r.status] ?? r.status}</td>
                    <td className="px-5 py-4 text-[#A7B7A8]">{dateFrCourte(r.current_period_end ?? r.trial_ends_at)}</td>
                    <td className="px-5 py-4 text-[#A7B7A8]">{dateFrCourte(r.created_at)}</td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-2">
                        {CHAMPS_RENDELLE.includes(r.status as (typeof CHAMPS_RENDELLE)[number]) && (
                          <button type="button" disabled={traitement !== null} onClick={() => void renouveler(r)} className="rounded-lg border border-[#8FB59B]/40 px-3 py-1.5 text-xs text-[#E8ECE8] hover:bg-[#344440] disabled:opacity-60">
                            {traitement === `renew-${r.establishment_id}` ? "Renouvellement…" : "Renouveler"}
                          </button>
                        )}
                        {r.status === "suspended" && (
                          <button type="button" disabled={traitement !== null} onClick={() => void reactiver(r)} className="rounded-lg border border-[#D6A34D]/40 px-3 py-1.5 text-xs text-[#E8ECE8] hover:bg-[#344440] disabled:opacity-60">
                            {traitement === `reactivate-${r.establishment_id}` ? "Réactivation…" : "Réactiver"}
                          </button>
                        )}
                        {r.status === "active" && (
                          <button type="button" disabled={traitement !== null} onClick={() => void expirer(r)} className="rounded-lg border border-[#C5716B]/40 px-3 py-1.5 text-xs text-[#E8ECE8] hover:bg-[#344440] disabled:opacity-60">
                            {traitement === `expire-${r.establishment_id}` ? "Expiration…" : "Expirer"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </ModulePage>
  );
}
