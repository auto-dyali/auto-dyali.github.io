"use client";

import Link from "next/link";
import { ShellApp } from "@/components/shell-app";
import { DashboardKpis } from "@/components/dashboard-kpis";
import { DashboardLive } from "@/components/dashboard-live";
import { CourbeCA, DonutServices } from "@/components/graphiques";
import {
  Icone,
  type NomIcone,
} from "@/components/icones";
import { caMensuel, caParService, raccourcisDashboard } from "@/lib/mock-data";

/**
 * Écran 3 de la maquette — Tableau de bord Manager (Admin).
 * 4 cartes KPI + courbe CA + donut services + véhicules en atelier
 * + raccourcis d'actions rapides.
 */
export default function TableauDeBordPage() {
  const couleurStatut: Record<string, string> = {
    "En cours": "bg-[#d6b66f]/20 text-[#e9d998]",
    "En attente": "bg-[#5b8a8f]/25 text-[#a8bb87]",
    "Planifié": "bg-[#38a987]/20 text-[#38a987]",
  };

  return (
    <ShellApp
      actif="Tableau de bord"
      salutation="Bonjour, Administrateur"
      sousTitre="Garage AUTO DYALI — Agadir"
    >
      {/* KPIs */}
      <section aria-label="Indicateurs clés" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardKpis />
      </section>

      {/* Graphiques + véhicules */}
      <section className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="carte p-5 xl:col-span-6">
          <h2 className="mb-3 text-sm font-bold text-[#f8ecc9]">Évolution du chiffre d&apos;affaires</h2>
          <CourbeCA donnees={caMensuel} />
        </div>

        <div className="carte p-5 xl:col-span-4">
          <h2 className="mb-3 text-sm font-bold text-[#f8ecc9]">CA par service</h2>
          <DonutServices parts={caParService} />
        </div>

        <div className="carte p-5 xl:col-span-2">
          <h2 className="mb-3 text-sm font-bold text-[#f8ecc9]">Véhicules en atelier</h2>
          <DashboardLive couleurStatut={couleurStatut} />
          <Link href="/tableau-de-bord/atelier" className="mt-4 block text-center text-xs text-[#d6b66f] hover:underline">
            Voir l&apos;atelier →
          </Link>
        </div>
      </section>

      {/* Raccourcis d'actions rapides */}
      <section aria-label="Actions rapides" className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
        {raccourcisDashboard.map((r) => (
          <button
            key={r.label}
            type="button"
            onClick={() => { const href = (r as { href?: string }).href; if (href) window.location.assign(href); }}
            className="carte-2 group flex flex-col items-center gap-3 rounded-xl p-6 transition hover:border-[#d6b66f]/40 hover:-translate-y-0.5"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#102b32]">
              <Icone nom={r.icone as NomIcone} taille={28} />
            </span>
            <span className="text-center text-xs font-semibold text-[#f8ecc9]">{r.label}</span>
          </button>
        ))}
      </section>
    </ShellApp>
  );
}
