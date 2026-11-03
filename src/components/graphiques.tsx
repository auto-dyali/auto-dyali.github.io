import { nomMois } from "@/lib/mock-data";

/** Évolution du chiffre d'affaires — courbe area + points (SVG). */
export function CourbeCA({ donnees }: { donnees: readonly number[] }) {
  const w = 560;
  const h = 180;
  const padX = 26;
  const padH = 22;
  const max = Math.max(...donnees) * 1.15;

  const pts = donnees.map((v, i) => [
    padX + (i * (w - padX * 2)) / (donnees.length - 1),
    h - padH - (v / max) * (h - padH * 2),
  ]);

  const ligne = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0]},${p[1]}`).join(" ");
  const aire = `${ligne} L${pts[pts.length - 1][0]},${h - padH} L${pts[0][0]},${h - padH} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label="Évolution du chiffre d'affaires">
      <defs>
        <linearGradient id="aireCA" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#d6b66f" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#d6b66f" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="ligneCA" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#e9d998" />
          <stop offset="100%" stopColor="#d6b66f" />
        </linearGradient>
      </defs>

      {/* grille horizontale */}
      {[0.25, 0.5, 0.75, 1].map((r) => (
        <line
          key={r}
          x1={padX}
          x2={w - padX}
          y1={h - padH - r * (h - padH * 2)}
          y2={h - padH - r * (h - padH * 2)}
          stroke="#21464b"
          strokeDasharray="4 6"
        />
      ))}

      <path d={aire} fill="url(#aireCA)" />
      <path d={ligne} fill="none" stroke="url(#ligneCA)" strokeWidth="3" strokeLinecap="round" />

      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p[0]} cy={p[1]} r="4.5" fill="#102b32" stroke="#e9d998" strokeWidth="2.5" />
          <text
            x={p[0]}
            y={h - 5}
            textAnchor="middle"
            fontSize="10"
            fill="#a8bb87"
          >
            {nomMois[i]}
          </text>
        </g>
      ))}
    </svg>
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
        <circle cx="70" cy="70" r={r} fill="none" stroke="#21464b" strokeWidth="17" />
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
          <li key={p.label} className="flex items-center gap-2 text-[#f8ecc9]/85">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.couleur }} />
            <span className="min-w-24">{p.label}</span>
            <span className="font-semibold text-[#d6b66f]">{p.pourcent}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
