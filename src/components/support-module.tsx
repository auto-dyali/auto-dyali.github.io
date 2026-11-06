"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase-browser";

/**
 * Support & tickets — §4 du cahier des charges.
 * Ouverture d’un ticket, suivi des statuts, fil d’échanges avec l’équipe
 * support. La RLS garantit : un établissement ne voit que ses tickets,
 * le Super Admin les voit tous.
 */

type Ticket = {
  id: string;
  subject: string;
  body: string;
  category: string;
  status: string;
  priority: string;
  plan_code: string | null;
  created_at: string;
  updated_at: string;
  établissement?: string | null;
};

type Message = {
  id: string;
  ticket_id: string;
  is_staff: boolean;
  body: string;
  created_at: string;
};

const STATUTS: Record<string, { label: string; classe: string }> = {
  open: { label: "Ouvert", classe: "bg-[#d6b66f]/15 text-[#e9d998]" },
  in_progress: { label: "En cours", classe: "bg-[#38a987]/15 text-[#69d3a8]" },
  waiting_reply: { label: "En attente de vous", classe: "bg-[#d6b66f]/15 text-[#e9d998]" },
  resolved: { label: "Résolu", classe: "bg-[#38a987]/20 text-[#69d3a8]" },
  closed: { label: "Fermé", classe: "bg-[#21464b] text-[#a8bb87]" },
};

const CATEGORIES: { cle: string; label: string }[] = [
  { cle: "question", label: "Question" },
  { cle: "bug", label: "Bug / dysfonctionnement" },
  { cle: "billing", label: "Facturation / forfait" },
  { cle: "feature", label: "Fonctionnalité souhaitée" },
  { cle: "other", label: "Autre" },
];

export function SupportModule() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [ouvert, setOuvert] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ subject: "", body: "", category: "question", priority: "normal" });

  const [selection, setSelection] = useState<string | null>(null);
  const [reponse, setReponse] = useState("");
  const [envoiReponse, setEnvoiReponse] = useState(false);

  async function charger() {
    if (!supabase) {
      setError("Supabase n’est pas configuré.");
      setLoading(false);
      return;
    }
    const { data, error: reqError } = await supabase
      .from("support_tickets")
      .select("id, subject, body, category, status, priority, plan_code, created_at, updated_at, establishments(name)")
      .order("updated_at", { ascending: false })
      .limit(200);
    if (reqError && !reqError.message.includes("does not exist")) setError(reqError.message);
    else {
      const rows = (data ?? []) as unknown as (Ticket & { establishments: { name: string } | null })[];
      setTickets(rows.map((t) => ({ ...t, établissement: t.establishments?.name ?? null })));
    }
    setLoading(false);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void charger(), 0);
    return () => window.clearTimeout(timer);
    // Rechargement initial unique ; charger() est rappelé manuellement après action.
  }, []);

  /* Fil d’un ticket sélectionné */
  useEffect(() => {
    if (!selection) return;
    let vivant = true;
    const chargerMessages = async () => {
      if (!supabase) { setMessages([]); return; }
      const { data } = await supabase
        .from("ticket_messages")
        .select("id, ticket_id, is_staff, body, created_at")
        .eq("ticket_id", selection)
        .order("created_at");
      if (vivant) setMessages((data ?? []) as Message[]);
    };
    const timer = window.setTimeout(() => void chargerMessages(), 0);
    return () => { vivant = false; window.clearTimeout(timer); };
  }, [selection]);

  const ticketSelectionne = useMemo(() => tickets.find((t) => t.id === selection) ?? null, [tickets, selection]);

  const ouverts = tickets.filter((t) => ["open", "in_progress", "waiting_reply"].includes(t.status)).length;

  /* ---------------------------------------------------------------
   * Actions
   * --------------------------------------------------------------- */
  async function creerTicket(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const { data: profileRows } = await supabase.rpc("get_my_profile");
      const establishmentId = profileRows?.[0]?.establishment_id ?? null;
      const { data: sessionData } = await supabase.auth.getSession();

      const { data: ticket, error: insertError } = await supabase
        .from("support_tickets")
        .insert({
          establishment_id: establishmentId,
          requester_id: sessionData.session?.user.id ?? null,
          subject: form.subject.trim(),
          body: form.body.trim(),
          category: form.category,
          priority: form.priority,
          status: "open",
        })
        .select("id, subject")
        .single();
      if (insertError || !ticket) throw new Error(insertError?.message ?? "Ticket non créé.");

      // Premier message = corps du ticket (fil d’échanges)
      await supabase.from("ticket_messages").insert({
        ticket_id: ticket.id,
        author_id: sessionData.session?.user.id ?? null,
        is_staff: false,
        body: form.body.trim(),
      });

      setNotice(`Ticket « ${form.subject.trim()} » ouvert.`);
      setOuvert(false);
      setForm({ subject: "", body: "", category: "question", priority: "normal" });
      await charger();
      setSelection(ticket.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ouverture du ticket impossible.");
    } finally {
      setSaving(false);
    }
  }

  async function envoyerReponse(event: FormEvent) {
    event.preventDefault();
    if (!supabase || !selection || !reponse.trim()) return;
    setEnvoiReponse(true);
    setError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const { data: profileRows } = await supabase.rpc("get_my_profile");
      const estStaff = profileRows?.[0]?.role === "saas_admin";

      const { error: msgError } = await supabase.from("ticket_messages").insert({
        ticket_id: selection,
        author_id: sessionData.session?.user.id ?? null,
        is_staff: estStaff,
        body: reponse.trim(),
      });
      if (msgError) throw new Error(msgError.message);

      // Réponse du client → en attente du support ; réponse support → en cours
      const { error: majError } = await supabase
        .from("support_tickets")
        .update({
          status: estStaff ? "in_progress" : "waiting_reply",
          updated_at: new Date().toISOString(),
        })
        .eq("id", selection);
      if (majError) throw new Error(majError.message);

      setReponse("");
      await charger();
      const { data } = await supabase
        .from("ticket_messages")
        .select("id, ticket_id, is_staff, body, created_at")
        .eq("ticket_id", selection)
        .order("created_at");
      setMessages((data ?? []) as Message[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Envoi impossible.");
    } finally {
      setEnvoiReponse(false);
    }
  }

  async function changerStatut(ticket: Ticket, statut: string) {
    if (!supabase) return;
    const { error: majError } = await supabase
      .from("support_tickets")
      .update({ status: statut, updated_at: new Date().toISOString(), closed_at: ["resolved", "closed"].includes(statut) ? new Date().toISOString() : null })
      .eq("id", ticket.id);
    if (majError) setError(majError.message);
    else { setNotice(`Ticket ${ticket.subject} → ${STATUTS[statut]?.label ?? statut}.`); await charger(); }
  }

  return (
    <section className="space-y-6">
      {/* KPI réels */}
      <div className="grid gap-4 sm:grid-cols-3">
        <article className="carte p-5">
          <p className="text-xs text-[#a8bb87]">Tickets ouverts</p>
          <p className="titre-or mt-1 text-2xl font-extrabold">{loading ? "…" : ouverts}</p>
        </article>
        <article className="carte p-5">
          <p className="text-xs text-[#a8bb87]">Total des tickets</p>
          <p className="titre-or mt-1 text-2xl font-extrabold">{loading ? "…" : tickets.length}</p>
        </article>
        <article className="carte p-5">
          <p className="text-xs text-[#a8bb87]">Résolus</p>
          <p className="titre-or mt-1 text-2xl font-extrabold">
            {loading ? "…" : tickets.filter((t) => t.status === "resolved" || t.status === "closed").length}
          </p>
        </article>
      </div>

      {notice && <p role="status" className="rounded-lg bg-[#38a987]/10 px-4 py-3 text-sm text-[#69d3a8]">{notice}</p>}
      {error && <p role="alert" className="rounded-lg bg-[#d66868]/15 px-4 py-3 text-sm text-[#d66868]">{error}</p>}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[#a8bb87]">Assistance AUTO DYALI</p>
          <h1 className="titre-or mt-1 text-2xl font-extrabold">Support & tickets</h1>
          <p className="mt-1 text-sm text-[#a8bb87]">Ouvrez un ticket, suivez les réponses de l’équipe.</p>
        </div>
        <button type="button" onClick={() => { setOuvert(true); setError(null); setNotice(null); }} className="btn-or min-h-11 px-5 text-sm">
          + Nouveau ticket
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        {/* Liste */}
        <section className="carte overflow-hidden">
          <div className="border-b border-[#d6b66f]/10 p-4">
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#a8bb87]">Mes tickets</p>
          </div>
          {loading ? (
            <p className="p-8 text-center text-sm text-[#a8bb87]">Chargement…</p>
          ) : (
            <ul className="divide-y divide-[#d6b66f]/10">
              {tickets.map((t) => {
                const info = STATUTS[t.status] ?? STATUTS.open;
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => setSelection(t.id === selection ? null : t.id)}
                      className={`flex w-full flex-wrap items-center justify-between gap-2 px-5 py-4 text-left transition hover:bg-[#21464b]/40 ${selection === t.id ? "bg-[#21464b]/60" : ""}`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-[#f8ecc9]">{t.subject}</p>
                        <p className="mt-0.5 text-xs text-[#a8bb87]">
                          {CATEGORIES.find((c) => c.cle === t.category)?.label ?? t.category}
                          {" · "}
                          {new Date(t.created_at).toLocaleDateString("fr-FR")}
                          {t.établissement ? ` · ${t.établissement}` : ""}
                        </p>
                      </div>
                      <span className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold ${info.classe}`}>{info.label}</span>
                    </button>
                  </li>
                );
              })}
              {!tickets.length && (
                <li className="p-8 text-center text-sm text-[#a8bb87]">Aucun ticket — ouvrez le premier avec « + Nouveau ticket ».</li>
              )}
            </ul>
          )}
        </section>

        {/* Détail / fil */}
        <aside className="carte h-fit p-5">
          {!ticketSelectionne ? (
            <>
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#a8bb87]">Fil de discussion</p>
              <p className="mt-3 text-sm text-[#a8bb87]">Sélectionnez un ticket pour lire les échanges et répondre.</p>
            </>
          ) : (
            <>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-[#a8bb87]">Ticket</p>
                  <h2 className="mt-1 font-bold text-[#f8ecc9]">{ticketSelectionne.subject}</h2>
                </div>
                <select
                  aria-label="Statut du ticket"
                  className="champ min-h-9 w-36 py-1 text-xs"
                  value={ticketSelectionne.status}
                  onChange={(e) => void changerStatut(ticketSelectionne, e.target.value)}
                >
                  {Object.entries(STATUTS).map(([cle, info]) => <option key={cle} value={cle}>{info.label}</option>)}
                </select>
              </div>

              <div className="mt-4 max-h-72 space-y-3 overflow-y-auto pr-1">
                {messages.length === 0 && (
                  <p className="text-sm text-[#a8bb87]">{ticketSelectionne.body}</p>
                )}
                {messages.map((m) => (
                  <div key={m.id} className={`rounded-lg px-3 py-2 text-sm ${m.is_staff ? "bg-[#d6b66f]/10 text-[#e9d998]" : "bg-[#21464b]/60 text-[#f8ecc9]"}`}>
                    <p className="mb-1 text-[10px] uppercase text-[#a8bb87]">
                      {m.is_staff ? "Équipe AUTO DYALI" : "Vous"} · {new Date(m.created_at).toLocaleString("fr-FR")}
                    </p>
                    <p className="leading-5 whitespace-pre-wrap">{m.body}</p>
                  </div>
                ))}
              </div>

              {ticketSelectionne.status !== "closed" && (
                <form onSubmit={(e) => void envoyerReponse(e)} className="mt-4">
                  <textarea
                    value={reponse}
                    onChange={(e) => setReponse(e.target.value)}
                    rows={3}
                    placeholder="Votre réponse…"
                    className="champ w-full py-2 text-sm"
                    required
                  />
                  <button type="submit" disabled={envoiReponse || !reponse.trim()} className="btn-or mt-2 w-full px-4 py-2 text-sm disabled:opacity-40">
                    {envoiReponse ? "Envoi…" : "Répondre"}
                  </button>
                </form>
              )}
            </>
          )}
        </aside>
      </div>

      {/* Modale nouveau ticket */}
      {ouvert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-5">
          <form onSubmit={(e) => void creerTicket(e)} className="carte max-h-[90vh] w-full max-w-lg overflow-y-auto p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[#a8bb87]">Assistance</p>
                <h2 className="titre-or mt-1 text-xl font-extrabold">Nouveau ticket</h2>
              </div>
              <button type="button" onClick={() => setOuvert(false)} className="text-2xl text-[#a8bb87]" aria-label="Fermer">×</button>
            </div>

            <div className="mt-5 grid gap-3">
              <label className="text-xs text-[#a8bb87]">Objet *
                <input required className="champ mt-1 min-h-11" placeholder="Résumé du problème" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs text-[#a8bb87]">Catégorie
                  <select className="champ mt-1 min-h-11" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                    {CATEGORIES.map((c) => <option key={c.cle} value={c.cle}>{c.label}</option>)}
                  </select>
                </label>
                <label className="text-xs text-[#a8bb87]">Priorité
                  <select className="champ mt-1 min-h-11" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                    <option value="low">Basse</option>
                    <option value="normal">Normale</option>
                    <option value="high">Haute</option>
                    <option value="urgent">Urgente</option>
                  </select>
                </label>
              </div>
              <label className="text-xs text-[#a8bb87]">Description *
                <textarea required rows={5} className="champ mt-1 py-2 text-sm" placeholder="Décrivez le problème ou la demande…" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setOuvert(false)} className="rounded-lg px-4 py-2 text-sm text-[#a8bb87]">Annuler</button>
              <button type="submit" disabled={saving} className="btn-or px-4 py-2 text-sm disabled:opacity-40">{saving ? "Envoi…" : "Ouvrir le ticket"}</button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
