"use client";

import { useRef, useState } from "react";
import { ScannerCamera } from "@/components/scanner-camera";

/**
 * Champ de scan EAN-13 réutilisable (POS, Stock, Catalogue).
 *
 * Logique de repli caméra (demande du propriétaire) :
 * - Douchette USB/Bluetooth HID : elle a le focus, envoie les chiffres puis
 *   Entrée → code traité immédiatement.
 * - Bouton « Scanner » avec un code saisi → traité (saisie manuelle).
 * - Bouton « Scanner » SANS code saisi (pas de douchette connectée) →
 *   la caméra s'ouvre automatiquement (PC ou smartphone) et lit le code.
 * - Bouton « Caméra » explicite : ouverture directe de la caméra.
 * - La caméra utilise l'API native `BarcodeDetector` ; si le navigateur ne
 *   la supporte pas, message honnête (pas de lecture simulée).
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
  const [info, setInfo] = useState<string | null>(null);
  const [camOuverte, setCamOuverte] = useState(false);

  /** Traite la saisie ; si vide → repli automatique caméra. */
  function traiter(valeur: string) {
    const propre = valeur.replace(/[^\dA-Za-z]/g, "");
    if (!propre) {
      // Pas de douchette (aucun code reçu) : on passe à la caméra.
      setErreur(null);
      setInfo("Aucun code détecté à la saisie — ouverture de la caméra…");
      setCamOuverte(true);
      return;
    }
    setErreur(null);
    setInfo(null);
    onCode(propre);
    bip();
    if (champRef.current) {
      champRef.current.value = "";
      champRef.current.focus();
      champRef.current.select();
    }
  }

  function codeCamera(code: string) {
    setCamOuverte(false);
    setErreur(null);
    setInfo(null);
    onCode(code);
    bip();
    champRef.current?.focus();
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
          title="Scanner avec la douchette, ou ouvrir la caméra si aucun code n'est saisi"
          className="min-h-11 shrink-0 rounded-lg bg-[#d6b66f] px-4 text-sm font-bold text-[#102b32]"
        >
          Scanner
        </button>
        <button
          type="button"
          onClick={() => setCamOuverte(true)}
          title="Lire un code avec la caméra du PC ou du smartphone"
          aria-label="Scanner avec la caméra"
          className="min-h-11 shrink-0 rounded-lg border border-[#d6b66f]/40 px-3 text-sm text-[#e9d998]"
        >
          📷
        </button>
      </div>
      {erreur && <p role="alert" className="mt-1 text-xs text-[#d66868]">{erreur}</p>}
      {info && <p role="status" className="mt-1 text-xs text-[#90a0b0]">{info}</p>}

      {camOuverte && (
        <ScannerCamera onCode={codeCamera} fermer={() => { setCamOuverte(false); champRef.current?.focus(); }} />
      )}
    </div>
  );
}
