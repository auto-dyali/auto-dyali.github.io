"use client";

import { useState, useEffect, type FormEvent } from "react";
import { supabase } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";

export default function MotDePasseTraitePage({ searchParams }: { searchParams: { reset?: string } }) {
  const router = useRouter();
  const resetToken = searchParams?.reset;

  const [nouveauMotDePasse, setNouveauMotDePasse] = useState("");
  const [confirmMotDePasse, setConfirmMotDePasse] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [succès, setSuccès] = useState(false);
  const [enCours, setEnCours] = useState(false);

  // Vérifier que le token de récupération est présent
  useEffect(() => {
    if (!resetToken) {
      router.replace("/connexion/");
    }
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

    try {
      if (!supabase) {
        setErreur("Supabase n’est pas configuré.");
        setEnCours(false);
        return;
      }
      // Mise à jour du mot de passe via l'Auth Supabase
      const { error } = await supabase.auth.updateUser({
        password: nouveauMotDePasse,
      });

      if (error) {
        setErreur(error.message);
        setEnCours(false);
        return;
      }

      setSuccès(true);
      // Après mise à jour réussie, déconnexion automatique et retour à la connexion
      await supabase.auth.signOut();
      router.replace("/connexion/");
    } catch (err) {
      setErreur("Une erreur est survenue. Veuillez réessayer plus tard.");
      setEnCours(false);
    }
  }

  return (
    <div className="max-w-md mx-auto p-8">
      {succès && (
        <div className="bg-green-100 border-green-400 text-green-700 p-4 rounded-md mb-6">
          <p>
            Votre mot de passe a été mis à jour avec succès. Vous pouvez maintenant vous
            connecter.
          </p>
        </div>
      )}
      {erreur && (
        <div className="bg-red-100 border-red-400 text-red-700 p-4 rounded-md mb-6">
          <p>{erreur}</p>
        </div>
      )}
      {!succès && !erreur && !enCours && resetToken && (
        <form onSubmit={motDePasseValide} className="space-y-4">
          <input
            type="password"
            required
            minLength={6}
            placeholder="Nouveau mot de passe"
            value={nouveauMotDePasse}
            onChange={(e) => setNouveauMotDePasse(e.target.value)}
            className="champ"
          />
          <div className="flex items-center gap-2">
            <input
              type="password"
              required
              minLength={6}
              placeholder="Confirmer mot de passe"
              value={confirmMotDePasse}
              onChange={(e) => setConfirmMotDePasse(e.target.value)}
              className="champ"
            />
          </div>
          <button type="submit" className="btn-or" disabled={enCours}>
            Définir le nouveau mot de passe
          </button>
        </form>
      )}
      {!succès && !erreur && !enCours && !resetToken && (
        <>
          <p>Lien de récupération invalide ou expiré.</p>
          <a href="/connexion/" className="text-[#8FB59B] hover:underline">Retour à la connexion</a>
        </>
      )}
    </div>
  );
}