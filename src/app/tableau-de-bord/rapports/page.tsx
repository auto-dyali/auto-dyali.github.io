import { ShellApp } from "@/components/shell-app";

const reports = [
  ["Chiffre d'affaires", "Ventes, prestations, TVA et marges", "Ce mois"],
  ["Mouvements de stock", "Entrées, sorties, retours et valorisation", "Ce mois"],
  ["Productivité atelier", "Temps passé, tâches et contrôle qualité", "Cette semaine"],
  ["Créances clients", "Factures ouvertes et échéances", "À jour"],
];

export default function RapportsPage() {
  return <ShellApp actif="Rapports" salutation="Rapports & statistiques" sousTitre="Décisions fondées sur vos données"><div className="apparaitre"><div className="mb-6"><p className="text-xs uppercase tracking-[0.2em] text-[#a8bb87]">Pilotage</p><h1 className="titre-or mt-1 text-2xl font-extrabold">Rapports</h1><p className="mt-1 text-sm text-[#a8bb87]">Les valeurs seront alimentées par Supabase après activation du compte.</p></div><div className="grid gap-4 sm:grid-cols-2">{reports.map(([title, description, period]) => <article key={title} className="carte p-5"><p className="text-xs text-[#a8bb87]">{period}</p><h2 className="mt-2 font-bold text-[#f8ecc9]">{title}</h2><p className="mt-2 text-sm text-[#a8bb87]">{description}</p><button type="button" className="mt-5 text-sm font-semibold text-[#d6b66f] hover:underline">Ouvrir le rapport →</button></article>)}</div></div></ShellApp>;
}
