"use client";

/**
 * AUTO DYALI — Super Admin › Rapports & analyses
 * Indicateurs réellement calculés depuis Supabase : aucun chiffre
 * inventé. Le MRR est une estimation sur les prix configurés,
 * clairement libellée comme telle.
 */

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase-browser";
import { ModulePage } from "@/components/super-admin-module-page";
import { ModuleHeader, Chargement, Erreur } from "@/components/super-admin-page";
import { downloadCsv, formatMontant, dateFrCourte } from "@/lib/csv-export";

type Etab = { plan: string; is_active: boolean; created_at: string };
type Plan = { code: string; label: string; price_monthly: number | null };
type Lead = { stage: string };
type Sub = { plan_code: string; status: string };

const ETAPES = ["prospect", "demo", "trial", "negotiation", "won", "lost"] as const;

export default function RapportsPage() {
  const [etabs, setEtabs] = useState<Etab[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [ticketsOuverts, setTicketsOuverts] = useState(0);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      if (!supabase) return;
      setLoading(true);
      const [e, p, l, s, t] = await Promise.all([
        supabase.from("establishments").select("plan, is_active, created_at"),
        supabase.from("plans").select("code, label, price_monthly"),
        supabase.from("crm_leads").select("stage"),
        supabase.from("subscriptions").select("plan_code, status").in("status", ["trial", "active", "past_due"]),
        supabase.from("support_tickets").select("id", { count: "exact", head: true }).in("status", ["open", "in_progress", "waiting_reply"]),
      ]);
      if (e.error || p.error || l.error || s.error || t.error) {
        setErreur(e.error?.message ?? p.error?.message ?? l.error?.message ?? s.error?.message ?? t.error?.message ?? "Erreur");
      }
      setEtabs((e.data ?? []) as Etab[]);
      setPlans((p.data ?? []) as Plan[]);
      setLeads((l.data ?? []) as Lead[]);
      setSubs((s.data ?? []) as Sub[]);
      setTicketsOuverts(t.count ?? 0);
      setLoading(false);
    })();
  }, []);

  const prixParCode = useMemo(() => new Map(plans.map((p) => [p.code, p])), [plans]);
  const total = etabs.length;
  const actifs = etabs.filter((e) => e.is_active).length;
  const suspendus = total - actifs;
  const mrr = subs.reduce((acc, s) => acc + (prixParCode.get(s.plan_code)?.price_monthly ?? 0), 0);
  const parPlan = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of etabs) m.set(e.plan, (m.get(e.plan) ?? 0) + 1);
    return m;
  }, [etabs]);
  const maxPlan = Math.max(1, ...[...parPlan.values()]);
  const leadsTotal = leads.length;
  const gagnes = leads.filter((l) => l.stage === "won").length;
  const conversion = leadsTotal > 0 ? Math.round((gagnes / leadsTotal) * 100) : 0;
  const parEtape = ETAPES.map((e) => ({ etape: e, n: leads.filter((l) => l.stage === e).length }));
  const maxEtape = Math.max(1, ...parEtape.map((x) => x.n));

  function exporter() {
    downloadCsv(
      `auto-dyali-rapports-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Indicateur", "Valeur"],
      [
        ["Entreprises totales", total],
        ["Entreprises actives", actifs],
        ["Entreprises suspendues", suspendus],
        ["MRR estimé (MAD)", mrr || "non configuré"],
        ["Leads CRM total", leadsTotal],
        ["Leads gagnés", gagnes],
        ["Conversion CRM (%)", conversion],
        ["Tickets ouverts", ticketsOuverts],
        ...ETAPES.map((e) => [`CRM ${e}`, leads.filter((l) => l.stage === e).length]),
        ...plans.map((p) => [`Plan ${p.code}`, parPlan.get(p.code) ?? 0]),
      ]
    );
  }

  return (
    <ModulePage titre="Rapports & analyses">
      <ModuleHeader
        surtitre="AUTO DYALI · Business Intelligence"
        titre="Rapports & analyses"
        description="Indicateurs calculés sur les données Supabase (établissements, abonnements, CRM, support). MRR = estimation sur les prix configurés — pas un encaissement réel."
        action={<button type="button" onClick={exporter} className="rounded-lg border border-[#8FB59B]/40 px-4 py-2 text-sm text-[#DFE7E2] hover:bg-[#344440]">Exporter CSV</button>}
      />

      {erreur && <div className="mt-4"><Erreur message={erreur} /></div>}

      {loading ? (
        <div className="mt-6"><Chargement /></div>
      ) : (
        <>
          <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Entreprises", value: total, sub: `${actifs} actives · ${suspendus} suspendues` },
              { label: "Abonnements actifs/essais", value: subs.length, sub: "Cycle de vie global" },
              { label: "MRR estimé", value: plans.some((p) => p.price_monthly != null) ? formatMontant(mrr) : "non configuré", sub: "Prix plans configurés" },
              { label: "Tickets ouverts", value: ticketsOuverts, sub: "Support plateforme" },
            ].map((c) => (
              <article key={c.label} className="carte-premium p-5">
                <p className="text-xs uppercase tracking-[0.18em] text-[#A7B7A8]">{c.label}</p>
                <p className="titre-or mt-2 text-2xl font-extrabold">{c.value}</p>
                <p className="mt-1 text-[11px] text-[#A7B7A8]">{c.sub}</p>
              </article>
            ))}
          </section>

          <div className="mt-6 grid gap-4 xl:grid-cols-2">
            <article className="carte-premium p-5">
              <h2 className="font-bold">Répartition des entreprises par forfait</h2>
              <div className="mt-4 space-y-3">
                {plans.map((p) => {
                  const n = parPlan.get(p.code) ?? 0;
                  return (
                    <div key={p.code}>
                      <div className="flex items-center justify-between text-xs"><span className="uppercase text-[#E8ECE8]">{p.label}</span><span className="text-[#A7B7A8]">{n}</span></div>
                      <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-[#344440]"><div className="h-full rounded-full bg-gradient-to-r from-[#8FB59B] to-[#D0C6AE]" style={{ width: `${Math.round((n / maxPlan) * 100)}%` }} /></div>
                    </div>
                  );
                })}
                {plans.length === 0 && <p className="text-xs text-[#A7B7A8]">Aucun forfait configuré.</p>}
              </div>
            </article>

            <article className="carte-premium p-5">
              <h2 className="font-bold">Pipeline CRM — {leadsTotal} leads · {conversion}% gagnés</h2>
              <div className="mt-4 space-y-3">
                {parEtape.map(({ etape, n }) => (
                  <div key={etape}>
                    <div className="flex items-center justify-between text-xs"><span className="capitalize text-[#E8ECE8]">{etape}</span><span className="text-[#A7B7A8]">{n}</span></div>
                    <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-[#344440]"><div className="h-full rounded-full bg-gradient-to-r from-[#8FB59B] to-[#D0C6AE]" style={{ width: `${Math.round((n / maxEtape) * 100)}%` }} /></div>
                  </div>
                ))}
              </div>
            </article>
          </div>

          <p className="mt-6 text-[11px] text-[#A7B7A8]">Généré le {dateFrCourte(new Date().toISOString())} — données à l’instant T, pas d’historique agrégé tant qu’aucune agrégation n’est configurée.</p>
        </>
      )}
    </ModulePage>
  );
}
