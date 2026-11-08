"use client";

import { useEffect, useRef, useState } from "react";

/**
 * AUTO DYALI — Pavé numérique TACTILE (POS & Mini POS).
 *
 * - Cibles de 48 px minimum, espacées (gap 6 px) : utilisable au doigt,
 *   à la souris et au clavier simultanément.
 * - `touch-action: manipulation` : supprime le délai de 300 ms et le
 *   zoom accidentel par double-tap sur les terminaux tactiles.
 * - Anti-double-validation : chaque pression est ignorée si l'empreinte
 *   de la précédente (touche + horodatage < 120 ms) est identique —
 *   filtre les « ghosts » de certains écrans capacitaires.
 * - Saisie clavier physique acceptée aussi (0-9, retour, entrée).
 * - Aucune fonctionnalité dépendante du survol souris.
 */

type Props = {
  /** Valeur courante (chaîne de chiffres, sans séparateur). */
  valeur: string;
  onChangement: (v: string) => void;
  /** Touche ✓ : validée avec la valeur courante. */
  onValider?: (v: string) => void;
  /** Libellé du bouton de validation (défaut « OK »). */
  libelleValider?: string;
  /** Désactive la validation (ex. montant vide). */
  validerDesactive?: boolean;
  maximumChiffres?: number;
  ariaLabel?: string;
};

const TOUCHES: { l: string; aria: string; action: "chiffre" | "effacer" | "vider" | "valider" }[] = [
  { l: "7", aria: "7", action: "chiffre" },
  { l: "8", aria: "8", action: "chiffre" },
  { l: "9", aria: "9", action: "chiffre" },
  { l: "C", aria: "Tout effacer", action: "vider" },
  { l: "4", aria: "4", action: "chiffre" },
  { l: "5", aria: "5", action: "chiffre" },
  { l: "6", aria: "6", action: "chiffre" },
  { l: "⌫", aria: "Effacer un chiffre", action: "effacer" },
  { l: "1", aria: "1", action: "chiffre" },
  { l: "2", aria: "2", action: "chiffre" },
  { l: "3", aria: "3", action: "chiffre" },
  { l: "000", aria: "Trois zéros", action: "chiffre" },
  { l: "0", aria: "0", action: "chiffre" },
  { l: "00", aria: "Deux zéros", action: "chiffre" },
  { l: ".", aria: "Virgule", action: "chiffre" },
  { l: "✓", aria: "Valider", action: "valider" },
];

export function PaveNumerique({
  valeur,
  onChangement,
  onValider,
  libelleValider = "OK",
  validerDesactive = false,
  maximumChiffres = 9,
  ariaLabel = "Pavé numérique tactile",
}: Props) {
  const derniereFrappe = useRef<{ t: string; ms: number }>({ t: "", ms: 0 });
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    // Le pavé reste utilisable au clavier physique sans voler le focus
    // des autres champs : écouteur passif sur le document.
    function surTouche(e: KeyboardEvent) {
      const cible = e.target as HTMLElement | null;
      if (cible && ["INPUT", "TEXTAREA", "SELECT"].includes(cible.tagName)) return;
      if (/^[0-9]$/.test(e.key)) pousser(e.key);
      else if (e.key === "Backspace") pousser("⌫");
      else if (e.key === "Enter" && onValider) pousser("✓");
    }
    document.addEventListener("keydown", surTouche, { passive: true });
    return () => document.removeEventListener("keydown", surTouche);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valeur, onValider, maximumChiffres]);

  function pousser(touche: string) {
    const ms = Date.now();
    // Anti-ghost tactile : même touche < 120 ms → ignorée.
    if (derniereFrappe.current.t === touche && ms - derniereFrappe.current.ms < 120) return;
    derniereFrappe.current = { t: touche, ms };

    if (touche === "C") { onChangement(""); return; }
    if (touche === "⌫") { onChangement(valeur.slice(0, -1)); return; }
    if (touche === "✓") {
      if (!validerDesactive && onValider) onValider(valeur);
      return;
    }
    // Chiffres / 00 / 000 / virgule
    if (touche === ".") {
      if (valeur.includes(".")) return;
      onChangement(valeur === "" ? "0." : `${valeur}.`);
      return;
    }
    if (valeur.replace(".", "").length >= maximumChiffres) return;
    const suivant = valeur === "0" && touche !== "0" && touche !== "00" && touche !== "000" ? touche : valeur + touche;
    onChangement(suivant);
  }

  if (!visible) return null;

  return (
    <div role="group" aria-label={ariaLabel} className="mt-2 select-none">
      <div className="grid grid-cols-4 gap-1.5">
        {TOUCHES.map((t) => {
          const estValider = t.action === "valider";
          const desactive = estValider && (validerDesactive || !onValider);
          return (
            <button
              key={t.l}
              type="button"
              aria-label={t.aria}
              disabled={desactive}
              onPointerDown={(e) => { e.preventDefault(); pousser(t.l); }}
              onClick={(e) => { e.preventDefault(); pousser(t.l); }}
              className={[
                "min-h-12 min-w-12 touch-manipulation select-none rounded-xl border text-lg font-semibold transition-colors",
                "border-[#8FB59B]/30 bg-[#344440] text-[#E8ECE8] active:bg-[#8FB59B]/25",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#8FB59B]",
                estValider ? "bg-[#8FB59B]/20 text-[#DFE7E2]" : "",
                desactive ? "cursor-not-allowed opacity-40" : "",
              ].join(" ")}
            >
              {estValider ? libelleValider : t.l}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => setVisible(false)}
        className="mt-1 min-h-10 w-full touch-manipulation rounded-lg px-2 py-1 text-[10px] uppercase tracking-[0.15em] text-[#8DA298] hover:bg-[#344440]"
      >
        Masquer le pavé
      </button>
    </div>
  );
}
