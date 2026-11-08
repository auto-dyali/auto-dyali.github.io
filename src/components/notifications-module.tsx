"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase-browser";

/**
 * Notifications clients & WhatsApp — §4/§11 du cahier des charges.
 *
 * Canaux réels :
 * - in-app : insertion dans client_notifications (visible dans l’espace client).
 * - whatsapp : ouverture de WhatsApp avec le message pré-rempli (wa.me) —
 *   aucun envoi n’est prétendu : le bouton ouvre réellement WhatsApp.
 * - email : nécessite un service SMTP transactionnel configuré côté Supabase ;
 *   tant qu’aucun service n’est branché, l’application LE DIT au lieu de simuler.
 */

type Client = { id: string; full_name: string; phone: string | null; email: string | null };
type Notification = {
  id: string;
  client_id: string;
  client_nom?: string | null;
  title: string;
  body: string;
  channel: string;
  is_read: boolean;
  sent_at: string | null;
  error: string | null;
  created_at: string;
};

const CANAUX: { cle: string; label: string; note: string }[] = [
  { cle: "inapp", label: "Espace client", note: "Notification visible dans l’espace client." },
  { cle: "whatsapp", label: "WhatsApp", note: "Ouvre WhatsApp avec le message pré-rempli." },
  { cle: "email", label: "Email", note: "Nécessite un service d’email configuré." },
];

export function NotificationsModule() {
  const [clients, setClients] = useState<Client[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [clientId, setClientId] = useState("");
  const [canal, setCanal] = useState("inapp");
  const [titre, setTitre] = useState("");
  const [message, setMessage] = useState("");

  const [filtre, setFiltre] = useState("tous");

  async function charger() {
    if (!supabase) {
      setError("Supabase n’est pas configuré.");
      setLoading(false);
      return;
    }
    const [clientsReq, notifsReq] = await Promise.all([
      supabase.from("clients").select("id, full_name, phone, email").order("full_name").limit(500),
      supabase
        .from("client_notifications")
        .select("id, client_id, title, body, channel, is_read, sent_at, error, created_at, clients(full_name)")
        .order("created_at", { ascending: false })
        .limit(100),
    ]);
    if (!clientsReq.error) setClients((clientsReq.data ?? []) as Client[]);
    if (notifsReq.error && !notifsReq.error.message.includes("does not exist")) setError(notifsReq.error.message);
    else {
      const rows = (notifsReq.data ?? []) as unknown as (Notification & { clients: { full_name: string } | null })[];
      setNotifications(rows.map((n) => ({ ...n, client_nom: n.clients?.full_name ?? null })));
    }
    setLoading(false);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void charger(), 0);
    return () => window.clearTimeout(timer);
    // Rechargement initial unique.
  }, []);

  const clientSelectionne = useMemo(() => clients.find((c) => c.id === clientId) ?? null, [clients, clientId]);

  const nonLues = notifications.filter((n) => !n.is_read).length;
  const filtres = notifications.filter((n) => {
    if (filtre === "tous") return true;
    if (filtre === "non_lues") return !n.is_read;
    return n.channel === filtre;
  });

  /* ---------------------------------------------------------------
   * Envoi réel
   * --------------------------------------------------------------- */
  async function envoyer(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    if (!clientId) { setError("Sélectionnez un destinataire."); return; }
    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      const { data: profileRows } = await supabase.rpc("get_my_profile");
      const establishmentId = profileRows?.[0]?.establishment_id;
      if (!establishmentId) throw new Error("Établissement introuvable.");

      if (canal === "email") {
        // Vérification honnête : pas de service email branché → on le dit.
        throw new Error(
          "Aucun service d’email n’est configuré sur ce projet Supabase (SMTP transactionnel). " +
          "Configurez-le dans Supabase → Authentication → SMTP, puis réessayez — en attendant, aucun email n’est prétendu envoyé.",
        );
      }

      const { error: insertError } = await supabase.from("client_notifications").insert({
        establishment_id: establishmentId,
        client_id: clientId,
        title: titre.trim(),
        body: message.trim(),
        channel: canal,
        sent_at: canal === "inapp" ? new Date().toISOString() : null,
      });
      if (insertError) throw new Error(insertError.message);

      if (canal === "whatsapp") {
        const tel = (clientSelectionne?.phone ?? "").replace(/[^\d]/g, "");
        if (!tel) throw new Error("Ce client n’a pas de numéro de téléphone — WhatsApp impossible.");
        const texte = encodeURIComponent(`${titre.trim()}\n\n${message.trim()}\n\n— AUTO DYALI`);
        // Ouverture réelle de WhatsApp (aucun envoi simulé).
        window.open(`https://wa.me/${tel}?text=${texte}`, "_blank", "noopener");
        setNotice(`Notification enregistrée — WhatsApp s’est ouvert pour envoyer au ${clientSelectionne?.phone} (validez l’envoi dans WhatsApp).`);
      } else {
        setNotice(`Notification « ${titre.trim()} » envoyée dans l’espace client.`);
      }

      setTitre("");
      setMessage("");
      setClientId("");
      await charger();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Envoi impossible.");
    } finally {
      setSaving(false);
    }
  }

  async function marquerLue(notif: Notification) {
    if (!supabase) return;
    const { error: majError } = await supabase.from("client_notifications").update({ is_read: true }).eq("id", notif.id);
    if (majError) setError(majError.message);
    else await charger();
  }

  async function supprimer(notif: Notification) {
    if (!supabase) return;
    const { error: delError } = await supabase.from("client_notifications").delete().eq("id", notif.id);
    if (delError) setError(delError.message);
    else await charger();
  }

  return (
    <section className="space-y-6">
      {/* KPI réels */}
      <div className="grid gap-4 sm:grid-cols-3">
        <article className="carte p-5">
          <p className="text-xs text-[#A7B7A8]">Notifications envoyées</p>
          <p className="titre-or mt-1 text-2xl font-extrabold">{loading ? "…" : notifications.length}</p>
        </article>
        <article className="carte p-5">
          <p className="text-xs text-[#A7B7A8]">Non lues</p>
          <p className="titre-or mt-1 text-2xl font-extrabold">{loading ? "…" : nonLues}</p>
        </article>
        <article className="carte p-5">
          <p className="text-xs text-[#A7B7A8]">Clients joignables</p>
          <p className="titre-or mt-1 text-2xl font-extrabold">{loading ? "…" : clients.filter((c) => c.phone || c.email).length}</p>
        </article>
      </div>

      {notice && <p role="status" className="rounded-lg bg-[#5D9E7F]/10 px-4 py-3 text-sm text-[#7FBF9E]">{notice}</p>}
      {error && <p role="alert" className="rounded-lg bg-[#C5716B]/15 px-4 py-3 text-sm text-[#C5716B]">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-[24rem_1fr]">
        {/* Envoi */}
        <section className="carte h-fit p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-[#A7B7A8]">Nouvelle notification</p>
          <h2 className="titre-or mt-1 text-xl font-extrabold">Contacter un client</h2>

          <form onSubmit={(e) => void envoyer(e)} className="mt-4 space-y-3">
            <label className="block text-xs text-[#A7B7A8]">Destinataire *
              <select required className="champ mt-1 min-h-11" value={clientId} onChange={(e) => setClientId(e.target.value)}>
                <option value="">Choisir un client…</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.full_name}{c.phone ? ` · ${c.phone}` : ""}
                  </option>
                ))}
              </select>
            </label>

            <div>
              <p className="text-xs text-[#A7B7A8]">Canal</p>
              <div className="mt-1.5 grid gap-1.5">
                {CANAUX.map((c) => (
                  <label
                    key={c.cle}
                    className={`flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 text-xs transition ${
                      canal === c.cle ? "border-[#8FB59B] bg-[#344440]" : "border-[#8FB59B]/15 text-[#E8ECE8]/80"
                    }`}
                  >
                    <input
                      type="radio"
                      name="canal"
                      value={c.cle}
                      checked={canal === c.cle}
                      onChange={() => setCanal(c.cle)}
                      className="mt-0.5 h-4 w-4 accent-[#8FB59B]"
                    />
                    <span>
                      <strong className="block text-[#E8ECE8]">{c.label}</strong>
                      <span className="text-[#A7B7A8]">{c.note}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <label className="block text-xs text-[#A7B7A8]">Objet *
              <input required className="champ mt-1 min-h-11" placeholder="Rappel d’entretien, devis prêt…" value={titre} onChange={(e) => setTitre(e.target.value)} />
            </label>
            <label className="block text-xs text-[#A7B7A8]">Message *
              <textarea required rows={4} className="champ mt-1 py-2 text-sm" placeholder="Votre message…" value={message} onChange={(e) => setMessage(e.target.value)} />
            </label>

            {canal === "whatsapp" && !clientSelectionne?.phone && (
              <p className="rounded-lg bg-[#8FB59B]/10 px-3 py-2 text-xs text-[#D0C6AE]">
                Ce client n’a pas de numéro : ajoutez-le dans la fiche Client avant d’utiliser WhatsApp.
              </p>
            )}

            <button type="submit" disabled={saving} className="btn-or min-h-11 w-full text-sm disabled:opacity-40">
              {saving ? "Envoi…" : canal === "whatsapp" ? "Ouvrir WhatsApp" : canal === "email" ? "Envoyer l’email" : "Envoyer"}
            </button>
          </form>
        </section>

        {/* Historique */}
        <section className="carte overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#8FB59B]/10 p-5">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[#A7B7A8]">Historique</p>
              <h2 className="titre-or mt-1 text-xl font-extrabold">Notifications</h2>
            </div>
            <select value={filtre} onChange={(e) => setFiltre(e.target.value)} className="champ min-h-10 w-44 text-xs" aria-label="Filtrer les notifications">
              <option value="tous">Toutes</option>
              <option value="non_lues">Non lues</option>
              <option value="inapp">Espace client</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="email">Email</option>
            </select>
          </div>

          {loading ? (
            <p className="p-6 text-sm text-[#A7B7A8]">Chargement…</p>
          ) : (
            <ul className="divide-y divide-[#8FB59B]/10">
              {filtres.map((n) => (
                <li key={n.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-[#E8ECE8]">
                      {n.title}
                      {!n.is_read && <span className="ml-2 rounded-full bg-[#8FB59B]/20 px-2 py-0.5 text-[10px] text-[#D0C6AE]">non lue</span>}
                    </p>
                    <p className="mt-1 text-sm leading-5 text-[#A7B7A8]">{n.body}</p>
                    <p className="mt-1.5 text-[11px] text-[#A7B7A8]">
                      {n.client_nom ?? "Client"} · {n.channel === "whatsapp" ? "WhatsApp" : n.channel === "email" ? "Email" : "Espace client"} ·{" "}
                      {new Date(n.created_at).toLocaleString("fr-FR")}
                    </p>
                  </div>
                  <div className="flex gap-1.5">
                    {!n.is_read && (
                      <button type="button" onClick={() => void marquerLue(n)} className="rounded-lg border border-[#5D9E7F]/40 px-2.5 py-1.5 text-xs text-[#7FBF9E]">
                        Marquer lue
                      </button>
                    )}
                    <button type="button" onClick={() => void supprimer(n)} className="rounded-lg border border-[#C5716B]/40 px-2.5 py-1.5 text-xs text-[#C5716B]">
                      Supprimer
                    </button>
                  </div>
                </li>
              ))}
              {!filtres.length && <li className="p-8 text-center text-sm text-[#A7B7A8]">Aucune notification.</li>}
            </ul>
          )}
        </section>
      </div>
    </section>
  );
}
