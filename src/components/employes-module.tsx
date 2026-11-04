"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase-browser";

type Employee = { id: string; code: string; full_name: string; job_title: string; active_permanent: boolean; weekly_hours: number };

export function EmployesModule() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  async function loadEmployees() {
    if (!supabase) { setError("Supabase n’est pas configuré."); setLoading(false); return; }
    const { data, error: queryError } = await supabase.from("employees").select("id, code, full_name, job_title, active_permanent, weekly_hours").order("full_name");
    if (queryError) setError(queryError.message); else setEmployees((data ?? []) as Employee[]);
    setLoading(false);
  }
  useEffect(() => { const timer = window.setTimeout(() => void loadEmployees(), 0); return () => window.clearTimeout(timer); }, []);
  return <><div className="mb-6"><p className="text-xs uppercase tracking-[0.2em] text-[#a8bb87]">Ressources humaines Supabase</p><h1 className="titre-or mt-1 text-2xl font-extrabold">Équipe et permissions</h1><p className="mt-1 text-sm text-[#a8bb87]">Employés rattachés à l’établissement du Manager.</p></div>{error && <p role="alert" className="mb-4 rounded-lg bg-[#d66868]/15 px-4 py-3 text-sm text-[#d66868]">{error}</p>}<section className="carte overflow-hidden">{loading ? <p className="p-8 text-center text-sm text-[#a8bb87]">Chargement de l’équipe…</p> : <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead className="bg-[#21464b]/50 text-xs uppercase text-[#a8bb87]"><tr><th className="px-4 py-3">Employé</th><th className="px-4 py-3">Poste</th><th className="px-4 py-3">Heures/semaine</th><th className="px-4 py-3">État</th></tr></thead><tbody className="divide-y divide-[#d6b66f]/10">{employees.map((employee) => <tr key={employee.id}><td className="px-4 py-4"><p className="font-semibold text-[#f8ecc9]">{employee.full_name}</p><p className="text-xs text-[#a8bb87]">{employee.code}</p></td><td className="px-4 py-4 text-[#f8ecc9]/80">{employee.job_title}</td><td className="px-4 py-4 text-[#f8ecc9]/80">{employee.weekly_hours} h</td><td className="px-4 py-4"><span className="rounded-full bg-[#21464b] px-3 py-1 text-xs text-[#38a987]">{employee.active_permanent ? "Actif" : "Archivé"}</span></td></tr>)}</tbody></table>{!employees.length && <p className="p-8 text-center text-sm text-[#a8bb87]">Aucun employé enregistré.</p>}</div>}</section></>;
}
