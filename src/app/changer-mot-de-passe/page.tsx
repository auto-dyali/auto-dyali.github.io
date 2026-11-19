"use client";

/**
 * AUTO DYALI — Changement obligatoire du mot de passe temporaire.
 *
 * Le Super Admin crée le Manager avec un mot de passe temporaire
 * (`auth.admin.createUser`) et `profiles.must_change_password = true`.
 * Tant que ce drapeau est vrai, les politiques RLS restrictives (migration
 * 0039) bloquent l'accès aux données de l'établissement.
 *
 * Cette page :
 *   1. vérifie la session et l'état de sécurité serveur ;
 *   2. change le mot de passe via `supabase.auth.updateUser` (jamais stocké
 *      en clair côté application) ;
 *   3. appelle `admin_complete_password_change()` qui vérifie la preuve
 *      `auth.users.updated_at > temporary_password_issued_at` avant de lever
 *      le drapeau ;
 *   4. redirige vers l'espace correspondant au rôle.
 */

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase-browser";
import { Logo } from "@/components/logo";
import { ACTIVATION_MIN_PASSWORD_LENGTH, validatePasswordPair } from "@/lib/activation";

type EtatSecurite = {
  role?: string;
  login_id?: string | null;
  must_change_password?: boolean;
  temporary_password_expires_at?: string | null;
  password_changed_at?: string | null;
};

export default function ChangerMotDePassePage() {
  const router = useRouter();
  const [chargement, setChargement] = useState(true);
  const [etat, setEtat] = useState<EtatSecurite | null>(null);
  const [motDePasse, setMotDePasse] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    let vivant = true;
    void (async () => {
      if (!supabase) {
        if (vivant) setChargement(false);
        return;
      }
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        router.replace("/connexion/");
        return;
      }
      const { data, error } = await supabase.rpc("get_my_security_state");
      if (!vivant) return;
      if (error) {
        setMessage(
          /could not find the function|PGRST202/i.test(error.message)
            ? "État de sécurité indisponible : migration 0039 non appliquée."
            : `Lecture de l'état de sécurité impossible : ${error.message}`,
        );
      } else {
        setEtat((data ?? null) as EtatSecurite | null);
      }
      setChargement(false);
    })();
    return () => {
      vivant = false;
    };
  }, [router]);

  async function changer(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    setSucces(null);
    if (!supabase) {
      setMessage("Supabase n'est pas configuré.");
      return;
    }
    const invalid = validatePasswordPair(motDePasse, confirmation);
    if (invalid) {
      setMessage(invalid);
      return;
    }
    if (enCours) return;

    setEnCours(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password: motDePasse });
      if (updateError) {
        setMessage(updateError.message);
        return;
      }

      const { error: rpcError } = await supabase.rpc("admin_complete_password_change");
      if (rpcError) {
        setMessage(
          `Mot de passe modifié, mais la levée du blocage a échoué : ${rpcError.message}. Contactez le support.`,
        );
        return;
      }

      setSucces("Votre mot de passe a été modifié. Redirection vers votre espace…");
      const { data: profileRows } = await supabase.rpc("get_my_profile");
      const role = (profileRows?.[0] as { role?: string } | undefined)?.role;
      const destination =
        role === "saas_admin"
          ? "/super-admin/"
          : role === "manager"
            ? "/tableau-de-bord/"
            : role === "employee"
              ? "/employe/"
              : "/connexion/";
      router.replace(destination);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Changement de mot de passe impossible.");
    } finally {
      setEnCours(false);
    }
  }

  if (chargement) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#252D2D] p-6">
        <p className="text-sm text-[#A7B7A8]">Vérification de votre compte…</p>
      </main>
    );
  }

  const doitChanger = etat?.must_change_password === true;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#252D2D] p-6 sm:p-10">
      <div className="carte max-w-md w-full p-8 sm:p-10">
        <div className="flex justify-center mb-4">
          <Logo compact />
        </div>
        <h1 className="titre-or text-center text-2xl font-extrabold mb-1">
          Mot de passe temporaire
        </h1>
        <p className="text-center text-sm text-[#A7B7A8] mb-6">
          {doitChanger
            ? "Votre compte a été créé avec un mot de passe temporaire. Choisissez un mot de passe personnel avant d'accéder à vos données."
            : "Aucun changement obligatoire n'est requis pour ce compte."}
        </p>

        {etat?.login_id && (
          <p className="mb-4 text-center text-xs text-[#A7B7A8]">
            Identifiant : <span className="font-mono text-[#E8ECE8]">{etat.login_id}</span>
          </p>
        )}

        {!doitChanger ? (
          <div className="space-y-4 text-center">
            <p className="text-sm text-[#A7B7A8]">
              Vous pouvez continuer vers votre espace ou vous déconnecter.
            </p>
            <div className="flex flex-col gap-2">
              <Link href="/tableau-de-bord/" className="btn-or px-4 py-2 text-sm">Mon espace</Link>
              <button
                type="button"
                onClick={async () => {
                  await supabase?.auth.signOut();
                  router.replace("/connexion/");
                }}
                className="rounded-lg border border-[#8FB59B]/40 px-4 py-2 text-sm text-[#DFE7E2] hover:bg-[#344440]"
              >
                Se déconnecter
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={changer} className="space-y-4">
            <div>
              <label className="block text-xs text-[#A7B7A8] mb-1">Nouveau mot de passe *</label>
              <input
                type="password"
                required
                minLength={ACTIVATION_MIN_PASSWORD_LENGTH}
                autoComplete="new-password"
                value={motDePasse}
                onChange={(e) => setMotDePasse(e.target.value)}
                className="champ mt-1 min-h-11 w-full"
                placeholder={`Au moins ${ACTIVATION_MIN_PASSWORD_LENGTH} caractères`}
              />
            </div>
            <div>
              <label className="block text-xs text-[#A7B7A8] mb-1">Confirmer *</label>
              <input
                type="password"
                required
                minLength={ACTIVATION_MIN_PASSWORD_LENGTH}
                autoComplete="new-password"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                className="champ mt-1 min-h-11 w-full"
                placeholder="Confirmer le mot de passe"
              />
            </div>

            {message && <p className="text-xs text-[#C5716B]">{message}</p>}
            {succes && <p className="text-xs text-[#5D9E7F]">{succes}</p>}

            <button type="submit" disabled={enCours} className="w-full btn-or px-6 py-2 text-sm disabled:opacity-40">
              {enCours ? "Enregistrement…" : "Changer mon mot de passe"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
