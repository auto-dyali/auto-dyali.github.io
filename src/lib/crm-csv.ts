/**
 * AUTO DYALI — Helpers CSV du CRM Super Admin.
 *
 * Ces fonctions sont volontairement pures (aucune dépendance réseau ni React)
 * afin d'être testables unitairement et d'éviter toute divergence entre
 * l'affichage et l'export.
 */

export type CrmLeadExportRow = {
  company: string | null;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  activity: string | null;
  plan_interest: string | null;
  stage: string | null;
  next_action_at: string | null;
  owner_id: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type CrmOwner = { id: string; full_name: string | null };

/** Formatte une valeur pour le CSV (échappe les guillemets et les sauts de ligne). */
export function formatCSV(value: string | null | undefined): string {
  if (value === null || value === undefined) return "";
  const v = String(value).replace(/"/g, '""').replace(/\r?\n/g, " ");
  return `"${v}"`;
}

/**
 * Exporte en CSV les leads déjà filtrés côté serveur.
 * Aucun filtrage local n'est appliqué : l'appelant doit fournir
 * l'intégralité des résultats filtrés.
 *
 * @returns le contenu CSV, ou `null` si la liste est vide.
 */
export function exporterCSV(
  leads: CrmLeadExportRow[],
  owners: CrmOwner[] = []
): string | null {
  if (leads.length === 0) return null;

  const ownerName = (id: string | null): string => {
    if (!id) return "";
    const o = owners.find((x) => x.id === id);
    return o?.full_name?.trim() || id;
  };

  const headers = [
    "Entreprise",
    "Contact",
    "Email",
    "Téléphone",
    "Ville",
    "Activité",
    "Forfait visé",
    "Étape",
    "Prochaine relance",
    "Propriétaire",
    "Créé le",
    "Mis à jour le",
  ];

  const rows: string[] = [];
  rows.push(headers.map(formatCSV).join(","));

  for (const l of leads) {
    rows.push(
      [
        formatCSV(l.company),
        formatCSV(l.contact_name || ""),
        formatCSV(l.email || ""),
        formatCSV(l.phone || ""),
        formatCSV(l.city || ""),
        formatCSV(l.activity || ""),
        formatCSV(l.plan_interest || ""),
        formatCSV(l.stage || ""),
        formatCSV(
          l.next_action_at
            ? new Date(l.next_action_at).toLocaleDateString("fr-FR")
            : ""
        ),
        formatCSV(ownerName(l.owner_id)),
        formatCSV(
          l.created_at ? new Date(l.created_at).toLocaleString("fr-FR") : ""
        ),
        formatCSV(
          l.updated_at ? new Date(l.updated_at).toLocaleString("fr-FR") : ""
        ),
      ].join(",")
    );
  }

  return rows.join("\n");
}
