"use client";

/**
 * AUTO DYALI — Super Admin › WhatsApp Business (supervision centrale)
 * Statut RÉEL de l'intégration : aucune connexion active n'est
 * simulée. Affiche uniquement ce qui existe (droits par forfait)
 * et ce qu'il faut pour l'activer.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase-browser";
import { ModulePage } from "@/components/super-admin-module-page";
import { ModuleHeader, Chargement, Erreur } from "@/components/super-admin-page";

export default function WhatsappPage() {
  const [droits, setDroits] = useState<{ plan_code: string; enabled: boolean }[]>([]);
  const [etablissements, setEtablissements] = useState(0);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      if (!supabase) return;
      setLoading(true);
      const [f, e] = await Promise.all([
        supabase.from("plan_features").select("plan_code, enabled").eq("feature_key", "whatsapp"),
        supabase.from("establishments").select("id", { count: "exact", head: true }),
      ]);
      if (f.error) setErreur(f.error.message);
      else setDroits((f.data ?? []) as { plan_code: string; enabled: boolean }[]);
      if (e.error) setErreur(e.error.message);
      else setEtablissements(e.count ?? 0);
      setLoading(false);
    })();
  }, []);

  const plansActives = useMemo(() => droits.filter((d) => d.enabled).map((d) => d.plan_code.toUpperCase()), [droits]);

  return (
    <ModulePage titre="WhatsApp Business">
      <ModuleHeader
        surtitre="AUTO DYALI · Intégration centrale"
        titre="WhatsApp Business"
        description="Supervision de l'intégration WhatsApp de la plateforme. Aucun envoi réel, aucun message test sans autorisation explicite."
      />

      <div className="carte-premium mt-6 border-l-4 border-[#C5716B] p-5">
        <h2 className="font-bold text-[#E8ECE8]">Intégration non opérationnelle</h2>
        <p className="mt-2 text-sm text-[#A7B7A8]">
          Aucun token, webhook ou compte WhatsApp Business Platform (Meta) n’est connecté à AUTO DYALI aujourd’hui.
          Aucune connexion n’est annoncée comme active et aucun message n’a été envoyé.
        </p>
      </div>

      {erreur && <div className="mt-4"><Erreur message={erreur} /></div>}

      {loading ? (
        <div className="mt-6"><Chargement /></div>
      ) : (
        <>
          <section className="mt-6 grid gap-4 sm:grid-cols-3">
            <article className="carte-premium p-5"><p className="text-xs uppercase tracking-[0.18em] text-[#A7B7A8]">Établissements</p><p className="titre-or mt-2 text-3xl font-extrabold">{etablissements}</p></article>
            <article className="carte-premium p-5"><p className="text-xs uppercase tracking-[0.18em] text-[#A7B7A8]">Forfaits avec accès WhatsApp</p><p className="titre-or mt-2 text-3xl font-extrabold">{plansActives.length}</p><p className="mt-1 text-[11px] text-[#A7B7A8]">{plansActives.join(", ") || "aucun"}</p></article>
            <article className="carte-premium p-5"><p className="text-xs uppercase tracking-[0.18em] text-[#A7B7A8]">Statut de l’intégration</p><p className="titre-or mt-2 text-3xl font-extrabold text-[#D6A34D]">À configurer</p></article>
          </section>

          <div className="carte-premium mt-6 p-5">
            <h2 className="font-bold">Ce qu’il faut pour l’activer</h2>
            <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-[#A7B7A8]">
              <li>Compte WhatsApp Business Platform (Meta) ou partenaire officiel ; validation entreprise.</li>
              <li>App Meta vérifiée + Embedded Signup si chaque établissement conserve sa propre intégration.</li>
              <li>Stockage serveur des tokens (Edge Function), jamais dans le navigateur ; rotation possible.</li>
              <li>Webhooks entrants signés (messages, statuts) ; quotas et reprises d’envoi centralisés.</li>
              <li>Isolation : chaque établissement voit UNIQUEMENT ses conversations (RLS + filtre tenant).</li>
              <li>Journalisation sans contenu privé ni token (audit_log technique uniquement).</li>
              <li>Test bac à sable → test sur un établissement pilote volontaire → déploiement progressif.</li>
            </ol>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/super-admin/plans/" className="btn-or px-4 py-2 text-sm">Activer WhatsApp par forfait</Link>
              <Link href="/super-admin/parametres/" className="rounded-lg border border-[#8FB59B]/40 px-4 py-2 text-sm text-[#DFE7E2] hover:bg-[#344440]">Paramètres système</Link>
            </div>
          </div>

          <p className="mt-6 text-[11px] text-[#A7B7A8]">Chaque entreprise conservera sa propre intégration Meta, ses autorisations et ses données ; le Super Admin ne verra que l’état technique (connexion, quotas, erreurs), jamais les conversations privées.</p>
        </>
      )}
    </ModulePage>
  );
}
