import { Icone, type NomIcone } from "@/components/icones";

/** Carte KPI de la maquette : titre, grande valeur dorée, variation colorée. */
export function CarteKpi({
  titre,
  valeur,
  variation,
  positif,
  icone,
  image,
}: {
  titre: string;
  valeur: string;
  variation: string;
  positif: boolean;
  icone: NomIcone;
  image?: string;
}) {
  return (
    <article className="carte relative flex min-h-40 flex-col justify-between gap-4 overflow-hidden p-5 transition hover:border-[#d6b66f]/40">
      {image && <div aria-hidden className="absolute inset-0 bg-cover bg-center opacity-60" style={{ backgroundImage: `url('${image}')` }} />}
      <div aria-hidden className="absolute inset-0 bg-gradient-to-br from-[#193a40]/55 via-[#193a40]/40 to-[#102b32]/75" />
      <div className="relative z-10 flex h-full flex-col justify-between gap-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-medium text-[#f8ecc9]/90">{titre}</h3>
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#21464b] shrink-0">
          <Icone nom={icone} taille={26} />
        </div>
      </div>
      <div>
        <p className="titre-or text-2xl font-extrabold tracking-tight">{valeur}</p>
        <p className={`mt-1 text-xs ${positif ? "text-[#38a987]" : "text-[#d66868]"}`}>
          {variation}
        </p>
      </div>
      </div>
    </article>
  );
}
