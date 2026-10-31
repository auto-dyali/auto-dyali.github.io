"use client";

import Link from "next/link";
import { Logo } from "@/components/logo";
import { Icone, type NomIcone } from "@/components/icones";
import {
  tachesEmploye,
  interventionsEmploye,
  raccourcisEmploye,
} from "@/lib/mock-data";

/**
 * Écran 4 de la maquette — Tableau de bord Employé (smartphone d'abord).
 * 4 tuiles rapides, interventions du jour, raccourcis, barre de nav basse.
 */
export default function EmployePage() {
  const statutStyle: Record<string, string> = {
    "En cours": "bg-[#d6b66f]/20 text-[#e9d998]",
    "À faire": "bg-[#38a987]/20 text-[#38a987]",
  };

  const tuiles = [
    { label: "Mes interventions", valeur: tachesEmploye.interventions, icone: "cle" as NomIcone },
    { label: "Pointage", valeur: tachesEmploye.pointage, icone: "pointage" as NomIcone },
    { label: "Rendez-vous", valeur: tachesEmploye.rendezVous, icone: "planning" as NomIcone },
    { label: "Tâches", valeur: tachesEmploye.taches, icone: "rapport" as NomIcone },
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
          <p className="text-sm font-bold text-[#f8ecc9]">Bonjour Mohamed</p>
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
          <ul className="flex flex-col gap-2">
            {interventionsEmploye.map((i) => (
              <li key={i.ref} className="carte flex items-center gap-3 p-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#21464b]">
                  <Icone nom="voiture" taille={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-[#f8ecc9]">{i.ref} — <span className="font-medium">{i.travail}</span></p>
                  <p className="mt-0.5 text-[11px] text-[#a8bb87]">{i.heure}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${statutStyle[i.statut]}`}>
                  {i.statut}
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
