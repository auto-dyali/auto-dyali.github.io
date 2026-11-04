"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/logo";
import { supabase } from "@/lib/supabase-browser";

export default function EspaceClientPage() {
  const [nom, setNom] = useState("Client AUTO DYALI");
  const router = useRouter();

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      const { data } = await supabase?.auth.getUser() ?? { data: { user: null } };
      const user = data.user;
      if (user?.email) setNom(user.user_metadata?.full_name || user.email);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function logout() {
    await supabase?.auth.signOut();
    router.replace("/connexion/");
  }

  return <main className="min-h-screen bg-[#102b32] text-[#f8ecc9]"><header className="flex items-center justify-between border-b border-[#d6b66f]/15 bg-[#193a40] px-5 py-4 lg:px-10"><Logo compact /><button type="button" onClick={logout} className="text-sm text-[#d6b66f] hover:underline">Déconnexion</button></header><div className="mx-auto max-w-5xl p-5 lg:p-10"><p className="text-xs uppercase tracking-[0.2em] text-[#a8bb87]">Espace client</p><h1 className="titre-or mt-2 text-3xl font-extrabold">Bonjour, {nom}</h1><p className="mt-2 text-sm text-[#a8bb87]">Suivez vos véhicules, interventions et documents depuis votre espace AUTO DYALI.</p><section className="mt-8 grid gap-4 sm:grid-cols-3"><article className="carte p-5"><p className="text-xs text-[#a8bb87]">Mes véhicules</p><p className="titre-or mt-2 text-3xl font-extrabold">—</p></article><article className="carte p-5"><p className="text-xs text-[#a8bb87]">Interventions en cours</p><p className="titre-or mt-2 text-3xl font-extrabold">—</p></article><article className="carte p-5"><p className="text-xs text-[#a8bb87]">Documents disponibles</p><p className="titre-or mt-2 text-3xl font-extrabold">—</p></article></section><section className="carte mt-6 p-6"><h2 className="font-bold">Mon suivi</h2><p className="mt-2 text-sm text-[#a8bb87]">Les rendez-vous, notifications et factures apparaîtront ici dès qu’ils seront associés à votre fiche client.</p></section></div></main>;
}
