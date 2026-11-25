/**
 * Classification centrale des erreurs Supabase (HTTP, Auth, PostgREST).
 *
 * Objectif GV5 §103 : ne jamais présenter une coupure réseau comme un refus
 * d'autorisation, et ne jamais masquer un vrai refus d'autorisation derrière
 * un message générique. Le garde-fou reste fail-closed : toute erreur
 * empêche l'accès, seule la raison affichée change.
 */

export type FamilleErreur =
  | "session"
  | "autorisation"
  | "reseau"
  | "serveur"
  | "metier"
  | "inconnue";

export type ErreurClassee = {
  famille: FamilleErreur;
  message: string;
  /** Message technique brut, tronqué ; jamais de jeton ni de secret. */
  detail?: string;
};

const AUTEUR_REFUS =
  /acc[èe]s refus|permission denied|not authorized|forbidden|insufficient|row-level security|rls/i;
const RESEAU =
  /failed to fetch|network|fetch|timeout|timed out|econnrefused|connection refused|load failed|socket|offline/i;
const SERVEUR = /internal server|server error|unexpected status 5|error 500|bad gateway|service unavailable/i;
const SESSION = /jwt|token|session.*(expir|invalid)|refresh token/i;

export function classerErreur(err: unknown): ErreurClassee {
  if (err == null) {
    return { famille: "inconnue", message: "Une erreur est survenue. Réessayez." };
  }

  const e = err as Record<string, unknown>;
  const brut = String(e.message ?? (err instanceof Error ? err.message : String(err)) ?? "");
  const texte = brut.toLowerCase();
  const code = String(e.code ?? "").toLowerCase();
  const statut = Number(e.status ?? e.statusCode ?? 0);
  const detail = brut.slice(0, 300) || undefined;

  // Identifiants invalides : erreur métier explicite, pas une session expirée.
  if (/invalid login credentials|identifiant.*incorrect/.test(texte)) {
    return { famille: "metier", message: "Identifiant, e-mail ou mot de passe incorrect.", detail };
  }

  // Le refus d'autorisation est prioritaire sur toute autre interprétation :
  // une erreur P0001 « Accès refusé. » ne doit jamais devenir « réseau ».
  if (statut === 403 || AUTEUR_REFUS.test(texte)) {
    return {
      famille: "autorisation",
      message: "Accès refusé : vous n’avez pas le droit d’effectuer cette opération.",
      detail,
    };
  }

  if (statut === 401 || SESSION.test(texte)) {
    return { famille: "session", message: "Votre session a expiré. Reconnectez-vous.", detail };
  }

  if (statut >= 500 || SERVEUR.test(texte)) {
    return { famille: "serveur", message: "Le serveur est momentanément indisponible. Réessayez.", detail };
  }

  if (RESEAU.test(texte)) {
    return {
      famille: "reseau",
      message: "Connexion réseau indisponible. Vérifiez votre connexion puis réessayez.",
      detail,
    };
  }

  // Erreurs métier PostgreSQL / PostgREST (contraintes, RPC introuvable, etc.).
  if (/^p0|^22|^23|^42|^pgrst/.test(code)) {
    return { famille: "metier", message: "La demande a été refusée par le serveur.", detail };
  }

  return { famille: "inconnue", message: "Une erreur est survenue. Réessayez.", detail };
}

export function messageErreur(err: unknown): string {
  return classerErreur(err).message;
}
