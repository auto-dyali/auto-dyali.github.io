/**
 * AUTO DYALI — CRM (logique pure).
 * Le rappel d'entretien (3 mois) part de la DERNIÈRE intervention ou
 * vérification, jamais de la simple création du client.
 */

/** Prochaine échéance (ISO) ou null si aucune intervention/référence. */
export function prochaineEcheance(
  derniereInterventionIso: string | null,
  derniereVerificationIso: string | null,
  _creationClientIso: string | null,
): string | null {
  const ref = derniereVerificationIso ?? derniereInterventionIso;
  if (!ref || Number.isNaN(Date.parse(ref))) return null;
  const d = new Date(ref);
  d.setMonth(d.getMonth() + 3);
  return d.toISOString();
}

/** Mois écoulés depuis la dernière intervention (pour les rappels). */
export function moisDepuisIntervention(derniereInterventionIso: string | null, maintenant = new Date()): number | null {
  if (!derniereInterventionIso || Number.isNaN(Date.parse(derniereInterventionIso))) return null;
  const d = new Date(derniereInterventionIso);
  return (maintenant.getFullYear() - d.getFullYear()) * 12 + (maintenant.getMonth() - d.getMonth());
}
