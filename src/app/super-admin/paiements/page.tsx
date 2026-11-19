"use client";

/**
 * AUTO DYALI — Super Admin › Finance & facturation (SaaS)
 * Vue réelle basée sur les abonnements et forfaits configurés.
 * Aucun fournisseur de paiement SaaS n'est connecté : aucune
 * transaction confirmée n'est inventée ou affichée comme réelle.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase-browser";
import { ModulePage } from "@/components/super-admin-module-page";
import { ModuleHeader, Chargement, Erreur, Vide } from "@/components/super-admin-page";
import { downloadCsv, dateFrCourte, formatMontant } from "@/lib/csv-export";

type Sub = {
  id: string;
  establishment_id: string;
  plan_code: string;
  status: string;
  started_at: string | null;
  trial_ends_at: string | null;
  current_period_end: string | null;
  cancelled_at: string | null;
  establishments: { name: string; slug: string } | null;
};
type Plan = { code: string; label: string; price_monthly: number | null };

const STATUT: Record<string, string> = {
  trial: "Essai",
  active: "Actif",
  past_due: "En retard",
  suspended: "Suspendu",
  expired: "Expiré",
  cancelled: "Résilié",
};

export default function PaiementsPage() {
  const [subs, setSubs] = useState<Sub[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [filtre, setFiltre] = useState<string>("tous");

  useEffect(() => {
    void (async () => {
      if (!supabase) return;
      setLoading(true);
      const [s, p] = await Promise.all([
        supabase
          .from("subscriptions")
          .select("id, establishment_id, plan_code, status, started_at, trial_ends_at, current_period_end, cancelled_at, establishments(name, slug)")
          .order("created_at", { ascending: false }),
        supabase.from("plans").select("code, label, price_monthly"),
      ]);
      if (s.error) setErreur(s.error.message);
      else setSubs((s.data ?? []) as unknown as Sub[]);
      if (p.error) setErreur((prev) => prev ?? p.error.message);
      else setPlans((p.data ?? []) as Plan[]);
      setLoading(false);
    })();
  }, []);

  const prixParCode = useMemo(() => new Map(plans.map((p) => [p.code, p])), [plans]);

  const visibles = useMemo(
    () => subs.filter((s) => (filtre === "tous" ? true : s.status === filtre)),
    [subs, filtre],
  );

  const compteurs = useMemo(() => {
    const c: Record<string, number> = { trial: 0, active: 0, past_due: 0, suspended: 0, expired: 0, cancelled: 0 };
    for (const s of subs) c[s.status] = (c[s.status] ?? 0) + 1;
    return c;
  }, [subs]);

  const actifsEssais = subs.filter((s) => s.status === "active" || s.status === "trial");
  const mrr = actifsEssais.reduce((acc, s) => acc + (prixParCode.get(s.plan_code)?.price_monthly ?? 0), 0);
  const dusEstimes = subs
    .filter((s) => s.status === "past_due" || s.status === "active")
    .reduce((acc, s) => acc + (prixParCode.get(s.plan_code)?.price_monthly ?? 0), 0);
  const prixConfigures = plans.some((p) => p.price_monthly != null);

  function exporter() {
    downloadCsv(
      `auto-dyali-facturation-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Entreprise", "Forfait", "Statut abonnement", "Prix mensuel (config.)", "Début", "Échéance", "Fin essai", "Résilié le", "Montant dû estimé (MAD)"],
      visibles.map((s) => {
        const prix = prixParCode.get(s.plan_code)?.price_monthly ?? null;
        const du = s.status === "past_due" || s.status === "active" ? prix : null;
        return [
          s.establishments?.name ?? s.establishment_id,
          s.plan_code.toUpperCase(),
          STATUT[s.status] ?? s.status,
          prix ?? "non configuré",
          dateFrCourte(s.started_at),
          dateFrCourte(s.current_period_end),
          dateFrCourte(s.trial_ends_at),
          dateFrCourte(s.cancelled_at),
          du ?? "—",
        ];
      }),
    );
  }

  return (
    <ModulePage titre="Finance & facturation">
      <ModuleHeader
        surtitre="AUTO DYALI · Finance SaaS"
        titre="Finance & facturation"
        description="Facturation plateforme basée sur les abonnements réels. Aucun fournisseur de paiement SaaS n’est connecté : aucun encaissement confirmé n’est enregistré."
        action={<button type="button" onClick={exporter} className="rounded-lg border border-[#8FB59B]/40 px-4 py-2 text-sm text-[#DFE7E2] hover:bg-[#344440]">Exporter CSV</button>}
      />

      <div className="carte-premium mt-6 border-l-4 border-[#D6A34D] p-5">
        <h2 className="font-bold text-[#E8ECE8]">Paiements SaaS : non automatisés</h2>
        <p className="mt-2 text-sm text-[#A7B7A8]">
          Aucun fournisseur (Stripe, CMI, etc.) n’est relié. Les montants ci-dessous sont des <strong className="text-[#E8ECE8]">estimations</strong> calculées à partir des prix configurés dans les formules et des statuts d’abonnement — ce ne sont pas des transactions encaissées.
        </p>
      </div>

      {erreur && <div className="mt-4"><Erreur message={erreur} /></div>}

      {loading ? (
        <div className="mt-6"><Chargement /></div>
      ) : (
        <>
          <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <article className="carte-premium p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-[#A7B7A8]">MRR estimé</p>
              <p className="titre-or mt-2 text-2xl font-extrabold">{prixConfigures ? formatMontant(mrr) : "—"}</p>
              <p className="mt-1 text-[11px] text-[#A7B7A8]">Abonnements actifs + essais (prix mensuels).</p>
            </article>
            <article className="carte-premium p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-[#A7B7A8]">Montants dus (estimés)</p>
              <p className="titre-or mt-2 text-2xl font-extrabold">{prixConfigures ? formatMontant(dusEstimes) : "—"}</p>
              <p className="mt-1 text-[11px] text-[#A7B7A8]">Actifs + en retard, hors encaissement réel.</p>
            </article>
            <article className="carte-premium p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-[#A7B7A8]">Transactions enregistrées</p>
              <p className="titre-or mt-2 text-2xl font-extrabold">0</p>
              <p className="mt-1 text-[11px] text-[#A7B7A8]">Aucun encaissement SaaS automatisé/confirmé.</p>
            </article>
            <article className="carte-premium p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-[#A7B7A8]">Factures SaaS émises</p>
              <p className="titre-or mt-2 text-2xl font-extrabold">0</p>
              <p className="mt-1 text-[11px] text-[#A7B7A8]">Aucune facturation automatisée connectée.</p>
            </article>
          </section>

          <div className="carte-premium mt-6 grid gap-3 p-4 sm:grid-cols-3">
            <label className="text-xs text-[#A7B7A8] sm:col-span-2">
              Statut d’abonnement
              <select value={filtre} onChange={(e) => setFiltre(e.target.value)} className="champ mt-1 min-h-11 w-full">
                <option value="tous">Tous</option>
                {Object.entries(STATUT).map(([k, v]) => <option key={k} value={k}>{v} ({compteurs[k] ?? 0})</option>)}
              </select>
            </label>
            <div className="flex items-end">
              <Link href="/super-admin/abonnements/" className="rounded-lg border border-[#8FB59B]/40 px-4 py-2 text-sm text-[#DFE7E2] hover:bg-[#344440]">Gérer le cycle de vie</Link>
            </div>
          </div>

          {visibles.length === 0 ? (
            <div className="mt-6"><Vide titre="Aucun abonnement" detail="Aucun abonnement ne correspond au filtre." /></div>
          ) : (
            <div className="carte mt-6 overflow-hidden">
              <div className="border-b border-[#8FB59B]/10 p-5">
                <h2 className="font-bold">Historique & état de facturation (par abonnement)</h2>
                <p className="mt-1 text-xs text-[#A7B7A8]">Données réelles d’abonnement. Colonne « montant dû estimé » = prix mensuel configuré si applicable (non encaissé).</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] text-left text-sm">
                  <thead className="bg-[#344440]/50 text-xs uppercase text-[#A7B7A8]">
                    <tr>
                      <th className="px-5 py-3">Entreprise</th>
                      <th className="px-5 py-3">Forfait</th>
                      <th className="px-5 py-3">Statut</th>
                      <th className="px-5 py-3">Prix mensuel</th>
                      <th className="px-5 py-3">Dû estimé</th>
                      <th className="px-5 py-3">Échéance</th>
                      <th className="px-5 py-3">Début</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#8FB59B]/10">
                    {visibles.map((s) => {
                      const prix = prixParCode.get(s.plan_code)?.price_monthly ?? null;
                      const du = s.status === "past_due" || s.status === "active" ? prix : null;
                      return (
                        <tr key={s.id}>
                          <td className="px-5 py-4"><p className="font-semibold">{s.establishments?.name ?? "—"}</p><p className="text-[11px] text-[#A7B7A8]">{s.establishments?.slug}</p></td>
                          <td className="px-5 py-4 uppercase">{s.plan_code}</td>
                          <td className="px-5 py-4">{STATUT[s.status] ?? s.status}</td>
                          <td className="px-5 py-4 text-[#A7B7A8]">{prix != null ? formatMontant(prix) : "Non configuré"}</td>
                          <td className="px-5 py-4 text-[#A7B7A8]">{du != null ? formatMontant(du) : "—"}</td>
                          <td className="px-5 py-4 text-[#A7B7A8]">{dateFrCourte(s.current_period_end ?? s.trial_ends_at)}</td>
                          <td className="px-5 py-4 text-[#A7B7A8]">{dateFrCourte(s.started_at)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="carte-premium mt-6 p-5">
            <h2 className="font-bold">Prérequis pour paiements réels et factures SaaS</h2>
            <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-[#A7B7A8]">
              <li>Fournisseur de paiement configuré (secrets serveur), webhooks signés et idempotents.</li>
              <li>Modèle de factures/transactions SaaS distinct des ventes atelier, avec numérotation et statuts réels.</li>
              <li>Réconciliation automatique paiement ↔ abonnement, journalisation dans <code>audit_log</code>.</li>
              <li>Tests en environnement contrôlé avant toute activation.</li>
            </ol>
            <p className="mt-3 text-xs text-[#9DB2E0]">Aucun avoir SaaS n’est modélisé actuellement — statut : non applicable / absent.</p>
          </div>
        </>
      )}
    </ModulePage>
  );
}
