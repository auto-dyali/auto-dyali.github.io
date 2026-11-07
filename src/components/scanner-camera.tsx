"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Scanner caméra — lecture réelle de codes-barres (EAN-13…) via l'API native
 * `BarcodeDetector` (Chrome / Edge / Android, y compris la plupart des
 * smartphones). Aucun décodage simulé : si le navigateur ne supporte pas
 * l'API, un message clair invite à utiliser la douchette ou la saisie manuelle.
 */
export function ScannerCamera({ onCode, fermer }: { onCode: (code: string) => void; fermer: () => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    let vivant = true;
    let flux: MediaStream | null = null;
    let boucle = 0;

    async function demarrer() {
      if (!("BarcodeDetector" in window)) {
        setErreur("Ce navigateur ne prend pas en charge la lecture caméra. Utilisez la douchette USB/Bluetooth ou la saisie manuelle EAN-13.");
        return;
      }
      const Detecteur = (window as unknown as { BarcodeDetector: new (options?: { formats?: string[] }) => { detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]> } }).BarcodeDetector;
      try {
        flux = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        const video = videoRef.current;
        if (!video || !vivant) return;
        video.srcObject = flux;
        await video.play();
        const detector = new Detecteur({ formats: ["ean_13", "ean_8", "code_128", "code_39", "upc_a", "upc_e", "qr_code"] });
        const verifier = async () => {
          if (!vivant) return;
          try {
            if (videoRef.current?.readyState === 4) {
              const codes = await detector.detect(videoRef.current);
              if (codes.length && vivant) {
                const code = codes[0].rawValue.replace(/\D/g, "");
                if (code) { onCode(code); return; }
              }
            }
          } catch { /* frame sans code : ignorer */ }
          boucle = window.setTimeout(() => void verifier(), 300);
        };
        void verifier();
      } catch {
        setErreur("Accès caméra refusé. Autorisez la caméra dans les réglages du navigateur.");
      }
    }
    void demarrer();
    return () => {
      vivant = false;
      window.clearTimeout(boucle);
      flux?.getTracks().forEach((t) => t.stop());
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
          <video ref={videoRef} playsInline muted className="mt-4 w-full rounded-xl bg-black" />
        )}
        <p className="mt-3 text-center text-xs text-[#a8bb87]">Cadrage du code-barres / QR — lecture EAN-13, EAN-8, Code 128, UPC, QR.</p>
      </div>
    </div>
  );
}
