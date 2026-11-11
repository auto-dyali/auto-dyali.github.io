"use client";

import { useEffect, useState } from "react";
import { CarteKpi } from "@/components/carte-kpi";
import { supabase } from "@/lib/supabase-browser";
import type { NomIcone } from "@/components/icones";

type Kpi = { titre: string; valeur: string; variation: string; positif: boolean; icone: NomIcone; image?: string };
const initialKpis: Kpi[] = [
  { titre: "Chiffre d'affaires", valeur: "—", variation: "Chargement Supabase…", positif: true, icone: "ca", image: "/images/kpi/chiffre-affaires.svg" },
  { titre: "Résultat intermédiaire", valeur: "—", variation: "Coût des marchandises manquant", positif: true, icone: "benefice", image: "/images/kpi/benefice-net.svg" },
  { titre: "Dépenses", valeur: "—", variation: "Chargement Supabase…", positif: false, icone: "depenses", image: "/images/kpi/depenses.svg" },
  { titre: "Interventions en cours", valeur: "—", variation: "Chargement Supabase…", positif: true, icone: "cle", image: "/images/kpi/interventions.svg" },
  { titre: "Ventes", valeur: "—", variation: "Chargement Supabase…", positif: true, icone: "pos" },
  { titre: "Valeur du stock", valeur: "—", variation: "Chargement Supabase…", positif: true, icone: "carton" },
  { titre: "Créances clients", valeur: "—", variation: "Chargement Supabase…", positif: false, icone: "client" },
  { titre: "Trésorerie", valeur: "—", variation: "Chargement Supabase…", positif: true, icone: "ca" },
];

const mad = (value: number) => `${value.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} MAD`;

type KpisState = {
  kpis: Kpi[];
  loading: boolean;
  error: string | null;
};

export function DashboardKpis() {
  const [state, setState] = useState<KpisState>({
    kpis: initialKpis,
    loading: true,
    error: null,
  });

  async function loadKpis() {
    setState({ kpis: initialKpis, loading: true, error: null });
    if (!supabase) {
      setState({ kpis: initialKpis, loading: false, error: "Supabase non configuré." });
      return;
    }
    try {
      const { data: profileRows } = await supabase.rpc("get_my_profile");
      const establishmentId = profileRows?.[0]?.establishment_id;
      if (!establishmentId) {
        setState({ kpis: initialKpis, loading: false, error: "Profil incomplet — Établissement non configuré." });
        return;
      }

      const [salesResult, expensesResult, workOrdersResult, productsResult, clientsResult] = await Promise.all([
        supabase.from("sales").select("total, paid_total").eq("establishment_id", establishmentId),
        supabase.from("expenses").select("amount").eq("establishment_id", establishmentId),
        supabase.from("work_orders").select("id", { count: "exact", head: true }).eq("establishment_id", establishmentId).in("status", ["pending", "in_progress", "waiting_parts"]),
        supabase.from("products").select("stock, purchase_price").eq("establishment_id", establishmentId).eq("is_active", true),
        supabase.from("clients").select("balance_due").eq("establishment_id", establishmentId),
      ]);
      if (salesResult.error || expensesResult.error || workOrdersResult.error) {
        throw new Error(salesResult.error?.message || expensesResult.error?.message || workOrdersResult.error?.message);
      }

      const ca = (salesResult.data ?? []).reduce((sum, sale) => sum + Number(sale.total ?? 0), 0);
      const encaisse = (salesResult.data ?? []).reduce((sum, sale) => sum + Number(sale.paid_total ?? 0), 0);
      const depenses = (expensesResult.data ?? []).reduce((sum, expense) => sum + Number(expense.amount ?? 0), 0);
      const ventes = (salesResult.data ?? []).length;
      const interventions = workOrdersResult.count ?? 0;
      const stock = productsResult.error ? 0 : (productsResult.data ?? []).reduce((sum, p) => sum + Number(p.stock ?? 0) * Number(p.purchase_price ?? 0), 0);
      const creances = clientsResult.error ? 0 : (clientsResult.data ?? []).reduce((sum, c) => sum + Number(c.balance_due ?? 0), 0);
      setState({
        kpis: [
          { ...initialKpis[0], valeur: mad(ca), variation: "Total des ventes Supabase" },
          { ...initialKpis[1], valeur: mad(ca - depenses), variation: "CA − dépenses — coût marchandises manquant, pas un bénéfice net" },
          { ...initialKpis[2], valeur: mad(depenses), variation: "Total des dépenses Supabase" },
          { ...initialKpis[3], valeur: String(interventions), variation: "Ordres en cours" },
          { ...initialKpis[4], valeur: String(ventes), variation: "Ventes enregistrées" },
          { ...initialKpis[5], valeur: mad(stock), variation: "Stock × prix d'achat" },
          { ...initialKpis[6], valeur: mad(creances), variation: "Soldes clients (balance_due)" },
          { ...initialKpis[7], valeur: mad(encaisse - depenses), variation: "Encaissé moins dépenses" },
        ],
        loading: false,
        error: null,
      });
    } catch (e) {
      setState({ kpis: initialKpis, loading: false, error: e instanceof Error ? e.message : "Erreur inattendue lors du chargement des KPI." });
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadKpis();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  if (state.loading) {
    return <>{state.kpis.map((kpi) => <CarteKpi key={kpi.titre} {...kpi} />)}</>;
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {state.kpis.map((kpi) => (
        <div key={kpi.titre} className="flex flex-col items-center">
          <CarteKpi
            titre={kpi.titre}
            valeur={kpi.valeur}
            variation={kpi.variation}
            positif={kpi.positif}
            icone={kpi.icone}
            image={kpi.image}
          />
          {/* Message d'erreur ou de profil incomplet */}
          {state.error && <p role="alert" className="mt-2 text-xs text-center text-[#C5716B]">{state.error}</p>}
        </div>
      ))}
    </div>
  );
}