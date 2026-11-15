"use client";

/**
 * AUTO DYALI — Super Admin › Pré-achats & demandes commerciales
 * Suivi des demandes de pré-achat/souscription (lecture/gestion).
 * Les états doivent refléter des situations réelles : aucun paiement n'est
 * marqué confirmé sans preuve du fournisseur (non intégré ici).
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase-browser";
import { ModulePage } from "@/components/super-admin-module-page";
import { ModuleHeader, Chargement, Vide, Erreur } from "@/components/super-admin-page";
import { downloadCsv, dateFrCourte } from "@/lib/csv-export";
import { ETAT_LABEL, ETATS_PRE_ACHAT, type EtatPreAchat, formatMontantMAD } from "@/lib/pre-purchase";
import { useNotification } from "@/lib/use-notification";

type RequestRow = {
  id: string;
  request_key: string | null;
  status: EtatPreAchat | string;
  company_name: string;
  legal_name: string | null;
  professional_id: string | null;
  sector: string | null;
  business_type: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  manager_name: string | null;
  plan_code: string | null;
  period: string | null;
  desired_users: number | null;
  desired_sites: number | null;
  desired_modules: unknown;
  configured_amount: number | null;
  currency: string | null;
  notes: string | null;
  refusal_reason: string | null;
  submitted_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

const TRANSITIONS: Record<string, EtatPreAchat[]> = {
  brouillon: ["soumis", "annule"],
  soumis: ["en_attente_verification", "refuse", "annule"],
  en_attente_verification: ["en_attente_paiement", "valide", "refuse", "annule"],
  en_attente_paiement: ["valide", "refuse", "annule"], // paiement_confirme uniquement avec preuve fournisseur (non automatisé ici)
  paiement_confirme: ["valide", "refuse", "annule"],
  valide: ["compte_cree", "annule"],
  compte_cree: ["invitation_envoyee", "annule"],
  invitation_envoyee: ["compte_active", "annule"],
  compte_active: [],
  refuse: [],
  annule: [],
};

function labelEtat(s: string): string {
  return (ETAT_LABEL as Record<string, string>)[s] ?? s;
}

export default function PreAchatsPage() {
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [recherche, setRecherche] = useState("");
  const [filtreEtat, setFiltreEtat] = useState<string>("tous");
  const [filtrePlan, setFiltrePlan] = useState<string>("tous");
  const [selection, setSelection] = useState<RequestRow | null>(null);
  const [traitement, setTraitement] = useState<string | null>(null);
  const { success, error: notifyError } = useNotification();

  useEffect(() => { void charger(); }, []);

  async function charger() {
    if (!supabase) { setLoading(false); setErreur("Configuration indisponible."); return; }
    setLoading(true);
    setErreur(null);
    const { data, error } = await supabase
      .from("pre_purchase_requests")
      .select("*")
      .order("submitted_at", { ascending: false, nullsFirst: false });
    if (error) {
      const msg = (error.message || "").toLowerCase();
      if (msg.includes("does not exist") || msg.includes("relation") || msg.includes("schema cache") || msg.includes("404")) {
        setErreur("Le module de pré-achats n'est pas encore disponible côté serveur (table/migration non appliquée). Les demandes soumises ne peuvent pas être listées tant que la migration préparée n'est pas appliquée avec autorisation.");
      } else if (msg.includes("permission") || msg.includes("rls") || msg.includes("jwt")) {
        setErreur(`Accès refusé ou non autorisé pour lire les pré-achats : ${error.message}`);
      } else {
        setErreur(error.message);
      }
      setRows([]);
    } else {
      setRows((data ?? []) as RequestRow[]);
    }
    setLoading(false);
  }

  const visibles = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return rows.filter((r) => {
      if (filtreEtat !== "tous" && r.status !== filtreEtat) return false;
      if (filtrePlan !== "tous" && (r.plan_code || "") !== filtrePlan) return false;
      if (!q) return true;
      return [r.company_name, r.legal_name, r.email, r.phone, r.city, r.manager_name, r.plan_code, r.status]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [rows, recherche, filtreEtat, filtrePlan]);

  async function changerStatut(row: RequestRow, to: EtatPreAchat) {
    if (!supabase) return;
    if (to === "paiement_confirme") {
      notifyError({ title: "Action refusée", message: "Un paiement ne peut être marqué confirmé que sur preuve réelle du fournisseur de paiement. Cette action n'est pas automatisée." });
      return;
    }
    setTraitement(row.id);
    setNotice(null);
    setErreur(null);
    const { error } = await supabase
      .from("pre_purchase_requests")
      .update({ status: to, updated_at: new Date().toISOString() })
      .eq("id", row.id);
    if (error) {
      notifyError({ title: "Mise à jour impossible", message: error.message });
    } else {
      success({ title: "Statut mis à jour", message: `Demande « ${row.company_name} » : ${labelEtat(to)}.` });
      await charger();
      if (selection?.id === row.id) setSelection((s) => s ? { ...s, status: to } : s);
    }
    setTraitement(null);
  }

  function exporter() {
    downloadCsv(
      `auto-dyali-pre-achats-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Entreprise", "Raison sociale", "Email", "Téléphone", "Ville", "Manager", "Forfait", "Période", "Utilisateurs", "Établissements", "Montant", "Statut", "Soumis le"],
      visibles.map((r) => [
        r.company_name, r.legal_name, r.email, r.phone, r.city, r.manager_name, r.plan_code,
        r.period, r.desired_users, r.desired_sites, formatMontantMAD(r.configured_amount),
        labelEtat(r.status), dateFrCourte(r.submitted_at || r.created_at),
      ])
    );
  }

  return (
    <ModulePage titre="Pré-achats">
      <ModuleHeader
        surtitre="AUTO DYALI · Commercial"
        titre="Pré-achats & demandes de souscription"
        description="Suivi des demandes de pré-achat : vérification, validation, conversion et activation. Aucun paiement n'est marqué confirmé sans preuve fournisseur. La création réelle de comptes/entreprises nécessite autorisation et exécution contrôlée (gel P0)."
        action={
          <>
            <button type="button" onClick={exporter} className="rounded-lg border border-[#8FB59B]/40 px-4 py-2 text-sm text-[#DFE7E2] hover:bg-[#344440]">Exporter CSV</button>
            <Link href="/offres/" className="rounded-lg border border-[#8FB59B]/40 px-4 py-2 text-sm text-[#DFE7E2] hover:bg-[#344440]">Voir les offres</Link>
          </>
        }
      />

      <div className="carte-premium mt-6 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs text-[#A7B7A8]">Recherche<input type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Entreprise, email, manager, ville…" className="champ mt-1 min-h-11 w-full" /></label>
        <label className="text-xs text-[#A7B7A8]">État<select value={filtreEtat} onChange={(e) => setFiltreEtat(e.target.value)} className="champ mt-1 min-h-11"><option value="tous">Tous</option>{ETATS_PRE_ACHAT.map((s) => <option key={s} value={s}>{labelEtat(s)}</option>)}</select></label>
        <label className="text-xs text-[#A7B7A8]">Forfait<select value={filtrePlan} onChange={(e) => setFiltrePlan(e.target.value)} className="champ mt-1 min-h-11"><option value="tous">Tous</option><option value="standard">STANDARD</option><option value="silver">SILVER</option><option value="gold">GOLD</option></select></label>
        <div className="flex items-end"><p className="text-xs text-[#A7B7A8]"><span className="text-lg font-extrabold text-[#E8ECE8]">{visibles.length}</span> / {rows.length} demandes</p></div>
      </div>

      {notice && <p role="status" className="mt-4 rounded-lg bg-[#5D9E7F]/10 px-4 py-3 text-sm text-[#7FBF9E]">{notice}</p>}
      {erreur && <div className="mt-4"><Erreur message={erreur} /></div>}

      {loading ? (
        <div className="mt-6"><Chargement /></div>
      ) : visibles.length === 0 && !erreur ? (
        <div className="mt-6"><Vide titre="Aucune demande de pré-achat" detail={rows.length ? "Aucun résultat pour ces filtres." : "Aucune demande enregistrée pour le moment, ou table non disponible côté serveur."} /></div>
      ) : (
        <div className="mt-6 grid gap-4 xl:grid-cols-[1.4fr,1fr]">
          <div className="carte overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead className="bg-[#344440]/50 text-xs uppercase text-[#A7B7A8]">
                  <tr>
                    <th className="px-5 py-3">Entreprise</th>
                    <th className="px-5 py-3">Manager</th>
                    <th className="px-5 py-3">Forfait</th>
                    <th className="px-5 py-3">Montant</th>
                    <th className="px-5 py-3">État</th>
                    <th className="px-5 py-3 text-right">Détail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#8FB59B]/10">
                  {visibles.map((r) => (
                    <tr key={r.id} className={selection?.id === r.id ? "bg-[#344440]/20" : ""}>
                      <td className="px-5 py-4"><p className="font-semibold">{r.company_name}</p><p className="text-[11px] text-[#A7B7A8]">{r.city ?? "—"} · {dateFrCourte(r.submitted_at || r.created_at)}</p></td>
                      <td className="px-5 py-4"><p>{r.manager_name ?? "—"}</p><p className="text-[11px] text-[#A7B7A8]">{r.email ?? "—"}</p></td>
                      <td className="px-5 py-4 uppercase text-xs">{r.plan_code ?? "—"} <span className="normal-case text-[#A7B7A8]">({r.period ?? "—"})</span></td>
                      <td className="px-5 py-4 text-xs">{formatMontantMAD(r.configured_amount)}</td>
                      <td className="px-5 py-4"><span className="rounded-full bg-[#344440] px-2.5 py-1 text-[11px] font-semibold text-[#E8ECE8]">{labelEtat(r.status)}</span></td>
                      <td className="px-5 py-4 text-right"><button type="button" onClick={() => setSelection(r)} className="rounded-lg border border-[#8FB59B]/40 px-3 py-1.5 text-xs hover:bg-[#344440]">Ouvrir</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <aside className="carte-premium p-5">
            {!selection ? (
              <div className="text-sm text-[#A7B7A8]"><p className="font-semibold text-[#E8ECE8]">Détail de la demande</p><p className="mt-2">Sélectionnez une demande pour consulter ses informations, son historique d’état prévu et les actions disponibles.</p></div>
            ) : (
              <div className="space-y-4 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-[#A7B7A8]">Demande</p>
                    <h2 className="titre-or mt-1 text-lg font-extrabold">{selection.company_name}</h2>
                    <p className="text-xs text-[#A7B7A8]">{selection.legal_name || "—"}</p>
                  </div>
                  <button type="button" onClick={() => setSelection(null)} className="text-[#A7B7A8] hover:text-[#E8ECE8]">Fermer</button>
                </div>
                <div className="grid gap-2 text-xs">
                  <Info label="Référence" value={selection.request_key || selection.id} mono />
                  <Info label="État" value={labelEtat(selection.status)} />
                  <Info label="Manager désigné" value={selection.manager_name} />
                  <Info label="E-mail / Téléphone" value={[selection.email, selection.phone].filter(Boolean).join(" · ") || "—"} />
                  <Info label="Ville / Adresse" value={[selection.city, selection.address].filter(Boolean).join(" · ") || "—"} />
                  <Info label="Secteur / Métier" value={[selection.sector, selection.business_type].filter(Boolean).join(" · ") || "—"} />
                  <Info label="Forfait / Période" value={`${(selection.plan_code || "—").toUpperCase()} · ${selection.period || "—"}`} />
                  <Info label="Utilisateurs / Établissements" value={`${selection.desired_users ?? "—"} / ${selection.desired_sites ?? "—"}`} />
                  <Info label="Montant configuré" value={formatMontantMAD(selection.configured_amount)} />
                  <Info label="Soumise le" value={dateFrCourte(selection.submitted_at || selection.created_at) || "—"} />
                </div>
                <div className="rounded-lg bg-[#252D2D] p-3 text-xs text-[#A7B7A8]">
                  <p className="font-semibold text-[#E8ECE8]">Actions & règles</p>
                  <p className="mt-1">• « Paiement confirmé » exige une preuve réelle du fournisseur (action non automatisée).</p>
                  <p>• La conversion en abonné (entreprise, Manager, forfait, établissement, modules, invitation) requiert un flux serveur autorisé, idempotent et tracé (gel P0 pour opérations distantes réelles).</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-[#A7B7A8]">Changer l’état</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(TRANSITIONS[selection.status] || []).map((to) => (
                      <button key={to} type="button" disabled={traitement === selection.id} onClick={() => void changerStatut(selection, to)} className="rounded-lg border border-[#8FB59B]/40 px-3 py-1.5 text-xs hover:bg-[#344440] disabled:opacity-40">
                        {traitement === selection.id ? "…" : labelEtat(to)}
                      </button>
                    ))}
                    {!(TRANSITIONS[selection.status] || []).length && <p className="text-xs text-[#A7B7A8]">Aucune transition disponible depuis cet état.</p>}
                  </div>
                </div>
              </div>
            )}
          </aside>
        </div>
      )}
    </ModulePage>
  );
}

function Info({ label, value, mono }: { label: string; value: string | null | undefined; mono?: boolean }) {
  return (
    <div className="rounded-lg bg-[#252D2D] p-3">
      <p className="uppercase text-[#A7B7A8]">{label}</p>
      <p className={`mt-1 text-[#E8ECE8] ${mono ? "break-all font-mono" : ""}`}>{value || "—"}</p>
    </div>
  );
}
