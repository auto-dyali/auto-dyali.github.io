"use client";

/**
 * GV5 §73 — ComboBox « Actions » compacte pour les lignes d'abonnés.
 * Hauteur fermée : 32px ≈ 8,5 mm (<< 25 mm exigés). Le menu ne s'ouvre
 * qu'au clic et est positionné en absolu : il n'agrandit jamais la ligne.
 */

import { useEffect, useRef, useState } from "react";

export type AbonneAction =
  | "consulter"
  | "modifier"
  | "identifiants"
  | "renouveler"
  | "suspendre"
  | "reactiver"
  | "archiver"
  | "restaurer"
  | "supprimer";

const LIBELLES: Record<AbonneAction, string> = {
  consulter: "Consulter",
  modifier: "Modifier",
  identifiants: "Identifiants / MDP",
  renouveler: "Renouveler",
  suspendre: "Suspendre",
  reactiver: "Réactiver",
  archiver: "Archiver",
  restaurer: "Restaurer",
  supprimer: "Supprimer définitivement",
};

export function AbonneActionsMenu({
  actions,
  onAction,
  disabled,
  label,
}: {
  actions: AbonneAction[];
  onAction: (a: AbonneAction) => void;
  disabled?: boolean;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label={`Actions pour ${label}`}
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="flex h-8 min-h-8 max-h-8 items-center gap-1.5 rounded-lg border border-[#8FB59B]/40 bg-[#2C3735] px-2.5 text-xs font-semibold text-[#DFE7E2] hover:bg-[#344440] disabled:opacity-40"
        style={{ height: "32px", maxHeight: "32px" }}
      >
        <span aria-hidden>⋯</span>
        <span className="hidden sm:inline">Actions</span>
      </button>
      {open && (
        <div
          role="menu"
          aria-label={`Actions pour ${label}`}
          className="absolute right-0 top-full z-40 mt-1 min-w-[160px] overflow-hidden rounded-lg border border-[#8FB59B]/30 bg-[#252D2D] py-1 shadow-xl"
        >
          {actions.map((a) => (
            <button
              key={a}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onAction(a);
              }}
              className={`block w-full px-3 py-2 text-left text-xs text-[#DFE7E2] hover:bg-[#344440] ${
                a === "suspendre" || a === "archiver" || a === "supprimer" ? "text-[#C5716B]" : ""
              }`}
            >
              {LIBELLES[a]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
