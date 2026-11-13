/**
 * AUTO DYALI — Validation du parcours d'onboarding entreprise + Manager.
 *
 * Fonctions pures partagées entre l'interface Super Admin et le futur
 * backend sécurisé (Edge Function / RPC). Aucune dépendance réseau.
 *
 * La création réelle du compte Auth et l'association en base restent
 * côté serveur (service_role jamais exposé au navigateur).
 */

export type OnboardingInput = {
  companyName: string;
  slug: string;
  city?: string;
  phone?: string;
  email?: string;
  plan: string;
  managerName: string;
  managerEmail: string;
  managerPhone?: string;
  trialDays: number;
};

export type OnboardingErrors = Partial<Record<keyof OnboardingInput, string>>;

export const PLANS = ["standard", "silver", "gold"] as const;

/** Génère un identifiant de demande unique (utilisé pour l'idempotence). */
export function buildRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Repli (navigateurs/anciens runtimes) : entropie suffisante pour un UUID v4.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Convertit un nom d'entreprise en slug URL sûr. */
export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Vérifie un email simple (le serveur Auth reste l'autorité finale). */
export function isValidEmail(value: string): boolean {
  const v = value.trim();
  if (!v || v.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

/** Vérifie un slug déjà normalisé. */
export function isValidSlug(value: string): boolean {
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(value);
}

/** Vérifie un UUID (identifiant de demande idempotente). */
export function isValidRequestId(value: string): boolean {
  return UUID_REGEX.test(value.trim());
}

/**
 * Valide les champs de l'onboarding avant tout appel serveur.
 * Retourne un objet d'erreurs vide si tout est valide.
 */
export function validateOnboardingInput(input: OnboardingInput): OnboardingErrors {
  const errors: OnboardingErrors = {};

  const company = input.companyName.trim();
  if (!company) {
    errors.companyName = "Le nom de l'entreprise est obligatoire.";
  } else if (company.length < 2) {
    errors.companyName = "Le nom de l'entreprise doit contenir au moins 2 caractères.";
  }

  const slug = input.slug.trim();
  if (!slug) {
    errors.slug = "Le slug est obligatoire.";
  } else if (!isValidSlug(slug)) {
    errors.slug = "Slug invalide : minuscules, chiffres et tirets uniquement.";
  }

  if (!PLANS.includes(input.plan as (typeof PLANS)[number])) {
    errors.plan = "Forfait invalide (standard, silver ou gold).";
  }

  if (!Number.isFinite(input.trialDays) || input.trialDays < 0 || input.trialDays > 90) {
    errors.trialDays = "Durée d'essai invalide (0 à 90 jours).";
  }

  const managerName = input.managerName.trim();
  if (!managerName) {
    errors.managerName = "Le nom du Manager est obligatoire.";
  } else if (managerName.length < 2) {
    errors.managerName = "Le nom du Manager doit contenir au moins 2 caractères.";
  }

  if (!input.managerEmail.trim()) {
    errors.managerEmail = "L'email du Manager est obligatoire.";
  } else if (!isValidEmail(input.managerEmail)) {
    errors.managerEmail = "Email du Manager invalide.";
  }

  if (input.email && !isValidEmail(input.email)) {
    errors.email = "Email de l'entreprise invalide.";
  }

  return errors;
}

/** Indique si l'onboarding peut être soumis. */
export function isOnboardingValid(input: OnboardingInput): boolean {
  return Object.keys(validateOnboardingInput(input)).length === 0;
}
