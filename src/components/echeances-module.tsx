"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase-browser";

/**
 * Créances & dettes — §13 (finance : créances, dettes, échéances).
 *
 * Lecture seule, données réelles Supabase :
 * - Créances clients : `clients.balance_due` + ventes ouvertes/partielles
 *   (reste = total − paid_total).
 * - Dettes fournisseurs : `suppliers.balance_due` + commandes impayées
 *   (reste = total_amount − paid_amount).
 * Aucun échéancier inventé : les dates d'échéance ne sont affichées que si
 * elles existent réellement en base (sinon « non renseignée »).
 */

type Ligne = { id: string; tiers: string; reference: string; montant: number; info: string };

const money = (v: unknown) => `${Number(v ?? 0).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MAD`;
const date = (v: string | null | undefined) => (v ? new Date(v).toLocaleDateString("fr-FR") : "—");

export function EcheancesModule() {
  const [creances, setCreances] = useState<Ligne[]>([]);
  const [dettes, setDettes] = useState<Ligne[]>([]);
  const [totalClients, setTotalClients] = useState(0);
  const [totalFournisseurs, setTotalFournisseurs] = useState(0);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = useCallback(async () => {
    if (!supabase) { setErreur("Supabase n’est pas configuré."); setLoading(false); return; }
    const [clientsRes, fournRes, ventesRes, achatsRes] = await Promise.all([
      supabase.from("clients").select("id, full_name, code, balance_due, phone"),
      supabase.from("suppliers").select("id, name, balance_due, phone"),
      supabase.from("sales").select("id, reference, created_at, total, paid_total, status, clients(full_name)")
        .in("status", ["open", "partial"]).order("created_at", { ascending: false }).limit(100),
      supabase.from("purchase_orders").select("id, reference, ordered_at, expected_at, total_amount, paid_amount, status, suppliers(name)")
        .not("status", "eq", "cancelled").order("ordered_at", { ascending: false }).limit(100),
    ]);

    const err = clientsRes.error ?? fournRes.error ?? ventesRes.error ?? achatsRes.error;
    if (err) { setErreur(`Lecture impossible : ${err.message}`); setLoading(false); return; }

    const cl = (clientsRes.data ?? []) as unknown as { id: string; full_name: string; code: string; balance_due: number }[];
    const fo = (fournRes.data ?? []) as unknown as { id: string; name: string; balance_due: number }[];
    const vs = (ventesRes.data ?? []) as unknown as { id: string; reference: string; created_at: string; total: number; paid_total: number; clients: { full_name: string } | null }[];
    const po = (achatsRes.data ?? []) as unknown as { id: string; reference: string; ordered_at: string; expected_at: string | null; total_amount: number; paid_amount: number; suppliers: { name: string } | null }[];

    // Créances : ventes non soldées + soldes clients (fichier crédit).
    const lignesCreances: Ligne[] = [
      ...vs.filter((v) => Number(v.total) > Number(v.paid_total) + 0.001).map((v) => ({
        id: `sale-${v.id}`,
        tiers: v.clients?.full_name ?? "Client comptant",
        reference: v.reference,
        montant: Number(v.total) - Number(v.paid_total),
        info: `Vente du ${date(v.created_at)} · encaissé ${money(v.paid_total)}`,
      })),
      ...cl.filter((c) => Number(c.balance_due) > 0.001).map((c) => ({
        id: `client-${c.id}`,
        tiers: `${c.full_name} (${c.code})`,
        reference: "Solde fiche client",
        montant: Number(c.balance_due),
        info: "Crédit en cours",
      })),
    ].sort((a, b) => b.montant - a.montant);

    // Dettes : commandes fournisseurs impayées + soldes fournisseurs.
    const lignesDettes: Ligne[] = [
      ...po.filter((p) => Number(p.total_amount) > Number(p.paid_amount) + 0.001).map((p) => ({
        id: `po-${p.id}`,
        tiers: p.suppliers?.name ?? "Fournisseur",
        reference: p.reference,
        montant: Number(p.total_amount) - Number(p.paid_amount),
        info: `Commande du ${date(p.ordered_at)}${p.expected_at ? ` · attendue le ${date(p.expected_at)}` : ""} · payé ${money(p.paid_amount)}`,
      })),
      ...fo.filter((f) => Number(f.balance_due) > 0.001).map((f) => ({
        id: `four-${f.id}`,
        tiers: f.name,
        reference: "Solde fiche fournisseur",
        montant: Number(f.balance_due),
        info: "Dette en cours",
      })),
    ].sort((a, b) => b.montant - a.montant);

    setCreances(lignesCreances);
    setDettes(lignesDettes);
    setTotalClients(cl.reduce((s, c) => s + Number(c.balance_due ?? 0), 0));
    setTotalFournisseurs(fo.reduce((s, f) => s + Number(f.balance_due ?? 0), 0));
    setErreur(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void charger(), 0);
    return () => window.clearTimeout(timer);
  }, [charger]);

  const totalCreances = creances.reduce((s, l) => s + l.montant, 0);
  const totalDettes = dettes.reduce((s, l) => s + l.montant, 0);
  const solde = totalCreances - totalDettes;

  return (
    <>
      <div className="mb-6">
        <p className="text-xs uppercase tracking-[0.2em] text-[#A7B7A8]">Finance</p>
        <h1 className="titre-or mt-1 text-2xl font-extrabold">Créances &amp; dettes</h1>
        <p className="mt-1 text-sm text-[#A7B7A8]">Encours clients, dettes fournisseurs et reste à encaisser — données réelles Supabase.</p>
      </div>

      {erreur && <p role="alert" className="mb-4 rounded-lg bg-[#C5716B]/15 px-4 py-3 text-sm text-[#C5716B]">{erreur}</p>}

      {/* KPI */}
      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <div className="carte p-5">
          <p className="text-xs uppercase tracking-[0.15em] text-[#A7B7A8]">À encaisser</p>
          <p className="titre-or mt-2 text-2xl font-extrabold text-[#8FB59B]">{money(totalCreances)}</p>
          <p className="mt-1 text-xs text-[#A7B7A8]">{creances.length} ligne(s) · solde fiches {money(totalClients)}</p>
        </div>
        <div className="carte p-5">
          <p className="text-xs uppercase tracking-[0.15em] text-[#A7B7A8]">À payer</p>
          <p className="titre-or mt-2 text-2xl font-extrabold text-[#C5716B]">{money(totalDettes)}</p>
          <p className="mt-1 text-xs text-[#A7B7A8]">{dettes.length} ligne(s) · solde fiches {money(totalFournisseurs)}</p>
        </div>
        <div className="carte p-5">
          <p className="text-xs uppercase tracking-[0.15em] text-[#A7B7A8]">Solde net</p>
          <p className={`titre-or mt-2 text-2xl font-extrabold ${solde >= 0 ? "text-[#D0C6AE]" : "text-[#C5716B]"}`}>{money(solde)}</p>
          <p className="mt-1 text-xs text-[#A7B7A8]">créances − dettes</p>
        </div>
      </div>

      {loading && <p className="carte p-8 text-center text-sm text-[#A7B7A8]">Chargement des encours…</p>}

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Créances clients */}
        <section className="carte overflow-hidden">
          <h2 className="border-b border-[#8FB59B]/10 p-5 font-bold text-[#E8ECE8]">Créances clients ({creances.length})</h2>
          <ul className="max-h-96 divide-y divide-[#8FB59B]/10 overflow-y-auto">
            {creances.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                <div>
                  <p className="font-semibold text-[#E8ECE8]">{l.tiers}</p>
                  <p className="text-xs text-[#A7B7A8]">{l.reference} · {l.info}</p>
                </div>
                <span className="font-bold text-[#8FB59B]">{money(l.montant)}</span>
              </li>
            ))}
          </ul>
          {!loading && !creances.length && <p className="p-8 text-center text-sm text-[#A7B7A8]">Aucune créance : tous les clients sont soldés. ✅</p>}
        </section>

        {/* Dettes fournisseurs */}
        <section className="carte overflow-hidden">
          <h2 className="border-b border-[#8FB59B]/10 p-5 font-bold text-[#E8ECE8]">Dettes fournisseurs ({dettes.length})</h2>
          <ul className="max-h-96 divide-y divide-[#8FB59B]/10 overflow-y-auto">
            {dettes.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                <div>
                  <p className="font-semibold text-[#E8ECE8]">{l.tiers}</p>
                  <p className="text-xs text-[#A7B7A8]">{l.reference} · {l.info}</p>
                </div>
                <span className="font-bold text-[#C5716B]">{money(l.montant)}</span>
              </li>
            ))}
          </ul>
          {!loading && !dettes.length && <p className="p-8 text-center text-sm text-[#A7B7A8]">Aucune dette fournisseur. ✅</p>}
        </section>
      </div>

      <p className="mt-4 text-[11px] text-[#A7B7A8]">
        Transparence : aucune date d’échéance n’est inventée — elle n’apparaît que si elle est renseignée en base
        (commandes fournisseurs : date d’attente). Les encaissements se font depuis les fiches Clients et le module Chèques.
      </p>
    </>
  );
}
