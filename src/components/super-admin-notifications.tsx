"use client";

/**
 * AUTO DYALI — Notifications internes du Super Admin.
 *
 * Source : public.super_admin_notifications (migration 20261126000000).
 * Aucune écriture directe : la lecture et la mise à jour `read_at` sont
 * autorisées aux seuls comptes Super Admin par RLS. Si la migration n'est pas
 * appliquée dans l'environnement cible, l'écran affiche un état explicite
 * sans inventer de notification.
 */

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase-browser";

type NotificationSA = {
  id: string;
  source_request_id: string;
  title: string;
  body: string;
  created_at: string;
  read_at: string | null;
  inapp_status: string;
  email_status: string;
  whatsapp_status: string;
};

const LIBELLES: Record<string, string> = {
  non_demande: "Non demandé",
  non_configure: "Non configuré",
  en_attente: "En attente",
  accepte_par_fournisseur: "Accepté par le fournisseur",
  echec: "Échec",
  enregistre: "Enregistrée",
  indisponible: "Indisponible",
};

export function SuperAdminNotifications() {
  const [lignes, setLignes] = useState<NotificationSA[]>([]);
  const [etat, setEtat] = useState<"chargement" | "pret" | "indisponible">("chargement");

  const charger = useCallback(async () => {
    /* Frontière asynchrone explicite : évite un setState synchrone dans l'effet. */
    await Promise.resolve();
    if (!supabase) {
      setEtat("indisponible");
      return;
    }
    const { data, error } = await supabase
      .from("super_admin_notifications")
      .select("id, source_request_id, title, body, created_at, read_at, inapp_status, email_status, whatsapp_status")
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) {
      setEtat("indisponible");
      return;
    }
    setLignes((data ?? []) as NotificationSA[]);
    setEtat("pret");
  }, []);

  useEffect(() => {
    /* Différé : aucune mise à jour d'état synchrone depuis l'effet. */
    const t = setTimeout(() => void charger(), 0);
    return () => clearTimeout(t);
  }, [charger]);

  const marquerLu = useCallback(
    async (id: string) => {
      if (!supabase) return;
      await supabase
        .from("super_admin_notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", id);
      await charger();
    },
    [charger],
  );

  if (etat === "indisponible") {
    return (
      <section className="mb-8">
        <h2 className="mb-3 font-bold">Notifications du Super Admin</h2>
        <div className="carte p-5 text-sm text-[#A7B7A8]">
          Table de notifications indisponible dans cet environnement. Aucune notification simulée.
        </div>
      </section>
    );
  }

  return (
    <section className="mb-8">
      <h2 className="mb-3 font-bold">Notifications du Super Admin</h2>
      <div className="carte p-5">
        {etat === "chargement" && (
          <p className="text-sm text-[#A7B7A8]">Chargement…</p>
        )}
        {etat === "pret" && lignes.length === 0 && (
          <p className="text-sm text-[#A7B7A8]">Aucune notification enregistrée.</p>
        )}
        <ul className="space-y-3">
          {lignes.map((n) => (
            <li key={n.id} className="rounded-lg border border-[#344440]/60 bg-[#252D2D] p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-[#E8ECE8]">{n.title}</p>
                  <p className="mt-1 text-[11px] text-[#A7B7A8]">
                    {new Date(n.created_at).toLocaleString("fr-FR")} · {n.source_request_id}
                  </p>
                </div>
                {!n.read_at && (
                  <button
                    type="button"
                    onClick={() => void marquerLu(n.id)}
                    className="sa3d-btn sa3d-btn-fantome px-3 py-1 text-[11px]"
                  >
                    Marquer comme lu
                  </button>
                )}
              </div>
              <p className="mt-2 whitespace-pre-line text-xs text-[#DFE7E2]">{n.body}</p>
              <p className="mt-2 text-[10px] text-[#A7B7A8]">
                Interne : {LIBELLES[n.inapp_status] ?? n.inapp_status} · E-mail :{" "}
                {LIBELLES[n.email_status] ?? n.email_status} · WhatsApp :{" "}
                {LIBELLES[n.whatsapp_status] ?? n.whatsapp_status}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
