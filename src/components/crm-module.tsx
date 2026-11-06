"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { supabase } from "@/lib/supabase-browser";
import { FEATURE_LABEL } from "@/lib/features";

/**
 * CRM Super Admin — pipeline commercial configurable en étapes :
 * prospect → démonstration → essai → négociation → gagné / perdu.
 * Journal d’échanges (notes, appels, démos) par prospect.
 * Réservé Super Admin : RLS + garde de rôle sur la page.
 */

const ETAPES: { cle: string; label: string; couleur: string }[] = [
  { cle: "prospect", label: "Prospects", couleur: "#5B8A8F" },
  { cle: "demo", label: "Démonstrations", couleur: "#D6B66F" },
  { cle: "trial", label: "Essais", couleur: "#A8BB87" },
  { cle: "negotiation", label: "Négociation", couleur: "#E9D998" },
  { cle: "won", label: "Gagnés", couleur: "#38A987" },
  { cle: "lost", label: "Perdus", couleur: "#D66868" },
];

type Lead = {
  id: string;
  company: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  activity: string | null;
  stage: string;
  plan_interest: string | null;
  notes: string | null;
  next_action_at: string | null;
  created_at: string;
  updated_at: string;
};

type Evenement = { id: string; lead_id: string; event_type: string; body: string; created_at: string };

const dateFr = (v: string | null) => (v ? new Date(v).toLocaleDateString("fr-FR") : "—");

export function CrmModule() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [events, setEvents] = useState<Evenement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [traitement, setTraitement] = useState<string | null>(null);

  const [ouvert, setOuvert] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    company: "", contact: "", email: "", phone: "", city: "", activity: "",
    stage: "prospect", plan: "", notes: "", nextAction: "",
  });

  const [selection, setSelection] = useState<Lead | null>(null);
  const [note, setNote] = useState("");
  const [typeNote, setTypeNote] = useState("note");

  async function charger() {
    if (!supabase) { setError("Supabase n’est pas configuré."); setLoading(false); return; }
    const [leadsReq, eventsReq] = await Promise.all([
      supabase.from("crm_leads").select("*").order("updated_at", { ascending: false }).limit(300),
      supabase.from("crm_events").select("id, lead_id, event_type, body, created_at").order("created_at", { ascending: false }).limit(300),
    ]);
    if (leadsReq.error && !leadsReq.error.message.includes("does not exist")) setError(leadsReq.error.message);
    else setLeads((leadsReq.data ?? []) as Lead[]);
    if (!eventsReq.error) setEvents((eventsReq.data ?? []) as Evenement[]);
    setLoading(false);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void charger(), 0);
    return () => window.clearTimeout(timer);
    // Rechargement initial unique.
  }, []);

  const parEtape = useMemo(() => {
    const map = new Map<string, Lead[]>();
    for (const e of ETAPES) map.set(e.cle, []);
    for (const l of leads) (map.get(l.stage) ?? map.get("prospect")!).push(l);
    return map;
  }, [leads]);

  const aRelancer = useMemo(
    () => leads.filter((l) => l.next_action_at && l.next_action_at <= new Date().toISOString().slice(0, 10) && !["won", "lost"].includes(l.stage)),
    [leads],
  );

  const eventsLead = useMemo(
    () => (selection ? events.filter((e) => e.lead_id === selection.id) : []),
    [events, selection],
  );

  /* ---------------------------------------------------------------
   * Actions
   * --------------------------------------------------------------- */
  async function creerLead(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const { data, error: insertError } = await supabase
        .from("crm_leads")
        .insert({
          company: form.company.trim(),
          contact_name: form.contact.trim() || null,
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          city: form.city.trim() || null,
          activity: form.activity.trim() || null,
          stage: form.stage,
          plan_interest: form.plan || null,
          notes: form.notes.trim() || null,
          next_action_at: form.nextAction || null,
          owner_id: sessionData.session?.user.id ?? null,
        })
        .select("*")
        .single();
      if (insertError) throw new Error(insertError.message);
      if (data) {
        await supabase.from("crm_events").insert({
          lead_id: data.id as string,
          event_type: "note",
          body: `Prospect créé — étape ${ETAPES.find((e) => e.cle === form.stage)?.label ?? form.stage}.`,
        });
      }
      setNotice(`Prospect « ${form.company.trim()} » ajouté au pipeline.`);
      setOuvert(false);
      setForm({ company: "", contact: "", email: "", phone: "", city: "", activity: "", stage: "prospect", plan: "", notes: "", nextAction: "" });
      await charger();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Création impossible.");
    } finally {
      setSaving(false);
    }
  }

  async function changerEtape(lead: Lead, stage: string) {
    if (!supabase) return;
    setTraitement(lead.id);
    setError(null);
    const { error: majError } = await supabase
      .from("crm_leads")
      .update({ stage, updated_at: new Date().toISOString() })
      .eq("id", lead.id);
    if (majError) setError(majError.message);
    else {
      await supabase.from("crm_events").insert({
        lead_id: lead.id,
        event_type: "stage_change",
        body: `Étape : ${ETAPES.find((e) => e.cle === lead.stage)?.label ?? lead.stage} → ${ETAPES.find((e) => e.cle === stage)?.label ?? stage}.`,
      });
      setNotice(`${lead.company} → ${ETAPES.find((e) => e.cle === stage)?.label ?? stage}.`);
      if (selection?.id === lead.id) setSelection({ ...lead, stage });
      await charger();
    }
    setTraitement(null);
  }

  async function ajouterNote(event: FormEvent) {
    event.preventDefault();
    if (!supabase || !selection || !note.trim()) return;
    const { error: insertError } = await supabase.from("crm_events").insert({
      lead_id: selection.id,
      event_type: typeNote,
      body: note.trim(),
    });
    if (insertError) setError(insertError.message);
    else {
      setNote("");
      const { data } = await supabase.from("crm_events").select("id, lead_id, event_type, body, created_at").eq("lead_id", selection.id).order("created_at", { ascending: false });
      setEvents((current) => [...((data ?? []) as Evenement[]), ...current.filter((e) => e.lead_id !== selection.id)]);
      await charger();
    }
  }

  return (
    <section className="space-y-6">
      {/* KPI réels */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <article className="carte p-5">
          <p className="text-xs text-[#a8bb87]">Prospects au total</p>
          <p className="titre-or mt-1 text-2xl font-extrabold">{loading ? "…" : leads.length}</p>
        </article>
        <article className="carte p-5">
          <p className="text-xs text-[#a8bb87]">En essai / négociation</p>
          <p className="titre-or mt-1 text-2xl font-extrabold">
            {loading ? "…" : leads.filter((l) => l.stage === "trial" || l.stage === "negotiation").length}
          </p>
        </article>
        <article className="carte p-5">
          <p className="text-xs text-[#a8bb87]">Convertis (gagnés)</p>
          <p className="titre-or mt-1 text-2xl font-extrabold">{loading ? "…" : leads.filter((l) => l.stage === "won").length}</p>
        </article>
        <article className="carte p-5">
          <p className="text-xs text-[#d6b66f]">Relances dues aujourd’hui</p>
          <p className="titre-or mt-1 text-2xl font-extrabold">{loading ? "…" : aRelancer.length}</p>
        </article>
      </div>

      {notice && <p role="status" className="rounded-lg bg-[#38a987]/10 px-4 py-3 text-sm text-[#69d3a8]">{notice}</p>}
      {error && <p role="alert" className="rounded-lg bg-[#d66868]/15 px-4 py-3 text-sm text-[#d66868]">{error}</p>}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[#a8bb87]">Pipeline commercial</p>
          <h1 className="titre-or mt-1 text-2xl font-extrabold">CRM Super Admin</h1>
          <p className="mt-1 text-sm text-[#a8bb87]">Prospects, démonstrations, essais et relances.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/super-admin" className="rounded-lg border border-[#d6b66f]/40 px-4 py-2 text-sm text-[#e9d998]">← Pilotage</Link>
          <button type="button" onClick={() => { setOuvert(true); setError(null); setNotice(null); }} className="btn-or px-4 py-2 text-sm">
            + Nouveau prospect
          </button>
        </div>
      </div>

      {/* Pipeline */}
      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        {ETAPES.map((etape) => {
          const liste = parEtape.get(etape.cle) ?? [];
          return (
            <section key={etape.cle} className="carte p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wide" style={{ color: etape.couleur }}>{etape.label}</p>
                <span className="rounded-full bg-[#21464b] px-2 py-0.5 text-[11px] text-[#e9d998]">{liste.length}</span>
              </div>
              <ul className="mt-3 space-y-2">
                {liste.map((lead) => (
                  <li key={lead.id}>
                    <button
                      type="button"
                      onClick={() => setSelection(lead)}
                      className={`w-full rounded-lg border p-2.5 text-left transition hover:border-[#d6b66f]/50 ${
                        selection?.id === lead.id ? "border-[#d6b66f] bg-[#21464b]" : "border-[#d6b66f]/15 bg-[#193a40]"
                      }`}
                    >
                      <p className="truncate text-xs font-semibold text-[#f8ecc9]">{lead.company}</p>
                      <p className="mt-0.5 truncate text-[11px] text-[#a8bb87]">
                        {lead.city ?? "—"} · {lead.plan_interest ? lead.plan_interest.toUpperCase() : "forfait ?"}
                      </p>
                      {lead.next_action_at && (
                        <p className="mt-1 text-[10px] text-[#d6b66f]">Relance {dateFr(lead.next_action_at)}</p>
                      )}
                    </button>
                  </li>
                ))}
                {!liste.length && <li className="py-3 text-center text-[11px] text-[#a8bb87]">Vide</li>}
              </ul>
            </section>
          );
        })}
      </div>

      {/* Détail prospect */}
      {selection && (
        <section className="grid gap-6 lg:grid-cols-[1fr_24rem]">
          <div className="carte p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[#a8bb87]">Fiche prospect</p>
                <h2 className="titre-or mt-1 text-xl font-extrabold">{selection.company}</h2>
                <p className="mt-1 text-sm text-[#a8bb87]">
                  {selection.contact_name ?? "Contact —"} {selection.city ? `· ${selection.city}` : ""} {selection.activity ? `· ${selection.activity}` : ""}
                </p>
              </div>
              <button type="button" onClick={() => setSelection(null)} className="text-2xl text-[#a8bb87]" aria-label="Fermer">×</button>
            </div>

            <div className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
              {selection.email && <p className="text-[#f8ecc9]">✉ {selection.email}</p>}
              {selection.phone && <p className="text-[#f8ecc9]">☎ {selection.phone}</p>}
              <p className="text-[#a8bb87]">Inscrit le {dateFr(selection.created_at)}</p>
            </div>

            <label className="mt-4 block text-xs text-[#a8bb87]">Étape du pipeline
              <select
                className="champ mt-1 min-h-11"
                value={selection.stage}
                disabled={traitement === selection.id}
                onChange={(e) => void changerEtape(selection, e.target.value)}
              >
                {ETAPES.map((e) => <option key={e.cle} value={e.cle}>{e.label}</option>)}
              </select>
            </label>

            {/* Journal */}
            <div className="mt-5 border-t border-[#d6b66f]/10 pt-4">
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#a8bb87]">Historique des contacts</p>
              <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
                {eventsLead.map((ev) => (
                  <li key={ev.id} className="rounded-lg bg-[#21464b]/50 px-3 py-2 text-sm">
                    <p className="text-[10px] uppercase text-[#a8bb87]">
                      {ev.event_type === "stage_change" ? "Changement d’étape" : ev.event_type === "call" ? "Appel" : ev.event_type === "demo" ? "Démonstration" : "Note"} ·{" "}
                      {new Date(ev.created_at).toLocaleString("fr-FR")}
                    </p>
                    <p className="mt-1 leading-5 text-[#f8ecc9]">{ev.body}</p>
                  </li>
                ))}
                {!eventsLead.length && <li className="text-xs text-[#a8bb87]">Aucun échange enregistré.</li>}
              </ul>

              <form onSubmit={(e) => void ajouterNote(e)} className="mt-3 flex flex-wrap gap-2">
                <select value={typeNote} onChange={(e) => setTypeNote(e.target.value)} className="champ min-h-10 w-36 text-xs" aria-label="Type d’échange">
                  <option value="note">Note</option>
                  <option value="call">Appel</option>
                  <option value="email">Email</option>
                  <option value="demo">Démonstration</option>
                </select>
                <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Compter l’échange…" className="champ min-h-10 min-w-40 flex-1" />
                <button type="submit" className="btn-or px-3 py-2 text-xs">Ajouter</button>
              </form>
            </div>
          </div>
        </section>
      )}

      {/* Modale nouveau prospect */}
      {ouvert && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-5">
          <form onSubmit={(e) => void creerLead(e)} className="carte my-4 w-full max-w-lg p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[#a8bb87]">CRM plateforme</p>
                <h2 className="titre-or mt-1 text-xl font-extrabold">Nouveau prospect</h2>
              </div>
              <button type="button" onClick={() => setOuvert(false)} className="text-2xl text-[#a8bb87]" aria-label="Fermer">×</button>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <label className="text-xs text-[#a8bb87] sm:col-span-2">Entreprise *
                <input required className="champ mt-1 min-h-11" placeholder="Garage El Mansouri" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
              </label>
              <label className="text-xs text-[#a8bb87]">Contact
                <input className="champ mt-1 min-h-11" placeholder="Nom complet" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} />
              </label>
              <label className="text-xs text-[#a8bb87]">Téléphone
                <input className="champ mt-1 min-h-11" placeholder="+212…" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </label>
              <label className="text-xs text-[#a8bb87]">Email
                <input type="email" className="champ mt-1 min-h-11" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </label>
              <label className="text-xs text-[#a8bb87]">Ville
                <input className="champ mt-1 min-h-11" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
              </label>
              <label className="text-xs text-[#a8bb87]">Activité
                <input className="champ mt-1 min-h-11" placeholder="Garage, magasin, centre pneus…" value={form.activity} onChange={(e) => setForm({ ...form, activity: e.target.value })} />
              </label>
              <label className="text-xs text-[#a8bb87]">Étape
                <select className="champ mt-1 min-h-11" value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value })}>
                  {ETAPES.map((e) => <option key={e.cle} value={e.cle}>{e.label}</option>)}
                </select>
              </label>
              <label className="text-xs text-[#a8bb87]">Forfait intéressé
                <select className="champ mt-1 min-h-11" value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })}>
                  <option value="">À déterminer</option>
                  <option value="standard">STANDARD</option>
                  <option value="silver">SILVER</option>
                  <option value="gold">GOLD</option>
                </select>
              </label>
              <label className="text-xs text-[#a8bb87]">Prochaine relance
                <input type="date" className="champ mt-1 min-h-11" value={form.nextAction} onChange={(e) => setForm({ ...form, nextAction: e.target.value })} />
              </label>
              <label className="text-xs text-[#a8bb87] sm:col-span-2">Notes
                <textarea rows={3} className="champ mt-1 py-2 text-sm" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setOuvert(false)} className="rounded-lg px-4 py-2 text-sm text-[#a8bb87]">Annuler</button>
              <button type="submit" disabled={saving} className="btn-or px-4 py-2 text-sm disabled:opacity-40">{saving ? "Ajout…" : "Ajouter au pipeline"}</button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}

/** En-tête + garde de rôle de la page CRM (rôle saas_admin uniquement). */
export function CrmShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  return (
    <main className="min-h-screen bg-[#102b32] text-[#f8ecc9]">
      <header className="flex items-center justify-between border-b border-[#d6b66f]/15 bg-[#193a40] px-5 py-4 lg:px-10">
        <Logo compact />
        <div className="flex items-center gap-4">
          <span className="hidden text-sm text-[#a8bb87] sm:block">Super Admin · {FEATURE_LABEL.crm ?? "CRM"}</span>
          <button type="button" onClick={() => router.replace("/super-admin/")} className="text-sm text-[#d6b66f] hover:underline">Pilotage</button>
        </div>
      </header>
      <div className="mx-auto max-w-7xl p-5 lg:p-10">{children}</div>
    </main>
  );
}
