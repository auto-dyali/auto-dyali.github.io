"use client";

/**
 * AUTO DYALI — Activation d'un compte Manager via invitation sécurisée.
 *
 * Parcours réel (GV5 §51) :
 *  1. Le Super Admin crée l'abonné ; l'Edge Function `onboard-tenant` crée le
 *     compte Auth et une invitation dont SEULE l'empreinte SHA-256 est stockée.
 *  2. Le Manager reçoit un lien `/activer/?token=…` par e-mail et/ou WhatsApp.
 *  3. Cette page PRÉVISUALISE l'invitation sans la consommer.
 *  4. À la soumission, l'Edge Function `activate-manager` définit le mot de
 *     passe du compte Auth existant (aucun `signUp`), consomme l'invitation à
 *     usage unique, lève le drapeau de rotation et vérifie la connexion réelle.
 *
 * Sécurité : aucun mot de passe dans l'URL, aucun mot de passe journalisé,
 * jeton à usage unique, expiration vérifiée côté serveur.
 */

import { Suspense, useEffect, useState, useSyncExternalStore, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase-browser";
import { Logo } from "@/components/logo";
import {
  ACTIVATION_MIN_PASSWORD_LENGTH,
  classifyActivationError,
  isValidTokenFormat,
  parseActivationToken,
  validatePasswordPair,
  type ActivationView,
} from "@/lib/activation";

type Preview = {
  invitation_id?: string;
  email?: string;
  login_id?: string | null;
  manager_full_name?: string;
  establishment_name?: string;
  expires_at?: string;
};

async function readFunctionError(error: unknown): Promise<{ code?: string; message: string }> {
  const e = error as { message?: string; context?: { json?: () => Promise<unknown> } };
  let body: Record<string, unknown> | null = null;
  try {
    body = ((await e?.context?.json?.()) ?? null) as Record<string, unknown> | null;
  } catch {
    body = null;
  }
  return {
    code: typeof body?.code === "string" ? body.code : undefined,
    message:
      (typeof body?.error === "string" && body.error) ||
      e?.message ||
      "Activation impossible.",
  };
}

function ActiverPage() {
  const params = useSearchParams();

  // Le jeton est transmis dans le FRAGMENT (#token=…) : il n'est jamais
  // envoyé au serveur dans l'URL ni dans un en-tête Referer. Compatibilité
  // conservée avec les anciens liens en query string. `useSyncExternalStore`
  // lit la source externe sans setState dans un effet (hydratation sûre).
  const hash = useSyncExternalStore(
    () => () => {},
    () => (typeof window === "undefined" ? "" : window.location.hash),
    () => "",
  );
  const hp = new URLSearchParams(hash.replace(/^#/, ""));
  const token = parseActivationToken(hp.has("token") ? hp.toString() : params.toString());

  const [vue, setVue] = useState<ActivationView>("verification");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [motDePasse, setMotDePasse] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [enCours, setEnCours] = useState(false);

  /* 1. Prévisualisation : aucune consommation du jeton. */
  useEffect(() => {
    let vivant = true;

    async function previsualiser() {
      if (!token || !isValidTokenFormat(token)) {
        if (vivant) {
          setVue("invalide");
          setMessage("Le lien d'activation est incomplet ou invalide.");
        }
        return;
      }
      if (!supabase) {
        if (vivant) setVue("erreur");
        return;
      }
      const { data, error } = await supabase.functions.invoke("activate-manager", {
        body: { action: "preview", token },
      });
      if (!vivant) return;
      if (error) {
        const { code, message: detail } = await readFunctionError(error);
        if (!vivant) return;
        setMessage(detail);
        setVue(
          code === "expired"
            ? "expiree"
            : code === "used"
              ? "deja_utilisee"
              : code === "invalid"
                ? "invalide"
                : "erreur",
        );
        return;
      }
      const corps = (data ?? {}) as Record<string, unknown>;
      if (corps.ok === false) {
        setMessage(typeof corps.error === "string" ? corps.error : "Invitation indisponible.");
        setVue(classifyActivationError(String(corps.error ?? "")));
        return;
      }
      setPreview(corps as Preview);
      setVue("pret");
    }

    void previsualiser();
    return () => {
      vivant = false;
    };
  }, [token]);

  /* 2. Activation : définition du mot de passe + consommation unique. */
  async function activer(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
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
      const { data, error } = await supabase.functions.invoke("activate-manager", {
        body: { action: "activate", token, password: motDePasse, passwordConfirm: confirmation },
      });
      if (error) {
        const { code, message: detail } = await readFunctionError(error);
        setMessage(detail);
        if (code === "expired") setVue("expiree");
        else if (code === "used") setVue("deja_utilisee");
        else if (code === "invalid") setVue("invalide");
        return;
      }
      const corps = (data ?? {}) as Record<string, unknown>;
      if (corps.ok === false) {
        const detail = String(corps.error ?? "Activation impossible.");
        setMessage(detail);
        setVue(classifyActivationError(detail));
        return;
      }
      setPreview((p) => ({
        ...(p ?? {}),
        email: typeof corps.email === "string" ? corps.email : p?.email,
        login_id: typeof corps.login_id === "string" ? corps.login_id : p?.login_id ?? null,
      }));
      setMotDePasse("");
      setConfirmation("");
      setVue("succes");
      setMessage("Votre mot de passe est défini et la connexion a été vérifiée par le serveur.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Activation impossible.");
    } finally {
      setEnCours(false);
    }
  }

  if (vue === "verification") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#252D2D] p-6 text-center">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#344440]">
            <span className="text-[10px] text-[#A7B7A8]">…</span>
          </div>
          <p className="text-sm text-[#A7B7A8]">Vérification de l&apos;invitation…</p>
        </div>
      </main>
    );
  }

  if (vue === "expiree" || vue === "deja_utilisee" || vue === "invalide" || vue === "erreur") {
    const contenu = {
      expiree: {
        icone: "⏰",
        titre: "Invitation expirée",
        texte: "Ce lien d'activation n'est plus valide. Demandez une nouvelle invitation au Super Admin.",
      },
      deja_utilisee: {
        icone: "🔒",
        titre: "Invitation déjà utilisée",
        texte: "Ce lien a déjà servi. Si vous avez défini votre mot de passe, connectez-vous ; sinon demandez une relance.",
      },
      invalide: {
        icone: "⚠️",
        titre: "Lien invalide",
        texte: "Ce lien d'activation est incomplet, inconnu ou ne correspond à aucune invitation.",
      },
      erreur: {
        icone: "❌",
        titre: "Vérification impossible",
        texte: "Le service d'activation est momentanément indisponible. Réessayez ou contactez le support.",
      },
    }[vue];

    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-[#252D2D] p-6 text-center">
        <div className="carte max-w-md p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#C5716B]/15">
            <span className="text-[#C5716B] text-2xl">{contenu.icone}</span>
          </div>
          <h1 className="titre-or mt-4 text-2xl font-extrabold">{contenu.titre}</h1>
          <p className="mt-3 text-sm leading-6 text-[#A7B7A8]">{contenu.texte}</p>
          {message && <p className="mt-3 text-xs text-[#A7B7A8]">{message}</p>}
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/connexion/" className="rounded-lg border border-[#8FB59B]/40 px-4 py-2 text-sm text-[#DFE7E2] hover:bg-[#344440]">
              Se connecter
            </Link>
            <a href="mailto:me.achbani@gmail.com" className="rounded-lg border border-[#D6A34D]/40 px-4 py-2 text-sm text-[#D6A34D] hover:bg-[#344440]/10">
              Contacter le support
            </a>
          </div>
        </div>
      </main>
    );
  }

  if (vue === "succes") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-[#252D2D] p-6 text-center">
        <div className="carte max-w-md p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#5D9E7F]/15">
            <span className="text-[#5D9E7F] text-2xl">✅</span>
          </div>
          <h1 className="titre-or mt-4 text-2xl font-extrabold">Compte activé</h1>
          <p className="mt-3 text-sm leading-6 text-[#A7B7A8]">{message}</p>
          <div className="mt-5 rounded-lg bg-[#344440]/30 p-4 text-left">
            {preview?.login_id && (
              <p className="text-xs text-[#A7B7A8]">
                Identifiant de connexion : <span className="font-mono text-[#E8ECE8]">{preview.login_id}</span>
              </p>
            )}
            {preview?.email && (
              <p className="mt-1 text-xs text-[#A7B7A8]">
                E-mail : <span className="text-[#E8ECE8]">{preview.email}</span>
              </p>
            )}
            <p className="mt-2 text-[11px] text-[#A7B7A8]">
              Vous pouvez vous connecter par identifiant ou par e-mail.
            </p>
          </div>
          <div className="mt-8 flex justify-center">
            <Link href="/connexion/" className="btn-or px-6 py-2 text-sm">Se connecter</Link>
          </div>
        </div>
      </main>
    );
  }

  /* vue === "pret" */
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#252D2D] p-6 sm:p-10">
      <div className="carte max-w-md w-full p-8 sm:p-10">
        <div className="flex justify-center mb-4">
          <Logo compact />
        </div>
        <h1 className="titre-or text-center text-2xl font-extrabold mb-1">Définir votre mot de passe</h1>
        <p className="text-center text-sm text-[#A7B7A8] mb-6">
          Votre invitation est valide. Le lien n&apos;est consommé qu&apos;après validation de ce formulaire.
        </p>

        <div className="mb-6 p-4 rounded-lg bg-[#344440]/30 border border-[#8FB59B]/20">
          <p className="text-xs uppercase tracking-[0.15em] text-[#A7B7A8] mb-1">Compte à activer</p>
          <p className="text-sm font-semibold text-[#E8ECE8]">{preview?.manager_full_name ?? "Manager"}</p>
          {preview?.establishment_name && (
            <p className="text-[11px] text-[#A7B7A8]">{preview.establishment_name}</p>
          )}
          <p className="mt-1 text-[11px] text-[#A7B7A8]">{preview?.email}</p>
          {preview?.login_id && (
            <p className="text-[11px] text-[#A7B7A8]">
              Identifiant : <span className="font-mono">{preview.login_id}</span>
            </p>
          )}
          {preview?.expires_at && (
            <p className="mt-1 text-[11px] text-[#A7B7A8]">
              Lien valable jusqu&apos;au {new Date(preview.expires_at).toLocaleDateString("fr-FR")}.
            </p>
          )}
        </div>

        <form onSubmit={activer} className="space-y-4">
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
            <label className="block text-xs text-[#A7B7A8] mb-1">Confirmer le mot de passe *</label>
            <input
              type="password"
              required
              minLength={ACTIVATION_MIN_PASSWORD_LENGTH}
              autoComplete="new-password"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              className="champ mt-1 min-h-11 w-full"
              placeholder="Confirmez le mot de passe"
            />
          </div>

          {message && <p className="text-xs text-[#C5716B]">{message}</p>}

          <button
            type="submit"
            disabled={enCours}
            className="w-full btn-or px-6 py-2 text-sm disabled:opacity-40"
          >
            {enCours ? "Activation…" : "Activer mon compte"}
          </button>

          <p className="mt-6 text-center text-[11px] text-[#A7B7A8]">
            Vous avez déjà un mot de passe ?
            <Link href="/connexion/" className="text-[#8FB59B] hover:underline ml-1">Connectez-vous</Link>
          </p>
        </form>
      </div>
    </main>
  );
}

export default function ActiverActivationPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#252D2D] p-8 text-[#A7B7A8]">Chargement…</main>}>
      <ActiverPage />
    </Suspense>
  );
}
