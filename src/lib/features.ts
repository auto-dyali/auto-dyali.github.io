"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase-browser";
import {
  can as permissionAllows,
  normalizePermission,
  type PermissionAction,
  type TenantPermission,
} from "@/lib/permissions";

/**
 * Moteur central de droits AUTO DYALI.
 *
 * Source de vérité = Supabase (plans + plan_features via RPC my_features()).
 * Côté UI : ce hook masque l'accès aux modules non inclus dans le forfait.
 * Côté serveur : la même vérification est refaite par les RPC/RLS
 * (voir migration 0009 : has_feature()). Un changement d'URL ne suffit donc
 * pas à contourner les droits.
 *
 * Politique en cas d'échec (hors ligne, RPC indisponible) : on n'ouvre JAMAIS
 * les fonctions premium à l'aveugle. Seules les fonctions de base restent
 * accessibles pour ne pas casser le fonctionnement hors connexion.
 */

export type FeatureKey =
  | "dashboard"
  | "clients"
  | "vehicles"
  | "catalogue"
  | "stock"
  | "pos"
  | "invoices"
  | "quotes"
  | "suppliers"
  | "reports_basic"
  | "stock_advanced"
  | "purchasing"
  | "employees"
  | "workshop"
  | "appointments"
  | "tires"
  | "barcode"
  | "excel"
  | "reports_finance"
  | "cheques"
  | "alerts"
  | "crm"
  | "ai"
  | "automation"
  | "analytics"
  | "multisite"
  | "whatsapp"
  | "custom_reports"
  | "advanced_permissions"
  | "advanced_suppliers"
  | "support";

export type PlanCode = "standard" | "silver" | "gold";

/** Fonctions ouvertes même sans droits (repli hors ligne / offre d'entrée). */
const BASE_FEATURES: FeatureKey[] = [
  "dashboard",
  "clients",
  "vehicles",
  "catalogue",
  "stock",
  "pos",
  "invoices",
  "quotes",
  "suppliers",
  "reports_basic",
  "support",
];

export type FeaturesState = {
  plan: PlanCode | null;
  /** Vrai si la fonctionnalité est autorisée pour le forfait courant. */
  allows: (feature: FeatureKey) => boolean;
  /** Permissions granulaires réellement attribuées (table `permissions`). */
  permissions: TenantPermission[];
  /** Vrai si les permissions granulaires ont pu être chargées. */
  permissionsLoaded: boolean;
  /**
   * Vrai si le module est ouvert ET que l'action est autorisée.
   * Sans permissions chargées, seule l'ouverture du module est vérifiée.
   */
  can: (module: FeatureKey, action: PermissionAction) => boolean;
  /** true pendant le chargement des droits. */
  loading: boolean;
  /** Message si les droits n'ont pas pu être chargés. */
  error: string | null;
  /** Recharger les droits (après upgrade, changement de forfait). */
  reload: () => void;
};

export function useFeatures(): FeaturesState {
  const [enabled, setEnabled] = useState<Set<string>>(
    new Set<string>(BASE_FEATURES),
  );
  const [plan, setPlan] = useState<PlanCode | null>(null);
  const [permissions, setPermissions] = useState<TenantPermission[]>([]);
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let vivant = true;
    const charger = async () => {
      if (!supabase) {
        // Pas de backend : repli sur les seules fonctions de base.
        setError("Supabase non configuré — droits limités aux fonctions standard.");
        setLoading(false);
        return;
      }
      try {
        const [featuresResult, permissionsResult] = await Promise.all([
          supabase.rpc("my_features"),
          supabase.rpc("my_permissions"),
        ]);
        if (!vivant) return;
        const { data, error: rpcError } = featuresResult;
        if (rpcError) {
          // Ne jamais ouvrir les fonctions premium à l'aveugle.
          setError(rpcError.message);
          setEnabled(new Set<string>(BASE_FEATURES));
          setPlan(null);
        } else if (data) {
          const actives = new Set<string>();
          for (const ligne of data as { feature_key: string; enabled: boolean }[]) {
            if (ligne.enabled) actives.add(ligne.feature_key);
          }
          // Plan déduit des fonctionnalités actives (un seul plan ouvre l'IA).
          setPlan(
            actives.has("ai") || actives.has("multisite") ? "gold"
              : actives.has("workshop") ? "silver"
              : "standard",
          );
          setEnabled(actives.size ? actives : new Set<string>(BASE_FEATURES));
          setError(null);
        }

        // Permissions granulaires : leur absence (migration 0039 non appliquée)
        // ne doit pas ouvrir de droits supplémentaires ni bloquer l'application.
        if (!permissionsResult.error && Array.isArray(permissionsResult.data)) {
          setPermissions(
            (permissionsResult.data as Partial<TenantPermission>[]).map(normalizePermission),
          );
          setPermissionsLoaded(true);
        } else {
          setPermissions([]);
          setPermissionsLoaded(false);
        }
      } catch (e) {
        // Échec réseau : ne jamais rester bloqué sur le chargement des droits.
        setError(e instanceof Error ? e.message : "Chargement des droits impossible.");
      } finally {
        if (vivant) setLoading(false);
      }
    };
    const timer = window.setTimeout(() => void charger(), 0);
    return () => {
      vivant = false;
      window.clearTimeout(timer);
    };
  }, [tick]);

  const allows = useCallback(
    (feature: FeatureKey) => enabled.has(feature),
    [enabled],
  );
  const can = useCallback(
    (module: FeatureKey, action: PermissionAction) => {
      if (!enabled.has(module)) return false;
      if (!permissionsLoaded) return true;
      return permissionAllows(permissions, module, action);
    },
    [enabled, permissions, permissionsLoaded],
  );
  const reload = useCallback(() => {
    setLoading(true);
    setTick((t) => t + 1);
  }, []);

  return { plan, allows, permissions, permissionsLoaded, can, loading, error, reload };
}

export type Role = "saas_admin" | "manager" | "employee" | "client";

export type ProfilState = {
  role: Role | null;
  fullName: string;
  loading: boolean;
  /** Vérifie le rôle attendu ; renvoie false si l'accès est refusé. */
  is: (roles: Role | Role[]) => boolean;
  reload: () => void;
};

/**
 * Rôle courant (profiles.role) — utilisé pour empêcher un client d'accéder
 * au tableau de bord manager et inversement, même en tapant l'URL.
 */
export function useProfil(): ProfilState {
  const [role, setRole] = useState<Role | null>(null);
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let vivant = true;
    const charger = async () => {
      if (!supabase) {
        setLoading(false);
        return;
      }
      try {
        const { data, error } = await supabase.rpc("get_my_profile");
        if (!vivant) return;
        if (!error && data?.[0]) {
          setRole((data[0].role as Role) ?? null);
          setFullName(String(data[0].full_name ?? ""));
        }
      } catch {
        // Échec réseau : sortir du chargement plutôt que bloquer l'écran.
      } finally {
        if (vivant) setLoading(false);
      }
    };
    const timer = window.setTimeout(() => void charger(), 0);
    return () => {
      vivant = false;
      window.clearTimeout(timer);
    };
  }, [tick]);

  const is = useCallback(
    (roles: Role | Role[]) => {
      if (!role) return false;
      return Array.isArray(roles) ? roles.includes(role) : role === roles;
    },
    [role],
  );
  const reload = useCallback(() => setTick((t) => t + 1), []);

  return { role, fullName, loading, is, reload };
}

/** Libellés commerciaux des forfaits (page de garde « module non inclus »). */
export const PLAN_LABEL: Record<PlanCode, string> = {
  standard: "STANDARD",
  silver: "SILVER",
  gold: "GOLD",
};

/** Libellé humain d'une fonctionnalité (messages d'accès refusé). */
export const FEATURE_LABEL: Record<string, string> = {
  stock_advanced: "Stock avancé",
  purchasing: "Achats & commandes fournisseurs",
  employees: "Gestion des employés",
  workshop: "Atelier & interventions",
  appointments: "Rendez-vous",
  tires: "Module pneumatiques",
  barcode: "Scanner code-barres",
  excel: "Import / export Excel",
  reports_finance: "Rapports financiers avancés",
  cheques: "Gestion des chèques & échéances",
  alerts: "Alertes automatiques",
  crm: "CRM avancé",
  ai: "AUTO DYALI AI",
  automation: "Automatisations intelligentes",
  analytics: "Analyses avancées",
  multisite: "Gestion multi-sites",
  whatsapp: "Intégrations WhatsApp",
  custom_reports: "Rapports personnalisables",
  advanced_permissions: "Permissions avancées",
  advanced_suppliers: "Gestion fournisseurs avancée",
  support: "Support & tickets",
};
