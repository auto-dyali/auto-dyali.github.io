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
import { useNotification } from "@/lib/use-notification";
import { AbonneActionsMenu, type AbonneAction } from "@/components/super-admin-actions-menu";
import { AbonneWorkspace, type AbonneRow, type Espace } from "@/components/abonne-workspace";

type Sub = { status: string | null; plan_code: string | null; trial_ends_at: string | null; current_period_end: string | null };
type ManagerRow = {
  id: string;
  full_name: string | null;
  login_id?: string | null;
  role: string | null;
  is_active: boolean | null;
};
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
  archived_at?: string | null;
  professional_id?: string | null;
  legal_name?: string | null;
  activity_type?: string | null;
  region?: string | null;
  subscriptions: Sub[] | null;
  profiles?: ManagerRow[] | null;
};

/**
 * Identités affichées dans le dossier abonné (GV5 §51).
 * `*` est volontaire : la page reste lisible avant l'application de la
 * migration 0039 (les colonnes d'identité sont alors simplement absentes),
 * au lieu de casser toute la liste.
 */
function managerOf(row: Row): ManagerRow | null {
  const managers = (row.profiles ?? []).filter((p) => p.role === "manager");
  return managers[0] ?? null;
}

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
  const [filtreEtat, setFiltreEtat] = useState<"tous" | "actifs" | "suspendus" | "archives">("tous");
  const [filtrePlan, setFiltrePlan] = useState<string>("tous");
  const [traitement, setTraitement] = useState<string | null>(null);
  const [selection, setSelection] = useState<Row | null>(null);
  const [espace, setEspace] = useState<Espace>("etablissement");
  const [openEditMode, setOpenEditMode] = useState<Espace | null>(null);
  const { success: toastSuccess, error: toastError } = useNotification();

  useEffect(() => {
    void charger();
  }, []);

  async function charger() {
    if (!supabase) return;
    setLoading(true);
    setErreur(null);
    let { data, error } = await supabase
      .from("establishments")
      .select("*, subscriptions(status, plan_code, trial_ends_at, current_period_end), profiles(*)")
      .order("created_at", { ascending: false });
    if (error) {
      // Repli si l'embed `profiles` est refusé (RLS/policy absente).
      const repli = await supabase
        .from("establishments")
        .select("*, subscriptions(status, plan_code, trial_ends_at, current_period_end)")
        .order("created_at", { ascending: false });
      data = repli.data;
      error = repli.error;
    }
    if (error) setErreur(error.message);
    else setRows((data ?? []) as unknown as Row[]);
    setLoading(false);
  }

  const visibles = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return rows.filter((r) => {
      if (filtreEtat === "archives") {
        if (!r.archived_at) return false;
      } else {
        // Par défaut, les abonnés archivés sont consultables via le filtre
        // dédié et ne polluent pas la liste opérationnelle.
        if (r.archived_at) return false;
        if (filtreEtat === "actifs" && !r.is_active) return false;
        if (filtreEtat === "suspendus" && r.is_active) return false;
      }
      if (filtrePlan !== "tous" && r.plan !== filtrePlan) return false;
      if (!q) return true;
      return [r.name, r.slug, r.city, r.phone, r.email, r.plan, r.professional_id ?? "", managerOf(r)?.login_id ?? ""]
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
    if (error) toastError({ title: "Erreur suspension", message: error.message });
    else toastSuccess({ title: "Établissement mis à jour", message: row.is_active ? `« ${row.name} » suspendue (données conservées).` : `« ${row.name} » réactivée.` });
    await charger();
    setTraitement(null);
  }

  async function changerPlan(row: Row, plan: string) {
    if (!supabase) return;
    setTraitement(row.id);
    setNotice(null);
    setErreur(null);
    const { error } = await supabase.rpc("admin_change_plan", { p_establishment_id: row.id, p_plan: plan });
    if (error) toastError({ title: "Erreur changement de forfait", message: error.message });
    else toastSuccess({ title: "Forfait mis à jour", message: `Forfait de « ${row.name} » mis à jour et journalisé.` });
    await charger();
    setTraitement(null);
  }

  async function archiver(row: Row, archive: boolean) {
    if (!supabase) return;
    if (!window.confirm(archive ? `Archiver « ${row.name} » ? Les données sont conservées et l'action est journalisée.` : `Restaurer « ${row.name} » ?`)) return;
    setTraitement(row.id);
    setErreur(null);
    const { error } = await supabase.rpc("admin_archive_establishment", { p_id: row.id, p_archive: archive });
    if (error) toastError({ title: archive ? "Erreur archivage" : "Erreur restauration", message: error.message });
    else toastSuccess({ title: archive ? "Abonné archivé" : "Abonné restauré", message: `« ${row.name} » ${archive ? "archivé" : "restauré"} (données conservées, journalisé).` });
    await charger();
    setTraitement(null);
  }

  async function renouveler(row: Row) {
    if (!supabase) return;
    if (!window.confirm(`Renouveler l'abonnement de « ${row.name} » pour 12 mois ?`)) return;
    setTraitement(row.id);
    setErreur(null);
    const { error } = await supabase.rpc("admin_renew_subscription", { p_establishment_id: row.id, p_months: 12 });
    if (error) toastError({ title: "Erreur renouvellement", message: error.message });
    else toastSuccess({ title: "Abonnement renouvelé", message: `« ${row.name} » renouvelé de 12 mois (journalisé).` });
    await charger();
    setTraitement(null);
  }

  function ouvrirFiche(row: Row, espaceInitial: Espace = "etablissement", openEditMode: Espace | null = null) {
    setSelection(row);
    setEspace(espaceInitial);
    setOpenEditMode(openEditMode);
  }

  function dispatchAction(row: Row, a: AbonneAction) {
    switch (a) {
      case "consulter": ouvrirFiche(row, "etablissement"); break;
      case "modifier": ouvrirFiche(row, "etablissement", "etablissement"); break;
      case "identifiants": ouvrirFiche(row, "manager", "manager"); break;
      case "renouveler": void renouveler(row); break;
      case "suspendre": void basculer(row); break;
      case "reactiver": void basculer(row); break;
      case "archiver": void archiver(row, true); break;
      case "restaurer": void archiver(row, false); break;
      case "supprimer": void supprimerDefinitivement(row); break;
    }
  }

  function actionsPour(r: Row): AbonneAction[] {
    const base: AbonneAction[] = ["consulter", "modifier", "identifiants", "renouveler"];
    if (r.is_active) base.push("suspendre"); else base.push("reactiver");
    if (r.archived_at) base.push("restaurer"); else base.push("archiver");
    // La suppression définitive n'est proposée qu'après archivage : la RPC
    // refuse toute donnée métier résiduelle et conserve l'audit.
    if (r.archived_at) base.push("supprimer");
    return base;
  }

  async function supprimerDefinitivement(row: Row) {
    if (!supabase) return;
    const ok = window.confirm(
      `SUPPRESSION DÉFINITIVE de « ${row.name} ».\n\n` +
      "Cette opération est irréversible. Les données métier et l'historique d'audit sont conservés. " +
      "Confirmez-vous après avoir vérifié les dépendances ?",
    );
    if (!ok) return;
    setTraitement(row.id);
    const { data, error } = await supabase.rpc("admin_purge_establishment", { p_id: row.id });
    setTraitement(null);
    if (error) {
      toastError({ title: "Suppression refusée", message: error.message });
    } else {
      toastSuccess({
        title: "Compte supprimé",
        message: `« ${row.name} » supprimé définitivement ; audit conservé (${String((data as { comptes_supprimes?: number })?.comptes_supprimes ?? 0)} compte(s) d'accès retiré(s)).`,
      });
      await charger();
    }
  }

  function exporter() {
    downloadCsv(
      `auto-dyali-entreprises-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Entreprise", "Identifiant professionnel", "Slug", "Manager", "Identifiant Manager", "Ville", "Téléphone", "Email", "Forfait", "État", "Abonnement", "Inscription"],
      visibles.map((r) => {
        const sub = r.subscriptions?.[0];
        return [
          r.name,
          r.professional_id ?? "",
          r.slug,
          managerOf(r)?.full_name ?? "",
          managerOf(r)?.login_id ?? "",
          r.city,
          r.phone,
          r.email,
          r.plan.toUpperCase(),
          r.archived_at ? "Archivé" : r.is_active ? "Actif" : "Suspendu",
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
            <option value="tous">Tous (hors archivés)</option>
            <option value="actifs">Actifs</option>
            <option value="suspendus">Suspendus</option>
            <option value="archives">Archivés</option>
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
                  <th className="px-5 py-3">Manager</th>
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
                        {r.professional_id && (
                          <p className="font-mono text-[11px] text-[#8FB59B]">{r.professional_id}</p>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        {managerOf(r) ? (
                          <>
                            <p className="text-[#E8ECE8]">{managerOf(r)?.full_name ?? "—"}</p>
                            {managerOf(r)?.login_id && (
                              <p className="font-mono text-[11px] text-[#A7B7A8]">{managerOf(r)?.login_id}</p>
                            )}
                          </>
                        ) : (
                          <p className="text-xs text-[#A7B7A8]">Aucun manager associé</p>
                        )}
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
                      <td className={`px-5 py-4 font-semibold ${r.archived_at ? "text-[#D6A34D]" : r.is_active ? "text-[#5D9E7F]" : "text-[#C5716B]"}`}>{r.archived_at ? "Archivé" : r.is_active ? "Actif" : "Suspendu"}</td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {r.archived_at && <span className="rounded-full bg-[#D6A34D]/15 px-2 py-0.5 text-[10px] font-semibold text-[#D6A34D]">Archivé</span>}
                          <AbonneActionsMenu actions={actionsPour(r)} onAction={(a) => dispatchAction(r, a)} disabled={traitement === r.id} label={r.name} />
                          {traitement === r.id && <span className="text-[10px] text-[#A7B7A8]">…</span>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selection && (
        <AbonneWorkspace
          abonne={selection as AbonneRow}
          espace={espace}
          setEspace={setEspace}
          openEditMode={openEditMode}
          onClose={() => { setSelection(null); setOpenEditMode(null); }}
          onSaved={() => void charger()}
        />
      )}
    </ModulePage>
  );
}
