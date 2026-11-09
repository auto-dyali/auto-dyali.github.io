"use client";

import { ShellApp } from "@/components/shell-app";
import { DashboardKpis } from "@/components/dashboard-kpis";
import { CourbeCAReelle, DonutCAReel } from "@/components/dashboard-graphiques";
import { DashboardHero, DashboardAlertes, DashboardActivite, DashboardAccesRapide } from "@/components/dashboard/dashboard-maquette";
import { MiniPos } from "@/modules/new-pos/mini-pos/mini-pos";

/**
 * Écran 3 de la maquette — Tableau de bord Manager (Admin).
 * 4 cartes KPI + courbe CA + donut services + véhicules en atelier
 * + raccourcis d'actions rapides.
 */
export default function TableauDeBordPage() {
  return (
    <ShellApp
      actif="Tableau de bord" feature="dashboard"
      salutation="Bonjour, Administrateur"
      sousTitre="Vue d’ensemble de votre activité"
    >
      <div className="maquette-dashboard">
        <DashboardHero titre="Tableau de bord" sousTitre="Vue d’ensemble de votre activité — garage AUTO DYALI." />

        {/* KPI — 8 cartes réelles Supabase */}
        <section aria-label="Indicateurs clés" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <DashboardKpis />
        </section>

        {/* Graphiques + alertes */}
        <section aria-label="Graphiques et alertes" className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-12">
          <div className="neon-panel p-5 xl:col-span-5">
            <h2 className="mb-3 text-sm font-extrabold text-[#F2F7F3]">Évolution Financière</h2>
            <CourbeCAReelle />
          </div>

          <div className="neon-panel p-5 xl:col-span-4">
            <h2 className="mb-3 text-sm font-extrabold text-[#F2F7F3]">Répartition des Activités</h2>
            <DonutCAReel />
          </div>

          <div className="xl:col-span-3">
            <DashboardAlertes />
          </div>
        </section>

        {/* Mini-POS + activité + accès rapide */}
        <section aria-label="Mini-POS et activité" className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-12">
          <div id="mini-pos" className="scroll-mt-24 xl:col-span-4">
            <MiniPos />
          </div>
          <div className="xl:col-span-5">
            <DashboardActivite />
          </div>
          <div className="xl:col-span-3">
            <DashboardAccesRapide />
          </div>
        </section>
      </div>
    </ShellApp>
  );
}
