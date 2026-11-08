import { ShellApp } from "@/components/shell-app";

export function ModuleEnConstruction({
  actif,
  titre,
  description,
}: {
  actif: string;
  titre: string;
  description: string;
}) {
  return (
    <ShellApp actif={actif} salutation={titre} sousTitre="Garage AUTO DYALI — Agadir">
      <section className="carte apparaitre p-8 text-center sm:p-12">
        <p className="text-xs uppercase tracking-[0.2em] text-[#A7B7A8]">Module Manager</p>
        <h1 className="titre-or mt-2 text-2xl font-extrabold">{titre}</h1>
        <p className="mx-auto mt-3 max-w-xl text-sm text-[#A7B7A8]">{description}</p>
        <span className="mt-6 inline-flex rounded-full border border-[#8FB59B]/30 bg-[#344440] px-4 py-2 text-xs text-[#D0C6AE]">
          Module en préparation
        </span>
      </section>
    </ShellApp>
  );
}
