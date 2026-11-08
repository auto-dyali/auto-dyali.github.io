"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase-browser";
type Row = { id: string; reference: string; status: string; vehicles: { plate: string; model: string } | null };
export function DashboardLive({ couleurStatut }: { couleurStatut: Record<string, string> }) {
  const [rows, setRows] = useState<Row[]>([]);
  useEffect(() => { const timer = window.setTimeout(async () => { if (!supabase) return; const { data } = await supabase.from("work_orders").select("id, reference, status, vehicles(plate, model)").neq("status", "delivered").neq("status", "cancelled").order("created_at", { ascending: false }).limit(5); setRows((data ?? []) as unknown as Row[]); }, 0); return () => window.clearTimeout(timer); }, []);
  return <>{!rows.length ? <p className="text-xs text-[#A7B7A8]">Aucun véhicule en atelier.</p> : <ul className="flex flex-col gap-3">{rows.map((row) => <li key={row.id} className="flex items-center justify-between gap-2 text-xs"><div className="min-w-0"><p className="truncate font-semibold text-[#E8ECE8]">{row.vehicles?.model ?? row.reference}</p><p className="text-[10px] text-[#A7B7A8]">{row.vehicles?.plate ?? row.reference}</p></div><span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${couleurStatut[row.status] ?? couleurStatut["En cours"]}`}>{row.status}</span></li>)}</ul>}<Link href="/tableau-de-bord/atelier" className="mt-4 block text-center text-xs text-[#3ECF6A] hover:underline">Voir l’atelier →</Link></>;
}
