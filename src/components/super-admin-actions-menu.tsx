"use client";

/**
 * GV5 §73 — ComboBox « Actions » compacte pour les lignes d'abonnés.
 * Hauteur fermée : 32px ≈ 8,5 mm (<< 25 mm exigés).
 *
 * Le menu est rendu en `position: fixed` à partir des coordonnées du
 * déclencheur : il n'est jamais découpé par le conteneur horizontal
 * `overflow-x-auto` d'un tableau, et il se retourne vers le haut lorsqu'il
 * ne reste pas de place en bas d'écran (accessible sur tactile et 320 px).
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
  | "supprimer"
  | "abo_activer"
  | "abo_suspendre"
  | "abo_resilier"
  | "abo_archiver"
  | "abo_restaurer"
  | "abo_supprimer";

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
  abo_activer: "Abonnement : activer",
  abo_suspendre: "Abonnement : suspendre",
  abo_resilier: "Abonnement : résilier",
  abo_archiver: "Abonnement : archiver",
  abo_restaurer: "Abonnement : restaurer",
  abo_supprimer: "Abonnement : supprimer (logique)",
};

const LARGEUR_MENU = 210;
const HAUTEUR_LIGNE = 34;
const MARGE = 8;

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
  const [ouvert, setOuvert] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const declencheur = useRef<HTMLButtonElement>(null);
  const racine = useRef<HTMLDivElement>(null);

  function placer() {
    const cible = declencheur.current?.getBoundingClientRect();
    if (!cible) return;
    const hauteur = Math.min(actions.length * HAUTEUR_LIGNE + 10, window.innerHeight - 2 * MARGE);
    const bas = cible.bottom + 4;
    const top =
      bas + hauteur > window.innerHeight - MARGE
        ? Math.max(MARGE, cible.top - 4 - hauteur)
        : bas;
    const gauche = Math.min(
      Math.max(MARGE, cible.right - LARGEUR_MENU),
      Math.max(MARGE, window.innerWidth - LARGEUR_MENU - MARGE),
    );
    setPos({ top, left: gauche });
  }

  useEffect(() => {
    if (!ouvert) return;
    placer();
    function onScrollResize() {
      placer();
    }
    document.addEventListener("scroll", onScrollResize, true);
    window.addEventListener("resize", onScrollResize);
    return () => {
      document.removeEventListener("scroll", onScrollResize, true);
      window.removeEventListener("resize", onScrollResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ouvert, actions.length]);

  useEffect(() => {
    if (!ouvert) return;
    function close(e: Event) {
      if (racine.current && !racine.current.contains(e.target as Node)) setOuvert(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOuvert(false);
    }
    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("touchstart", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [ouvert]);

  return (
    <div ref={racine} className="relative inline-block">
      <button
        ref={declencheur}
        type="button"
        aria-label={`Actions pour ${label}`}
        aria-haspopup="menu"
        aria-expanded={ouvert}
        disabled={disabled}
        onClick={() => setOuvert((v) => !v)}
        className="flex h-8 min-h-8 max-h-8 items-center gap-1.5 rounded-lg border border-[#8FB59B]/40 bg-[#2C3735] px-2.5 text-xs font-semibold text-[#DFE7E2] hover:bg-[#344440] disabled:opacity-40"
      >
        <span aria-hidden>⋯</span>
        <span className="hidden sm:inline">Actions</span>
      </button>
      {ouvert && pos && (
        <div
          role="menu"
          aria-label={`Actions pour ${label}`}
          className="fixed z-[60] overflow-hidden rounded-lg border border-[#8FB59B]/30 bg-[#252D2D] py-1 shadow-xl"
          style={{ top: pos.top, left: pos.left, width: LARGEUR_MENU }}
        >
          {actions.map((a) => (
            <button
              key={a}
              type="button"
              role="menuitem"
              onClick={() => {
                setOuvert(false);
                onAction(a);
              }}
              className={`block min-h-9 w-full px-3 py-2 text-left text-xs text-[#DFE7E2] hover:bg-[#344440] ${
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
