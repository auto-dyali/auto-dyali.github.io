"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/logo";
import { supabase } from "@/lib/supabase-browser";

/**
 * Pointage employé (§9) — entrée/sortie réelles dans la table attendance.
 * Historique des pointages du jour et cumul des heures déclarées.
 */

type Pointage = {
  id: string;
  clock_in: string;
  clock_out: string | null;
  method: string;
};

const heure = (v: string) => new Date(v).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

export default function PlusPage() {
  const router = useRouter();
  const [employeId, setEmployeId] = useState<string | null>(null);
  const [pointages, setPointages] = useState<Pointage[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [traitement, setTraitement] = useState(false);

  async function charger() {
    if (!supabase) { setChargement(false); return; }
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) { router.replace("/connexion/"); return; }
    const { data: profile } = await supabase.rpc("get_my_profile");
    const establishmentId = profile?.[0]?.establishment_id;
    if (!establishmentId) { setChargement(false); return; }
    const { data: emp } = await supabase
      .from("employees")
      .select("id")
      .eq("profile_id", profile?.[0]?.id)
      .maybeSingle();
    if (!emp) { setChargement(false); return; }
    setEmployeId(emp.id);
    const debutJour = new Date();
    debutJour.setHours(0, 0, 0, 0);
    const { data } = await supabase
      .from("attendance")
      .select("id, clock_in, clock_out, method")
      .eq("employee_id", emp.id)
      .gte("clock_in", debutJour.toISOString())
      .order("clock_in", { ascending: false });
    setPointages((data ?? []) as Pointage[]);
    setChargement(false);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void charger(), 0);
    return () => window.clearTimeout(timer);
    // Rechargement initial unique ; charger() est rappelé après chaque pointage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sessionOuverte = pointages.find((p) => !p.clock_out) ?? null;

  async function pointer(entree: boolean) {
    if (!supabase || !employeId || traitement) return;
    setTraitement(true);
    setErreur(null);
    setNotice(null);
    try {
      const { data: profile } = await supabase.rpc("get_my_profile");
      const establishmentId = profile?.[0]?.establishment_id;
      if (!establishmentId) throw new Error("Établissement introuvable.");

      if (entree) {
        const { error: insertError } = await supabase.from("attendance").insert({
          establishment_id: establishmentId,
          employee_id: employeId,
          method: "manual",
        });
        if (insertError) throw new Error(insertError.message);
        setNotice("Entrée enregistrée. Bonne journée !");
      } else {
        if (!sessionOuverte) throw new Error("Aucune session ouverte.");
        const { error: updateError } = await supabase
          .from("attendance")
          .update({ clock_out: new Date().toISOString() })
          .eq("id", sessionOuverte.id);
        if (updateError) throw new Error(updateError.message);
        setNotice(
          `Sortie enregistrée — session de ${heure(sessionOuverte.clock_in)} à ${heure(new Date().toISOString())}.`,
        );
      }
      await charger();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Pointage impossible.");
    } finally {
      setTraitement(false);
    }
  }

  const heuresDuJour = pointages.reduce((total, p) => {
    if (!p.clock_out) return total;
    return total + (new Date(p.clock_out).getTime() - new Date(p.clock_in).getTime()) / 3_600_000;
  }, 0);

  return (
    <main className="min-h-screen bg-[#102b32] p-5 text-[#f8ecc9]">
      <div className="mx-auto max-w-md">
        <div className="flex items-center justify-between">
          <button type="button" onClick={() => router.replace("/employe/")} className="text-sm text-[#d6b66f]">
            ← Retour
          </button>
          <Logo compact />
        </div>

        <h1 className="titre-or mt-6 text-2xl font-extrabold">Pointage</h1>
        <p className="mt-1 text-sm text-[#a8bb87]">Entrées et sorties réelles de la journée.</p>

        {erreur && <p role="alert" className="mt-4 rounded-lg bg-[#d66868]/15 px-4 py-3 text-sm text-[#d66868]">{erreur}</p>}
        {notice && <p role="status" className="mt-4 rounded-lg bg-[#38a987]/10 px-4 py-3 text-sm text-[#69d3a8]">{notice}</p>}

        <section className="carte mt-5 p-5 text-center">
          {chargement ? (
            <p className="py-6 text-sm text-[#a8bb87]">Chargement…</p>
          ) : sessionOuverte ? (
            <>
              <p className="text-xs text-[#a8bb87]">Session en cours depuis</p>
              <p className="titre-or mt-2 text-4xl font-extrabold">{heure(sessionOuverte.clock_in)}</p>
              <button
                type="button"
                onClick={() => void pointer(false)}
                disabled={traitement}
                className="mt-5 min-h-12 w-full rounded-lg bg-[#d66868] px-5 text-sm font-bold text-white disabled:opacity-40"
              >
                {traitement ? "Enregistrement…" : "Pointer la sortie"}
              </button>
            </>
          ) : (
            <>
              <p className="text-xs text-[#a8bb87]">Aucune session ouverte aujourd’hui</p>
              <button
                type="button"
                onClick={() => void pointer(true)}
                disabled={traitement}
                className="btn-or mt-5 min-h-12 w-full text-sm font-bold disabled:opacity-40"
              >
                {traitement ? "Enregistrement…" : "Pointer l’entrée"}
              </button>
            </>
          )}
        </section>

        <section className="carte mt-5 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold">Sessions du jour</h2>
            <span className="text-xs text-[#a8bb87]">{heuresDuJour.toFixed(1)} h cumulées</span>
          </div>
          <ul className="mt-3 divide-y divide-[#d6b66f]/10">
            {pointages.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2.5 text-sm">
                <span className="text-[#e9d998]">
                  {heure(p.clock_in)} → {p.clock_out ? heure(p.clock_out) : "en cours"}
                </span>
                <span className="text-xs text-[#a8bb87]">
                  {p.clock_out
                    ? `${(((new Date(p.clock_out).getTime() - new Date(p.clock_in).getTime()) / 3_600_000)).toFixed(1)} h`
                    : "…"}
                </span>
              </li>
            ))}
            {!pointages.length && <li className="py-4 text-center text-sm text-[#a8bb87]">Aucun pointage aujourd’hui.</li>}
          </ul>
        </section>
      </div>
    </main>
  );
}
