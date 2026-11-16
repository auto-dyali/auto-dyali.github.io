"use client";

/**
 * AUTO DYALI — Super Admin › Liste et suivi des invitations Manager.
 *
 * Affiche les invitations créées, leur statut d'envoi et d'activation,
 * et permet de renvoyer une invitation en cas d'échec.
 *
 * Dépendances :
 *  - Table `public.invitations` (migration 0036, à appliquer sur Supabase)
 *  - Table `public.invitation_events` (migration 0036)
 *  - RPC `admin_invite_manager` / `admin_accept_invitation` (migration 0036)
 *  - Edge Function d'envoi d'invitation (à déployer)
 *
 * Si les tables n'existent pas encore, un message explicite s'affiche.
 */

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase-browser";
import { useNotification } from "@/lib/use-notification";
import { buildActivationUrl } from "@/lib/invitation";

type InvitationRow = {
  id: string;
  token: string;
  email: string;
  establishment_id: string | null;
  manager_full_name: string;
  manager_phone: string | null;
  plan_code: string | null;
  status: string;
  expires_at: string | null;
  accepted_at: string | null;
  created_at: string | null;
};

type InvitationEventRow = {
  id: string;
  channel: string;
  event_type: string;
  provider_ref: string | null;
  provider_error: string | null;
  created_at: string | null;
};

export function SuperAdminInvitationsList({
  establishmentId,
}: {
  establishmentId?: string;
}) {
  const [invitations, setInvitations] = useState<InvitationRow[]>([]);
  const [events, setEvents] = useState<InvitationEventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resending, setResending] = useState<string | null>(null); // invitationId en cours de renvoi

  const { success, error: notifyError, warning: notifyWarning } = useNotification();

  // ------------------------------------------------------------------
  // Charger les invitations
  // ------------------------------------------------------------------
  const charger = useCallback(async () => {
    if (!supabase) {
      setError("Supabase non configure.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from("invitations")
        .select(
          "id, token, email, establishment_id, manager_full_name, manager_phone, plan_code, status, expires_at, accepted_at, created_at"
        )
        .order("created_at", { ascending: false });

      if (establishmentId) {
        query = query.eq("establishment_id", establishmentId);
      }

      const { data, error: err } = await query;

      if (err) {
        // Si la table n'existe pas encore, afficher un message explicite
        if (
          err.message.includes("does not exist") ||
          err.message.includes("relation") ||
          err.message.includes("404") ||
          err.message.includes("schema cache")
        ) {
          setError(
            "La table `invitations` n'existe pas encore. Appliquez la migration 0036 sur Supabase."
          );
        } else {
          setError(err.message);
        }
        setInvitations([]);
        setLoading(false);
        return;
      }

      setInvitations((data ?? []) as InvitationRow[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de chargement.");
      setInvitations([]);
    } finally {
      setLoading(false);
    }
  }, [supabase, establishmentId]);

  useEffect(() => {
    const timer = setTimeout(() => void charger(), 0);
    return () => clearTimeout(timer);
  }, [charger]);

  // ------------------------------------------------------------------
  // Renvoyer une invitation
  // ------------------------------------------------------------------
  async function renvoyerInvitation(invitation: InvitationRow) {
    if (!supabase) {
      notifyError({ title: "Supabase non configure", message: "Impossible de renvoyer l'invitation." });
      return;
    }
    setResending(invitation.id);
    try {
      // Le renvoi réel se fait via une Edge Function d'envoi.
      // Ici, on marque l'invitation comme à renvoyer et on laisse l'EF traiter.
      const { error } = await supabase.rpc("admin_invite_manager", {
        p_request_id: `resend-${invitation.id}`,
        p_company_name: "", // non utilisé pour le renvoi
        p_company_slug: "",
        p_manager_name: invitation.manager_full_name,
        p_manager_email: invitation.email,
        p_manager_phone: invitation.manager_phone ?? null,
        p_address: "",
        p_city: "",
        p_plan_code: invitation.plan_code ?? "standard",
        p_trial_days: 7,
        p_modules: "[]",
        p_created_by: null, // sera résolu par auth.uid()
      });

      if (error) throw error;

      success({
        title: "Invitation renvoyee",
        message: `L'invitation pour ${invitation.email} a été préparée pour renvoi.`,
      });
      void charger();
    } catch (err) {
      notifyError({
        title: "Echec du renvoi",
        message: err instanceof Error ? err.message : "Impossible de renvoyer l'invitation.",
      });
    } finally {
      setResending(null);
    }
  }

  // ------------------------------------------------------------------
  // Helpers d'affichage
  // ------------------------------------------------------------------
  function statutBadge(status: string): React.ReactNode {
    const config: Record<string, { color: string; bg: string }> = {
      préparée: { color: "text-[#D6A34D]", bg: "bg-[#D6A34D]/15" },
      envoyee: { color: "text-[#5D9E7F]", bg: "bg-[#5D9E7F]/15" },
      confirmee: { color: "text-[#5D9E7F]", bg: "bg-[#5D9E7F]/15" },
      echec: { color: "text-[#C5716B]", bg: "bg-[#C5716B]/15" },
      acceptee: { color: "text-[#5D9E7F]", bg: "bg-[#5D9E7F]/15" },
      expiree: { color: "text-[#A7B7A8]", bg: "bg-[#A7B7A8]/15" },
      annulee: { color: "text-[#A7B7A8]", bg: "bg-[#A7B7A8]/15" },
    };
    const c = config[status] ?? { color: "text-[#A7B7A8]", bg: "bg-[#A7B7A8]/15" };
    return (
      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${c.color} ${c.bg}`}>
        {status}
      </span>
    );
  }

  function estExpiré(expiresAt: string | null): boolean {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  }

  if (error) {
    return (
      <div className="carte p-6 text-center">
        <p className="text-sm text-[#C5716B]">{error}</p>
        <p className="mt-3 text-xs text-[#A7B7A8]">
          Vérifiez que la migration 0036 est appliquée sur Supabase.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="carte p-6 text-center">
        <p className="text-sm text-[#A7B7A8]">Chargement des invitations…</p>
      </div>
    );
  }

  if (invitations.length === 0) {
    return (
      <div className="carte p-6 text-center">
        <p className="text-sm text-[#A7B7A8]">Aucune invitation enregistrée.</p>
      </div>
    );
  }

  return (
    <div className="carte overflow-hidden">
      <div className="border-b border-[#8FB59B]/10 p-5">
        <h2 className="font-bold">Invitations Manager</h2>
        <p className="mt-1 text-xs text-[#A7B7A8]">
          Suivi des envois d&apos;invitation e-mail et WhatsApp, et de l&apos;activation des comptes.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#344440]/50 text-xs uppercase text-[#A7B7A8]">
            <tr>
              <th className="px-5 py-3">Manager</th>
              <th className="px-5 py-3">Email</th>
              <th className="px-5 py-3">Etablissement</th>
              <th className="px-5 py-3">Forfait</th>
              <th className="px-5 py-3">Statut</th>
              <th className="px-5 py-3">Expire le</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#8FB59B]/10">
            {invitations.map((inv) => (
              <tr key={inv.id} className="group">
                <td className="px-5 py-4">
                  <p className="font-semibold text-[#E8ECE8]">{inv.manager_full_name}</p>
                  {inv.manager_phone && (
                    <p className="text-[11px] text-[#A7B7A8]">{inv.manager_phone}</p>
                  )}
                </td>
                <td className="px-5 py-4">
                  <p className="text-[#E8ECE8]">{inv.email}</p>
                </td>
                <td className="px-5 py-4 text-[#A7B7A8]">
                  {inv.establishment_id ?? "—"}
                </td>
                <td className="px-5 py-4 text-[#A7B7A8]">
                  {inv.plan_code ? inv.plan_code.toUpperCase() : "—"}
                </td>
                <td className="px-5 py-4">{statutBadge(inv.status)}</td>
                <td className="px-5 py-4 text-[#A7B7A8]">
                  {inv.expires_at
                    ? `${new Date(inv.expires_at).toLocaleDateString("fr-FR")}${estExpiré(inv.expires_at) ? " (expiré)" : ""}`
                    : "—"}
                </td>
                <td className="px-5 py-4 text-right">
                  {(inv.status === "echec" || inv.status === "expiree" || inv.status === "annulee") && (
                    <button
                      type="button"
                      onClick={() => void renvoyerInvitation(inv)}
                      disabled={resending === inv.id}
                      className={`rounded-lg border px-3 py-1.5 text-xs ${resending === inv.id ? "opacity-50" : "border-[#8FB59B]/40 text-[#8FB59B] hover:bg-[#344440]"}`}
                    >
                      {resending === inv.id ? "Envoi…" : "Renvoyer"}
                    </button>
                  )}
                  {(inv.status === "préparée" || inv.status === "envoyee") && (
                    <span className="text-[11px] text-[#A7B7A8]">En attente</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
