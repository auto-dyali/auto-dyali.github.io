"use client";

/**
 * Maquette Dashboard AUTO DYALI — blocs visuels.
 * Les données proviennent de Supabase (aucun chiffre de démonstration
 * présenté comme production). La couche visuelle reprend l'image de
 * référence : néon émeraude/or, hero véhicule, alertes, activité, accès rapide.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { Icone, type NomIcone } from "@/components/icones";
import { supabase } from "@/lib/supabase-browser";

const basePath = process.env.NEXT_PUBLIC_SITE_BASE_PATH ?? "";

export function DashboardHero({ titre, sousTitre }: { titre: string; sousTitre: string }) {
  return (
    <section aria-label="Présentation AUTO DYALI" className="maquette-hero mb-5 p-5 sm:p-8">
      <div
        aria-hidden
        className="maquette-hero__image"
        style={{
          backgroundImage: `url('${basePath}/images/car-premium.jpg')`,
          backgroundSize: "cover",
          backgroundPosition: "center right",
        }}
      />
      <div className="relative z-10 flex min-h-36 flex-col justify-between gap-8 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#F2F7F3] sm:text-4xl">{titre}</h1>
          <p className="mt-2 max-w-xl text-sm text-[#CDE6DA]">{sousTitre}</p>
        </div>
        <div className="text-left sm:text-center">
          <p className="maquette-hero__logo text-3xl font-black italic tracking-tight text-[#EAF6EF] sm:text-4xl">AUTO DYALI</p>
          <p className="maquette-hero__tagline mt-1 text-[10px] font-bold uppercase text-[#A7B7A8]">Performance · Innovation · Confiance</p>
        </div>
      </div>
    </section>
  );
}

type Alerte = {
  id: string;
  titre: string;
  detail: string;
  quand: string;
  icone: NomIcone;
  href: string;
  couleur: string;
};

function heure(date?: string | null): string {
  if (!date) return "—";
  const d = new Date(date);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function DashboardAlertes() {
  const [alertes, setAlertes] = useState<Alerte[]>([]);
  const [chargee, setChargee] = useState(false);

  useEffect(() => {
    let vivant = true;
    const charger = async () => {
      if (!supabase) return;
      const { data: profil } = await supabase.rpc("get_my_profile");
      const establishmentId = profil?.[0]?.establishment_id;
      if (!establishmentId) return;

      const demain = new Date();
      demain.setDate(demain.getDate() + 1);
      const debutDemain = new Date(demain.getFullYear(), demain.getMonth(), demain.getDate());
      const finDemain = new Date(debutDemain);
      finDemain.setDate(finDemain.getDate() + 1);

      const [stockReq, rdvReq, atelierReq] = await Promise.all([
        supabase.from("products").select("id, name, stock, min_stock").eq("establishment_id", establishmentId).eq("is_active", true).order("stock", { ascending: true }).limit(12),
        supabase.from("appointments").select("id, slot_start").eq("establishment_id", establishmentId).gte("slot_start", debutDemain.toISOString()).lt("slot_start", finDemain.toISOString()).order("slot_start"),
        supabase.from("work_orders").select("id, reference, opened_at, vehicles(plate)").eq("establishment_id", establishmentId).in("status", ["pending", "in_progress", "waiting_parts"]).order("opened_at", { ascending: false }).limit(1),
      ]);
      if (!vivant) return;

      const items: Alerte[] = [];
      for (const p of ((stockReq.data ?? []) as { id: string; name: string; stock: number; min_stock: number }[])) {
        if (Number(p.stock ?? 0) <= Number(p.min_stock ?? 0)) {
          items.push({
            id: `stock-${p.id}`,
            titre: "Stock faible",
            detail: `${p.name} (${Number(p.stock ?? 0)} unités restantes)`,
            quand: "Maintenant",
            icone: "carton",
            href: "/tableau-de-bord/stock",
            couleur: "bg-[#C66A68]/20 text-[#F0A8A4]",
          });
          if (items.length >= 2) break;
        }
      }
      const rdvs = (rdvReq.data ?? []) as { id: string; slot_start: string }[];
      if (rdvs.length > 0) {
        items.push({
          id: "rdv-demain",
          titre: "Rendez-vous demain",
          detail: `${rdvs.length} client(s) attendu(s) — premier à ${heure(rdvs[0].slot_start)}`,
          quand: "Demain",
          icone: "planning",
          href: "/tableau-de-bord/planning",
          couleur: "bg-[#D6A34D]/20 text-[#F2D58A]",
        });
      }
      const atelier = (atelierReq.data ?? []) as { id: string; reference: string; opened_at: string; vehicles: { plate: string }[] | null }[];
      if (atelier[0]) {
        items.push({
          id: `atelier-${atelier[0].id}`,
          titre: "Intervention en cours",
          detail: `Véhicule ${atelier[0].vehicles?.[0]?.plate ?? atelier[0].reference} · ${atelier[0].reference}`,
          quand: heure(atelier[0].opened_at),
          icone: "cle",
          href: "/tableau-de-bord/atelier",
          couleur: "bg-[#5B8A8F]/20 text-[#B9DDE8]",
        });
      }
      setAlertes(items);
      setChargee(true);
    };
    const timer = window.setTimeout(() => void charger(), 0);
    return () => {
      vivant = false;
      window.clearTimeout(timer);
    };
  }, []);

  return (
    <section aria-label="Alertes importantes" className="neon-panel flex h-full min-h-72 flex-col p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-extrabold text-[#F2F7F3]">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#D6A34D]/15 text-[#F2D58A]"><Icone nom="cloche" taille={18} /></span>
          Alertes Importantes
        </h2>
        <Link href="/tableau-de-bord/stock" className="text-[11px] font-bold text-[#8dffce] hover:underline">Voir tout →</Link>
      </div>
      {!chargee ? (
        <p className="py-10 text-center text-xs text-[#A7B7A8]">Chargement des alertes…</p>
      ) : alertes.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-10 text-center">
          <span className="h-2.5 w-2.5 rounded-full bg-[#3dffb4] dashboard-alert-dot" aria-hidden />
          <p className="text-sm font-bold text-[#E8ECE8]">Aucune alerte</p>
          <p className="max-w-[240px] text-xs text-[#A7B7A8]">Les alertes stock, rendez-vous et interventions apparaîtront ici dès qu’elles existent.</p>
        </div>
      ) : (
        <ul className="flex flex-1 flex-col gap-3">
          {alertes.map((a) => (
            <li key={a.id}>
              <Link href={a.href} className="flex min-h-16 items-center gap-3 rounded-xl border border-white/5 bg-black/20 px-3 py-2 transition hover:border-[#31ffb0]/35">
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${a.couleur}`}><Icone nom={a.icone} taille={20} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-[#F2F7F3]">{a.titre}</span>
                  <span className="block truncate text-[11px] text-[#A7B7A8]">{a.detail}</span>
                </span>
                <span className="shrink-0 text-[10px] text-[#A7B7A8]">{a.quand}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

type Activite = {
  id: string;
  titre: string;
  detail: string;
  statut: string;
  couleur: string;
};

function libelleStatutVente(s: string): string {
  if (s === "paid") return "Terminée";
  if (s === "partial") return "Partielle";
  if (s === "refunded") return "Remboursée";
  if (s === "cancelled") return "Annulée";
  return "En cours";
}

export function DashboardActivite() {
  const [items, setItems] = useState<Activite[]>([]);
  const [chargee, setChargee] = useState(false);

  useEffect(() => {
    let vivant = true;
    const charger = async () => {
      if (!supabase) return;
      const { data: profil } = await supabase.rpc("get_my_profile");
      const establishmentId = profil?.[0]?.establishment_id;
      if (!establishmentId) return;

      const [ventesReq, atelierReq, achatsReq] = await Promise.all([
        supabase.from("sales").select("id, reference, total, status, created_at").eq("establishment_id", establishmentId).order("created_at", { ascending: false }).limit(5),
        supabase.from("work_orders").select("id, reference, total_amount, status, opened_at").eq("establishment_id", establishmentId).order("opened_at", { ascending: false }).limit(5),
        supabase.from("purchase_orders").select("id, reference, total_amount, status, ordered_at").eq("establishment_id", establishmentId).order("ordered_at", { ascending: false }).limit(5),
      ]);
      if (!vivant) return;

      const liste: (Activite & { date: number })[] = [];
      for (const v of ((ventesReq.data ?? []) as { id: string; reference: string; total: number; status: string; created_at: string }[])) {
        liste.push({
          id: `vente-${v.id}`,
          titre: `Vente #${v.reference}`,
          detail: `${heure(v.created_at)} · ${Number(v.total ?? 0).toLocaleString("fr-FR")} MAD`,
          statut: libelleStatutVente(v.status),
          couleur: v.status === "paid" ? "bg-[#00d084]/20 text-[#8dffce]" : "bg-[#D6A34D]/20 text-[#F2D58A]",
          date: new Date(v.created_at).getTime(),
        });
      }
      for (const o of ((atelierReq.data ?? []) as { id: string; reference: string; total_amount: number; status: string; opened_at: string }[])) {
        liste.push({
          id: `intervention-${o.id}`,
          titre: `Intervention #${o.reference}`,
          detail: `${heure(o.opened_at)} · ${Number(o.total_amount ?? 0).toLocaleString("fr-FR")} MAD`,
          statut: o.status === "delivered" ? "Terminée" : "En cours",
          couleur: "bg-[#5B8A8F]/20 text-[#B9DDE8]",
          date: new Date(o.opened_at).getTime(),
        });
      }
      for (const a of ((achatsReq.data ?? []) as { id: string; reference: string; total_amount: number; status: string; ordered_at: string }[])) {
        liste.push({
          id: `achat-${a.id}`,
          titre: `Achat #${a.reference}`,
          detail: `${a.ordered_at} · ${Number(a.total_amount ?? 0).toLocaleString("fr-FR")} MAD`,
          statut: "Enregistré",
          couleur: "bg-[#9b6bff]/20 text-[#D6C2FF]",
          date: new Date(a.ordered_at).getTime(),
        });
      }
      setItems(liste.sort((a, b) => b.date - a.date).slice(0, 6));
      setChargee(true);
    };
    const timer = window.setTimeout(() => void charger(), 0);
    return () => {
      vivant = false;
      window.clearTimeout(timer);
    };
  }, []);

  return (
    <section aria-label="Activité récente" className="neon-panel flex h-full min-h-72 flex-col p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-extrabold text-[#F2F7F3]">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#31ffb0]/10 text-[#8dffce]"><Icone nom="historique" taille={18} /></span>
          Activité Récente
        </h2>
        <Link href="/tableau-de-bord/historique-ventes" className="text-[11px] font-bold text-[#8dffce] hover:underline">Voir tout →</Link>
      </div>
      {!chargee ? (
        <p className="py-10 text-center text-xs text-[#A7B7A8]">Chargement de l’activité…</p>
      ) : items.length === 0 ? (
        <p className="py-10 text-center text-xs text-[#A7B7A8]">Aucune activité récente — les ventes, interventions et achats s’afficheront ici.</p>
      ) : (
        <ul className="relative flex flex-1 flex-col gap-4 before:absolute before:bottom-2 before:left-[5px] before:top-2 before:w-px before:bg-[#31ffb0]/20">
          {items.map((a) => (
            <li key={a.id} className="relative flex items-start gap-3 pl-6">
              <span className="dashboard-timeline-dot absolute left-0 top-1.5 h-[11px] w-[11px] rounded-full border-2 border-[#07180f] bg-[#3dffb4]" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-[#F2F7F3]">{a.titre}</p>
                <p className="truncate text-[11px] text-[#A7B7A8]">{a.detail}</p>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-extrabold ${a.couleur}`}>{a.statut}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function DashboardAccesRapide() {
  const acces: { label: string; href: string; icone: NomIcone }[] = [
    { label: "Nouvelle Vente", href: "/tableau-de-bord/point-de-vente", icone: "pos" },
    { label: "Nouvelle Intervention", href: "/tableau-de-bord/atelier", icone: "cle" },
    { label: "Gestion Stock", href: "/tableau-de-bord/stock", icone: "carton" },
    { label: "Rapport Financier", href: "/tableau-de-bord/rapports", icone: "rapport" },
    { label: "Planning", href: "/tableau-de-bord/planning", icone: "planning" },
    { label: "Paramètres", href: "/tableau-de-bord/parametres", icone: "profil" },
  ];
  return (
    <section aria-label="Accès Rapide" className="neon-panel neon-panel--gold flex h-full min-h-72 flex-col p-5">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-extrabold text-[#F2F7F3]">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#D6A34D]/15 text-[#F2D58A]"><Icone nom="plus" taille={18} /></span>
        Accès Rapide
      </h2>
      <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-3">
        {acces.map((a) => (
          <Link
            key={a.label}
            href={a.href}
            className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl border border-[#31ffb0]/20 bg-black/25 px-3 py-4 text-center text-xs font-bold text-[#E8ECE8] transition hover:border-[#31ffb0]/45 hover:bg-[#31ffb0]/5"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#D6A34D]/12 text-[#F2D58A]"><Icone nom={a.icone} taille={22} /></span>
            {a.label}
          </Link>
        ))}
      </div>
    </section>
  );
}
