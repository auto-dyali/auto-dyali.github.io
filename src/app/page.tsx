"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Écran 1 de la maquette — Splash / Chargement.
 * Barre de progression animée puis redirection réelle vers /connexion.
 */
export default function SplashPage() {
  const router = useRouter();

  useEffect(() => {
    const t = setTimeout(() => router.push("/connexion"), 2400);
    return () => clearTimeout(t);
  }, [router]);

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden">
      {/* Fond garage : scène CSS (photo à substituer plus tard) */}
      <SceneGarage />

    </main>
  );
}

/** Scène garage dessinée en CSS (silhouette voiture sur pont élévateur, halos dorés). */
function SceneGarage() {
  const basePath = process.env.NEXT_PUBLIC_SITE_BASE_PATH ?? "";
  return (
      <div aria-hidden className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url('${basePath}/images/backgrounds/splash.png')` }}>
      <div
        className="absolute inset-0 bg-[#102b32]/70"
        style={{
          backgroundImage:
            "linear-gradient(180deg, rgba(16,43,50,.35), rgba(8,25,30,.86)), radial-gradient(120% 90% at 50% 0%, rgba(27,69,80,.45), rgba(10,30,35,.78))",
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
