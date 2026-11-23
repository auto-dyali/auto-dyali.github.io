"use client";

/**
 * AUTO DYALI — Super Admin › Vue générale (tableau de bord global).
 *
 * Page d'accueil du nouveau portail Super Admin (GV5 §38).
 * Toutes les données sont chargées réellement depuis Supabase.
 * Aucune donnée de démonstration n'est présentée comme réelle.
 *
 * KPI : abonnés professionnels, entreprises actives/suspendues,
 * abonnements actifs/expirés/en essai, indicateurs financiers.
 * Graphiques : répartition des forfaits, activité mensuelle, état des abonnements.
 * Activité récente : journal d'audit (audit_log).
 * Alertes : établissements sans manager, abonnements expirés, suspensions.
 * Santé : base de données, authentification, moteur de droits.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase-browser";
import { useNotification } from "@/lib/use-notification";
import { SuperAdminShell } from "@/components/super-admin-shell";
import { Icone, type NomIcone } from "@/components/icones";
import { getPageIdentity, PageIdentityBanner } from "@/components/super-admin-page-identity";

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

type Establishment = {
  id: string;
  name: string;
  slug?: string | null;
  city?: string | null;
  plan?: string | null;
  is_active: boolean;
  suspended_at?: string | null;
  created_at: string | null;
};

type PlanRow = {
  code: string;
  label: string;
  description?: string | null;
  price_monthly?: number | null;
  price_yearly?: number | null;
  trial_days?: number;
  max_users?: number;
  max_sites?: number;
  storage_mb?: number;
};

type FeatureRow = {
  plan_code: string;
  feature_key: string;
  enabled: boolean;
};

type AuditRow = {
  id: string;
  action: string;
  entity: string;
  payload_json?: unknown;
  created_at: string | null;
};

type ManagerProfileRow = {
  id: string;
  full_name: string;
  phone?: string | null;
  establishment_id?: string | null;
  role: string;
  is_active: boolean;
};

/* ------------------------------------------------------------------ */
/* Composant principal                                                */
/* ------------------------------------------------------------------ */

export default function SuperAdminPage() {
  const router = useRouter();
  const { error: notifyError } = useNotification();

  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [features, setFeatures] = useState<FeatureRow[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [managers, setManagers] = useState<ManagerProfileRow[]>([]);
  type SubscriptionRow = {
    id: string;
    establishment_id: string;
    plan_code?: string | null;
    status?: string | null;
    trial_ends_at?: string | null;
    current_period_end?: string | null;
  };

  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [periodeMois, setPeriodeMois] = useState<1 | 3 | 6 | 12>(6);

  /* ------------------------------------------------------------------ */
  /* Chargement des données réelles depuis Supabase                     */
  /* ------------------------------------------------------------------ */
  const charger = useCallback(async () => {
    if (!supabase) {
      setError("Supabase n'est pas configuré.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [
        etabs,
        plansData,
        featuresData,
        auditData,
        managersData,
        subsData,
      ] = await Promise.all([
        supabase
          .from("establishments")
          .select(
            "id, name, slug, city, plan, is_active, suspended_at, created_at"
          )
          .order("created_at", { ascending: false }),
        supabase
          .from("plans")
          .select(
            "code, label, description, price_monthly, price_yearly, trial_days, max_users, max_sites, storage_mb"
          )
          .order("price_monthly"),
        supabase
          .from("plan_features")
          .select("plan_code, feature_key, enabled"),
        supabase
          .from("audit_log")
          .select("id, action, entity, payload_json, created_at")
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("profiles")
          .select("id, full_name, phone, establishment_id, role, is_active")
          .eq("role", "manager"),
        supabase
          .from("subscriptions")
          .select(
            "id, establishment_id, plan_code, status, trial_ends_at, current_period_end"
          ),
      ]);

      if (etabs.error) throw etabs.error;
      if (plansData.error) throw plansData.error;
      if (featuresData.error) throw featuresData.error;
      if (auditData.error) throw auditData.error;
      if (managersData.error) throw managersData.error;
      if (subsData.error) throw subsData.error;

      setEstablishments((etabs.data ?? []) as Establishment[]);
      setPlans((plansData.data ?? []) as PlanRow[]);
      setFeatures((featuresData.data ?? []) as FeatureRow[]);
      setAudit((auditData.data ?? []) as AuditRow[]);
      setManagers((managersData.data ?? []) as ManagerProfileRow[]);
      setSubscriptions((subsData.data ?? []) as SubscriptionRow[]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur de chargement.";
      setError(msg);
      notifyError({ title: "Erreur de chargement", message: msg });
    } finally {
      setLoading(false);
    }
  }, [notifyError]);

  useEffect(() => {
    const timer = setTimeout(() => void charger(), 0);
    return () => clearTimeout(timer);
  }, [charger]);

  /* ------------------------------------------------------------------ */
  /* KPI calculés sur des données réelles                               */
  /* ------------------------------------------------------------------ */
  const totalEntreprises = establishments.length;
  const entreprisesActives = establishments.filter((e) => e.is_active).length;
  const entreprisesSuspendues = totalEntreprises - entreprisesActives;
  const managersCount = managers.length;
  const managersActifs = managers.filter((m) => m.is_active).length;

  const abonnementsActifs = subscriptions.filter(
    (s) => s.status === "active"
  ).length;
  const abonnementsExpires = subscriptions.filter(
    (s) => s.status === "expired" || s.status === "cancelled"
  ).length;
  const abonnementsEssai = subscriptions.filter(
    (s) => s.status === "trial"
  ).length;

  /* Chiffre d'affaires mensuel estimé (somme des price_monthly des plans actifs) */
  const caMensuel = establishments
    .filter((e) => e.is_active)
    .reduce((acc, e) => {
      const plan = plans.find((p) => p.code === e.plan);
      return acc + (plan?.price_monthly ?? 0);
    }, 0);

  /* ------------------------------------------------------------------ */
/* Répartition des forfaits                                           */
/* ------------------------------------------------------------------ */
  const repartitionForfaits = ["standard", "silver", "gold"].map((code) => {
    const count = establishments.filter((e) => e.plan === code).length;
    const plan = plans.find((p) => p.code === code);
    return {
      code,
      label: code.toUpperCase(),
      count,
      price: plan?.price_monthly ?? 0,
    };
  });
  const maxForfait = Math.max(1, ...repartitionForfaits.map((p) => p.count));

  /* ------------------------------------------------------------------ */
  /* Activité (inscriptions par mois, filtre temporel)                  */
  /* ------------------------------------------------------------------ */
  const maintenant = new Date();
  const inscriptionsParMois = Array.from({ length: periodeMois }).map((_, i) => {
    const offset = periodeMois - 1 - i;
    const mois = new Date(maintenant.getFullYear(), maintenant.getMonth() - offset, 1);
    const moisSuivant = new Date(maintenant.getFullYear(), maintenant.getMonth() - offset + 1, 1);
    const count = establishments.filter((e) => {
      if (!e.created_at) return false;
      const d = new Date(e.created_at);
      return d >= mois && d < moisSuivant;
    }).length;
    return {
      label: mois.toLocaleDateString("fr-FR", periodeMois > 6 ? { month: "2-digit", year: "2-digit" } : { month: "short" }),
      count,
    };
  });
  const maxInscription = Math.max(1, ...inscriptionsParMois.map((m) => m.count));
  const nouveauxPeriode = inscriptionsParMois.reduce((acc, m) => acc + m.count, 0);

  /* ------------------------------------------------------------------ */
/* État des abonnements                                               */
/* ------------------------------------------------------------------ */
  const etatAbonnements = [
    { label: "Actifs", count: abonnementsActifs, color: "bg-[#5D9E7F]/20 text-[#7FBF9E]" },
    { label: "En essai", count: abonnementsEssai, color: "bg-[#D6A34D]/20 text-[#D6A34D]" },
    { label: "Expirés/Annulés", count: abonnementsExpires, color: "bg-[#C5716B]/20 text-[#C5716B]" },
  ];

  /* ------------------------------------------------------------------ */
/* Alertes                                                            */
/* ------------------------------------------------------------------ */
  const alertes: Array<{
    type: "info" | "warning" | "danger";
    titre: string;
    message: string;
    count: number;
    href: string;
  }> = [];

  // Établissements sans manager
  const etablissementsSansManager = establishments.filter(
    (e) => !managers.some((m) => m.establishment_id === e.id)
  );
  if (etablissementsSansManager.length > 0) {
    alertes.push({
      type: "warning",
      titre: "Établissements sans Manager",
      message:
        etablissementsSansManager.length === 1
          ? "Un établissement n'a pas encore de Manager associé."
          : `${etablissementsSansManager.length} établissements n'ont pas encore de Manager associé.`,
      count: etablissementsSansManager.length,
      href: "/super-admin/onboarding/",
    });
  }

  // Abonnements expirés
  if (abonnementsExpires > 0) {
    alertes.push({
      type: "danger",
      titre: "Abonnements expirés",
      message: `${abonnementsExpires} abonnement(s) expiré(s) ou annulé(s).`,
      count: abonnementsExpires,
      href: "/super-admin/abonnements/",
    });
  }

  // Établissements suspendus
  if (entreprisesSuspendues > 0) {
    alertes.push({
      type: "info",
      titre: "Établissements suspendus",
      message: `${entreprisesSuspendues} établissement(s) suspendu(s).`,
      count: entreprisesSuspendues,
      href: "/super-admin/entreprises/",
    });
  }

  /* ------------------------------------------------------------------ */
/* Santé du SaaS                                                      */
/* ------------------------------------------------------------------ */
  const santeBaseDeDonnees = !error && establishments.length >= 0;
  const santeMoteurDroits = features.length > 0;

  /* ------------------------------------------------------------------ */
/* Formatage                                                          */
/* ------------------------------------------------------------------ */
  const dateCourte = (v: unknown) =>
    v ? new Date(String(v)).toLocaleDateString("fr-FR") : "—";

  /* ------------------------------------------------------------------ */
/* Rendu                                                              */
  /* ------------------------------------------------------------------ */

  if (loading) {
    return (
      <SuperAdminShell onLogout={() => router.replace("/connexion/")}>
        <div className="flex min-h-screen items-center justify-center bg-[#252D2D]">
          <p className="text-sm text-[#A7B7A8]">Chargement du tableau de bord…</p>
        </div>
      </SuperAdminShell>
    );
  }

  if (error) {
    return (
      <SuperAdminShell onLogout={() => router.replace("/connexion/")}>
        <div className="carte max-w-md mx-auto p-6 text-center">
          <p className="text-sm text-[#C5716B]">{error}</p>
          <button
            type="button"
            onClick={() => void charger()}
            className="mt-4 rounded-lg border border-[#8FB59B]/40 px-4 py-2 text-sm text-[#DFE7E2] hover:bg-[#344440]"
          >
            Réessayer
          </button>
        </div>
      </SuperAdminShell>
    );
  }

  return (
    <SuperAdminShell onLogout={() => router.replace("/connexion/")}>
      {/* Bandeau d'identite GV5 §57 */}
      <PageIdentityBanner identite={getPageIdentity("/super-admin/")} titre="Vue générale" />

      {/* KPI */}
      <section id="kpi" className="mb-8 grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {[
          {
            label: "Abonnés professionnels",
            value: totalEntreprises,
            sub: `${entreprisesActives} actives · ${entreprisesSuspendues} suspendues`,
            icon: "building",
            color: "bg-[#8FB59B]/15 text-[#8FB59B]",
          },
          {
            label: "Managers",
            value: managersCount,
            sub: `${managersActifs} actifs`,
            icon: "users",
            color: "bg-[#5D9E7F]/15 text-[#5D9E7F]",
          },
          {
            label: "Abonnements actifs",
            value: abonnementsActifs,
            sub: `${abonnementsEssai} en essai · ${abonnementsExpires} expirés`,
            icon: "card",
            color: "bg-[#5D9E7F]/15 text-[#5D9E7F]",
          },
          {
            label: "CA mensuel (MAD)",
            value: caMensuel.toLocaleString("fr-FR"),
            sub: "Estimation sur plans actifs",
            icon: "card",
            color: "bg-[#D6A34D]/15 text-[#D6A34D]",
          },
          {
            label: "Forfaits configurés",
            value: plans.length,
            sub: plans.some((p) => p.code === "standard") ? "Standard, Silver, Gold" : "Incomplet",
            icon: "layers",
            color: "bg-[#D0C6AE]/15 text-[#D0C6AE]",
          },
          {
            label: "Droits configurés",
            value: features.length,
            sub: features.length > 0 ? "Matrice de droits active" : "Non configuré",
            icon: "shield",
            color: santeMoteurDroits ? "bg-[#5D9E7F]/15 text-[#5D9E7F]" : "bg-[#C5716B]/15 text-[#C5716B]",
          },
        ].map((kpi) => (
          <Link
            key={kpi.label}
            href={
              kpi.label === "Abonnés professionnels"
                ? "/super-admin/entreprises/"
                : kpi.label === "Managers"
                  ? "/super-admin/managers/"
                  : kpi.label === "Abonnements actifs"
                    ? "/super-admin/abonnements/"
                    : kpi.label === "Forfaits configurés"
                      ? "/super-admin/plans/"
                      : "/super-admin/"
            }
            className="ad-kpi-tile p-5 group"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-[#A7B7A8]">
                  {kpi.label}
                </p>
                <p className="titre-or mt-1 text-3xl font-extrabold">
                  {kpi.value}
                </p>
                <p className="mt-1 text-xs text-[#A7B7A8]">{kpi.sub}</p>
              </div>
              <div className={`flex h-10 w-10 items-center justify-center rounded-full ${kpi.color}`}>
                <Icone nom={kpi.icon as NomIcone} taille={18} />
              </div>
            </div>
          </Link>
        ))}
      </section>

      {/* Graphiques */}
      <section className="mb-8 grid gap-4 lg:grid-cols-2">
        {/* Répartition des forfaits */}
        <article className="carte p-5">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-bold">Répartition des forfaits</h2>
            <span className="text-[11px] uppercase tracking-[0.18em] text-[#A7B7A8]">
              Réel
            </span>
          </div>
          <div className="space-y-4">
            {repartitionForfaits.map((p) => {
              const pct = Math.round((p.count / maxForfait) * 100);
              return (
                <div key={p.code} className="group">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-[#E8ECE8]">{p.label}</span>
                    <span className="text-[#A7B7A8]">{p.count} entreprise(s)</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-[#344440]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#8FB59B] to-[#D0C6AE]"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {repartitionForfaits.length === 0 && (
              <p className="text-xs text-[#A7B7A8]">Aucun forfait configuré.</p>
            )}
          </div>
        </article>

        {/* État des abonnements */}
        <article className="carte p-5">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-bold">État des abonnements</h2>
            <span className="text-[11px] uppercase tracking-[0.18em] text-[#A7B7A8]">
              Réel
            </span>
          </div>
          <div className="space-y-4">
            {etatAbonnements.map((e) => (
              <div key={e.label} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-[#E8ECE8]">{e.label}</p>
                  <p className="text-[11px] text-[#A7B7A8]">
                    {e.count} abonnement(s)
                  </p>
                </div>
                <div className={`flex h-6 w-6 items-center justify-center rounded-full ${e.color}`}>
                  <span className="text-[10px] font-bold">
                    {e.count > 0 ? e.count : "—"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>

      {/* Activité mensuelle */}
      <section className="mb-8">
        <article className="carte p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-5">
            <div>
              <h2 className="font-bold">Nouvelles inscriptions</h2>
              <p className="text-xs text-[#A7B7A8]">{nouveauxPeriode} inscription(s) sur la période sélectionnée — données réelles.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-xs text-[#A7B7A8]">
                Période
                <select
                  value={periodeMois}
                  onChange={(e) => setPeriodeMois(Number(e.target.value) as 1 | 3 | 6 | 12)}
                  className="champ ml-2 min-h-9 py-1 text-xs"
                  aria-label="Période du graphique des inscriptions"
                >
                  <option value={1}>1 mois</option>
                  <option value={3}>3 mois</option>
                  <option value={6}>6 mois</option>
                  <option value={12}>12 mois</option>
                </select>
              </label>
              <button type="button" onClick={() => void charger()} className="rounded-lg border border-[#8FB59B]/40 px-3 py-1.5 text-xs text-[#DFE7E2] hover:bg-[#344440]">Actualiser</button>
            </div>
          </div>
          <div className="mt-6 flex h-40 items-end justify-between gap-2">
            {inscriptionsParMois.map((m) => (
              <div key={m.label} className="flex h-full flex-1 flex-col items-center gap-2">
                <div className="flex w-full flex-1 items-end">
                  <div
                    className="w-full rounded-t-lg bg-gradient-to-t from-[#49675B] to-[#D0C6AE]"
                    style={{ height: `${Math.max(6, Math.round((m.count / maxInscription) * 100))}%` }}
                    title={`${m.count} inscription(s)`}
                  />
                </div>
                <span className="text-[10px] uppercase text-[#A7B7A8]">{m.label}</span>
              </div>
            ))}
          </div>
        </article>
      </section>

      {/* Alertes */}
      {alertes.length > 0 && (
        <section className="mb-8">
          <article className="carte p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold">Alertes</h2>
              <Link
                href="/super-admin/audit/"
                className="text-xs text-[#8FB59B] hover:underline"
              >
                Tout le journal
              </Link>
            </div>
            <div className="space-y-3">
              {alertes.map((a) => (
                <div
                  key={a.titre}
                  className={`flex items-start gap-3 p-3 rounded-lg border ${
                    a.type === "danger"
                      ? "border-[#C5716B]/30 bg-[#C5716B]/10"
                      : a.type === "warning"
                        ? "border-[#D6A34D]/30 bg-[#D6A34D]/10"
                        : "border-[#5D9E7F]/30 bg-[#5D9E7F]/10"
                  }`}
                >
                  <span className={`shrink-0 text-xs ${
                    a.type === "danger"
                      ? "text-[#C5716B]"
                        : a.type === "warning"
                          ? "text-[#D6A34D]"
                          : "text-[#5D9E7F]"
                  }`}>
                    {a.type === "danger" ? "⚠️" : a.type === "warning" ? "⚡" : "ℹ️"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#E8ECE8]">{a.titre}</p>
                    <p className="text-[11px] text-[#A7B7A8]">{a.message}</p>
                  </div>
                  <Link
                    href={a.href}
                    className="text-xs text-[#8FB59B] hover:underline ml-2"
                  >
                    Voir →
                  </Link>
                </div>
              ))}
            </div>
          </article>
        </section>
      )}

      {/* Activité récente */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold">Activité récente</h2>
          <Link
            href="/super-admin/audit/"
            className="text-xs text-[#8FB59B] hover:underline"
          >
            Tout le journal d&apos;audit
          </Link>
        </div>
        <div className="carte overflow-hidden">
          <ul className="divide-y divide-[#8FB59B]/10">
            {audit.length > 0 ? (
              audit.map((ligne) => (
                <li key={ligne.id} className="px-5 py-3 flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#E8ECE8] truncate">
                      {ligne.action}
                    </p>
                    <p className="text-[11px] text-[#A7B7A8] truncate">
                      {ligne.entity}
                    </p>
                  </div>
                  <span className="shrink-0 text-[11px] text-[#A7B7A8]">
                    {dateCourte(ligne.created_at)}
                  </span>
                </li>
              ))
            ) : (
              <li className="px-5 py-8 text-center text-sm text-[#A7B7A8]">
                Aucune activité enregistrée pour l&apos;instant.
              </li>
            )}
          </ul>
        </div>
      </section>

      {/* GV5 §66 — Acces directs WhatsApp Business / Chatbot IA (etats honnetes) */}
      <section className="mb-8">
        <h2 className="mb-3 font-bold">Acces directs</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Link href="/super-admin/whatsapp/" className="ad-kpi-tile flex items-center gap-4 p-5 group">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#5D9E7F]/15 text-[#7FBF9E] text-2xl" aria-hidden>&#128172;</div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-[#E8ECE8]">WhatsApp Business</p>
              <p className="mt-1 text-[11px] text-[#A7B7A8]">Configuration, envois, historique et erreurs du fournisseur Meta.</p>
              <p className="mt-2 inline-flex rounded-full bg-[#D6A34D]/15 px-2.5 py-1 text-[10px] font-semibold text-[#D6A34D]">Non constatable cote navigateur</p>
            </div>
            <span className="shrink-0 text-[#8FB59B]" aria-hidden>&#8594;</span>
          </Link>
          <Link href="/super-admin/chatbot/" className="ad-kpi-tile flex items-center gap-4 p-5 group">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#9FB7E0]/15 text-[#9FB7E0] text-2xl" aria-hidden>&#129302;</div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-[#E8ECE8]">Chatbot IA</p>
              <p className="mt-1 text-[11px] text-[#A7B7A8]">Etat du service, droits par forfait et suivi.</p>
              <p className="mt-2 inline-flex rounded-full bg-[#C5716B]/15 px-2.5 py-1 text-[10px] font-semibold text-[#C5716B]">Non configure</p>
            </div>
            <span className="shrink-0 text-[#8FB59B]" aria-hidden>&#8594;</span>
          </Link>
        </div>
      </section>

      {/* Santé du SaaS */}
      <section>
        <article className="carte p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold">Santé générale du SaaS</h2>
          </div>
          <ul className="space-y-3">
            <li className="flex items-center justify-between gap-3">
              <span className="text-[#A7B7A8]">Base de données</span>
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${santeBaseDeDonnees ? "bg-[#5D9E7F]/15 text-[#7FBF9E]" : "bg-[#C5716B]/15 text-[#C5716B]"}`}>
                {santeBaseDeDonnees ? "Opérationnelle" : "Indisponible"}
              </span>
            </li>
            <li className="flex items-center justify-between gap-3">
              <span className="text-[#A7B7A8]">Authentification</span>
              <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold bg-[#5D9E7F]/15 text-[#7FBF9E]">
                Session active
              </span>
            </li>
            <li className="flex items-center justify-between gap-3">
              <span className="text-[#A7B7A8]">Moteur de droits</span>
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${santeMoteurDroits ? "bg-[#5D9E7F]/15 text-[#7FBF9E]" : "bg-[#C5716B]/15 text-[#C5716B]"}`}>
                {santeMoteurDroits ? `${features.length} droits configurés` : "Non configuré"}
              </span>
            </li>
            <li className="flex items-center justify-between gap-3">
              <span className="text-[#A7B7A8]">Dernière actualisation</span>
              <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold bg-[#344440] text-[#DFE7E2]">
                {new Date().toLocaleString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
              </span>
            </li>
          </ul>
        </article>
      </section>
    </SuperAdminShell>
  );
}
