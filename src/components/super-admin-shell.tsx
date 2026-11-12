"use client";

/**
 * Shell du Super Admin AUTO DYALI — Control Center premium.
 *
 * Objectif : encadrer le contenu existant (KPI, entreprises, comptes,
 * plans, audit) avec une navigation latérale organisée et une barre
 * supérieure (recherche globale, notifications, profil Super Admin).
 *
 * Aucune donnée n'est inventée ici : le shell est purement présentationnel.
 * Les entrées de navigation pointent vers des sections réellement présentes
 * ou vers la feuille de route honnête des modules à venir.
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
  icon: IconName;
  /** Lien interne Next (route) plutôt qu'ancre de section. */
  route?: boolean;
  badge?: string;
};

type NavGroup = { titre: string; items: NavItem[] };

const NAV: NavGroup[] = [
  {
    titre: "Pilotage",
    items: [
      { label: "Tableau de bord", href: "#vue-generale", icon: "dashboard" },
      { label: "Entreprises", href: "#entreprises", icon: "building" },
      { label: "Comptes & Managers", href: "#comptes", icon: "users" },
      { label: "Plans & fonctionnalités", href: "#plans", icon: "layers" },
      { label: "Journal d'audit", href: "#audit", icon: "shield" },
      { label: "CRM commercial", href: "/super-admin/crm", icon: "target", route: true },
    ],
  },
  {
    titre: "Feuille de route",
    items: [
      { label: "Abonnements & paiements", href: "#roadmap", icon: "card" },
      { label: "WhatsApp Business", href: "#roadmap", icon: "chat" },
      { label: "Chatbot & automatisations", href: "#roadmap", icon: "spark" },
      { label: "Support & assistance", href: "#roadmap", icon: "life" },
      { label: "Rapports & analyses", href: "#roadmap", icon: "chart" },
      { label: "Paramètres système", href: "#roadmap", icon: "gear" },
    ],
  },
];

type IconName =
  | "dashboard"
  | "building"
  | "users"
  | "layers"
  | "shield"
  | "target"
  | "card"
  | "chat"
  | "spark"
  | "life"
  | "chart"
  | "gear";

const PATHS: Record<IconName, ReactNode> = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </>
  ),
  building: (
    <>
      <path d="M4 21V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v16" />
      <path d="M15 9h3a2 2 0 0 1 2 2v10" />
      <path d="M8 7h3M8 11h3M8 15h3M2 21h20" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
      <path d="M16 5.2a3 3 0 0 1 0 5.6M17 14.5a5.5 5.5 0 0 1 3.5 5.5" />
    </>
  ),
  layers: (
    <>
      <path d="M12 3 3 7.5 12 12l9-4.5L12 3Z" />
      <path d="m3 12 9 4.5 9-4.5M3 16.5 12 21l9-4.5" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6l-7-3Z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="1" />
    </>
  ),
  card: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="M3 10h18M7 15h4" />
    </>
  ),
  chat: (
    <>
      <path d="M4 5h16v11H9l-5 4V5Z" />
      <path d="M8 9h8M8 12h5" />
    </>
  ),
  spark: (
    <>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8" />
    </>
  ),
  life: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="3.5" />
      <path d="m5 5 4 4M15 15l4 4M19 5l-4 4M9 15l-4 4" />
    </>
  ),
  chart: (
    <>
      <path d="M4 20V4M4 20h16" />
      <path d="M8 16v-4M12 16V8M16 16v-6M20 16V6" />
    </>
  ),
  gear: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 7 19.4a1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3 14a1.7 1.7 0 0 0-1.6-1H1a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 3 7a1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 8 3a1.7 1.7 0 0 0 1-1.6V1a2 2 0 1 1 4 0v.1A1.7 1.7 0 0 0 15 3a1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.7 1.7 0 0 0 21 8h.1a2 2 0 1 1 0 4H21a1.7 1.7 0 0 0-1.6 1Z" />
    </>
  ),
};

function NavIcon({ name }: { name: IconName }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="shrink-0"
    >
      {PATHS[name]}
    </svg>
  );
}

export function SuperAdminShell({
  children,
  search,
  onLogout,
  notifications,
  userName = "Super Admin",
  userRole = "Administration centrale",
}: {
  children: ReactNode;
  search?: SuperAdminSearch;
  onLogout: () => void;
  notifications?: number;
  userName?: string;
  userRole?: string;
}) {
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("auto-dyali-superadmin-sidebar") === "collapsed";
  });
  const [drawer, setDrawer] = useState(false);

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("auto-dyali-superadmin-sidebar", next ? "collapsed" : "expanded");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  const initiales = (userName || "AD")
    .split(" ")
    .map((mot) => mot[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const navigation = (
    <nav className="mt-6 flex flex-1 flex-col gap-5 overflow-y-auto pr-1">
      {NAV.map((groupe) => (
        <div key={groupe.titre}>
          <p className="menu-label px-3 text-[10px] uppercase tracking-[0.22em] text-[#8da298]">
            {groupe.titre}
          </p>
          <ul className="mt-2 space-y-1">
            {groupe.items.map((item) => {
              const classe =
                "group flex min-h-10 items-center gap-3 rounded-xl px-3 py-2 text-sm text-[#E8ECE8]/80 transition hover:bg-[#344440] hover:text-[#E8ECE8]";
              const contenu = (
                <>
                  <NavIcon name={item.icon} />
                  <span className="menu-label flex-1 truncate">{item.label}</span>
                  {item.badge && (
                    <span className="menu-label rounded-full bg-[#8FB59B]/20 px-2 py-0.5 text-[10px] text-[#D0C6AE]">
                      {item.badge}
                    </span>
                  )}
                </>
              );
              return (
                <li key={item.label}>
                  {item.route ? (
                    <Link href={item.href} className={classe} onClick={() => setDrawer(false)}>
                      {contenu}
                    </Link>
                  ) : (
                    <a href={item.href} className={classe} onClick={() => setDrawer(false)}>
                      {contenu}
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  const profil = (
    <div className="mt-4 border-t border-[#8FB59B]/15 pt-4">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#344440] text-xs font-bold text-[#D0C6AE]">
          {initiales}
        </span>
        <span className="menu-label min-w-0">
          <span className="block truncate text-xs font-bold text-[#E8ECE8]">{userName}</span>
          <span className="block truncate text-[10px] text-[#A7B7A8]">{userRole}</span>
        </span>
      </div>
      <button
        type="button"
        onClick={onLogout}
        className="menu-label mt-3 w-full rounded-lg border border-[#8FB59B]/30 px-3 py-2 text-left text-xs text-[#A7B7A8] transition hover:border-[#C5716B]/50 hover:text-[#C5716B]"
      >
        Déconnexion
      </button>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-[#1f2626] text-[#E8ECE8]">
      {/* Sidebar desktop */}
      <aside
        className={`carte sticky top-0 hidden h-screen shrink-0 flex-col overflow-y-auto rounded-none border-y-0 border-l-0 p-4 lg:flex app-sidebar ${
          collapsed ? "is-collapsed" : ""
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <Logo compact />
          <button
            type="button"
            onClick={toggle}
            aria-label={collapsed ? "Développer le menu" : "Réduire le menu"}
            title={collapsed ? "Développer le menu" : "Réduire le menu"}
            className="rounded-lg border border-[#8FB59B]/30 px-2 py-1 text-xs text-[#A7B7A8] hover:text-[#E8ECE8]"
          >
            {collapsed ? "›" : "‹"}
          </button>
        </div>
        {navigation}
        {profil}
      </aside>

      {/* Tiroir mobile */}
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-label="Menu Super Admin">
          <div className="absolute inset-0 bg-black/60" onClick={() => setDrawer(false)} />
          <aside className="carte absolute top-0 left-0 flex h-full w-72 flex-col overflow-y-auto rounded-none p-4">
            <div className="flex items-center justify-between">
              <Logo compact />
              <button
                type="button"
                onClick={() => setDrawer(false)}
                aria-label="Fermer le menu"
                className="rounded-lg bg-[#344440] px-2 py-1 text-[#E8ECE8]"
              >
                ✕
              </button>
            </div>
            {navigation}
            {profil}
          </aside>
        </div>
      )}

      {/* Colonne de contenu */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="carte sticky top-0 z-30 flex items-center gap-3 rounded-none border-x-0 border-t-0 px-4 py-3 lg:px-7">
          <button
            type="button"
            className="min-h-11 min-w-11 touch-manipulation rounded-lg bg-[#344440] p-2.5 lg:hidden"
            onClick={() => setDrawer(true)}
            aria-label="Ouvrir le menu"
            aria-expanded={drawer}
          >
            <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden>
              <path d="M3 5h14M3 10h11M3 15h14" stroke="#8FB59B" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>

          <form
            onSubmit={(e) => e.preventDefault()}
            className="hidden min-w-0 flex-1 md:flex md:justify-center"
            role="search"
          >
            <label className="flex min-h-11 w-full max-w-xl items-center gap-3 rounded-full border border-[#8FB59B]/25 bg-[#2C3735] px-4">
              <span aria-hidden className="text-[#8FB59B]">⌕</span>
              <input
                type="search"
                value={search?.value ?? ""}
                onChange={(e) => search?.onChange(e.target.value)}
                placeholder="Rechercher une entreprise, un manager, une ville…"
                aria-label="Recherche globale"
                className="w-full border-0 bg-transparent text-sm text-[#E8ECE8] outline-none placeholder:text-[#8da298]"
              />
            </label>
          </form>

          <div className="ml-auto flex items-center gap-2">
            <a
              href="#audit"
              className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-[#8FB59B]/20 text-[#D0C6AE] hover:bg-[#344440]"
              aria-label={`Notifications (${notifications ?? 0})`}
              title={`${notifications ?? 0} action(s) récente(s)`}
            >
              <NavIcon name="life" />
              {typeof notifications === "number" && notifications > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#C5716B] px-1 text-[10px] font-bold text-white">
                  {notifications > 9 ? "9+" : notifications}
                </span>
              )}
            </a>
            <div className="hidden items-center gap-2 rounded-xl border border-[#8FB59B]/20 px-2.5 py-1.5 sm:flex">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#344440] text-[10px] font-bold text-[#D0C6AE]">
                {initiales}
              </span>
              <span className="leading-tight">
                <span className="block text-xs font-bold text-[#E8ECE8]">{userName}</span>
                <span className="block text-[10px] text-[#A7B7A8]">{userRole}</span>
              </span>
            </div>
          </div>
        </header>

        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
