"use client";

/**
 * AUTO DYALI — Espace client › Souscription de forfait
 *
 * Permet au Manager de consulter son abonnement actuel :
 *   - Forfait, prix, durée payante, période d'essai
 *   - Modules et permissions applicables
 *   - Dates clés (début, fin d'essai, échéance payante)
 *
 * Respect strict des permissions Manager : seul l'établissement rattaché
 * au profil connecté est consultable. Aucun mot de passe en clair.
 */

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase-browser";
import Link from "next/link";

type SecurityState = {
  user_id: string | null;
  role: string | null;
  full_name: string | null;
  establishment_id: string | null;
  login_id: string | null;
  must_change_password: boolean | null;
  temporary_password_expires_at: string | null;
  password_changed_at: string | null;
};

type SubscriptionRow = {
  id: string;
  establishment_id: string;
  plan_code: string;
  status: string;
  started_at: string | null;
  trial_ends_at: string | null;
  current_period_end: string | null;
  cancelled_at: string | null;
};

type PlanRow = {
  code: string;
  label: string;
  description: string;
  price_monthly: number | null;
  price_yearly: number | null;
  trial_days: number;
  max_users: number;
  max_sites: number;
  storage_mb: number;
};

type FeatureRow = { feature_key: string; enabled: boolean };

const STATUT_LABEL: Record<string, string> = {
  trial: "Essai",
  active: "Actif",
  past_due: "En retard",
  suspended: "Suspendu",
  expired: "Expiré",
  cancelled: "Résilié",
};

const DEVISE = "MAD";

export default function SouscriptionClientPage() {
  const [security, setSecurity] = useState<SecurityState | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionRow | null>(null);
  const [plan, setPlan] = useState<PlanRow | null>(null);
  const [features, setFeatures] = useState<FeatureRow[]>([]);
  const [permissions, setPermissions] = useState<{ module: string; can_view: boolean; can_create: boolean; can_edit: boolean; can_delete: boolean }[]>([]);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    let vivant = true;
    void (async () => {
      if (!supabase) {
        setErreur("Supabase non configuré.");
        setLoading(false);
        return;
      }

      try {
        // 1. État de sécurité du compte connecté (rôle, établissement)
        const { data: secData, error: secError } = await supabase.rpc("get_my_security_state");
        if (secError) throw secError;
        const s = (secData ?? null) as SecurityState | null;
        setSecurity(s);

        if (!s || !s.establishment_id) {
          setErreur("Aucun établissement rattaché à ce compte.");
          setLoading(false);
          return;
        }

        if (s.role !== "manager" && s.role !== "saas_admin") {
          setErreur("Ce compte n'a pas accès à la consultation d'abonnement.");
          setLoading(false);
          return;
        }

        // 2. Abonnement de l'établissement
        const { data: subData, error: subError } = await supabase
          .from("subscriptions")
          .select("id, establishment_id, plan_code, status, started_at, trial_ends_at, current_period_end, cancelled_at")
          .eq("establishment_id", s.establishment_id)
          .order("created_at", { ascending: false })
          .limit(1);
        if (subError) throw subError;
        const sub = (subData ?? [])[0] as SubscriptionRow | undefined;
        setSubscription(sub ?? null);

        // 3. Plan associé
        if (sub) {
          const { data: planData, error: planError } = await supabase
            .from("plans")
            .select("code, label, description, price_monthly, price_yearly, trial_days, max_users, max_sites, storage_mb")
            .eq("code", sub.plan_code)
            .single();
          if (planError) throw planError;
          setPlan(planData as PlanRow);

          // 4. Fonctionnalités du plan
          const { data: featData, error: featError } = await supabase
            .from("plan_features")
            .select("feature_key, enabled")
            .eq("plan_code", sub.plan_code)
            .eq("enabled", true);
          if (featError) throw featError;
          setFeatures((featData ?? []) as FeatureRow[]);

          // 5. Permissions du manager
          const { data: permData, error: permError } = await supabase.rpc("my_permissions");
          if (permError) throw permError;
          setPermissions((permData ?? []) as { module: string; can_view: boolean; can_create: boolean; can_edit: boolean; can_delete: boolean }[]);
        }
      } catch (err) {
        setErreur(err instanceof Error ? err.message : "Échec du chargement de l'abonnement.");
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      vivant = false;
    };
  }, [supabase]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#252D2D]">
        <p className="text-sm text-[#A7B7A8]">Chargement de votre abonnement…</p>
      </div>
    );
  }

  if (erreur) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#252D2D]">
        <div className="carte max-w-md mx-auto p-6 text-center">
          <p className="text-sm text-[#C5716B]">{erreur}</p>
          <button
            type="button"
            onClick={() => void window.location.reload()}
            className="mt-4 rounded-lg border border-[#8FB59B]/40 px-4 py-2 text-sm text-[#DFE7E2] hover:bg-[#344440]"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  if (!subscription || !plan) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#252D2D]">
        <div className="carte max-w-md mx-auto p-6 text-center">
          <p className="text-sm text-[#A7B7A8]">Aucun abonnement actif trouvé pour cet établissement.</p>
          <Link href="/tableau-de-bord/" className="mt-4 inline-block rounded-lg border border-[#8FB59B]/40 px-4 py-2 text-sm text-[#DFE7E2] hover:bg-[#344440]">
            Retour au tableau de bord
          </Link>
        </div>
      </div>
    );
  }

  const dateFinEssai = subscription.trial_ends_at ? new Date(subscription.trial_ends_at) : null;
  const dateEcheance = subscription.current_period_end ? new Date(subscription.current_period_end) : null;
  const dateDebut = subscription.started_at ? new Date(subscription.started_at) : null;

  const formaterDate = (d: Date | null) => {
    if (!d) return "—";
    return d.toISOString().slice(0, 10);
  };

  return (
    <div className="min-h-screen bg-[#252D2D]">
      <nav className="border-b border-[#8FB59B]/15 bg-[#252D2D]/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/tableau-de-bord/" className="flex items-center gap-2">
              <span className="text-[12px] font-bold text-[#E8ECE8]">AUTO DYALI</span>
              <span className="text-[10px] uppercase tracking-wider text-[#8FB59B]">Espace client</span>
            </Link>
            <Link href="/tableau-de-bord/" className="rounded-lg border border-[#8FB59B]/40 px-3 py-1.5 text-xs text-[#DFE7E2] hover:bg-[#344440]">
              Tableau de bord
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="titre-or text-2xl font-extrabold">Mon abonnement</h1>
          <p className="mt-1 text-sm text-[#A7B7A8]">
            Consultez votre forfait actuel, vos modules et vos dates clés.
          </p>
        </div>

        {/* Cartes d'information */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <div className="carte p-5 rounded-xl">
            <p className="text-[11px] uppercase tracking-wider text-[#A7B7A8]">Forfait</p>
            <h2 className="text-lg font-bold text-[#E8ECE8]">{plan.label}</h2>
            <p className="mt-1 text-[12px] text-[#8FB59B]">{plan.code.toUpperCase()}</p>
          </div>
          <div className="carte p-5 rounded-xl">
            <p className="text-[11px] uppercase tracking-wider text-[#A7B7A8]">Statut</p>
            <span className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-bold ${subscription.status === "active" ? "bg-[#5D9E7F]/10 text-[#7FBF9E]" : subscription.status === "trial" ? "bg-[#D6A34D]/10 text-[#D6A34D]" : "bg-[#C5716B]/10 text-[#C5716B]"}`}>
              {STATUT_LABEL[subscription.status] ?? subscription.status}
            </span>
          </div>
          <div className="carte p-5 rounded-xl">
            <p className="text-[11px] uppercase tracking-wider text-[#A7B7A8]">Prix mensuel</p>
            <h2 className="text-lg font-bold text-[#E8ECE8]">{plan.price_monthly === null ? "Non configuré" : plan.price_monthly.toLocaleString("fr-FR") + " " + DEVISE}</h2>
            <p className="mt-1 text-[12px] text-[#A7B7A8]">Annuel : {plan.price_yearly === null ? "Non configuré" : plan.price_yearly.toLocaleString("fr-FR") + " " + DEVISE}</p>
          </div>
          <div className="carte p-5 rounded-xl">
            <p className="text-[11px] uppercase tracking-wider text-[#A7B7A8]">Essai</p>
            <h2 className="text-lg font-bold text-[#E8ECE8]">{plan.trial_days > 0 ? plan.trial_days + " jours" : "Aucun"}</h2>
          </div>
        </div>

        {/* Détails */}
        <section className="carte p-6 rounded-xl mb-8">
          <h3 className="text-sm font-bold uppercase tracking-wider text-[#A7B7A8] mb-4">Dates clés</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="p-4 rounded-lg bg-[#344440]/50">
              <p className="text-[11px] uppercase tracking-wider text-[#A7B7A8]">Début</p>
              <p className="font-mono text-[#E8ECE8]">{formaterDate(dateDebut)}</p>
            </div>
            <div className="p-4 rounded-lg bg-[#344440]/50">
              <p className="text-[11px] uppercase tracking-wider text-[#A7B7A8]">Fin d&apos;essai</p>
              <p className="font-mono text-[#E8ECE8]">{dateFinEssai ? formaterDate(dateFinEssai) : "—"}</p>
            </div>
            <div className="p-4 rounded-lg bg-[#344440]/50">
              <p className="text-[11px] uppercase tracking-wider text-[#A7B7A8]">Échéance payante</p>
              <p className="font-mono text-[#E8ECE8]">{dateEcheance ? formaterDate(dateEcheance) : "—"}</p>
            </div>
          </div>
        </section>

        {/* Modules du forfait */}
        <section className="carte p-6 rounded-xl mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#A7B7A8]">Modules inclus ({features.length})</h3>
            {features.length > 8 && (
              <button type="button" className="text-[11px] text-[#8FB59B] hover:text-[#DFE7E2]">
                Tout afficher
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {features.map((f) => (
              <span key={f.feature_key} className="px-3 py-1.5 rounded-full bg-[#344440]/50 border border-[#8FB59B]/30 text-[11px] text-[#DFE7E2]">
                {f.feature_key}
              </span>
            ))}
            {features.length === 0 && <span className="text-xs text-[#A7B7A8]">Aucun module référencé.</span>}
          </div>
        </section>

        {/* Permissions du manager */}
        <section className="carte p-6 rounded-xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#A7B7A8]">Vos permissions ({permissions.length})</h3>
            <p className="text-[11px] text-[#A7B7A8]">Droits granulaires appliqués sur votre établissement.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs divide-y divide-[#8FB59B]/10">
              <thead className="bg-[#344440]/50 uppercase text-[#A7B7A8]">
                <tr>
                  <th className="px-4 py-3">Module</th>
                  <th className="px-4 py-3 text-center">Voir</th>
                  <th className="px-4 py-3 text-center">Créer</th>
                  <th className="px-4 py-3 text-center">Éditer</th>
                  <th className="px-4 py-3 text-center">Supprimer</th>
                </tr>
              </thead>
              <tbody>
                {permissions.map((p) => (
                  <tr key={p.module}>
                    <td className="px-4 py-3 text-[#E8ECE8]">{p.module}</td>
                    <td className="px-4 py-3 text-center">{p.can_view ? <span className="text-[#7FBF9E]">✓</span> : <span className="text-[#6B7280]">—</span>}</td>
                    <td className="px-4 py-3 text-center">{p.can_create ? <span className="text-[#7FBF9E]">✓</span> : <span className="text-[#6B7280]">—</span>}</td>
                    <td className="px-4 py-3 text-center">{p.can_edit ? <span className="text-[#7FBF9E]">✓</span> : <span className="text-[#6B7280]">—</span>}</td>
                    <td className="px-4 py-3 text-center">{p.can_delete ? <span className="text-[#7FBF9E]">✓</span> : <span className="text-[#6B7280]">—</span>}</td>
                  </tr>
                ))}
                {permissions.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-3 text-center text-xs text-[#A7B7A8]">
                      Aucune permission définie.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
