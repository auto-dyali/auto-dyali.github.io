"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase-browser";

type WorkOrder = {
  id: string;
  reference: string;
  status: string;
  diagnosis: string | null;
  total_amount: number;
  vehicles: { plate: string; brand: string; model: string } | null;
  clients: { full_name: string } | null;
  employees: { full_name: string } | null;
};

const statusLabel: Record<string, string> = { pending: "À faire", in_progress: "En cours", waiting_parts: "Pièces en attente", done: "Terminé", delivered: "Livré", cancelled: "Annulé" };

export function AtelierModule() {
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadOrders() {
    if (!supabase) {
      setError("Supabase n’est pas configuré.");
      setLoading(false);
      return;
    }
    const { data, error: queryError } = await supabase.from("work_orders").select("id, reference, status, diagnosis, total_amount, vehicles(plate, brand, model), clients(full_name), employees(full_name)").order("created_at", { ascending: false });
    if (queryError) setError(queryError.message);
    else setOrders((data ?? []) as unknown as WorkOrder[]);
    setLoading(false);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void loadOrders(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <>
      <div className="mb-6"><p className="text-xs uppercase tracking-[0.2em] text-[#a8bb87]">Production Supabase</p><h1 className="titre-or mt-1 text-2xl font-extrabold">Ordres de réparation</h1><p className="mt-1 text-sm text-[#a8bb87]">Suivi réel des interventions, véhicules et mécaniciens du garage.</p></div>
      {error && <p role="alert" className="mb-4 rounded-lg bg-[#d66868]/15 px-4 py-3 text-sm text-[#d66868]">{error}</p>}
      <section className="carte overflow-hidden">
        {loading ? <p className="p-8 text-center text-sm text-[#a8bb87]">Chargement des ordres…</p> : <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-[#21464b]/50 text-xs uppercase text-[#a8bb87]"><tr><th className="px-4 py-3">Référence</th><th className="px-4 py-3">Client / véhicule</th><th className="px-4 py-3">Diagnostic</th><th className="px-4 py-3">Mécanicien</th><th className="px-4 py-3">État</th></tr></thead><tbody className="divide-y divide-[#d6b66f]/10">{orders.map((order) => <tr key={order.id}><td className="px-4 py-4 font-semibold text-[#e9d998]">{order.reference}</td><td className="px-4 py-4"><p className="text-[#f8ecc9]">{order.clients?.full_name ?? "Client non lié"}</p><p className="text-xs text-[#a8bb87]">{order.vehicles ? `${order.vehicles.brand} ${order.vehicles.model} · ${order.vehicles.plate}` : "Véhicule non lié"}</p></td><td className="max-w-56 px-4 py-4 text-[#f8ecc9]/80">{order.diagnosis ?? "—"}</td><td className="px-4 py-4 text-[#f8ecc9]/80">{order.employees?.full_name ?? "Non affecté"}</td><td className="px-4 py-4"><span className="rounded-full bg-[#21464b] px-3 py-1 text-xs text-[#e9d998]">{statusLabel[order.status] ?? order.status}</span></td></tr>)}</tbody></table>{!orders.length && <p className="p-8 text-center text-sm text-[#a8bb87]">Aucun ordre de réparation enregistré.</p>}</div>}
      </section>
    </>
  );
}
