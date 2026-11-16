"use client";

/**
 * AUTO DYALI — Activation d'un compte Manager via invitation sécurisée.
 *
 * Parcours :
 *  1. Le Super Admin crée une invitation (jeton généré côté base).
 *  2. Le manager reçoit le lien /activer/[token] par e-mail et/ou WhatsApp.
 *  3. Cette page valide le jeton via RPC admin_accept_invitation().
 *  4. Le manager définit son propre mot de passe (jamais transmis en clair).
 *  5. Le compte Auth est créé, le profil est associé à l'établissement.
 *  6. Redirection vers la connexion.
 *
 * Sécurité :
 *  - Aucun mot de passe dans l'URL ni dans les journaux.
 *  - Jeton à usage unique, expiré après 7 jours.
 *  - L'invitation ne peut être acceptée qu'une seule fois.
 *  - Si le jeton est invalide ou expiré, message clair sans révéler de détail.
 */

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase-browser";
import { Logo } from "@/components/logo";

type Etat = "chargement" | "valide" | "invalide" | "expiree" | "erreur" | "succes";

interface InvitationValide {
  invitation_id: string;
  establishment_id: string;
  email: string;
}

export default function ActiverPage({ searchParams }: { searchParams: { [key: string]: string | string[] | undefined } }) {
  const rawToken = searchParams.token;
  const token = Array.isArray(rawToken) ? rawToken[0] : rawToken ?? "";
  const router = useRouter();

  const [etat, setEtat] = useState<Etat>("chargement");
  const [invitation, setInvitation] = useState<InvitationValide | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [typeMessage, setTypeMessage] = useState<"info" | "erreur" | "succes">("info");

  const [motDePasse, setMotDePasse] = useState("");
  const [motDePasseConfirm, setMotDePasseConfirm] = useState("");
  const [enCours, setEnCours] = useState(false);

  // ------------------------------------------------------------------
  // 1. Valider le jeton d'activation au chargement de la page
  // ------------------------------------------------------------------
  useEffect(() => {
    let vivant = true;

    async function validerJeton() {
      if (!supabase) {
        if (vivant) setEtat("erreur");
        return;
      }
      if (!token) {
        if (vivant) setEtat("invalide");
        return;
      }

      try {
        const { data, error } = await supabase.rpc("admin_accept_invitation", {
          p_token: token,
          p_password_hash: "",
        });

        if (error) {
          const msg = error.message || "";
          if (/expiree/i.test(msg)) {
            if (vivant) setEtat("expiree");
          } else if (/invalide|inconnu|deja traitee/i.test(msg)) {
            if (vivant) setEtat("invalide");
          } else {
            if (vivant) setEtat("erreur");
          }
          if (vivant) setMessage(msg);
          return;
        }

        if (data && data.status === "acceptee") {
          if (vivant) {
            setEtat("valide");
            setInvitation({
              invitation_id: String(data.invitation_id ?? ""),
              establishment_id: String(data.establishment_id ?? ""),
              email: String(data.email ?? ""),
            });
          }
        } else {
          if (vivant) setEtat("invalide");
        }
      } catch (err) {
        if (vivant) setEtat("erreur");
        if (vivant) setMessage(err instanceof Error ? err.message : "Erreur inattendue.");
      }
    }

    void validerJeton();
    return () => { vivant = false; };
  }, [token]);

  // ------------------------------------------------------------------
  // 2. Définir le mot de passe du manager
  // ------------------------------------------------------------------
  async function definirMotDePasse(e: FormEvent) {
    e.preventDefault();
    setMessage(null);

    if (!invitation) {
      setMessage("Aucune invitation valide.");
      setTypeMessage("erreur");
      return;
    }
    if (!supabase) {
      setMessage("Supabase non configure.");
      setTypeMessage("erreur");
      return;
    }
    if (motDePasse.length < 8) {
      setMessage("Le mot de passe doit contenir au moins 8 caracteres.");
      setTypeMessage("erreur");
      return;
    }
    if (motDePasse !== motDePasseConfirm) {
      setMessage("Les mots de passe ne correspondent pas.");
      setTypeMessage("erreur");
      return;
    }

    setEnCours(true);
    try {
      const { error: signUpError } = await supabase.auth.signUp({
        email: invitation.email,
        password: motDePasse,
        options: {
          data: {
            full_name: "",
          },
        },
      });

      if (signUpError) throw signUpError;

      setEtat("succes");
      setTypeMessage("succes");
      setMessage("Votre compte a ete active. Vous pouvez maintenant vous connecter avec votre email et votre mot de passe.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Impossible d'activer le compte.");
      setTypeMessage("erreur");
    } finally {
      setEnCours(false);
    }
  }

  // ------------------------------------------------------------------
  // Rendu selon l'etat
  // ------------------------------------------------------------------
  if (etat === "chargement") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#252D2D] p-6 text-center">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#344440]">
            <span className="text-[10px] text-[#A7B7A8]">…</span>
          </div>
          <p className="text-sm text-[#A7B7A8]">Verification de l&apos;invitation…</p>
        </div>
      </main>
    );
  }

  if (etat === "expiree") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-[#252D2D] p-6 text-center">
        <div className="carte max-w-md p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#C5716B]/15">
            <span className="text-[#C5716B] text-2xl">⏰</span>
          </div>
          <h1 className="titre-or mt-4 text-2xl font-extrabold">Invitation expirée</h1>
          <p className="mt-3 text-sm leading-6 text-[#A7B7A8]">
            Ce lien d&apos;activation n&apos;est plus valide (delai de 7 jours depasse).
          </p>
          {message && <p className="mt-3 text-xs text-[#A7B7A8]">{message}</p>}
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/connexion/"
              className="rounded-lg border border-[#8FB59B]/40 px-4 py-2 text-sm text-[#DFE7E2] hover:bg-[#344440]"
            >
              Se connecter
            </Link>
            <button
              type="button"
              onClick={() => router.replace("/connexion/mot-de-passe-oublie/")}
              className="rounded-lg border border-[#D6A34D]/40 px-4 py-2 text-sm text-[#D6A34D] hover:bg-[#344440]/10"
            >
              Demander un nouveau lien
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (etat === "invalide") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-[#252D2D] p-6 text-center">
        <div className="carte max-w-md p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#C5716B]/15">
            <span className="text-[#C5716B] text-2xl">⚠️</span>
          </div>
          <h1 className="titre-or mt-4 text-2xl font-extrabold">Lien invalide</h1>
          <p className="mt-3 text-sm leading-6 text-[#A7B7A8]">
            Ce lien d&apos;activation est invalide, a deja ete utilise ou n&apos;existe pas.
          </p>
          {message && <p className="mt-3 text-xs text-[#A7B7A8]">{message}</p>}
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/connexion/"
              className="rounded-lg border border-[#8FB59B]/40 px-4 py-2 text-sm text-[#DFE7E2] hover:bg-[#344440]"
            >
              Se connecter
            </Link>
            <button
              type="button"
              onClick={() => router.replace("/connexion/mot-de-passe-oublie/")}
              className="rounded-lg border border-[#D6A34D]/40 px-4 py-2 text-sm text-[#D6A34D] hover:bg-[#344440]/10"
            >
              Demander un nouveau lien
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (etat === "erreur") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-[#252D2D] p-6 text-center">
        <div className="carte max-w-md p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#C5716B]/15">
            <span className="text-[#C5716B] text-2xl">❌</span>
          </div>
          <h1 className="titre-or mt-4 text-2xl font-extrabold">Erreur de verification</h1>
          <p className="mt-3 text-sm leading-6 text-[#A7B7A8]">
            Impossible de verifier cette invitation. Veuillez reessayer ou contacter le support.
          </p>
          {message && <p className="mt-3 text-xs text-[#A7B7A8]">{message}</p>}
          <div className="mt-8 flex justify-center">
            <Link
              href="/connexion/"
              className="rounded-lg border border-[#8FB59B]/40 px-4 py-2 text-sm text-[#DFE7E2] hover:bg-[#344440]"
            >
              Revenir a la connexion
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (etat === "succes") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-[#252D2D] p-6 text-center">
        <div className="carte max-w-md p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#5D9E7F]/15">
            <span className="text-[#5D9E7F] text-2xl">✅</span>
          </div>
          <h1 className="titre-or mt-4 text-2xl font-extrabold">Compte active</h1>
          <p className="mt-3 text-sm leading-6 text-[#A7B7A8]">
            {message ?? "Votre compte Manager est maintenant active."}
          </p>
          <div className="mt-8 flex justify-center">
            <Link href="/connexion/" className="btn-or px-6 py-2 text-sm">
              Se connecter
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // etat === "valide" -> affichage du formulaire de mot de passe
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#252D2D] p-6 sm:p-10">
      <div className="carte max-w-md w-full p-8 sm:p-10">
        <div className="flex justify-center mb-4">
          <Logo compact />
        </div>
        <h1 className="titre-or text-center text-2xl font-extrabold mb-1">
          Definir votre mot de passe
        </h1>
        <p className="text-center text-sm text-[#A7B7A8] mb-6">
          Choisissez un mot de passe pour votre compte Manager de l&apos;etablissement.
          Ce mot de passe ne sera jamais transmis par e-mail ni par WhatsApp.
        </p>

        {invitation && (
          <div className="mb-6 p-4 rounded-lg bg-[#344440]/30 border border-[#8FB59B]/20">
            <p className="text-xs uppercase tracking-[0.15em] text-[#A7B7A8] mb-1">
              Compte a activer
            </p>
            <p className="text-sm font-semibold text-[#E8ECE8]">{invitation.email}</p>
            <p className="text-[11px] text-[#A7B7A8]">
              Etablissement : {invitation.establishment_id}
            </p>
          </div>
        )}

        <form onSubmit={definirMotDePasse} className="space-y-4">
          <div>
            <label className="block text-xs text-[#A7B7A8] mb-1">Nouveau mot de passe *</label>
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={motDePasse}
              onChange={(e) => setMotDePasse(e.target.value)}
              className="champ mt-1 min-h-11 w-full"
              placeholder="Au moins 8 caracteres"
            />
          </div>
          <div>
            <label className="block text-xs text-[#A7B7A8] mb-1">Confirmer le mot de passe *</label>
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={motDePasseConfirm}
              onChange={(e) => setMotDePasseConfirm(e.target.value)}
              className="champ mt-1 min-h-11 w-full"
              placeholder="Confirmez le mot de passe"
            />
          </div>

          {typeMessage === "erreur" && message && (
            <p className="text-xs text-[#C5716B]">{message}</p>
          )}
          {typeMessage === "succes" && message && (
            <p className="text-xs text-[#5D9E7F]">{message}</p>
          )}

          <button
            type="submit"
            disabled={enCours || !invitation}
            className={`w-full btn-or px-6 py-2 text-sm disabled:opacity-40 ${enCours ? "opacity-70" : ""}`}
          >
            {enCours ? "Activation…" : "Activer mon compte"}
          </button>

          <div className="mt-6 text-center">
            <p className="text-[11px] text-[#A7B7A8]">
              Vous avez deja un mot de passe ?
              <Link href="/connexion/" className="text-[#8FB59B] hover:underline ml-1">
                Connectez-vous
              </Link>
            </p>
          </div>
        </form>
      </div>
    </main>
  );
}
