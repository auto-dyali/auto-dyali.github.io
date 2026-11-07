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
  { label: "Véhicules", icone: "voiture", href: "/tableau-de-bord/vehicules", feature: "vehicles" },
  { label: "Clients", icone: "client", href: "/tableau-de-bord/clients", feature: "clients" },
  { label: "Atelier", icone: "cle", href: "/tableau-de-bord/atelier", feature: "workshop" },
  { label: "Point de vente", icone: "pos", href: "/tableau-de-bord/point-de-vente", feature: "pos" },
  { label: "Historique des ventes", icone: "historique", href: "/tableau-de-bord/historique-ventes", feature: "pos" },
  { label: "Catalogue", icone: "carton", href: "/tableau-de-bord/catalogue", feature: "catalogue" },
  { label: "Stock", icone: "carton", href: "/tableau-de-bord/stock", feature: "stock" },
  { label: "Pneumatiques", icone: "resistance", href: "/tableau-de-bord/pneumatiques", feature: "tires" },
  { label: "Achats", icone: "carton", href: "/tableau-de-bord/achats", feature: "purchasing" },
  { label: "Fournisseurs", icone: "client", href: "/tableau-de-bord/fournisseurs", feature: "suppliers" },
  { label: "Caisse", icone: "ca", href: "/tableau-de-bord/caisse", feature: "dashboard" },
  { label: "Chèques", icone: "ca", href: "/tableau-de-bord/cheques", feature: "cheques" },
  { label: "Devis", icone: "rapport", href: "/tableau-de-bord/devis", feature: "quotes" },
  { label: "Facturation", icone: "rapport", href: "/tableau-de-bord/facturation", feature: "invoices" },
  { label: "Employés", icone: "profil", href: "/tableau-de-bord/employes", feature: "employees" },
  { label: "Planning", icone: "planning", href: "/tableau-de-bord/planning", feature: "appointments" },
  { label: "Rapports", icone: "rapport", href: "/tableau-de-bord/rapports", feature: "reports_basic" },
  { label: "AUTO DYALI AI", icone: "plus", href: "/tableau-de-bord/assistant", feature: "ai" },
  { label: "Import / Export", icone: "scanner", href: "/tableau-de-bord/import-export", feature: "excel" },
  { label: "Support", icone: "cloche", href: "/tableau-de-bord/support", feature: "support" },
  { label: "Notifications", icone: "cloche", href: "/tableau-de-bord/notifications", feature: "alerts" },
  { label: "Paramètres", icone: "plus", href: "/tableau-de-bord/parametres", feature: "dashboard" },
];

/** Écran affiché quand le forfait n'inclut pas la fonctionnalité demandée. */
function ModuleVerrouille({ feature, plan, onUpgrade }: { feature: FeatureKey; plan: string | null; onUpgrade: () => void }) {
  return (
    <div className="mx-auto max-w-xl">
      <section className="carte p-8 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#d6b66f]/15">
          <Icone nom="cle" taille={26} />
        </span>
        <h1 className="titre-or mt-4 text-2xl font-extrabold">Module non inclus</h1>
        <p className="mt-3 text-sm leading-6 text-[#a8bb87]">
          <strong className="text-[#f8ecc9]">{FEATURE_LABEL[feature] ?? feature}</strong> fait partie
          de l’offre {plan === "gold" ? "GOLD" : "SILVER"}. Votre forfait actuel est{" "}
          <strong className="text-[#e9d998]">{plan ? PLAN_LABEL[plan as keyof typeof PLAN_LABEL] ?? plan : "STANDARD"}</strong>.
        </p>
        <p className="mt-3 text-xs leading-5 text-[#a8bb87]">
          Contactez votre administrateur pour une mise à niveau, ou connectez-vous au compte
          Super Admin pour changer le forfait de l’établissement.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/tableau-de-bord" className="rounded-lg border border-[#d6b66f]/40 px-4 py-2 text-sm text-[#e9d998]">
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
  const [aujourdHui, setAujourdHui] = useState("");
  const [heureActuelle, setHeureActuelle] = useState("");
  const [confirmerDeconnexion, setConfirmerDeconnexion] = useState(false);
  const [messageDroit, setMessageDroit] = useState<string | null>(null);
  const [horsLigne, setHorsLigne] = useState(false);
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
      const { data } = (await supabase?.auth.getSession()) ?? { data: { session: null } };
      if (!vivant) return;
      if (!data.session) { router.replace("/connexion/"); return; }
      setEstConnecte(true);
    }, 0);
    return () => { vivant = false; window.clearTimeout(timer); };
  }, [router]);

  // Garde de rôle : le tableau de bord est réservé aux managers / super admin.
  useEffect(() => {
    if (!estConnecte || profil.loading) return;
    if (profil.role && !profil.is(["manager", "saas_admin"])) {
      router.replace(profil.role === "employee" ? "/employe/" : "/espace-client/");
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
      className="mt-auto flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm text-[#d66868] transition hover:bg-[#d66868]/10"
    >
      <Icone nom="deconnexion" taille={18} />
      Déconnexion
    </button>
  );

  const recherche = (e: FormEvent) => {
    e.preventDefault();
    // TODO PHASE 6 : recherche globale branchée sur l'API.
  };

  const navModules = modules.filter((m) => droitAllows(m.feature));

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
          aria-current={actif === m.label ? "page" : undefined}
          className={cn(
            "flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm transition",
            actif === m.label
              ? "bg-[#d6b66f] font-bold text-[#102b32]"
              : "text-[#f8ecc9]/80 hover:bg-[#21464b] hover:text-[#f8ecc9]"
          )}
        >
          <Icone nom={m.icone} taille={18} />
          {m.label}
        </Link>
      ))}
    </nav>
  );

  if (!estConnecte || profil.loading) return <div className="flex min-h-screen items-center justify-center bg-[#102b32] text-sm text-[#a8bb87]">Vérification de la session…</div>;

  // Garde de rôle : refus explicite si l'URL est saisie manuellement.
  if (profil.role && !profil.is(["manager", "saas_admin"])) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#102b32] p-6 text-center">
        <p className="text-sm text-[#d66868]">Accès refusé : cette section est réservée aux managers.</p>
        <button type="button" onClick={() => router.replace(profil.role === "employee" ? "/employe/" : "/espace-client/")} className="btn-or px-5 py-2 text-sm">
          Revenir à mon espace
        </button>
      </main>
    );
  }

  const initiales = (profil.fullName || "AD").split(" ").map((mot) => mot[0]).join("").slice(0, 2).toUpperCase();
  const libelleRole = profil.role === "saas_admin" ? "Super Admin" : profil.role === "manager" ? "Manager" : "Utilisateur";

  // Garde de forfait : module présent dans l'URL mais pas dans l'offre.
  const moduleDemande = feature && !droits.loading && !droits.allows(feature);

  return (
    <div className="flex min-h-screen bg-[#102b32] bg-cover bg-center bg-fixed" style={{ backgroundImage: `linear-gradient(rgba(16,43,50,.64),rgba(16,43,50,.78)), url('${basePath}/images/backgrounds/dashboard.webp')` }}>
      {/* Sidebar desktop */}
      <aside className="carte hidden w-60 shrink-0 rounded-none border-y-0 border-l-0 lg:flex lg:flex-col p-5 sticky top-0 h-screen overflow-y-auto">
        <Logo compact />
        {nav}
        {droits.plan && (
          <p className="mt-4 rounded-xl bg-[#21464b] px-3 py-2 text-center text-[10px] uppercase tracking-[0.2em] text-[#e9d998]">
            Offre {PLAN_LABEL[droits.plan]}
          </p>
        )}
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
                className="rounded-lg bg-[#21464b] px-2 py-1 text-[#f8ecc9]"
              >
                ✕
              </button>
            </div>
            {nav}
            {droits.plan && (
              <p className="mt-4 rounded-xl bg-[#21464b] px-3 py-2 text-center text-[10px] uppercase tracking-[0.2em] text-[#e9d998]">
                Offre {PLAN_LABEL[droits.plan]}
              </p>
            )}
            {actionDeconnexion}
          </aside>
        </div>
      )}

      {/* Contenu */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* En-tête */}
        <header className="carte sticky top-0 z-30 flex items-center gap-3 rounded-none border-x-0 border-t-0 px-4 py-3 lg:px-7">
          <button
            className="lg:hidden rounded-lg bg-[#21464b] p-2"
            onClick={() => setOuvert(true)}
            aria-label="Ouvrir le menu"
          >
            <svg viewBox="0 0 20 20" width="18" height="18">
              <path d="M3 5h14M3 10h11M3 15h14" stroke="#d6b66f" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-[#f8ecc9]">
              {salutation} <span className="block text-xs font-normal text-[#a8bb87]">{sousTitre}</span>
            </p>
          </div>

          <form onSubmit={recherche} className="hidden md:block">
            <input type="search" placeholder="Rechercher…" className="champ w-56 py-2 text-sm" />
          </form>

          <div className="hidden sm:block text-right text-[11px] leading-tight text-[#a8bb87] capitalize">
            <span>{aujourdHui}</span>
            <span className="mt-0.5 block text-[#e9d998]">{heureActuelle}</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#21464b] text-xs font-bold text-[#e9d998]">
              {initiales}
            </span>
            <span className="hidden text-xs text-[#f8ecc9]">{profil.fullName || "Manager"} <span className="block text-[10px] text-[#a8bb87]">{libelleRole}</span></span>
          </div>
        </header>

        {horsLigne && (
          <p role="status" className="bg-[#d6b66f]/20 px-4 py-2 text-center text-xs font-semibold text-[#e9d998] lg:px-7">
            Hors connexion — les données affichées peuvent ne pas être à jour et les écritures seront impossibles jusqu’au retour du réseau.
          </p>
        )}

        <main className="flex-1 p-4 lg:p-7">
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
            <p role="status" className="mx-auto mt-4 max-w-xl rounded-lg bg-[#38a987]/10 px-4 py-3 text-center text-xs text-[#69d3a8]">
              {messageDroit}
            </p>
          )}
        </main>
      </div>

      {confirmerDeconnexion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-5" role="dialog" aria-modal="true" aria-labelledby="deconnexion-titre">
          <div className="carte w-full max-w-sm p-6 shadow-2xl">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#d66868]/15"><Icone nom="deconnexion" taille={20} /></span>
              <h2 id="deconnexion-titre" className="font-bold text-[#f8ecc9]">Confirmer la déconnexion</h2>
            </div>
            <p className="mt-4 text-sm leading-6 text-[#a8bb87]">Voulez-vous vraiment quitter votre espace AUTO DYALI ? Votre session sera fermée en toute sécurité.</p>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setConfirmerDeconnexion(false)} className="rounded-lg px-4 py-2 text-sm text-[#a8bb87] hover:bg-[#21464b]">Annuler</button>
              <button type="button" onClick={() => void seDeconnecter()} className="rounded-lg bg-[#d66868] px-4 py-2 text-sm font-bold text-white hover:bg-[#bd5555]">Se déconnecter</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
