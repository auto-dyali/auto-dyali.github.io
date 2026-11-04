"use client";

import Link from "next/link";
import { Logo } from "@/components/logo";
import { Icone, type NomIcone } from "@/components/icones";
import { raccourcisEmploye } from "@/lib/mock-data";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase-browser";

/**
 * Écran 4 de la maquette — Tableau de bord Employé (smartphone d'abord).
 * 4 tuiles rapides, interventions du jour, raccourcis, barre de nav basse.
 */
export default function EmployePage() {
  const statutStyle: Record<string, string> = {
    "En cours": "bg-[#d6b66f]/20 text-[#e9d998]",
    "À faire": "bg-[#38a987]/20 text-[#38a987]",
  };

  const [employee, setEmployee] = useState<{ id: string; full_name: string; job_title: string } | null>(null);
  const [orders, setOrders] = useState<{ id: string; reference: string; status: string; diagnosis: string | null }[]>([]);
  const [appointments, setAppointments] = useState<{ id: string; slot_start: string; status: string }[]>([]);
  const [attendanceCount, setAttendanceCount] = useState(0);
  useEffect(() => { const timer = window.setTimeout(async () => { if (!supabase) return; const { data: profile } = await supabase.rpc("get_my_profile"); const establishmentId = profile?.[0]?.establishment_id; if (!establishmentId) return; const { data: employeeData } = await supabase.from("employees").select("id, full_name, job_title").eq("profile_id", profile?.[0]?.id).maybeSingle(); const emp = employeeData as typeof employee; setEmployee(emp); if (emp) { const [{ data: orderData }, { count }, { data: appointmentData }] = await Promise.all([supabase.from("work_orders").select("id, reference, status, diagnosis").eq("assigned_to", emp.id).order("created_at", { ascending: false }).limit(6), supabase.from("attendance").select("id", { count: "exact", head: true }).eq("employee_id", emp.id), supabase.from("appointments").select("id, slot_start, status").eq("mechanic_id", emp.id).order("slot_start")]); setOrders((orderData ?? []) as typeof orders); setAttendanceCount(count ?? 0); setAppointments((appointmentData ?? []) as typeof appointments); } }, 0); return () => window.clearTimeout(timer); }, []);
  const tuiles = [
    { label: "Mes interventions", valeur: orders.length, icone: "cle" as NomIcone },
    { label: "Pointage", valeur: attendanceCount, icone: "pointage" as NomIcone },
    { label: "Rendez-vous", valeur: appointments.length, icone: "planning" as NomIcone },
    { label: "Tâches", valeur: orders.filter((o) => o.status !== "done").length, icone: "rapport" as NomIcone },
  ];

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-[#102b32] pb-24">
      {/* En-tête */}
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-[#d6b66f]/15 bg-[#102b32]/95 px-4 py-3 backdrop-blur">
        <button aria-label="Ouvrir le menu" className="rounded-lg bg-[#21464b] p-2">
          <svg viewBox="0 0 20 20" width="16" height="16">
            <path d="M3 5h14M3 10h11M3 15h14" stroke="#d6b66f" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
        <Logo compact className="flex-1 items-center" />
        <button aria-label="Notifications" className="relative rounded-lg bg-[#21464b] p-2">
          <Icone nom="cloche" taille={16} />
          <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-[#d66868] text-[9px] font-bold text-[#102b32] leading-3">2</span>
        </button>
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#21464b] text-[10px] font-bold text-[#e9d998]">MM</span>
      </header>

      <div className="flex flex-col gap-4 p-4">
        <div>
          <p className="text-sm font-bold text-[#f8ecc9]">Bonjour {employee?.full_name ?? "Employé"}</p>
          <p className="text-xs text-[#a8bb87]">Voici vos tâches du jour</p>
        </div>

        {/* Tuiles rapides */}
        <section aria-label="Aperçu du jour" className="grid grid-cols-4 gap-2">
          {tuiles.map((t) => (
            <div key={t.label} className="carte-2 flex flex-col items-center gap-1.5 rounded-xl p-3 text-center">
              <Icone nom={t.icone} taille={20} />
              <span className="titre-or text-base font-extrabold">{t.valeur}</span>
              <span className="text-[9px] leading-tight text-[#a8bb87]">{t.label}</span>
            </div>
          ))}
        </section>

        {/* Interventions */}
        <section aria-label="Mes interventions">
          <h2 className="mb-2 text-sm font-bold text-[#f8ecc9]">Mes interventions</h2>
          <ul className="flex flex-col gap-2">{!orders.length && <li className="carte p-4 text-center text-xs text-[#a8bb87]">Aucune intervention assignée.</li>}
            {(orders.length ? orders : []).map((i) => (
              <li key={i.id} className="carte flex items-center gap-3 p-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#21464b]">
                  <Icone nom="voiture" taille={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-[#f8ecc9]">{i.reference} — <span className="font-medium">{i.diagnosis ?? "Intervention atelier"}</span></p>
                  <p className="mt-0.5 text-[11px] text-[#a8bb87]">Ordre de réparation</p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${statutStyle[i.status] ?? "bg-[#38a987]/20 text-[#38a987]"}`}>
                  {i.status}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* Raccourcis */}
        <section aria-label="Raccourcis" className="grid grid-cols-3 gap-2">
          {raccourcisEmploye.map((r) => (
            <button key={r.label} type="button" className="carte-2 flex flex-col items-center gap-2 rounded-xl p-4 transition hover:border-[#d6b66f]/40">
              <Icone nom={r.icone as NomIcone} taille={22} />
              <span className="text-center text-[10px] font-semibold text-[#f8ecc9]">{r.label}</span>
            </button>
          ))}
        </section>
      </div>

      {/* Barre de navigation basse */}
      <nav aria-label="Navigation principale" className="fixed inset-x-0 bottom-0 z-20 mx-auto flex max-w-md items-stretch justify-between border-t border-[#d6b66f]/20 bg-[#193a40] px-4 py-2">
        {[
          { label: "Accueil", icone: "pos" as NomIcone, href: "/employe", actif: true },
          { label: "Interventions", icone: "cle" as NomIcone, href: "/employe#interventions" },
          { label: "Scanner", icone: "barcode" as NomIcone, href: "/employe/scanner" },
          { label: "Plus", icone: "plus" as NomIcone, href: "/employe/plus" },
        ].map((n) => (
          <Link key={n.label} href={n.href}
            className={`flex flex-1 flex-col items-center gap-1 py-1 text-[10px] ${
              n.actif ? "font-bold text-[#e9d998]" : "text-[#a8bb87]"
            }`}>
            <Icone nom={n.icone} taille={18} />
            {n.label}
          </Link>
        ))}
      </nav>
    </main>
  );
}
