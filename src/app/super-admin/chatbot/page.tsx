"use client";

/**
 * AUTO DYALI — Super Admin › Chatbot IA & automatisations
 * Statut RÉEL : aucun moteur d'IA/chatbot n'est connecté à la
 * plateforme. Affiche les droits par forfait (réels) et le
 * plan d'activation — aucun aperçu fictif n'est inventé.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase-browser";
import { ModulePage } from "@/components/super-admin-module-page";
import { ModuleHeader, Chargement, Erreur } from "@/components/super-admin-page";

export default function ChatbotPage() {
  const [droits, setDroits] = useState<{ plan_code: string; feature_key: string; enabled: boolean }[]>([]);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      if (!supabase) return;
      setLoading(true);
      const { data, error } = await supabase.from("plan_features").select("plan_code, feature_key, enabled").in("feature_key", ["ai", "automation"]);
      if (error) setErreur(error.message);
      else setDroits((data ?? []) as { plan_code: string; feature_key: string; enabled: boolean }[]);
      setLoading(false);
    })();
  }, []);

  const resume = useMemo(() => {
    const m = new Map<string, { ai: boolean; automation: boolean }>();
    for (const d of droits) {
      const cur = m.get(d.plan_code) ?? { ai: false, automation: false };
      if (d.feature_key === "ai") cur.ai = d.enabled;
      if (d.feature_key === "automation") cur.automation = d.enabled;
      m.set(d.plan_code, cur);
    }
    return [...m.entries()];
  }, [droits]);

  return (
    <ModulePage titre="Chatbot IA">
      <ModuleHeader
        surtitre="AUTO DYALI · Automatisations"
        titre="Chatbot IA & automatisations"
        description="Supervision centrale du chatbot et des automatisations. Aucun moteur n'est connecté : aucune conversation, quota ou réponse n'est inventé."
      />

      <div className="carte-premium mt-6 border-l-4 border-[#C5716B] p-5">
        <h2 className="font-bold text-[#E8ECE8]">Chatbot non opérationnel</h2>
        <p className="mt-2 text-sm text-[#A7B7A8]">
          Aucun fournisseur d’IA n’est relié à AUTO DYALI. Le module Assistant existe côté tenant pour les forfaits autorisés
          via le moteur de droits, mais aucune supervision centrale (configuration, quotas, consommation, erreurs) n’est active.
        </p>
      </div>

      {erreur && <div className="mt-4"><Erreur message={erreur} /></div>}

      {loading ? (
        <div className="mt-6"><Chargement /></div>
      ) : (
        <>
          <div className="carte mt-6 overflow-hidden">
            <div className="border-b border-[#8FB59B]/10 p-5">
              <h2 className="font-bold">Droits par forfait (réels)</h2>
              <p className="mt-1 text-xs text-[#A7B7A8]">Ce que chaque forfait autorise aujourd’hui — modifiable depuis Plans &amp; fonctionnalités.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="bg-[#344440]/50 text-xs uppercase text-[#A7B7A8]"><tr><th className="px-5 py-3">Forfait</th><th className="px-5 py-3 text-center">AUTO DYALI AI</th><th className="px-5 py-3 text-center">Automatisations</th></tr></thead>
                <tbody className="divide-y divide-[#8FB59B]/10">
                  {resume.map(([code, d]) => (
                    <tr key={code}>
                      <td className="px-5 py-4 font-semibold uppercase">{code}</td>
                      <td className="px-5 py-4 text-center">{d.ai ? "Activé" : "Désactivé"}</td>
                      <td className="px-5 py-4 text-center">{d.automation ? "Activé" : "Désactivé"}</td>
                    </tr>
                  ))}
                  {resume.length === 0 && <tr><td colSpan={3} className="px-5 py-6 text-center text-sm text-[#A7B7A8]">Aucun droit IA configuré.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          <div className="carte-premium mt-6 p-5">
            <h2 className="font-bold">Plan d’activation</h2>
            <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-[#A7B7A8]">
              <li>Choisir le fournisseur (API OpenAI / Anthropic / modèle hébergé) et signer les conditions.</li>
              <li>Clés côté serveur uniquement (Edge Function) ; quotas et budget par établissement.</li>
              <li>Isolation stricte : prompts et historiques par établissement, RLS appliquée.</li>
              <li>Journalisation des métadonnées uniquement (pas de contenu privé, pas de secrets).</li>
              <li>Pilote avec 1 à 2 établissements volontaires, mesure de satisfaction, puis généralisation.</li>
            </ol>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/super-admin/plans/" className="btn-or px-4 py-2 text-sm">Activer AI / Automations par forfait</Link>
              <Link href="/super-admin/rapports/" className="rounded-lg border border-[#8FB59B]/40 px-4 py-2 text-sm text-[#DFE7E2] hover:bg-[#344440]">Voir les rapports</Link>
            </div>
          </div>
        </>
      )}
    </ModulePage>
  );
}
