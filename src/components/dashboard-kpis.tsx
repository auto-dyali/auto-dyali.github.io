"use client";

import { useEffect, useState } from "react";
import { CarteKpi } from "@/components/carte-kpi";
import { supabase } from "@/lib/supabase-browser";
import type { NomIcone } from "@/components/icones";

type Kpi = { titre: string; valeur: string; variation: string; positif: boolean; icone: NomIcone; image?: string };
const initialKpis: Kpi[] = [
  { titre: "Chiffre d'affaires", valeur: "—", variation: "Chargement Supabase…", positif: true, icone: "ca", image: "/images/kpi/chiffre-affaires.svg" },
  { titre: "Bénéfice net", valeur: "—", variation: "Chargement Supabase…", positif: true, icone: "benefice", image: "/images/kpi/benefice-net.svg" },
  { titre: "Dépenses", valeur: "—", variation: "Chargement Supabase…", positif: false, icone: "depenses", image: "/images/kpi/depenses.svg" },
  { titre: "Interventions en cours", valeur: "—", variation: "Chargement Supabase…", positif: true, icone: "cle", image: "/images/kpi/interventions.svg" },
  { titre: "Ventes", valeur: "—", variation: "Chargement Supabase…", positif: true, icone: "pos" },
  { titre: "Valeur du stock", valeur: "—", variation: "Chargement Supabase…", positif: true, icone: "carton" },
  { titre: "Créances clients", valeur: "—", variation: "Chargement Supabase…", positif: false, icone: "client" },
  { titre: "Trésorerie", valeur: "—", variation: "Chargement Supabase…", positif: true, icone: "ca" },
];

const mad = (value: number) => `${value.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} MAD`;

export function DashboardKpis() {
  const [kpis, setKpis] = useState(initialKpis);

  async function loadKpis() {
    if (!supabase) return;
    const { data: profileRows } = await supabase.rpc("get_my_profile");
    const establishmentId = profileRows?.[0]?.establishment_id;
    if (!establishmentId) return;

    const [salesResult, expensesResult, workOrdersResult, productsResult, clientsResult] = await Promise.all([
      supabase.from("sales").select("total, paid_total").eq("establishment_id", establishmentId),
      supabase.from("expenses").select("amount").eq("establishment_id", establishmentId),
      supabase.from("work_orders").select("id", { count: "exact", head: true }).eq("establishment_id", establishmentId).in("status", ["pending", "in_progress", "waiting_parts"]),
      supabase.from("products").select("stock, purchase_price").eq("establishment_id", establishmentId).eq("is_active", true),
      supabase.from("clients").select("balance_due").eq("establishment_id", establishmentId),
    ]);
    if (salesResult.error || expensesResult.error || workOrdersResult.error) return;

    const ca = (salesResult.data ?? []).reduce((sum, sale) => sum + Number(sale.total ?? 0), 0);
    const encaisse = (salesResult.data ?? []).reduce((sum, sale) => sum + Number(sale.paid_total ?? 0), 0);
    const depenses = (expensesResult.data ?? []).reduce((sum, expense) => sum + Number(expense.amount ?? 0), 0);
    const ventes = (salesResult.data ?? []).length;
    const interventions = workOrdersResult.count ?? 0;
    const stock = productsResult.error ? 0 : (productsResult.data ?? []).reduce((sum, p) => sum + Number(p.stock ?? 0) * Number(p.purchase_price ?? 0), 0);
    const creances = clientsResult.error ? 0 : (clientsResult.data ?? []).reduce((sum, c) => sum + Number(c.balance_due ?? 0), 0);
    setKpis([
      { ...initialKpis[0], valeur: mad(ca), variation: "Total des ventes Supabase" },
      { ...initialKpis[1], valeur: mad(ca - depenses), variation: "CA moins dépenses" },
      { ...initialKpis[2], valeur: mad(depenses), variation: "Total des dépenses Supabase" },
      { ...initialKpis[3], valeur: String(interventions), variation: "Ordres en cours" },
      { ...initialKpis[4], valeur: String(ventes), variation: "Ventes enregistrées" },
      { ...initialKpis[5], valeur: mad(stock), variation: "Stock × prix d'achat" },
      { ...initialKpis[6], valeur: mad(creances), variation: "Soldes clients (balance_due)" },
      { ...initialKpis[7], valeur: mad(encaisse - depenses), variation: "Encaissé moins dépenses" },
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
