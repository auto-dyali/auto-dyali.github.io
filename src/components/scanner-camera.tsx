"use client";

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";

/**
 * Scanner caméra — lecture RÉELLE de codes-barres et QR.
 *
 * Décodeur : `html5-qrcode` (JS pur) — fonctionne sur PC (Chrome, Edge,
 * Firefox, Safari) et smartphone, contrairement à l'API native
 * `BarcodeDetector` absente des navigateurs desktop.
 * Formats : EAN-13, EAN-8, UPC-A/E, Code 128/39/93, ITF, QR.
 *
 * Points techniques critiques :
 * - le conteneur vidéo doit avoir une HAUTEUR explicite, sinon la caméra
 *   s'initialise à 0 px et ne lit rien (erreur silencieuse) ;
 * - aucun `qrbox` imposé : il casse sur les caméras basse résolution ;
 * - le contenu brut du QR est conservé (les codes non alphanumériques ne
 *   sont pas strippés à vide).
 */
export function ScannerCamera({ onCode, fermer }: { onCode: (code: string) => void; fermer: () => void }) {
  const [erreur, setErreur] = useState<string | null>(null);
  const zoneRef = useRef<HTMLDivElement | null>(null);
  const traite = useRef(false);

  useEffect(() => {
    let vivant = true;
    let scanner: Html5Qrcode | null = null;

    async function demarrer() {
      const zone = zoneRef.current;
      if (!zone) return;
      // Nettoyage d'une éventuelle instance précédente sur le même nœud.
      zone.innerHTML = "";
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
          { fps: 10 }, // pas de qrbox : détection sur toute l'image
          (texte: string) => {
            if (!vivant || traite.current) return;
            traite.current = true; // anti double-lecture
            // On garde le contenu tel quel si le strippage viderait la chaîne.
            const chiffresLettres = texte.replace(/[^\dA-Za-z]/g, "");
            const code = chiffresLettres || texte.trim();
            if (code) onCode(code);
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
          <button type="button" onClick={fermer} className="text-2xl text-[#A7B7A8]" aria-label="Fermer le scanner">×</button>
        </div>
        {erreur ? (
          <p role="alert" className="mt-4 rounded-lg bg-[#C5716B]/15 px-3 py-2 text-sm text-[#C5716B]">{erreur}</p>
        ) : (
          /* Hauteur EXPLICITE obligatoire : sans elle, vidéo à 0 px = rien ne se lit. */
          <div id="zone-scan-camera" ref={zoneRef} className="mt-4 h-72 w-full overflow-hidden rounded-xl bg-black" />
        )}
        <p className="mt-3 text-center text-xs text-[#A7B7A8]">
          Codes-barres (EAN-13, UPC, Code 128…) et QR — cadrage du code, lecture automatique puis fermeture.
        </p>
      </div>
    </div>
  );
}
