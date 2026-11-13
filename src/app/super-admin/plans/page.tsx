"use client";

/**
 * AUTO DYALI — Super Admin › Plans & fonctionnalités (entitlements)
 * Catalogue réel des forfaits STANDARD / SILVER / GOLD et matrice
 * de droits. Édition via RPC sécurisées (admin_save_plan / admin_set_feature),
 * journalisées côté serveur.
 */

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase-browser";
import { FEATURE_LABEL } from "@/lib/features";
import { ModulePage } from "@/components/super-admin-module-page";
import { ModuleHeader, Chargement, Erreur } from "@/components/super-admin-page";
import { downloadCsv } from "@/lib/csv-export";
import { useNotification } from "@/lib/use-notification";

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

const FEATURES_PILOTEES = [
  "workshop", "appointments", "tires", "barcode", "excel", "purchasing",
  "employees", "stock_advanced", "reports_finance", "cheques", "alerts", "crm",
  "ai", "automation", "analytics", "multisite", "whatsapp", "custom_reports",
  "advanced_permissions", "advanced_suppliers",
] as const;

export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [features, setFeatures] = useState<FeatureRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [traitement, setTraitement] = useState<string | null>(null);
  const { success: notifySuccess, error: notifyError, info: notifyInfo } = useNotification();
  const [brouillon, setBrouillon] = useState<Record<string, Plan>>({});

  useEffect(() => {
    void (async () => {
      if (!supabase) return;
      setLoading(true);
      const [p, f] = await Promise.all([
        supabase.from("plans").select("code, label, description, price_monthly, price_yearly, trial_days, max_users, max_sites, storage_mb").order("price_monthly"),
        supabase.from("plan_features").select("plan_code, feature_key, enabled"),
      ]);
      if (p.error) setErreur(p.error.message);
      else {
        const data = (p.data ?? []) as Plan[];
        setPlans(data);
        setBrouillon(Object.fromEntries(data.map((plan) => [plan.code, { ...plan }])));
      }
      if (f.error) setErreur(f.error.message);
      else setFeatures((f.data ?? []) as FeatureRow[]);
      setLoading(false);
    })();
  }, []);

  const featureSet = useMemo(() => {
    const m = new Map<string, boolean>();
    for (const f of features) m.set(`${f.plan_code}:${f.feature_key}`, f.enabled);
    return m;
  }, [features]);

  async function basculerFeature(planCode: string, featureKey: string, next: boolean) {
    if (!supabase) return;
    const cle = `${planCode}:${featureKey}`;
    setTraitement(cle);
    setErreur(null);
    setNotice(null);
    const { error } = await supabase.rpc("admin_set_feature", { p_plan_code: planCode, p_feature: featureKey, p_enabled: next });
    if (error) notifyError({ title: "Erreur", message: error.message });
    else {
      setFeatures((current) => current.map((r) => (r.plan_code === planCode && r.feature_key === featureKey ? { ...r, enabled: next } : r)));
      setNotice(`${FEATURE_LABEL[featureKey] ?? featureKey} — ${next ? "activé" : "désactivé"} pour ${planCode.toUpperCase()}.`);
    }
    setTraitement(null);
  }

  async function enregistrerPlan(code: string) {
    if (!supabase) return;
    const b = brouillon[code];
    if (!b) return;
    setTraitement(`plan:${code}`);
    setErreur(null);
    setNotice(null);
    const { error } = await supabase.rpc("admin_save_plan", {
      p_code: code,
      p_price_monthly: b.price_monthly,
      p_price_yearly: b.price_yearly,
      p_trial_days: b.trial_days,
      p_max_users: b.max_users,
      p_max_sites: b.max_sites,
      p_storage_mb: b.storage_mb,
    });
    if (error) notifyError({ title: "Erreur", message: error.message });
    else {
      setPlans((current) => current.map((p) => (p.code === code ? { ...b } : p)));
      setNotice(`Forfait ${code.toUpperCase()} enregistré et journalisé.`);
    }
    setTraitement(null);
  }

  function champ<K extends keyof Plan>(code: string, key: K, value: Plan[K]) {
    setBrouillon((current) => ({ ...current, [code]: { ...current[code], [key]: value } }));
  }

  function exporter() {
    downloadCsv(
      `auto-dyali-plans-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Fonctionnalité", ...plans.map((p) => p.code.toUpperCase())],
      FEATURES_PILOTEES.map((f) => [FEATURE_LABEL[f] ?? f, ...plans.map((p) => (featureSet.get(`${p.code}:${f}`) ? "OUI" : "NON"))])
    );
  }

  return (
    <ModulePage titre="Plans & fonctionnalités">
      <ModuleHeader
        surtitre="AUTO DYALI · Entitlements SaaS"
        titre="Plans & fonctionnalités"
        description="Forfaits STANDARD / SILVER / GOLD et matrice de droits réellement éditable. Toute modification est journalisée côté serveur via RPC."
        action={<button type="button" onClick={exporter} className="rounded-lg border border-[#8FB59B]/40 px-4 py-2 text-sm text-[#DFE7E2] hover:bg-[#344440]">Exporter la matrice CSV</button>}
      />

      {notice && <p role="status" className="mt-4 rounded-lg bg-[#5D9E7F]/10 px-4 py-3 text-sm text-[#7FBF9E]">{notice}</p>}
      {erreur && <div className="mt-4"><Erreur message={erreur} /></div>}

      {loading ? (
        <div className="mt-6"><Chargement /></div>
      ) : (
        <>
          {/* Forfaits éditables */}
          <section className="mt-6 grid gap-4 lg:grid-cols-3">
            {plans.map((plan) => {
              const b = brouillon[plan.code] ?? plan;
              return (
                <form key={plan.code} onSubmit={(e) => { e.preventDefault(); void enregistrerPlan(plan.code); }} className="carte-premium p-5">
                  <div className="flex items-center justify-between">
                    <h2 className="titre-or text-lg font-extrabold">{plan.label}</h2>
                    <button type="submit" disabled={traitement === `plan:${plan.code}`} className="btn-or px-3 py-2 text-xs">{traitement === `plan:${plan.code}` ? "…" : "Enregistrer"}</button>
                  </div>
                  <div className="mt-4 grid gap-3 text-xs">
                    <label>Prix mensuel (MAD)<input type="number" min={0} step="0.01" value={b.price_monthly ?? ""} onChange={(e) => champ(plan.code, "price_monthly", e.target.value === "" ? null : Number(e.target.value))} className="champ mt-1 min-h-10" /></label>
                    <label>Prix annuel (MAD)<input type="number" min={0} step="0.01" value={b.price_yearly ?? ""} onChange={(e) => champ(plan.code, "price_yearly", e.target.value === "" ? null : Number(e.target.value))} className="champ mt-1 min-h-10" /></label>
                    <div className="grid grid-cols-2 gap-3">
                      <label>Essai (j)<input type="number" min={0} max={90} value={b.trial_days} onChange={(e) => champ(plan.code, "trial_days", Number(e.target.value))} className="champ mt-1 min-h-10" /></label>
                      <label>Utilisateurs max<input type="number" min={1} value={b.max_users} onChange={(e) => champ(plan.code, "max_users", Number(e.target.value))} className="champ mt-1 min-h-10" /></label>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <label>Sites max<input type="number" min={1} value={b.max_sites} onChange={(e) => champ(plan.code, "max_sites", Number(e.target.value))} className="champ mt-1 min-h-10" /></label>
                      <label>Stockage (Mo)<input type="number" min={10} value={b.storage_mb} onChange={(e) => champ(plan.code, "storage_mb", Number(e.target.value))} className="champ mt-1 min-h-10" /></label>
                    </div>
                  </div>
                </form>
              );
            })}
          </section>

          {/* Matrice de droits */}
          <section className="carte mt-6 overflow-hidden">
            <div className="border-b border-[#8FB59B]/10 p-5">
              <h2 className="font-bold">Matrice de droits</h2>
              <p className="mt-1 text-xs text-[#A7B7A8]">Active ou désactive un module par forfait — exécution immédiate via RPC et journalisation.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-[#344440]/50 text-xs uppercase text-[#A7B7A8]">
                  <tr>
                    <th className="px-5 py-3">Fonctionnalité</th>
                    {plans.map((p) => <th key={p.code} className="px-5 py-3 text-center">{p.label}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#8FB59B]/10">
                  {FEATURES_PILOTEES.map((f) => (
                    <tr key={f}>
                      <td className="px-5 py-3 text-[#E8ECE8]">{FEATURE_LABEL[f] ?? f}</td>
                      {plans.map((p) => {
                        const cle = `${p.code}:${f}`;
                        const actif = featureSet.get(cle) ?? false;
                        return (
                          <td key={p.code} className="px-5 py-3 text-center">
                            <button
                              type="button"
                              role="switch"
                              aria-checked={actif}
                              aria-label={`${FEATURE_LABEL[f] ?? f} pour ${p.label}`}
                              disabled={traitement === cle}
                              onClick={() => void basculerFeature(p.code, f, !actif)}
                              className={`inline-flex h-6 w-11 items-center rounded-full transition disabled:opacity-40 ${actif ? "bg-[#5D9E7F]" : "bg-[#344440]"}`}
                            >
                              <span className={`h-5 w-5 rounded-full bg-white transition ${actif ? "translate-x-5" : "translate-x-0.5"}`} />
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </ModulePage>
  );
}
