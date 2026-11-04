"use client";

import { useEffect, useState, type FormEvent } from "react";
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
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [vehicles, setVehicles] = useState<{ id: string; plate: string; brand: string; model: string; client_id: string }[]>([]);
  const [clients, setClients] = useState<{ id: string; full_name: string }[]>([]);
  const [form, setForm] = useState({ vehicleId: "", clientId: "", diagnosis: "" });

  async function loadOrders() {
    if (!supabase) {
      setError("Supabase n’est pas configuré.");
      setLoading(false);
      return;
    }
    const { data, error: queryError } = await supabase.from("work_orders").select("id, reference, status, diagnosis, total_amount, vehicles(plate, brand, model), clients(full_name), employees(full_name)").order("created_at", { ascending: false });
    if (queryError) setError(queryError.message);
    else setOrders((data ?? []) as unknown as WorkOrder[]);
    const [{ data: vehicleData }, { data: clientData }] = await Promise.all([
      supabase.from("vehicles").select("id, plate, brand, model, client_id").order("plate"),
      supabase.from("clients").select("id, full_name").order("full_name"),
    ]);
    setVehicles((vehicleData ?? []) as typeof vehicles);
    setClients((clientData ?? []) as typeof clients);
    setLoading(false);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void loadOrders(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function addOrder(event: FormEvent) {
    event.preventDefault();
    if (!supabase || !form.vehicleId || !form.clientId) return;
    setSaving(true); setError(null);
    const { data: profile } = await supabase.rpc("get_my_profile");
    const establishmentId = profile?.[0]?.establishment_id;
    const reference = `OR-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;
    const { error: insertError } = await supabase.from("work_orders").insert({ establishment_id: establishmentId, vehicle_id: form.vehicleId, client_id: form.clientId, reference, diagnosis: form.diagnosis.trim() || null, status: "pending", total_amount: 0 });
    if (insertError) setError(insertError.message); else { setOpen(false); setForm({ vehicleId: "", clientId: "", diagnosis: "" }); await loadOrders(); }
    setSaving(false);
  }

  return (
    <>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs uppercase tracking-[0.2em] text-[#a8bb87]">Production Supabase</p><h1 className="titre-or mt-1 text-2xl font-extrabold">Ordres de réparation</h1><p className="mt-1 text-sm text-[#a8bb87]">Suivi réel des interventions, véhicules et mécaniciens du garage.</p></div><button type="button" onClick={() => setOpen(true)} className="btn-or min-h-11 px-5 text-sm">+ Nouvel ordre</button></div>
      {error && <p role="alert" className="mb-4 rounded-lg bg-[#d66868]/15 px-4 py-3 text-sm text-[#d66868]">{error}</p>}
      <section className="carte overflow-hidden">
        {loading ? <p className="p-8 text-center text-sm text-[#a8bb87]">Chargement des ordres…</p> : <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-[#21464b]/50 text-xs uppercase text-[#a8bb87]"><tr><th className="px-4 py-3">Référence</th><th className="px-4 py-3">Client / véhicule</th><th className="px-4 py-3">Diagnostic</th><th className="px-4 py-3">Mécanicien</th><th className="px-4 py-3">État</th></tr></thead><tbody className="divide-y divide-[#d6b66f]/10">{orders.map((order) => <tr key={order.id}><td className="px-4 py-4 font-semibold text-[#e9d998]">{order.reference}</td><td className="px-4 py-4"><p className="text-[#f8ecc9]">{order.clients?.full_name ?? "Client non lié"}</p><p className="text-xs text-[#a8bb87]">{order.vehicles ? `${order.vehicles.brand} ${order.vehicles.model} · ${order.vehicles.plate}` : "Véhicule non lié"}</p></td><td className="max-w-56 px-4 py-4 text-[#f8ecc9]/80">{order.diagnosis ?? "—"}</td><td className="px-4 py-4 text-[#f8ecc9]/80">{order.employees?.full_name ?? "Non affecté"}</td><td className="px-4 py-4"><span className="rounded-full bg-[#21464b] px-3 py-1 text-xs text-[#e9d998]">{statusLabel[order.status] ?? order.status}</span></td></tr>)}</tbody></table>{!orders.length && <p className="p-8 text-center text-sm text-[#a8bb87]">Aucun ordre de réparation enregistré.</p>}</div>}
      </section>
      {open && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-5"><form onSubmit={addOrder} className="carte w-full max-w-md p-6"><h2 className="titre-or text-xl font-extrabold">Nouvel ordre de réparation</h2><div className="mt-5 grid gap-3"><select required className="champ min-h-11" value={form.vehicleId} onChange={(event) => { const vehicleId = event.target.value; const vehicle = vehicles.find((item) => item.id === vehicleId); setForm({ ...form, vehicleId, clientId: vehicle?.client_id ?? form.clientId }); }}><option value="">Sélectionner le véhicule</option>{vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.brand} {vehicle.model} · {vehicle.plate}</option>)}</select><select required className="champ min-h-11" value={form.clientId} onChange={(event) => setForm({ ...form, clientId: event.target.value })}><option value="">Sélectionner le client</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.full_name}</option>)}</select><textarea className="champ min-h-28" placeholder="Diagnostic ou besoin du client" value={form.diagnosis} onChange={(event) => setForm({ ...form, diagnosis: event.target.value })} /></div><div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setOpen(false)} className="rounded-lg px-4 py-2 text-sm text-[#a8bb87]">Annuler</button><button disabled={saving} type="submit" className="btn-or px-4 py-2 text-sm">{saving ? "Enregistrement…" : "Enregistrer"}</button></div></form></div>}
    </>
  );
}
