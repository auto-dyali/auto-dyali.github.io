/**
 * AUTO DYALI — GV5 §76
 * Règles métier PARTAGÉES entre la création (onboarding 6 étapes) et la
 * modification (fiche unifiée). Source unique : ne pas dupliquer ces rules
 * dans les composants.
 *
 * Les règles d'abonnement (durées, calcul des dates) restent canoniques dans
 * `supabase/functions/_shared/contract.ts` ; ce module les ré-exporte pour
 * éviter deux implémentations divergentes.
 */

import { computeSubscriptionDates } from "./onboarding-contract";

export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
export const PHONE_RE = /^[+\d\s().-]{6,20}$/;
export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type IdentiteEtablissement = {
  name: string;
  legalName?: string;
  slug: string;
  professionalId?: string;
  activityType?: string;
  email: string;
  phone?: string;
};

export type CoordonneesEtablissement = {
  address?: string;
  city?: string;
  region?: string;
  country?: string;
};

/** Validation d'identité utilisée par la création ET la modification. */
export function validerIdentite(f: IdentiteEtablissement): Record<string, string> {
  const e: Record<string, string> = {};
  if (!f.name.trim()) e.name = "Le nom commercial est obligatoire.";
  if (!f.slug.trim()) e.slug = "Le slug est obligatoire.";
  else if (!SLUG_RE.test(f.slug.trim()))
    e.slug = "Lettres minuscules, chiffres et tirets uniquement.";
  if (f.email.trim() && !EMAIL_RE.test(f.email.trim()))
    e.email = "Format d'e-mail invalide.";
  if (f.phone?.trim() && !PHONE_RE.test(f.phone.trim()))
    e.phone = "Numéro de téléphone invalide.";
  return e;
}

/** Validation des coordonnées (adresse et ville obligatoires à la création). */
export function validerCoordonnees(
  f: CoordonneesEtablissement,
  obligatoire: boolean,
): Record<string, string> {
  const e: Record<string, string> = {};
  if (obligatoire && !f.address?.trim()) e.address = "L'adresse est obligatoire.";
  if (obligatoire && !f.city?.trim()) e.city = "La ville est obligatoire.";
  return e;
}

/** Durées proposées — une seule source pour les deux parcours. */
export const DUREES_PAYANTES = [
  { valeur: 1, libelle: "1 mois" },
  { valeur: 3, libelle: "3 mois" },
  { valeur: 6, libelle: "6 mois" },
  { valeur: 12, libelle: "1 an" },
  { valeur: 24, libelle: "2 ans" },
] as const;

export const DUREES_ESSAI = [0, 7, 15, 30, 45, 60] as const;

/**
 * Calcul des échéances : délègue au contrat canonique v2.
 * L'essai est indépendant et ne réduit jamais la durée payante.
 */
export function calculerEcheances(startDate: string, paidMonths: number, trialDays: number) {
  return computeSubscriptionDates(startDate, Math.max(1, paidMonths), Math.max(0, trialDays));
}

/** Champs administratifs dédiés (colonnes ajoutées en §75). */
export const CHAMPS_ADMIN = [
  "country",
  "legalInfo",
  "fiscalInfo",
  "adminInfo",
  "dossierState",
  "complementaryContacts",
] as const;

type NotesAdmin = {
  country?: string;
  legalInfo?: string;
  fiscalInfo?: string;
  adminInfo?: string;
  dossierState?: string;
  complementaryContacts?: string;
  notes?: string;
};

const PREFIXES: Record<string, string> = {
  country: "Pays :",
  legalInfo: "Informations juridiques :",
  fiscalInfo: "Informations fiscales :",
  adminInfo: "Infos administratives :",
  dossierState: "État dossier :",
  complementaryContacts: "Coordonnées complémentaires :",
  notes: "Notes :",
};

/** Relecture des fiches historiques où ces valeurs étaient dans `notes`. */
export function lireChampsAdminDepuisNotes(notes: string): NotesAdmin {
  const resultat: NotesAdmin = {};
  const lignes = (notes ?? "").split("\n");
  for (const [cle, prefixe] of Object.entries(PREFIXES)) {
    const ligne = lignes.find((l) => l.toLowerCase().startsWith(prefixe.toLowerCase()));
    if (ligne) (resultat as Record<string, string>)[cle] = ligne.slice(prefixe.length).trim();
  }
  return resultat;
}

/** Composition conservée pour compatibilité avec le contrat v2 historique. */
export function composerNotesAdmin(champs: NotesAdmin): string {
  return (Object.entries(PREFIXES) as [keyof NotesAdmin, string][])
    .map(([cle, prefixe]) => (champs[cle] ? `${prefixe} ${champs[cle]}` : ""))
    .filter(Boolean)
    .join("\n");
}
