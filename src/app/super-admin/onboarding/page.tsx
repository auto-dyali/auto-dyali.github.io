"use client";

/**
 * AUTO DYALI — Super Admin › Nouvel abonné
 * Parcours complet : entreprise + établissement + Manager (invitation
 * email) + abonnement + droits du forfait.
 *
 * Nécessite la migration 0028 (NON appliquée par défaut) et l'Edge
 * Function `onboard-tenant` (NON déployée par défaut). Sans elles,
 * la création échoue avec un message explicite — aucun état fantôme.
 */

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase-browser";
import { ModulePage } from "@/components/super-admin-module-page";
import { ModuleHeader } from "@/components/super-admin-page";
import { buildRequestId, slugify, validateOnboardingInput } from "@/lib/onboarding";
import { useNotification } from "@/lib/use-notification";

type Form = {
  companyName: string;
  slug: string;
  city: string;
  phone: string;
  email: string;
  plan: string;
  trialDays: number;
  managerName: string;
  managerEmail: string;
  managerPhone: string;
};

const ETAPES = [
  { n: 1, label: "Entreprise" },
  { n: 2, label: "Manager" },
  { n: 3, label: "Forfait & essai" },
] as const;

export default function OnboardingPage() {
  const [etape, setEtape] = useState<1 | 2 | 3>(1);
  const [requestId, setRequestId] = useState(() => buildRequestId());
  const [form, setForm] = useState<Form>({
    companyName: "",
    slug: "",
    city: "",
    phone: "",
    email: "",
    plan: "silver",
    trialDays: 14,
    managerName: "",
    managerEmail: "",
    managerPhone: "",
  });
  const [slugTouche, setSlugTouche] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [resultat, setResultat] = useState<Record<string, unknown> | null>(null);

  const { success, error: notifyError, warning: notifyWarning, info } = useNotification();

  type Plan = {
    code: string;
    label: string;
    description: string | null;
    price_monthly: number | null;
    price_yearly: number | null;
    trial_days: number;
    max_users: number;
    max_sites: number;
    storage_mb: number;
  };
  type FeatureRow = { plan_code: string; feature_key: string; enabled: boolean };

  const [plansReels, setPlansReels] = useState<Plan[]>([]);
  const [featuresReels, setFeaturesReels] = useState<FeatureRow[]>([]);
  const [chargementPlans, setChargementPlans] = useState(true);
  const [erreurPlans, setErreurPlans] = useState<string | null>(null);

  useEffect(() => {
    let vivant = true;
    void (async () => {
      if (!supabase) {
        if (vivant) setChargementPlans(false);
        return;
      }
      const [p, f] = await Promise.all([
        supabase.from("plans").select("code, label, description, price_monthly, price_yearly, trial_days, max_users, max_sites, storage_mb").order("price_monthly"),
        supabase.from("plan_features").select("plan_code, feature_key, enabled"),
      ]);
      if (!vivant) return;
      if (p.error || f.error) setErreurPlans(p.error?.message ?? f.error?.message ?? "Plans indisponibles");
      const plans = (p.data ?? []) as Plan[];
      setPlansReels(plans);
      setFeaturesReels((f.data ?? []) as FeatureRow[]);
      if (plans.length > 0 && !plans.some((pl) => pl.code === form.plan)) {
        setForm((f) => ({ ...f, plan: plans[0].code }));
      }
      setChargementPlans(false);
    })();
    return () => { vivant = false; };
  }, []);

  const planActif = plansReels.find((p) => p.code === form.plan);
  const featuresDuPlan = (code: string) => featuresReels.filter((f) => f.plan_code === code && f.enabled).map((f) => f.feature_key);

  const erreurs = useMemo(
    () =>
      validateOnboardingInput({
        companyName: form.companyName,
        slug: form.slug,
        city: form.city,
        phone: form.phone,
        email: form.email,
        plan: form.plan,
        managerName: form.managerName,
        managerEmail: form.managerEmail,
        managerPhone: form.managerPhone,
        trialDays: form.trialDays,
      }),
    [form]
  );
  const etapeValide = (n: number): boolean => {
    if (n === 1) return !erreurs.companyName && !erreurs.slug && !erreurs.email;
    if (n === 2) return !erreurs.managerName && !erreurs.managerEmail;
    return Object.keys(erreurs).length === 0;
  };

  function modifier<K extends keyof Form>(cle: K, valeur: Form[K]) {
    setForm((f) => {
      const suivant = { ...f, [cle]: valeur };
      if (cle === "companyName" && !slugTouche) suivant.slug = slugify(String(valeur));
      return suivant;
    });
  }

  async function soumettre(e: FormEvent) {
    e.preventDefault();
    if (!supabase) {
      notifyError({ title: "Supabase non configuré", message: "La variable d'environnement Supabase est manquante." });
      return;
    }
    if (Object.keys(erreurs).length > 0) {
      notifyWarning({ title: "Champs invalides", message: "Corrigez les champs en rouge avant de valider." });
      return;
    }
    setEnCours(true);
    try {
      const { data, error } = await supabase.functions.invoke("onboard-tenant", {
        body: {
          requestId,
          companyName: form.companyName.trim(),
          slug: form.slug.trim(),
          city: form.city.trim() || null,
          phone: form.phone.trim() || null,
          email: form.email.trim() || null,
          plan: form.plan,
          trialDays: form.trialDays,
          managerName: form.managerName.trim(),
          managerEmail: form.managerEmail.trim(),
          managerPhone: form.managerPhone.trim() || null,
        },
      });
      if (error) {
        // Extraire le message métier précis depuis la réponse JSON du serveur
        let messageServeur = error.message ?? "Erreur inconnue";
        try {
          const ctx = (error as { context?: { json?: () => Promise<unknown> } }).context;
          const corpsResponse = await ctx?.json?.();
          const corpsErreur = (corpsResponse ?? {}) as { error?: string | { message?: string } };
          const messageBrut =
            typeof corpsErreur.error === "string"
              ? corpsErreur.error
              : corpsErreur.error && typeof corpsErreur.error === "object"
                ? (corpsErreur.error as { message?: string }).message
                : null;
          if (messageBrut) messageServeur = messageBrut;
        } catch {
          // Corps indisponible : on conserve le message standard.
        }
        if (messageServeur.includes("Function not found") || messageServeur.includes("404")) {
          messageServeur =
            "La fonction `onboard-tenant` n'est pas déployée. Déploiement + migration 0028 requis.";
        }
        notifyError({ title: "Échec de l'onboarding", message: messageServeur });
        return;
      }
      const corps = (data ?? {}) as Record<string, unknown>;
      if (corps.ok === false) {
        notifyError({
          title: "Échec de l'onboarding",
          message: typeof corps.error === "string" ? corps.error : "Échec de l'onboarding.",
        });
        return;
      }
      setResultat(corps);
      setRequestId(buildRequestId());
      success({
        title: "Abonné créé avec succès",
        message: `L'entreprise, l'abonnement et le compte Manager ont été provisionnés (réponse serveur acceptée). L'invitation doit être confirmée côté fournisseur.`,
        duration: 6000,
      });
    } catch (err) {
      notifyError({
        title: "Erreur inattendue",
        message: err instanceof Error ? err.message : "Création impossible.",
      });
    } finally {
      setEnCours(false);
    }
  }

  if (resultat) {
    const idempotent = resultat.idempotent === true;
    return (
      <ModulePage titre="Nouvel abonné">
        <ModuleHeader surtitre="AUTO DYALI · Onboarding" titre="Abonné créé" description="L'entreprise, l'abonnement et le compte Manager ont été provisionnés." />
        <div className="carte-premium mt-6 border-l-4 border-[#5D9E7F] p-6">
          <h2 className="font-bold text-[#E8ECE8]">{idempotent ? "Demande déjà traitée (idempotence)" : "Création terminée"}</h2>
          <p className="mt-2 text-sm text-[#A7B7A8]">
            {idempotent
              ? "Cette demande était déjà enregistrée : aucune donnée n'a été dupliquée."
              : "L'invitation doit être confirmée côté fournisseur. Aucun mot de passe n'est transmis en clair."}
          </p>
          <dl className="mt-4 grid gap-2 text-xs text-[#A7B7A8] sm:grid-cols-2">
            <div><dt className="uppercase">Établissement</dt><dd className="font-mono text-[#E8ECE8]">{String(resultat.establishment_id ?? "—")}</dd></div>
            <div><dt className="uppercase">Abonnement</dt><dd className="font-mono text-[#E8ECE8]">{String(resultat.subscription_id ?? "—")}</dd></div>
            <div><dt className="uppercase">Manager Auth</dt><dd className="font-mono text-[#E8ECE8]">{String(resultat.manager_user_id ?? "—")}</dd></div>
            <div><dt className="uppercase">Requête</dt><dd className="font-mono text-[#E8ECE8]">{String(resultat.request_id ?? "—")}</dd></div>
          </dl>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link href="/super-admin/entreprises/" className="btn-or px-4 py-2 text-sm">Voir les entreprises</Link>
            <Link href="/super-admin/onboarding/" className="rounded-lg border border-[#8FB59B]/40 px-4 py-2 text-sm text-[#DFE7E2] hover:bg-[#344440]" onClick={() => setResultat(null)}>Créer un autre abonné</Link>
          </div>
        </div>
      </ModulePage>
    );
  }

  return (
    <ModulePage titre="Nouvel abonné">
      <ModuleHeader
        surtitre="AUTO DYALI · Onboarding"
        titre="Nouvel abonné"
        description="Création complète et sécurisée : entreprise, établissement, Manager (invitation email) et abonnement aux droits du forfait choisi."
      />

      <form onSubmit={soumettre} className="carte-premium mt-6 p-6">
        {/* Étapes */}
        <ol className="flex items-center gap-2 sm:gap-6">
          {ETAPES.map((e) => (
            <li key={e.n} className="flex items-center gap-2">
              <button type="button" onClick={() => setEtape(e.n as 1 | 2 | 3)} aria-current={etape === e.n ? "step" : undefined} className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${etape === e.n ? "bg-[#8FB59B] text-[#252D2D]" : "bg-[#344440] text-[#A7B7A8]"}`}>{e.n}</button>
              <span className={`text-xs uppercase tracking-wide ${etape === e.n ? "text-[#E8ECE8]" : "text-[#A7B7A8]"}`}>{e.label}</span>
            </li>
          ))}
        </ol>

        {/* Étape 1 — Entreprise */}
        {etape === 1 && (
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <label className="text-xs text-[#A7B7A8] sm:col-span-2">Nom de l&apos;entreprise *
              <input required value={form.companyName} onChange={(e) => modifier("companyName", e.target.value)} className="champ mt-1 min-h-11" placeholder="Garage Atlas SARL" />
            </label>
            <label className="text-xs text-[#A7B7A8]">Slug *
              <input required value={form.slug} onChange={(e) => { setSlugTouche(true); modifier("slug", e.target.value.toLowerCase()); }} className="champ mt-1 min-h-11" placeholder="garage-atlas" aria-describedby="slug-aide" />
              <span id="slug-aide" className="mt-1 block text-[10px] text-[#A7B7A8]">Généré automatiquement, modifiable.</span>
              {erreurs.slug && <span className="mt-1 block text-[11px] text-[#C5716B]">{erreurs.slug}</span>}
            </label>
            <label className="text-xs text-[#A7B7A8]">Ville
              <input value={form.city} onChange={(e) => modifier("city", e.target.value)} className="champ mt-1 min-h-11" placeholder="Casablanca" />
            </label>
            <label className="text-xs text-[#A7B7A8]">Téléphone
              <input value={form.phone} onChange={(e) => modifier("phone", e.target.value)} className="champ mt-1 min-h-11" placeholder="0522000000" inputMode="tel" />
            </label>
            <label className="text-xs text-[#A7B7A8]">Email de l&apos;entreprise (optionnel)
              <input type="email" value={form.email} onChange={(e) => modifier("email", e.target.value)} className="champ mt-1 min-h-11" placeholder="contact@garage-atlas.ma" />
              {erreurs.email && <span className="mt-1 block text-[11px] text-[#C5716B]">{erreurs.email}</span>}
            </label>
          </div>
        )}

        {/* Étape 2 — Manager */}
        {etape === 2 && (
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <label className="text-xs text-[#A7B7A8] sm:col-span-2">Nom complet du Manager *
              <input required value={form.managerName} onChange={(e) => modifier("managerName", e.target.value)} className="champ mt-1 min-h-11" placeholder="Youssef Alami" />
              {erreurs.managerName && <span className="mt-1 block text-[11px] text-[#C5716B]">{erreurs.managerName}</span>}
            </label>
            <label className="text-xs text-[#A7B7A8]">Email professionnel *
              <input required type="email" value={form.managerEmail} onChange={(e) => modifier("managerEmail", e.target.value)} className="champ mt-1 min-h-11" placeholder="y.alami@garage-atlas.ma" />
              {erreurs.managerEmail && <span className="mt-1 block text-[11px] text-[#C5716B]">{erreurs.managerEmail}</span>}
            </label>
            <label className="text-xs text-[#A7B7A8]">Téléphone
              <input value={form.managerPhone} onChange={(e) => modifier("managerPhone", e.target.value)} className="champ mt-1 min-h-11" placeholder="0600000000" inputMode="tel" />
            </label>
            <p className="text-[11px] leading-5 text-[#A7B7A8] sm:col-span-2">
              Le Manager recevra un email d’invitation pour définir son mot de passe — aucun mot de passe ne transite par cette interface. L’invitation est créée côté serveur (Edge Function sécurisée).
            </p>
          </div>
        )}

        {/* Étape 3 — Forfait (données réelles depuis Supabase) */}
        {etape === 3 && (
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <label className="text-xs text-[#A7B7A8] sm:col-span-2">Forfait *
              {chargementPlans ? (
                <p className="champ mt-1 min-h-11 pt-3 text-[#A7B7A8]">Chargement des forfaits…</p>
              ) : plansReels.length === 0 ? (
                <p role="alert" className="mt-1 rounded-lg bg-[#D6A34D]/10 px-4 py-3 text-xs text-[#D6A34D]">Aucun forfait détecté (migration 0009 non appliquée ?) — vérifiez les accès plans dans Supabase.</p>
              ) : (
                <select value={form.plan} onChange={(e) => { const p = plansReels.find((x) => x.code === e.target.value); modifier("plan", e.target.value); if (p) modifier("trialDays", p.trial_days); }} className="champ mt-1 min-h-11">
                  {plansReels.map((p) => <option key={p.code} value={p.code}>{p.label}</option>)}
                </select>
              )}
            </label>

            {planActif && (
              <div className="rounded-xl border border-[#8FB59B]/20 bg-[#2C3735] p-4 text-xs text-[#A7B7A8] sm:col-span-2">
                <p className="text-[10px] uppercase tracking-[0.2em] text-[#D0C6AE]">{planActif.label} — caractéristiques réelles</p>
                <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                  <li>Prix mensuel : <span className="text-[#E8ECE8]">{planActif.price_monthly != null ? `${planActif.price_monthly} MAD` : "non configuré"}</span></li>
                  <li>Prix annuel : <span className="text-[#E8ECE8]">{planActif.price_yearly != null ? `${planActif.price_yearly} MAD` : "non configuré"}</span></li>
                  <li>Essai : <span className="text-[#E8ECE8]">{planActif.trial_days} j</span></li>
                  <li>Utilisateurs max : <span className="text-[#E8ECE8]">{planActif.max_users}</span></li>
                  <li>Établissements max : <span className="text-[#E8ECE8]">{planActif.max_sites}</span></li>
                  <li>Stockage : <span className="text-[#E8ECE8]">{planActif.storage_mb} Mo</span></li>
                </ul>
                {planActif.description && <p className="mt-2 text-[11px] leading-5">{planActif.description}</p>}
                {featuresDuPlan(planActif.code).length > 0 && (
                  <p className="mt-2 text-[11px]">Fonctionnalités : <span className="text-[#E8ECE8]">{featuresDuPlan(planActif.code).length}</span> activées pour ce forfait.</p>
                )}
              </div>
            )}
            {erreurPlans && <p role="alert" className="text-[11px] text-[#C5716B]">Erreur plans : {erreurPlans}</p>}

            <label className="text-xs text-[#A7B7A8]">Durée d&apos;essai (jours)
              <input type="number" min={0} max={90} value={form.trialDays} onChange={(e) => modifier("trialDays", Number(e.target.value))} className="champ mt-1 min-h-11" />
              {erreurs.trialDays && <span className="mt-1 block text-[11px] text-[#C5716B]">{erreurs.trialDays}</span>}
            </label>

            {/* Récapitulatif */}
            <div className="rounded-xl border border-[#8FB59B]/15 bg-[#2C3735] p-4 text-xs text-[#A7B7A8] sm:col-span-2">
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#D0C6AE]">Récapitulatif</p>
              <ul className="mt-2 space-y-1">
                <li><span className="text-[#E8ECE8]">Entreprise :</span> {form.companyName || "—"} ({form.slug || "—"})</li>
                <li><span className="text-[#E8ECE8]">Manager :</span> {form.managerName || "—"} — {form.managerEmail || "—"}</li>
                <li><span className="text-[#E8ECE8]">Forfait :</span> {form.plan.toUpperCase()} · {form.trialDays} j d’essai</li>
              </ul>
            </div>
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            {etape > 1 && <button type="button" onClick={() => setEtape((etape - 1) as 1 | 2 | 3)} className="rounded-lg border border-[#8FB59B]/40 px-4 py-2 text-sm text-[#DFE7E2] hover:bg-[#344440]">Précédent</button>}
            {etape < 3 && <button type="button" onClick={() => etapeValide(etape) && setEtape((etape + 1) as 1 | 2 | 3)} disabled={!etapeValide(etape)} className="rounded-lg border border-[#8FB59B]/40 px-4 py-2 text-sm text-[#DFE7E2] hover:bg-[#344440] disabled:opacity-40">Suivant</button>}
          </div>
          <button type="submit" disabled={enCours || !etapeValide(3)} className="btn-or px-6 py-2 text-sm">{enCours ? "Création…" : "Créer l'abonné"}</button>
        </div>

        <p className="mt-4 text-[11px] leading-5 text-[#A7B7A8]">
          Cette création nécessite la migration <code>0028</code> (préparée, non appliquée par défaut) et l’Edge Function <code>onboard-tenant</code> (non déployée par défaut). Sans elles, la demande échouera avec un message explicite — aucune donnée fantôme ne sera créée. Identifiant de demande : <span className="font-mono">{requestId}</span>
        </p>
      </form>
    </ModulePage>
  );
}
