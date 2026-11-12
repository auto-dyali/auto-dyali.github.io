/**
 * Éléments d'interface partagés des modules Super Admin.
 * Aucune donnée inventée : uniquement de la mise en page.
 */

export function ModuleHeader({
  surtitre,
  titre,
  description,
  action,
}: {
  surtitre: string;
  titre: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-[11px] uppercase tracking-[0.25em] text-[#D0C6AE]">{surtitre}</p>
        <h1 className="titre-or mt-1 text-2xl font-extrabold">{titre}</h1>
        <p className="mt-1 max-w-2xl text-sm text-[#A7B7A8]">{description}</p>
      </div>
      {action && <div className="flex flex-wrap gap-2">{action}</div>}
    </div>
  );
}

export function Chargement({ label = "Chargement des données…" }: { label?: string }) {
  return <p className="carte-premium p-6 text-sm text-[#A7B7A8]">{label}</p>;
}

export function Vide({ titre, detail }: { titre: string; detail: string }) {
  return (
    <div className="carte-premium p-8 text-center">
      <p className="font-semibold text-[#E8ECE8]">{titre}</p>
      <p className="mt-2 text-sm text-[#A7B7A8]">{detail}</p>
    </div>
  );
}

export function Erreur({ message }: { message: string }) {
  return (
    <p role="alert" className="rounded-lg bg-[#C5716B]/15 px-4 py-3 text-sm text-[#C5716B]">
      {message}
    </p>
  );
}
