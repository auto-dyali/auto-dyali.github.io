"use client";

/**
 * AUTO DYALI — Super Admin › Comptes & Managers › Employés
 * Profils `employee` réels, jointure avec le répertoire `employees` (code, intitulé de poste).
 * Activation/désactivation journalisée. Création et modification d'employé.
 */

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase-browser";
import { ModulePage } from "@/components/super-admin-module-page";
import { ModuleHeader, Chargement, Vide, Erreur } from "@/components/super-admin-page";
import { downloadCsv, dateFrCourte } from "@/lib/csv-export";
import { useNotification } from "@/lib/use-notification";

type Employee = {
  id: string;
  full_name: string;
  phone: string | null;
  establishment_id: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
  job_title: string | null;
  code: string | null;
  establishment_name: string | null;
};

export default function EmployeesPage() {
  const [rows, setRows] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [recherche, setRecherche] = useState("");
  const [filtreEtat, setFiltreEtat] = useState<"tous" | "actifs" | "inactifs">("tous");
  const [traitement, setTraitement] = useState<string | null>(null);
  const [formOuvert, setFormOuvert] = useState(false);
  const [formMode, setFormMode] = useState<"creer" | "modifier">("creer");
  const [formId, setFormId] = useState<string | null>(null);
  const [formFullName, setFormFullName] = useState("");
  const [formJobTitle, setFormJobTitle] = useState("");
  const [formCode, setFormCode] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formEstablishmentId, setFormEstablishmentId] = useState<string | null>(null);
  const { success: notifySuccess, error: notifyError } = useNotification();

  useEffect(() => {
    void charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function charger() {
    if (!supabase) return;
    setLoading(true);
    setErreur(null);
    const [profiles, etabs, employees] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, phone, establishment_id, role, is_active, created_at")
        .eq("role", "employee")
        .order("created_at", { ascending: false }),
      supabase.from("establishments").select("id, name"),
      supabase.from("employees").select("profile_id, code, job_title"),
    ]);
    if (profiles.error) {
      notifyError({ title: "Erreur de chargement", message: profiles.error.message });
      setLoading(false);
      return;
    }
    const etabMap = new Map((etabs.data ?? []).map((e) => [(e as { id: string }).id, (e as { name: string }).name]));
    const empByProfile = new Map<string, { code: string | null; job_title: string | null }>();
    for (const e of (employees.data ?? []) as Array<{ profile_id: string | null; code: string | null; job_title: string | null }>) {
      if (e.profile_id) empByProfile.set(e.profile_id, { code: e.code ?? null, job_title: e.job_title ?? null });
    }
    setRows(
      ((profiles.data ?? []) as Array<Record<string, unknown>>).map((p) => {
        const emp = empByProfile.get(p.id as string);
        const estabId = (p.establishment_id as string | null) ?? null;
        return {
          id: p.id as string,
          full_name: p.full_name as string,
          phone: (p.phone as string | null) ?? null,
          establishment_id: estabId,
          role: (p.role as string) ?? "employee",
          is_active: Boolean(p.is_active),
          created_at: (p.created_at as string) ?? "",
          job_title: emp?.job_title ?? null,
          code: emp?.code ?? null,
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
      return [r.full_name, r.phone, r.job_title, r.code, r.establishment_name]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [rows, recherche, filtreEtat]);

  async function basculer(row: Employee) {
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
        action: row.is_active ? "deactivate_employee" : "activate_employee",
        entity: "profile",
        entity_id: row.id,
        payload_json: { full_name: row.full_name, job_title: row.job_title },
      });
      notifySuccess({ title: "Statut modifié", message: row.is_active ? `« ${row.full_name} » désactivé.` : `« ${row.full_name} » réactivé.` });
      await charger();
    }
    setTraitement(null);
  }

  async function creerOuModifierEmploye() {
    if (!supabase) return;
    setTraitement(formId ?? "nouveau");
    setErreur(null);

    if (formMode === "creer") {
      // Créer le profil + l'employé
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .insert({
          full_name: formFullName.trim(),
          phone: formPhone.trim() || null,
          establishment_id: formEstablishmentId,
          role: "employee",
          is_active: true,
        })
        .select("id")
        .single();

      if (profileError || !profileData) {
        setErreur(profileError?.message || "Impossible de créer le profil.");
        setTraitement(null);
        return;
      }

      const { error: employeeError } = await supabase.from("employees").insert({
        profile_id: profileData.id,
        code: formCode.trim() || null,
        job_title: formJobTitle.trim() || null,
      });

      if (employeeError) {
        setErreur(employeeError.message);
        setTraitement(null);
        return;
      }

      await supabase.from("audit_log").insert({
        actor_id: (await supabase.auth.getSession()).data.session?.user.id ?? null,
        action: "create_employee",
        entity: "profile",
        entity_id: profileData.id,
        payload_json: { full_name: formFullName.trim(), job_title: formJobTitle.trim() },
      });
      notifySuccess({ title: "Employé créé", message: `« ${formFullName.trim()} » ajouté.` });
    } else {
      // Modifier l'employé existant
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          full_name: formFullName.trim(),
          phone: formPhone.trim() || null,
          establishment_id: formEstablishmentId,
        })
        .eq("id", formId);

      if (profileError) {
        setErreur(profileError.message);
        setTraitement(null);
        return;
      }

      // Mettre à jour ou créer la ligne employée
      const { data: existingEmp } = await supabase
        .from("employees")
        .select("profile_id")
        .eq("profile_id", formId)
        .single();

      if (existingEmp) {
        const { error: empError } = await supabase
          .from("employees")
          .update({ code: formCode.trim() || null, job_title: formJobTitle.trim() || null })
          .eq("profile_id", formId);
        if (empError) {
          setErreur(empError.message);
          setTraitement(null);
          return;
        }
      } else {
        const { error: empError } = await supabase.from("employees").insert({
          profile_id: formId,
          code: formCode.trim() || null,
          job_title: formJobTitle.trim() || null,
        });
        if (empError) {
          setErreur(empError.message);
          setTraitement(null);
          return;
        }
      }

      await supabase.from("audit_log").insert({
        actor_id: (await supabase.auth.getSession()).data.session?.user.id ?? null,
        action: "update_employee",
        entity: "profile",
        entity_id: formId,
        payload_json: { full_name: formFullName.trim(), job_title: formJobTitle.trim() },
      });
      notifySuccess({ title: "Employé modifié", message: `« ${formFullName.trim()} » mis à jour.` });
    }

    setFormOuvert(false);
    resetForm();
    await charger();
  }

  function resetForm() {
    setFormMode("creer");
    setFormId(null);
    setFormFullName("");
    setFormJobTitle("");
    setFormCode("");
    setFormPhone("");
    setFormEstablishmentId(null);
  }

  function ouvrirCreation() {
    setFormMode("creer");
    setFormId(null);
    resetForm();
    setFormOuvert(true);
  }

  function ouvrirModification(row: Employee) {
    setFormMode("modifier");
    setFormId(row.id);
    setFormFullName(row.full_name);
    setFormJobTitle(row.job_title ?? "");
    setFormCode(row.code ?? "");
    setFormPhone(row.phone ?? "");
    setFormEstablishmentId(row.establishment_id);
    setFormOuvert(true);
  }

  function exporter() {
    downloadCsv(
      `auto-dyali-employes-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Nom", "Poste", "Code", "Téléphone", "Établissement", "État", "Créé le"],
      visibles.map((r) => [r.full_name, r.job_title ?? "—", r.code ?? "—", r.phone ?? "—", r.establishment_name ?? "—", r.is_active ? "Actif" : "Inactif", dateFrCourte(r.created_at)])
    );
  }

  return (
    <ModulePage titre="Employés">
      <ModuleHeader
        surtitre="AUTO DYALI · Comptes professionnels"
        titre="Employés"
        description="Profils employés (rôle employee), avec poste et code depuis le répertoire employees — aucune donnée de session exposée."
        action={
          <>
            <button
              type="button"
              onClick={ouvrirCreation}
              className="rounded-lg border border-[#8FB59B]/40 px-4 py-2 text-sm text-[#DFE7E2] hover:bg-[#344440] mr-2"
            >
              Nouvel employé
            </button>
            <button type="button" onClick={exporter} className="rounded-lg border border-[#8FB59B]/40 px-4 py-2 text-sm text-[#DFE7E2] hover:bg-[#344440]">
              Exporter CSV
            </button>
          </>
        }
      />

      <div className="carte-premium mt-6 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs text-[#A7B7A8]">
          Recherche
          <input type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Nom, poste, code, téléphone, établissement…" className="champ mt-1 min-h-11 w-full" aria-label="Rechercher un employé" />
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
          <p className="text-xs text-[#A7B7A8]"><span className="text-lg font-extrabold text-[#E8ECE8]">{visibles.length}</span> / {rows.length} employés</p>
        </div>
      </div>

      {notice && <p role="status" className="mt-4 rounded-lg bg-[#5D9E7F]/10 px-4 py-3 text-sm text-[#7FBF9E]">{notice}</p>}
      {erreur && <div className="mt-4"><Erreur message={erreur} /></div>}

      {loading ? (
        <div className="mt-6"><Chargement /></div>
      ) : visibles.length === 0 ? (
        <div className="mt-6"><Vide titre="Aucun employé" detail={recherche ? "Aucun résultat pour cette recherche." : "Aucun profil employé enregistré."} /></div>
      ) : (
        <div className="carte mt-6 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="bg-[#344440]/50 text-xs uppercase text-[#A7B7A8]">
                <tr>
                  <th className="px-5 py-3">Employé</th>
                  <th className="px-5 py-3">Poste</th>
                  <th className="px-5 py-3">Code</th>
                  <th className="px-5 py-3">Téléphone</th>
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
                      <p className="text-[11px] text-[#A7B7A8]">{r.phone ?? "—"} · {r.establishment_name ?? "—"}</p>
                    </td>
                    <td className="px-5 py-4 text-[#A7B7A8]">{r.job_title ?? "—"}</td>
                    <td className="px-5 py-4 text-[#A7B7A8]">{r.code ?? "—"}</td>
                    <td className="px-5 py-4 text-[#A7B7A8]">{r.phone ?? "—"}</td>
                    <td className="px-5 py-4 text-[#A7B7A8]">{r.establishment_name ?? "—"}</td>
                    <td className={`px-5 py-4 font-semibold ${r.is_active ? "text-[#5D9E7F]" : "text-[#C5716B]"}`}>{r.is_active ? "Actif" : "Inactif"}</td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex gap-1">
                        <button type="button" disabled={traitement === r.id} onClick={() => ouvrirModification(r)} className="rounded-lg border border-[#8FB59B]/40 px-3 py-1 text-xs text-[#8FB59B] hover:bg-[#8FB59B]/10 disabled:opacity-40">
                          Modifier
                        </button>
                        <button type="button" disabled={traitement === r.id} onClick={() => void basculer(r)} className={`rounded-lg border px-3 py-1.5 text-xs ${r.is_active ? "border-[#C5716B]/40 text-[#C5716B] hover:bg-[#C5716B]/10" : "border-[#5D9E7F]/40 text-[#5D9E7F] hover:bg-[#5D9E7F]/10"} disabled:opacity-40`}>
                          {traitement === r.id ? "…" : r.is_active ? "Désactiver" : "Réactiver"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Formulaire création / modification */}
      {formOuvert && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overscroll-contain bg-black/60 p-4" role="dialog" aria-modal="true">
          <div className="carte my-auto w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto bg-[#252D2D]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-[#E8ECE8]">{formMode === "creer" ? "Nouvel employé" : "Modifier l'employé"}</h2>
              <button type="button" onClick={() => { setFormOuvert(false); resetForm(); }} className="text-xs text-[#A7B7A8] hover:text-[#DFE7E2]">Fermer</button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); void creerOuModifierEmploye(); }} className="space-y-4">
              <div>
                <label className="block text-xs text-[#A7B7A8] mb-1">Nom complet</label>
                <input
                  type="text"
                  value={formFullName}
                  onChange={(e) => setFormFullName(e.target.value)}
                  placeholder="Jean Dupont"
                  className="champ w-full"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-[#A7B7A8] mb-1">Poste / intitulé</label>
                <input
                  type="text"
                  value={formJobTitle}
                  onChange={(e) => setFormJobTitle(e.target.value)}
                  placeholder="Mécanicien, Responsable stock…"
                  className="champ w-full"
                />
              </div>
              <div>
                <label className="block text-xs text-[#A7B7A8] mb-1">Code employé</label>
                <input
                  type="text"
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value)}
                  placeholder="EMP-001"
                  className="champ w-full"
                />
              </div>
              <div>
                <label className="block text-xs text-[#A7B7A8] mb-1">Téléphone</label>
                <input
                  type="text"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  placeholder="+212 6 00 00 00 00"
                  className="champ w-full"
                />
              </div>
              <div>
                <label className="block text-xs text-[#A7B7A8] mb-1">Établissement</label>
                <select
                  value={formEstablishmentId ?? ""}
                  onChange={(e) => setFormEstablishmentId(e.target.value || null)}
                  className="champ w-full"
                >
                  <option value="">Aucun établissement</option>
                  {rows.map((r) => r.establishment_name).filter(Boolean).sort().map((name) => (
                    <option key={name} value={rows.find((rr) => rr.establishment_name === name)?.establishment_id ?? ""}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { setFormOuvert(false); resetForm(); }}
                  className="rounded-lg border border-[#8FB59B]/40 px-4 py-2 text-sm text-[#A7B7A8] hover:bg-[#344440]"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={traitement === (formId ?? "nouveau")}
                  className="rounded-lg bg-[#8FB59B] px-4 py-2 text-sm text-[#252D2D] font-bold hover:bg-[#b8c8bf] disabled:opacity-60"
                >
                  {traitement === (formId ?? "nouveau") ? "…" : formMode === "creer" ? "Créer" : "Enregistrer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </ModulePage>
  );
}
