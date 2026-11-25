"use client";
/* eslint-disable react/no-unescaped-entities */

/**
 * AUTO DYALI — Super Admin › Nouvel abonné (GV5 §51)
 *
 * Parcours professionnel en 6 étapes, branché sur le CONTRAT UNIQUE v2
 * (`src/lib/onboarding-contract.ts`, source `_shared/contract.ts`).
 *
 *  1. Informations du garage (identité professionnelle choisie par le SA)
 *  2. Manager : nom, e-mail, téléphone, identifiant de connexion, mot de passe
 *     temporaire (jamais réaffiché, jamais renvoyé par le serveur)
 *  3. Formule, durée payante, durée d'essai, date de début
 *  4. Modules du forfait + permissions réelles (voir/créer/modifier/supprimer)
 *  5. Transmission e-mail et/ou WhatsApp (canaux indépendants)
 *  6. Récapitulatif et résultat réel par canal
 *
 * Aucune case décorative : chaque module sélectionné produit une ligne
 * `permissions` transmise au serveur. L'unicité est vérifiée en temps réel
 * (RPC `admin_check_identity_available`) ET revalidée côté serveur.
 */

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase-browser";
import { ModulePage } from "@/components/super-admin-module-page";
import { ModuleHeader } from "@/components/super-admin-page";
import { buildRequestId, genererIdentifiantProfessionnel, slugify } from "@/lib/onboarding";
import {
  ONBOARDING_CONTRACT_VERSION,
  computeSubscriptionDates,
  formatOnboardingError,
  paidDurationToMonths,
  trialDurationToDays,
  validateOnboardingPayload,
  type OnboardingPayload,
  type PermissionGrant,
} from "@/lib/onboarding-contract";
import { DELIVERY_STATUS_LABEL } from "@/lib/activation";
import { useNotification } from "@/lib/use-notification";
import { Champ3D, Zone3D, Section3D } from "@/components/abonne-form-primitives";
import { ChampGeographieMaroc } from "@/components/ChampGeographieMaroc";
import { validerIdentite, validerCoordonnees } from "@/lib/abonne-rules";

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

type DroitModule = {
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
};

type Disponibilite = {
  professional_id_available?: boolean;
  login_id_available?: boolean;
  email_available?: boolean;
  slug_available?: boolean;
};

type DeliveryRow = {
  channel: "email" | "whatsapp";
  status: string;
  providerRef?: string | null;
  providerError?: string | null;
};

const ETAPES = [
  "Entreprise",
  "Responsable",
  "Formule & abonnement",
  "Modules & droits",
  "Transmission",
  "Confirmation",
] as const;

const STORAGE_KEY = "autodyali_onboarding_request_id";

const PREFIXES_ETAPE: Record<number, string[]> = {
  1: ["establishment."],
  2: ["manager."],
  3: ["subscription."],
  4: ["modules", "permissions"],
  5: ["delivery"],
};

function initialRequestId(): string {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored && /^[0-9a-f-]{36}$/i.test(stored)) return stored;
  } catch {
    /* sessionStorage indisponible : UUID en mémoire. */
  }
  return buildRequestId();
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function OnboardingPage() {
  const [etape, setEtape] = useState<1 | 2 | 3 | 4 | 5 | 6>(1);
  const [requestId, setRequestId] = useState<string>(() => initialRequestId());
  const [enCours, setEnCours] = useState(false);
  const [verification, setVerification] = useState(false);
  const [resultat, setResultat] = useState<Record<string, unknown> | null>(null);
  const [erreurGlobale, setErreurGlobale] = useState<string | null>(null);
  const [dispo, setDispo] = useState<Disponibilite>({});
  const [dispoErreur, setDispoErreur] = useState<string | null>(null);
  // GV5 §83 — confirmation supplémentaire quand l'unicité n'a pas pu être
  // vérifiée côté serveur avant le récapitulatif.
  const [confirmerSansVerification, setConfirmerSansVerification] = useState(false);
  // GV5 §84 — préflight : l'environnement cible doit posséder les objets 0039.
  // Tant que le diagnostic n'est pas positif, la création définitive est bloquée.
  const [santeEnv, setSanteEnv] = useState<Record<string, boolean> | null>(null);
  const [santeEnvErreur, setSanteEnvErreur] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    legalName: "",
    slug: "",
    activityType: "",
    professionalId: "",
    address: "",
    city: "",
    region: "",
    country: "Maroc",
    phone: "",
    email: "",
    complementaryContacts: "",
    legalInfo: "",
    fiscalInfo: "",
    adminInfo: "",
    dossierState: "en_constitution",
    notes: "",
    managerFirstName: "",
    managerLastName: "",
    managerFullName: "",
    managerEmail: "",
    managerPhone: "",
    loginId: "",
    temporaryPassword: "",
    temporaryPasswordConfirm: "",
    plan: "",
    paidDuration: "1an",
    paidMonths: 12,
    trialDuration: "15",
    trialDays: 15,
    startDate: todayIso(),
    rights: {} as Record<string, DroitModule>,
    deliveryEmail: true,
    deliveryWhatsapp: false,
  });

  const { success: notifySuccess, error: notifyError, warning: notifyWarning } = useNotification();

  const [plansReels, setPlansReels] = useState<Plan[]>([]);
  const [featuresReels, setFeaturesReels] = useState<FeatureRow[]>([]);
  const [chargementPlans, setChargementPlans] = useState(true);
  const [erreurPlans, setErreurPlans] = useState<string | null>(null);

  /* ------------------------------------------------------------------ */
  /* Contrat : le formulaire produit EXACTEMENT le payload serveur.       */
  /* ------------------------------------------------------------------ */
  const payload: OnboardingPayload = useMemo(() => {
    const modules = Object.keys(form.rights).sort();
    const managerFullName = [form.managerFirstName, form.managerLastName].filter(Boolean).join(" ").trim() || form.managerFullName;
    return {
      contractVersion: ONBOARDING_CONTRACT_VERSION,
      requestId,
      establishment: {
        name: form.name,
        legalName: form.legalName,
        slug: form.slug,
        activityType: form.activityType,
        professionalId: form.professionalId,
        address: form.address,
        city: form.city,
        region: form.region,
        phone: form.phone,
        email: form.email,
        notes: form.notes,
        country: form.country,
        legalInfo: form.legalInfo ?? "",
        fiscalInfo: form.fiscalInfo ?? "",
        adminInfo: form.adminInfo,
        dossierState: form.dossierState,
        complementaryContacts: form.complementaryContacts,
      },
      manager: {
        fullName: managerFullName,
        email: form.managerEmail,
        phone: form.managerPhone,
        loginId: form.loginId,
        temporaryPassword: form.temporaryPassword,
        temporaryPasswordConfirm: form.temporaryPasswordConfirm,
      },
      subscription: {
        plan: form.plan,
        paidDuration: form.paidDuration,
        paidDurationMonths: paidDurationToMonths(form.paidDuration, form.paidMonths),
        trialDuration: form.trialDuration,
        trialDurationDays: trialDurationToDays(form.trialDuration, form.trialDays),
        startDate: form.startDate,
      },
      modules,
      permissions: Object.entries(form.rights).map(
        ([module, droit]): PermissionGrant => ({ module, ...droit }),
      ),
      delivery: { email: form.deliveryEmail, whatsapp: form.deliveryWhatsapp },
    };
  }, [form, requestId]);

  const validation = useMemo(() => validateOnboardingPayload(payload), [payload]);
  // Mêmes règles d'affichage que la fiche de modification (source unique §76).
  const erreursPartagees = useMemo(
    () => ({
      ...validerIdentite({ name: form.name, slug: form.slug, email: form.email, phone: form.phone }),
      ...validerCoordonnees({ address: form.address, city: form.city }, true),
    }),
    [form.name, form.slug, form.email, form.phone, form.address, form.city],
  );
  const erreurs = validation.errors;

  const erreur = (cle: string): string | undefined => erreurs[cle];

  const etapeValide = useCallback(
    (n: number): boolean => {
      if (n === 6) return validation.valid;
      const prefixes = PREFIXES_ETAPE[n] ?? [];
      return !Object.keys(erreurs).some(
        (cle) => prefixes.some((p) => cle.startsWith(p)) || cle.startsWith("_unknown."),
      );
    },
    [erreurs, validation.valid],
  );

  function modifier<K extends keyof typeof form>(cle: K, valeur: (typeof form)[K]) {
    setForm((f) => {
      const suivant = { ...f, [cle]: valeur };
      if (cle === "name" && !f.slug.trim()) suivant.slug = slugify(String(valeur));
      if (cle === "name" && !f.professionalId.trim()) {
        suivant.professionalId = genererIdentifiantProfessionnel();
      }
      if (cle === "managerFirstName" || cle === "managerLastName") {
        const prenom = cle === "managerFirstName" ? String(valeur) : f.managerFirstName;
        const nom = cle === "managerLastName" ? String(valeur) : f.managerLastName;
        suivant.managerFullName = [prenom, nom].filter(Boolean).join(" ").trim();
      }
      if (cle === "plan") {
        // Un changement de forfait ne doit pas conserver des modules absents
        // du nouveau forfait : le serveur les refuserait (400 explicite).
        const autorisees = new Set(
          featuresReels
            .filter((feat) => feat.plan_code === valeur && feat.enabled)
            .map((feat) => feat.feature_key),
        );
        suivant.rights = Object.fromEntries(
          Object.entries(f.rights).filter(([module]) => autorisees.has(module)),
        );
      }
      return suivant;
    });
    setDispo({});
  }

  function basculerModule(feature: string) {
    setForm((f) => {
      const droits = { ...f.rights };
      if (droits[feature]) delete droits[feature];
      else droits[feature] = { canView: true, canCreate: true, canEdit: true, canDelete: false };
      return { ...f, rights: droits };
    });
  }

  function modifierDroit(feature: string, action: keyof DroitModule, valeur: boolean) {
    setForm((f) => {
      const courant = f.rights[feature];
      if (!courant) return f;
      return { ...f, rights: { ...f.rights, [feature]: { ...courant, [action]: valeur } } };
    });
  }

  const planActif = plansReels.find((p) => p.code === form.plan);
  const featuresDuPlan = (code: string) =>
    featuresReels.filter((f) => f.plan_code === code && f.enabled).map((f) => f.feature_key);
  const dates = computeSubscriptionDates(
    form.startDate,
    paidDurationToMonths(form.paidDuration, form.paidMonths),
    trialDurationToDays(form.trialDuration, form.trialDays),
  );

  /* ------------------------------------------------------------------ */
  /* GV5 §84 — préflight environnement (migration 0039 et dépendances)   */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    let vivant = true;
    void (async () => {
      if (!supabase) return;
      const { data, error } = await supabase.rpc("admin_identity_v2_health");
      if (!vivant) return;
      if (error) {
        const absent = /PGRST202|could not find the function/i.test(error.message);
        setSanteEnvErreur(
          absent
            ? "Environnement non compatible : la RPC de diagnostic est absente. La création est bloquée tant que la migration 0039 n'est pas appliquée sur cet environnement."
            : `Diagnostic d'environnement indisponible : ${error.message}`,
        );
        return;
      }
      const sante = (data ?? {}) as Record<string, boolean>;
      setSanteEnv(sante);
      const manquants = Object.entries(sante).filter(([, ok]) => !ok).map(([cle]) => cle);
      if (manquants.length > 0) setSanteEnvErreur(`Objets manquants : ${manquants.join(", ")}.`);
    })();
    return () => {
      vivant = false;
    };
  }, []);

  /* ------------------------------------------------------------------ */
  /* Plans + fonctionnalités réels                                       */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    let vivant = true;
    void (async () => {
      if (!supabase) {
        if (vivant) setChargementPlans(false);
        return;
      }
      const [p, f] = await Promise.all([
        supabase
          .from("plans")
          .select("code, label, description, price_monthly, price_yearly, trial_days, max_users, max_sites, storage_mb")
          .order("price_monthly"),
        supabase.from("plan_features").select("plan_code, feature_key, enabled"),
      ]);
      if (!vivant) return;
      if (p.error || f.error) {
        setErreurPlans(p.error?.message ?? f.error?.message ?? "Plans indisponibles");
        setChargementPlans(false);
        return;
      }
      const plans = (p.data ?? []) as Plan[];
      setPlansReels(plans);
      setFeaturesReels((f.data ?? []) as FeatureRow[]);
      if (plans.length > 0) {
        setForm((current) =>
          current.plan && plans.some((pl) => pl.code === current.plan)
            ? current
            : { ...current, plan: plans[0].code },
        );
      }
      setChargementPlans(false);
    })();
    return () => {
      vivant = false;
    };
  }, []);

  /* ------------------------------------------------------------------ */
  /* Unicité en temps réel (serveur), sans bloquer si RPC absente        */
  /* ------------------------------------------------------------------ */
  async function verifierDisponibilite(): Promise<Disponibilite | null> {
    if (!supabase) return null;
    setVerification(true);
    setDispoErreur(null);
    try {
      const { data, error } = await supabase.rpc("admin_check_identity_available", {
        p_professional_id: form.professionalId.trim() || null,
        p_login_id: form.loginId.trim() || null,
        p_manager_email: form.managerEmail.trim() || null,
        p_slug: form.slug.trim() || null,
      });
      if (error) {
        setDispoErreur(
          /could not find the function|PGRST202/i.test(error.message)
            ? "Environnement Supabase non compatible : RPC admin_check_identity_available absente (migration 0039). Vérifiez l'environnement cible ; le serveur revalidera les identifiants à la création."
            : `Vérification d'unicité impossible : ${error.message}`,
        );
        return null;
      }
      const d = (data ?? {}) as Disponibilite;
      setDispo(d);
      if (d.professional_id_available === false) {
        notifyError({ title: "Identifiant professionnel déjà utilisé", message: "Choisissez un autre identifiant." });
      } else if (d.login_id_available === false) {
        notifyError({ title: "Identifiant de connexion déjà utilisé", message: "Choisissez un autre identifiant." });
      } else if (d.email_available === false) {
        notifyError({ title: "E-mail Manager déjà utilisé", message: "Un compte existe déjà pour cet e-mail." });
      }
      return d;
    } catch (e) {
      setDispoErreur(e instanceof Error ? e.message : "Vérification d'unicité impossible.");
      return null;
    } finally {
      setVerification(false);
    }
  }

  async function prochainEtape() {
    if (!etapeValide(etape)) return;
    if (etape === 2 || etape === 5) {
      // Résultat retourné directement : l'état React n'est pas encore à jour
      // au moment du contrôle, un conflit doit bloquer immédiatement.
      const resultat = await verifierDisponibilite();
      if (
        resultat &&
        (resultat.professional_id_available === false ||
          resultat.login_id_available === false ||
          resultat.email_available === false)
      ) {
        return;
      }
    }
    setEtape((e) => (e < 6 ? ((e + 1) as 1 | 2 | 3 | 4 | 5 | 6) : e));
  }

  function etapePrecedente() {
    setEtape((e) => (e > 1 ? ((e - 1) as 1 | 2 | 3 | 4 | 5 | 6) : e));
  }

  /* ------------------------------------------------------------------ */
  /* Soumission                                                          */
  /* ------------------------------------------------------------------ */
  async function soumettre(e: FormEvent) {
    e.preventDefault();
    if (enCours) return; // anti double-soumission
    if (!supabase) {
      notifyError({ title: "Supabase non configuré", message: "La variable d'environnement Supabase est manquante." });
      return;
    }
    if (!validation.valid) {
      const premier = Object.keys(erreurs)[0] ?? "contrat";
      notifyWarning({
        title: "Formulaire invalide",
        message: `Corrigez les champs signalés avant de valider (${premier}).`,
      });
      return;
    }

    setEnCours(true);
    setErreurGlobale(null);
    try {
      const { data, error } = await supabase.functions.invoke("onboard-tenant", { body: payload });

      if (error) {
        let corps: unknown = null;
        try {
          const ctx = (error as { context?: { json?: () => Promise<unknown> } }).context;
          corps = (await ctx?.json?.()) ?? null;
        } catch {
          corps = null;
        }
        let message = formatOnboardingError(corps, error.message ?? "Erreur inconnue");
        if (/function not found|404/i.test(message)) {
          message = "La fonction `onboard-tenant` (v2) n'est pas déployée.";
        } else if (/non appliquée|Could not find the function/i.test(message)) {
          message = "Migrations 0036/0039 non appliquées : création impossible pour l'instant.";
        }
        setErreurGlobale(message);
        notifyError({ title: "Échec de l'onboarding", message });
        return;
      }

      const corps = (data ?? {}) as Record<string, unknown>;
      if (corps.ok === false) {
        const message =
          typeof corps.error === "string" ? corps.error : "Échec de l'onboarding.";
        setErreurGlobale(message);
        notifyError({ title: "Échec de l'onboarding", message });
        return;
      }

      setResultat(corps);
      setEtape(6);
      notifySuccess({
        title: corps.idempotent ? "Abonné déjà créé" : "Abonné créé",
        message: "Consultez le statut réel de chaque canal de transmission ci-dessous.",
        duration: 6000,
      });
      try {
        sessionStorage.removeItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
      setRequestId(buildRequestId());
      setConfirmerSansVerification(false);
      setDispoErreur(null);
    } catch (err) {
      notifyError({
        title: "Erreur inattendue",
        message: err instanceof Error ? err.message : "Création impossible.",
      });
    } finally {
      setEnCours(false);
    }
  }

  /* ------------------------------------------------------------------ */
  /* Résultat réel                                                       */
  /* ------------------------------------------------------------------ */
  if (resultat) {
    const delivery = (resultat.delivery as DeliveryRow[] | undefined) ?? [];
    return (
      <ModulePage titre="Nouvel abonné">
        <ModuleHeader
          surtitre="AUTO DYALI · Onboarding"
          titre="Création terminée"
          description="Le compte Auth, l'établissement, l'abonnement, les permissions et l'invitation ont été enregistrés côté serveur."
        />
        <div className="sa3d-root sa3d-panel mt-6 p-6">
          <h2 className="font-bold text-[#E8ECE8]">
            {resultat.idempotent ? "Requête déjà traitée (idempotence)" : "Création confirmée"}
          </h2>
          <dl className="mt-4 grid gap-2 text-xs text-[#A7B7A8] sm:grid-cols-2">
            <div><dt className="uppercase">Identifiant professionnel</dt><dd className="font-mono text-[#E8ECE8]">{String(resultat.professional_id ?? form.professionalId)}</dd></div>
            <div><dt className="uppercase">Identifiant de connexion</dt><dd className="font-mono text-[#E8ECE8]">{String(resultat.login_id ?? form.loginId)}</dd></div>
            <div><dt className="uppercase">Établissement</dt><dd className="font-mono text-[#E8ECE8]">{String(resultat.establishment_id ?? "—")}</dd></div>
            <div><dt className="uppercase">Abonnement</dt><dd className="font-mono text-[#E8ECE8]">{String(resultat.subscription_id ?? "—")}</dd></div>
            <div><dt className="uppercase">Manager Auth</dt><dd className="font-mono text-[#E8ECE8]">{String(resultat.manager_user_id ?? "—")}</dd></div>
            <div><dt className="uppercase">Invitation</dt><dd className="font-mono text-[#E8ECE8]">{String(resultat.invitation_id ?? "—")}</dd></div>
          </dl>

          <div className="mt-5">
            <h3 className="text-xs uppercase tracking-[0.15em] text-[#A7B7A8]">Transmission</h3>
            <ul className="mt-2 space-y-2 text-sm">
              {delivery.length === 0 && (
                <li className="text-[#A7B7A8]">Aucun statut de transmission renvoyé par le serveur.</li>
              )}
              {delivery.map((d) => (
                <li key={d.channel} className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-[#E8ECE8]">{d.channel === "email" ? "E-mail" : "WhatsApp"}</span>
                  <span className={`rounded px-2 py-0.5 text-[10px] font-semibold ${
                    d.status === "accepte_par_fournisseur"
                      ? "bg-[#5D9E7F]/15 text-[#5D9E7F]"
                      : d.status === "echec"
                        ? "bg-[#C5716B]/15 text-[#C5716B]"
                        : "bg-[#D6A34D]/15 text-[#D6A34D]"
                  }`}>
                    {DELIVERY_STATUS_LABEL[d.status] ?? d.status}
                  </span>
                  {d.providerError && <span className="text-[11px] text-[#C5716B]">{d.providerError}</span>}
                  {d.providerRef && <span className="font-mono text-[10px] text-[#A7B7A8]">{d.providerRef}</span>}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[11px] text-[#A7B7A8]">
              « Accepté par le fournisseur » signifie que l'API a accepté la requête. Aucune livraison/lecture n'est affirmée sans preuve (webhook signé). Le lien d'activation est à usage unique, expire sous <strong>7 jours</strong> et le jeton n'est stocké qu'en empreinte (hash). Le Manager doit définir son propre mot de passe via ce lien avant l'accès normal.
            </p>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <Link href="/super-admin/entreprises/" className="btn-or px-4 py-2 text-sm">Voir les entreprises</Link>
            <Link href="/super-admin/invitations/" className="sa3d-btn sa3d-btn-fantome">
              Suivre les invitations
            </Link>
            <button
              type="button"
              className="sa3d-btn sa3d-btn-fantome"
              onClick={() => {
                setResultat(null);
                setEtape(1);
                setForm((f) => ({
                  ...f,
                  name: "",
                  legalName: "",
                  slug: "",
                  activityType: "",
                  professionalId: "",
                  address: "",
                  city: "",
                  region: "",
                  country: "Maroc",
                  phone: "",
                  email: "",
                  complementaryContacts: "",
                  adminInfo: "",
                  dossierState: "en_constitution",
                  notes: "",
                  managerFirstName: "",
                  managerLastName: "",
                  managerFullName: "",
                  managerEmail: "",
                  managerPhone: "",
                  loginId: "",
                  temporaryPassword: "",
                  temporaryPasswordConfirm: "",
                  rights: {},
                }));
                setDispo({});
              }}
            >
              Créer un autre abonné
            </button>
          </div>
        </div>
      </ModulePage>
    );
  }

  /* ------------------------------------------------------------------ */
  /* Formulaire                                                          */
  /* ------------------------------------------------------------------ */
  const actions: { key: keyof DroitModule; label: string }[] = [
    { key: "canView", label: "Voir" },
    { key: "canCreate", label: "Créer" },
    { key: "canEdit", label: "Modifier" },
    { key: "canDelete", label: "Supprimer" },
  ];

  return (
    <ModulePage titre="Nouvel abonné">
      <ModuleHeader
        surtitre="AUTO DYALI · Onboarding"
        titre="Nouvel abonné professionnel"
        description="Parcours P0 en 6 étapes : établissement, Manager, formule/abonnement/essai, modules & droits réels, invitation e-mail/WhatsApp (canaux indépendants), récapitulatif et confirmation."
      />

      <form onSubmit={soumettre} className="sa3d-root sa3d-panel mt-6 p-6 lg:p-8" noValidate>
        {(santeEnvErreur || (santeEnv && Object.values(santeEnv).some((ok) => !ok))) && (
          <p role="alert" className="sa3d-alert sa3d-alert--erreur mb-4">
            Environnement non prêt : {santeEnvErreur ?? "objets requis absents"}. La création est bloquée.
          </p>
        )}
        <div className="flex items-center justify-between mb-6">
          <span className="text-sm font-semibold text-[#E8ECE8]">
            Étape {etape} / 6 — {ETAPES[etape - 1]}
          </span>
          {verification && <span className="text-[11px] text-[#A7B7A8]">Vérification serveur…</span>}
        </div>
        <div className="w-full h-1 bg-[#344440] rounded-full mb-6">
          <div className="h-1.5 rounded-full bg-[#8FB59B] transition-all duration-300" style={{ width: `${(etape / 6) * 100}%` }} />
        </div>

        {erreurPlans && (
          <p className="mb-4 rounded-lg bg-[#C5716B]/15 px-3 py-2 text-xs text-[#C5716B]">
            Référentiel indisponible : {erreurPlans}
          </p>
        )}
        {erreurGlobale && (
          <p className="mb-4 rounded-lg bg-[#C5716B]/15 px-3 py-2 text-xs text-[#C5716B]">{erreurGlobale}</p>
        )}
        {dispoErreur && (
          <p className="mb-4 rounded-lg bg-[#D6A34D]/15 px-3 py-2 text-xs text-[#D6A34D]">{dispoErreur}</p>
        )}

        {/* ÉTAPE 1 — Entreprise */}
        {etape === 1 && (
          <>
            <h2 className="text-lg font-bold text-[#E8ECE8] mb-1">1. Identification de l'entreprise et de l'établissement</h2>
            <p className="text-xs text-[#A7B7A8] mb-4">Renseignez les informations professionnelles de l'abonné. L'identifiant professionnel AUTO DYALI est unique et doit être contrôlé côté serveur (format cible <span className="font-mono">ADY-PRO-XXXXXX</span>, sans collision).</p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Champ3D label="Raison sociale" obligatoire value={form.legalName} onChange={(v) => modifier("legalName", v)} placeholder="Garage Atlas SARL" erreur={erreur("establishment.legalName")} />
              <Champ3D label="Nom commercial" obligatoire value={form.name} onChange={(v) => modifier("name", v)} placeholder="Garage Atlas" erreur={erreur("establishment.name") ?? erreursPartagees.name} />
              <Champ3D label="Slug (URL interne)" obligatoire mono value={form.slug} onChange={(v) => modifier("slug", v)} placeholder="garage-atlas" erreur={erreur("establishment.slug") ?? (dispo.slug_available === false ? "Slug déjà utilisé." : undefined)} />
              <Champ3D
                label="Identifiant professionnel AUTO DYALI" obligatoire mono className="lg:col-span-2"
                value={form.professionalId} onChange={(v) => modifier("professionalId", v.toUpperCase())}
                placeholder="ADY-PRO-XXXXXX"
                action={<button type="button" onClick={() => modifier("professionalId", genererIdentifiantProfessionnel())} className="sa3d-btn sa3d-btn-fantome shrink-0 px-3 py-2 text-xs">Générer</button>}
                aide={dispo.professional_id_available === true ? "Identifiant disponible (vérification actuelle)." : "Généré côté client, unicité revalidée côté serveur lors de la création."}
                erreur={erreur("establishment.professionalId") ?? (dispo.professional_id_available === false ? "Identifiant déjà utilisé." : undefined)}
              />
              <Champ3D label="Type / activité de l'établissement" obligatoire value={form.activityType} onChange={(v) => modifier("activityType", v)} placeholder="Garage, carrosserie, centre pneus…" erreur={erreur("establishment.activityType")} />
              <Champ3D label="Adresse" obligatoire className="lg:col-span-2" value={form.address} onChange={(v) => modifier("address", v)} placeholder="123 Rue de la République" erreur={erreur("establishment.address") ?? erreursPartagees.address} />
              <ChampGeographieMaroc
                ville={form.city}
                region={form.region}
                country={form.country}
                onChange={(champ, valeur) => modifier(champ === "country" ? "country" : champ === "region" ? "region" : "city", valeur)}
                erreur={erreur("establishment.city") ?? erreur("establishment.region") ?? erreursPartagees.city}
              />
              <Champ3D label="Téléphone professionnel" type="tel" value={form.phone} onChange={(v) => modifier("phone", v)} placeholder="+212 6 00 00 00 00" erreur={erreur("establishment.phone") ?? erreursPartagees.phone} />
              <Champ3D label="Adresse e-mail professionnelle" obligatoire type="email" value={form.email} onChange={(v) => modifier("email", v)} placeholder="contact@garage.com" erreur={erreur("establishment.email") ?? erreursPartagees.email} />
              <div>
                <label className="sa3d-label">État du dossier</label>
                <select value={form.dossierState} onChange={(e) => modifier("dossierState", e.target.value)} className="sa3d-champ w-full">
                  <option value="en_constitution">En constitution</option>
                  <option value="en_attente">En attente de pièces</option>
                  <option value="complet">Complet</option>
                  <option value="valide">Validé</option>
                </select>
              </div>
              <Champ3D label="Coordonnées complémentaires" className="lg:col-span-2" value={form.complementaryContacts} onChange={(v) => modifier("complementaryContacts", v)} placeholder="Contact secondaire, WhatsApp établissement, site web…" />
              <Champ3D label="Informations juridiques" value={form.legalInfo} onChange={(v) => modifier("legalInfo", v)} placeholder="Forme juridique, registre, statuts…" />
              <Champ3D label="Informations fiscales" value={form.fiscalInfo} onChange={(v) => modifier("fiscalInfo", v)} placeholder="ICE, TVA, patente…" />
              <Champ3D label="Informations administratives" value={form.adminInfo} onChange={(v) => modifier("adminInfo", v)} placeholder="ICE, RC, patente, etc. (si disponibles)" />
              <Zone3D label="Notes complémentaires" className="lg:col-span-3" lignes={3} value={form.notes} onChange={(v) => modifier("notes", v)} placeholder="Informations complémentaires…" />
            </div>
            <div className="mt-6 flex justify-end">
              <button type="button" onClick={() => void prochainEtape()} className="sa3d-btn sa3d-btn-vert" disabled={!etapeValide(1)}>
                Suivant
              </button>
            </div>
          </>
        )}

        {/* ÉTAPE 2 — Manager (restaurée §72 : le bloc avait disparu) */}
        {etape === 2 && (
          <>
            <h2 className="text-lg font-bold text-[#E8ECE8] mb-1">2. Création du Manager</h2>
            <p className="text-xs text-[#A7B7A8] mb-4">Responsable de l'établissement. Ses identifiants sont uniques et contrôlés côté serveur. Il définira son propre mot de passe via le lien d'activation.</p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Champ3D label="Prénom" obligatoire value={form.managerFirstName} onChange={(v) => modifier("managerFirstName", v)} placeholder="Ahmed" />
              <Champ3D label="Nom" obligatoire value={form.managerLastName} onChange={(v) => modifier("managerLastName", v)} placeholder="Naji" erreur={erreur("manager.fullName")} />
              <Champ3D label="Téléphone" obligatoire type="tel" value={form.managerPhone} onChange={(v) => modifier("managerPhone", v)} placeholder="+212 6 00 00 00 00" erreur={erreur("manager.phone")} />
              <Champ3D label="E-mail professionnel" obligatoire type="email" value={form.managerEmail} onChange={(v) => modifier("managerEmail", v)} placeholder="ahmed.naji@garage.com"
                aide={dispo.email_available === true ? "E-mail disponible." : undefined}
                erreur={erreur("manager.email") ?? (dispo.email_available === false ? "Un compte existe déjà pour cet e-mail." : undefined)} />
              <Champ3D label="Identifiant de connexion Manager" obligatoire mono className="lg:col-span-2"
                value={form.loginId} onChange={(v) => modifier("loginId", v.toLowerCase())} placeholder="a.naji"
                action={<button type="button" onClick={() => modifier("loginId", `mgr.${genererIdentifiantProfessionnel().replace("ADY-PRO-", "").toLowerCase()}`)} className="sa3d-btn sa3d-btn-fantome shrink-0 px-3 py-2 text-xs">Générer</button>}
                erreur={erreur("manager.loginId") ?? (dispo.login_id_available === false ? "Identifiant déjà utilisé." : undefined)} />
              <Champ3D label="Mot de passe temporaire" obligatoire type="password" value={form.temporaryPassword} onChange={(v) => modifier("temporaryPassword", v)} placeholder="10 caractères minimum" erreur={erreur("manager.temporaryPassword")} />
              <Champ3D label="Confirmer le mot de passe" obligatoire type="password" value={form.temporaryPasswordConfirm} onChange={(v) => modifier("temporaryPasswordConfirm", v)} placeholder="Confirmer" erreur={erreur("manager.temporaryPasswordConfirm")} />
            </div>
            <p className="mt-3 text-[11px] text-[#A7B7A8]">Le mot de passe temporaire est transmis une seule fois au serveur (Auth) et n'est ni stocké en clair, ni renvoyé, ni envoyé par e-mail/WhatsApp. Le Manager choisit son propre mot de passe via le lien d'activation.</p>
            <div className="mt-6 flex justify-between">
              <button type="button" onClick={etapePrecedente} className="sa3d-btn sa3d-btn-fantome">Précédent</button>
              <button type="button" onClick={() => void prochainEtape()} className="sa3d-btn sa3d-btn-vert" disabled={!etapeValide(2) || verification}>Suivant</button>
            </div>
          </>
        )}

        {/* ÉTAPE 3 — Formule & abonnement */}
        {etape === 3 && (
          <>
            <h2 className="text-lg font-bold text-[#E8ECE8] mb-1">3. Formule, abonnement et période</h2>
            <p className="text-xs text-[#A7B7A8] mb-4">Choisissez la formule, la durée payante et l'essai (indépendant). Les durées et dates sont contrôlées pour cohérence.</p>
            {chargementPlans ? (
              <p className="text-xs text-[#A7B7A8]">Chargement des formules…</p>
            ) : erreurPlans ? (
              <p className="text-xs text-[#C5716B]">{erreurPlans}</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {plansReels.map((pl) => (
                  <div key={pl.code} className={`carte p-4 rounded-lg border ${form.plan === pl.code ? "border-[#8FB59B] bg-[#8FB59B]/10" : "border-[#344440]/50 hover:border-[#8FB59B]/50"}`}>
                    <h3 className="text-sm font-bold text-[#E8ECE8]">{pl.label}</h3>
                    <p className="text-[11px] text-[#A7B7A8]">{pl.description ?? ""}</p>
                    <p className="mt-2 text-lg font-mono text-[#DFE7E2]">{pl.price_monthly ? pl.price_monthly.toLocaleString("fr-FR") + " MAD" : "Non configuré"}</p>
                    <p className="text-xs text-[#A7B7A8]">Essai forfait : {pl.trial_days} jours · Utilisateurs : {pl.max_users} · Sites : {pl.max_sites}</p>
                    <button type="button" onClick={() => modifier("plan", pl.code)} className={`mt-2 rounded-lg px-3 py-1 text-xs font-bold ${form.plan === pl.code ? "bg-[#8FB59B] text-[#252D2D]" : "border border-[#8FB59B]/40 text-[#DFE7E2] hover:bg-[#8FB59B]/10"}`}>
                      {form.plan === pl.code ? "Sélectionné" : "Sélectionner"}
                    </button>
                  </div>
                ))}
              </div>
            )}
            {erreur("subscription.plan") && <p className="mt-2 text-xs text-[#C5716B]">{erreur("subscription.plan")}</p>}

            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="sa3d-label">Durée payante *</label>
                <select value={form.paidDuration} onChange={(e) => modifier("paidDuration", e.target.value)} className="sa3d-champ w-full">
                  <option value="1mois">1 mois</option>
                  <option value="3mois">3 mois</option>
                  <option value="6mois">6 mois</option>
                  <option value="1an">1 an</option>
                  <option value="2ans">2 ans</option>
                  <option value="personnalisee">Durée personnalisée</option>
                </select>
                {form.paidDuration === "personnalisee" && (
                  <div className="mt-2 flex items-center gap-2">
                    <input type="number" min={1} max={120} value={form.paidMonths} onChange={(e) => modifier("paidMonths", Math.max(1, Math.min(120, parseInt(e.target.value) || 0)))} className="sa3d-champ w-24" />
                    <span className="text-[10px] text-[#A7B7A8]">mois</span>
                  </div>
                )}
                {erreur("subscription.paidDuration") && <p className="mt-1 text-xs text-[#C5716B]">{erreur("subscription.paidDuration")}</p>}
                {erreur("subscription.paidDurationMonths") && <p className="mt-1 text-xs text-[#C5716B]">{erreur("subscription.paidDurationMonths")}</p>}
              </div>
              <div>
                <label className="sa3d-label">Durée d'essai (indépendante)</label>
                <select value={form.trialDuration} onChange={(e) => modifier("trialDuration", e.target.value)} className="sa3d-champ w-full">
                  <option value="aucun">Aucun essai</option>
                  <option value="7">7 jours</option>
                  <option value="15">15 jours</option>
                  <option value="30">30 jours</option>
                  <option value="45">45 jours</option>
                  <option value="60">60 jours</option>
                  <option value="personnalisee">Durée personnalisée</option>
                </select>
                {form.trialDuration === "personnalisee" && (
                  <div className="mt-2 flex items-center gap-2">
                    <input type="number" min={1} max={365} value={form.trialDays} onChange={(e) => modifier("trialDays", Math.max(1, Math.min(365, parseInt(e.target.value) || 0)))} className="sa3d-champ w-24" />
                    <span className="text-[10px] text-[#A7B7A8]">jours</span>
                  </div>
                )}
                {erreur("subscription.trialDuration") && <p className="mt-1 text-xs text-[#C5716B]">{erreur("subscription.trialDuration")}</p>}
                {erreur("subscription.trialDurationDays") && <p className="mt-1 text-xs text-[#C5716B]">{erreur("subscription.trialDurationDays")}</p>}
              </div>
              <div>
                <label className="sa3d-label">Date de début *</label>
                <input type="date" value={form.startDate} onChange={(e) => modifier("startDate", e.target.value)} className="sa3d-champ w-full" />
                {erreur("subscription.startDate") && <p className="mt-1 text-xs text-[#C5716B]">{erreur("subscription.startDate")}</p>}
              </div>
            </div>
            <p className="mt-3 text-[11px] text-[#A7B7A8]">
              Fin de période payante calculée : {dates.paidEndDate}
              {dates.trialEndDate ? ` · Fin d'essai : ${dates.trialEndDate}` : ""}
            </p>
            <div className="mt-2 rounded-lg border border-[#8FB59B]/20 bg-[#344440]/40 p-3 text-[11px] text-[#A7B7A8]">
              <p><strong className="text-[#E8ECE8]">Règles :</strong> durées payantes proposées 1, 3, 6 mois, 1 an, 2 ans et personnalisée (sans limite artificielle de 90 jours). L'essai est indépendant de l'abonnement et <strong>ne réduit pas</strong> la durée payante souscrite. Date de début, fin, renouvellement/suspension/réactivation/expiration/changement de formule et historique sont gérés selon les capacités du système (cycle de vie abonnements).</p>
            </div>
            <div className="mt-6 flex justify-between">
              <button type="button" onClick={etapePrecedente} className="sa3d-btn sa3d-btn-fantome">Précédent</button>
              <button type="button" onClick={() => void prochainEtape()} className="sa3d-btn sa3d-btn-vert" disabled={!etapeValide(3) || !form.plan}>
                Suivant
              </button>
            </div>
          </>
        )}

        {/* ÉTAPE 4 — Modules & permissions */}
        {etape === 4 && (
          <>
            <h2 className="text-lg font-bold text-[#E8ECE8] mb-2">4. Modules & permissions</h2>
            <p className="text-xs text-[#A7B7A8] mb-4">
              Les modules proposés proviennent du forfait (`plan_features`). Les cases d'action deviennent de vraies lignes
              `permissions` appliquées côté serveur, et non des cases décoratives.
            </p>
            <div className="space-y-3">
              {featuresDuPlan(form.plan).map((feature) => {
                const droit = form.rights[feature];
                return (
                  <div key={feature} className={`rounded-lg border px-3 py-2 ${droit ? "border-[#8FB59B]/50" : "border-[#344440]/50"}`}>
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="flex items-center gap-2 text-sm text-[#E8ECE8]">
                        <input type="checkbox" checked={Boolean(droit)} onChange={() => basculerModule(feature)} className="rounded border-[#344440]" />
                        <span className="font-medium">{feature}</span>
                      </label>
                      <div className="flex flex-wrap gap-3 text-xs text-[#A7B7A8]">
                        {actions.map((a) => (
                          <label key={a.key} className={`flex items-center gap-1 ${droit ? "" : "opacity-40"}`}>
                            <input
                              type="checkbox"
                              disabled={!droit}
                              checked={Boolean(droit?.[a.key])}
                              onChange={(e) => modifierDroit(feature, a.key, e.target.checked)}
                              className="rounded border-[#344440]"
                            />
                            {a.label}
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
              {featuresDuPlan(form.plan).length === 0 && (
                <p className="text-xs text-[#A7B7A8]">
                  Aucun module n'est configuré pour cette formule dans `plan_features`. La création est bloquée pour éviter un abonné sans droits.
                </p>
              )}
            </div>
            {(erreur("modules") || erreur("permissions")) && (
              <p className="mt-3 text-xs text-[#C5716B]">{erreur("modules") ?? erreur("permissions")}</p>
            )}
            <div className="mt-6 flex justify-between">
              <button type="button" onClick={etapePrecedente} className="sa3d-btn sa3d-btn-fantome">Précédent</button>
              <button type="button" onClick={() => void prochainEtape()} className="sa3d-btn sa3d-btn-vert" disabled={!etapeValide(4) || !planActif}>
                Suivant
              </button>
            </div>
          </>
        )}

        {/* ÉTAPE 5 — Transmission */}
        {etape === 5 && (
          <>
            <h2 className="text-lg font-bold text-[#E8ECE8] mb-1">5. Identification et invitation par e-mail et WhatsApp</h2>
            <p className="text-xs text-[#A7B7A8] mb-4">Canaux indépendants : e-mail uniquement, WhatsApp uniquement, ou les deux. L'échec d'un canal n'annule pas l'autre. Aucun statut « envoyé/délivré » sans preuve du fournisseur.</p>

            <div className="mb-4 rounded-lg border border-[#344440]/60 bg-[#252D2D] p-4">
              <h3 className="text-xs uppercase tracking-[0.15em] text-[#A7B7A8] mb-2">Récapitulatif sécurisé (à transmettre)</h3>
              <div className="grid gap-2 text-xs text-[#DFE7E2] sm:grid-cols-2">
                <p><span className="text-[#A7B7A8]">Identifiant professionnel :</span> <span className="font-mono">{form.professionalId || "—"}</span></p>
                <p><span className="text-[#A7B7A8]">Identifiant de connexion Manager :</span> <span className="font-mono">{form.loginId || "—"}</span></p>
                <p><span className="text-[#A7B7A8]">Établissement :</span> {form.name || "—"} ({form.slug || "—"})</p>
                <p><span className="text-[#A7B7A8]">Formule :</span> {(plansReels.find(p => p.code === form.plan)?.label) ?? form.plan ?? "—"}</p>
                <p><span className="text-[#A7B7A8]">Durée abonnement :</span> {paidDurationToMonths(form.paidDuration, form.paidMonths)} mois (début {dates.startDate}, fin {dates.paidEndDate})</p>
                <p><span className="text-[#A7B7A8]">Période d'essai :</span> {trialDurationToDays(form.trialDuration, form.trialDays) > 0 ? `${trialDurationToDays(form.trialDuration, form.trialDays)} jours${dates.trialEndDate ? ` (jusqu'au ${dates.trialEndDate})` : ""}` : "Aucun"}</p>
                <p className="sm:col-span-2"><span className="text-[#A7B7A8]">Expiration du lien d'activation :</span> <strong className="text-[#E8ECE8]">7 jours</strong> après émission (usage unique, jeton hashé SHA-256, invalidation après utilisation).</p>
              </div>
              <div className="mt-3 text-[11px] text-[#A7B7A8]">
                <p className="font-semibold text-[#E8ECE8]">Instructions de première connexion :</p>
                <ul className="mt-1 list-disc pl-4 space-y-0.5">
                  <li>Ouvrir le lien d'activation sécurisé reçu (e-mail et/ou WhatsApp).</li>
                  <li>Définir votre propre mot de passe avant tout accès normal (le lien n'est pas consommé à la simple ouverture).</li>
                  <li>Se connecter avec votre identifiant Manager et le mot de passe défini ; changer le mot de passe si une rotation est exigée.</li>
                </ul>
                <p className="mt-2">Contacts admin de référence : <span className="font-mono">me.achbani@gmail.com</span> · <span className="font-mono">+33772208885</span> (références, non preuve de configuration fournisseur).</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex items-start gap-2 rounded-lg border border-[#344440]/60 p-3">
                <input type="checkbox" checked={form.deliveryEmail} onChange={(e) => modifier("deliveryEmail", e.target.checked)} className="mt-1 rounded border-[#344440]" />
                <span>
                  <span className="block text-sm text-[#DFE7E2]">Invitation par e-mail</span>
                  <span className="block text-[11px] text-[#A7B7A8]">Destinataire : {form.managerEmail || "—"} (vérifié côté formulaire/serveur). Modèle professionnel, identifiant de connexion et lien d'activation sécurisé. Statut/historique réels selon fournisseur (Resend si configuré).</span>
                </span>
              </label>
              <label className="flex items-start gap-2 rounded-lg border border-[#344440]/60 p-3">
                <input type="checkbox" checked={form.deliveryWhatsapp} onChange={(e) => modifier("deliveryWhatsapp", e.target.checked)} className="mt-1 rounded border-[#344440]" />
                <span>
                  <span className="block text-sm text-[#DFE7E2]">Invitation par WhatsApp Business</span>
                  <span className="block text-[11px] text-[#A7B7A8]">Numéro : {form.managerPhone || "—"} (vérifié). Message professionnel, identifiant et lien sécurisé. Suivi distinct, historique/erreurs fournisseur (Meta si configuré).</span>
                </span>
              </label>
            </div>
            {erreur("delivery") && <p className="mt-2 text-xs text-[#C5716B]">{erreur("delivery")}</p>}
            <div className="mt-4 bg-[#344440] rounded-lg p-4">
              <p className="text-xs text-[#A7B7A8] mb-2">Sécurité et transparence :</p>
              <ul className="text-xs text-[#A7B7A8] space-y-1 list-disc pl-4">
                <li>Jeton à usage unique, empreinte SHA-256 seule stockée, expiration 7 jours, invalidation après utilisation.</li>
                <li>Le jeton n'est pas consommé à l'ouverture de la page `/activer/`.</li>
                <li>Aucun mot de passe permanent transmis par e-mail ou WhatsApp ; aucun stockage/journalisation en clair.</li>
                <li>Statuts possibles : non demandé, en attente/préparé, accepté par le fournisseur, échec, non configuré — jamais « délivré/lu » sans preuve (webhook signé).</li>
              </ul>
            </div>
            <div className="mt-6 flex justify-between">
              <button type="button" onClick={etapePrecedente} className="sa3d-btn sa3d-btn-fantome">Précédent</button>
              <button type="button" onClick={() => void prochainEtape()} className="sa3d-btn sa3d-btn-vert" disabled={!etapeValide(5) || verification}>
                Suivant
              </button>
            </div>
          </>
        )}

        {/* ÉTAPE 6 — Récapitulatif */}
        {etape === 6 && (
          <>
            <h2 className="text-lg font-bold text-[#E8ECE8] mb-1">6. Récapitulatif et confirmation</h2>
            <p className="text-xs text-[#A7B7A8] mb-4">Vérifiez toutes les informations avant création. Contrôles : unicité identifiants, validité coordonnées, cohérence formule/durée/essai, modules/permissions autorisés, état des invitations, absence de doublons. Création transactionnelle/compensée, idempotente et traçable (selon backend/migrations appliqués).</p>
            <Section3D numero="✓" titre="Récapitulatif complet" sousTitre="Validation explicite avant création définitive">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-lg bg-[#252D2D] p-3">
                <h4 className="text-xs text-[#A7B7A8] mb-1">Établissement</h4>
                <p className="text-sm text-[#E8ECE8]">{form.legalName || "—"}</p>
                <p className="text-[11px] text-[#A7B7A8]">Nom commercial : {form.name || "—"}</p>
                <p className="text-[11px] text-[#A7B7A8]">Slug : {form.slug || "—"} · Activité : {form.activityType || "—"}</p>
                <p className="text-[11px] text-[#A7B7A8]">{[form.address, form.city, form.region, form.country].filter(Boolean).join(", ")}</p>
                <p className="text-[11px] text-[#A7B7A8]">Tél. : {form.phone || "—"} · E-mail : {form.email || "—"}</p>
                <p className="text-[11px] text-[#A7B7A8]">Dossier : {form.dossierState}</p>
                {([
                  ["Juridique", form.legalInfo],
                  ["Fiscal", form.fiscalInfo],
                  ["Admin", form.adminInfo],
                  ["Contacts", form.complementaryContacts],
                ] as const)
                  .filter(([, v]) => v)
                  .map(([libelle, v]) => (
                    <p key={libelle} className="text-[11px] text-[#A7B7A8]">{libelle} : {v}</p>
                  ))}
              </div>
              <div className="rounded-lg bg-[#252D2D] p-3">
                <h4 className="text-xs text-[#A7B7A8] mb-1">Identifiants & Manager</h4>
                <p className="text-[11px] text-[#A7B7A8]">ID professionnel</p>
                <p className="text-sm font-mono text-[#E8ECE8]">{form.professionalId}</p>
                <p className="mt-2 text-[11px] text-[#A7B7A8]">Manager (rôle <span className="font-mono">manager</span>, rattaché établissement)</p>
                <p className="text-sm text-[#E8ECE8]">{[form.managerFirstName, form.managerLastName].filter(Boolean).join(" ") || form.managerFullName || "—"}</p>
                <p className="text-[11px] text-[#A7B7A8]">Login : <span className="font-mono text-[#DFE7E2]">{form.loginId || "—"}</span></p>
                <p className="text-[11px] text-[#A7B7A8]">E-mail : {form.managerEmail || "—"} · Tél. : {form.managerPhone || "—"}</p>
              </div>
              <div className="rounded-lg bg-[#252D2D] p-3">
                <h4 className="text-xs text-[#A7B7A8] mb-1">Formule & période</h4>
                <p className="text-sm text-[#E8ECE8]">{planActif?.label ?? form.plan}</p>
                <p className="text-[11px] text-[#A7B7A8]">Durée payante : {paidDurationToMonths(form.paidDuration, form.paidMonths)} mois (début {dates.startDate}, fin {dates.paidEndDate})</p>
                <p className="text-[11px] text-[#A7B7A8]">Essai : {trialDurationToDays(form.trialDuration, form.trialDays) > 0 ? `${trialDurationToDays(form.trialDuration, form.trialDays)} jours${dates.trialEndDate ? ` (fin ${dates.trialEndDate})` : ""}` : "Aucun"} — indépendant, ne réduit pas la durée payante.</p>
                <p className="text-[11px] text-[#A7B7A8]">Renouvellement/suspension/réactivation/expiration/historique : selon cycle de vie abonnement.</p>
              </div>
              <div className="rounded-lg bg-[#252D2D] p-3 lg:col-span-2">
                <h4 className="text-xs text-[#A7B7A8] mb-1">Modules & droits (effet réel)</h4>
                <ul className="space-y-1 text-[11px] text-[#A7B7A8]">
                  {Object.entries(form.rights).map(([module, d]) => (
                    <li key={module}>
                      <span className="text-[#E8ECE8]">{module}</span>{" "}
                      {[d.canView ? "voir" : null, d.canCreate ? "créer" : null, d.canEdit ? "modifier" : null, d.canDelete ? "supprimer" : null].filter(Boolean).join(" · ")}
                    </li>
                  ))}
                  {Object.keys(form.rights).length === 0 && <li>Aucun module sélectionné.</li>}
                </ul>
                <p className="mt-2 text-[10px] text-[#A7B7A8]">Cohérence formule ∩ permissions appliquée côté serveur (non vérifiable ici sans backend distant).</p>
              </div>
              <div className="rounded-lg bg-[#252D2D] p-3">
                <h4 className="text-xs text-[#A7B7A8] mb-1">Invitation & activation</h4>
                <p className="text-sm text-[#E8ECE8]">{form.deliveryEmail ? `E-mail : ${form.managerEmail}` : "E-mail : non demandé"}</p>
                <p className="text-sm text-[#E8ECE8]">{form.deliveryWhatsapp ? `WhatsApp : ${form.managerPhone}` : "WhatsApp : non demandé"}</p>
                <p className="mt-2 text-[11px] text-[#A7B7A8]">Lien d'activation sécurisé : usage unique, expiration <strong className="text-[#E8ECE8]">7 jours</strong>, hash du jeton seul stocké. Le Manager définit son mot de passe avant l'accès normal. Aucun mot de passe en clair transmis/stocké/journalisé.</p>
              </div>
            </div>
            </Section3D>
            <div className="mt-8 flex justify-between">
              <button type="button" onClick={etapePrecedente} className="sa3d-btn sa3d-btn-fantome">Précédent</button>
              {(santeEnvErreur || (santeEnv && Object.values(santeEnv).some((ok) => !ok))) && (
                <div className="sa3d-alert sa3d-alert--erreur mb-3" role="alert">
                  <p className="font-semibold">Environnement non prêt pour la création</p>
                  <p className="mt-1">{santeEnvErreur}</p>
                  <p className="mt-1">Aucun établissement ni Manager ne sera créé. Appliquez les migrations validées sur l&apos;environnement cible puis réessayez.</p>
                </div>
              )}
              {dispoErreur && !santeEnvErreur && (
                <div className="sa3d-alert sa3d-alert--erreur mb-3" role="alert">
                  <p className="font-semibold">Unicité non vérifiée à l’avance</p>
                  <p className="mt-1">{dispoErreur} La création revalidera les identifiants côté serveur ; elle sera refusée en cas de doublon.</p>
                  <label className="mt-2 flex items-start gap-2">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 accent-[#d8bd86]"
                      checked={confirmerSansVerification}
                      onChange={(e) => setConfirmerSansVerification(e.target.checked)}
                    />
                    <span>Je confirme vouloir créer malgré l’indisponibilité du contrôle préalable.</span>
                  </label>
                </div>
              )}
              <button
                type="submit"
                className="sa3d-btn sa3d-btn-vert px-6"
                disabled={
                  enCours ||
                  !validation.valid ||
                  !santeEnv ||
                  Boolean(santeEnvErreur) ||
                  Object.values(santeEnv).some((ok) => !ok) ||
                  (Boolean(dispoErreur) && !santeEnvErreur && !confirmerSansVerification)
                }
              >
                {enCours ? "Création en cours…" : "Créer l'abonné"}
              </button>
            </div>
          </>
        )}
      </form>
    </ModulePage>
  );
}
