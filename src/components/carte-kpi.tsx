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
    <article className="neon-kpi relative flex min-h-40 flex-col justify-between gap-4 overflow-hidden p-5 transition hover:border-[#31ffb0]/50">
      {image && <div aria-hidden className="absolute inset-0 bg-cover bg-center opacity-20" style={{ backgroundImage: `url('${image}')` }} />}
      <div aria-hidden className="absolute inset-0 bg-gradient-to-br from-[#07180f]/40 via-[#07180f]/30 to-[#07180f]/80" />
      <div className="relative z-10 flex h-full flex-col justify-between gap-4">
      <div className="flex items-start justify-between gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#31ffb0]/25 bg-black/30 text-[#F2D58A]">
          <Icone nom={icone} taille={24} />
        </span>
        <h3 className="text-sm font-medium text-[#D9F4E7]/90">{titre}</h3>
      </div>
      <div>
        <p className="neon-kpi__value text-2xl font-extrabold tracking-tight">{valeur}</p>
        <p className={`neon-kpi__up mt-1 text-xs font-bold ${positif ? "" : "text-[#F0A8A4]"}`}>
          {variation}
        </p>
      </div>
      </div>
    </article>
  );
}
