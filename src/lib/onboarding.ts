/**
 * AUTO DYALI — Helpers historiques du parcours d'onboarding.
 *
 * ⚠️ LEGACY : la validation de référence est désormais
 * `supabase/functions/_shared/contract.ts` (contrat v2), ré-exportée par
 * `@/lib/onboarding-contract`. Ce module ne sert plus qu'à quelques
 * utilitaires (`slugify`, `buildRequestId`, `genererIdentifiantProfessionnel`)
 * et à l'ancienne suite de tests. Ne pas l'utiliser pour valider un payload
 * destiné à l'Edge Function : les deux validations divergeraient.
 */

export type OnboardingInput = {
  companyName: string;
  legalName?: string;
  slug: string;
  activityType?: string;
  professionalId?: string;
  address?: string;
  city?: string;
  region?: string;
  phone?: string;
  email?: string;
  notes?: string;
  plan: string;
  // Durée d'abonnement : "1mois", "3mois", "6mois", "1an", "2ans", "personnalisee"
  abonnementDuree: string;
  abonnementDureePersonnalisee: number;
  // Durée d'essai : "aucun", "7", "15", "30", "45", "60", "personnalisee"
  essaiDuree: string;
  essaiDureePersonnalisee: number;
  // Dates calculées automatiquement
  dateDebut?: string;
  dateFin?: string;
  modules?: string[];
  managerName: string;
  managerEmail: string;
  managerPhone?: string;
  sendWhatsApp?: boolean;
  // Identifiant de connexion du Manager (choisi manuellement par le SA)
  managerLoginId?: string;
  // Mot de passe initial temporaire choisi par le Super Admin
  managerPassword?: string;
  managerPasswordConfirm?: string;
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

/** Génère un identifiant professionnel AUTO DYALI PRO unique (format ADY-PRO-XXXXXX). */
export function genererIdentifiantProfessionnel(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    const uuid = crypto.randomUUID();
    const hex = uuid.replace(/-/g, "").substring(0, 6).toUpperCase();
    return `ADY-PRO-${hex}`;
  }
  // Repli (navigateurs/anciens runtimes) : entropie aléatoire
  const hex = Array.from({ length: 6 }, () => Math.floor(Math.random() * 16).toString(16)).join("").toUpperCase();
  return `ADY-PRO-${hex}`;
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

  const legal = input.legalName?.trim();
  if (!legal) {
    errors.legalName = "La raison sociale est obligatoire.";
  }

  const activity = input.activityType?.trim();
  if (!activity) {
    errors.activityType = "Le type d'activité est obligatoire.";
  }

  const profId = input.professionalId?.trim();
  if (!profId) {
    errors.professionalId = "L'identifiant professionnel est obligatoire.";
  }

  const address = input.address?.trim();
  if (!address) {
    errors.address = "L'adresse est obligatoire.";
  }

  const region = input.region?.trim();
  if (!region) {
    errors.region = "La région est obligatoire.";
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

  // Validation de la durée d'abonnement
  const dureesAbonnementValides = ["1mois", "3mois", "6mois", "1an", "2ans", "personnalisee"];
  if (!dureesAbonnementValides.includes(input.abonnementDuree)) {
    errors.abonnementDuree = "Durée d'abonnement invalide.";
  } else if (input.abonnementDuree === "personnalisee") {
    if (!input.abonnementDureePersonnalisee || input.abonnementDureePersonnalisee < 1 || input.abonnementDureePersonnalisee > 120) {
      errors.abonnementDureePersonnalisee = "Durée personnalisée invalide (1 à 120 mois).";
    }
  }

  // Validation de la durée d'essai
  const dureesEssaiValides = ["aucun", "7", "15", "30", "45", "60", "personnalisee"];
  if (!dureesEssaiValides.includes(input.essaiDuree)) {
    errors.essaiDuree = "Durée d'essai invalide.";
  } else if (input.essaiDuree === "personnalisee") {
    if (!input.essaiDureePersonnalisee || input.essaiDureePersonnalisee < 1 || input.essaiDureePersonnalisee > 365) {
      errors.essaiDureePersonnalisee = "Durée d'essai personnalisée invalide (1 à 365 jours).";
    }
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

  // Validation de l'identifiant de connexion du Manager
  const managerLoginId = input.managerLoginId?.trim();
  if (!managerLoginId) {
    errors.managerLoginId = "L'identifiant de connexion du Manager est obligatoire.";
  } else if (managerLoginId.length < 3) {
    errors.managerLoginId = "L'identifiant de connexion doit contenir au moins 3 caractères.";
  } else if (!/^[a-z0-9]([a-z0-9._-]*[a-z0-9])?$/.test(managerLoginId)) {
    errors.managerLoginId = "Identifiant invalide : minuscules, chiffres, tirets et points uniquement (pas en début ou fin).";
  }

  // Validation du mot de passe initial temporaire
  const managerPassword = input.managerPassword?.trim();
  if (!managerPassword) {
    errors.managerPassword = "Le mot de passe initial est obligatoire.";
  } else if (managerPassword.length < 8) {
    errors.managerPassword = "Le mot de passe doit contenir au moins 8 caractères.";
  }

  // Validation de la confirmation du mot de passe
  if (!input.managerPasswordConfirm?.trim()) {
    errors.managerPasswordConfirm = "La confirmation du mot de passe est obligatoire.";
  } else if (input.managerPasswordConfirm.trim() !== managerPassword) {
    errors.managerPasswordConfirm = "Les mots de passe ne correspondent pas.";
  }

  return errors;
}

/** Indique si l'onboarding peut être soumis. */
export function isOnboardingValid(input: OnboardingInput): boolean {
  return Object.keys(validateOnboardingInput(input)).length === 0;
}
