"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/logo";
import { supabase } from "@/lib/supabase-browser";
import { classerErreur } from "@/lib/supabase-errors";

/**
 * Écran de connexion AUTO DYALI.
 *
 * Accepte un e-mail OU un identifiant de connexion Manager (résolu côté
 * serveur par `resolve_login_email`, migration 0039 — Supabase Auth reste
 * l'autorité d'authentification). Si le compte porte encore le mot de passe
 * temporaire (`must_change_password`), l'utilisateur est redirigé vers
 * `/changer-mot-de-passe/` avant tout accès aux données.
 */
export default function ConnexionPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [motPasse, setMotPasse] = useState("");
  const [seSouvenir, setSeSouvenir] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [motPasseVisible, setMotPasseVisible] = useState(false);

  async function soumettre(e: FormEvent) {
    e.preventDefault();
    setErreur(null);

    const identifiant = email.trim();
    if (!identifiant) {
      setErreur("Veuillez saisir votre e-mail ou identifiant.");
      return;
    }
    if (motPasse.length < 6) {
      setErreur("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }

    if (!supabase) {
      setErreur("Supabase n’est pas configuré. Ajoutez les variables publiques dans .env.local.");
      return;
    }

    setEnCours(true);

    // Résolution identifiant → e-mail (uniquement si aucun « @ »).
    let emailAuth = identifiant;
    if (!identifiant.includes("@")) {
      const { data, error } = await supabase.rpc("resolve_login_email", { p_login: identifiant });
      if (error) {
        setEnCours(false);
        const c = classerErreur(error);
        setErreur(
          /could not find the function|PGRST202/i.test(error.message)
            ? "Connexion par identifiant indisponible : migration 0039 non appliquée. Utilisez votre e-mail."
            : c.message,
        );
        return;
      }
      if (!data || typeof data !== "string") {
        setEnCours(false);
        setErreur("Identifiant ou mot de passe incorrect.");
        return;
      }
      emailAuth = data;
    }

    const { error } = await supabase.auth.signInWithPassword({ email: emailAuth, password: motPasse });
    if (error) {
      setEnCours(false);
      setErreur(classerErreur(error).message);
      return;
    }
    if (seSouvenir) localStorage.setItem("autodyali_remember", "1");

    const { data: profileRows, error: profileError } = await supabase.rpc("get_my_profile");
    const profile = profileRows?.[0];

    if (profileError || !profile) {
      setEnCours(false);
      if (profileError) {
        const c = classerErreur(profileError);
        // Une panne réseau/serveur ne doit pas déconnecter l'utilisateur :
        // la session reste valide, seul le chargement du profil a échoué.
        if (c.famille === "reseau" || c.famille === "serveur" || c.famille === "inconnue") {
          setErreur(c.message);
          return;
        }
        setErreur(c.message);
      } else {
        setErreur("Votre profil n’est pas encore configuré. Demandez à l’administrateur de vous associer à un établissement.");
      }
      await supabase.auth.signOut();
      return;
    }

    // Rotation obligatoire du mot de passe temporaire.
    const { data: etatSecurite } = await supabase.rpc("get_my_security_state");
    setEnCours(false);
    if (etatSecurite && (etatSecurite as { must_change_password?: boolean }).must_change_password === true) {
      router.replace("/changer-mot-de-passe/");
      return;
    }

    if (profile.role === "saas_admin") {
      router.replace("/super-admin/");
    } else if (profile.role === "manager") {
      router.replace("/tableau-de-bord/");
    } else if (profile.role === "employee") {
      router.replace("/employe/");
    } else if (profile.role === "client") {
      await supabase.auth.signOut();
      setErreur("Ce compte n'a pas accès à l'espace professionnel AUTO DYALI. Contactez votre administrateur.");
    } else {
      await supabase.auth.signOut();
      setErreur("Ce compte n'a pas encore accès à un espace AUTO DYALI.");
    }
  }

  const basePath = process.env.NEXT_PUBLIC_SITE_BASE_PATH ?? "";

  return (
    <main className="relative flex min-h-screen items-stretch overflow-hidden bg-[#101f1a]">
      {/* Scène garage plein écran (image ajustée : logo mural entier visible) */}
      <picture className="absolute inset-0 block">
        <source media="(max-width: 768px)" srcSet={`${basePath}/images/backgrounds/connexion-mobile.webp`} />
        <img
          src={`${basePath}/images/backgrounds/connexion.webp`}
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-left-top"
        />
      </picture>
      {/* Voile discret pour la lisibilité de la carte */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(10,22,18,.22) 0%, rgba(10,22,18,.10) 45%, rgba(8,18,14,.55) 100%), linear-gradient(90deg, rgba(10,22,18,.35), rgba(10,22,18,0) 55%)",
        }}
      />

      {/* Carte verre dépoli — positionnée à droite comme la maquette */}
      <section className="relative z-10 flex min-h-screen w-full items-center justify-center px-4 py-10 sm:px-8 lg:justify-end lg:pr-[7%] xl:pr-[10%]">
        <div className="panneau-connexion apparaitre w-full max-w-md rounded-[1.75rem] p-6 sm:p-7">
          <div className="flex justify-center pb-2">
            <Logo />
          </div>

          <p className="text-center text-[13px] font-medium tracking-[0.16em] text-[#DFE7E2]/85">
            Votre partenaire automobile de confiance
          </p>
          <h1 className="titre-or mt-2 text-center text-2xl font-extrabold sm:text-3xl">
            Bienvenue !
          </h1>
          <p className="mt-1 text-center text-sm text-[#A7B7A8]">
            Connectez-vous pour accéder à votre espace
          </p>

          <form className="mt-5 flex flex-col gap-3" onSubmit={soumettre} noValidate>
            <div className="relative">
              <svg aria-hidden viewBox="0 0 20 20" className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2">
                <circle cx="10" cy="6.6" r="3.1" fill="none" stroke="#DFE7E2" strokeWidth="1.6" />
                <path d="M3.6 16.4c.9-2.7 3.4-4.2 6.4-4.2s5.5 1.5 6.4 4.2" fill="none" stroke="#DFE7E2" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
              <input
                style={{ paddingLeft: "2.7rem" }}
                className="champ champ-3d text-base"
                type="text"
                autoComplete="username"
                placeholder="Identifiant ou email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="relative">
              <svg aria-hidden viewBox="0 0 20 20" className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2">
                <rect x="4.5" y="9" width="11" height="7" rx="1.8" fill="none" stroke="#DFE7E2" strokeWidth="1.6" />
                <path d="M7 9V7a3 3 0 0 1 6 0v2" fill="none" stroke="#DFE7E2" strokeWidth="1.6" strokeLinecap="round" />
                <circle cx="10" cy="12.5" r="1.2" fill="#DFE7E2" />
              </svg>
              <input
                style={{ paddingLeft: "2.7rem", paddingRight: "2.9rem" }}
                className="champ champ-3d text-base"
                type={motPasseVisible ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Mot de passe"
                value={motPasse}
                onChange={(e) => setMotPasse(e.target.value)}
              />
              <button
                type="button"
                aria-label={motPasseVisible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                aria-pressed={motPasseVisible}
                onClick={() => setMotPasseVisible((visible) => !visible)}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-[#DFE7E2]/75 hover:bg-white/10 hover:text-[#8FB59B]"
              >
                <svg viewBox="0 0 20 20" width="19" height="19" aria-hidden>
                  {motPasseVisible ? <path d="M3 3l14 14M8.5 5.1A8.7 8.7 0 0 1 10 5c4.7 0 7.2 5 7.2 5a13 13 0 0 1-2.1 2.7M5.1 7.1C3.7 8.2 2.8 10 2.8 10s2.5 5 7.2 5c.8 0 1.5-.1 2.1-.4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /> : <><path d="M2.8 10s2.5-4 7.2-4 7.2 4 7.2 4-2.5 4-7.2 4-7.2-4-7.2-4Z" fill="none" stroke="currentColor" strokeWidth="1.5" /><circle cx="10" cy="10" r="1.8" fill="none" stroke="currentColor" strokeWidth="1.5" /></>}
                </svg>
              </button>
            </div>

            {erreur && (
              <p role="alert" className="rounded-lg bg-[#C5716B]/15 px-3 py-2 text-sm text-[#C5716B]">
                {erreur}
              </p>
            )}

            <div className="flex items-center justify-between text-xs">
              <label className="flex cursor-pointer items-center gap-2 text-[#DFE7E2]/85">
                <input
                  type="checkbox"
                  checked={seSouvenir}
                  onChange={(e) => setSeSouvenir(e.target.checked)}
                  className="h-4 w-4 accent-[#8FB59B]"
                />
                Se souvenir de moi
              </label>
              <a href="/mot-de-passe-oublie/" className="text-[#8FB59B] underline underline-offset-2">
                Mot de passe oublié ?
              </a>
            </div>

            <button
              type="submit"
              className="btn-or btn-or-3d mt-2 flex w-full items-center justify-center gap-2 py-3.5 text-base tracking-wide"
              disabled={enCours}
            >
              {!enCours && (
                <svg aria-hidden viewBox="0 0 20 20" className="h-[18px] w-[18px]">
                  <path d="M3 10h10m0 0-4.2-4.2M13 10l-4.2 4.2" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
              {enCours ? "Connexion…" : "Se connecter"}
            </button>
          </form>

          {/* Séparateur */}
          <div className="mt-5 flex items-center gap-3 text-xs text-[#A7B7A8]">
            <span className="h-px flex-1 bg-white/15" />
            <span>pas encore abonné ?</span>
            <span className="h-px flex-1 bg-white/15" />
          </div>

          {/* Deux appels à l'action : principal émeraude, secondaire or champagne 3D */}
          <div className="mt-3 grid gap-2 text-center text-sm sm:grid-cols-1">
            <Link
              href="/pre-achat/"
              className="sa3d-btn flex w-full items-center justify-center gap-2"
              aria-label="Demander une souscription AUTO DYALI"
            >
              <svg aria-hidden viewBox="0 0 20 20" className="h-[17px] w-[17px]">
                <path d="M10 3v14M3 10h14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              Demander une souscription
            </Link>
            <Link href="/offres/" className="px-4 py-1.5 text-xs text-[#A7B7A8] underline underline-offset-2 hover:text-[#D0C6AE]">
              Comparer les offres AUTO DYALI
            </Link>
          </div>

          {/* Signature marque */}
          <footer className="mt-4 text-center">
            <p className="text-sm font-extrabold tracking-[0.22em] text-[#DFE7E2]">AUTO DYALI</p>
            <p className="mt-0.5 text-[11px] tracking-[0.14em] text-[#A7B7A8]">
              Performance • Innovation • Confiance
            </p>
          </footer>
        </div>
      </section>
    </main>
  );
}
