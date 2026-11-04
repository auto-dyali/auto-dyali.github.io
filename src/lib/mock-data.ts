/**
 * Données de DÉMONSTRATION locales — chiffres fidèles à la maquette.
 * ⚠️ Sera remplacé par les appels API réels dès l'intégration Supabase.
 * Ne jamais utiliser ces données fictives en production.
 */

export type StatutAtelier = "En cours" | "En attente" | "Planifié";

const basePath = process.env.NEXT_PUBLIC_SITE_BASE_PATH ?? "";

export const kpiManager = [
  { titre: "Chiffre d'affaires", valeur: "125 480 MAD", variation: "+12% vs mois dernier", pos: true, icone: "ca", image: `${basePath}/images/kpi/chiffre-affaires.svg` },
  { titre: "Bénéfice net", valeur: "38 750 MAD", variation: "+8% vs mois dernier", pos: true, icone: "benefice", image: `${basePath}/images/kpi/benefice-net.svg` },
  { titre: "Dépenses", valeur: "46 320 MAD", variation: "-5% vs mois dernier", pos: true, icone: "depenses", image: `${basePath}/images/kpi/depenses.svg` },
  { titre: "Interventions", valeur: "48", variation: "+15% vs mois dernier", pos: true, icone: "cle", image: `${basePath}/images/kpi/interventions.svg` },
] as const;

/* Évolution du chiffre d'affaires (jan → déc, en kMAD) */
export const caMensuel = [
  62, 58, 71, 68, 74, 70, 79, 73, 81, 77, 84, 72,
];

/* CA par service (donut) — pourcentages de la maquette */
export const caParService = [
  { label: "Vidange", pourcent: 22, couleur: "#D6B66F" },
  { label: "Pneumatiques", pourcent: 21, couleur: "#38A987" },
  { label: "Freinage", pourcent: 15, couleur: "#E9D998" },
  { label: "Réparation", pourcent: 12, couleur: "#D69B6A" },
  { label: "Diagnostic", pourcent: 9, couleur: "#5B8A8F" },
  { label: "Autres", pourcent: 11, couleur: "#A8BB87" },
] as const;

export type StatutVehicule = "En cours" | "En attente" | "Planifié";

export const vehiculesAtelier = [
  { modele: "BMW Série 3", plaque: "77788-E-2", statut: "En cours" },
  { modele: "Peugeot 208", plaque: "32101-D-3", statut: "En attente" },
  { modele: "Dacia Sandero", plaque: "45678-C-9", statut: "En attente" },
  { modele: "Renault Clio", plaque: "98765-B-1", statut: "En cours" },
  { modele: "Toyota Corolla", plaque: "12345-A-5", statut: "Planifié" },
] as const;

export const raccourcisDashboard = [
  { label: "Vente rapide", icone: "resistance", href: "/tableau-de-bord/point-de-vente" },
  { label: "Nouvelle intervention", icone: "voiture", href: "/tableau-de-bord/atelier" },
  { label: "Commande fournisseur", icone: "carton", href: "/tableau-de-bord/achats" },
  { label: "Nouveau client", icone: "client", href: "/tableau-de-bord/clients" },
  { label: "Rapport", icone: "rapport", href: "/tableau-de-bord/rapports" },
] as const;

/* — Écran employé (mobile) — */
export const tachesEmploye = {
  interventions: 5,
  pointage: "08:00",
  rendezVous: 3,
  taches: 2,
};

export const interventionsEmploye = [
  { ref: "OR-2025-045", travail: "Vidange + filtres", heure: "09:10", statut: "En cours" },
  { ref: "OR-2025-046", travail: "Diagnostic", heure: "11:00", statut: "À faire" },
  { ref: "OR-2025-047", travail: "Pneumatiques", heure: "14:00", statut: "À faire" },
] as const;

export const raccourcisEmploye = [
  { label: "Scanner produit", icone: "barcode" },
  { label: "Mon planning", icone: "planning" },
  { label: "Pointage", icone: "pointage" },
  { label: "Historique", icone: "historique" },
  { label: "Notifications", icone: "cloche" },
  { label: "Profil", icone: "profil" },
] as const;

export const nomJours = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"] as const;
export const nomMois = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"] as const;
