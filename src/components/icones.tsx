/**
 * Jeu d'icônes linéaires dorées (SVG) — style maquette AUTO+.
 * Chaque icône = trait fin doré, fond transparent.
 */
import type { JSX } from "react";

const defs = (
  <defs>
    <linearGradient id="orIcon" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stopColor="#e9d998" />
      <stop offset="100%" stopColor="#d6b66f" />
    </linearGradient>
  </defs>
);

const strokes = {
  fill: "none",
  stroke: "url(#orIcon)",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export type NomIcone =
  | "ca" | "benefice" | "depenses" | "cle" | "commun"
  | "voiture" | "carton" | "client" | "rapport"
  | "resistance" | "pos" | "barcode" | "planning" | "pointage"
  | "historique" | "cloche" | "profil" | "scanner" | "plus";

const chemins: Record<NomIcone, JSX.Element> = {
  // KPIs
  ca: (
    <>
      <path d="M8 13c0-2 1.5-3.5 4-3.5s4 1.5 4 3.5v4c0 2-1.8 3-4 3s-4-1-4-3v-4Z" />
      <path d="M10 9.5C10 7 11 5.5 13 5.5s3 1.5 3 4" />
      <path d="M6.5 10C6.5 8 7.5 6.8 9 6.8" />
    </>
  ),
  benefice: (
    <>
      <circle cx="10" cy="10" r="6.5" />
      <path d="M7.5 12.5l2-2 1.5 1.5 3-3" />
      <path d="M12 6.5h2.5V9" />
    </>
  ),
  depenses: (
    <>
      <ellipse cx="10" cy="7" rx="5" ry="2" />
      <path d="M5 7v6c0 1.2 2.2 2 5 2s5-.8 5-2V7" />
      <path d="M5 10c0 1.2 2.2 2 5 2s5-.8 5-2" />
    </>
  ),
  cle: (
    <>
      <path d="M4 15l7-7 1.5 1-1 1 1 1-1 1 1 1-1.5 1.5-1-1-1 1-1-1-3 3-2-.2Z" />
      <path d="M13 5.5c1.8-1.6 4.3-1.2 5 .5.6 1.6-.3 3-1.5 3.6" />
    </>
  ),
  commun: <path d="M4 15v-5a6 6 0 0 1 12 0v5" />,
  voiture: (
    <>
      <path d="M3.5 12.5c1-2.6 2.2-3.6 4.5-3.6h5c2 0 3.4 1 4.5 3.5.5 1.2.2 2.6-1 2.6H4.5c-.9 0-1.4-1.3-1-2.5Z" />
      <circle cx="6.5" cy="13.2" r="1.4" />
      <circle cx="14.5" cy="13.2" r="1.4" />
    </>
  ),
  carton: (
    <>
      <rect x="4" y="6" width="12" height="9" rx="1" />
      <path d="M4 9h12M10 6v9M7 6l1-2h1M11 4h1l1 2" />
    </>
  ),
  client: (
    <>
      <circle cx="10" cy="7" r="2.6" />
      <path d="M4.5 15.5c.6-3 2.8-4.5 5.5-4.5s4.9 1.5 5.5 4.5" />
    </>
  ),
  rapport: (
    <>
      <rect x="5" y="3.5" width="10" height="13" rx="1.5" />
      <path d="M8 7h4M8 10h6M8 13h6" />
    </>
  ),
  // Raccourcis écran 1
  resistance: (
    <>
      <rect x="3.5" y="6" width="13" height="9" rx="2" />
      <path d="M6 14.5v2M14 14.5v2" />
      <circle cx="10" cy="10.5" r="2.5" />
    </>
  ),
  pos: (
    <>
      <rect x="6" y="3.5" width="8" height="6" rx="1" />
      <rect x="5" y="9.5" width="10" height="7" rx="1.5" />
      <path d="M7 12.5h2M7 14.5h4" />
    </>
  ),
  barcode: (
    <>
      <path d="M4 4v12M16 4v12" />
      <path d="M7 5v10M10 5v10M13 5v10" />
      <path d="M2 6h2M2 14h2M16 6h2M16 14h2" />
    </>
  ),
  planning: (
    <>
      <rect x="4" y="5" width="12" height="10" rx="1.5" />
      <path d="M4 8.5h12M7 3.5v3M13 3.5v3" />
      <path d="M7 11h2M7 13h4" />
    </>
  ),
  pointage: (
    <>
      <circle cx="10" cy="10" r="6.5" />
      <path d="M10 6.5V10l2.5 1.5" />
    </>
  ),
  historique: (
    <>
      <circle cx="10" cy="10" r="6" />
      <path d="M10 6.8V10l2 1" />
      <path d="M4 4v2.5h2.5" />
    </>
  ),
  cloche: (
    <>
      <path d="M10 4a4.5 4.5 0 0 1 4.5 4.5V12l1.5 2H4l1.5-2V8.5A4.5 4.5 0 0 1 10 4Z" />
      <path d="M8.5 14a1.5 1.5 0 0 0 3 0" />
    </>
  ),
  profil: (
    <>
      <circle cx="10" cy="8" r="3" />
      <path d="M4.5 16c.8-3 3-4.5 5.5-4.5s4.7 1.5 5.5 4.5" />
    </>
  ),
  scanner: (
    <>
      <rect x="4" y="4" width="12" height="12" rx="2" />
      <path d="M7 8l2 2-2 2M11 12h2.5" />
    </>
  ),
  plus: <path d="M10 4.5v11M4.5 10h11" />,
};

export function Icone({
  nom,
  taille = 20,
  className,
}: {
  nom: NomIcone;
  taille?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 20 20"
      width={taille}
      height={taille}
      aria-hidden
      className={className}
    >
      {defs}
      {chemins[nom] ?? chemins.commun}
    </svg>
  );
}
