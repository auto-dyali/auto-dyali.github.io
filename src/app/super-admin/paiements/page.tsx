"use client";

/**
 * AUTO DYALI — Super Admin › Paiements & facturation SaaS
 * État réel : aucun fournisseur de paiement SaaS n'est connecté.
 * Affichage honnête du revenu récurrent estimé sur les prix
 * réellement configurés dans plans, sans aucune transaction inventée.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase-browser";
import { ModulePage } from "@/components/super-admin-module-page";
import { ModuleHeader, Chargement, Erreur } from "@/components/super-admin-page";
import { formatMontant } from "@/lib/csv-export";

type Sub = { establishment_id: string; plan_code: string; status: string };
type Plan = { code: string; label: string; price_monthly: number | null };

export default function PaiementsPage() {
  const [subs, setSubs] = useState<Sub[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      if (!supabase) return;
      setLoading(true);
      const [s, p] = await Promise.all([
        supabase.from("subscriptions").select("establishment_id, plan_code, status").in("status", ["active", "trial"]),
        supabase.from("plans").select("code, label, price_monthly"),
      ]);
      if (s.error) setErreur(s.error.message);
      else setSubs((s.data ?? []) as Sub[]);
      if (p.error) setErreur(p.error.message);
      else setPlans((p.data ?? []) as Plan[]);
      setLoading(false);
    })();
  }, []);

  const prixParCode = useMemo(() => new Map(plans.map((p) => [p.code, p])), [plans]);
  const abonnementsActifs = subs.length;
  const mrr = useMemo(
    () => subs.reduce((acc, s) => acc + (prixParCode.get(s.plan_code)?.price_monthly ?? 0), 0),
    [subs, prixParCode]
  );
  const nonConfigure = plans.every((p) => p.price_monthly == null);

  return (
    <ModulePage titre="Paiements & facturation">
      <ModuleHeader
        surtitre="AUTO DYALI · Finance SaaS"
        titre="Paiements & facturation"
        description="État réel de la facturation plateforme. Aucun fournisseur de paiement n'est connecté : aucune transaction n'est simulée ici."
      />

      {/* Statut honnête */}
      <div className="carte-premium mt-6 border-l-4 border-[#D6A34D] p-5">
        <h2 className="font-bold text-[#E8ECE8]">Facturation SaaS : non connectée</h2>
        <p className="mt-2 text-sm text-[#A7B7A8]">
          Aucun fournisseur (Stripe, Moyasar, CMI, Paydunya…) n’est relié à AUTO DYALI. Les abonnements existent en base
          (essai/actif/en retard…) mais aucun encaissement plateforme n’est automatisé. Les paiements affichés dans les modules
          métier concernent les ventes des garages (caisse), pas le SaaS.
        </p>
      </div>

      {erreur && <div className="mt-4"><Erreur message={erreur} /></div>}

      {loading ? (
        <div className="mt-6"><Chargement /></div>
      ) : (
        <>
          <section className="mt-6 grid gap-4 sm:grid-cols-3">
            <article className="carte-premium p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-[#A7B7A8]">Abonnements actifs / essais</p>
              <p className="titre-or mt-2 text-3xl font-extrabold">{abonnementsActifs}</p>
            </article>
            <article className="carte-premium p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-[#A7B7A8]">MRR estimé</p>
              <p className="titre-or mt-2 text-3xl font-extrabold">{nonConfigure ? "—" : formatMontant(mrr)}</p>
              <p className="mt-1 text-[11px] text-[#A7B7A8]">Calculé sur les prix mensuels configurés dans plans — ce n’est pas un encaissement réel.</p>
            </article>
            <article className="carte-premium p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-[#A7B7A8]">Cycle de vie</p>
              <Link href="/super-admin/abonnements/" className="titre-or mt-2 block text-3xl font-extrabold hover:underline">Gérer</Link>
              <p className="mt-1 text-[11px] text-[#A7B7A8]">Essai, actif, en retard, suspendu, expiré, résilié.</p>
            </article>
          </section>

          <div className="carte-premium mt-6 p-5">
            <h2 className="font-bold">Ce qu’il faut pour passer en production</h2>
            <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-[#A7B7A8]">
              <li>Choisir un fournisseur de paiement et créer un compte marchand vérifié (KYC).</li>
              <li>Stocker les clés côté serveur (Edge Function) — jamais dans le navigateur.</li>
              <li>Mettre en place les webhooks (paiement confirmé / échoué / remboursé) avec signature vérifiée.</li>
              <li>Idempotence des webhooks et réconciliation avec <code>subscriptions</code> (statuts séparés entreprise/paiement).</li>
              <li>Générer les factures SaaS (numérotation légale) et journaliser dans <code>audit_log</code>.</li>
              <li>Tester en bac à sable puis en production avec un premier abonné volontaire.</li>
            </ol>
            <p className="mt-4 rounded-lg bg-[#5B7FC7]/10 px-4 py-3 text-xs text-[#9DB2E0]">
              migration 0028 (préparée, non appliquée) couvre l’onboarding entreprise + Manager + abonnement ; elle ne crée aucun encaissement.
            </p>
          </div>
        </>
      )}
    </ModulePage>
  );
}
