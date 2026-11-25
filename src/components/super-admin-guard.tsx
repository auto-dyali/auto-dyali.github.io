"use client";

/**
 * Garde d'accès partagée pour toutes les pages Super Admin.
 * Vérifie la session Supabase et le rôle `saas_admin` côté serveur.
 *
 * GV5 §103 : une panne réseau/serveur n'est plus affichée comme un refus
 * d'autorisation. Toutes les erreurs restent fail-closed (aucun contenu
 * n'est rendu), seul le message et l'action proposée changent.
 */

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase-browser";
import { classerErreur } from "@/lib/supabase-errors";

type Etat = "chargement" | "ok" | "refuse" | "session" | "indisponible" | "erreur";

export function SuperAdminGuard({ children, titre = "zone" }: { children: ReactNode; titre?: string }) {
  const router = useRouter();
  const [etat, setEtat] = useState<Etat>("chargement");
  const [detail, setDetail] = useState<string | null>(null);

  useEffect(() => {
    let vivant = true;

    const poser = (e: Etat, d?: string) => {
      if (!vivant) return;
      setEtat(e);
      setDetail(d ?? null);
    };

    const verifier = async () => {
      if (!supabase) {
        poser("erreur", "Variables publiques Supabase absentes (configuration).");
        return;
      }

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        const c = classerErreur(sessionError);
        poser(c.famille === "autorisation" ? "refuse" : c.famille === "session" ? "session" : "indisponible", c.detail);
        return;
      }
      if (!sessionData.session) {
        if (vivant) router.replace("/connexion/");
        return;
      }

      const { data: roleData, error: roleError } = await supabase.rpc("get_my_profile");
      if (roleError) {
        const c = classerErreur(roleError);
        // Un vrai refus d'autorisation reste un refus ; il n'est jamais
        // transformé en message réseau.
        const etatErreur: Etat =
          c.famille === "autorisation"
            ? "refuse"
            : c.famille === "session"
              ? "session"
              : c.famille === "reseau" || c.famille === "serveur"
                ? "indisponible"
                : "erreur";
        poser(etatErreur, `${c.message}${c.detail ? ` (${c.detail})` : ""}`);
        return;
      }

      const role = Array.isArray(roleData) ? roleData[0]?.role : undefined;
      if (role !== "saas_admin") {
        poser("refuse");
        return;
      }
      poser("ok");
    };

    const timer = window.setTimeout(() => void verifier(), 0);
    return () => {
      vivant = false;
      window.clearTimeout(timer);
    };
  }, [router]);

  if (etat === "chargement") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#252D2D] text-sm text-[#A7B7A8]">
        Vérification de la session…
      </main>
    );
  }

  if (etat === "ok") return <>{children}</>;

  const message =
    etat === "refuse"
      ? `Accès refusé : cette ${titre} est réservée à l’administrateur de la plateforme.`
      : etat === "session"
        ? "Votre session a expiré. Reconnectez-vous pour continuer."
        : etat === "indisponible"
          ? "Service momentanément indisponible : la vérification de session n’a pas pu aboutir. Aucun accès n’est autorisé."
          : "Vérification de session impossible (configuration ou erreur inattendue). Aucun accès n’est autorisé.";
  const versConnexion = etat === "refuse" || etat === "session";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#252D2D] p-6 text-center">
      <p className="text-sm text-[#C5716B]">{message}</p>
      {detail && <p className="max-w-xl text-xs text-[#A7B7A8]">{detail}</p>}
      <button
        type="button"
        onClick={() => (versConnexion ? router.replace("/connexion/") : window.location.reload())}
        className="btn-or px-5 py-2 text-sm"
      >
        {versConnexion ? "Revenir à la connexion" : "Réessayer"}
      </button>
    </main>
  );
}
