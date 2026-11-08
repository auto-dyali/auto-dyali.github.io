"use client";

import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase-browser";

/**
 * Module chèques — §13 du cahier des charges.
 * Capture image (URL), OCR des champs lisibles (saisie corrigible par l'humain),
 * échéances, statuts et alertes J-7 / J-3 / J-1 via RPC `cheques_echeances_proches()`.
 * Le CMC7/MICR nécessite un lecteur magnétique dédié : non simulé ici.
 */

type Cheque = {
  id: string;
  bank: string;
  number: string;
  beneficiary: string;
  amount: number;
  issue_date: string | null;
  received_date: string | null;
  due_date: string | null;
  status: string;
  image_url: string | null;
  notes: string | null;
};

const STATUTS: Record<string, { label: string; classe: string }> = {
  en_attente: { label: "En attente", classe: "bg-[#8FB59B]/15 text-[#DFE7E2]" },
  encaisse: { label: "Encaissé", classe: "bg-[#8DA298]/20 text-[#8DA298]" },
  rejete: { label: "Rejeté", classe: "bg-[#C5716B]/15 text-[#C5716B]" },
  annule: { label: "Annulé", classe: "bg-[#344440] text-[#A7B7A8]" },
};

const URGENCES: Record<string, string> = {
  "EN RETARD": "bg-[#C5716B]/20 text-[#C5716B]",
  "J-1": "bg-[#C79A6B]/25 text-[#C79A6B]",
  "J-3": "bg-[#C79A6B]/15 text-[#C79A6B]",
  "J-7": "bg-[#8FB59B]/15 text-[#DFE7E2]",
  OK: "bg-[#8DA298]/15 text-[#8DA298]",
};

const money = (v: unknown) => `${Number(v ?? 0).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} MAD`;
const date = (v: string | null) => (v ? new Date(v).toLocaleDateString("fr-FR") : "—");

export function ChequesModule() {
  const [cheques, setCheques] = useState<Cheque[]>([]);
  const [alertes, setAlertes] = useState<{ cheque_id: string; bank: string; number: string; beneficiary: string; amount: number; due_date: string; jours_restants: number; urgence: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [filtre, setFiltre] = useState("tous");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ bank: "", number: "", beneficiary: "", amount: "", issue_date: "", received_date: "", due_date: "", image_url: "", notes: "" });

  async function charger() {
    if (!supabase) { setErreur("Supabase n’est pas configuré."); setLoading(false); return; }
    const [resCheques, resAlertes] = await Promise.all([
      supabase.from("cheques").select("*").order("due_date", { ascending: true }).limit(200),
      supabase.rpc("cheques_echeances_proches"),
    ]);
    if (resCheques.error) setErreur(resCheques.error.message);
    else setCheques((resCheques.data ?? []) as unknown as Cheque[]);
    if (!resAlertes.error && resAlertes.data) setAlertes(resAlertes.data as typeof alertes);
    setLoading(false);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void charger(), 0);
    return () => window.clearTimeout(timer);
    // Rechargement initial unique ; charger() est rappelé après chaque opération.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function ajouter(event: FormEvent) {
    event.preventDefault();
    if (!supabase || saving) return;
    setSaving(true); setErreur(null); setMessage(null);
    try {
      const { data: profile } = await supabase.rpc("get_my_profile");
      const establishmentId = profile?.[0]?.establishment_id;
      if (!establishmentId) throw new Error("Établissement introuvable.");
      const { error } = await supabase.from("cheques").insert({
        establishment_id: establishmentId,
        bank: form.bank.trim(),
        number: form.number.trim(),
        beneficiary: form.beneficiary.trim(),
        amount: Number(form.amount),
        issue_date: form.issue_date || null,
        received_date: form.received_date || null,
        due_date: form.due_date || null,
        image_url: form.image_url.trim() || null,
        notes: form.notes.trim() || null,
        status: "en_attente",
      });
      if (error) throw new Error(error.message);
      setForm({ bank: "", number: "", beneficiary: "", amount: "", issue_date: "", received_date: "", due_date: "", image_url: "", notes: "" });
      setMessage("Chèque enregistré (statut : en attente).");
      await charger();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  }

  async function changerStatut(cheque: Cheque, statut: string) {
    if (!supabase || saving) return;
    setSaving(true); setErreur(null); setMessage(null);
    const { error } = await supabase.from("cheques").update({ status: statut }).eq("id", cheque.id);
    if (error) setErreur(error.message);
    else {
      setCheques((r) => r.map((c) => (c.id === cheque.id ? { ...c, status: statut } : c)));
      setMessage(`Chèque ${cheque.number} marqué « ${STATUTS[statut]?.label ?? statut} ».`);
    }
    setSaving(false);
  }

  const visibles = filtre === "tous" ? cheques : cheques.filter((c) => c.status === filtre);

  return (
    <>
      <div className="mb-6">
        <p className="text-xs uppercase tracking-[0.2em] text-[#A7B7A8]">Finance</p>
        <h1 className="titre-or mt-1 text-2xl font-extrabold">Chèques</h1>
        <p className="mt-1 text-sm text-[#A7B7A8]">Capture, échéances et alertes J-7 / J-3 / J-1 — validation humaine avant comptabilisation.</p>
      </div>

      {erreur && <p role="alert" className="mb-4 rounded-lg bg-[#C5716B]/15 px-4 py-3 text-sm text-[#C5716B]">{erreur}</p>}
      {message && <p role="status" className="mb-4 rounded-lg bg-[#8DA298]/10 px-4 py-3 text-sm text-[#8DA298]">{message}</p>}

      {/* Alertes échéances */}
      {alertes.length > 0 && (
        <section className="carte mb-5 overflow-hidden">
          <h2 className="border-b border-[#8FB59B]/10 p-5 font-bold">Échéances proches (J-7 et moins)</h2>
          <ul className="divide-y divide-[#8FB59B]/10">
            {alertes.map((a) => (
              <li key={a.cheque_id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                <span className="font-semibold text-[#E8ECE8]">{a.bank} · {a.number}</span>
                <span className="text-[#A7B7A8]">{a.beneficiary} — échéance {date(a.due_date)}</span>
                <span className="font-bold text-[#DFE7E2]">{money(a.amount)}</span>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${URGENCES[a.urgence] ?? URGENCES.OK}`}>{a.urgence}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Formulaire d'ajout */}
      <form onSubmit={ajouter} className="carte mb-5 p-5">
        <h2 className="font-bold">Nouveau chèque</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <input required className="champ" placeholder="Banque" value={form.bank} onChange={(e) => setForm({ ...form, bank: e.target.value })} />
          <input required className="champ" placeholder="Numéro du chèque" value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} />
          <input required className="champ" placeholder="Bénéficiaire" value={form.beneficiary} onChange={(e) => setForm({ ...form, beneficiary: e.target.value })} />
          <input required type="number" min="0.01" step="0.01" className="champ" placeholder="Montant MAD" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          <label className="text-xs text-[#A7B7A8]">Date d’émission<input type="date" className="champ mt-1" value={form.issue_date} onChange={(e) => setForm({ ...form, issue_date: e.target.value })} /></label>
          <label className="text-xs text-[#A7B7A8]">Date de réception<input type="date" className="champ mt-1" value={form.received_date} onChange={(e) => setForm({ ...form, received_date: e.target.value })} /></label>
          <label className="text-xs text-[#A7B7A8]">Date d’échéance<input type="date" className="champ mt-1" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></label>
          <input className="champ" placeholder="URL image du chèque (capture)" value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} />
          <input className="champ sm:col-span-2 lg:col-span-4" placeholder="Notes / champs OCR à corriger manuellement" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>
        <div className="mt-4 flex justify-end">
          <button type="submit" disabled={saving} className="btn-or px-5 py-2 text-sm">{saving ? "Enregistrement…" : "Enregistrer le chèque"}</button>
        </div>
      </form>

      {/* Liste */}
      <section className="carte overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#8FB59B]/10 p-5">
          <h2 className="font-bold">{visibles.length} chèque{visibles.length > 1 ? "s" : ""}</h2>
          <div className="flex flex-wrap gap-2">
            {["tous", "en_attente", "encaisse", "rejete", "annule"].map((s) => (
              <button key={s} type="button" onClick={() => setFiltre(s)} className={`rounded-lg border px-3 py-1.5 text-xs ${filtre === s ? "border-[#8FB59B]/50 bg-[#8FB59B]/15 text-[#DFE7E2]" : "border-[#8FB59B]/20 text-[#A7B7A8]"}`}>
                {s === "tous" ? "Tous" : STATUTS[s]?.label ?? s}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="bg-[#344440]/50 text-xs uppercase text-[#A7B7A8]">
              <tr><th className="px-4 py-3">Banque / N°</th><th className="px-4 py-3">Bénéficiaire</th><th className="px-4 py-3">Montant</th><th className="px-4 py-3">Échéance</th><th className="px-4 py-3">Statut</th><th className="px-4 py-3">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-[#8FB59B]/10">
              {visibles.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-4 font-semibold text-[#DFE7E2]">{c.bank}<p className="text-xs font-normal text-[#A7B7A8]">{c.number}</p></td>
                  <td className="px-4 py-4">{c.beneficiary}</td>
                  <td className="px-4 py-4 font-bold text-[#DFE7E2]">{money(c.amount)}</td>
                  <td className="px-4 py-4 text-[#A7B7A8]">{date(c.due_date)}</td>
                  <td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUTS[c.status]?.classe ?? ""}`}>{STATUTS[c.status]?.label ?? c.status}</span></td>
                  <td className="px-4 py-4">
                    {c.status === "en_attente" ? (
                      <div className="flex gap-2">
                        <button type="button" disabled={saving} onClick={() => void changerStatut(c, "encaisse")} className="rounded-lg border border-[#8FB59B]/30 px-2.5 py-1.5 text-xs text-[#DFE7E2]">Encaisser</button>
                        <button type="button" disabled={saving} onClick={() => void changerStatut(c, "rejete")} className="rounded-lg border border-[#C5716B]/30 px-2.5 py-1.5 text-xs text-[#C5716B]">Rejeter</button>
                      </div>
                    ) : (
                      <span className="text-xs text-[#A7B7A8]">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && !visibles.length && <p className="p-8 text-center text-sm text-[#A7B7A8]">Aucun chèque enregistré.</p>}
        </div>
      </section>
    </>
  );
}
