"use client";

/**
 * AUTO DYALI — Super Admin › Garages & établissements
 * Vue des établissements par forfait avec les limites réellement
 * configurées dans `plans`, actions suspendre/réactiver via RPC.
 */

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase-browser";
import { ModulePage } from "@/components/super-admin-module-page";
import { ModuleHeader, Chargement, Vide, Erreur } from "@/components/super-admin-page";
import { downloadCsv, dateFrCourte } from "@/lib/csv-export";

type Etab = {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  plan: string;
  is_active: boolean;
  created_at: string;
};
type Plan = {
  code: string;
  label: string;
  price_monthly: number | null;
  max_users: number;
  max_sites: number;
  storage_mb: number;
};

export default function GaragesPage() {
  const [rows, setRows] = useState<Etab[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [recherche, setRecherche] = useState("");
  const [traitement, setTraitement] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      if (!supabase) return;
      setLoading(true);
      const [e, p] = await Promise.all([
        supabase.from("establishments").select("id, name, slug, city, plan, is_active, created_at").order("created_at", { ascending: false }),
        supabase.from("plans").select("code, label, price_monthly, max_users, max_sites, storage_mb").order("price_monthly"),
      ]);
      if (e.error) setErreur(e.error.message);
      else setRows((e.data ?? []) as Etab[]);
      if (p.error) setErreur(p.error.message);
      else setPlans((p.data ?? []) as Plan[]);
      setLoading(false);
    })();
  }, []);

  const synthese = useMemo(
    () =>
      plans.map((p) => ({
        ...p,
        nombre: rows.filter((r) => r.plan === p.code).length,
      })),
    [plans, rows]
  );

  const visibles = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => [r.name, r.slug, r.city, r.plan].filter(Boolean).some((v) => String(v).toLowerCase().includes(q)));
  }, [rows, recherche]);

  async function basculer(row: Etab) {
    if (!supabase) return;
    setTraitement(row.id);
    setNotice(null);
    setErreur(null);
    const { error } = await supabase.rpc("admin_set_establishment_status", { p_establishment_id: row.id, p_active: !row.is_active });
    if (error) setErreur(error.message);
    else setNotice(row.is_active ? `« ${row.name} » suspendue.` : `« ${row.name} » réactivée.`);
    const { data } = await supabase.from("establishments").select("id, name, slug, city, plan, is_active, created_at").order("created_at", { ascending: false });
    if (data) setRows(data as Etab[]);
    setTraitement(null);
  }

  function exporter() {
    downloadCsv(
      `auto-dyali-etablissements-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Établissement", "Slug", "Ville", "Forfait", "État", "Inscription"],
      visibles.map((r) => [r.name, r.slug, r.city, r.plan.toUpperCase(), r.is_active ? "Actif" : "Suspendu", dateFrCourte(r.created_at)])
    );
  }

  return (
    <ModulePage titre="Garages & établissements">
      <ModuleHeader
        surtitre="AUTO DYALI · Multi-établissements"
        titre="Garages & établissements"
        description="Établissements par forfait avec les limites réellement configurées dans plans (utilisateurs max, sites max, stockage). Actions journalisées côté serveur."
        action={<button type="button" onClick={exporter} className="rounded-lg border border-[#8FB59B]/40 px-4 py-2 text-sm text-[#DFE7E2] hover:bg-[#344440]">Exporter CSV</button>}
      />

      {/* Synthèse par forfait (limites réelles des plans) */}
      {loading ? (
        <div className="mt-6"><Chargement /></div>
      ) : (
        <>
          <section className="mt-6 grid gap-4 sm:grid-cols-3">
            {synthese.map((p) => (
              <article key={p.code} className="carte-premium p-5">
                <div className="flex items-center justify-between">
                  <h2 className="font-bold">{p.label}</h2>
                  <span className="titre-or text-2xl font-extrabold">{p.nombre}</span>
                </div>
                <ul className="mt-3 space-y-1 text-xs text-[#A7B7A8]">
                  <li>Prix mensuel : {p.price_monthly != null ? `${p.price_monthly} MAD` : "non configuré"}</li>
                  <li>Utilisateurs max : {p.max_users}</li>
                  <li>Sites max : {p.max_sites}</li>
                  <li>Stockage : {p.storage_mb} Mo</li>
                </ul>
              </article>
            ))}
          </section>

          {notice && <p role="status" className="mt-4 rounded-lg bg-[#5D9E7F]/10 px-4 py-3 text-sm text-[#7FBF9E]">{notice}</p>}
          {erreur && <div className="mt-4"><Erreur message={erreur} /></div>}

          <div className="carte-premium mt-6 p-4">
            <label className="text-xs text-[#A7B7A8]">
              Recherche
              <input type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Établissement, slug, ville, forfait…" className="champ mt-1 min-h-11 w-full" aria-label="Rechercher un établissement" />
            </label>
          </div>

          {visibles.length === 0 ? (
            <div className="mt-6"><Vide titre="Aucun établissement" detail={recherche ? "Aucun résultat." : "Aucun établissement enregistré."} /></div>
          ) : (
            <div className="carte mt-6 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="bg-[#344440]/50 text-xs uppercase text-[#A7B7A8]">
                    <tr>
                      <th className="px-5 py-3">Établissement</th>
                      <th className="px-5 py-3">Ville</th>
                      <th className="px-5 py-3">Forfait</th>
                      <th className="px-5 py-3">État</th>
                      <th className="px-5 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#8FB59B]/10">
                    {visibles.map((r) => (
                      <tr key={r.id}>
                        <td className="px-5 py-4"><p className="font-semibold">{r.name}</p><p className="text-[11px] text-[#A7B7A8]">{r.slug} · inscrit le {dateFrCourte(r.created_at)}</p></td>
                        <td className="px-5 py-4 text-[#A7B7A8]">{r.city ?? "—"}</td>
                        <td className="px-5 py-4 uppercase">{r.plan}</td>
                        <td className={`px-5 py-4 font-semibold ${r.is_active ? "text-[#5D9E7F]" : "text-[#C5716B]"}`}>{r.is_active ? "Actif" : "Suspendu"}</td>
                        <td className="px-5 py-4 text-right">
                          <button type="button" disabled={traitement === r.id} onClick={() => void basculer(r)} className="rounded-lg border border-[#8FB59B]/40 px-3 py-1.5 text-xs text-[#E8ECE8] hover:bg-[#344440] disabled:opacity-40">
                            {traitement === r.id ? "…" : r.is_active ? "Suspendre" : "Réactiver"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </ModulePage>
  );
}
