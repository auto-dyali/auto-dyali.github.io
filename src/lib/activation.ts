/**
 * AUTO DYALI — Machine à états pure du parcours d'activation.
 *
 * Volontairement sans dépendance React/Supabase : testable en Node.
 * Le jeton n'est JAMAIS consommé à l'ouverture de la page : seul un appel
 * explicite `activate` le consomme (voir Edge Function `activate-manager`).
 */

export type ActivationView =
  | "verification"
  | "pret"
  | "succes"
  | "invalide"
  | "expiree"
  | "deja_utilisee"
  | "erreur";

export const ACTIVATION_MIN_PASSWORD_LENGTH = 10;

/** Extrait le jeton d'une chaîne de requête (`?token=...`). */
export function parseActivationToken(search: string): string {
  if (!search) return "";
  const cleaned = search.startsWith("?") ? search.slice(1) : search;
  try {
    return new URLSearchParams(cleaned).get("token")?.trim() ?? "";
  } catch {
    return "";
  }
}

/** Le jeton brut est un hexadécimal de 64 caractères (32 octets). */
export function isValidTokenFormat(token: string): boolean {
  return /^[a-f0-9]{64}$/i.test(token.trim());
}

/**
 * Valide la paire mot de passe / confirmation avant appel serveur.
 * Retourne `null` si tout est correct, sinon un message explicite.
 */
export function validatePasswordPair(
  password: string,
  confirmation: string,
): string | null {
  if (password.length < ACTIVATION_MIN_PASSWORD_LENGTH) {
    return `Le mot de passe doit contenir au moins ${ACTIVATION_MIN_PASSWORD_LENGTH} caractères.`;
  }
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return "Le mot de passe doit contenir au moins une lettre et un chiffre.";
  }
  if (password !== confirmation) {
    return "Les mots de passe ne correspondent pas.";
  }
  return null;
}

/** Traduit un message serveur en état d'interface (sans divulguer de détail). */
export function classifyActivationError(message: string): ActivationView {
  const m = (message || "").toLowerCase();
  if (/\bexpir/.test(m)) return "expiree";
  if (/deja|déjà|utilis/.test(m)) return "deja_utilisee";
  if (/invalide|inconnu|introuvable|correspond/.test(m)) return "invalide";
  return "erreur";
}

/** URL d'activation canonique (le chemin DOIT être `/activer/`). */
export function buildActivationUrl(baseUrl: string, token: string): string {
  const base = baseUrl.replace(/\/+$/, "");
  return `${base}/activer/?token=${encodeURIComponent(token)}`;
}

/** Libellés honnêtes des statuts de transmission (aucun « délivré » inventé). */
export const DELIVERY_STATUS_LABEL: Record<string, string> = {
  non_demande: "Non demandé",
  en_attente: "En attente",
  accepte_par_fournisseur: "Accepté par le fournisseur",
  echec: "Échec",
  non_configure: "Fournisseur non configuré",
};
