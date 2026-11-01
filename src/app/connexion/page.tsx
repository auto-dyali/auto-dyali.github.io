"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/logo";
import { cn } from "@/lib/utils";

/**
 * Écran 2 de la maquette — Connexion.
 * Validation côté client active. Dès l'arrivée des clés Supabase,
 * submitOAuth() et doLogin() brancheront l'auth serveur réelle.
 */
export default function ConnexionPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [motPasse, setMotPasse] = useState("");
  const [seSouvenir, setSeSouvenir] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  async function soumettre(e: FormEvent) {
    e.preventDefault();
    setErreur(null);

    if (!email.trim()) {
      setErreur("Veuillez saisir votre email ou identifiant.");
      return;
    }
    if (motPasse.length < 6) {
      setErreur("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }

    setEnCours(true);
    // 🔒 TODO(PHASE 6) : auth réelle via /api/auth (Supabase) — clés en attente.
    // En attendant : session de démonstration locale clairement marquée.
    setTimeout(() => {
      document.cookie = "autoplus_demo=1; path=/" + (seSouvenir ? "; max-age=2592000" : "");
      router.push("/tableau-de-bord");
    }, 700);
  }

  return (
    <main className="relative flex min-h-screen items-stretch overflow-hidden bg-[#102b32]">
      {/* Colonne formulaire (gauche) */}
      <section className="relative z-10 flex w-full flex-col justify-center px-8 py-12 sm:px-14 lg:w-[52%] lg:px-20 apparaitre">
        <Logo className="mb-10 items-start" />

        <h1 className="titre-or text-2xl font-extrabold sm:text-3xl">
          Connectez-vous à votre compte
        </h1>
        <p className="mt-2 text-sm text-[#a8bb87]">
          Accédez à votre espace en toute sécurité
        </p>

        <form className="mt-8 flex max-w-md flex-col gap-4" onSubmit={soumettre} noValidate>
          <div className="relative">
            <svg aria-hidden viewBox="0 0 20 20" className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2">
              <rect x="2.5" y="4.5" width="15" height="11" rx="2" fill="none" stroke="#d6b66f" strokeWidth="1.6" />
              <path d="M3 6l7 5 7-5" fill="none" stroke="#d6b66f" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <input
              style={{ paddingLeft: "2.6rem" }}
              className="champ"
              type="email"
              autoComplete="username"
              placeholder="Email ou identifiant"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="relative">
            <svg aria-hidden viewBox="0 0 20 20" className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2">
              <rect x="4.5" y="9" width="11" height="7" rx="1.5" fill="none" stroke="#d6b66f" strokeWidth="1.6" />
              <path d="M7 9V7a3 3 0 0 1 6 0v2" fill="none" stroke="#d6b66f" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            <input
              style={{ paddingLeft: "2.6rem" }}
              className="champ"
              type="password"
              autoComplete="current-password"
              placeholder="Mot de passe"
              value={motPasse}
              onChange={(e) => setMotPasse(e.target.value)}
            />
          </div>

          {erreur && (
            <p role="alert" className="rounded-lg bg-[#d66868]/15 px-3 py-2 text-sm text-[#d66868]">
              {erreur}
            </p>
          )}

          <div className="flex items-center justify-between text-xs">
            <label className="flex cursor-pointer items-center gap-2 text-[#f8ecc9]/80">
              <input
                type="checkbox"
                checked={seSouvenir}
                onChange={(e) => setSeSouvenir(e.target.checked)}
                className="h-4 w-4 accent-[#d6b66f]"
              />
              Se souvenir de moi
            </label>
            <a href="#" className="text-[#d6b66f] underline-offset-2 hover:underline">
              Mot de passe oublié ?
            </a>
          </div>

          <button
            type="submit"
            className="btn-or mt-2 w-full py-3 text-sm tracking-wide"
            disabled={enCours}
          >
            {enCours ? "Connexion…" : "Se connecter"}
          </button>
        </form>

        {/* Connexion via réseaux (TODO PHASE 6 — OAuth réel) */}
        <div className="mt-7 max-w-md text-center">
          <p className="text-xs text-[#f8ecc9]/60">Ou se connecter avec</p>
          <div className="mt-3 flex justify-center gap-3">
            {[
              { r: "Google", fond: "bg-white text-black" },
              { r: "Microsoft", fond: "bg-[#2f70c9] text-white" },
              { r: "Apple", fond: "bg-black text-white" },
            ].map((s) => (
              <button
                key={s.r}
                type="button"
                aria-label={`Continuer avec ${s.r}`}
                onClick={() => alert(`OAuth ${s.r} sera opérationnel avec l'intégration Supabase.`)}
                className={cn(
                  "flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 font-bold text-lg transition hover:scale-105",
                  s.fond
                )}
              >
                {s.r[0]}
              </button>
            ))}
          </div>
          <p className="mt-6 text-xs text-[#f8ecc9]/60">
            Pas encore de compte ?{" "}
            <a href="#" className="text-[#d6b66f] underline-offset-2 hover:underline">
              Contactez le support
            </a>
          </p>
        </div>
      </section>

      {/* Colonne photo garage (droite) — scène CSS en attendant la photo réelle */}
      <section aria-hidden className="relative hidden flex-1 lg:block">
        <SceneGarage />
      </section>
    </main>
  );
}

function SceneGarage() {
  const basePath = process.env.NEXT_PUBLIC_SITE_BASE_PATH ?? "";
  return (
    <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url('${basePath}/images/garage-hero.jpg')` }}>
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(90deg, rgba(16,43,50,.86), rgba(16,43,50,.2)), linear-gradient(180deg, rgba(16,43,50,.15), rgba(8,25,30,.72))",
        }}
      />
      <div
        className="absolute top-1/3 right-0 h-[34rem] w-[26rem] blur-3xl opacity-30"
        style={{ background: "radial-gradient(circle,#d6b66f,transparent 70%)" }}
      />
      <div className="absolute inset-x-0 bottom-0 h-40 opacity-25"
        style={{ background: "linear-gradient(0deg,rgba(214,182,111,.3),transparent)" }} />
    </div>
  );
}
