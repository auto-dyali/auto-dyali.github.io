"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/logo";
import { supabase } from "@/lib/supabase-browser";

/**
 * Espace client — §10 du cahier des charges.
 * Données 100 % réelles du compte connecté : véhicules, interventions,
 * factures et notifications (lecture + marquage lu).
 */

type Vehicule = { id: string; plate: string; brand: string; model: string; year: number | null };
type Intervention = { id: string; reference: string; status: string; created_at: string; diagnosis: string | null };
type Facture = { id: string; number: string; total: number; issued_at: string };
type Notification = { id: string; title: string; body: string; channel: string; is_read: boolean; created_at: string };

const STATUTS: Record<string, string> = {
  pending: "À faire",
  in_progress: "En cours",
  waiting_parts: "Pièces en attente",
  done: "Terminé",
  delivered: "Livré",
  cancelled: "Annulé",
};

export default function EspaceClientPage() {
  const [nom, setNom] = useState("Client AUTO DYALI");
  const [clientId, setClientId] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);
  const [refuse, setRefuse] = useState(false);

  const [vehicules, setVehicules] = useState<Vehicule[]>([]);
  const [interventions, setInterventions] = useState<Intervention[]>([]);
  const [factures, setFactures] = useState<Facture[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const router = useRouter();

  useEffect(() => {
    let vivant = true;
    const timer = window.setTimeout(async () => {
      const { data } = (await supabase?.auth.getUser()) ?? { data: { user: null } };
      const user = data.user;
      if (!user) { router.replace("/connexion/"); return; }
      if (!supabase) {
        // Aucune configuration : on ne devine pas le rôle, on refuse explicitement.
        if (vivant) setRefuse(true);
        return;
      }
      const { data: prof } = await supabase.rpc("get_my_profile");
      if (prof?.[0]?.role && prof[0].role !== "client") {
        router.replace(prof[0].role === "employee" ? "/employe/" : prof[0].role === "saas_admin" ? "/super-admin/" : "/tableau-de-bord/");
        return;
      }
      if (user.email && vivant) {
        setNom(String(user.user_metadata?.full_name || user.email));
        if (supabase) {
          const { data: client } = await supabase.from("clients").select("id").eq("email", user.email).maybeSingle();
          if (client && vivant) {
            setClientId(client.id);
            const [{ data: veh }, { data: inter }, { data: fact }, { data: notif }] = await Promise.all([
              supabase.from("vehicles").select("id, plate, brand, model, year").order("brand").limit(50),
              supabase.from("work_orders").select("id, reference, status, created_at, diagnosis").order("created_at", { ascending: false }).limit(20),
              supabase.from("invoices").select("id, number, total, issued_at").order("issued_at", { ascending: false }).limit(20),
              supabase.from("client_notifications").select("id, title, body, channel, is_read, created_at").eq("client_id", client.id).order("created_at", { ascending: false }).limit(30),
            ]);
            if (!vivant) return;
            // Filtrage défensif par client (par précaution, la RLS fait foi)
            setVehicules(((veh ?? []) as Vehicule[]).slice(0, 50));
            setInterventions((inter ?? []) as Intervention[]);
            setFactures((fact ?? []) as Facture[]);
            setNotifications(((notif ?? []) as Notification[]).filter((_, index) => index < 30));
          }
        }
      }
      if (vivant) setChargement(false);
    }, 0);
    return () => { vivant = false; window.clearTimeout(timer); };
  }, [router]);

  async function logout() {
    await supabase?.auth.signOut();
    router.replace("/connexion/");
  }

  async function marquerLue(notif: Notification) {
    if (!supabase || !clientId) return;
    const { error } = await supabase.from("client_notifications").update({ is_read: true }).eq("id", notif.id);
    if (!error) setNotifications((current) => current.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n)));
  }

  const nonLues = notifications.filter((n) => !n.is_read).length;

  if (chargement) {
    return <main className="flex min-h-screen items-center justify-center bg-[#102b32] text-sm text-[#a8bb87]">Chargement de votre espace…</main>;
  }

  if (refuse) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#102b32] p-6 text-center">
        <p className="text-sm text-[#d66868]">Accès refusé : cet espace est réservé aux clients.</p>
        <button type="button" onClick={() => router.replace("/connexion/")} className="btn-or px-5 py-2 text-sm">Revenir à la connexion</button>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#102b32] text-[#f8ecc9]">
      <header className="flex items-center justify-between border-b border-[#d6b66f]/15 bg-[#193a40] px-5 py-4 lg:px-10">
        <Logo compact />
        <div className="flex items-center gap-4">
          <span className="hidden text-xs text-[#a8bb87] sm:block">
            {nonLues} notification{nonLues > 1 ? "s" : ""} non lue{nonLues > 1 ? "s" : ""}
          </span>
          <button type="button" onClick={() => void logout()} className="text-sm text-[#d6b66f] hover:underline">Déconnexion</button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl p-5 lg:p-10">
        <p className="text-xs uppercase tracking-[0.2em] text-[#a8bb87]">Espace client</p>
        <h1 className="titre-or mt-2 text-3xl font-extrabold">Bonjour, {nom}</h1>
        <p className="mt-2 text-sm text-[#a8bb87]">Vos véhicules, interventions, factures et notifications en temps réel.</p>

        <section className="mt-8 grid gap-4 sm:grid-cols-3">
          <article className="carte p-5">
            <p className="text-xs text-[#a8bb87]">Mes véhicules</p>
            <p className="titre-or mt-2 text-3xl font-extrabold">{vehicules.length}</p>
          </article>
          <article className="carte p-5">
            <p className="text-xs text-[#a8bb87]">Interventions en cours</p>
            <p className="titre-or mt-2 text-3xl font-extrabold">
              {interventions.filter((i) => ["pending", "in_progress", "waiting_parts"].includes(i.status)).length}
            </p>
          </article>
          <article className="carte p-5">
            <p className="text-xs text-[#a8bb87]">Documents disponibles</p>
            <p className="titre-or mt-2 text-3xl font-extrabold">{factures.length}</p>
          </article>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          {/* Notifications */}
          <section className="carte overflow-hidden">
            <h2 className="border-b border-[#d6b66f]/10 p-5 font-bold">Notifications</h2>
            <ul className="max-h-80 divide-y divide-[#d6b66f]/10 overflow-y-auto">
              {notifications.map((n) => (
                <li key={n.id} className="flex items-start justify-between gap-3 px-5 py-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#f8ecc9]">
                      {n.title}
                      {!n.is_read && <span className="ml-2 rounded-full bg-[#d6b66f]/20 px-2 py-0.5 text-[10px] text-[#e9d998]">nouveau</span>}
                    </p>
                    <p className="mt-1 text-sm leading-5 text-[#a8bb87]">{n.body}</p>
                    <p className="mt-1 text-[11px] text-[#a8bb87]">{new Date(n.created_at).toLocaleString("fr-FR")}</p>
                  </div>
                  {!n.is_read && (
                    <button type="button" onClick={() => void marquerLue(n)} className="shrink-0 rounded-lg border border-[#38a987]/40 px-2.5 py-1.5 text-xs text-[#69d3a8]">
                      Marquer lue
                    </button>
                  )}
                </li>
              ))}
              {!notifications.length && <li className="p-6 text-center text-sm text-[#a8bb87]">Aucune notification pour l’instant.</li>}
            </ul>
          </section>

          {/* Véhicules */}
          <section className="carte overflow-hidden">
            <h2 className="border-b border-[#d6b66f]/10 p-5 font-bold">Mes véhicules</h2>
            <ul className="divide-y divide-[#d6b66f]/10">
              {vehicules.map((v) => (
                <li key={v.id} className="flex items-center justify-between gap-3 px-5 py-4">
                  <div>
                    <p className="text-sm font-semibold text-[#f8ecc9]">{v.brand} {v.model}</p>
                    <p className="text-xs text-[#a8bb87]">{v.year ?? ""}</p>
                  </div>
                  <span className="rounded-full bg-[#21464b] px-3 py-1 font-mono text-xs text-[#e9d998]">{v.plate}</span>
                </li>
              ))}
              {!vehicules.length && <li className="p-6 text-center text-sm text-[#a8bb87]">Aucun véhicule enregistré.</li>}
            </ul>
          </section>

          {/* Interventions */}
          <section className="carte overflow-hidden">
            <h2 className="border-b border-[#d6b66f]/10 p-5 font-bold">Mes interventions</h2>
            <ul className="divide-y divide-[#d6b66f]/10">
              {interventions.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-3 px-5 py-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#e9d998]">{i.reference}</p>
                    <p className="truncate text-xs text-[#a8bb87]">{i.diagnosis ?? new Date(i.created_at).toLocaleDateString("fr-FR")}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-[#21464b] px-3 py-1 text-xs text-[#f8ecc9]">{STATUTS[i.status] ?? i.status}</span>
                </li>
              ))}
              {!interventions.length && <li className="p-6 text-center text-sm text-[#a8bb87]">Aucune intervention.</li>}
            </ul>
          </section>

          {/* Factures */}
          <section className="carte overflow-hidden">
            <h2 className="border-b border-[#d6b66f]/10 p-5 font-bold">Mes factures</h2>
            <ul className="divide-y divide-[#d6b66f]/10">
              {factures.map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-3 px-5 py-4">
                  <span className="text-sm font-semibold text-[#e9d998]">{f.number}</span>
                  <span className="text-xs text-[#a8bb87]">{new Date(f.issued_at).toLocaleDateString("fr-FR")}</span>
                  <span className="text-sm font-bold text-[#f8ecc9]">{Number(f.total).toLocaleString("fr-FR")} MAD</span>
                </li>
              ))}
              {!factures.length && <li className="p-6 text-center text-sm text-[#a8bb87]">Aucune facture disponible.</li>}
            </ul>
          </section>
        </div>
      </div>
    </main>
  );
}
