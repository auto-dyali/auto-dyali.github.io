"use client";

/**
 * AUTO DYALI — Super Admin › Intégrations & API
 * Inventaire réel des intégrations connues de la plateforme.
 * Les états "connecté/opérationnel" ne sont affichés que s'ils sont
 * constatables côté application ; les secrets ne sont jamais exposés.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase-browser";
import { ModulePage } from "@/components/super-admin-module-page";
import { ModuleHeader, Chargement, Erreur } from "@/components/super-admin-page";

type Integration = {
  id: string;
  nom: string;
  categorie: string;
  role: string;
  statut: "operationnel" | "configure_serveur" | "non_configure" | "inconnu";
  detail: string;
  action?: { label: string; href: string };
};

function badge(statut: Integration["statut"]) {
  switch (statut) {
    case "operationnel":
      return "border-[#5D9E7F]/40 bg-[#5D9E7F]/10 text-[#7FBF9E]";
    case "configure_serveur":
      return "border-[#D6A34D]/40 bg-[#D6A34D]/10 text-[#D6A34D]";
    case "non_configure":
      return "border-[#C5716B]/40 bg-[#C5716B]/10 text-[#C5716B]";
    default:
      return "border-[#8FB59B]/30 bg-[#344440] text-[#A7B7A8]";
  }
}

function labelStatut(statut: Integration["statut"]) {
  switch (statut) {
    case "operationnel":
      return "Opérationnel (constaté)";
    case "configure_serveur":
      return "Configuration serveur requise / non constatable ici";
    case "non_configure":
      return "Non configuré";
    default:
      return "État inconnu";
  }
}

export default function IntegrationsPage() {
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [invTotal, setInvTotal] = useState(0);
  const [invEmail, setInvEmail] = useState(0);
  const [invWhatsapp, setInvWhatsapp] = useState(0);

  useEffect(() => {
    let vivant = true;
    void (async () => {
      if (!supabase) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setErreur(null);
      const { data, error } = await supabase
        .from("invitations")
        .select("id, email_status, whatsapp_status");
      if (!vivant) return;
      if (error) {
        // Table peut être absente si migrations non appliquées : on reste honnête.
        setErreur(null);
      } else {
        const rows = data ?? [];
        setInvTotal(rows.length);
        setInvEmail(rows.filter((r) => r.email_status === "accepte_par_fournisseur").length);
        setInvWhatsapp(rows.filter((r) => r.whatsapp_status === "accepte_par_fournisseur").length);
      }
      setLoading(false);
    })();
    return () => {
      vivant = false;
    };
  }, []);

  const supabaseOk = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

  const integrations = useMemo<Integration[]>(
    () => [
      {
        id: "supabase",
        nom: "Supabase (base de données, Auth, RLS)",
        categorie: "Plateforme",
        role: "Stockage, authentification, isolation multi-tenant et RPC métier.",
        statut: supabaseOk ? "operationnel" : "non_configure",
        detail: supabaseOk
          ? "Variables publiques présentes côté application. L’état détaillé (migrations, politiques, Edge Functions déployées) doit être vérifié côté projet Supabase."
          : "Variables NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY absentes.",
      },
      {
        id: "resend",
        nom: "Resend (e-mail transactionnel)",
        categorie: "Communication",
        role: "Envoi des invitations et e-mails transactionnels via Edge Function `send-invitation`.",
        statut: "configure_serveur",
        detail:
          "La clé API Resend est un secret serveur : son état n’est pas constatable depuis le navigateur. Les statuts réels d’envoi sont enregistrés par canal dans les invitations lorsque l’Edge Function est déployée et configurée.",
        action: { label: "Suivi des invitations", href: "/super-admin/invitations/" },
      },
      {
        id: "meta",
        nom: "Meta WhatsApp Business",
        categorie: "Communication",
        role: "Envoi WhatsApp des invitations et messages transactionnels via l’API Meta.",
        statut: "configure_serveur",
        detail:
          "Jeton, identifiants et templates sont des secrets serveur. Aucun envoi réel sans configuration Meta validée, template approuvé et webhooks de statut.",
        action: { label: "WhatsApp Business", href: "/super-admin/whatsapp/" },
      },
      {
        id: "ia",
        nom: "Fournisseur IA (Chatbot)",
        categorie: "Automatisation",
        role: "Réponses assistées et automatisations conversationnelles.",
        statut: "non_configure",
        detail:
          "Aucun fournisseur IA n’est connecté. Les clés, quotas, isolation des données et journalisation doivent être configurés côté serveur avant activation.",
        action: { label: "Chatbot IA", href: "/super-admin/chatbot/" },
      },
      {
        id: "webhooks",
        nom: "Webhooks (livraison / paiements / événements)",
        categorie: "API",
        role: "Réception des confirmations fournisseur (e-mail, WhatsApp, paiement).",
        statut: "non_configure",
        detail:
          "Aucun endpoint webhook de livraison/paiement n’est déclaré comme opérationnel dans l’application. À implémenter avec vérification de signature, idempotence et journalisation.",
      },
    ],
    [supabaseOk],
  );

  return (
    <ModulePage titre="Intégrations & API">
      <ModuleHeader
        surtitre="AUTO DYALI · Plateforme"
        titre="Intégrations & API"
        description="Inventaire des intégrations et état réel constatable. Les secrets (clés API, jetons, webhooks signés) restent côté serveur et ne sont jamais affichés."
      />

      {erreur && (
        <div className="mt-4">
          <Erreur message={erreur} />
        </div>
      )}

      {loading ? (
        <div className="mt-6">
          <Chargement />
        </div>
      ) : (
        <>
          <section className="mt-6 grid gap-4 sm:grid-cols-3">
            <article className="carte-premium p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-[#A7B7A8]">Intégrations suivies</p>
              <p className="titre-or mt-2 text-3xl font-extrabold">{integrations.length}</p>
              <p className="mt-1 text-[11px] text-[#A7B7A8]">Inventaire plateforme (non exhaustif des outils tiers futurs).</p>
            </article>
            <article className="carte-premium p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-[#A7B7A8]">Invitations (historique)</p>
              <p className="titre-or mt-2 text-3xl font-extrabold">{invTotal}</p>
              <p className="mt-1 text-[11px] text-[#A7B7A8]">E-mail acceptés fournisseur : {invEmail} · WhatsApp : {invWhatsapp}</p>
            </article>
            <article className="carte-premium p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-[#A7B7A8]">Secrets exposés</p>
              <p className="titre-or mt-2 text-3xl font-extrabold text-[#7FBF9E]">0</p>
              <p className="mt-1 text-[11px] text-[#A7B7A8]">Aucune clé API ou jeton n’est lu/affiché côté navigateur.</p>
            </article>
          </section>

          <div className="carte mt-6 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-left text-sm">
                <thead className="bg-[#344440]/50 text-xs uppercase text-[#A7B7A8]">
                  <tr>
                    <th className="px-5 py-3">Intégration</th>
                    <th className="px-5 py-3">Catégorie</th>
                    <th className="px-5 py-3">Rôle</th>
                    <th className="px-5 py-3">Statut</th>
                    <th className="px-5 py-3">Détail / action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#8FB59B]/10">
                  {integrations.map((i) => (
                    <tr key={i.id}>
                      <td className="px-5 py-4 font-semibold text-[#E8ECE8]">{i.nom}</td>
                      <td className="px-5 py-4 text-[#A7B7A8]">{i.categorie}</td>
                      <td className="px-5 py-4 text-[#A7B7A8]">{i.role}</td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${badge(i.statut)}`}>
                          {labelStatut(i.statut)}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-xs text-[#A7B7A8]">
                        <p>{i.detail}</p>
                        {i.action && (
                          <Link href={i.action.href} className="mt-2 inline-block text-[#8FB59B] hover:underline">
                            {i.action.label} →
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="carte-premium mt-6 p-5">
            <h2 className="font-bold">Contrôles et journaux</h2>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-[#A7B7A8]">
              <li>Les tests de connexion réels aux fournisseurs externes nécessitent des secrets serveur et des appels contrôlés (Edge Functions) — non exécutables depuis le navigateur.</li>
              <li>Les erreurs d’envoi sont tracées par canal dans les événements d’invitation lorsque les fonctions sont déployées.</li>
              <li>Les actions sensibles de configuration doivent être journalisées dans le journal d’activité.</li>
            </ul>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/super-admin/whatsapp/" className="rounded-lg border border-[#8FB59B]/40 px-4 py-2 text-sm text-[#DFE7E2] hover:bg-[#344440]">WhatsApp Business</Link>
              <Link href="/super-admin/chatbot/" className="rounded-lg border border-[#8FB59B]/40 px-4 py-2 text-sm text-[#DFE7E2] hover:bg-[#344440]">Chatbot IA</Link>
              <Link href="/super-admin/invitations/" className="rounded-lg border border-[#8FB59B]/40 px-4 py-2 text-sm text-[#DFE7E2] hover:bg-[#344440]">Invitations</Link>
              <Link href="/super-admin/audit/" className="rounded-lg border border-[#8FB59B]/40 px-4 py-2 text-sm text-[#DFE7E2] hover:bg-[#344440]">Journal d’activité</Link>
            </div>
          </div>
        </>
      )}
    </ModulePage>
  );
}
