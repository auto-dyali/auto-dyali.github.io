/**
 * AUTO DYALI — Atelier (mapping de statuts, logique pure).
 * Les valeurs SQL existantes sont conservées (aucune migration destructive) ;
 * ce module rapproche les statuts base du modèle métier sans les renommer.
 */

export type StatutMetierAtelier =
  | "received"
  | "diagnosis"
  | "awaiting_approval"
  | "approved"
  | "in_progress"
  | "waiting_parts"
  | "quality_control"
  | "completed"
  | "invoiced"
  | "cancelled";

/** Statut SQL (or_status) → statut métier. */
export function statutMetierAtelier(statutSql: string): StatutMetierAtelier {
  switch (statutSql) {
    case "pending": return "received";
    case "in_progress": return "in_progress";
    case "waiting_parts": return "waiting_parts";
    case "done":
    case "delivered": return "completed";
    case "cancelled": return "cancelled";
    default: return "received";
  }
}

/** Statuts actifs (intervention en cours, en attente de pièces, à faire). */
export function statutsActifs(): string[] {
  return ["pending", "in_progress", "waiting_parts"];
}
