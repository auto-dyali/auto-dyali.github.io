"use client";

import Link from "next/link";
import { Logo } from "@/components/logo";
import { Icone, type NomIcone } from "@/components/icones";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase-browser";

/**
 * Écran 4 de la maquette — Tableau de bord Employé (smartphone d'abord).
 * 4 tuiles rapides, interventions du jour, raccourcis, barre de nav basse.
 */
export default function EmployePage() {
  const router = useRouter();
  const statutStyle: Record<string, string> = {
    pending: "bg-[#64867B]/25 text-[#A7B7A8]",
    in_progress: "bg-[#8FB59B]/20 text-[#DFE7E2]",
    waiting_parts: "bg-[#8FB59B]/15 text-[#DFE7E2]",
    done: "bg-[#8DA298]/20 text-[#8DA298]",
    delivered: "bg-[#8DA298]/25 text-[#8DA298]",
    cancelled: "bg-[#C5716B]/15 text-[#C5716B]",
  };
  const statutLabel: Record<string, string> = {
    pending: "À faire",
    in_progress: "En cours",
    waiting_parts: "Pièces en attente",
    done: "Terminé",
    delivered: "Livré",
    cancelled: "Annulé",
  };

  const [employee, setEmployee] = useState<{ id: string; full_name: string; job_title: string } | null>(null);
  const [orders, setOrders] = useState<{ id: string; reference: string; status: string; diagnosis: string | null }[]>([]);
  const [appointments, setAppointments] = useState<{ id: string; slot_start: string; status: string }[]>([]);
  const [attendanceCount, setAttendanceCount] = useState(0);
  const [accesRefuse, setAccesRefuse] = useState(false);
  useEffect(() => { const timer = window.setTimeout(async () => { if (!supabase) return; const { data: session } = await supabase.auth.getSession(); if (!session.session) { router.replace("/connexion/"); return; } const { data: profile } = await supabase.rpc("get_my_profile"); if (profile?.[0]?.role && profile[0].role !== "employee" && profile[0].role !== "manager") { setAccesRefuse(true); return; } const establishmentId = profile?.[0]?.establishment_id; if (!establishmentId) return; const { data: employeeData } = await supabase.from("employees").select("id, full_name, job_title").eq("profile_id", profile?.[0]?.id).maybeSingle(); const emp = employeeData as typeof employee; setEmployee(emp); if (emp) { const [{ data: orderData }, { count }, { data: appointmentData }] = await Promise.all([supabase.from("work_orders").select("id, reference, status, diagnosis").eq("assigned_to", emp.id).order("created_at", { ascending: false }).limit(6), supabase.from("attendance").select("id", { count: "exact", head: true }).eq("employee_id", emp.id), supabase.from("appointments").select("id, slot_start, status").eq("mechanic_id", emp.id).order("slot_start")]); setOrders((orderData ?? []) as typeof orders); setAttendanceCount(count ?? 0); setAppointments((appointmentData ?? []) as typeof appointments); } }, 0); return () => window.clearTimeout(timer); }, [router]);
  const tuiles = [
    { label: "Mes interventions", valeur: orders.length, icone: "cle" as NomIcone },
    { label: "Pointage", valeur: attendanceCount, icone: "pointage" as NomIcone },
    { label: "Rendez-vous", valeur: appointments.length, icone: "planning" as NomIcone },
    { label: "Tâches", valeur: orders.filter((o) => o.status !== "done").length, icone: "rapport" as NomIcone },
  ];

  if (accesRefuse) return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#252D2D] p-6 text-center text-[#E8ECE8]">
      <p className="text-sm text-[#C5716B]">Accès refusé : cet espace est réservé aux employés.</p>
      <button type="button" onClick={() => router.replace("/connexion/")} className="btn-or px-5 py-2 text-sm">Revenir à la connexion</button>
    </main>
  );

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-[#252D2D] pb-24">
      {/* En-tête */}
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-[#8FB59B]/15 bg-[#252D2D]/95 px-4 py-3 backdrop-blur">
        <Logo compact className="flex-1 items-center" />
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#344440] text-[10px] font-bold text-[#DFE7E2]">
          {(employee?.full_name ?? "Employé")
            .split(" ")
            .map((mot) => mot[0])
            .slice(0, 2)
            .join("")
            .toUpperCase()}
        </span>
      </header>

      <div className="flex flex-col gap-4 p-4">
        <div>
          <p className="text-sm font-bold text-[#E8ECE8]">Bonjour {employee?.full_name ?? "Employé"}</p>
          <p className="text-xs text-[#A7B7A8]">Voici vos tâches du jour</p>
        </div>

        {/* Tuiles rapides */}
        <section aria-label="Aperçu du jour" className="grid grid-cols-4 gap-2">
          {tuiles.map((t) => (
            <div key={t.label} className="carte-2 flex flex-col items-center gap-1.5 rounded-xl p-3 text-center">
              <Icone nom={t.icone} taille={20} />
              <span className="titre-or text-base font-extrabold">{t.valeur}</span>
              <span className="text-[9px] leading-tight text-[#A7B7A8]">{t.label}</span>
            </div>
          ))}
        </section>

        {/* Interventions */}
        <section aria-label="Mes interventions">
          <h2 className="mb-2 text-sm font-bold text-[#E8ECE8]">Mes interventions</h2>
          <ul className="flex flex-col gap-2">{!orders.length && <li className="carte p-4 text-center text-xs text-[#A7B7A8]">Aucune intervention assignée.</li>}
            {(orders.length ? orders : []).map((i) => (
              <li key={i.id} className="carte flex items-center gap-3 p-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#344440]">
                  <Icone nom="voiture" taille={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-[#E8ECE8]">{i.reference} — <span className="font-medium">{i.diagnosis ?? "Intervention atelier"}</span></p>
                  <p className="mt-0.5 text-[11px] text-[#A7B7A8]">Ordre de réparation</p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${statutStyle[i.status] ?? "bg-[#8DA298]/20 text-[#8DA298]"}`}>
                  {statutLabel[i.status] ?? i.status}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* Raccourcis */}
        <section aria-label="Raccourcis" className="grid grid-cols-3 gap-2">
          {[
            { label: "Scanner produit", icone: "barcode" as NomIcone, href: "/employe/scanner" },
            { label: "Pointage", icone: "pointage" as NomIcone, href: "/employe/plus" },
            { label: "Historique", icone: "historique" as NomIcone, href: "/employe/plus" },
          ].map((r) => (
            <Link key={r.label} href={r.href} className="carte-2 flex flex-col items-center gap-2 rounded-xl p-4 transition hover:border-[#8FB59B]/40">
              <Icone nom={r.icone} taille={22} />
              <span className="text-center text-[10px] font-semibold text-[#E8ECE8]">{r.label}</span>
            </Link>
          ))}
        </section>
      </div>

      {/* Barre de navigation basse */}
      <nav aria-label="Navigation principale" className="fixed inset-x-0 bottom-0 z-20 mx-auto flex max-w-md items-stretch justify-between border-t border-[#8FB59B]/20 bg-[#2C3735] px-4 py-2">
        {[
          { label: "Accueil", icone: "pos" as NomIcone, href: "/employe", actif: true },
          { label: "Interventions", icone: "cle" as NomIcone, href: "/employe#interventions" },
          { label: "Scanner", icone: "barcode" as NomIcone, href: "/employe/scanner" },
          { label: "Plus", icone: "plus" as NomIcone, href: "/employe/plus" },
        ].map((n) => (
          <Link key={n.label} href={n.href}
            className={`flex flex-1 flex-col items-center gap-1 py-1 text-[10px] ${
              n.actif ? "font-bold text-[#DFE7E2]" : "text-[#A7B7A8]"
            }`}>
            <Icone nom={n.icone} taille={18} />
            {n.label}
          </Link>
        ))}
      </nav>
    </main>
  );
}
