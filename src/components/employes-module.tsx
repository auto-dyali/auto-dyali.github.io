"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase-browser";
import { formatMad } from "@/lib/catalogue-test";

/**
 * Employés & RH — §9 du cahier des charges.
 * - Liste réelle (code, poste, heures/semaine, état).
 * - Création d’un employé rattaché à l’établissement.
 * - Archivage / réactivation.
 * - Performances : interventions assignées réelles par employé.
 */

type Employee = {
  id: string;
  code: string;
  full_name: string;
  job_title: string;
  active_permanent: boolean;
  weekly_hours: number;
  hired_at: string | null;
};

type Intervention = {
  id: string;
  assigned_to: string | null;
  status: string;
  total_amount: number;
};

export function EmployesModule() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [interventions, setInterventions] = useState<Intervention[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [ouvert, setOuvert] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ code: "", fullName: "", jobTitle: "Mécanicien", weeklyHours: "40" });
  const [filtre, setFiltre] = useState("actifs");

  async function loadEmployees() {
    if (!supabase) { setError("Supabase n’est pas configuré."); setLoading(false); return; }
    const [empReq, interReq] = await Promise.all([
      supabase.from("employees").select("id, code, full_name, job_title, active_permanent, weekly_hours, hired_at").order("full_name"),
      supabase.from("work_orders").select("id, assigned_to, status, total_amount"),
    ]);
    if (empReq.error) setError(empReq.error.message);
    else setEmployees((empReq.data ?? []) as Employee[]);
    if (!interReq.error) setInterventions((interReq.data ?? []) as Intervention[]);
    setLoading(false);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void loadEmployees(), 0);
    return () => window.clearTimeout(timer);
    // Rechargement initial unique.
  }, []);

  /** Statistiques réelles par employé. */
  const stats = useMemo(() => {
    const map = new Map<string, { total: number; termines: number; ca: number }>();
    for (const emp of employees) map.set(emp.id, { total: 0, termines: 0, ca: 0 });
    for (const inter of interventions) {
      if (!inter.assigned_to) continue;
      const entry = map.get(inter.assigned_to);
      if (!entry) continue;
      entry.total += 1;
      if (inter.status === "done" || inter.status === "delivered") entry.termines += 1;
      if (inter.status !== "cancelled") entry.ca += Number(inter.total_amount) || 0;
    }
    return map;
  }, [employees, interventions]);

  const visibles = employees.filter((e) => {
    if (filtre === "actifs") return e.active_permanent;
    if (filtre === "archives") return !e.active_permanent;
    return true;
  });

  const totalHeures = employees.filter((e) => e.active_permanent).reduce((s, e) => s + Number(e.weekly_hours), 0);

  async function basculerActif(employee: Employee) {
    if (!supabase) return;
    const { error: majError } = await supabase
      .from("employees")
      .update({ active_permanent: !employee.active_permanent })
      .eq("id", employee.id);
    if (majError) setError(majError.message);
    else {
      setNotice(
        employee.active_permanent
          ? `${employee.full_name} archivé — son historique est conservé.`
          : `${employee.full_name} réactivé.`,
      );
      await loadEmployees();
    }
  }

  async function creerEmploye(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const { data: profileRows } = await supabase.rpc("get_my_profile");
      const establishmentId = profileRows?.[0]?.establishment_id;
      if (!establishmentId) throw new Error("Établissement introuvable.");
      const { error: insertError } = await supabase.from("employees").insert({
        establishment_id: establishmentId,
        code: form.code.trim(),
        full_name: form.fullName.trim(),
        job_title: form.jobTitle.trim() || "Mécanicien",
        weekly_hours: Number(form.weeklyHours) || 40,
        active_permanent: true,
        hired_at: new Date().toISOString().slice(0, 10),
      });
      if (insertError) throw new Error(insertError.message);
      setNotice(`Employé « ${form.fullName.trim()} » ajouté à l’équipe.`);
      setOuvert(false);
      setForm({ code: "", fullName: "", jobTitle: "Mécanicien", weeklyHours: "40" });
      await loadEmployees();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Création impossible.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-6">
      {/* KPI réels */}
      <div className="grid gap-4 sm:grid-cols-3">
        <article className="carte p-5">
          <p className="text-xs text-[#a8bb87]">Employés actifs</p>
          <p className="titre-or mt-1 text-2xl font-extrabold">{loading ? "…" : employees.filter((e) => e.active_permanent).length}</p>
        </article>
        <article className="carte p-5">
          <p className="text-xs text-[#a8bb87]">Heures contractuelles / semaine</p>
          <p className="titre-or mt-1 text-2xl font-extrabold">{loading ? "…" : `${totalHeures} h`}</p>
        </article>
        <article className="carte p-5">
          <p className="text-xs text-[#a8bb87]">Interventions assignées</p>
          <p className="titre-or mt-1 text-2xl font-extrabold">{loading ? "…" : interventions.filter((i) => i.assigned_to).length}</p>
        </article>
      </div>

      {notice && <p role="status" className="rounded-lg bg-[#38a987]/10 px-4 py-3 text-sm text-[#69d3a8]">{notice}</p>}
      {error && <p role="alert" className="rounded-lg bg-[#d66868]/15 px-4 py-3 text-sm text-[#d66868]">{error}</p>}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[#a8bb87]">Ressources humaines</p>
          <h1 className="titre-or mt-1 text-2xl font-extrabold">Équipe & performances</h1>
          <p className="mt-1 text-sm text-[#a8bb87]">Effectif, interventions assignées et charges horaires.</p>
        </div>
        <button type="button" onClick={() => { setOuvert(true); setError(null); setNotice(null); }} className="btn-or px-5 py-2.5 text-sm">
          + Nouvel employé
        </button>
      </div>

      <div className="flex gap-2">
        {[
          { cle: "actifs", label: "Actifs" },
          { cle: "archives", label: "Archivés" },
          { cle: "tous", label: "Tous" },
        ].map((f) => (
          <button
            key={f.cle}
            type="button"
            onClick={() => setFiltre(f.cle)}
            className={`rounded-lg px-3 py-1.5 text-xs transition ${
              filtre === f.cle ? "bg-[#d6b66f] font-bold text-[#102b32]" : "bg-[#21464b] text-[#d6b66f]"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <section className="carte overflow-hidden">
        {loading ? (
          <p className="p-8 text-center text-sm text-[#a8bb87]">Chargement de l’équipe…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="bg-[#21464b]/50 text-xs uppercase text-[#a8bb87]">
                <tr>
                  <th className="px-5 py-3">Employé</th>
                  <th className="px-5 py-3">Poste</th>
                  <th className="px-5 py-3 text-right">H/Sem</th>
                  <th className="px-5 py-3 text-right">Interventions</th>
                  <th className="px-5 py-3 text-right">Terminées</th>
                  <th className="px-5 py-3 text-right">CA généré</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#d6b66f]/10">
                {visibles.map((e) => {
                  const s = stats.get(e.id) ?? { total: 0, termines: 0, ca: 0 };
                  return (
                    <tr key={e.id}>
                      <td className="px-5 py-4">
                        <p className="font-semibold text-[#f8ecc9]">{e.full_name}</p>
                        <p className="text-[11px] text-[#a8bb87]">
                          {e.code}{e.hired_at ? ` · depuis le ${new Date(e.hired_at).toLocaleDateString("fr-FR")}` : ""}
                        </p>
                      </td>
                      <td className="px-5 py-4 text-[#f8ecc9]/80">{e.job_title}</td>
                      <td className="px-5 py-4 text-right text-[#a8bb87]">{Number(e.weekly_hours)} h</td>
                      <td className="px-5 py-4 text-right text-[#e9d998]">{s.total}</td>
                      <td className="px-5 py-4 text-right text-[#38a987]">{s.termines}</td>
                      <td className="px-5 py-4 text-right font-bold text-[#e9d998]">{formatMad(s.ca)}</td>
                      <td className="px-5 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => void basculerActif(e)}
                          className={`rounded-lg px-3 py-1.5 text-xs ${
                            e.active_permanent
                              ? "border border-[#d66868]/40 text-[#d66868]"
                              : "border border-[#38a987]/40 text-[#69d3a8]"
                          }`}
                        >
                          {e.active_permanent ? "Archiver" : "Réactiver"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!visibles.length && <p className="p-8 text-center text-sm text-[#a8bb87]">Aucun employé dans cette vue.</p>}
          </div>
        )}
      </section>

      {/* Modale création */}
      {ouvert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-5" role="dialog" aria-modal="true" aria-labelledby="nouvel-emp-titre">
          <form onSubmit={(e) => void creerEmploye(e)} className="carte w-full max-w-md p-6">
            <h2 id="nouvel-emp-titre" className="titre-or text-xl font-extrabold">Nouvel employé</h2>
            <div className="mt-5 grid gap-3">
              <input required className="champ" placeholder="Code (ex. EMP-005)" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
              <input required className="champ" placeholder="Nom complet" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
              <select className="champ" value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })}>
                <option>Mécanicien</option>
                <option>Électricien</option>
                <option>Carrossier</option>
                <option>Conseiller service</option>
                <option>Caissier</option>
                <option>Manager</option>
              </select>
              <label className="text-xs text-[#a8bb87]">
                Heures par semaine
                <input type="number" min="1" max="60" step="0.5" className="champ mt-1 min-h-11" value={form.weeklyHours} onChange={(e) => setForm({ ...form, weeklyHours: e.target.value })} />
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setOuvert(false)} className="rounded-lg px-4 py-2 text-sm text-[#a8bb87]">Annuler</button>
              <button disabled={saving} type="submit" className="btn-or px-4 py-2 text-sm">{saving ? "Enregistrement…" : "Enregistrer"}</button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
