"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase-browser";

export default function MotDePasseOubliePage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [succès, setSuccès] = useState(false);
  const [enCours, setEnCours] = useState(false);

  async function envoyer(e: FormEvent) {
    e.preventDefault();
    setErreur(null);
    setSuccès(false);
    setEnCours(true);

    if (!supabase) {
      setErreur("Supabase n’est pas configuré. Ajoutez les variables publiques dans .env.local.");
      setEnCours(false);
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      {
        // URL de redirection vers la page de traitement
        // Doit matcher les Redirect URLs configurées dans Supabase Dashboard
        // En développement : http://localhost:3000/mot-de-passe-traite?reset=1
        // En production : configurer dans Supabase Dashboard l'URL de l'application
        // Ne jamais utiliser NEXT_PUBLIC_SUPABASE_URL comme origine application
        redirectTo: `${window.location.origin}/mot-de-passe-traite?reset=1`,
      }
    );

    setEnCours(false);

    if (error) {
      // Gestion claire des erreurs dont rate limit
      setErreur(
        error.message === "email rate limit exceeded"
          ? "Limite d'envoi d'emails atteinte. Veuillez patienter 24h avant de réessayer."
          : error.message
      );
      return;
    }

    setSuccès(true);
    // L'email est en cours d'envoi, l'utilisateur sera notifié
  }

  return (
    <div className="max-w-md mx-auto p-8">
      {enCours && (
        <div className="bg-orange-100 border-orange-400 text-orange-700 p-4 rounded-md mb-6">
          <p>Envoi de l&apos;email en cours...</p>
        </div>
      )}
      {succès && (
        <div className="bg-green-100 border-green-400 text-green-700 p-4 rounded-md mb-6">
          <p>
            Un email de récupération a été envoyé. Veuillez vérifier votre boîte de
            réception (et les spams).
          </p>
          <p>
            Après réception, vous serez redirigé vers la page de définition du nouveau
            mot de passe.
          </p>
        </div>
      )}
      {erreur && (
        <div className="bg-red-100 border-red-400 text-red-700 p-4 rounded-md mb-6">
          <p>{erreur}</p>
        </div>
      )}
      {!succès && !erreur && !enCours && (
        <form onSubmit={envoyer} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Email de connexion
            </label>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="champ"
              placeholder="admin@auto-dyali.ma"
              autoComplete="username"
            />
          </div>
          <button
            type="submit"
            className="btn-or"
            disabled={enCours}
          >
            Envoyer le lien de récupération
          </button>
        </form>
      )}
    </div>
  );
}