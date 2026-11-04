"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Écran 1 de la maquette — Splash / Chargement.
 * Barre de progression animée puis redirection réelle vers /connexion.
 */
export default function SplashPage() {
  const router = useRouter();
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const startedAt = Date.now();
    const duration = 2400;
    const timer = window.setInterval(() => {
      const value = Math.min(100, Math.round(((Date.now() - startedAt) / duration) * 100));
      setProgress(value);
      if (value >= 100) {
        window.clearInterval(timer);
        router.replace("/connexion/");
      }
    }, 24);
    return () => window.clearInterval(timer);
  }, [router]);

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#102b32] [padding-top:env(safe-area-inset-top)] [padding-bottom:env(safe-area-inset-bottom)]">
      {/* Fond garage : scène CSS (photo à substituer plus tard) */}
      <SceneGarage />
      <div className="relative z-10 mt-auto mb-8 w-56 px-3 sm:mb-10 sm:w-72">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-transparent">
          <div className="h-full rounded-full bg-gradient-to-r from-[#e9d998] via-[#d6b66f] to-[#a8833e] transition-[width] duration-75" style={{ width: `${progress}%` }} />
        </div>
      </div>

    </main>
  );
}

/** Scène garage dessinée en CSS (silhouette voiture sur pont élévateur, halos dorés). */
function SceneGarage() {
  const basePath = process.env.NEXT_PUBLIC_SITE_BASE_PATH ?? "";
  return (
      <div aria-hidden className="splash-bg absolute inset-0 overflow-hidden bg-[#102b32]">
      <picture className="absolute inset-0 block h-full w-full">
        <source media="(max-width: 768px)" srcSet={`${basePath}/images/backgrounds/splash-mobile.webp`} />
        <img src={`${basePath}/images/backgrounds/splash.webp`} alt="" className="splash-art absolute inset-0 h-full w-full object-fill sm:object-cover" />
      </picture>
      <div
        className="absolute inset-0 bg-[#102b32]/10"
        style={{
          backgroundImage:
            "linear-gradient(180deg, rgba(16,43,50,.08), rgba(8,25,30,.28)), radial-gradient(120% 90% at 50% 0%, rgba(27,69,80,.15), rgba(10,30,35,.28))",
        }}
      />
      {/* halos dorés */}
      <div
        className="absolute -top-24 right-0 h-[32rem] w-[32rem] rounded-full blur-3xl opacity-25"
        style={{ background: "radial-gradient(circle,#d6b66f,transparent 65%)" }}
      />
      <div
        className="absolute bottom-0 left-1/2 h-72 w-[36rem] -translate-x-1/2 blur-3xl opacity-15"
        style={{ background: "radial-gradient(circle,#e9d998,transparent 70%)" }}
      />
      {/* reflets sol */}
      <div className="absolute bottom-0 h-1/3 w-full opacity-30"
        style={{ background: "linear-gradient(180deg,rgba(214,182,111,.25),transparent)" }} />
    </div>
  );
}
