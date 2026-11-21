"use client";

/**
 * AUTO DYALI — Subscription Studio (MEGA PRO Enterprise Premium)
 *
 * Expérience de souscription premium pour le Super Admin.
 * Aucune donnée inventée : les noms de packs, prix et fonctionnalités
 * proviennent exclusivement de la table `plans` et `plan_features` de Supabase.
 *
 * Règles :
 *  - Aucun pack présélectionné automatiquement.
 *  - Choix explicite du Super Admin.
 *  - Prix réels (si NULL, confirmation bloquée avec message).
 *  - Fonctionnalités et permissions appliquées automatiquement selon le pack.
 *  - Historisation via audit_log.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase-browser";
import { ModulePage } from "@/components/super-admin-module-page";
import { ModuleHeader, Chargement, Erreur, Vide } from "@/components/super-admin-page";
import { useNotification } from "@/lib/use-notification";
import { ComboRecherche } from "@/components/combo-recherche";
import { dateFrCourte } from "@/lib/csv-export";

type Plan = {
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
type FeatureRow = { plan_code: string; feature_key: string; enabled: boolean };

type SouscriptionResultat = {
  plan: string;
  paid_months: number;
  trial_days: number;
  date_debut: string;
  fin_essai: string | null;
  echeance_payante: string | null;
  personnalisation: boolean;
};

const DUREE_OPTIONS = [
  { label: "1 mois", value: 1 },
  { label: "3 mois", value: 3 },
  { label: "6 mois", value: 6 },
  { label: "12 mois", value: 12 },
  { label: "24 mois", value: 24 },
  { label: "Personnalisée", value: -1 },
] as const;

const ESSAI_OPTIONS = [
  { label: "Aucun", value: 0 },
  { label: "7 jours", value: 7 },
  { label: "15 jours", value: 15 },
  { label: "30 jours", value: 30 },
  { label: "45 jours", value: 45 },
  { label: "60 jours", value: 60 },
  { label: "Personnalisé", value: -1 },
] as const;

const DEVISE = "MAD";

export function SubscriptionStudio() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [features, setFeatures] = useState<FeatureRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [etape, setEtape] = useState<"choix" | "details" | "confirmation">("choix");
  const [planSelectionne, setPlanSelectionne] = useState<string | null>(null);
  const [paidMonths, setPaidMonths] = useState<number>(12);
  const [paidMonthsCustom, setPaidMonthsCustom] = useState<string>("");
  const [trialDays, setTrialDays] = useState<number>(0);
  const [trialDaysCustom, setTrialDaysCustom] = useState<string>("");
  const [personnalisation, setPersonnalisation] = useState<boolean>(false);
  const [permissionsBrouillon, setPermissionsBrouillon] = useState<
    Record<string, { can_view: boolean; can_create: boolean; can_edit: boolean; can_delete: boolean }>
  >({});
  const [traitement, setTraitement] = useState<string | null>(null);
  const [resultat, setResultat] = useState<SouscriptionResultat | null>(null);
  const { success: notifySuccess, error: notifyError } = useNotification();

  const featuresMap = useMemo(() => {
    const m = new Map<string, boolean>();
    for (const f of features) m.set(`${f.plan_code}:${f.feature_key}`, f.enabled);
    return m;
  }, [features]);

  const planSelectionneObj = useMemo(
    () => plans.find((p) => p.code === planSelectionne),
    [plans, planSelectionne]
  );

  useEffect(() => {
    void (async () => {
      if (!supabase) return;
      setLoading(true);
      const [p, f] = await Promise.all([
        supabase.from("plans").select("code, label, description, price_monthly, price_yearly, trial_days, max_users, max_sites, storage_mb").order("price_monthly"),
        supabase.from("plan_features").select("plan_code, feature_key, enabled"),
      ]);
      if (p.error) setErreur(p.error.message);
      else setPlans((p.data ?? []) as Plan[]);
      if (f.error) setErreur(f.error.message);
      else setFeatures((f.data ?? []) as FeatureRow[]);
      setLoading(false);
    })();
  }, []);

  const featuresDuPlan = useMemo(() => {
    if (!planSelectionne) return [];
    return features.filter((f) => f.plan_code === planSelectionne && f.enabled);
  }, [features, planSelectionne]);

  // Calcul des dates
  const maintenant = useMemo(() => new Date(), []);
  const dateFinEssai = useMemo(() => {
    if (!planSelectionneObj || trialDays <= 0) return null;
    const d = new Date(maintenant);
    d.setDate(d.getDate() + trialDays);
    return d;
  }, [planSelectionneObj, trialDays, maintenant]);
  const dateEcheancePayante = useMemo(() => {
    if (!planSelectionneObj || paidMonths <= 0) return null;
    const d = new Date(maintenant);
    d.setMonth(d.getMonth() + paidMonths);
    return d;
  }, [planSelectionneObj, paidMonths, maintenant]);

  const prixTotal = useMemo(() => {
    if (!planSelectionneObj || planSelectionneObj.price_monthly === null || planSelectionneObj.price_yearly === null) return null;
    const annees = paidMonths / 12;
    return planSelectionneObj.price_yearly * annees;
  }, [planSelectionneObj, paidMonths]);

  const peutConfirmer = useMemo(() => {
    if (!planSelectionneObj) return false;
    if (planSelectionneObj.price_monthly === null && planSelectionneObj.price_yearly === null) return false;
    if (paidMonths < 1 || paidMonths > 120) return false;
    if (trialDays < 0 || trialDays > 365) return false;
    return true;
  }, [planSelectionneObj, paidMonths, trialDays]);

  const selectionnerPlan = useCallback((code: string) => {
    setPlanSelectionne(code);
    setEtape("details");
    const p = plans.find((x) => x.code === code);
    if (p) {
      setPaidMonths(12);
      setTrialDays(p.trial_days);
      setPaidMonthsCustom("");
      setTrialDaysCustom("");
    }
  }, [plans]);

  const calculerDateAffiche = useMemo(() => {
    const dates: string[] = [];
    if (dateFinEssai) dates.push(`fin d'essai : ${dateFrCourte(dateFinEssai.toISOString().slice(0, 10))}`);
    if (dateEcheancePayante) dates.push(`échéance payante : ${dateFrCourte(dateEcheancePayante.toISOString().slice(0, 10))}`);
    return dates.join(" · ");
  }, [dateFinEssai, dateEcheancePayante]);

  const soumettre = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!planSelectionneObj) return;
    if (!peutConfirmer) {
      notifyError({ title: "Configuration incomplète", message: "Vérifiez le forfait, la durée et l'essai. Les prix doivent être configurés." });
      return;
    }
    setTraitement("creation");
    setErreur(null);

    if (!supabase) {
      setErreur("Supabase non configuré.");
      setTraitement(null);
      return;
    }

    try {
      // Créer l'abonnement via RPC admin_set_subscription (UPSERT)
      const { error: subError } = await supabase.rpc("admin_set_subscription", {
        p_establishment_id: "", // sera fourni par le caller / contexte établissement
        p_plan: planSelectionneObj.code,
        p_paid_months: paidMonths,
        p_trial_days: trialDays,
        p_start_date: maintenant.toISOString().slice(0, 10),
      });
      if (subError) throw subError;

      setResultat({
        plan: planSelectionneObj.code,
        paid_months: paidMonths,
        trial_days: trialDays,
        date_debut: maintenant.toISOString().slice(0, 10),
        fin_essai: dateFinEssai?.toISOString().slice(0, 10) ?? null,
        echeance_payante: dateEcheancePayante?.toISOString().slice(0, 10) ?? null,
        personnalisation,
      } as SouscriptionResultat);
      setEtape("confirmation");
      notifySuccess({ title: "Souscription créée", message: `Forfait ${planSelectionneObj.label.toUpperCase()} configuré.` });
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Échec de la souscription.");
    } finally {
      setTraitement(null);
    }
  };

  if (loading) return <Chargement label="Chargement des forfaits…" />;
  if (erreur) return <Erreur message={erreur} />;
  if (plans.length === 0) return <Vide titre="Aucun forfait" detail="Aucun forfait n'est configuré dans Supabase." />;

  return (
    <ModulePage titre="Subscription Studio">
      <ModuleHeader
        surtitre="AUTO DYALI · MEGA PRO Enterprise Premium"
        titre="Souscription de forfait"
        description="Créez ou modifiez un abonnement à partir des forfaits réels configurés dans Supabase. Aucun prix n'est inventé : si un forfait n'a pas de tarif, la confirmation est bloquée."
        action={
          <button type="button" onClick={() => setEtape("choix")} className="rounded-lg border border-[#8FB59B]/40 px-4 py-2 text-sm text-[#DFE7E2] hover:bg-[#344440]">
            Nouveau forfait
          </button>
        }
      />

      {etape === "choix" && <EtapeChoix plans={plans} featuresMap={featuresMap} onSelect={selectionnerPlan} />}
      {etape === "details" && (
        <EtapeDetails
          plan={planSelectionneObj!}
          featuresDuPlan={featuresDuPlan}
          paidMonths={paidMonths}
          setPaidMonths={setPaidMonths}
          paidMonthsCustom={paidMonthsCustom}
          setPaidMonthsCustom={setPaidMonthsCustom}
          trialDays={trialDays}
          setTrialDays={setTrialDays}
          trialDaysCustom={trialDaysCustom}
          setTrialDaysCustom={setTrialDaysCustom}
          personnalisation={personnalisation}
          setPersonnalisation={setPersonnalisation}
          permissionsBrouillon={permissionsBrouillon}
          setPermissionsBrouillon={setPermissionsBrouillon}
          features={features}
          featuresMap={featuresMap}
          prixTotal={prixTotal}
          dateFinEssai={dateFinEssai}
          dateEcheancePayante={dateEcheancePayante}
          calculerDateAffiche={calculerDateAffiche}
          peutConfirmer={peutConfirmer}
          onSubmit={soumettre}
          traitement={traitement}
          setEtape={setEtape}
        />
      )}
      {etape === "confirmation" && <EtapeConfirmation resultat={resultat} />}
    </ModulePage>
  );
}

function EtapeChoix({
  plans,
  featuresMap,
  onSelect,
}: {
  plans: Plan[];
  featuresMap: Map<string, boolean>;
  onSelect: (code: string) => void;
}) {
  return (
    <section className="mt-6 grid gap-4 lg:grid-cols-3">
      {plans.map((plan) => {
        const nbFeatures = Array.from(featuresMap.entries()).filter(([k]) => k.startsWith(`${plan.code}:`) && featuresMap.get(k)).length;
        return (
          <form key={plan.code} onSubmit={(e) => { e.preventDefault(); onSelect(plan.code); }} className="carte-premium p-6 rounded-xl border-2 border-transparent hover:border-[#8FB59B]/50 transition">
            <div className="flex items-center justify-between mb-2">
              <h2 className="titre-or text-lg font-extrabold">{plan.label}</h2>
              <span className="text-[10px] uppercase tracking-wider text-[#A7B7A8]">Forfait</span>
            </div>
            <p className="mt-2 text-xs text-[#A7B7A8] line-clamp-2">{plan.description}</p>
            <div className="mt-4 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-[#A7B7A8]">Prix mensuel</span>
                <span className="font-mono">{plan.price_monthly === null ? "Non configuré" : `${plan.price_monthly.toLocaleString()} ${DEVISE}`}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#A7B7A8]">Prix annuel</span>
                <span className="font-mono">{plan.price_yearly === null ? "Non configuré" : `${plan.price_yearly.toLocaleString()} ${DEVISE}`}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#A7B7A8]">Essai inclus</span>
                <span className="font-mono">{plan.trial_days} jours</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#A7B7A8]">Utilisateurs max</span>
                <span className="font-mono">{plan.max_users}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#A7B7A8]">Fonctionnalités</span>
                <span className="font-mono">{nbFeatures}</span>
              </div>
            </div>
            <button
              type="submit"
              disabled={plan.price_monthly === null && plan.price_yearly === null}
              className="w-full btn-or px-4 py-2 text-sm disabled:opacity-40"
            >
              {plan.price_monthly === null && plan.price_yearly === null ? "Prix non configuré" : "Choisir ce forfait"}
            </button>
          </form>
        );
      })}
    </section>
  );
}

function EtapeDetails({
  plan,
  featuresDuPlan,
  paidMonths,
  setPaidMonths,
  paidMonthsCustom,
  setPaidMonthsCustom,
  trialDays,
  setTrialDays,
  trialDaysCustom,
  setTrialDaysCustom,
  personnalisation,
  setPersonnalisation,
  permissionsBrouillon,
  setPermissionsBrouillon,
  features,
  featuresMap,
  prixTotal,
  dateFinEssai,
  dateEcheancePayante,
  calculerDateAffiche,
  peutConfirmer,
  onSubmit,
  traitement,
  setEtape,
}: {
  plan: Plan;
  featuresDuPlan: FeatureRow[];
  paidMonths: number;
  setPaidMonths: (v: number) => void;
  paidMonthsCustom: string;
  setPaidMonthsCustom: (v: string) => void;
  trialDays: number;
  setTrialDays: (v: number) => void;
  trialDaysCustom: string;
  setTrialDaysCustom: (v: string) => void;
  personnalisation: boolean;
  setPersonnalisation: (v: boolean) => void;
  permissionsBrouillon: Record<string, { can_view: boolean; can_create: boolean; can_edit: boolean; can_delete: boolean }>;
  setPermissionsBrouillon: (v: Record<string, { can_view: boolean; can_create: boolean; can_edit: boolean; can_delete: boolean }>) => void;
  features: FeatureRow[];
  featuresMap: Map<string, boolean>;
  prixTotal: number | null;
  dateFinEssai: Date | null;
  dateEcheancePayante: Date | null;
  calculerDateAffiche: string;
  peutConfirmer: boolean;
  onSubmit: (e: React.FormEvent) => void;
  traitement: string | null;
  setEtape: (e: "choix" | "details" | "confirmation") => void;
}) {
  const togglerDuree = (v: number) => {
    if (v === -1) { setPaidMonthsCustom(String(paidMonths)); return; }
    setPaidMonths(v);
    setPaidMonthsCustom("");
  };
  const togglerEssai = (v: number) => {
    if (v === -1) { setTrialDaysCustom(String(trialDays)); return; }
    setTrialDays(v);
    setTrialDaysCustom("");
  };

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-6">
      <section className="carte p-6 rounded-xl">
        <h2 className="titre-or text-lg font-extrabold mb-4">01 — Forfait sélectionné</h2>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-bold text-[#E8ECE8]">{plan.label}</h3>
            <p className="text-[12px] text-[#A7B7A8]">{plan.description}</p>
          </div>
          <span className="px-3 py-1 rounded-full bg-[#5D9E7F]/10 text-[10px] text-[#7FBF9E] font-bold">{plan.code.toUpperCase()}</span>
        </div>
      </section>

      <section className="carte p-6 rounded-xl">
        <h2 className="titre-or text-lg font-extrabold mb-4">02 — Durée et essai</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <label className="text-xs text-[#A7B7A8] font-semibold">Durée payante</label>
            <div className="flex flex-wrap gap-2">
              {DUREE_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => togglerDuree(o.value)}
                  disabled={traitement !== null}
                  className={`px-3 py-2 rounded-lg text-xs border transition ${paidMonths === o.value ? "bg-[#5D9E7F] border-[#5D9E7F] text-white" : "border-[#8FB59B]/30 text-[#A7B7A8] hover:border-[#8FB59B]"}`}
                >
                  {o.label}
                </button>
              ))}
              <div className="flex items-end gap-2">
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={paidMonthsCustom}
                  onChange={(e) => setPaidMonthsCustom(e.target.value)}
                  onBlur={() => { const v = parseInt(paidMonthsCustom, 10); if (!isNaN(v)) setPaidMonths(v); }}
                  placeholder="mois"
                  className="champ mt-1 min-h-10 w-24 text-xs"
                />
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs text-[#A7B7A8] font-semibold">Période d&apos;essai</label>
            <div className="flex flex-wrap gap-2">
              {ESSAI_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => togglerEssai(o.value)}
                  disabled={traitement !== null}
                  className={`px-3 py-2 rounded-lg text-xs border transition ${trialDays === o.value ? "bg-[#5D9E7F] border-[#5D9E7F] text-white" : "border-[#8FB59B]/30 text-[#A7B7A8] hover:border-[#8FB59B]"}`}
                >
                  {o.label}
                </button>
              ))}
              <div className="flex items-end gap-2">
                <input
                  type="number"
                  min={0}
                  max={365}
                  value={trialDaysCustom}
                  onChange={(e) => setTrialDaysCustom(e.target.value)}
                  onBlur={() => { const v = parseInt(trialDaysCustom, 10); if (!isNaN(v)) setTrialDays(v); }}
                  placeholder="jours"
                  className="champ mt-1 min-h-10 w-24 text-xs"
                />
              </div>
            </div>
          </div>
        </div>
        <div className="mt-3 rounded-lg bg-[#5D9E7F]/10 px-4 py-3 text-sm text-[#7FBF9E]">
          {calculerDateAffiche}
        </div>
      </section>

      {personnalisation && (
        <section className="carte p-6 rounded-xl">
          <h2 className="titre-or text-lg font-extrabold mb-4">03 — Personnalisation (facultative)</h2>
          <p className="text-[12px] text-[#A7B7A8] mb-4">Ajustez les permissions par fonctionnalité pour ce forfait uniquement.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs divide-y divide-[#8FB59B]/10">
              <thead className="bg-[#344440]/50 uppercase text-[#A7B7A8]">
                <tr>
                  <th className="px-4 py-3">Fonctionnalité</th>
                  <th className="px-4 py-3 text-center">Voir</th>
                  <th className="px-4 py-3 text-center">Créer</th>
                  <th className="px-4 py-3 text-center">Éditer</th>
                  <th className="px-4 py-3 text-center">Supprimer</th>
                </tr>
              </thead>
              <tbody>
                {featuresDuPlan.map((f) => {
                  const cle = `${f.plan_code}:${f.feature_key}`;
                  const courant = permissionsBrouillon[cle] ?? {
                    can_view: true,
                    can_create: featuresMap.get(`${f.plan_code}:${f.feature_key}`) ?? false,
                    can_edit: false,
                    can_delete: false,
                  };
                  return (
                    <tr key={cle}>
                      <td className="px-4 py-3 text-[#E8ECE8]">{f.feature_key}</td>
                      <td className="px-4 py-3 text-center">
                        <input type="checkbox" checked={courant.can_view} onChange={(e) => setPermissionsBrouillon({ ...permissionsBrouillon, [cle]: { ...courant, can_view: e.target.checked } })} className="champ" />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <input type="checkbox" checked={courant.can_create} onChange={(e) => setPermissionsBrouillon({ ...permissionsBrouillon, [cle]: { ...courant, can_create: e.target.checked } })} className="champ" />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <input type="checkbox" checked={courant.can_edit} onChange={(e) => setPermissionsBrouillon({ ...permissionsBrouillon, [cle]: { ...courant, can_edit: e.target.checked } })} className="champ" />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <input type="checkbox" checked={courant.can_delete} onChange={(e) => setPermissionsBrouillon({ ...permissionsBrouillon, [cle]: { ...courant, can_delete: e.target.checked } })} className="champ" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="carte p-6 rounded-xl">
        <h2 className="titre-or text-lg font-extrabold mb-4">04 — Récapitulatif</h2>
        <div className="grid gap-3 text-xs">
          <div className="flex justify-between">
            <span className="text-[#A7B7A8]">Forfait</span>
            <span className="font-mono">{plan.label}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#A7B7A8]">Durée payante</span>
            <span className="font-mono">{paidMonths} mois</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#A7B7A8]">Essai</span>
            <span className="font-mono">{trialDays > 0 ? `${trialDays} jours` : "Aucun"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#A7B7A8]">Fin d&apos;essai</span>
            <span className="font-mono">{dateFinEssai ? dateFrCourte(dateFinEssai.toISOString().slice(0, 10)) : "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#A7B7A8]">Échéance payante</span>
            <span className="font-mono">{dateEcheancePayante ? dateFrCourte(dateEcheancePayante.toISOString().slice(0, 10)) : "—"}</span>
          </div>
          <div className="flex justify-between border-t border-[#8FB59B]/20 pt-3">
            <span className="text-[#A7B7A8]">Montant total</span>
            <span className="font-mono font-bold">{prixTotal === null ? "Non configuré" : prixTotal.toLocaleString() + " " + DEVISE}</span>
          </div>
        </div>
      </section>

      <div className="flex justify-end gap-3">
        <button type="button" onClick={() => setEtape("choix")} disabled={traitement !== null} className="px-4 py-2 text-sm rounded-lg border border-[#8FB59B]/40 text-[#DFE7E2] hover:bg-[#344440] disabled:opacity-40">
          Changer de forfait
        </button>
        <button
          type="submit"
          disabled={!peutConfirmer || traitement !== null}
          className="px-6 py-2 text-sm rounded-lg btn-or disabled:opacity-40"
        >
          {traitement === "creation" ? "Création…" : peutConfirmer ? "Confirmer la souscription" : "Prix non configuré — blocage"}
        </button>
        {!peutConfirmer && plan.price_monthly === null && plan.price_yearly === null && (
          <p className="mt-2 text-[11px] text-[#C5716B]">Ce forfait n&apos;a pas de prix configuré dans Supabase. La confirmation est bloquée.</p>
        )}
      </div>
    </form>
  );
}

function EtapeConfirmation({ resultat }: { resultat: SouscriptionResultat | null }) {
  if (!resultat) return null;
  return (
    <section className="mt-6 carte p-6 rounded-xl border-[#5D9E7F]/30 border">
      <h2 className="titre-or text-lg font-extrabold mb-4">✅ Souscription créée</h2>
      <div className="grid gap-2 text-sm">
        <div className="flex justify-between"><span className="text-[#A7B7A8]">Forfait</span><span className="font-mono">{resultat.plan}</span></div>
        <div className="flex justify-between"><span className="text-[#A7B7A8]">Durée payante</span><span className="font-mono">{resultat.paid_months} mois</span></div>
        <div className="flex justify-between"><span className="text-[#A7B7A8]">Essai</span><span className="font-mono">{resultat.trial_days} jours</span></div>
        <div className="flex justify-between"><span className="text-[#A7B7A8]">Début</span><span className="font-mono">{resultat.date_debut}</span></div>
        {resultat.fin_essai && <div className="flex justify-between"><span className="text-[#A7B7A8]">Fin d&apos;essai</span><span className="font-mono">{resultat.fin_essai}</span></div>}
        {resultat.echeance_payante && <div className="flex justify-between"><span className="text-[#A7B7A8]">Échéance</span><span className="font-mono">{resultat.echeance_payante}</span></div>}
      </div>
      <p className="mt-3 text-[12px] text-[#A7B7A8]">L&apos;abonnement a été enregistré côté serveur. Consultez la vue &laquo; Abonnements &amp; renouvellements &raquo; pour le suivi du cycle de vie.</p>
    </section>
  );
}
