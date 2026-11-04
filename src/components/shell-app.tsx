"use client";

import { useState, useEffect, type ReactNode, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/logo";
import { Icone, type NomIcone } from "@/components/icones";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase-browser";

/**
 * Shell de l'application connectée — navigation latérale fidèle à la
 * maquette (14 entrées) + en-tête avec salutation et avatar.
 * Responsive : sidebar rétractable en tiroir sur tablette / smartphone.
 */

const modules: { label: string; icone: NomIcone; href: string }[] = [
  { label: "Tableau de bord", icone: "pos", href: "/tableau-de-bord" },
  { label: "Véhicules", icone: "voiture", href: "/tableau-de-bord/vehicules" },
  { label: "Clients", icone: "client", href: "/tableau-de-bord/clients" },
  { label: "Atelier", icone: "cle", href: "/tableau-de-bord/atelier" },
  { label: "Point de vente", icone: "pos", href: "/tableau-de-bord/point-de-vente" },
  { label: "Stock", icone: "carton", href: "/tableau-de-bord/stock" },
  { label: "Achats", icone: "carton", href: "/tableau-de-bord/achats" },
  { label: "Fournisseurs", icone: "client", href: "/tableau-de-bord/fournisseurs" },
  { label: "Caisse", icone: "ca", href: "/tableau-de-bord/caisse" },
  { label: "Facturation", icone: "rapport", href: "/tableau-de-bord/facturation" },
  { label: "Employés", icone: "profil", href: "/tableau-de-bord/employes" },
  { label: "Planning", icone: "planning", href: "/tableau-de-bord/planning" },
  { label: "Rapports", icone: "rapport", href: "/tableau-de-bord/rapports" },
  { label: "Paramètres", icone: "plus", href: "/tableau-de-bord/parametres" },
];

export function ShellApp({
  actif,
  children: enfants,
  salutation,
  sousTitre,
}: {
  actif: string;
  children: ReactNode;
  salutation: string;
  sousTitre: string;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [aujourdHui, setAujourdHui] = useState("");
  const [heureActuelle, setHeureActuelle] = useState("");
  const [confirmerDeconnexion, setConfirmerDeconnexion] = useState(false);
  const router = useRouter();
  const basePath = process.env.NEXT_PUBLIC_SITE_BASE_PATH ?? "";

  useEffect(() => {
    const formatterDate = new Intl.DateTimeFormat("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    const formatterHeure = new Intl.DateTimeFormat("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const actualiserHorloge = () => {
      const maintenant = new Date();
      setAujourdHui(formatterDate.format(maintenant));
      setHeureActuelle(formatterHeure.format(maintenant));
    };
    actualiserHorloge();
    const intervalle = window.setInterval(actualiserHorloge, 1000);
    return () => window.clearInterval(intervalle);
  }, []);

  async function seDeconnecter() {
    await supabase?.auth.signOut();
    router.replace("/connexion/");
  }

  const actionDeconnexion = (
    <button
      type="button"
      onClick={() => setConfirmerDeconnexion(true)}
      className="mt-auto flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm text-[#d66868] transition hover:bg-[#d66868]/10"
    >
      <Icone nom="deconnexion" taille={18} />
      Déconnexion
    </button>
  );

  const recherche = (e: FormEvent) => {
    e.preventDefault();
    // TODO PHASE 6 : recherche globale branchée sur l'API.
  };

  const nav = (
    <nav className="flex flex-col gap-1 mt-8">
      {modules.map((m) => (
        <Link
          key={m.label}
          href={m.href}
          onClick={() => setOuvert(false)}
          aria-current={actif === m.label ? "page" : undefined}
          className={cn(
            "flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm transition",
            actif === m.label
              ? "bg-[#d6b66f] font-bold text-[#102b32]"
              : "text-[#f8ecc9]/80 hover:bg-[#21464b] hover:text-[#f8ecc9]"
          )}
        >
          <Icone nom={m.icone} taille={18} />
          {m.label}
        </Link>
      ))}
    </nav>
  );

  return (
    <div className="flex min-h-screen bg-[#102b32] bg-cover bg-center bg-fixed" style={{ backgroundImage: `linear-gradient(rgba(16,43,50,.64),rgba(16,43,50,.78)), url('${basePath}/images/backgrounds/dashboard.webp')` }}>
      {/* Sidebar desktop */}
      <aside className="carte hidden w-60 shrink-0 rounded-none border-y-0 border-l-0 lg:flex lg:flex-col p-5 sticky top-0 h-screen overflow-y-auto">
        <Logo compact />
        {nav}
        {actionDeconnexion}
      </aside>

      {/* Tiroir mobile / tablette */}
      {ouvert && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-label="Menu">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOuvert(false)} />
          <aside className="carte absolute top-0 left-0 flex h-full w-64 flex-col rounded-none p-5 overflow-y-auto">
            <div className="flex items-center justify-between">
              <Logo compact />
              <button
                onClick={() => setOuvert(false)}
                aria-label="Fermer le menu"
                className="rounded-lg bg-[#21464b] px-2 py-1 text-[#f8ecc9]"
              >
                ✕
              </button>
            </div>
            {nav}
            {actionDeconnexion}
          </aside>
        </div>
      )}

      {/* Contenu */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* En-tête */}
        <header className="carte sticky top-0 z-30 flex items-center gap-3 rounded-none border-x-0 border-t-0 px-4 py-3 lg:px-7">
          <button
            className="lg:hidden rounded-lg bg-[#21464b] p-2"
            onClick={() => setOuvert(true)}
            aria-label="Ouvrir le menu"
          >
            <svg viewBox="0 0 20 20" width="18" height="18">
              <path d="M3 5h14M3 10h11M3 15h14" stroke="#d6b66f" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-[#f8ecc9]">
              {salutation} <span className="block text-xs font-normal text-[#a8bb87]">{sousTitre}</span>
            </p>
          </div>

          <form onSubmit={recherche} className="hidden md:block">
            <input type="search" placeholder="Rechercher…" className="champ w-56 py-2 text-sm" />
          </form>

          <div className="hidden sm:block text-right text-[11px] leading-tight text-[#a8bb87] capitalize">
            <span>{aujourdHui}</span>
            <span className="mt-0.5 block text-[#e9d998]">{heureActuelle}</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#21464b] text-xs font-bold text-[#e9d998]">
              AD
            </span>
            <span className="hidden text-xs text-[#f8ecc9]">Admin <span className="block text-[10px] text-[#a8bb87]">Super Admin</span></span>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-7">{enfants}</main>
      </div>

      {confirmerDeconnexion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-5" role="dialog" aria-modal="true" aria-labelledby="deconnexion-titre">
          <div className="carte w-full max-w-sm p-6 shadow-2xl">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#d66868]/15"><Icone nom="deconnexion" taille={20} /></span>
              <h2 id="deconnexion-titre" className="font-bold text-[#f8ecc9]">Confirmer la déconnexion</h2>
            </div>
            <p className="mt-4 text-sm leading-6 text-[#a8bb87]">Voulez-vous vraiment quitter votre espace AUTO DYALI ? Votre session sera fermée en toute sécurité.</p>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setConfirmerDeconnexion(false)} className="rounded-lg px-4 py-2 text-sm text-[#a8bb87] hover:bg-[#21464b]">Annuler</button>
              <button type="button" onClick={() => void seDeconnecter()} className="rounded-lg bg-[#d66868] px-4 py-2 text-sm font-bold text-white hover:bg-[#bd5555]">Se déconnecter</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
