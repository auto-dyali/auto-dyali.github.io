"use client";

/**
 * AUTO DYALI — Super Admin › Comptes & Managers
 * Profils `manager` réels, jointure avec le répertoire `clients`
 * (email/code par téléphone), activation/désactivation journalisée.
 */

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase-browser";
import { ModulePage } from "@/components/super-admin-module-page";
import { ModuleHeader, Chargement, Vide, Erreur } from "@/components/super-admin-page";
import { downloadCsv, dateFrCourte } from "@/lib/csv-export";
import { useNotification } from "@/lib/use-notification";

type Manager = {
  id: string;
  full_name: string;
  phone: string | null;
  establishment_id: string | null;
  is_active: boolean;
  created_at: string;
  email: string | null;
  code: string | null;
  establishment_name: string | null;
};

type DirectoryRow = { code: string | null; email: string | null; phone: string | null };

export default function ManagersPage() {
  const [rows, setRows] = useState<Manager[]>([]);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [recherche, setRecherche] = useState("");
  const [filtreEtat, setFiltreEtat] = useState<"tous" | "actifs" | "inactifs">("tous");
  const [traitement, setTraitement] = useState<string | null>(null);
  const { success: notifySuccess, error: notifyError, info: notifyInfo } = useNotification();

  useEffect(() => {
    void charger();
  }, []);

  async function charger() {
    if (!supabase) return;
    setLoading(true);
    setErreur(null);
    const [profiles, etabs, directory] = await Promise.all([
      supabase.from("profiles").select("id, full_name, phone, establishment_id, role, is_active, created_at").eq("role", "manager").order("created_at", { ascending: false }),
      supabase.from("establishments").select("id, name"),
      supabase.from("clients").select("code, email, phone"),
    ]);
    if (profiles.error) {
      notifyError({ title: "Erreur de chargement", message: profiles.error.message });
      setLoading(false);
      return;
    }
    const etabMap = new Map((etabs.data ?? []).map((e) => [(e as { id: string }).id, (e as { name: string }).name]));
    const dirByPhone = new Map<string, DirectoryRow>();
    for (const c of (directory.data ?? []) as DirectoryRow[]) {
      if (c.phone) dirByPhone.set(c.phone, c);
    }
    setRows(
      ((profiles.data ?? []) as Array<Record<string, unknown>>).map((p) => {
        const phone = (p.phone as string | null) ?? null;
        const info = phone ? dirByPhone.get(phone) : undefined;
        const estabId = (p.establishment_id as string | null) ?? null;
        return {
          id: p.id as string,
          full_name: p.full_name as string,
          phone,
          establishment_id: estabId,
          is_active: Boolean(p.is_active),
          created_at: (p.created_at as string) ?? "",
          email: info?.email ?? null,
          code: info?.code ?? null,
          establishment_name: estabId ? etabMap.get(estabId) ?? null : null,
        };
      })
    );
    setLoading(false);
  }

  const visibles = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return rows.filter((r) => {
      if (filtreEtat === "actifs" && !r.is_active) return false;
      if (filtreEtat === "inactifs" && r.is_active) return false;
      if (!q) return true;
      return [r.full_name, r.phone, r.email, r.code, r.establishment_name]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [rows, recherche, filtreEtat]);

  async function basculer(row: Manager) {
    if (!supabase) return;
    setTraitement(row.id);
    setNotice(null);
    setErreur(null);
    const { error } = await supabase.from("profiles").update({ is_active: !row.is_active }).eq("id", row.id);
    if (error) {
      setErreur(`${error.message} (vérifiez la policy profiles / les grants)`);
    } else {
      await supabase.from("audit_log").insert({
        actor_id: (await supabase.auth.getSession()).data.session?.user.id ?? null,
        action: row.is_active ? "deactivate_manager" : "activate_manager",
        entity: "profile",
        entity_id: row.id,
        payload_json: { full_name: row.full_name },
      });
      notifySuccess({ title: "Statut modifié", message: row.is_active ? `« ${row.full_name} » désactivé.` : `« ${row.full_name} » réactivé.` });
      await charger();
    }
    setTraitement(null);
  }

  function exporter() {
    downloadCsv(
      `auto-dyali-managers-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Nom", "Email", "Code client", "Téléphone", "Établissement", "État", "Créé le"],
      visibles.map((r) => [r.full_name, r.email, r.code, r.phone, r.establishment_name, r.is_active ? "Actif" : "Inactif", dateFrCourte(r.created_at)])
    );
  }

  return (
    <ModulePage titre="Comptes & Managers">
      <ModuleHeader
        surtitre="AUTO DYALI · Comptes professionnels"
        titre="Comptes & Managers"
        description="Profils managers réels (rôle manager), email et code retrouvés via le répertoire clients — aucune donnée de session exposée."
        action={<button type="button" onClick={exporter} className="rounded-lg border border-[#8FB59B]/40 px-4 py-2 text-sm text-[#DFE7E2] hover:bg-[#344440]">Exporter CSV</button>}
      />

      <div className="carte-premium mt-6 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs text-[#A7B7A8]">
          Recherche
          <input type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Nom, email, code, téléphone, établissement…" className="champ mt-1 min-h-11 w-full" aria-label="Rechercher un manager" />
        </label>
        <label className="text-xs text-[#A7B7A8]">
          État
          <select value={filtreEtat} onChange={(e) => setFiltreEtat(e.target.value as typeof filtreEtat)} className="champ mt-1 min-h-11">
            <option value="tous">Tous</option>
            <option value="actifs">Actifs</option>
            <option value="inactifs">Inactifs</option>
          </select>
        </label>
        <div className="flex items-end lg:col-span-2">
          <p className="text-xs text-[#A7B7A8]"><span className="text-lg font-extrabold text-[#E8ECE8]">{visibles.length}</span> / {rows.length} managers</p>
        </div>
      </div>

      {notice && <p role="status" className="mt-4 rounded-lg bg-[#5D9E7F]/10 px-4 py-3 text-sm text-[#7FBF9E]">{notice}</p>}
      {erreur && <div className="mt-4"><Erreur message={erreur} /></div>}

      {loading ? (
        <div className="mt-6"><Chargement /></div>
      ) : visibles.length === 0 ? (
        <div className="mt-6"><Vide titre="Aucun manager" detail={recherche ? "Aucun résultat pour cette recherche." : "Aucun profil manager enregistré."} /></div>
      ) : (
        <div className="carte mt-6 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="bg-[#344440]/50 text-xs uppercase text-[#A7B7A8]">
                <tr>
                  <th className="px-5 py-3">Manager</th>
                  <th className="px-5 py-3">Code</th>
                  <th className="px-5 py-3">Établissement</th>
                  <th className="px-5 py-3">État</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#8FB59B]/10">
                {visibles.map((r) => (
                  <tr key={r.id}>
                    <td className="px-5 py-4">
                      <p className="font-semibold">{r.full_name}</p>
                      <p className="text-[11px] text-[#A7B7A8]">{r.email ?? "email non renseigné"} · {r.phone ?? "—"}</p>
                    </td>
                    <td className="px-5 py-4 text-[#A7B7A8]">{r.code ?? "—"}</td>
                    <td className="px-5 py-4 text-[#A7B7A8]">{r.establishment_name ?? "—"}</td>
                    <td className={`px-5 py-4 font-semibold ${r.is_active ? "text-[#5D9E7F]" : "text-[#C5716B]"}`}>{r.is_active ? "Actif" : "Inactif"}</td>
                    <td className="px-5 py-4 text-right">
                      <button type="button" disabled={traitement === r.id} onClick={() => void basculer(r)} className={`rounded-lg border px-3 py-1.5 text-xs ${r.is_active ? "border-[#C5716B]/40 text-[#C5716B] hover:bg-[#C5716B]/10" : "border-[#5D9E7F]/40 text-[#5D9E7F] hover:bg-[#5D9E7F]/10"} disabled:opacity-40`}>
                        {traitement === r.id ? "…" : r.is_active ? "Désactiver" : "Réactiver"}
                      </button>
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
