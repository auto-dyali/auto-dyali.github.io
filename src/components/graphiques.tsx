import { nomMois } from "@/lib/mock-data";

/** Évolution financière — courbes SVG multi-séries (CA, Dépenses, Bénéfices). */
export function CourbeCA({ series, donnees }: { series?: { label: string; donnees: readonly number[]; couleur: string }[]; donnees?: readonly number[] }) {
  const lignesSeries = series ?? (donnees ? [{ label: "Chiffre d’affaires", donnees, couleur: "#31ffb0" }] : []);
  const w = 560;
  const h = 210;
  const padX = 30;
  const padH = 24;
  const max = Math.max(1, ...lignesSeries.flatMap((s) => s.donnees)) * 1.15;

  const ptsParSerie = lignesSeries.map((s) => s.donnees.map((v, i) => [
    padX + (i * (w - padX * 2)) / (Math.max(1, s.donnees.length - 1)),
    h - padH - (v / max) * (h - padH * 2),
  ]));

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-3 text-[11px] text-[#CDE6DA]" aria-hidden>
        {lignesSeries.map((s) => (
          <span key={s.label} className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: s.couleur }} />{s.label}
          </span>
        ))}
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label="Évolution financière">
        <defs>
          <linearGradient id="aireCA" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#31ffb0" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#31ffb0" stopOpacity="0" />
          </linearGradient>
        </defs>

        {[0.25, 0.5, 0.75, 1].map((r) => (
          <line
            key={r}
            x1={padX}
            x2={w - padX}
            y1={h - padH - r * (h - padH * 2)}
            y2={h - padH - r * (h - padH * 2)}
            stroke="rgba(49,255,176,0.16)"
            strokeDasharray="4 6"
          />
        ))}

        {ptsParSerie[0] && (
          <path
            d={`${ptsParSerie[0].map((p, i) => `${i === 0 ? "M" : "L"}${p[0]},${p[1]}`).join(" ")} L${ptsParSerie[0][ptsParSerie[0].length - 1][0]},${h - padH} L${ptsParSerie[0][0][0]},${h - padH} Z`}
            fill="url(#aireCA)"
          />
        )}

        {ptsParSerie.map((pts, si) => (
          <g key={si}>
            <path
              d={pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0]},${p[1]}`).join(" ")}
              fill="none"
              stroke={lignesSeries[si].couleur}
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            {pts.map((p, i) => (
              <circle key={i} cx={p[0]} cy={p[1]} r="3.6" fill="#07180f" stroke={lignesSeries[si].couleur} strokeWidth="2" />
            ))}
          </g>
        ))}

        {(ptsParSerie[0] ?? []).map((p, i) => (
          <text key={i} x={p[0]} y={h - 6} textAnchor="middle" fontSize="10" fill="#A7B7A8">
            {nomMois[i]}
          </text>
        ))}
      </svg>
    </div>
  );
}

/** Donut CA par service (SVG), avec légende externe. */
export function DonutServices({
  parts,
}: {
  parts: readonly { label: string; pourcent: number; couleur: string }[];
}) {
  const r = 54;
  const c = 2 * Math.PI * r;
  const segments = parts.map((part, index) => ({
    part,
    offset: parts.slice(0, index).reduce((total, previous) => total + (previous.pourcent / 100) * c, 0),
  }));

  return (
    <div className="flex items-center gap-5">
      <svg viewBox="0 0 140 140" className="h-36 w-36 shrink-0" role="img" aria-label="CA par service">
        <circle cx="70" cy="70" r={r} fill="none" stroke="#344440" strokeWidth="17" />
        {segments.map(({ part: p, offset }) => {
          const long = (p.pourcent / 100) * c;
          const el = (
            <circle
              key={p.label}
              cx="70"
              cy="70"
              r={r}
              fill="none"
              stroke={p.couleur}
              strokeWidth="17"
              strokeDasharray={`${long} ${c - long}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 70 70)"
              strokeLinecap="butt"
            />
          );
          return el;
        })}
      </svg>

      <ul className="flex flex-col gap-1.5 text-xs">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center gap-2 text-[#E8ECE8]/85">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.couleur }} />
            <span className="min-w-24">{p.label}</span>
            <span className="font-semibold text-[#8FB59B]">{p.pourcent}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
