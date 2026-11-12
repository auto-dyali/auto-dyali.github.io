"use client";

/**
 * AUTO DYALI — Super Admin › Journal d'audit
 * Historique réel des actions sensibles (audit_log). Recherche,
 * pagination serveur, export CSV. Aucun secret n'est journalisé.
 */

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase-browser";
import { ModulePage } from "@/components/super-admin-module-page";
import { ModuleHeader, Chargement, Vide, Erreur } from "@/components/super-admin-page";
import { downloadCsv } from "@/lib/csv-export";

type Row = { id: string; action: string; entity: string; entity_id: string | null; payload_json: unknown; created_at: string };

const TAILLE = 20;

export default function AuditPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [recherche, setRecherche] = useState("");

  useEffect(() => {
    let vivant = true;
    const charger = async () => {
      if (!supabase) return;
      setLoading(true);
      setErreur(null);
      const q = recherche.trim().replace(/[,%()]/g, " ");
      let query = supabase.from("audit_log").select("id, action, entity, entity_id, payload_json, created_at", { count: "exact" });
      if (q) query = query.or(`action.ilike.%${q}%,entity.ilike.%${q}%`);
      const { data, error, count } = await query.order("created_at", { ascending: false }).range((page - 1) * TAILLE, page * TAILLE - 1);
      if (!vivant) return;
      if (error) setErreur(error.message);
      else {
        setRows((data ?? []) as Row[]);
        setTotal(count ?? 0);
      }
      setLoading(false);
    };
    void charger();
    return () => {
      vivant = false;
    };
  }, [page, recherche]);

  const totalPages = Math.max(1, Math.ceil(total / TAILLE));

  function resumePayload(p: unknown): string {
    if (p === null || p === undefined) return "—";
    try {
      const s = JSON.stringify(p);
      return s.length > 140 ? `${s.slice(0, 140)}…` : s;
    } catch {
      return String(p);
    }
  }

  async function exporter() {
    if (!supabase) return;
    const q = recherche.trim();
    let query = supabase.from("audit_log").select("id, action, entity, entity_id, payload_json, created_at");
    if (q) query = query.or(`action.ilike.%${q.replace(/[,%()]/g, " ")}%,entity.ilike.%${q.replace(/[,%()]/g, " ")}%`);
    const { data, error } = await query.order("created_at", { ascending: false }).limit(2000);
    if (error) { setErreur(error.message); return; }
    downloadCsv(
      `auto-dyali-audit-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Date", "Action", "Entité", "ID cible", "Contexte"],
      ((data ?? []) as Row[]).map((r) => [new Date(r.created_at).toLocaleString("fr-FR"), r.action, r.entity, r.entity_id ?? "", resumePayload(r.payload_json)])
    );
  }

  return (
    <ModulePage titre="Journal d'audit">
      <ModuleHeader
        surtitre="AUTO DYALI · Sécurité"
        titre="Journal d'audit"
        description="Historique réel des opérations sensibles effectuées sur la plateforme. Recherche serveur, pagination, export CSV — sans secrets."
        action={<button type="button" onClick={() => void exporter()} className="rounded-lg border border-[#8FB59B]/40 px-4 py-2 text-sm text-[#DFE7E2] hover:bg-[#344440]">Exporter CSV</button>}
      />

      <div className="carte-premium mt-6 flex flex-col gap-3 p-4 sm:flex-row sm:items-end sm:justify-between">
        <label className="text-xs text-[#A7B7A8]">
          Recherche (action ou entité)
          <input type="search" value={recherche} onChange={(e) => { setRecherche(e.target.value); setPage(1); }} placeholder="change_plan, onboard_tenant, establishment…" className="champ mt-1 min-h-11 w-full sm:w-96" aria-label="Rechercher dans le journal" />
        </label>
        <p className="text-xs text-[#A7B7A8]"><span className="text-lg font-extrabold text-[#E8ECE8]">{total}</span> entrée(s)</p>
      </div>

      {erreur && <div className="mt-4"><Erreur message={erreur} /></div>}

      {loading ? (
        <div className="mt-6"><Chargement /></div>
      ) : rows.length === 0 ? (
        <div className="mt-6"><Vide titre="Journal vide" detail={recherche ? "Aucune entrée ne correspond." : "Aucune action sensible enregistrée."} /></div>
      ) : (
        <>
          <div className="carte mt-6 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead className="bg-[#344440]/50 text-xs uppercase text-[#A7B7A8]">
                  <tr><th className="px-5 py-3">Date</th><th className="px-5 py-3">Action</th><th className="px-5 py-3">Entité</th><th className="px-5 py-3">ID</th><th className="px-5 py-3">Contexte</th></tr>
                </thead>
                <tbody className="divide-y divide-[#8FB59B]/10">
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td className="px-5 py-3 text-[11px] text-[#A7B7A8]">{new Date(r.created_at).toLocaleString("fr-FR")}</td>
                      <td className="px-5 py-3 font-semibold text-[#E8ECE8]">{r.action}</td>
                      <td className="px-5 py-3 text-[#A7B7A8]">{r.entity}</td>
                      <td className="px-5 py-3 text-[11px] text-[#A7B7A8]">{r.entity_id ?? "—"}</td>
                      <td className="px-5 py-3 text-[11px] text-[#A7B7A8]">{resumePayload(r.payload_json)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="rounded-lg border border-[#8FB59B]/40 px-4 py-2 text-sm text-[#DFE7E2] disabled:opacity-40">Précédent</button>
            <span className="text-sm text-[#A7B7A8]">page {page} / {totalPages}</span>
            <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="rounded-lg border border-[#8FB59B]/40 px-4 py-2 text-sm text-[#DFE7E2] disabled:opacity-40">Suivant</button>
          </div>
        </>
      )}
    </ModulePage>
  );
}
