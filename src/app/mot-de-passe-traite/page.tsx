"use client";

/**
 * AUTO DYALI — Définition du nouveau mot de passe après récupération.
 *
 * Next.js 16 : `searchParams` est une Promise côté serveur. Cette page est un
 * composant client : elle lit donc les paramètres via `useSearchParams()`.
 * `useSearchParams()` exige une frontière <Suspense> lors du prérendu, d'où
 * l'enveloppe ci-dessous.
 */

import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase-browser";
import { Logo } from "@/components/logo";

function FormulaireNouveauMotDePasse() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const resetToken = searchParams.get("reset");

  const [nouveauMotDePasse, setNouveauMotDePasse] = useState("");
  const [confirmMotDePasse, setConfirmMotDePasse] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState(false);
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    if (!resetToken) router.replace("/connexion/");
  }, [resetToken, router]);

  async function motDePasseValide(e: FormEvent) {
    e.preventDefault();
    setErreur(null);
    setEnCours(true);

    if (nouveauMotDePasse.length < 6) {
      setErreur("Le mot de passe doit contenir au moins 6 caractères.");
      setEnCours(false);
      return;
    }
    if (nouveauMotDePasse !== confirmMotDePasse) {
      setErreur("Les mots de passe ne correspondent pas.");
      setEnCours(false);
      return;
    }
    if (!supabase) {
      setErreur("Supabase n'est pas configuré.");
      setEnCours(false);
      return;
    }

    try {
      // La session de récupération est établie automatiquement par le client
      // Supabase à partir du lien reçu par e-mail.
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        setErreur("Lien de récupération invalide ou expiré. Demandez un nouveau lien.");
        setEnCours(false);
        return;
      }
      const { error } = await supabase.auth.updateUser({ password: nouveauMotDePasse });
      if (error) {
        setErreur(error.message);
        setEnCours(false);
        return;
      }
      setSucces(true);
      await supabase.auth.signOut();
      router.replace("/connexion/");
    } catch {
      setErreur("Une erreur est survenue. Veuillez réessayer plus tard.");
      setEnCours(false);
    }
  }

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-[#0d1a13] px-4 py-10">
      <div className="carte-premium w-full max-w-md p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <Logo compact />
          <div>
            <p className="text-[0.65rem] uppercase tracking-[0.2em] text-[#A7B7A8]">AUTO DYALI</p>
            <h1 className="titre-or text-xl font-extrabold">Nouveau mot de passe</h1>
          </div>
        </div>

        {succes && (
          <p role="status" className="mt-5 rounded-xl bg-[#5D9E7F]/15 px-4 py-3 text-sm text-[#7FBF9E]">
            Mot de passe mis à jour. Redirection vers la connexion…
          </p>
        )}
        {erreur && (
          <p role="alert" className="mt-5 rounded-xl bg-[#C5716B]/15 px-4 py-3 text-sm text-[#E5A19C]">
            {erreur}
          </p>
        )}

        {!succes && !erreur && resetToken && (
          <form onSubmit={motDePasseValide} className="mt-5 grid gap-3">
            <label className="grid gap-1 text-xs text-[#A7B7A8]">
              Nouveau mot de passe
              <input
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                placeholder="Au moins 6 caractères"
                value={nouveauMotDePasse}
                onChange={(e) => setNouveauMotDePasse(e.target.value)}
                className="champ min-h-11"
              />
            </label>
            <label className="grid gap-1 text-xs text-[#A7B7A8]">
              Confirmer le mot de passe
              <input
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                placeholder="Répétez le mot de passe"
                value={confirmMotDePasse}
                onChange={(e) => setConfirmMotDePasse(e.target.value)}
                className="champ min-h-11"
              />
            </label>
            <button type="submit" className="btn-or min-h-11" disabled={enCours}>
              {enCours ? "Enregistrement…" : "Définir le nouveau mot de passe"}
            </button>
          </form>
        )}

        {!succes && !erreur && !resetToken && (
          <div className="mt-5 text-sm text-[#A7B7A8]">
            <p>Lien de récupération invalide ou expiré.</p>
            <Link href="/mot-de-passe-oublie/" className="mt-3 inline-block text-[#8FB59B] underline">
              Demander un nouveau lien
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}

export default function MotDePasseTraitePage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-[100dvh] items-center justify-center bg-[#0d1a13] px-4">
          <p className="text-sm text-[#A7B7A8]">Chargement…</p>
        </main>
      }
    >
      <FormulaireNouveauMotDePasse />
    </Suspense>
  );
}
