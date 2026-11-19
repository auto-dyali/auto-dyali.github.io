"use client";

/**
 * AUTO DYALI — Identite visuelle propre a chaque page Super Admin.
 *
 * Chaque section possede une signature distincte (numero, icone, accent,
 * fil d Ariane, blurb metier, motif). Le bandeau est rendu par ModulePage
 * pour donner une composition differente a chaque page sans touched a
 * leur logique metier.
 */

export type PageIdentity = {
  key: string;
  numero: string;
  icone: string;
  accent: string;
  accentFond: string;
  fil: string[];
  blurb: string;
  motif: string;
};


const IDENTITES: Record<string, PageIdentity> = {
  "/super-admin/": {
    key: "vue-generale", numero: "01", icone: "◫", accent: "#D6A34D", accentFond: "rgba(214,163,77,0.12)",
    fil: ["Plateforme", "Vue générale"],
    blurb: "Vision consolidée de l'activité SaaS : abonnés, revenus enregistrés, alertes et santé du système.",
    motif: "grid",
  },
  "/super-admin/entreprises/": {
    key: "abonnes", numero: "02", icone: "▤", accent: "#8FB59B", accentFond: "rgba(143,181,155,0.12)",
    fil: ["Portefeuille", "Abonnés professionnels"],
    blurb: "Entreprises et garages abonnés à AUTO DYALI. Identifiants professionnels, formules et échéances.",
    motif: "rows",
  },
  "/super-admin/managers/": {
    key: "utilisateurs", numero: "03", icone: "◎", accent: "#5B7FC7", accentFond: "rgba(91,127,199,0.12)",
    fil: ["Identités", "Utilisateurs & Managers"],
    blurb: "Comptes Managers et professionnels, rôles, rattachement et gestion des accès.",
    motif: "dots",
  },
  "/super-admin/plans/": {
    key: "formules", numero: "04", icone: "◆", accent: "#A78BFA", accentFond: "rgba(167,139,250,0.12)",
    fil: ["Catalogue", "Abonnements & formules"],
    blurb: "Formules BASIC, SILVER, GOLD : prix, durées, essais indépendants et matrice de droits.",
    motif: "cards",
  },
  "/super-admin/crm/": {
    key: "crm", numero: "05", icone: "➤", accent: "#5BC8C8", accentFond: "rgba(91,200,200,0.12)",
    fil: ["Commercial", "CRM commercial"],
    blurb: "Pipeline de prospects professionnels, étapes de conversion et suivi des opportunités.",
    motif: "columns",
  },
  "/super-admin/paiements/": {
    key: "finance", numero: "06", icone: "◈", accent: "#7FBF9E", accentFond: "rgba(127,191,158,0.12)",
    fil: ["Finance", "Finance & facturation"],
    blurb: "État réel des abonnements facturables. Aucun paiement ni facture inventé.",
    motif: "bars",
  },
  "/super-admin/support/": {
    key: "support", numero: "07", icone: "✦", accent: "#D68C6B", accentFond: "rgba(214,140,107,0.12)",
    fil: ["Relation", "Support & assistance"],
    blurb: "Tickets plateforme, priorités, échanges et résolution par établissement.",
    motif: "tickets",
  },
  "/super-admin/integrations/": {
    key: "integrations", numero: "08", icone: "⊞", accent: "#9FB7E0", accentFond: "rgba(159,183,224,0.12)",
    fil: ["Plateforme", "Intégrations & API"],
    blurb: "État de configuration des services. Secrets serveur uniquement, statuts vérifiés.",
    motif: "nodes",
  },
  "/super-admin/roles/": {
    key: "securite", numero: "09", icone: "⛨", accent: "#C79A6B", accentFond: "rgba(199,154,107,0.12)",
    fil: ["Gouvernance", "Sécurité & permissions"],
    blurb: "Rôles, permissions appliquées côté serveur, isolation multi-tenant et RLS.",
    motif: "shield",
  },
  "/super-admin/audit/": {
    key: "journal", numero: "10", icone: "☷", accent: "#B0A8E0", accentFond: "rgba(176,168,224,0.12)",
    fil: ["Conformité", "Journal d'activité"],
    blurb: "Historique des opérations administratives, acteurs et cibles, sans données secrètes.",
    motif: "lines",
  },
  "/super-admin/parametres/": {
    key: "systeme", numero: "11", icone: "⚙", accent: "#8FB59B", accentFond: "rgba(143,181,155,0.12)",
    fil: ["Plateforme", "Système & paramètres"],
    blurb: "Identité AUTO DYALI, coordonnées administratives et état des services.",
    motif: "gears",
  },
};

export function getPageIdentity(pathname: string): PageIdentity {
  if (IDENTITES[pathname]) return IDENTITES[pathname];
  if (pathname.startsWith("/super-admin/entreprises")) return IDENTITES["/super-admin/entreprises/"];
  if (pathname.startsWith("/super-admin/managers") || pathname.startsWith("/super-admin/employes")) return IDENTITES["/super-admin/managers/"];
  if (pathname.startsWith("/super-admin/plans") || pathname.startsWith("/super-admin/abonnements")) return IDENTITES["/super-admin/plans/"];
  if (pathname.startsWith("/super-admin/paiements")) return IDENTITES["/super-admin/paiements/"];
  if (pathname.startsWith("/super-admin/whatsapp") || pathname.startsWith("/super-admin/chatbot")) return IDENTITES["/super-admin/integrations/"];
  return IDENTITES["/super-admin/"];
}

export function PageIdentityBanner({ identite, titre }: { identite: PageIdentity; titre: string }) {
  return (
    <div className="ad-page-banner" style={{ ["--ad-accent" as string]: identite.accent, ["--ad-accent-fond" as string]: identite.accentFond }}>
      <div className="ad-page-banner-main">
        <div className="ad-page-numero">{identite.numero}</div>
        <div className="ad-page-icone" aria-hidden>{identite.icone}</div>
        <div className="ad-page-banner-texte">
          <nav className="ad-fil" aria-label="Fil d'Ariane">
            {identite.fil.map((part, i) => (
              <span key={part}>
                {i > 0 && <span className="ad-fil-sep">/</span>}
                <span className={i === identite.fil.length - 1 ? "ad-fil-actif" : ""}>{part}</span>
              </span>
            ))}
          </nav>
          <h1 className="ad-page-titre">{titre}</h1>
          <p className="ad-page-blurb">{identite.blurb}</p>
        </div>
      </div>
      <div className={`ad-page-motif ad-motif-${identite.motif}`} aria-hidden>
        <span /><span /><span /><span /><span /><span />
      </div>
    </div>
  );
}
