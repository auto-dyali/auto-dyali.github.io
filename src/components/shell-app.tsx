"use client";

import { useState, useEffect, type ReactNode, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/logo";
import { Icone, type NomIcone } from "@/components/icones";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase-browser";
import {
  useFeatures,
  useProfil,
  FEATURE_LABEL,
  PLAN_LABEL,
  type FeatureKey,
} from "@/lib/features";

/**
 * Shell de l'application connectée — navigation latérale fidèle à la
 * maquette (14 entrées) + en-tête avec salutation et avatar.
 * Responsive : sidebar rétractable en tiroir sur tablette / smartphone.
 *
 * Sécurité : vérifie la session ET le rôle (manager / saas_admin), et
 * filtre la navigation selon le forfait (moteur de droits, migration 0009).
 */

const modules: { label: string; icone: NomIcone; href: string; feature: FeatureKey }[] = [
  { label: "Tableau de bord", icone: "pos", href: "/tableau-de-bord", feature: "dashboard" },
  { label: "Mini-POS", icone: "pos", href: "/tableau-de-bord#mini-pos", feature: "dashboard" },
  { label: "Atelier & Interventions", icone: "cle", href: "/tableau-de-bord/atelier", feature: "workshop" },
  { label: "Clients & Véhicules", icone: "client", href: "/tableau-de-bord/clients", feature: "clients" },
  { label: "Point de vente", icone: "pos", href: "/tableau-de-bord/point-de-vente", feature: "pos" },
  { label: "Véhicules", icone: "voiture", href: "/tableau-de-bord/vehicules", feature: "vehicles" },
  { label: "Historique des ventes", icone: "historique", href: "/tableau-de-bord/historique-ventes", feature: "pos" },
  { label: "Scan Pro", icone: "scanner", href: "/tableau-de-bord/scan-pro", feature: "pos" },
  { label: "Print Pro", icone: "imprimante", href: "/tableau-de-bord/print-pro", feature: "pos" },
  { label: "Catalogue", icone: "carton", href: "/tableau-de-bord/catalogue", feature: "catalogue" },
  { label: "Stock", icone: "carton", href: "/tableau-de-bord/stock", feature: "stock" },
  { label: "Pneumatiques", icone: "resistance", href: "/tableau-de-bord/pneumatiques", feature: "tires" },
  { label: "Achats", icone: "carton", href: "/tableau-de-bord/achats", feature: "purchasing" },
  { label: "Fournisseurs", icone: "client", href: "/tableau-de-bord/fournisseurs", feature: "suppliers" },
  { label: "Caisse & Trésorerie", icone: "ca", href: "/tableau-de-bord/caisse", feature: "dashboard" },
  { label: "Chèques", icone: "ca", href: "/tableau-de-bord/cheques", feature: "cheques" },
  { label: "Créances", icone: "benefice", href: "/tableau-de-bord/creances", feature: "reports_finance" },
  { label: "Devis", icone: "rapport", href: "/tableau-de-bord/devis", feature: "quotes" },
  { label: "Facturation", icone: "rapport", href: "/tableau-de-bord/facturation", feature: "invoices" },
  { label: "Employés & RH", icone: "profil", href: "/tableau-de-bord/employes", feature: "employees" },
  { label: "Planning & Rendez-vous", icone: "planning", href: "/tableau-de-bord/planning", feature: "appointments" },
  { label: "Rapports & Analyses", icone: "rapport", href: "/tableau-de-bord/rapports", feature: "reports_basic" },
  { label: "Communication IA", icone: "plus", href: "/tableau-de-bord/assistant", feature: "ai" },
  { label: "Permissions", icone: "cle", href: "/tableau-de-bord/permissions", feature: "advanced_permissions" },
  { label: "Import / Export", icone: "scanner", href: "/tableau-de-bord/import-export", feature: "excel" },
  { label: "Support", icone: "cloche", href: "/tableau-de-bord/support", feature: "support" },
  { label: "Notifications", icone: "cloche", href: "/tableau-de-bord/notifications", feature: "alerts" },
  { label: "Paramètres", icone: "plus", href: "/tableau-de-bord/parametres", feature: "dashboard" },
];

const modulesMaquetteDashboard: { label: string; icone: NomIcone; href: string; feature: FeatureKey }[] = [
  { label: "Dashboard", icone: "pos", href: "/tableau-de-bord", feature: "dashboard" },
  { label: "Point de Vente", icone: "pos", href: "/tableau-de-bord/point-de-vente", feature: "pos" },
  { label: "Atelier & Interventions", icone: "cle", href: "/tableau-de-bord/atelier", feature: "workshop" },
  { label: "Clients & Véhicules", icone: "client", href: "/tableau-de-bord/clients", feature: "clients" },
  { label: "Catalogue", icone: "carton", href: "/tableau-de-bord/catalogue", feature: "catalogue" },
  { label: "Stock", icone: "carton", href: "/tableau-de-bord/stock", feature: "stock" },
  { label: "Achats", icone: "carton", href: "/tableau-de-bord/achats", feature: "purchasing" },
  { label: "Fournisseurs", icone: "client", href: "/tableau-de-bord/fournisseurs", feature: "suppliers" },
  { label: "Caisse & Trésorerie", icone: "ca", href: "/tableau-de-bord/caisse", feature: "dashboard" },
  { label: "Comptabilité", icone: "rapport", href: "/tableau-de-bord/facturation", feature: "invoices" },
  { label: "Employés & RH", icone: "profil", href: "/tableau-de-bord/employes", feature: "employees" },
  { label: "Planning & Rendez-vous", icone: "planning", href: "/tableau-de-bord/planning", feature: "appointments" },
  { label: "Rapports & Analyses", icone: "rapport", href: "/tableau-de-bord/rapports", feature: "reports_basic" },
  { label: "Communication IA", icone: "plus", href: "/tableau-de-bord/assistant", feature: "ai" },
  { label: "Paramètres", icone: "plus", href: "/tableau-de-bord/parametres", feature: "dashboard" },
];

const modulesMaquettePos: { label: string; icone: NomIcone; href: string; feature: FeatureKey }[] = [
  { label: "Dashboard", icone: "pos", href: "/tableau-de-bord", feature: "dashboard" },
  { label: "Point de Vente", icone: "pos", href: "/tableau-de-bord/point-de-vente", feature: "pos" },
  { label: "Atelier & Interventions", icone: "cle", href: "/tableau-de-bord/atelier", feature: "workshop" },
  { label: "Clients & Véhicules", icone: "client", href: "/tableau-de-bord/clients", feature: "clients" },
  { label: "Catalogue", icone: "carton", href: "/tableau-de-bord/catalogue", feature: "catalogue" },
  { label: "Stock", icone: "carton", href: "/tableau-de-bord/stock", feature: "stock" },
  { label: "Achats", icone: "carton", href: "/tableau-de-bord/achats", feature: "purchasing" },
  { label: "Fournisseurs", icone: "client", href: "/tableau-de-bord/fournisseurs", feature: "suppliers" },
  { label: "Caisse & Trésorerie", icone: "ca", href: "/tableau-de-bord/caisse", feature: "dashboard" },
  { label: "Comptabilité", icone: "rapport", href: "/tableau-de-bord/facturation", feature: "invoices" },
  { label: "Rapports", icone: "rapport", href: "/tableau-de-bord/rapports", feature: "reports_basic" },
  { label: "RH & Employés", icone: "profil", href: "/tableau-de-bord/employes", feature: "employees" },
  { label: "Paramètres", icone: "plus", href: "/tableau-de-bord/parametres", feature: "dashboard" },
];

/** Écran affiché quand le forfait n'inclut pas la fonctionnalité demandée. */
function ModuleVerrouille({ feature, plan, onUpgrade }: { feature: FeatureKey; plan: string | null; onUpgrade: () => void }) {
  return (
    <div className="mx-auto max-w-xl">
      <section className="carte p-8 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#8FB59B]/15">
          <Icone nom="cle" taille={26} />
        </span>
        <h1 className="titre-or mt-4 text-2xl font-extrabold">Module non inclus</h1>
        <p className="mt-3 text-sm leading-6 text-[#A7B7A8]">
          <strong className="text-[#E8ECE8]">{FEATURE_LABEL[feature] ?? feature}</strong> fait partie
          de l’offre {plan === "gold" ? "GOLD" : "SILVER"}. Votre forfait actuel est{" "}
          <strong className="text-[#DFE7E2]">{plan ? PLAN_LABEL[plan as keyof typeof PLAN_LABEL] ?? plan : "STANDARD"}</strong>.
        </p>
        <p className="mt-3 text-xs leading-5 text-[#A7B7A8]">
          Contactez votre administrateur pour une mise à niveau, ou connectez-vous au compte
          Super Admin pour changer le forfait de l’établissement.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/tableau-de-bord" className="rounded-lg border border-[#8FB59B]/40 px-4 py-2 text-sm text-[#DFE7E2]">
            Retour au tableau de bord
          </Link>
          <button type="button" onClick={onUpgrade} className="btn-or px-4 py-2 text-sm">
            Demander une mise à niveau
          </button>
        </div>
      </section>
    </div>
  );
}

export function ShellApp({
  actif,
  children: enfants,
  salutation,
  sousTitre,
  feature,
}: {
  actif: string;
  children: ReactNode;
  salutation: string;
  sousTitre: string;
  feature?: FeatureKey;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("auto-dyali-sidebar") === "collapsed";
  });
  const [aujourdHui, setAujourdHui] = useState("");
  const [heureActuelle, setHeureActuelle] = useState("");
  const [confirmerDeconnexion, setConfirmerDeconnexion] = useState(false);
  const [messageDroit, setMessageDroit] = useState<string | null>(null);
  const [horsLigne, setHorsLigne] = useState(false);
  const [erreurSession, setErreurSession] = useState(false);
  const router = useRouter();

  // Connectivité réelle : bandeau explicite quand le réseau est absent.
  // L'état initial est pris en charge par l'événement « online »/« offline »
  // (pas de lecture navigator pendant le rendu, règle de pureté React).
  useEffect(() => {
    const enLigne = () => setHorsLigne(false);
    const horsReseau = () => setHorsLigne(true);
    window.addEventListener("online", enLigne);
    window.addEventListener("offline", horsReseau);
    // État initial (page ouverte déjà hors ligne) : lecture différée hors rendu.
    const timer = window.setTimeout(() => { if (!navigator.onLine) setHorsLigne(true); }, 0);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("online", enLigne);
      window.removeEventListener("offline", horsReseau);
    };
  }, []);
  const basePath = process.env.NEXT_PUBLIC_SITE_BASE_PATH ?? "";
  const [estConnecte, setEstConnecte] = useState(false);
  const profil = useProfil();
  const droits = useFeatures();

  useEffect(() => {
    let vivant = true;
    const timer = window.setTimeout(async () => {
      try {
        const { data } = (await supabase?.auth.getSession()) ?? { data: { session: null } };
        if (!vivant) return;
        if (!data.session) { router.replace("/connexion/"); return; }
        setEstConnecte(true);
      } catch {
        // Échec réseau / extension de blocage : ne JAMAIS rester bloqué sur
        // « Vérification de la session… ». Afficher un état explicite.
        if (!vivant) return;
        setErreurSession(true);
      }
    }, 0);
    return () => { vivant = false; window.clearTimeout(timer); };
  }, [router]);

  function toggleSidebar() {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("auto-dyali-sidebar", next ? "collapsed" : "expanded");
      return next;
    });
  }

  // Garde de rôle : le tableau de bord professionnel est réservé aux managers / super admin.
  useEffect(() => {
    if (!estConnecte || profil.loading) return;
    if (profil.role && !profil.is(["manager", "saas_admin"])) {
      if (profil.role === "employee") router.replace("/employe/");
      else {
        void supabase?.auth.signOut();
        router.replace("/connexion/");
      }
    }
  }, [estConnecte, profil, router]);

  useEffect(() => {
    const formatterDate = new Intl.DateTimeFormat("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    const formatterHeure = new Intl.DateTimeFormat("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const actualiserHorloge = () => {
      const maintenant = new Date();
      setAujourdHui(formatterDate.format(maintenant));
      setHeureActuelle(formatterHeure.format(maintenant));
    };
    actualiserHorloge();
    const intervalle = window.setInterval(actualiserHorloge, 1000);
    return () => window.clearInterval(intervalle);
  }, []);

  async function seDeconnecter() {
    await supabase?.auth.signOut();
    router.replace("/connexion/");
  }

  const actionDeconnexion = (
    <button
      type="button"
      onClick={() => setConfirmerDeconnexion(true)}
      className="mt-auto flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm text-[#C5716B] transition hover:bg-[#C5716B]/10"
    >
      <Icone nom="deconnexion" taille={18} />
      Déconnexion
    </button>
  );

  const recherche = (e: FormEvent) => {
    e.preventDefault();
    // TODO PHASE 6 : recherche globale branchée sur l'API.
  };

  const estMaquette = actif === "Tableau de bord" || actif === "Point de vente";
  const labelActif = estMaquette ? (actif === "Tableau de bord" ? "Dashboard" : "Point de Vente") : actif;
  const baseModules = estMaquette ? (actif === "Tableau de bord" ? modulesMaquetteDashboard : modulesMaquettePos) : modules;
  const navModules = baseModules.filter((m) => droitAllows(m.feature));

  function droitAllows(f: FeatureKey) {
    // Pendant le chargement : n'afficher que la base (jamais ouvrir en grand).
    if (droits.loading) return ["dashboard", "clients", "vehicles", "stock", "pos", "invoices", "quotes", "suppliers", "reports_basic"].includes(f);
    return droits.allows(f);
  }

  const nav = (
    <nav className="flex flex-col gap-1 mt-8">
      {navModules.map((m) => (
        <Link
          key={m.label}
          href={m.href}
          onClick={() => setOuvert(false)}
          aria-current={labelActif === m.label ? "page" : undefined}
          title={m.label}
          aria-label={m.label}
          className={cn(
            "maquette-nav-link flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm transition",
            labelActif === m.label
              ? "bg-[#8FB59B] font-bold text-[#252D2D]"
              : "text-[#E8ECE8]/80 hover:bg-[#344440] hover:text-[#E8ECE8]"
          )}
        >
          <Icone nom={m.icone} taille={18} />
          <span className="menu-label">{m.label}</span>
        </Link>
      ))}
    </nav>
  );

  if (erreurSession) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#252D2D] p-6 text-center">
        <p className="text-sm text-[#D6A34D]">Impossible de joindre le serveur d&#39;authentification.</p>
        <p className="max-w-md text-xs leading-5 text-[#A7B7A8]">
          Vérifiez votre connexion internet, désactivez temporairement les bloqueurs/VPN, puis réessayez.
        </p>
        <button type="button" onClick={() => window.location.reload()} className="btn-or px-5 py-2 text-sm">
          Réessayer
        </button>
      </main>
    );
  }

  if (!estConnecte || profil.loading) return <div className="flex min-h-screen items-center justify-center bg-[#252D2D] text-sm text-[#A7B7A8]">Vérification de la session…</div>;

  // Garde de rôle : refus explicite si l'URL est saisie manuellement.
  if (profil.role && !profil.is(["manager", "saas_admin"])) {
    const destination = profil.role === "employee" ? "/employe/" : "/connexion/";
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#252D2D] p-6 text-center">
        <p className="text-sm text-[#C5716B]">Accès refusé : cette section est réservée aux gestionnaires professionnels.</p>
        <button type="button" onClick={() => router.replace(destination)} className="btn-or px-5 py-2 text-sm">
          Revenir à mon espace
        </button>
      </main>
    );
  }

  const initiales = (profil.fullName || "AD").split(" ").map((mot) => mot[0]).join("").slice(0, 2).toUpperCase();
  const libelleRole = profil.role === "saas_admin" ? "Super Admin" : profil.role === "manager" ? "Manager" : "Utilisateur";

  // Garde de forfait : module présent dans l'URL mais pas dans l'offre.
  const moduleDemande = feature && !droits.loading && !droits.allows(feature);

  const estPosFixe = actif === "Point de vente";
  return (
    <div className={`flex ${estPosFixe ? "md:h-screen md:overflow-hidden" : "min-h-screen"} bg-[#252D2D] bg-cover bg-center bg-fixed ${["Tableau de bord", "Point de vente", "Mini-POS"].includes(actif) ? "maquette-shell" : ""}`} style={{ backgroundImage: `linear-gradient(rgba(37,45,45,.55),rgba(37,45,45,.72)), url('${basePath}/images/backgrounds/connexion.webp')` }}>
      {/* Sidebar desktop */}
      <aside
        className={`carte hidden shrink-0 rounded-none border-y-0 border-l-0 lg:flex lg:flex-col p-5 sticky top-0 h-screen overflow-y-auto app-sidebar ${
          sidebarCollapsed ? "is-collapsed" : ""
        }`}
      >
        <Logo compact />
        <button
          type="button"
          onClick={toggleSidebar}
          aria-label={sidebarCollapsed ? "Développer le menu" : "Réduire le menu"}
          title={sidebarCollapsed ? "Développer le menu" : "Réduire le menu"}
          className="btn-sidebar-toggle mb-3"
        >
          {sidebarCollapsed ? "›" : "<>"}
        </button>
        {nav}
        {droits.plan && (
          <p className="mt-4 rounded-xl bg-[#344440] px-3 py-2 text-center text-[10px] uppercase tracking-[0.2em] text-[#DFE7E2]">
            Offre {PLAN_LABEL[droits.plan]}
          </p>
        )}
        <div className="neon-panel mt-auto rounded-2xl p-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#344440] text-xs font-bold text-[#DFE7E2]">
              {initiales}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-xs font-bold text-[#E8ECE8]">{profil.fullName || "Admin Garage"}</span>
              <span className="block truncate text-[10px] text-[#A7B7A8]">{libelleRole} · Garage AUTO DYALI</span>
            </span>
            <span className="ml-auto h-2 w-2 shrink-0 rounded-full bg-[#3dffb4] dashboard-alert-dot" aria-hidden />
          </div>
        </div>
        {actionDeconnexion}
      </aside>

      {/* Tiroir mobile / tablette */}
      {ouvert && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-label="Menu">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOuvert(false)} />
          <aside className="carte absolute top-0 left-0 flex h-full w-64 flex-col rounded-none p-5 overflow-y-auto">
            <div className="flex items-center justify-between">
              <Logo compact />
              <button
                onClick={() => setOuvert(false)}
                aria-label="Fermer le menu"
                className="rounded-lg bg-[#344440] px-2 py-1 text-[#E8ECE8]"
              >
                ✕
              </button>
            </div>
            {nav}
            {droits.plan && (
              <p className="mt-4 rounded-xl bg-[#344440] px-3 py-2 text-center text-[10px] uppercase tracking-[0.2em] text-[#DFE7E2]">
                Offre {PLAN_LABEL[droits.plan]}
              </p>
            )}
            {actionDeconnexion}
          </aside>
        </div>
      )}

      {/* Contenu */}
      <div className={`flex min-w-0 flex-1 flex-col ${estPosFixe ? "md:h-full md:min-h-0" : ""}`}>
        {/* En-tête */}
        <header className="carte maquette-header sticky top-0 z-30 flex items-center gap-3 rounded-none border-x-0 border-t-0 px-4 py-3 lg:px-7">
          <button
            className="lg:hidden min-h-11 min-w-11 touch-manipulation rounded-lg bg-[#344440] p-2.5"
            onClick={() => setOuvert(true)}
            aria-label="Ouvrir le menu"
            aria-expanded={ouvert}
          >
            <svg viewBox="0 0 20 20" width="18" height="18">
              <path d="M3 5h14M3 10h11M3 15h14" stroke="#8FB59B" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>

          {estMaquette ? (
            <form onSubmit={recherche} className="hidden min-w-0 flex-1 md:flex md:justify-center">
              <label className="maquette-search flex min-h-11 w-full max-w-xl items-center gap-3 rounded-full px-4">
                <span aria-hidden className="text-[#D9F4E7]">⌕</span>
                <input type="search" placeholder="Rechercher un client, un véhicule, une intervention..." className="w-full border-0 bg-transparent text-sm text-[#F2F7F3] outline-none placeholder:text-[#8da298]" aria-label="Rechercher un client, un véhicule, une intervention" />
                <span aria-hidden className="text-[#F2D58A]">⫼</span>
              </label>
            </form>
          ) : (
            <>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-[#E8ECE8]">
                  {salutation} <span className="block text-xs font-normal text-[#A7B7A8]">{sousTitre}</span>
                </p>
              </div>

              <form onSubmit={recherche} className="hidden md:block">
                <input type="search" placeholder="Rechercher un client, un véhicule, une intervention..." className="champ maquette-search w-64 py-2 text-sm" aria-label="Rechercher" />
              </form>
            </>
          )}

          <div className="hidden sm:flex items-center gap-2">
            <Link href="/tableau-de-bord/notifications" className="maquette-icon-btn relative flex h-10 w-10 items-center justify-center rounded-xl" aria-label="Notifications">
              <Icone nom="cloche" taille={20} />
            </Link>
            <Link href="/tableau-de-bord/planning" className="maquette-icon-btn flex h-10 w-10 items-center justify-center rounded-xl" aria-label="Planning">
              <Icone nom="planning" taille={20} />
            </Link>
          </div>

          <div className="hidden sm:block text-right text-[11px] leading-tight text-[#A7B7A8] capitalize">
            <span>{aujourdHui}</span>
            <span className="mt-0.5 block text-[#DFE7E2]">{heureActuelle}</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#344440] text-xs font-bold text-[#DFE7E2]">
              {initiales}
            </span>
            <span className="hidden text-xs text-[#E8ECE8]">{profil.fullName || "Manager"} <span className="block text-[10px] text-[#A7B7A8]">{libelleRole}</span></span>
          </div>
        </header>

        {horsLigne && (
          <p role="status" className="bg-[#8FB59B]/20 px-4 py-2 text-center text-xs font-semibold text-[#DFE7E2] lg:px-7">
            Hors connexion — les données affichées peuvent ne pas être à jour et les écritures seront impossibles jusqu’au retour du réseau.
          </p>
        )}

        <main className={estPosFixe ? "md:min-h-0 md:flex-1 md:overflow-hidden p-3" : "flex-1 p-4 pb-28 lg:pb-7 lg:p-7"}>
          {moduleDemande ? (
            <ModuleVerrouille
              feature={feature!}
              plan={droits.plan}
              onUpgrade={() => setMessageDroit("Connectez-vous au compte Super Admin puis ouvrez Super Admin → Entreprises pour changer le forfait de cet établissement.")}
            />
          ) : (
            enfants
          )}
          {messageDroit && (
            <p role="status" className="mx-auto mt-4 max-w-xl rounded-lg bg-[#5D9E7F]/10 px-4 py-3 text-center text-xs text-[#7FBF9E]">
              {messageDroit}
            </p>
          )}
        </main>
      </div>

      {/* Navigation mobile fixe — Accueil · Point de vente · Stock · Menu.
          Masquée sur la page Point de vente : le POS possède SA PROPRE barre
          fixe de paiement (panier + total) qui occupe déjà cette zone. */}
      {actif !== "Point de vente" && (
        <nav
          aria-label="Navigation mobile"
          className="carte safe-bas fixed bottom-0 left-0 right-0 z-30 flex items-stretch justify-around rounded-none border-t border-[#344440] lg:hidden"
        >
        {([
          { label: "Tableau de bord", href: "/tableau-de-bord", icone: "ca", lib: "Accueil" },
          { label: "Point de vente", href: "/tableau-de-bord/point-de-vente", icone: "pos", lib: "Vente" },
          { label: "Stock", href: "/tableau-de-bord/stock", icone: "carton", lib: "Stock" },
        ] as const).map((m) => (
          <Link
            key={m.label}
            href={m.href}
            aria-current={actif === m.label ? "page" : undefined}
            className={cn(
              "flex min-h-14 min-w-16 touch-manipulation flex-1 flex-col items-center justify-center gap-0.5 rounded-t-lg py-2 text-[10px] font-semibold transition",
              actif === m.label ? "bg-[#344440] text-[#DFE7E2]" : "text-[#A7B7A8] active:bg-[#2C3735]",
            )}
          >
            <Icone nom={m.icone} taille={20} />
            {m.lib}
          </Link>
        ))}
        <button
          type="button"
          onClick={() => setOuvert(true)}
          aria-label="Ouvrir le menu complet"
          className="flex min-h-14 min-w-16 touch-manipulation flex-1 flex-col items-center justify-center gap-0.5 rounded-t-lg py-2 text-[10px] font-semibold text-[#A7B7A8] active:bg-[#2C3735]"
        >
          <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden>
            <path d="M3 5h14M3 10h11M3 15h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Menu
        </button>
      </nav>
      )}

      {confirmerDeconnexion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-5" role="dialog" aria-modal="true" aria-labelledby="deconnexion-titre">
          <div className="carte w-full max-w-sm p-6 shadow-2xl">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#C5716B]/15"><Icone nom="deconnexion" taille={20} /></span>
              <h2 id="deconnexion-titre" className="font-bold text-[#E8ECE8]">Confirmer la déconnexion</h2>
            </div>
            <p className="mt-4 text-sm leading-6 text-[#A7B7A8]">Voulez-vous vraiment quitter votre espace AUTO DYALI ? Votre session sera fermée en toute sécurité.</p>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setConfirmerDeconnexion(false)} className="rounded-lg px-4 py-2 text-sm text-[#A7B7A8] hover:bg-[#344440]">Annuler</button>
              <button type="button" onClick={() => void seDeconnecter()} className="rounded-lg bg-[#C5716B] px-4 py-2 text-sm font-bold text-white hover:bg-[#B05A55]">Se déconnecter</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
