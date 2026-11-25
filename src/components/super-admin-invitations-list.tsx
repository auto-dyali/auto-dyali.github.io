"use client";

/**
 * AUTO DYALI — Super Admin › Suivi des invitations Manager.
 *
 * Affiche les statuts RÉELS et INDÉPENDANTS de chaque canal :
 *   - e-mail  : non_demande | en_attente | accepte_par_fournisseur | echec | non_configure
 *   - WhatsApp: idem
 *
 * La relance appelle l'Edge Function `send-invitation` (nouveau jeton haché,
 * idempotence par requestId) et n'affirme jamais une livraison non confirmée.
 * L'historique `invitation_events` est chargé à la demande.
 */

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase-browser";
import { useNotification } from "@/lib/use-notification";
import { DELIVERY_STATUS_LABEL } from "@/lib/activation";

type InvitationRow = {
  id: string;
  email: string;
  establishment_id: string | null;
  manager_full_name: string;
  manager_phone: string | null;
  plan_code: string | null;
  status: string;
  email_status: string;
  whatsapp_status: string;
  email_provider_ref: string | null;
  whatsapp_provider_ref: string | null;
  last_error: string | null;
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

const STATUS_LABEL: Record<string, string> = {
  prepared: "Préparée",
  sent: "Envoyée",
  accepted: "Acceptée",
  expired: "Expirée",
  cancelled: "Annulée",
  failed: "Échec",
};

function badgeClass(status: string): string {
  if (status === "accepte_par_fournisseur" || status === "accepted") {
    return "bg-[#5D9E7F]/15 text-[#5D9E7F]";
  }
  if (status === "echec" || status === "failed") return "bg-[#C5716B]/15 text-[#C5716B]";
  if (status === "non_configure" || status === "non_demande") {
    return "bg-[#A7B7A8]/15 text-[#A7B7A8]";
  }
  return "bg-[#D6A34D]/15 text-[#D6A34D]";
}

function StatusBadge({ status }: { status: string }): ReactNode {
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-[10px] font-semibold ${badgeClass(status)}`}>
      {DELIVERY_STATUS_LABEL[status] ?? STATUS_LABEL[status] ?? status}
    </span>
  );
}

async function lireErreur(error: unknown): Promise<string> {
  const e = error as { message?: string; context?: { json?: () => Promise<unknown> } };
  try {
    const body = (await e?.context?.json?.()) as { error?: string } | null;
    if (body?.error) return body.error;
  } catch {
    /* corps non JSON */
  }
  return e?.message ?? "Erreur inconnue.";
}

export function SuperAdminInvitationsList({ establishmentId }: { establishmentId?: string }) {
  const [invitations, setInvitations] = useState<InvitationRow[]>([]);
  const [events, setEvents] = useState<Record<string, InvitationEventRow[]>>({});
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState<string | null>(null);

  const { success, error: notifyError } = useNotification();

  const charger = useCallback(async () => {
    if (!supabase) {
      setError("Supabase non configuré.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from("invitations")
        .select(
          "id, email, establishment_id, manager_full_name, manager_phone, plan_code, status, email_status, whatsapp_status, email_provider_ref, whatsapp_provider_ref, last_error, expires_at, accepted_at, created_at",
        )
        .order("created_at", { ascending: false });
      if (establishmentId) query = query.eq("establishment_id", establishmentId);

      const { data, error: err } = await query;
      if (err) {
        if (/does not exist|relation|schema cache|404/i.test(err.message)) {
          setError("La table `invitations` n'existe pas encore. Appliquez la migration 0036 sur Supabase.");
        } else {
          setError(err.message);
        }
        setInvitations([]);
        return;
      }
      setInvitations((data ?? []) as InvitationRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de chargement.");
    } finally {
      setLoading(false);
    }
  }, [establishmentId]);

  useEffect(() => {
    const timer = setTimeout(() => void charger(), 0);
    return () => clearTimeout(timer);
  }, [charger]);

  async function chargerEvenements(invitationId: string) {
    if (!supabase) return;
    const { data, error: err } = await supabase
      .from("invitation_events")
      .select("id, channel, event_type, provider_ref, provider_error, created_at")
      .eq("invitation_id", invitationId)
      .order("created_at", { ascending: false })
      .limit(25);
    if (err) {
      notifyError({ title: "Historique indisponible", message: err.message });
      return;
    }
    setEvents((prev) => ({ ...prev, [invitationId]: (data ?? []) as InvitationEventRow[] }));
  }

  async function relancer(invitation: InvitationRow, channel: "email" | "whatsapp") {
    if (!supabase) return;
    const cle = `${invitation.id}:${channel}`;
    setEnvoi(cle);
    try {
      const { data, error: err } = await supabase.functions.invoke("send-invitation", {
        body: {
          invitationId: invitation.id,
          channels: [channel],
          requestId: crypto.randomUUID(),
        },
      });
      if (err) throw new Error(await lireErreur(err));
      const corps = (data ?? {}) as { ok?: boolean; error?: string };
      if (corps.ok === false) throw new Error(corps.error ?? "Relance impossible.");
      success({
        title: `Relance ${channel === "email" ? "e-mail" : "WhatsApp"} demandée`,
        message: "Le statut affiché correspond à la réponse réelle du fournisseur.",
      });
      await charger();
      if (ouvert === invitation.id) await chargerEvenements(invitation.id);
    } catch (e) {
      notifyError({
        title: "Échec de la relance",
        message: e instanceof Error ? e.message : "Relance impossible.",
      });
    } finally {
      setEnvoi(null);
    }
  }

  async function basculerDetails(invitation: InvitationRow) {
    if (ouvert === invitation.id) {
      setOuvert(null);
      return;
    }
    setOuvert(invitation.id);
    if (!events[invitation.id]) await chargerEvenements(invitation.id);
  }

  if (error) {
    return (
      <div className="carte p-6 text-center">
        <p className="text-sm text-[#C5716B]">{error}</p>
        <p className="mt-3 text-xs text-[#A7B7A8]">Vérifiez que la migration 0036 est appliquée sur Supabase.</p>
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
          Statuts par canal issus des réponses fournisseurs. « Accepté par le fournisseur » ≠ « délivré ».
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="bg-[#344440]/50 text-xs uppercase text-[#A7B7A8]">
            <tr>
              <th className="px-4 py-3">Manager</th>
              <th className="px-4 py-3">E-mail</th>
              <th className="px-4 py-3">E-mail / WhatsApp</th>
              <th className="px-4 py-3">Invitation</th>
              <th className="px-4 py-3">Expire le</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#8FB59B]/10">
            {invitations.map((inv) => {
              const expire = inv.expires_at ? new Date(inv.expires_at) < new Date() : false;
              // Une invitation révoquée peut être renouvelée : le serveur crée
              // alors une NOUVELLE invitation et invalide définitivement l'ancien lien.
              const bloque = inv.status === "accepted";
              return (
                <tr key={inv.id} className="align-top">
                  <td className="px-4 py-4">
                    <p className="font-semibold text-[#E8ECE8]">{inv.manager_full_name}</p>
                    {inv.manager_phone && <p className="text-[11px] text-[#A7B7A8]">{inv.manager_phone}</p>}
                    <p className="text-[11px] text-[#A7B7A8]">{inv.plan_code ? inv.plan_code.toUpperCase() : "—"}</p>
                  </td>
                  <td className="px-4 py-4">
                    <p className="text-[#E8ECE8]">{inv.email}</p>
                    {inv.establishment_id && (
                      <p className="font-mono text-[10px] text-[#A7B7A8]">{inv.establishment_id}</p>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="w-16 text-[10px] uppercase text-[#A7B7A8]">E-mail</span>
                        <StatusBadge status={inv.email_status} />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-16 text-[10px] uppercase text-[#A7B7A8]">WhatsApp</span>
                        <StatusBadge status={inv.whatsapp_status} />
                      </div>
                      {inv.last_error && (
                        <p className="mt-1 max-w-[240px] text-[10px] text-[#C5716B]">{inv.last_error}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <StatusBadge status={inv.status} />
                  </td>
                  <td className="px-4 py-4 text-[#A7B7A8]">
                    {inv.expires_at
                      ? `${new Date(inv.expires_at).toLocaleDateString("fr-FR")}${expire ? " (expiré)" : ""}`
                      : "—"}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-col items-end gap-1.5">
                      {!bloque && (
                        <>
                          <button
                            type="button"
                            onClick={() => void relancer(inv, "email")}
                            disabled={envoi === `${inv.id}:email`}
                            className="rounded-lg border border-[#8FB59B]/40 px-3 py-1.5 text-xs text-[#8FB59B] hover:bg-[#344440] disabled:opacity-40"
                          >
                            {envoi === `${inv.id}:email`
                              ? "Envoi…"
                              : inv.status === "cancelled"
                                ? "Renouveler e-mail"
                                : "Relancer e-mail"}
                          </button>
                          <button
                            type="button"
                            onClick={() => void relancer(inv, "whatsapp")}
                            disabled={envoi === `${inv.id}:whatsapp` || !inv.manager_phone}
                            className="rounded-lg border border-[#8FB59B]/40 px-3 py-1.5 text-xs text-[#8FB59B] hover:bg-[#344440] disabled:opacity-40"
                          >
                            {envoi === `${inv.id}:whatsapp`
                              ? "Envoi…"
                              : inv.status === "cancelled"
                                ? "Renouveler WhatsApp"
                                : "Relancer WhatsApp"}
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => void basculerDetails(inv)}
                        className="text-[11px] text-[#A7B7A8] underline underline-offset-2 hover:text-[#DFE7E2]"
                      >
                        {ouvert === inv.id ? "Masquer l'historique" : "Historique"}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {ouvert && (
        <div className="border-t border-[#8FB59B]/10 p-5">
          <h3 className="text-xs uppercase tracking-[0.15em] text-[#A7B7A8]">Historique (25 derniers événements)</h3>
          <ul className="mt-2 space-y-1.5 text-xs">
            {(events[ouvert] ?? []).map((ev) => (
              <li key={ev.id} className="flex flex-wrap items-center gap-2 text-[#A7B7A8]">
                <span className="font-mono text-[10px]">{ev.created_at ? new Date(ev.created_at).toLocaleString("fr-FR") : "—"}</span>
                <span className="rounded bg-[#344440]/60 px-1.5 py-0.5 text-[10px] text-[#DFE7E2]">{ev.channel}</span>
                <span className="text-[#E8ECE8]">{ev.event_type}</span>
                {ev.provider_ref && <span className="font-mono text-[10px]">{ev.provider_ref}</span>}
                {ev.provider_error && <span className="text-[#C5716B]">{ev.provider_error}</span>}
              </li>
            ))}
            {(events[ouvert] ?? []).length === 0 && <li className="text-[#A7B7A8]">Aucun événement enregistré.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
