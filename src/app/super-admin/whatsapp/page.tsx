"use client";
/* eslint-disable react/no-unescaped-entities */

/**
 * AUTO DYALI — Super Admin › WhatsApp Business.
 *
 * Aucune connexion Meta n'est simulée. La page distingue :
 *   - le droit au module `whatsapp` par forfait (`plan_features`, réel) ;
 *   - l'état réel de l'intégration fournisseur, qui ne peut être constaté que
 *     côté serveur (Edge Function `send-invitation`) ;
 *   - le centre de suivi des communications : statuts réellement enregistrés
 *     dans `invitations.whatsapp_status` / `invitation_events`.
 *
 * Tant que les secrets Meta ne sont pas configurés, les envois sont marqués
 * `non_configure` — jamais « envoyés ».
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase-browser";
import { ModulePage } from "@/components/super-admin-module-page";
import { ModuleHeader, Chargement, Erreur } from "@/components/super-admin-page";

type InvitationStatut = {
  id: string;
  manager_full_name: string;
  manager_phone: string | null;
  whatsapp_status: string;
  email_status: string;
  created_at: string | null;
};

const LABEL: Record<string, string> = {
  non_demande: "Non demandé",
  en_attente: "En attente",
  accepte_par_fournisseur: "Accepté par le fournisseur",
  echec: "Échec",
  non_configure: "Fournisseur non configuré",
};

export default function WhatsappPage() {
  const [droits, setDroits] = useState<{ plan_code: string; enabled: boolean }[]>([]);
  const [invitations, setInvitations] = useState<InvitationStatut[]>([]);
  const [tableDisponible, setTableDisponible] = useState(true);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      if (!supabase) {
        setLoading(false);
        return;
      }
      setLoading(true);
      const [f, i] = await Promise.all([
        supabase.from("plan_features").select("plan_code, enabled").eq("feature_key", "whatsapp"),
        supabase
          .from("invitations")
          .select("id, manager_full_name, manager_phone, whatsapp_status, email_status, created_at")
          .order("created_at", { ascending: false })
          .limit(50),
      ]);
      if (f.error) setErreur(f.error.message);
      else setDroits((f.data ?? []) as { plan_code: string; enabled: boolean }[]);
      if (i.error) {
        if (/does not exist|relation|schema cache|404/i.test(i.error.message)) setTableDisponible(false);
        else setErreur(i.error.message);
      } else {
        setInvitations((i.data ?? []) as InvitationStatut[]);
      }
      setLoading(false);
    })();
  }, []);

  const plansActives = useMemo(
    () => droits.filter((d) => d.enabled).map((d) => d.plan_code.toUpperCase()),
    [droits],
  );

  const stats = useMemo(() => {
    const compteur: Record<string, number> = {};
    for (const inv of invitations) {
      compteur[inv.whatsapp_status] = (compteur[inv.whatsapp_status] ?? 0) + 1;
    }
    return compteur;
  }, [invitations]);

  const aucunEnvoiConfirme = !stats.accepte_par_fournisseur;

  return (
    <ModulePage titre="WhatsApp Business">
      <ModuleHeader
        surtitre="AUTO DYALI · Intégration centrale"
        titre="WhatsApp Business"
        description="État réel de l'intégration et centre de suivi des communications. Aucun envoi n'est simulé."
      />

      <div className={`carte-premium mt-6 border-l-4 p-5 ${aucunEnvoiConfirme ? "border-[#C5716B]" : "border-[#5D9E7F]"}`}>
        <h2 className="font-bold text-[#E8ECE8]">
          {aucunEnvoiConfirme ? "Aucun envoi WhatsApp confirmé par le fournisseur" : "Des envois ont été acceptés par le fournisseur"}
        </h2>
        <p className="mt-2 text-sm text-[#A7B7A8]">
          Le statut n'est « accepté » que si l'API Meta a répondu 2xx. Aucun statut « délivré » ou « lu » n'est affiché :
          cela exigerait un webhook signé. Les secrets Meta sont configurés uniquement côté serveur (Edge Function
          `send-invitation`).
        </p>
      </div>

      {erreur && <div className="mt-4"><Erreur message={erreur} /></div>}

      {loading ? (
        <div className="mt-6"><Chargement /></div>
      ) : (
        <>
          <section className="mt-6 grid gap-4 sm:grid-cols-3">
            <article className="carte-premium p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-[#A7B7A8]">Invitations suivies</p>
              <p className="titre-or mt-2 text-3xl font-extrabold">{invitations.length}</p>
            </article>
            <article className="carte-premium p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-[#A7B7A8]">Forfaits avec accès WhatsApp</p>
              <p className="titre-or mt-2 text-3xl font-extrabold">{plansActives.length}</p>
              <p className="mt-1 text-[11px] text-[#A7B7A8]">{plansActives.join(", ") || "aucun"}</p>
            </article>
            <article className="carte-premium p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-[#A7B7A8]">Intégration Meta</p>
              <p className="titre-or mt-2 text-3xl font-extrabold text-[#D6A34D]">Non constatable ici</p>
              <p className="mt-1 text-[11px] text-[#A7B7A8]">Vérification serveur uniquement.</p>
            </article>
          </section>

          <div className="carte mt-6 overflow-hidden">
            <div className="border-b border-[#8FB59B]/10 p-5">
              <h2 className="font-bold">Centre de suivi des communications</h2>
              <p className="mt-1 text-xs text-[#A7B7A8]">
                Statuts réellement enregistrés par canal. La relance se fait depuis Invitations Manager.
              </p>
            </div>
            {!tableDisponible ? (
              <p className="p-5 text-sm text-[#D6A34D]">
                Table `invitations` absente : appliquez la migration 0036 pour activer le suivi.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="bg-[#344440]/50 text-xs uppercase text-[#A7B7A8]">
                    <tr>
                      <th className="px-5 py-3">Manager</th>
                      <th className="px-5 py-3">Numéro</th>
                      <th className="px-5 py-3">WhatsApp</th>
                      <th className="px-5 py-3">E-mail</th>
                      <th className="px-5 py-3">Créée le</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#8FB59B]/10">
                    {invitations.slice(0, 10).map((inv) => (
                      <tr key={inv.id}>
                        <td className="px-5 py-3 text-[#E8ECE8]">{inv.manager_full_name}</td>
                        <td className="px-5 py-3 text-[#A7B7A8]">{inv.manager_phone ?? "—"}</td>
                        <td className="px-5 py-3 text-[#A7B7A8]">{LABEL[inv.whatsapp_status] ?? inv.whatsapp_status}</td>
                        <td className="px-5 py-3 text-[#A7B7A8]">{LABEL[inv.email_status] ?? inv.email_status}</td>
                        <td className="px-5 py-3 text-[#A7B7A8]">{inv.created_at ? new Date(inv.created_at).toLocaleDateString("fr-FR") : "—"}</td>
                      </tr>
                    ))}
                    {invitations.length === 0 && (
                      <tr><td colSpan={5} className="px-5 py-6 text-center text-sm text-[#A7B7A8]">Aucune invitation.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="carte-premium mt-6 p-5">
            <h2 className="font-bold">Ce qu'il faut pour activer l'envoi réel</h2>
            <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-[#A7B7A8]">
              <li>Compte WhatsApp Business Platform (Meta) validé pour AUTO DYALI.</li>
              <li>Modèle « utility » approuvé avec 4 variables (nom, établissement, lien, support).</li>
              <li>Secrets serveur : <span className="font-mono text-[11px]">WHATSAPP_ACCESS_TOKEN</span>, <span className="font-mono text-[11px]">WHATSAPP_PHONE_NUMBER_ID</span>, <span className="font-mono text-[11px]">WHATSAPP_TEMPLATE_NAME</span>.</li>
              <li>Webhooks signés pour les statuts de livraison (non implémentés : aucun statut « délivré » n'est affiché).</li>
              <li>Isolation par établissement et journalisation sans contenu privé.</li>
            </ol>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/super-admin/invitations/" className="btn-or px-4 py-2 text-sm">Suivre et relancer les invitations</Link>
              <Link href="/super-admin/parametres/" className="rounded-lg border border-[#8FB59B]/40 px-4 py-2 text-sm text-[#DFE7E2] hover:bg-[#344440]">Paramètres système</Link>
            </div>
          </div>
        </>
      )}
    </ModulePage>
  );
}
