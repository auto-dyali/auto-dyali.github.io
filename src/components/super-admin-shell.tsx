"use client";

/**
 * AUTO DYALI — Nouveau shell Super Admin (GV5 §38).
 *
 * Navigation indépendante avec 13 rubriques, conformément au cahier des
 * charges §38 complété par le §51 (Invitations, WhatsApp Business, Chatbot IA). Chaque rubrique pointe vers des pages réelles
 * raccordées au backend Supabase (Auth, RLS, RPC, Edge Functions).
 *
 * Rôle autorisé : saas_admin (vérifié par SuperAdminGuard sur chaque page).
 * Aucun bouton décoratif : chaque entrée est un lien fonctionnel.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
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
    description: "Garages abonnés, fiches détaillées, création, activation, suspension.",
  },
  {
    label: "Utilisateurs",
    href: "/super-admin/managers/",
    icon: "users",
    description: "Managers et utilisateurs professionnels, rôles, accès, activation.",
  },
  {
    label: "Abonnements & formules",
    href: "/super-admin/plans/",
    icon: "layers",
    description: "Formules, prix, durées, modules, limites, cycle de vie des abonnements.",
  },
  {
    label: "Souscription de forfait",
    href: "/super-admin/souscription/",
    icon: "sub",
    description: "Création et modification d'abonnements, durée payante, essai et personnalisation des packs.",
  },
  {
    label: "CRM commercial",
    href: "/super-admin/crm/",
    icon: "target",
    description: "Prospects, suivi commercial, opportunités, historique et conversion.",
  },
  {
    label: "Finance & facturation",
    href: "/super-admin/paiements/",
    icon: "card",
    description: "Facturation SaaS, estimations, montants dus et état réel des paiements.",
  },
  {
    label: "Support & assistance",
    href: "/super-admin/support/",
    icon: "life",
    description: "Tickets, priorités, statuts, attribution, échanges et suivi.",
  },
  {
    label: "Intégrations & API",
    href: "/super-admin/integrations/",
    icon: "chat",
    description: "Inventaire des services, état réel, WhatsApp, Chatbot, webhooks et journaux.",
  },
  {
    label: "Communications",
    href: "/super-admin/communications/",
    icon: "whatsapp",
    description: "Modèles d'e-mail et WhatsApp, prévisualisation, suivi des envois.",
  },
  {
    label: "Sécurité & permissions",
    href: "/super-admin/roles/",
    icon: "shield",
    description: "Rôles, permissions, RLS, isolation multi-tenant et opérations sensibles.",
  },
  {
    label: "Journal d'activité",
    href: "/super-admin/audit/",
    icon: "scroll",
    description: "Actions, acteurs, établissements, horodatage, recherche et export.",
  },
  {
    label: "Système & paramètres",
    href: "/super-admin/parametres/",
    icon: "gear",
    description: "Paramètres plateforme, santé, sauvegardes, rapports et configuration.",
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
  | "gear"
  | "whatsapp"
  | "bot"
  | "sub";

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
    whatsapp: (
      <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
        <path d="M21 11.5a8.5 8.5 0 0 1-12.5 7.5L3 21l1.9-5.5A8.5 8.5 0 1 1 21 11.5z" />
        <path d="M8.5 9.5c0 3.6 2.9 6.5 6.5 6.5 0.7 0 1.3-0.6 1.3-1.3 0-0.3-0.1-0.6-0.3-0.8l-1.2-0.6c-0.3-0.1-0.5-0.1-0.7 0l-0.9 0.5a5.4 5.4 0 0 1-2.3-2.3l0.5-0.9c0.1-0.2 0.1-0.4 0-0.7l-0.6-1.2c-0.2-0.2-0.5-0.3-0.8-0.3-0.7 0-1.3 0.6-1.3 1.3z" />
      </svg>
    ),
    bot: (
      <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
        <rect x="4" y="8" width="16" height="12" rx="2" />
        <path d="M12 8V4" />
        <circle cx="12" cy="3" r="1" />
        <circle cx="9" cy="14" r="1" />
        <circle cx="15" cy="14" r="1" />
        <path d="M9 17h6" />
      </svg>
    ),
    sub: (
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path d="M3 3h18v18H3V3z" />
        <path d="M3 9h18" />
        <path d="M9 21V3" />
        <path d="M15 21V3" />
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

function isActive(pathname: string, href: string) {
  const base = href === "/super-admin/" ? "/super-admin" : href.replace(/\/$/, "");
  if (base === "/super-admin") return pathname === "/super-admin" || pathname === "/super-admin/";
  if (pathname === base || pathname === `${base}/`) return true;
  // Sections avec sous-pages dédiées
  if (base === "/super-admin/managers" && (pathname.startsWith("/super-admin/employes") || pathname.startsWith("/super-admin/managers"))) return true;
  if (base === "/super-admin/plans" && (pathname.startsWith("/super-admin/abonnements") || pathname.startsWith("/super-admin/plans"))) return true;
  if (base === "/super-admin/integrations" && (pathname.startsWith("/super-admin/whatsapp") || pathname.startsWith("/super-admin/chatbot") || pathname.startsWith("/super-admin/integrations") || pathname.startsWith("/super-admin/invitations"))) return true;
  if (base === "/super-admin/parametres" && (pathname.startsWith("/super-admin/sauvegarde") || pathname.startsWith("/super-admin/rapports") || pathname.startsWith("/super-admin/parametres"))) return true;
  return pathname.startsWith(`${base}/`);
}

export function SuperAdminShell({
  children,
  onLogout,
  notifications: _notifications,
  search,
}: SuperAdminShellProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname() ?? "";

  return (
    <div className="flex h-screen flex-col bg-[#252D2D] text-[#DFE7E2]">
      {/* Topbar */}
      <header className="flex items-center justify-between px-5 py-4 bg-[#1A211E] border-b border-[#8FB59B]/20 shrink-0">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-controls="menu-super-admin"
            aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
            className="flex cursor-pointer items-center gap-4 rounded-lg px-1 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#8FB59B]"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#344440]">
              <span className="text-[10px] font-extrabold text-[#E8ECE8]">A</span>
            </div>
            <div className="hidden text-left md:block">
              <p className="text-xs font-bold uppercase tracking-wider text-[#D0C6AE]">AUTO DYALI</p>
              <p className="text-[10px] text-[#8FB59B]">Super Admin — SaaS Control Center</p>
            </div>
          </button>
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
          id="menu-super-admin"
          className={`absolute inset-y-0 left-0 z-30 w-64 bg-[#2C3735] border-r border-[#8FB59B]/15 shrink-0 transition-transform duration-300 md:relative md:inset-auto md:z-auto md:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}
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
                const active = isActive(pathname, href);
                return (
                  <Link
                    key={item.label}
                    href={href}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                      active
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

              {/* GV5 §66 — Acces directs identifiables (hors 11 sections canoniques) */}
              <div className="pt-3 mt-3 border-t border-[#8FB59B]/15">
                <p className="px-3 pb-2 text-[10px] uppercase tracking-[0.2em] text-[#6B7B73]">Acces directs</p>
                <Link
                  href="/super-admin/whatsapp/"
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${isActive(pathname, "/super-admin/whatsapp/") ? "bg-[#5D9E7F]/20 text-[#E8ECE8]" : "text-[#A7B7A8] hover:bg-[#344440]/50"}`}
                  aria-label="WhatsApp Business"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded bg-[#5D9E7F]/15 text-[#7FBF9E]">
                    <IconeNav nom="whatsapp" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">WhatsApp Business</p>
                    <p className="text-[10px] text-[#6B7B73] truncate">Configuration, envois, historique</p>
                  </div>
                </Link>
                <Link
                  href="/super-admin/chatbot/"
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${isActive(pathname, "/super-admin/chatbot/") ? "bg-[#9FB7E0]/20 text-[#E8ECE8]" : "text-[#A7B7A8] hover:bg-[#344440]/50"}`}
                  aria-label="Chatbot IA"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded bg-[#9FB7E0]/15 text-[#9FB7E0]">
                    <IconeNav nom="bot" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">Chatbot IA</p>
                    <p className="text-[10px] text-[#6B7B73] truncate">Etat du service, suivi</p>
                  </div>
                </Link>
              </div>
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
