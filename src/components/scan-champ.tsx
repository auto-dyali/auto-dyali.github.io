"use client";

import { useRef, useState } from "react";

/**
 * Champ de scan EAN-13 réutilisable (POS, Stock, Catalogue).
 *
 * Logique :
 * - Saisie manuelle ou douchette USB/Bluetooth HID (le champ a le focus,
 *   la douchette envoie les chiffres puis Entrée) → `onCode(code)`.
 * - Bouton « Scanner » : lit la valeur du champ, bip sonore, renvoie le code.
 * - Aucun code valide → message d'erreur + focus (pas de clic silencieux).
 * - Après un scan : le champ est vidé et re-sélectionné pour un scan suivant.
 */

/** Bip sonore partagé (data URI WAV court, aucun fichier externe). */
export function bip() {
  try {
    const audio = new Audio("data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=");
    audio.volume = 0.5;
    void audio.play();
  } catch { /* silencieux */ }
}

export function ScanChamp({
  onCode,
  placeholder = "EAN-13…",
  compact = false,
}: {
  onCode: (code: string) => void;
  placeholder?: string;
  compact?: boolean;
}) {
  const champRef = useRef<HTMLInputElement>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  function traiter(valeur: string) {
    const propre = valeur.replace(/[^\dA-Za-z]/g, "");
    if (!propre) {
      setErreur("Saisissez un code-barres (ou scannez avec la douchette / la caméra).");
      champRef.current?.focus();
      return;
    }
    setErreur(null);
    onCode(propre);
    bip();
    if (champRef.current) {
      champRef.current.value = "";
      champRef.current.focus();
      champRef.current.select();
    }
  }

  return (
    <div className={compact ? "" : "w-full"}>
      <div className="flex gap-1">
        <input
          ref={champRef}
          type="text"
          maxLength={13}
          placeholder={placeholder}
          className="champ min-h-11 flex-1 text-sm"
          aria-label="Code-barres"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              traiter((e.target as HTMLInputElement).value);
            }
          }}
        />
        <button
          type="button"
          onClick={() => traiter(champRef.current?.value ?? "")}
          className="min-h-11 shrink-0 rounded-lg bg-[#d6b66f] px-4 text-sm font-bold text-[#102b32]"
        >
          Scanner
        </button>
      </div>
      {erreur && <p role="alert" className="mt-1 text-xs text-[#d66868]">{erreur}</p>}
    </div>
  );
}
