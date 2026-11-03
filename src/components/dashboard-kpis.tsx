"use client";

import { useEffect, useState } from "react";
import { CarteKpi } from "@/components/carte-kpi";
import { supabase } from "@/lib/supabase-browser";
import type { NomIcone } from "@/components/icones";

type Kpi = { titre: string; valeur: string; variation: string; positif: boolean; icone: NomIcone; image: string };
const initialKpis: Kpi[] = [
  { titre: "Chiffre d’affaires", valeur: "—", variation: "Chargement Supabase…", positif: true, icone: "ca", image: "/images/kpi/chiffre-affaires.svg" },
  { titre: "Bénéfice net", valeur: "—", variation: "Chargement Supabase…", positif: true, icone: "benefice", image: "/images/kpi/benefice-net.svg" },
  { titre: "Dépenses", valeur: "—", variation: "Chargement Supabase…", positif: false, icone: "depenses", image: "/images/kpi/depenses.svg" },
  { titre: "Interventions", valeur: "—", variation: "Chargement Supabase…", positif: true, icone: "cle", image: "/images/kpi/interventions.svg" },
];

const mad = (value: number) => `${value.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} MAD`;

export function DashboardKpis() {
  const [kpis, setKpis] = useState(initialKpis);

  async function loadKpis() {
    if (!supabase) return;
    const { data: profileRows } = await supabase.rpc("get_my_profile");
    const establishmentId = profileRows?.[0]?.establishment_id;
    if (!establishmentId) return;

    const [salesResult, expensesResult, workOrdersResult] = await Promise.all([
      supabase.from("sales").select("total").eq("establishment_id", establishmentId),
      supabase.from("expenses").select("amount").eq("establishment_id", establishmentId),
      supabase.from("work_orders").select("id", { count: "exact", head: true }).eq("establishment_id", establishmentId),
    ]);
    if (salesResult.error || expensesResult.error || workOrdersResult.error) return;

    const ca = (salesResult.data ?? []).reduce((sum, sale) => sum + Number(sale.total ?? 0), 0);
    const depenses = (expensesResult.data ?? []).reduce((sum, expense) => sum + Number(expense.amount ?? 0), 0);
    const interventions = workOrdersResult.count ?? 0;
    setKpis([
      { ...initialKpis[0], valeur: mad(ca), variation: "Total des ventes Supabase" },
      { ...initialKpis[1], valeur: mad(ca - depenses), variation: "CA moins dépenses" },
      { ...initialKpis[2], valeur: mad(depenses), variation: "Total des dépenses Supabase" },
      { ...initialKpis[3], valeur: String(interventions), variation: "Ordres de réparation" },
    ]);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadKpis();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  return <>{kpis.map((kpi) => <CarteKpi key={kpi.titre} {...kpi} />)}</>;
}
