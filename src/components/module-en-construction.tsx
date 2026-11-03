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
    <ShellApp actif={actif} salutation={titre} sousTitre="Garage AUTO DYALI — Casablanca">
      <section className="carte apparaitre p-8 text-center sm:p-12">
        <p className="text-xs uppercase tracking-[0.2em] text-[#a8bb87]">Module Manager</p>
        <h1 className="titre-or mt-2 text-2xl font-extrabold">{titre}</h1>
        <p className="mx-auto mt-3 max-w-xl text-sm text-[#a8bb87]">{description}</p>
        <span className="mt-6 inline-flex rounded-full border border-[#d6b66f]/30 bg-[#21464b] px-4 py-2 text-xs text-[#e9d998]">
          Module en préparation
        </span>
      </section>
    </ShellApp>
  );
}
