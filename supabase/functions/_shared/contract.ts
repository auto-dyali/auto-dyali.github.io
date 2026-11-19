/**
 * AUTO DYALI — Contrat canonique d'onboarding (version 2).
 *
 * SOURCE UNIQUE DE VÉRITÉ partagée entre :
 *   - le formulaire Super Admin (`src/lib/onboarding-contract.ts` ré-exporte),
 *   - l'Edge Function `onboard-tenant` (import direct),
 *   - les tests Node (import direct).
 *
 * Aucune dépendance Deno/DOM/Node : ce fichier doit rester portable.
 *
 * Règles :
 *   - le serveur ne fait jamais confiance au client : il revalide tout ;
 *   - aucun champ reçu n'est ignoré silencieusement (clés inconnues refusées) ;
 *   - le mot de passe temporaire n'est jamais renvoyé ni journalisé.
 */

export const ONBOARDING_CONTRACT_VERSION = 2;

export const PLAN_CODES = ["standard", "silver", "gold"] as const;
export type PlanCode = (typeof PLAN_CODES)[number];

export const PAID_DURATIONS = [
  "1mois",
  "3mois",
  "6mois",
  "1an",
  "2ans",
  "personnalisee",
] as const;
export type PaidDuration = (typeof PAID_DURATIONS)[number];

export const TRIAL_DURATIONS = [
  "aucun",
  "7",
  "15",
  "30",
  "45",
  "60",
  "personnalisee",
] as const;
export type TrialDuration = (typeof TRIAL_DURATIONS)[number];

export const DELIVERY_CHANNELS = ["email", "whatsapp"] as const;
export type DeliveryChannel = (typeof DELIVERY_CHANNELS)[number];

export type DeliveryStatus =
  | "non_demande"
  | "en_attente"
  | "accepte_par_fournisseur"
  | "echec"
  | "non_configure";

/**
 * Droit accordé sur un module. Distinct de `modules` (modules du forfait
 * réellement ouverts à l'établissement) : `permissions` porte les actions
 * autorisées pour le rôle Manager.
 */
export type PermissionGrant = {
  module: string;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
};

export type OnboardingPayload = {
  contractVersion: number;
  requestId: string;
  establishment: {
    name: string;
    legalName: string;
    slug: string;
    activityType: string;
    professionalId: string;
    address: string;
    city: string;
    region: string;
    phone: string;
    email: string;
    notes: string;
    country?: string;
    legalInfo?: string;
    fiscalInfo?: string;
    adminInfo?: string;
    dossierState?: string;
    complementaryContacts?: string;
  };
  manager: {
    fullName: string;
    email: string;
    phone: string;
    loginId: string;
    /** Mot de passe temporaire : jamais persisté, jamais renvoyé. */
    temporaryPassword: string;
    temporaryPasswordConfirm: string;
  };
  subscription: {
    plan: string;
    paidDuration: string;
    paidDurationMonths: number;
    trialDuration: string;
    trialDurationDays: number;
    startDate: string;
  };
  modules: string[];
  permissions: PermissionGrant[];
  delivery: {
    email: boolean;
    whatsapp: boolean;
  };
};

export type OnboardingErrors = Record<string, string>;

export const CONTRACT_TOP_LEVEL_KEYS = [
  "contractVersion",
  "requestId",
  "establishment",
  "manager",
  "subscription",
  "modules",
  "permissions",
  "delivery",
] as const;

export const CONTRACT_ESTABLISHMENT_KEYS = [
  "name",
  "legalName",
  "slug",
  "activityType",
  "professionalId",
  "address",
  "city",
  "region",
  "phone",
  "email",
  "notes",
  "country",
  "legalInfo",
  "fiscalInfo",
  "adminInfo",
  "dossierState",
  "complementaryContacts",
] as const;

export const CONTRACT_MANAGER_KEYS = [
  "fullName",
  "email",
  "phone",
  "loginId",
  "temporaryPassword",
  "temporaryPasswordConfirm",
] as const;

export const CONTRACT_SUBSCRIPTION_KEYS = [
  "plan",
  "paidDuration",
  "paidDurationMonths",
  "trialDuration",
  "trialDurationDays",
  "startDate",
] as const;

export const CONTRACT_DELIVERY_KEYS = ["email", "whatsapp"] as const;

/* ------------------------------------------------------------------ */
/* Utilitaires purs                                                     */
/* ------------------------------------------------------------------ */

export const SLUG_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const LOGIN_REGEX = /^[a-z0-9]([a-z0-9._-]{1,28}[a-z0-9])$/;
export const PROFESSIONAL_ID_REGEX = /^[A-Z0-9][A-Z0-9._-]{2,39}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function isValidEmail(value: string): boolean {
  const v = value.trim();
  return v.length > 0 && v.length <= 254 && EMAIL_REGEX.test(v);
}

export function isValidUuid(value: string): boolean {
  return UUID_REGEX.test(value.trim());
}

export function isIsoDate(value: string): boolean {
  if (!ISO_DATE_REGEX.test(value)) return false;
  const d = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** Mois facturés pour une durée d'abonnement. */
export function paidDurationToMonths(
  paidDuration: string,
  customMonths: number,
): number {
  switch (paidDuration) {
    case "1mois":
      return 1;
    case "3mois":
      return 3;
    case "6mois":
      return 6;
    case "1an":
      return 12;
    case "2ans":
      return 24;
    case "personnalisee":
      return Math.trunc(customMonths);
    default:
      return 0;
  }
}

/** Jours d'essai pour une durée d'essai. */
export function trialDurationToDays(
  trialDuration: string,
  customDays: number,
): number {
  if (trialDuration === "aucun") return 0;
  if (trialDuration === "personnalisee") return Math.trunc(customDays);
  const n = Number(trialDuration);
  return Number.isFinite(n) ? Math.trunc(n) : -1;
}

/** Ajoute des mois à une date ISO (UTC, sans déborder sur le mois suivant). */
export function addMonthsIso(isoDate: string, months: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const base = new Date(Date.UTC(y, m - 1, d));
  const targetMonth = base.getUTCMonth() + months;
  const year = base.getUTCFullYear() + Math.floor(targetMonth / 12);
  const month = ((targetMonth % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const day = Math.min(d, lastDay);
  return new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);
}

export function computeSubscriptionDates(
  startDate: string,
  paidMonths: number,
  trialDays: number,
): { startDate: string; paidEndDate: string; trialEndDate: string | null } {
  const start = isIsoDate(startDate)
    ? startDate
    : new Date().toISOString().slice(0, 10);
  const paidEndDate = addMonthsIso(start, Math.max(1, paidMonths));
  const trialEndDate =
    trialDays > 0
      ? new Date(
          Date.parse(`${start}T00:00:00.000Z`) + trialDays * 86_400_000,
        )
          .toISOString()
          .slice(0, 10)
      : null;
  return { startDate: start, paidEndDate, trialEndDate };
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

function unknownKeys(
  obj: Record<string, unknown>,
  allowed: readonly string[],
): string[] {
  return Object.keys(obj).filter((k) => !allowed.includes(k));
}

/**
 * Valide et normalise un payload d'onboarding.
 * Le retour `normalized` ne doit jamais être renvoyé tel quel au client :
 * il contient le mot de passe temporaire.
 */
export function validateOnboardingPayload(
  input: unknown,
): { valid: boolean; errors: OnboardingErrors; normalized: OnboardingPayload | null } {
  const errors: OnboardingErrors = {};

  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { valid: false, errors: { _: "Corps de requête invalide." }, normalized: null };
  }
  const raw = input as Record<string, unknown>;

  for (const key of unknownKeys(raw, CONTRACT_TOP_LEVEL_KEYS)) {
    errors[`_unknown.${key}`] = `Champ inconnu refusé : ${key}.`;
  }

  if (Number(raw.contractVersion) !== ONBOARDING_CONTRACT_VERSION) {
    errors.contractVersion = `Version de contrat attendue : ${ONBOARDING_CONTRACT_VERSION}.`;
  }

  const requestId = typeof raw.requestId === "string" ? raw.requestId.trim() : "";
  if (!isValidUuid(requestId)) {
    errors.requestId = "Identifiant de requête invalide (UUID attendu).";
  }

  const establishment = (raw.establishment ?? {}) as Record<string, unknown>;
  const manager = (raw.manager ?? {}) as Record<string, unknown>;
  const subscription = (raw.subscription ?? {}) as Record<string, unknown>;
  const delivery = (raw.delivery ?? {}) as Record<string, unknown>;

  for (const key of unknownKeys(establishment, CONTRACT_ESTABLISHMENT_KEYS)) {
    errors[`_unknown.establishment.${key}`] = `Champ inconnu refusé : establishment.${key}.`;
  }
  for (const key of unknownKeys(manager, CONTRACT_MANAGER_KEYS)) {
    errors[`_unknown.manager.${key}`] = `Champ inconnu refusé : manager.${key}.`;
  }
  for (const key of unknownKeys(subscription, CONTRACT_SUBSCRIPTION_KEYS)) {
    errors[`_unknown.subscription.${key}`] = `Champ inconnu refusé : subscription.${key}.`;
  }
  for (const key of unknownKeys(delivery, CONTRACT_DELIVERY_KEYS)) {
    errors[`_unknown.delivery.${key}`] = `Champ inconnu refusé : delivery.${key}.`;
  }

  const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

  const name = str(establishment.name);
  if (name.length < 2 || name.length > 120) {
    errors["establishment.name"] = "Le nom commercial doit contenir entre 2 et 120 caractères.";
  }

  const slug = str(establishment.slug).toLowerCase();
  if (!SLUG_REGEX.test(slug)) {
    errors["establishment.slug"] = "Slug invalide : minuscules, chiffres et tirets uniquement.";
  }

  const professionalId = str(establishment.professionalId).toUpperCase();
  if (!PROFESSIONAL_ID_REGEX.test(professionalId)) {
    errors["establishment.professionalId"] =
      "Identifiant professionnel invalide (3 à 40 caractères : A-Z, 0-9, . _ -).";
  }

  const activityType = str(establishment.activityType);
  if (activityType.length < 2 || activityType.length > 120) {
    errors["establishment.activityType"] = "Le secteur/spécialité est obligatoire (2 à 120 caractères).";
  }

  const address = str(establishment.address);
  if (address.length < 5 || address.length > 200) {
    errors["establishment.address"] = "L'adresse complète est obligatoire (5 à 200 caractères).";
  }

  const city = str(establishment.city);
  if (city.length < 2 || city.length > 80) {
    errors["establishment.city"] = "La ville est obligatoire.";
  }

  const establishmentEmail = str(establishment.email);
  if (!isValidEmail(establishmentEmail)) {
    errors["establishment.email"] = "E-mail de l'entreprise invalide.";
  }

  const fullName = str(manager.fullName);
  if (fullName.length < 2 || fullName.length > 80) {
    errors["manager.fullName"] = "Le nom du Manager doit contenir entre 2 et 80 caractères.";
  }

  const managerEmail = str(manager.email).toLowerCase();
  if (!isValidEmail(managerEmail)) {
    errors["manager.email"] = "E-mail du Manager invalide.";
  }

  const managerPhone = str(manager.phone);
  if (managerPhone && !/^\+?[0-9][0-9 .()-]{7,19}$/.test(managerPhone)) {
    errors["manager.phone"] = "Téléphone du Manager invalide.";
  }

  const loginId = str(manager.loginId).toLowerCase();
  if (!LOGIN_REGEX.test(loginId)) {
    errors["manager.loginId"] =
      "Identifiant de connexion invalide (3 à 30 caractères : a-z, 0-9, . _ -).";
  }

  const temporaryPassword = typeof manager.temporaryPassword === "string" ? manager.temporaryPassword : "";
  const temporaryPasswordConfirm =
    typeof manager.temporaryPasswordConfirm === "string" ? manager.temporaryPasswordConfirm : "";
  if (temporaryPassword.length < 10) {
    errors["manager.temporaryPassword"] = "Le mot de passe temporaire doit contenir au moins 10 caractères.";
  } else if (!/[A-Za-z]/.test(temporaryPassword) || !/[0-9]/.test(temporaryPassword)) {
    errors["manager.temporaryPassword"] = "Le mot de passe temporaire doit contenir au moins une lettre et un chiffre.";
  }
  if (temporaryPasswordConfirm !== temporaryPassword) {
    errors["manager.temporaryPasswordConfirm"] = "Les mots de passe ne correspondent pas.";
  }

  const plan = str(subscription.plan).toLowerCase();
  if (!(PLAN_CODES as readonly string[]).includes(plan)) {
    errors["subscription.plan"] = "Forfait invalide (standard, silver ou gold).";
  }

  const paidDuration = str(subscription.paidDuration);
  if (!(PAID_DURATIONS as readonly string[]).includes(paidDuration)) {
    errors["subscription.paidDuration"] = "Durée d'abonnement invalide.";
  }
  const paidDurationMonths = Number(subscription.paidDurationMonths);
  const expectedMonths = paidDurationToMonths(paidDuration, paidDurationMonths);
  if (!Number.isFinite(paidDurationMonths) || expectedMonths < 1 || expectedMonths > 120) {
    errors["subscription.paidDurationMonths"] = "Durée facturée invalide (1 à 120 mois).";
  }

  const trialDuration = str(subscription.trialDuration);
  if (!(TRIAL_DURATIONS as readonly string[]).includes(trialDuration)) {
    errors["subscription.trialDuration"] = "Durée d'essai invalide.";
  }
  const trialDays = trialDurationToDays(trialDuration, Number(subscription.trialDurationDays));
  if (trialDays < 0 || trialDays > 365) {
    errors["subscription.trialDurationDays"] = "Durée d'essai invalide (0 à 365 jours).";
  }

  const startDate = str(subscription.startDate);
  if (!isIsoDate(startDate)) {
    errors["subscription.startDate"] = "Date de début invalide (AAAA-MM-JJ).";
  }

  const modulesRaw = raw.modules;
  const modules = Array.isArray(modulesRaw)
    ? modulesRaw.filter((m): m is string => typeof m === "string").map((m) => m.trim())
    : [];
  if (!Array.isArray(modulesRaw)) {
    errors.modules = "La liste des modules est invalide.";
  } else if (modules.length > 60) {
    errors.modules = "Trop de modules sélectionnés (60 maximum).";
  } else if (modules.length === 0) {
    errors.modules = "Sélectionnez au moins un module du forfait.";
  } else if (new Set(modules).size !== modules.length) {
    errors.modules = "Des modules sont sélectionnés plusieurs fois.";
  } else if (modules.some((m) => !/^[a-z0-9_]{2,40}$/.test(m))) {
    errors.modules = "Identifiant de module invalide.";
  }

  /**
   * Permissions : chaque module ouvert doit avoir exactement un droit.
   * Aucun droit n'est inventé : si le client omet un module, c'est une erreur
   * (le serveur refusera aussi), plutôt qu'un silence.
   */
  const permissionsRaw = raw.permissions;
  const permissions: PermissionGrant[] = [];
  if (!Array.isArray(permissionsRaw)) {
    errors.permissions = "La liste des permissions est invalide.";
  } else if (permissionsRaw.length > 60) {
    errors.permissions = "Trop de permissions (60 maximum).";
  } else {
    const seen = new Set<string>();
    permissionsRaw.forEach((entry, index) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        errors[`permissions.${index}`] = "Permission invalide.";
        return;
      }
      const p = entry as Record<string, unknown>;
      for (const key of unknownKeys(p, [
        "module",
        "canView",
        "canCreate",
        "canEdit",
        "canDelete",
      ])) {
        errors[`_unknown.permissions.${index}.${key}`] =
          `Champ inconnu refusé : permissions.${index}.${key}.`;
      }
      const moduleId = str(p.module);
      if (!/^[a-z0-9_]{2,40}$/.test(moduleId)) {
        errors[`permissions.${index}.module`] = "Identifiant de module invalide.";
        return;
      }
      if (seen.has(moduleId)) {
        errors[`permissions.${index}.module`] = `Module présent plusieurs fois : ${moduleId}.`;
        return;
      }
      seen.add(moduleId);
      const flags = {
        canView: p.canView === true,
        canCreate: p.canCreate === true,
        canEdit: p.canEdit === true,
        canDelete: p.canDelete === true,
      };
      if (!flags.canView && !flags.canCreate && !flags.canEdit && !flags.canDelete) {
        errors[`permissions.${index}`] =
          "Au moins une action doit être autorisée pour un module.";
        return;
      }
      permissions.push({ module: moduleId, ...flags });
    });

    if (!errors.permissions) {
      for (const moduleId of modules) {
        if (!seen.has(moduleId)) {
          errors.permissions = `Le module ${moduleId} n'a aucune permission associée.`;
          break;
        }
      }
      for (const p of permissions) {
        if (!modules.includes(p.module)) {
          errors.permissions = `Permission accordée sur un module non sélectionné : ${p.module}.`;
          break;
        }
      }
    }
  }

  const wantEmail = delivery.email === true;
  const wantWhatsApp = delivery.whatsapp === true;
  if (!wantEmail && !wantWhatsApp) {
    errors.delivery = "Sélectionnez au moins un canal de transmission.";
  }
  if (wantWhatsApp && !managerPhone) {
    errors["manager.phone"] = "Un numéro WhatsApp est requis pour la transmission WhatsApp.";
  }
  if (wantEmail && !isValidEmail(managerEmail)) {
    errors["manager.email"] = "Un e-mail valide est requis pour la transmission e-mail.";
  }

  const valid = Object.keys(errors).length === 0;
  const normalized: OnboardingPayload | null = valid
    ? {
        contractVersion: ONBOARDING_CONTRACT_VERSION,
        requestId,
        establishment: {
          name,
          legalName: str(establishment.legalName),
          slug,
          activityType,
          professionalId,
          address,
          city,
          region: str(establishment.region),
          phone: str(establishment.phone),
          email: establishmentEmail.toLowerCase(),
          notes: str(establishment.notes),
          country: str(establishment.country),
          legalInfo: str(establishment.legalInfo),
          fiscalInfo: str(establishment.fiscalInfo),
          adminInfo: str(establishment.adminInfo),
          dossierState: str(establishment.dossierState),
          complementaryContacts: str(establishment.complementaryContacts),
        },
        manager: {
          fullName,
          email: managerEmail,
          phone: managerPhone,
          loginId,
          temporaryPassword,
          temporaryPasswordConfirm,
        },
        subscription: {
          plan,
          paidDuration,
          paidDurationMonths: expectedMonths,
          trialDuration,
          trialDurationDays: trialDays,
          startDate,
        },
        modules: [...new Set(modules)].sort(),
        permissions: [...permissions].sort((a, b) => a.module.localeCompare(b.module)),
        delivery: { email: wantEmail, whatsapp: wantWhatsApp },
      }
    : null;

  return { valid, errors, normalized };
}

/** Construit le payload canonique depuis un brouillon d'interface. */
export function buildOnboardingPayload(
  draft: Omit<OnboardingPayload, "contractVersion">,
): OnboardingPayload {
  return { contractVersion: ONBOARDING_CONTRACT_VERSION, ...draft };
}

/** Extrait un message lisible depuis une réponse d'erreur serveur. */
export function formatOnboardingError(
  body: unknown,
  fallback = "Création impossible.",
): string {
  if (!body || typeof body !== "object") return fallback;
  const b = body as Record<string, unknown>;
  const base = typeof b.error === "string" && b.error.trim() ? b.error.trim() : fallback;
  const fields = b.fields;
  if (fields && typeof fields === "object") {
    const details = Object.entries(fields as Record<string, unknown>)
      .filter(([, v]) => typeof v === "string")
      .map(([k, v]) => `${k} : ${v as string}`);
    if (details.length) return `${base} (${details.join(" ; ")})`;
  }
  if (typeof b.field === "string" && b.field) return `${base} (champ : ${b.field})`;
  return base;
}
