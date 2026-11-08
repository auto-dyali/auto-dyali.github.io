"use client";

import { useEffect, useRef, useState } from "react";
import { ScannerCamera } from "@/components/scanner-camera";

/**
 * Champ de scan EAN-13 réutilisable (POS, Stock, Catalogue).
 *
 * Trois sources de code, toutes affichées dans la case de saisie :
 * 1. Douchette USB/Bluetooth (HID) : elle émet un burst de touches partout
 *    dans la page — un écouteur global les capte, LES AFFICHE dans la case
 *    puis traite le code (même si le focus n'était pas sur le champ).
 * 2. Caméra (PC / smartphone) : le code lu est écrit dans la case, puis traité.
 * 3. Saisie manuelle + bouton Scanner / Entrée.
 * Repli caméra : bouton Scanner sur case vide, ou bouton 📷 explicite.
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

  /** Écrit le code dans la case de saisie (visible pour l'utilisateur). */
  function afficherCode(code: string) {
    if (champRef.current) champRef.current.value = code;
  }

  /** Traite le code : l'affiche, bip, renvoie au parent. */
  function traiter(valeur: string) {
    const propre = valeur.replace(/[^\dA-Za-z]/g, "");
    if (!propre) {
      setErreur(null);
      setInfo("Aucun code détecté — ouverture de la caméra…");
      setCamOuverte(true);
      return;
    }
    setErreur(null);
    setInfo(null);
    afficherCode(propre); // le code reste visible dans la case
    onCode(propre);
    bip();
    champRef.current?.focus();
    champRef.current?.select();
  }

  function codeCamera(code: string) {
    setCamOuverte(false);
    setErreur(null);
    setInfo(null);
    afficherCode(code); // le code lu à la caméra apparaît dans la case
    onCode(code);
    bip();
    champRef.current?.focus();
  }

  /* ---------------------------------------------------------------
   * Écouteur GLOBAL douchette (HID) : capture le burst de touches
   * même quand le focus est ailleurs, l'affiche dans la case, traite.
   * --------------------------------------------------------------- */
  useEffect(() => {
    let tampon = "";
    let minuteur: number | undefined;

    function onClavier(e: KeyboardEvent) {
      const cible = e.target as HTMLElement | null;
      const dansSaisie = !!cible && (cible.tagName === "INPUT" || cible.tagName === "SELECT" || cible.tagName === "TEXTAREA");

      // Entrée après un code complet → traitement.
      if (e.key === "Enter" && tampon.length >= 8) {
        e.preventDefault();
        afficherCode(tampon);
        traiter(tampon);
        tampon = "";
        return;
      }
      // Quand le focus EST sur notre champ, la boucle onKeyDown du champ gère.
      if (dansSaisie) return;
      if (/^[0-9]$/.test(e.key)) {
        tampon += e.key;
        afficherCode(tampon); // on montre le code en cours de frappe
        window.clearTimeout(minuteur);
        minuteur = window.setTimeout(() => { tampon = ""; }, 120);
        if (tampon.length === 13) { traiter(tampon); tampon = ""; }
      }
    }

    document.addEventListener("keydown", onClavier);
    return () => {
      document.removeEventListener("keydown", onClavier);
      window.clearTimeout(minuteur);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          title="Scanner le code saisi, ou ouvrir la caméra si aucun code n'est saisi"
          className="min-h-11 shrink-0 rounded-lg bg-[#3ECF6A] px-4 text-sm font-bold text-[#252D2D]"
        >
          Scanner
        </button>
        <button
          type="button"
          onClick={() => setCamOuverte(true)}
          title="Lire un code-barres ou un QR avec la caméra"
          aria-label="Scanner avec la caméra"
          className="min-h-11 shrink-0 rounded-lg border border-[#3ECF6A]/40 px-3 text-sm text-[#DFE7E2]"
        >
          📷
        </button>
      </div>
      {erreur && <p role="alert" className="mt-1 text-xs text-[#C5716B]">{erreur}</p>}
      {info && <p role="status" className="mt-1 text-xs text-[#8DA298]">{info}</p>}

      {camOuverte && (
        <ScannerCamera onCode={codeCamera} fermer={() => { setCamOuverte(false); champRef.current?.focus(); }} />
      )}
    </div>
  );
}
