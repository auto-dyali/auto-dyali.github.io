/**
 * AUTO DYALI — Permissions granulaires (pures, testables).
 *
 * Deux notions distinctes :
 *   - `modules`     : modules du forfait réellement ouverts à l'établissement ;
 *   - `permissions` : actions autorisées par module pour un rôle donné.
 *
 * `my_features()` applique l'intersection forfait ∩ permissions (migration
 * 0039). Ces helpers servent uniquement à l'interface : la décision finale
 * reste serveur (RLS + RPC).
 */

export type PermissionAction = "view" | "create" | "edit" | "delete";

export type TenantPermission = {
  module: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
};

export const PERMISSION_ACTION_LABEL: Record<PermissionAction, string> = {
  view: "Voir",
  create: "Créer",
  edit: "Modifier",
  delete: "Supprimer",
};

export function normalizePermission(row: Partial<TenantPermission>): TenantPermission {
  return {
    module: String(row.module ?? ""),
    can_view: row.can_view === true,
    can_create: row.can_create === true,
    can_edit: row.can_edit === true,
    can_delete: row.can_delete === true,
  };
}

export function findPermission(
  rows: readonly TenantPermission[],
  module: string,
): TenantPermission | null {
  return rows.find((r) => r.module === module) ?? null;
}

export function can(
  rows: readonly TenantPermission[],
  module: string,
  action: PermissionAction,
): boolean {
  const row = findPermission(rows, module);
  if (!row) return false;
  switch (action) {
    case "view":
      return row.can_view;
    case "create":
      return row.can_create;
    case "edit":
      return row.can_edit;
    case "delete":
      return row.can_delete;
    default:
      return false;
  }
}

/**
 * Intersection forfait ∩ permissions, exactement comme `my_features()`.
 * Sans aucune ligne de permission, le forfait s'applique seul (compatibilité).
 */
export function intersectFeaturesWithPermissions(
  features: readonly { feature_key: string; enabled: boolean }[],
  permissions: readonly TenantPermission[],
): Set<string> {
  const hasPermissions = permissions.length > 0;
  const allowedViews = new Set(
    permissions.filter((p) => p.can_view).map((p) => p.module),
  );
  const result = new Set<string>();
  for (const f of features) {
    if (!f.enabled) continue;
    if (!hasPermissions || allowedViews.has(f.feature_key)) {
      result.add(f.feature_key);
    }
  }
  return result;
}
