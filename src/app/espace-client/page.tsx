"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/logo";
import { supabase } from "@/lib/supabase-browser";

export default function EspaceClientPage() {
  const [nom, setNom] = useState("Client AUTO DYALI");
  const [stats, setStats] = useState({ vehicles: 0, workOrders: 0, invoices: 0, notifications: 0 });
  const router = useRouter();

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      const { data } = await supabase?.auth.getUser() ?? { data: { user: null } };
      const user = data.user;
      if (user?.email) {
        setNom(user.user_metadata?.full_name || user.email);
        if (supabase) {
          const { data: client } = await supabase.from("clients").select("id").eq("email", user.email).maybeSingle();
          if (client) {
            const [{ count: vehicles }, { count: workOrders }, { count: invoices }, { count: notifications }] = await Promise.all([
              supabase.from("vehicles").select("id", { count: "exact", head: true }).eq("client_id", client.id),
              supabase.from("work_orders").select("id", { count: "exact", head: true }).eq("client_id", client.id).in("status", ["pending", "in_progress", "waiting_parts"]),
              supabase.from("invoices").select("id, sales!inner(client_id)", { count: "exact", head: true }).eq("sales.client_id", client.id),
              supabase.from("client_notifications").select("id", { count: "exact", head: true }).eq("client_id", client.id).eq("is_read", false),
            ]);
            setStats({ vehicles: vehicles ?? 0, workOrders: workOrders ?? 0, invoices: invoices ?? 0, notifications: notifications ?? 0 });
          }
        }
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function logout() {
    await supabase?.auth.signOut();
    router.replace("/connexion/");
  }

  return <main className="min-h-screen bg-[#102b32] text-[#f8ecc9]"><header className="flex items-center justify-between border-b border-[#d6b66f]/15 bg-[#193a40] px-5 py-4 lg:px-10"><Logo compact /><div className="flex items-center gap-4"><span className="hidden text-xs text-[#a8bb87] sm:block">{stats.notifications} notification{stats.notifications > 1 ? "s" : ""}</span><button type="button" onClick={logout} className="text-sm text-[#d6b66f] hover:underline">Déconnexion</button></div></header><div className="mx-auto max-w-5xl p-5 lg:p-10"><p className="text-xs uppercase tracking-[0.2em] text-[#a8bb87]">Espace client</p><h1 className="titre-or mt-2 text-3xl font-extrabold">Bonjour, {nom}</h1><p className="mt-2 text-sm text-[#a8bb87]">Suivez vos véhicules, interventions et documents depuis votre espace AUTO DYALI.</p><section className="mt-8 grid gap-4 sm:grid-cols-3"><article className="carte p-5"><p className="text-xs text-[#a8bb87]">Mes véhicules</p><p className="titre-or mt-2 text-3xl font-extrabold">{stats.vehicles}</p></article><article className="carte p-5"><p className="text-xs text-[#a8bb87]">Interventions en cours</p><p className="titre-or mt-2 text-3xl font-extrabold">{stats.workOrders}</p></article><article className="carte p-5"><p className="text-xs text-[#a8bb87]">Documents disponibles</p><p className="titre-or mt-2 text-3xl font-extrabold">{stats.invoices}</p></article></section><section className="carte mt-6 p-6"><h2 className="font-bold">Mon suivi</h2><p className="mt-2 text-sm text-[#a8bb87]">Les données sont synchronisées avec votre fiche Client AUTO DYALI.</p></section></div></main>;
}
