"use client";

/**
 * AUTO DYALI — Super Admin › Support & assistance
 * File réelle des tickets plateforme (support_tickets / ticket_messages),
 * réponse équipe, changement de statut — réservé au Super Admin.
 */

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase-browser";
import { ModulePage } from "@/components/super-admin-module-page";
import { ModuleHeader, Chargement, Vide, Erreur } from "@/components/super-admin-page";
import { dateFrCourte } from "@/lib/csv-export";
import { useNotification } from "@/lib/use-notification";

type Ticket = {
  id: string;
  establishment_id: string | null;
  subject: string;
  body: string;
  category: string;
  status: string;
  priority: string;
  created_at: string;
  establishments: { name: string } | null;
};
type Msg = { id: string; author_id: string | null; is_staff: boolean; body: string; created_at: string };

const STATUTS = ["open", "in_progress", "waiting_reply", "resolved", "closed"] as const;

export default function SupportPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [recherche, setRecherche] = useState("");
  const [filtreStatut, setFiltreStatut] = useState<string>("tous");
  const [selection, setSelection] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [chargementMsgs, setChargementMsgs] = useState(false);
  const [reponse, setReponse] = useState("");
  const [enCours, setEnCours] = useState(false);
  const { success: toastSuccess, error: toastError } = useNotification();

  useEffect(() => {
    void chargerTickets();
  }, []);

  useEffect(() => {
    let vivant = true;
    const chargerMessages = async () => {
      if (!supabase || !selection) {
        if (vivant) setMessages([]);
        return;
      }
      if (vivant) setChargementMsgs(true);
      const { data, error } = await supabase
        .from("ticket_messages")
        .select("id, author_id, is_staff, body, created_at")
        .eq("ticket_id", selection.id)
        .order("created_at", { ascending: true });
      if (!vivant) return;
      if (error) setErreur(error.message);
      else setMessages((data ?? []) as Msg[]);
      setChargementMsgs(false);
    };
    void chargerMessages();
    return () => {
      vivant = false;
    };
  }, [selection]);

  async function chargerTickets() {
    if (!supabase) return;
    setLoading(true);
    setErreur(null);
    const { data, error } = await supabase
      .from("support_tickets")
      .select("id, establishment_id, subject, body, category, status, priority, created_at, establishments(name)")
      .order("created_at", { ascending: false });
    if (error) setErreur(error.message);
    else setTickets((data ?? []) as unknown as Ticket[]);
    setLoading(false);
  }

  const visibles = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return tickets.filter((t) => {
      if (filtreStatut !== "tous" && t.status !== filtreStatut) return false;
      if (!q) return true;
      return [t.subject, t.body, t.category, t.establishments?.name, t.priority]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [tickets, recherche, filtreStatut]);

  const ouverts = tickets.filter((t) => ["open", "in_progress", "waiting_reply"].includes(t.status)).length;
  const urgents = tickets.filter((t) => t.priority === "urgent" || t.priority === "high").length;

  async function repondre(e: FormEvent) {
    e.preventDefault();
    if (!supabase || !selection || !reponse.trim()) return;
    setEnCours(true);
    setErreur(null);
    const { data: sessionData } = await supabase.auth.getSession();
    const { error } = await supabase.from("ticket_messages").insert({
      ticket_id: selection.id,
      author_id: sessionData.session?.user.id ?? null,
      is_staff: true,
      body: reponse.trim(),
    });
    if (error) toastError({ title: "Erreur réponse ticket", message: error.message });
    else {
      await supabase.from("support_tickets").update({ status: "waiting_reply", updated_at: new Date().toISOString() }).eq("id", selection.id);
      setReponse("");
      toastSuccess({ title: "Réponse envoyée", message: "La réponse a été envoyée au client." });
      const { data: msgs } = await supabase.from("ticket_messages").select("id, author_id, is_staff, body, created_at").eq("ticket_id", selection.id).order("created_at", { ascending: true });
      setMessages((msgs ?? []) as Msg[]);
      setSelection((s) => (s ? { ...s, status: "waiting_reply" } : s));
      await chargerTickets();
    }
    setEnCours(false);
  }

  async function changerStatut(statut: string) {
    if (!supabase || !selection) return;
    setErreur(null);
    const { error } = await supabase.from("support_tickets").update({ status: statut, updated_at: new Date().toISOString(), ...(["resolved", "closed"].includes(statut) ? { closed_at: new Date().toISOString() } : {}) }).eq("id", selection.id);
    if (error) toastError({ title: "Erreur mise à jour ticket", message: error.message });
    else {
      toastSuccess({ title: "Ticket mis à jour", message: `Ticket passé en « ${statut} ».` });
      setSelection((s) => (s ? { ...s, status: statut } : s));
      await chargerTickets();
    }
  }

  return (
    <ModulePage titre="Support & assistance">
      <ModuleHeader
        surtitre="AUTO DYALI · Assistance abonnés"
        titre="Support & assistance"
        description="File réelle des tickets plateforme (support_tickets). Réponse équipe, changement de statut, isolation par établissement (RLS)."
      />

      <section className="mt-6 grid gap-4 sm:grid-cols-3">
        <article className="carte-premium p-5"><p className="text-xs uppercase tracking-[0.18em] text-[#A7B7A8]">Tickets ouverts</p><p className="titre-or mt-2 text-3xl font-extrabold">{ouverts}</p></article>
        <article className="carte-premium p-5"><p className="text-xs uppercase tracking-[0.18em] text-[#A7B7A8]">Priorité haute / urgente</p><p className="titre-or mt-2 text-3xl font-extrabold">{urgents}</p></article>
        <article className="carte-premium p-5"><p className="text-xs uppercase tracking-[0.18em] text-[#A7B7A8]">Total</p><p className="titre-or mt-2 text-3xl font-extrabold">{tickets.length}</p></article>
      </section>

      <div className="carte-premium mt-6 grid gap-3 p-4 sm:grid-cols-3">
        <label className="text-xs text-[#A7B7A8] sm:col-span-2">
          Recherche
          <input type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Sujet, message, entreprise, catégorie…" className="champ mt-1 min-h-11 w-full" aria-label="Rechercher un ticket" />
        </label>
        <label className="text-xs text-[#A7B7A8]">
          Statut
          <select value={filtreStatut} onChange={(e) => setFiltreStatut(e.target.value)} className="champ mt-1 min-h-11">
            <option value="tous">Tous</option>
            {STATUTS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
      </div>

      {notice && <p role="status" className="mt-4 rounded-lg bg-[#5D9E7F]/10 px-4 py-3 text-sm text-[#7FBF9E]">{notice}</p>}
      {erreur && <div className="mt-4"><Erreur message={erreur} /></div>}

      {loading ? (
        <div className="mt-6"><Chargement /></div>
      ) : visibles.length === 0 ? (
        <div className="mt-6"><Vide titre="Aucun ticket" detail={filtreStatut !== "tous" ? "Aucun ticket dans ce statut." : "La file de support est vide."} /></div>
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-5">
          {/* File */}
          <div className="lg:col-span-2">
            <ul className="space-y-2">
              {visibles.map((t) => (
                <li key={t.id}>
                  <button type="button" onClick={() => setSelection(t)} className={`w-full rounded-xl border p-3 text-left transition ${selection?.id === t.id ? "border-[#8FB59B] bg-[#344440]" : "border-[#8FB59B]/15 bg-[#2C3735] hover:border-[#8FB59B]/40"}`}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-[#E8ECE8]">{t.subject}</p>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] uppercase ${t.priority === "urgent" ? "bg-[#C5716B]/20 text-[#C5716B]" : t.priority === "high" ? "bg-[#D6A34D]/20 text-[#D6A34D]" : "bg-[#344440] text-[#A7B7A8]"}`}>{t.priority}</span>
                    </div>
                    <p className="mt-1 truncate text-[11px] text-[#A7B7A8]">{t.establishments?.name ?? "Sans établissement"} · {t.status} · {dateFrCourte(t.created_at)}</p>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Détail */}
          <div className="carte-premium p-5 lg:col-span-3">
            {!selection ? (
              <p className="text-sm text-[#A7B7A8]">Sélectionnez un ticket pour voir ses échanges et y répondre.</p>
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="font-bold text-[#E8ECE8]">{selection.subject}</h2>
                    <p className="mt-1 text-[11px] text-[#A7B7A8]">{selection.establishments?.name ?? "Sans établissement"} · {selection.category} · {dateFrCourte(selection.created_at)}</p>
                  </div>
                  <select value={selection.status} onChange={(e) => void changerStatut(e.target.value)} className="champ min-h-9 py-1 text-xs" aria-label="Statut du ticket">
                    {STATUTS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <p className="mt-4 rounded-lg bg-[#2C3735] p-3 text-sm text-[#E8ECE8]">{selection.body}</p>

                <div className="mt-4">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-[#A7B7A8]">Échanges</p>
                  <ul className="mt-2 max-h-56 space-y-2 overflow-y-auto pr-1">
                    {chargementMsgs && <li className="text-xs text-[#A7B7A8]">Chargement…</li>}
                    {messages.map((m) => (
                      <li key={m.id} className={`rounded-lg px-3 py-2 text-sm ${m.is_staff ? "ml-6 bg-[#8FB59B]/15 text-[#D0C6AE]" : "mr-6 bg-[#344440]/60 text-[#E8ECE8]"}`}>
                        <p className="text-[10px] uppercase text-[#A7B7A8]">{m.is_staff ? "Équipe AUTO DYALI" : "Client"} · {new Date(m.created_at).toLocaleString("fr-FR")}</p>
                        <p className="mt-1">{m.body}</p>
                      </li>
                    ))}
                    {!chargementMsgs && messages.length === 0 && <li className="text-xs text-[#A7B7A8]">Aucun échange pour ce ticket.</li>}
                  </ul>
                </div>

                <form onSubmit={repondre} className="mt-4 flex flex-wrap gap-2">
                  <input value={reponse} onChange={(e) => setReponse(e.target.value)} placeholder="Votre réponse…" className="champ min-h-11 min-w-60 flex-1" aria-label="Réponse au ticket" />
                  <button type="submit" disabled={enCours} className="btn-or px-4 py-2 text-sm">{enCours ? "…" : "Envoyer"}</button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </ModulePage>
  );
}
