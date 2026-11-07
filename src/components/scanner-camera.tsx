"use client";

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";

/**
 * Scanner caméra — lecture RÉELLE de codes-barres et QR.
 *
 * Décodeur : `html5-qrcode` (JS pur) — fonctionne sur PC (Chrome, Edge,
 * Firefox, Safari) et smartphone, contrairement à l'API native
 * `BarcodeDetector` absente des navigateurs desktop. Formats lus :
 * EAN-13, EAN-8, UPC-A/E, Code 128, Code 39, Code 93, Inter2of5, QR.
 *
 * Aucune lecture simulée : si la caméra est refusée ou indisponible,
 * message explicite + repli sur la saisie manuelle / douchette.
 */
export function ScannerCamera({ onCode, fermer }: { onCode: (code: string) => void; fermer: () => void }) {
  const [erreur, setErreur] = useState<string | null>(null);
  const zoneRef = useRef<HTMLDivElement | null>(null);
  const traite = useRef(false);

  useEffect(() => {
    let vivant = true;
    let scanner: Html5Qrcode | null = null;

    async function demarrer() {
      if (!zoneRef.current) return;
      try {
        scanner = new Html5Qrcode("zone-scan-camera", {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.CODE_93,
            Html5QrcodeSupportedFormats.ITF,
            Html5QrcodeSupportedFormats.QR_CODE,
          ],
          verbose: false,
        });
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (texte: string) => {
            if (!vivant || traite.current) return;
            traite.current = true; // anti double-lecture
            const propre = texte.replace(/[^\dA-Za-z]/g, "");
            if (propre) onCode(propre);
            else traite.current = false;
          },
          () => { /* frame sans code : ignorer */ },
        );
      } catch {
        if (!vivant) return;
        setErreur(
          "Caméra indisponible : accès refusé, aucun appareil détecté ou navigateur incompatible. Utilisez la douchette ou la saisie manuelle EAN-13.",
        );
      }
    }

    void demarrer();
    return () => {
      vivant = false;
      if (scanner) {
        try {
          const arret = scanner.stop();
          if (arret && typeof arret.then === "function") arret.then(() => { try { scanner?.clear(); } catch { /* déjà nettoyé */ } }).catch(() => {});
        } catch { /* déjà arrêté */ }
      }
    };
  }, [onCode]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 p-5">
      <div className="carte w-full max-w-md p-5">
        <div className="flex items-center justify-between">
          <h2 className="titre-or text-lg font-extrabold">Scanner caméra</h2>
          <button type="button" onClick={fermer} className="text-2xl text-[#a8bb87]" aria-label="Fermer le scanner">×</button>
        </div>
        {erreur ? (
          <p role="alert" className="mt-4 rounded-lg bg-[#d66868]/15 px-3 py-2 text-sm text-[#d66868]">{erreur}</p>
        ) : (
          <div id="zone-scan-camera" ref={zoneRef} className="mt-4 w-full overflow-hidden rounded-xl bg-black" />
        )}
        <p className="mt-3 text-center text-xs text-[#a8bb87]">
          Codes-barres (EAN-13, UPC, Code 128…) et QR — cadrage du code, lecture automatique puis fermeture.
        </p>
      </div>
    </div>
  );
}
