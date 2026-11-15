"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { supabase } from "@/lib/supabase-browser";
import { FEATURE_LABEL } from "@/lib/features";
import { formatMontantMAD } from "@/lib/pre-purchase";

type Plan = {
  code: string;
  label: string;
  description: string | null;
  price_monthly: number | null;
  price_yearly: number | null;
  currency: string | null;
  trial_days: number | null;
  max_users: number | null;
  max_sites: number | null;
  storage_mb: number | null;
  is_active: boolean | null;
};
type FeatureRow = { plan_code: string; feature_key: string; enabled: boolean };

const METIERS = [
  "Garages mécaniques et ateliers multimarques",
  "Centres pneus, géométrie et parallélisme",
  "Carrosserie, peinture et tôlerie",
  "Électricité automobile et diagnostic",
  "Magasins de pièces et accessoires",
  "Lavage, detailing et préparation esthétique",
  "Gestion de flotte et activités automobiles",
];

const FONCTIONNALITES = [
  "Gestion des clients, véhicules et historique",
  "Catalogue produits/services et stock",
  "Point de vente, devis et facturation",
  "Atelier, rendez-vous et suivi d'interventions",
  "Achats, fournisseurs et contrôle des coûts",
  "Rapports, tableaux de bord et indicateurs",
  "Gestion des équipes, rôles et permissions",
  "Support, notifications et modules selon forfait",
];

export default function OffresPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [features, setFeatures] = useState<FeatureRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    let vivant = true;
    void (async () => {
      if (!supabase) {
        if (vivant) { setErreur("Configuration indisponible : les offres n'ont pas pu être chargées."); setLoading(false); }
        return;
      }
      const [p, f] = await Promise.all([
        supabase.from("plans").select("code,label,description,price_monthly,price_yearly,currency,trial_days,max_users,max_sites,storage_mb,is_active").order("price_monthly", { ascending: true, nullsFirst: false }),
        supabase.from("plan_features").select("plan_code,feature_key,enabled"),
      ]);
      if (!vivant) return;
      if (p.error) setErreur(p.error.message);
      else setPlans(((p.data ?? []) as Plan[]).filter((x) => x.is_active !== false));
      if (!f.error) setFeatures((f.data ?? []) as FeatureRow[]);
      setLoading(false);
    })();
    return () => { vivant = false; };
  }, []);

  const featureSet = useMemo(() => {
    const m = new Map<string, boolean>();
    for (const r of features) m.set(`${r.plan_code}:${r.feature_key}`, r.enabled);
    return m;
  }, [features]);

  const keys = useMemo(() => {
    const all = Array.from(new Set(features.map((f) => f.feature_key)));
    return all.length ? all : ["dashboard","clients","vehicles","catalogue","stock","pos","invoices","quotes","support"];
  }, [features]);

  return (
    <main className="min-h-screen bg-[#1f2626] text-[#E8ECE8]">
      <header className="border-b border-[#8FB59B]/20 bg-[#252D2D]/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
          <Logo compact />
          <nav className="flex flex-wrap items-center gap-2 text-sm">
            <Link href="/connexion/" className="rounded-lg border border-[#8FB59B]/30 px-4 py-2 text-[#DFE7E2] hover:bg-[#344440]">Connexion</Link>
            <Link href="/pre-achat/" className="btn-or px-4 py-2">Pré-acheter</Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-5 py-12 lg:py-16">
        <p className="text-[11px] uppercase tracking-[0.3em] text-[#D0C6AE]">AUTO DYALI · Solution SaaS automobile</p>
        <h1 className="titre-or mt-3 max-w-3xl text-3xl font-extrabold leading-tight sm:text-4xl">La plateforme professionnelle pour piloter votre activité automobile</h1>
        <p className="mt-4 max-w-3xl text-base text-[#A7B7A8]">AUTO DYALI aide les entreprises automobiles à gérer leurs opérations, leurs équipes et leurs clients dans un espace sécurisé, multi-entreprises, avec des fonctionnalités adaptées à chaque métier et à chaque forfait.</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/pre-achat/" className="btn-or px-6 py-3 text-sm font-semibold">Demander un pré-achat</Link>
          <a href="#forfaits" className="rounded-lg border border-[#8FB59B]/40 px-6 py-3 text-sm text-[#DFE7E2] hover:bg-[#344440]">Comparer les forfaits</a>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-5 pb-12 lg:grid-cols-2">
        <article className="carte-premium p-6">
          <h2 className="text-lg font-bold">Métiers automobiles pris en charge</h2>
          <ul className="mt-4 grid gap-2 text-sm text-[#C9D3CA] sm:grid-cols-2">
            {METIERS.map((m) => <li key={m} className="rounded-lg bg-[#252D2D]/70 px-3 py-2">• {m}</li>)}
          </ul>
        </article>
        <article className="carte-premium p-6">
          <h2 className="text-lg font-bold">Fonctionnalités principales</h2>
          <ul className="mt-4 grid gap-2 text-sm text-[#C9D3CA]">
            {FONCTIONNALITES.map((f) => <li key={f} className="rounded-lg bg-[#252D2D]/70 px-3 py-2">• {f}</li>)}
          </ul>
        </article>
      </section>

      <section id="forfaits" className="mx-auto max-w-6xl px-5 pb-12">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.25em] text-[#D0C6AE]">Offres & forfaits</p>
            <h2 className="titre-or mt-1 text-2xl font-extrabold">Comparer les abonnements</h2>
            <p className="mt-2 max-w-3xl text-sm text-[#A7B7A8]">Les tarifs, limites et fonctionnalités affichés proviennent de la configuration réelle des offres lorsqu’elle est disponible. Un élément indiqué « Non configuré » n’est pas un prix officiel.</p>
          </div>
        </div>

        {erreur && <p role="alert" className="mt-4 rounded-lg bg-[#C5716B]/15 px-4 py-3 text-sm text-[#C5716B]">{erreur}</p>}

        {loading ? (
          <div className="carte-premium mt-6 p-8 text-sm text-[#A7B7A8]">Chargement des offres…</div>
        ) : plans.length === 0 ? (
          <div className="carte-premium mt-6 p-8 text-sm text-[#A7B7A8]">Aucune offre disponible pour le moment. Les forfaits et tarifs doivent être configurés dans le Super Admin avant publication commerciale définitive.</div>
        ) : (
          <div className="mt-6 grid gap-5 lg:grid-cols-3">
            {plans.map((plan) => (
              <article key={plan.code} className="carte-premium flex flex-col p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="titre-or text-xl font-extrabold">{plan.label || plan.code.toUpperCase()}</h3>
                    <p className="mt-1 text-xs text-[#A7B7A8]">{plan.description || "Forfait AUTO DYALI"}</p>
                  </div>
                  <span className="rounded-full bg-[#344440] px-3 py-1 text-[11px] uppercase text-[#D0C6AE]">{plan.code}</span>
                </div>
                <div className="mt-5 space-y-2 text-sm">
                  <div className="flex justify-between gap-3"><span className="text-[#A7B7A8]">Mensuel</span><span className="font-semibold text-[#E8ECE8]">{formatMontantMAD(plan.price_monthly)}</span></div>
                  <div className="flex justify-between gap-3"><span className="text-[#A7B7A8]">Annuel</span><span className="font-semibold text-[#E8ECE8]">{formatMontantMAD(plan.price_yearly)}</span></div>
                  <div className="flex justify-between gap-3"><span className="text-[#A7B7A8]">Essai</span><span className="text-[#E8ECE8]">{plan.trial_days != null ? `${plan.trial_days} jour(s)` : "Non configuré"}</span></div>
                  <div className="flex justify-between gap-3"><span className="text-[#A7B7A8]">Utilisateurs max</span><span className="text-[#E8ECE8]">{plan.max_users ?? "Non configuré"}</span></div>
                  <div className="flex justify-between gap-3"><span className="text-[#A7B7A8]">Établissements max</span><span className="text-[#E8ECE8]">{plan.max_sites ?? "Non configuré"}</span></div>
                  <div className="flex justify-between gap-3"><span className="text-[#A7B7A8]">Stockage</span><span className="text-[#E8ECE8]">{plan.storage_mb != null ? `${plan.storage_mb} Mo` : "Non configuré"}</span></div>
                </div>
                <div className="mt-5 border-t border-[#8FB59B]/10 pt-4">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-[#A7B7A8]">Fonctionnalités incluses</p>
                  <ul className="mt-3 max-h-64 space-y-1.5 overflow-y-auto pr-1 text-xs">
                    {keys.map((k) => {
                      const ok = featureSet.get(`${plan.code}:${k}`) ?? false;
                      return (
                        <li key={k} className={`flex items-center justify-between gap-2 rounded-md px-2 py-1 ${ok ? "text-[#DFF3E8]" : "text-[#7A8B7D]"}`}>
                          <span>{FEATURE_LABEL[k] ?? k}</span>
                          <span aria-label={ok ? "Inclus" : "Non inclus"}>{ok ? "✓" : "—"}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
                <div className="mt-6">
                  <Link href={`/pre-achat/?plan=${encodeURIComponent(plan.code)}`} className="btn-or block w-full px-4 py-2.5 text-center text-sm font-semibold">Choisir ce forfait</Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-16">
        <div className="carte-premium grid gap-6 p-6 lg:grid-cols-2">
          <div>
            <h2 className="text-lg font-bold">Conditions commerciales & informations</h2>
            <ul className="mt-3 space-y-2 text-sm text-[#C9D3CA]">
              <li>• Les tarifs, limites et modules applicables sont ceux configurés et communiqués au moment de la validation de la demande.</li>
              <li>• Le pré-achat constitue une demande commerciale : il ne vaut pas activation automatique ni confirmation de paiement sans validation explicite.</li>
              <li>• L’abonnement, les options et la période (mensuelle/annuelle) sont confirmés par l’équipe AUTO DYALI avant création du compte.</li>
              <li>• Les données transmises sont utilisées pour l’étude et le suivi de votre demande, conformément à la politique de confidentialité applicable.</li>
            </ul>
          </div>
          <div>
            <h2 className="text-lg font-bold">Prêt à démarrer ?</h2>
            <p className="mt-3 text-sm text-[#A7B7A8]">Renseignez le formulaire de pré-achat pour préparer la création de votre espace professionnel AUTO DYALI (entreprise, Manager, forfait, établissement et modules).</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/pre-achat/" className="btn-or px-5 py-2.5 text-sm font-semibold">Accéder au formulaire de pré-achat</Link>
              <Link href="/connexion/" className="rounded-lg border border-[#8FB59B]/40 px-5 py-2.5 text-sm text-[#DFE7E2] hover:bg-[#344440]">Se connecter</Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
