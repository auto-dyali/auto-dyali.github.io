/**
 * AUTO DYALI — Pré-achat (demande commerciale) : types, validation et helpers.
 *
 * Fonctions pures, sans dépendance réseau, partageables UI / tests / backend.
 * Ne jamais inventer de tarifs : les montants affichés doivent provenir de la
 * configuration réelle des offres (table `plans`) quand elle est disponible.
 */

export const SECTEURS_AUTOMOBILES = [
  "Garage mécanique générale",
  "Carrosserie & peinture",
  "Pneumatiques & géométrie",
  "Électricité & diagnostic",
  "Pièces & accessoires",
  "Lavage & detailing",
  "Location / flotte",
  "Autre activité automobile",
] as const;

export const PERIODES_ABONNEMENT = ["mensuel", "annuel"] as const;
export type PeriodeAbonnement = (typeof PERIODES_ABONNEMENT)[number];

export const ETATS_PRE_ACHAT = [
  "brouillon",
  "soumis",
  "en_attente_verification",
  "en_attente_paiement",
  "paiement_confirme",
  "valide",
  "compte_cree",
  "invitation_envoyee",
  "compte_active",
  "refuse",
  "annule",
] as const;
export type EtatPreAchat = (typeof ETATS_PRE_ACHAT)[number];

export const ETAT_LABEL: Record<EtatPreAchat, string> = {
  brouillon: "Brouillon",
  soumis: "Pré-achat soumis",
  en_attente_verification: "En attente de vérification",
  en_attente_paiement: "En attente de paiement",
  paiement_confirme: "Paiement confirmé",
  valide: "Validé",
  compte_cree: "Compte créé",
  invitation_envoyee: "Invitation envoyée",
  compte_active: "Compte activé",
  refuse: "Refusé",
  annule: "Annulé",
};

export type PrePurchaseInput = {
  companyName: string;
  legalName: string;
  professionalId?: string;
  sector: string;
  businessType: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  managerName: string;
  plan: string;
  desiredUsers: number;
  desiredSites: number;
  desiredModules: string[];
  period: PeriodeAbonnement | string;
  acceptTerms: boolean;
  acceptPrivacy: boolean;
};

export type PrePurchaseErrors = Partial<Record<keyof PrePurchaseInput | "form", string>>;

export const PLANS_PREACHAT = ["standard", "silver", "gold"] as const;

export function isValidEmail(value: string): boolean {
  const v = value.trim();
  if (!v || v.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export function isValidPhoneMA(value: string): boolean {
  const v = value.replace(/[\s.-]/g, "");
  // Formats courants Maroc: +2126..., 06..., +2125..., 05...
  return /^(\+212|0)(5|6|7)\d{8}$/.test(v);
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function validatePrePurchaseInput(input: PrePurchaseInput): PrePurchaseErrors {
  const errors: PrePurchaseErrors = {};

  if (!input.companyName.trim() || input.companyName.trim().length < 2) {
    errors.companyName = "Le nom commercial est obligatoire (2 caractères min.).";
  }
  if (!input.legalName.trim() || input.legalName.trim().length < 2) {
    errors.legalName = "La raison sociale est obligatoire (2 caractères min.).";
  }
  if (!input.sector.trim()) errors.sector = "Le secteur est obligatoire.";
  if (!input.businessType.trim()) errors.businessType = "Le métier automobile est obligatoire.";
  if (!input.address.trim()) errors.address = "L'adresse est obligatoire.";
  if (!input.city.trim()) errors.city = "La ville est obligatoire.";

  if (!input.phone.trim()) {
    errors.phone = "Le téléphone professionnel est obligatoire.";
  } else if (!isValidPhoneMA(input.phone)) {
    errors.phone = "Numéro de téléphone invalide (format Maroc attendu).";
  }

  if (!input.email.trim()) {
    errors.email = "L'adresse e-mail professionnelle est obligatoire.";
  } else if (!isValidEmail(input.email)) {
    errors.email = "Adresse e-mail invalide.";
  }

  if (!input.managerName.trim() || input.managerName.trim().length < 2) {
    errors.managerName = "Le nom du Manager est obligatoire (2 caractères min.).";
  }

  if (!PLANS_PREACHAT.includes(input.plan as (typeof PLANS_PREACHAT)[number])) {
    errors.plan = "Forfait invalide (standard, silver ou gold).";
  }

  if (!Number.isFinite(input.desiredUsers) || input.desiredUsers < 1 || input.desiredUsers > 500) {
    errors.desiredUsers = "Nombre d'utilisateurs invalide (1 à 500).";
  }
  if (!Number.isFinite(input.desiredSites) || input.desiredSites < 1 || input.desiredSites > 100) {
    errors.desiredSites = "Nombre d'établissements invalide (1 à 100).";
  }

  if (!PERIODES_ABONNEMENT.includes(input.period as PeriodeAbonnement)) {
    errors.period = "Période d'abonnement invalide (mensuel ou annuel).";
  }

  if (!input.acceptTerms) {
    errors.acceptTerms = "Vous devez accepter les conditions commerciales.";
  }
  if (!input.acceptPrivacy) {
    errors.acceptPrivacy = "Vous devez accepter la politique de confidentialité.";
  }

  return errors;
}

export function isPrePurchaseValid(input: PrePurchaseInput): boolean {
  return Object.keys(validatePrePurchaseInput(input)).length === 0;
}

/** Clé de déduplication locale (aide UI) ; l'unicité réelle doit être contrôlée côté serveur. */
export function prePurchaseDedupKey(email: string, companyName: string): string {
  return `${normalizeEmail(email)}::${companyName.trim().toLowerCase()}`;
}

export function buildPrePurchaseRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function formatMontantMAD(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "Non configuré";
  return new Intl.NumberFormat("fr-MA", { style: "currency", currency: "MAD", maximumFractionDigits: 2 }).format(value);
}
