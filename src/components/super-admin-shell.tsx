"use client";

/**
 * AUTO DYALI — Nouveau shell Super Admin (GV5 §38).
 *
 * Navigation indépendante avec exactement 11 rubriques, conformément au
 * cahier des charges §38. Chaque rubrique pointe vers des pages réelles
 * raccordées au backend Supabase (Auth, RLS, RPC, Edge Functions).
 *
 * Rôle autorisé : saas_admin (vérifié par SuperAdminGuard sur chaque page).
 * Aucun bouton décoratif : chaque entrée est un lien fonctionnel.
 */

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Logo } from "@/components/logo";

export type SuperAdminSearch = {
  value: string;
  onChange: (value: string) => void;
};

type NavItem = {
  label: string;
  href: string;
  icon: string;
  badge?: string;
  description?: string;
};

const NAV_ITEMS: NavItem[] = [
  {
    label: "Vue générale",
    href: "/super-admin/",
    icon: "dashboard",
    description: "Tableau de bord global du SaaS : abonnés, abonnements, alertes, santé.",
  },
  {
    label: "Abonnés professionnels",
    href: "/super-admin/entreprises/",
    icon: "building",
    description: "Liste des garages et entreprises abonnés, fiches détaillées, création, activation, suspension.",
  },
  {
    label: "Utilisateurs",
    href: "/super-admin/managers/",
    icon: "users",
    description: "Gestion des comptes Manager et Employé, statuts, permissions, accès.",
  },
  {
    label: "Abonnements & Formules",
    href: "/super-admin/plans/",
    icon: "layers",
    description: "Formules, tarifs, durées, modules inclus, limites, attribution, historique.",
  },
  {
    label: "CRM commercial",
    href: "/super-admin/crm/",
    icon: "target",
    description: "Prospects professionnels, suivi commercial, conversion en abonné.",
  },
  {
    label: "Finance & Facturation",
    href: "/super-admin/paiements/",
    icon: "card",
    description: "Factures, paiements, abonnements facturés, impayés, échéances, exports.",
  },
  {
    label: "Support & Assistance",
    href: "/super-admin/support/",
    icon: "life",
    description: "Tickets, demandes d'assistance, priorités, statuts, suivi de résolution.",
  },
  {
    label: "Intégrations & API",
    href: "/super-admin/whatsapp/",
    icon: "chat",
    description: "État des intégrations, webhooks, services connectés, journaux techniques.",
  },
  {
    label: "Sécurité & Permissions",
    href: "/super-admin/roles/",
    icon: "shield",
    description: "Rôles, permissions, contrôle des accès, politiques RLS, séparation multi-tenant.",
  },
  {
    label: "Journal d'activité",
    href: "/super-admin/audit/",
    icon: "scroll",
    description: "Actions administratives, créations, modifications, activations, suspensions, échecs.",
  },
  {
    label: "Système & Paramètres",
    href: "/super-admin/parametres/",
    icon: "gear",
    description: "Paramètres généraux, notifications, santé technique, sauvegardes, restauration.",
  },
];

type IconName =
  | "dashboard"
  | "building"
  | "users"
  | "layers"
  | "target"
  | "card"
  | "life"
  | "chat"
  | "shield"
  | "scroll"
  | "gear";

function IconeNav({ nom, taille = 20 }: { nom: IconName; taille?: number }) {
  // Icônes inline SVG légères, sans dépendance externe.
  const svg: Record<string, React.ReactNode> = {
    dashboard: (
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
      >
        <rect width="7" height="7" x="3" y="3" rx="1" />
        <rect width="7" height="7" x="14" y="3" rx="1" />
        <rect width="7" height="7" x="14" y="14" rx="1" />
        <rect width="7" height="7" x="3" y="14" rx="1" />
      </svg>
    ),
    building: (
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5l2 2h5a2 2 0 0 1 2 2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
    users: (
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    layers: (
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
      >
        <polyline points="12 2 2 7 12 12 22 7 12 2" />
        <polyline points="2 17 12 22 22 17" />
        <polyline points="2 12 12 17 22 12" />
      </svg>
    ),
    target: (
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
      >
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="6" />
        <circle cx="12" cy="12" r="2" />
      </svg>
    ),
    card: (
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
      >
        <rect x="2" y="2" width="20" height="20" rx="2" ry="2" />
        <line x1="2" y1="9" x2="22" y2="9" />
        <line x1="2" y1="15" x2="22" y2="15" />
      </svg>
    ),
    life: (
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path d="M20 13V5a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2z" />
        <polyline points="18 12 18 7 23 7" />
        <polyline points="6 12 6 7 1 7" />
      </svg>
    ),
    chat: (
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8.4z" />
        <line x1="22" y1="12" x2="22" y2="12" />
      </svg>
    ),
    shield: (
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
    scroll: (
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path d="M14 3H6a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3V6a3 3 0 0 0-3-3z" />
        <path d="M10 14L6 18" />
        <path d="M18 10l4 4" />
      </svg>
    ),
    gear: (
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
      >
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  };

  return <span className="flex items-center">{svg[nom]}</span>;
}

export type SuperAdminShellProps = {
  children: ReactNode;
  onLogout: () => void;
  notifications?: number;
  search?: SuperAdminSearch;
};

export function SuperAdminShell({
  children,
  onLogout,
  notifications,
  search,
}: SuperAdminShellProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex h-screen flex-col bg-[#252D2D] text-[#DFE7E2]">
      {/* Topbar */}
      <header className="flex items-center justify-between px-5 py-4 bg-[#1A211E] border-b border-[#8FB59B]/20 shrink-0">
        <div className="flex items-center gap-4 cursor-pointer" onClick={() => setOpen(!open)}>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#344440]">
            <span className="text-[10px] font-extrabold text-[#E8ECE8]">A</span>
          </div>
          <div className="hidden md:block">
            <p className="text-xs font-bold uppercase tracking-wider text-[#D0C6AE]">AUTO DYALI</p>
            <p className="text-[10px] text-[#8FB59B]">Super Admin — SaaS Control Center</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {search && (
            <div className="relative hidden md:block w-64">
              <input
                type="search"
                value={search.value}
                onChange={(e) => search.onChange(e.target.value)}
                placeholder="Rechercher entreprises, managers, abonnés…"
                className="champ mt-1 min-h-10 w-full rounded-full pl-10 pr-4 text-xs"
              />
              <svg
                aria-hidden
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
              >
                <circle cx="10" cy="10" r="6" />
                <path d="M20 20l-5-5" />
              </svg>
            </div>
          )}
          <span className="hidden sm:block border-l border-[#8FB59B]/30 h-5 px-3" />
          <button
            type="button"
            onClick={() => void onLogout()}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-[#C5716B] hover:bg-[#344440] transition"
            aria-label="Déconnexion"
          >
            <span className="text-[14px]">🚪</span>
            <span className="hidden sm:inline">Déconnexion</span>
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside
          className={`w-64 bg-[#2C3735] border-r border-[#8FB59B]/15 shrink-0 transition-transform duration-300 ${open ? "translate-x-0" : "-translate-x-full"} md:translate-x-0 md:static`}
          aria-label="Navigation Super Admin"
        >
          <div className="flex h-full flex-col">
            <div className="p-4 border-b border-[#8FB59B]/10">
              <Logo compact className="mx-auto h-8 w-auto" />
              <p className="mt-2 text-[10px] text-[#8FB59B] text-center">
                Rôle : saas_admin
              </p>
            </div>

            <nav className="flex-1 overflow-y-auto p-3 space-y-1">
              {NAV_ITEMS.map((item) => {
                const href = item.href;
                return (
                  <Link
                    key={item.label}
                    href={href}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                      typeof window !== "undefined" &&
                      window.location.pathname.startsWith(href === "/" ? "/" : href)
                        ? "bg-[#8FB59B]/20 text-[#E8ECE8]"
                        : "text-[#A7B7A8] hover:bg-[#344440]/50"
                    }`}
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded bg-[#344440]">
                      <IconeNav nom={item.icon as IconName} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{item.label}</p>
                      <p className="text-[10px] text-[#6B7B73] truncate">{item.description}</p>
                    </div>
                    {item.badge && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#D6A34D]/20 text-[#D6A34D]">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>

            <div className="p-4 border-t border-[#8FB59B]/10">
              <button
                type="button"
                onClick={() => void onLogout()}
                className="w-full flex items-center gap-2 rounded-lg border border-[#C5716B]/40 px-3 py-2 text-sm text-[#C5716B] hover:bg-[#C5716B]/20 transition"
              >
                <span className="text-[14px]">🚪</span>
                Déconnexion
              </button>
            </div>
          </div>
        </aside>

        {/* Overlay mobile */}
        {open && (
          <div
            className="fixed inset-0 z-20 bg-black/50 md:hidden"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Contenu principal */}
        <main className="flex-1 overflow-y-auto bg-[#252D2D]">
          <div className="mx-auto max-w-7xl p-5 lg:p-10">{children}</div>
        </main>
      </div>
    </div>
  );
}
