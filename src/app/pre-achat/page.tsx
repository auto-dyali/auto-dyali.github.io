"use client";

import { Suspense, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Logo } from "@/components/logo";
import { supabase } from "@/lib/supabase-browser";
import {
  SECTEURS_AUTOMOBILES,
  PERIODES_ABONNEMENT,
  PLANS_PREACHAT,
  buildPrePurchaseRequestId,
  formatMontantMAD,
  normalizeEmail,
  prePurchaseDedupKey,
  validatePrePurchaseInput,
  type PrePurchaseErrors,
  type PrePurchaseInput,
} from "@/lib/pre-purchase";

type Plan = { code: string; label: string; price_monthly: number | null; price_yearly: number | null; is_active: boolean | null };

function PreAchatInner() {
  const params = useSearchParams();
  const initialPlan = (params.get("plan") || "standard").toLowerCase();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<{ id: string; email: string } | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<PrePurchaseErrors>({});
  const [requestId] = useState(() => buildPrePurchaseRequestId());
  const [lastSubmitAt, setLastSubmitAt] = useState<number>(0);

  const [form, setForm] = useState<PrePurchaseInput>({
    companyName: "",
    legalName: "",
    professionalId: "",
    sector: SECTEURS_AUTOMOBILES[0],
    businessType: "",
    address: "",
    city: "",
    phone: "",
    email: "",
    managerName: "",
    plan: PLANS_PREACHAT.includes(initialPlan as (typeof PLANS_PREACHAT)[number]) ? initialPlan : "standard",
    desiredUsers: 3,
    desiredSites: 1,
    desiredModules: [],
    period: "mensuel",
    acceptTerms: false,
    acceptPrivacy: false,
  });

  useEffect(() => {
    let vivant = true;
    void (async () => {
      if (!supabase) { if (vivant) setPlansLoading(false); return; }
      const { data } = await supabase.from("plans").select("code,label,price_monthly,price_yearly,is_active").order("price_monthly", { ascending: true, nullsFirst: false });
      if (!vivant) return;
      const list = ((data ?? []) as Plan[]).filter((p) => p.is_active !== false);
      setPlans(list);
      if (list.length && !list.find((p) => p.code === form.plan)) {
        setForm((f) => ({ ...f, plan: list[0].code }));
      }
      setPlansLoading(false);
    })();
    return () => { vivant = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedPlan = useMemo(() => plans.find((p) => p.code === form.plan) || null, [plans, form.plan]);
  const montant = useMemo(() => {
    if (!selectedPlan) return null;
    return form.period === "annuel" ? selectedPlan.price_yearly : selectedPlan.price_monthly;
  }, [selectedPlan, form.period]);

  function set<K extends keyof PrePurchaseInput>(key: K, value: PrePurchaseInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setFieldErrors((e) => ({ ...e, [key]: undefined, form: undefined }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErreur(null);
    const errs = validatePrePurchaseInput(form);
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) {
      setErreur("Veuillez corriger les champs indiqués avant de soumettre votre demande.");
      return;
    }
    // Protection soumissions multiples (UI)
    const now = Date.now();
    if (submitting || (now - lastSubmitAt < 5000)) {
      setErreur("Une soumission est déjà en cours ou vient d'être envoyée. Merci de patienter.");
      return;
    }

    // Vérification doublon locale (session) — le contrôle réel doit être côté serveur
    const dedup = prePurchaseDedupKey(form.email, form.companyName);
    try {
      const sent = JSON.parse(localStorage.getItem("ad_preachat_sent") || "[]") as string[];
      if (sent.includes(dedup)) {
        setErreur("Une demande similaire semble déjà avoir été soumise depuis ce navigateur. Si besoin, contactez l'équipe AUTO DYALI.");
        return;
      }
    } catch { /* ignore */ }

    setSubmitting(true);
    setLastSubmitAt(now);

    const payload = {
      request_key: requestId,
      status: "soumis",
      company_name: form.companyName.trim(),
      legal_name: form.legalName.trim(),
      professional_id: form.professionalId?.trim() || null,
      sector: form.sector.trim(),
      business_type: form.businessType.trim(),
      address: form.address.trim(),
      city: form.city.trim(),
      phone: form.phone.trim(),
      email: normalizeEmail(form.email),
      manager_name: form.managerName.trim(),
      plan_code: form.plan,
      period: form.period,
      desired_users: form.desiredUsers,
      desired_sites: form.desiredSites,
      desired_modules: form.desiredModules,
      configured_amount: montant,
      currency: "MAD",
      terms_accepted_at: new Date().toISOString(),
      privacy_accepted_at: new Date().toISOString(),
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    try {
      if (!supabase) {
        setErreur("Configuration indisponible : la demande ne peut pas être transmise au serveur. Aucun enregistrement réel n'a été effectué.");
        setSubmitting(false);
        return;
      }

      // Préférence : RPC contrôlée (idempotente, validations serveur) si disponible.
      let submittedOk = false;
      let lastError: { message?: string } | null = null;
      const rpc = await supabase.rpc("submit_pre_purchase_request", {
        p_request_key: requestId,
        p_company_name: form.companyName.trim(),
        p_legal_name: form.legalName.trim(),
        p_professional_id: form.professionalId?.trim() || null,
        p_sector: form.sector.trim(),
        p_business_type: form.businessType.trim(),
        p_address: form.address.trim(),
        p_city: form.city.trim(),
        p_phone: form.phone.trim(),
        p_email: normalizeEmail(form.email),
        p_manager_name: form.managerName.trim(),
        p_plan_code: form.plan,
        p_period: form.period,
        p_desired_users: form.desiredUsers,
        p_desired_sites: form.desiredSites,
        p_desired_modules: form.desiredModules,
        p_accept_terms: form.acceptTerms,
        p_accept_privacy: form.acceptPrivacy,
      });
      if (!rpc.error) {
        submittedOk = true;
      } else {
        lastError = rpc.error;
        const rpcMsg = (rpc.error.message || "").toLowerCase();
        const rpcMissing = rpcMsg.includes("does not exist") || rpcMsg.includes("schema cache") || rpcMsg.includes("could not find the function");
        if (rpcMissing) {
          // Repli : insertion directe (nécessite table/policy configurées côté serveur)
          const ins = await supabase.from("pre_purchase_requests").insert(payload);
          if (!ins.error) {
            submittedOk = true;
          } else {
            lastError = ins.error;
          }
        }
      }

      if (!submittedOk) {
        const msg = (lastError?.message || "").toLowerCase();
        if (msg.includes("does not exist") || msg.includes("relation") || msg.includes("404") || msg.includes("schema cache") || msg.includes("permission") || msg.includes("rls") || msg.includes("not found") || msg.includes("could not find")) {
          setErreur("Le service d'enregistrement des pré-achats n'est pas encore disponible côté serveur (migration/table/RPC non appliquée ou accès non configuré). Votre demande n'a pas été enregistrée en base. Veuillez contacter AUTO DYALI ou réessayer ultérieurement.");
        } else {
          setErreur(`Impossible d'enregistrer la demande : ${lastError?.message || "erreur inconnue"}`);
        }
        setSubmitting(false);
        return;
      }

      try {
        const sent = JSON.parse(localStorage.getItem("ad_preachat_sent") || "[]") as string[];
        if (!sent.includes(dedup)) { sent.push(dedup); localStorage.setItem("ad_preachat_sent", JSON.stringify(sent)); }
      } catch { /* ignore */ }

      setSubmitted({ id: requestId, email: normalizeEmail(form.email) });
    } catch (err) {
      setErreur(`Erreur inattendue : ${err instanceof Error ? err.message : "inconnue"}`);
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <main className="min-h-screen bg-[#1f2626] text-[#E8ECE8]">
        <div className="mx-auto max-w-2xl px-5 py-16">
          <Logo compact />
          <div className="carte-premium mt-8 p-8">
            <p className="text-[11px] uppercase tracking-[0.25em] text-[#7FBF9E]">Demande transmise</p>
            <h1 className="titre-or mt-2 text-2xl font-extrabold">Pré-achat soumis avec succès</h1>
            <p className="mt-3 text-sm text-[#C9D3CA]">Votre demande de pré-achat a été enregistrée. L’équipe AUTO DYALI procédera à sa vérification et vous contactera pour les étapes suivantes (validation, conditions, paiement si applicable, puis création et activation du compte).</p>
            <div className="mt-5 rounded-lg bg-[#252D2D] p-4 text-sm">
              <p><span className="text-[#A7B7A8]">Référence :</span> <span className="font-mono text-[#E8ECE8]">{submitted.id}</span></p>
              <p className="mt-1"><span className="text-[#A7B7A8]">E-mail :</span> <span className="text-[#E8ECE8]">{submitted.email}</span></p>
              <p className="mt-1"><span className="text-[#A7B7A8]">Statut :</span> <span className="text-[#E8ECE8]">Pré-achat soumis (en attente de vérification)</span></p>
            </div>
            <p className="mt-4 text-xs text-[#A7B7A8]">Aucun paiement n’est considéré comme confirmé sans preuve du fournisseur de paiement. La création du compte et l’invitation du Manager interviendront uniquement après validation et autorisation.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/offres/" className="rounded-lg border border-[#8FB59B]/40 px-4 py-2 text-sm text-[#DFE7E2] hover:bg-[#344440]">Retour aux offres</Link>
              <Link href="/connexion/" className="btn-or px-4 py-2 text-sm">Accéder à la connexion</Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#1f2626] text-[#E8ECE8]">
      <header className="border-b border-[#8FB59B]/20 bg-[#252D2D]/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
          <Logo compact />
          <nav className="flex flex-wrap items-center gap-2 text-sm">
            <Link href="/offres/" className="rounded-lg border border-[#8FB59B]/30 px-4 py-2 text-[#DFE7E2] hover:bg-[#344440]">Offres</Link>
            <Link href="/connexion/" className="rounded-lg border border-[#8FB59B]/30 px-4 py-2 text-[#DFE7E2] hover:bg-[#344440]">Connexion</Link>
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-5 py-10">
        <p className="text-[11px] uppercase tracking-[0.25em] text-[#D0C6AE]">AUTO DYALI · Pré-achat</p>
        <h1 className="titre-or mt-2 text-3xl font-extrabold">Formulaire de pré-achat professionnel</h1>
        <p className="mt-3 max-w-3xl text-sm text-[#A7B7A8]">Renseignez les informations de votre entreprise pour soumettre une demande de pré-achat/souscription. Les tarifs proviennent de la configuration réelle des offres lorsqu’elle est disponible. Cette demande ne crée pas automatiquement un compte et ne confirme pas un paiement.</p>

        <form onSubmit={onSubmit} className="mt-8 space-y-6">
          {erreur && <p role="alert" className="rounded-lg bg-[#C5716B]/15 px-4 py-3 text-sm text-[#C5716B]">{erreur}</p>}

          <section className="carte-premium p-6">
            <h2 className="text-lg font-bold">Entreprise</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="text-sm text-[#C9D3CA] sm:col-span-1">Nom commercial *<input className="champ mt-1 min-h-11 w-full" value={form.companyName} onChange={(e) => set("companyName", e.target.value)} autoComplete="organization" /><FieldErr msg={fieldErrors.companyName} /></label>
              <label className="text-sm text-[#C9D3CA] sm:col-span-1">Raison sociale *<input className="champ mt-1 min-h-11 w-full" value={form.legalName} onChange={(e) => set("legalName", e.target.value)} /><FieldErr msg={fieldErrors.legalName} /></label>
              <label className="text-sm text-[#C9D3CA]">Identifiant professionnel (RC/ICE/IF, si applicable)<input className="champ mt-1 min-h-11 w-full" value={form.professionalId} onChange={(e) => set("professionalId", e.target.value)} /></label>
              <label className="text-sm text-[#C9D3CA]">Secteur *<input className="champ mt-1 min-h-11 w-full" value={form.sector} onChange={(e) => set("sector", e.target.value)} placeholder="Ex. Automobile" /><FieldErr msg={fieldErrors.sector} /></label>
              <label className="text-sm text-[#C9D3CA] sm:col-span-2">Métier automobile *<select className="champ mt-1 min-h-11 w-full" value={form.businessType} onChange={(e) => set("businessType", e.target.value)}><option value="">Sélectionner…</option>{SECTEURS_AUTOMOBILES.map((s) => <option key={s} value={s}>{s}</option>)}</select><FieldErr msg={fieldErrors.businessType} /></label>
              <label className="text-sm text-[#C9D3CA] sm:col-span-2">Adresse *<input className="champ mt-1 min-h-11 w-full" value={form.address} onChange={(e) => set("address", e.target.value)} autoComplete="street-address" /><FieldErr msg={fieldErrors.address} /></label>
              <label className="text-sm text-[#C9D3CA]">Ville (Maroc) *<input className="champ mt-1 min-h-11 w-full" value={form.city} onChange={(e) => set("city", e.target.value)} autoComplete="address-level2" /><FieldErr msg={fieldErrors.city} /></label>
              <label className="text-sm text-[#C9D3CA]">Téléphone professionnel *<input className="champ mt-1 min-h-11 w-full" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+2126..." autoComplete="tel" /><FieldErr msg={fieldErrors.phone} /></label>
              <label className="text-sm text-[#C9D3CA] sm:col-span-2">E-mail professionnel *<input type="email" className="champ mt-1 min-h-11 w-full" value={form.email} onChange={(e) => set("email", e.target.value)} autoComplete="email" /><FieldErr msg={fieldErrors.email} /></label>
            </div>
          </section>

          <section className="carte-premium p-6">
            <h2 className="text-lg font-bold">Manager & abonnement souhaité</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="text-sm text-[#C9D3CA] sm:col-span-2">Nom du Manager (propriétaire/responsable) *<input className="champ mt-1 min-h-11 w-full" value={form.managerName} onChange={(e) => set("managerName", e.target.value)} autoComplete="name" /><FieldErr msg={fieldErrors.managerName} /></label>
              <label className="text-sm text-[#C9D3CA]">Forfait choisi *<select className="champ mt-1 min-h-11 w-full" value={form.plan} onChange={(e) => set("plan", e.target.value)}>{(plans.length ? plans.map((p) => p.code) : [...PLANS_PREACHAT]).map((c) => <option key={c} value={c}>{c.toUpperCase()}</option>)}</select><FieldErr msg={fieldErrors.plan} /></label>
              <label className="text-sm text-[#C9D3CA]">Période *<select className="champ mt-1 min-h-11 w-full" value={form.period} onChange={(e) => set("period", e.target.value)}>{PERIODES_ABONNEMENT.map((p) => <option key={p} value={p}>{p === "mensuel" ? "Mensuel" : "Annuel"}</option>)}</select><FieldErr msg={fieldErrors.period} /></label>
              <label className="text-sm text-[#C9D3CA]">Nombre d’utilisateurs souhaité *<input type="number" min={1} max={500} className="champ mt-1 min-h-11 w-full" value={form.desiredUsers} onChange={(e) => set("desiredUsers", Number(e.target.value))} /><FieldErr msg={fieldErrors.desiredUsers} /></label>
              <label className="text-sm text-[#C9D3CA]">Nombre d’établissements souhaité *<input type="number" min={1} max={100} className="champ mt-1 min-h-11 w-full" value={form.desiredSites} onChange={(e) => set("desiredSites", Number(e.target.value))} /><FieldErr msg={fieldErrors.desiredSites} /></label>
              <div className="sm:col-span-2 rounded-lg bg-[#252D2D] p-4 text-sm">
                <p className="text-[#A7B7A8]">Montant indicatif ({form.period}) selon configuration : <span className="font-semibold text-[#E8ECE8]">{formatMontantMAD(montant)}</span></p>
                <p className="mt-1 text-xs text-[#A7B7A8]">{plansLoading ? "Chargement des tarifs…" : montant == null ? "Tarif non configuré dans les offres : aucun montant officiel n’est affiché." : "Montant issu de la configuration des offres au moment de l’affichage."}</p>
              </div>
              <label className="text-sm text-[#C9D3CA] sm:col-span-2">Options / modules souhaités (optionnel)<input className="champ mt-1 min-h-11 w-full" value={form.desiredModules.join(", ")} onChange={(e) => set("desiredModules", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} placeholder="Ex. Atelier, CRM, WhatsApp" /></label>
            </div>
          </section>

          <section className="carte-premium p-6">
            <h2 className="text-lg font-bold">Consentements</h2>
            <div className="mt-4 space-y-3 text-sm text-[#C9D3CA]">
              <label className="flex items-start gap-3"><input type="checkbox" className="mt-1" checked={form.acceptTerms} onChange={(e) => set("acceptTerms", e.target.checked)} /><span>J’accepte les conditions commerciales AUTO DYALI applicables à ma demande de pré-achat. *</span></label>
              <FieldErr msg={fieldErrors.acceptTerms} />
              <label className="flex items-start gap-3"><input type="checkbox" className="mt-1" checked={form.acceptPrivacy} onChange={(e) => set("acceptPrivacy", e.target.checked)} /><span>J’accepte la politique de confidentialité et le traitement de mes données pour l’étude et le suivi de ma demande. *</span></label>
              <FieldErr msg={fieldErrors.acceptPrivacy} />
              <p className="text-xs text-[#A7B7A8]">La soumission de ce formulaire enregistre une demande de pré-achat (si le service serveur est disponible). Elle ne vaut pas paiement confirmé ni création automatique de compte sans validation/autorisation.</p>
            </div>
          </section>

          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={submitting} className="btn-or px-6 py-3 text-sm font-semibold disabled:opacity-50">{submitting ? "Envoi en cours…" : "Soumettre la demande de pré-achat"}</button>
            <Link href="/offres/" className="rounded-lg border border-[#8FB59B]/40 px-5 py-3 text-sm text-[#DFE7E2] hover:bg-[#344440]">Revoir les offres</Link>
          </div>
        </form>
      </div>
    </main>
  );
}

function FieldErr({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="mt-1 text-xs text-[#C5716B]">{msg}</p>;
}

export default function PreAchatPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#1f2626] p-8 text-[#A7B7A8]">Chargement…</main>}>
      <PreAchatInner />
    </Suspense>
  );
}
