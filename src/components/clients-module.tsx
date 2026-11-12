"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase-browser";
import { formatMad } from "@/lib/catalogue-test";
import { prochaineEcheance } from "@/lib/crm";

/**
 * Clients — fiche complète (§5 du cahier des charges).
 * - Liste réelle avec solde (balance_due) et nombre de véhicules.
 * - Fiche détaillée : véhicules, ventes (dont reste dû), interventions.
 * - Encaissement du crédit client (paiement tracé dans payments).
 * - Type de client, segmentation, détection doublons.
 */

type ClientType = "particulier" | "entreprise" | "flotte" | "professionnel" | "occasionnel";

type Client = {
  id: string;
  code: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  client_type: ClientType;
  balance_due: number;
  vehicles: { id: string; label: string }[] | null;
  segment: "nouveau" | "regulier" | "fidele" | "inactif";
  prochaineEcheance: string | null;
};

type EntrepriseInfo = {
  ice: string | null;
  raison_sociale: string | null;
  rc: string | null;
};

type VehiculeClient = { id: string; plate: string; brand: string; model: string; year: number | null };

type VenteClient = {
  id: string;
  reference: string;
  status: string;
  total: number;
  paid_total: number;
  created_at: string;
};

type InterventionClient = {
  id: string;
  reference: string;
  status: string;
  created_at: string;
  diagnosis: string | null;
};

const STATUTS_INTERVENTION: Record<string, string> = {
  pending: "À faire",
  in_progress: "En cours",
  waiting_parts: "Pièces en attente",
  done: "Terminé",
  delivered: "Livré",
  cancelled: "Annulé",
};

export function ClientsModule() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ fullName: "", phone: "", email: "", code: "", clientType: "particulier" as ClientType, ice: "" });
  const [recherche, setRecherche] = useState("");

  // Fiche ouverte
  const [selection, setSelection] = useState<Client | null>(null);
  const [vehicules, setVehicules] = useState<VehiculeClient[]>([]);
  const [ventes, setVentes] = useState<VenteClient[]>([]);
  const [interventions, setInterventions] = useState<InterventionClient[]>([]);
  const [chargementFiche, setChargementFiche] = useState(false);
  const [encaissement, setEncaissement] = useState(false);
  const [montantRecu, setMontantRecu] = useState("");

  async function loadClients() {
    if (!supabase) {
      setError("Supabase n’est pas configuré.");
      setLoading(false);
      return;
    }
    const { data, error: queryError } = await supabase
      .from("clients")
      .select("id, code, full_name, phone, email, balance_due, vehicles(id)")
      .order("full_name");
    if (queryError) setError(queryError.message);
    else setClients((data ?? []) as Client[]);
    setLoading(false);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void loadClients(), 0);
    return () => window.clearTimeout(timer);
    // Rechargement initial unique.
  }, []);

  const clientsFiltres = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(
      (c) =>
        c.full_name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        (c.phone ?? "").includes(q) ||
        (c.email ?? "").toLowerCase().includes(q),
    );
  }, [clients, recherche]);

  const totalCreances = clients.reduce((s, c) => s + Number(c.balance_due ?? 0), 0);

  /* ---------------------------------------------------------------
   * Fiche détaillée
   * --------------------------------------------------------------- */
  async function ouvrirFiche(client: Client) {
    if (!supabase) return;
    setSelection(client);
    setChargementFiche(true);
    setVehicules([]);
    setVentes([]);
    setInterventions([]);
    // Calculer le segment client basé sur la dernière intervention
    const [vehReq, ventesReq, interReq] = await Promise.all([
      supabase.from("vehicles").select("id, plate, brand, model, year").eq("client_id", client.id).order("brand"),
      supabase.from("sales").select("id, reference, status, total, paid_total, created_at").eq("client_id", client.id).order("created_at", { ascending: false }).limit(30),
      supabase.from("work_orders").select("id, reference, status, created_at, diagnosis").eq("client_id", client.id).order("created_at", { ascending: false }).limit(20),
    ]);
    if (!vehReq.error) setVehicules((vehReq.data ?? []) as VehiculeClient[]);
    if (!ventesReq.error) setVentes((ventesReq.data ?? []) as VenteClient[]);
    if (!interReq.error) {
      setInterventions((interReq.data ?? []) as InterventionClient[]);
      // Déterminer le segment et la prochaine échéance basés sur la dernière intervention
      const derniereInter = (interReq.data ?? []).at(0);
      const seg = derniereInter ? calculerSegment(derniereInter.created_at) : "inactif";
      const prossEch = derniereInter ? prochaineEcheance(derniereInter.created_at, null, null) : null;
      // Mise à jour du segment et de la prochaine échéance dans la sélection
      const current = selection ?? { id: "", code: "", full_name: "", phone: null, email: null, client_type: "particulier", balance_due: 0, vehicles: [], segment: "inactif", prochaineEcheance: null };
      setSelection({ ...current, segment: seg, prochaineEcheance: prossEch } as Client);
    }
    setChargementFiche(false);
  }

  async function encaisserSolde() {
    if (!supabase || !selection) return;
    const montant = Number(montantRecu) || 0;
    if (montant <= 0) { setError("Saisissez le montant encaissé."); return; }
    if (montant > Number(selection.balance_due) + 0.001) {
      setError(`Montant supérieur au solde dû (${formatMad(Number(selection.balance_due))}).`);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { data: profileRows } = await supabase.rpc("get_my_profile");
      const establishmentId = profileRows?.[0]?.establishment_id;
      if (!establishmentId) throw new Error("Établissement introuvable.");
      const { data: sessionData } = await supabase.auth.getSession();

      // Paiement de crédit : vente la plus ancienne non soldée du client
      const { data: ventesDu } = await supabase
        .from("sales")
        .select("id, total, paid_total")
        .eq("client_id", selection.id)
        .in("status", ["open", "partial"])
        .order("created_at");

      const venteCible = (ventesDu ?? []).find(
        (v) => Number(v.total) - Number(v.paid_total) > 0.001,
      );
      if (!venteCible) throw new Error("Aucune vente à crédit trouvée pour ce client.");

      const { error: payError } = await supabase.from("payments").insert({
        establishment_id: establishmentId,
        sale_id: venteCible.id,
        method: "cash",
        amount: montant,
        received_by: sessionData.session?.user.id ?? null,
      });
      if (payError) throw new Error(payError.message);

      const nouveauPaye = Number(venteCible.paid_total) + montant;
      const resteVente = Number(venteCible.total) - nouveauPaye;
      const { error: majError } = await supabase
        .from("sales")
        .update({
          paid_total: nouveauPaye,
          status: resteVente <= 0.001 ? "paid" : "partial",
        })
        .eq("id", venteCible.id);
      if (majError) throw new Error(majError.message);

      // Solde client recalculé (reste total de ses ventes ouvertes)
      const { data: resteCalcule } = await supabase
        .from("sales")
        .select("total, paid_total")
        .eq("client_id", selection.id)
        .in("status", ["open", "partial"]);
      const solde = (resteCalcule ?? []).reduce(
        (s, v) => s + Math.max(0, Number(v.total) - Number(v.paid_total)),
        0,
      );
      const { error: clientError } = await supabase
        .from("clients")
        .update({ balance_due: solde })
        .eq("id", selection.id);
      if (clientError) throw new Error(clientError.message);

      setNotice(`Encaissement de ${formatMad(montant)} pour ${selection.full_name} — reste ${formatMad(solde)}.`);
      setEncaissement(false);
      setMontantRecu("");
      await loadClients();
      const majSelection = { ...selection, balance_due: solde };
      setSelection(majSelection);
      await ouvrirFiche(majSelection);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Encaissement impossible.");
    } finally {
      setSaving(false);
    }
  }

  /* ---------------------------------------------------------------
   * Calcul de la segmentation client
   * - Nouveau: création récente (dans les 3 derniers mois)
   * - Régulier: visite dans les 6 derniers mois
   * - Fidèle: plusieurs interventions ou gros chiffre d'affaires
   * - Inactif: pas de visite depuis plus de 6 mois
   * --------------------------------------------------------------- */
  function calculerSegment(derniereInterventionIso: string | null): "nouveau" | "regulier" | "fidele" | "inactif" {
    if (!derniereInterventionIso) {
      // Pas d'intervention : on considère "nouveau" si le client est récent, sinon "inactif"
      // On utilisera la date de création depuis la base pour déterminer
      return "inactif";
    }
    const dateInt = new Date(derniereInterventionIso);
    const maintenant = new Date();
    const diffMois = (maintenant.getFullYear() - dateInt.getFullYear()) * 12 + (maintenant.getMonth() - dateInt.getMonth());

    if (diffMois <= 3) return "nouveau";
    if (diffMois <= 6) return "regulier";
    if (diffMois <= 12) return "fidele";
    return "inactif";
  }
  /* ---------------------------------------------------------------
   * Normalisation de téléphone : enlève espaces, gère indicatif +212/0
   * --------------------------------------------------------------- */
  function normaliserTelephone(phone: string | null): string | null {
    if (!phone) return null;
    // Enlève tous les espaces et caractères non numériques
    let p = phone.replace(/\s/g, "").replace(/[^\d+]/g, "");
    // Si commence par +212 et fait 12 chiffres, remplace par 0 (numéro marocain)
    if (p.startsWith("+212") && p.length === 13) p = "0" + p.substring(4);
    // Si commence par 0 et fait 9 chiffres, garde tel quel
    if (p.startsWith("0") && p.length === 9) return p;
    // Si 8 chiffres sans 0 initial, ajoute 0
    if (p.length === 8) p = "0" + p;
    return p;
  }

  /* ---------------------------------------------------------------
   * Détection de doublons — recherche client existant par téléphone/email/ICE normalisés
   * --------------------------------------------------------------- */
  async function verifierDoublonsClient(
    phone: string | null,
    email: string | null,
    ice: string | null,
    excludeId: string | null = null
  ) {
    if (!supabase) return { doublons: [] };

    // Normalisations
    const phoneNorm = normaliserTelephone(phone);
    const emailLower = (email ?? "").toLowerCase().trim();
    const iceNorm = (ice ?? "").trim().toUpperCase();

    const q: string[] = [];
    if (phoneNorm) q.push(`phone.eq.${phoneNorm}`);
    if (emailLower) q.push(`email.eq.${emailLower}`);
    if (iceNorm) q.push(`ice.eq.${iceNorm}`);
    if (q.length === 0) return { doublons: [] };

    const whereClause = q.join(",");
    const { data, error } = await supabase
      .from("clients")
      .select("id, full_name, phone, email, ice")
      .or(`full_name.ilike.%${form.fullName.trim()}%,${whereClause}`)
      .limit(100);

    if (error) return { doublons: [], erreur: error.message };

    const doublons = (data ?? []).filter(
      (c: { id: string }) => c.id !== excludeId
    );
    return { doublons };
  }

  async function createClient(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    setSaving(true);
    setError(null);

    const { data: profileRows, error: profileError } = await supabase.rpc("get_my_profile");
    const establishmentId = profileRows?.[0]?.establishment_id;
    if (profileError || !establishmentId) {
      setError("Impossible de retrouver l’établissement du Manager.");
      setSaving(false);
      return;
    }

    // 👉 Détection de doublons avant création
    const { doublons, erreur } = await verifierDoublonsClient(
      form.phone,
      form.email,
      form.ice || null,
      selection?.id || null
    );
    if (erreur) {
      setError(erreur);
      setSaving(false);
      return;
    }
    if (doublons.length > 0) {
      // Afficher les correspondances probables et laisser l'utilisateur choisir
      setNotice(
        `⚠ ${doublons.length} correspondance(s) probable(s) trouvée(s). Ouvrez la fiche existante ou corrigez les informations.`
      );
      // Afficher les correspondances probables et laisser l'utilisateur choisir
      setNotice(
        `⚠ ${doublons.length} correspondance(s) probable(s) trouvée(s). Ouvrez la fiche existante ou corrigez les informations.`
      );
      // Transformer le doublon en forme Client pour setSelection
      const raw = doublons[0] as {
        id: string;
        code?: string | null;
        full_name?: string | null;
        phone?: string | null;
        email?: string | null;
        client_type?: ClientType;
        balance_due?: number | null;
        vehicles?: Array<{ id: string; brand?: string; model?: string }> | null;
      };
      const doublonClient: Client = {
        id: raw.id,
        code: raw.code || "",
        full_name: raw.full_name || "",
        phone: raw.phone || null,
        email: raw.email || null,
        client_type: raw.client_type || "particulier",
        balance_due: Number(raw.balance_due ?? 0),
        vehicles: (raw.vehicles ?? []).map((v) => ({ id: v.id, label: `${v.brand ?? ""} ${v.model ?? ""}`.trim() })),
        segment: "nouveau",
        prochaineEcheance: null,
      };
      setSelection(doublonClient);
      setSaving(false);
      return;
    }

    const { error: insertError } = await supabase.from("clients").insert({
      establishment_id: establishmentId,
      code: form.code.trim(),
      full_name: form.fullName.trim(),
      client_type: form.clientType as ClientType,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      ice: form.ice || null,
    });
    if (insertError) setError(insertError.message);
    else {
      setNotice(`Client « ${form.fullName.trim()} » créé.`);
      setForm({ fullName: "", phone: "", email: "", code: "", clientType: "particulier", ice: "" });
      setFormOpen(false);
      await loadClients();
    }
    setSaving(false);
  }

  return (
    <section className="space-y-6">
      {/* KPI réels */}
      <div className="grid gap-4 sm:grid-cols-3">
        <article className="carte p-5">
          <p className="text-xs text-[#A7B7A8]">Clients</p>
          <p className="titre-or mt-1 text-2xl font-extrabold">{loading ? "…" : clients.length}</p>
        </article>
        <article className="carte p-5">
          <p className="text-xs text-[#A7B7A8]">Créances clients (solde dû)</p>
          <p className="titre-or mt-1 text-2xl font-extrabold">{loading ? "…" : formatMad(totalCreances)}</p>
        </article>
        <article className="carte p-5">
          <p className="text-xs text-[#A7B7A8]">Avec véhicule suivi</p>
          <p className="titre-or mt-1 text-2xl font-extrabold">
            {loading ? "…" : clients.filter((c) => (c.vehicles?.length ?? 0) > 0).length}
          </p>
        </article>
      </div>

      {notice && <p role="status" className="rounded-lg bg-[#5D9E7F]/10 px-4 py-3 text-sm text-[#7FBF9E]">{notice}</p>}
      {error && <p role="alert" className="rounded-lg bg-[#C5716B]/15 px-4 py-3 text-sm text-[#C5716B]">{error}</p>}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[#A7B7A8]">CRM garage</p>
          <h1 className="titre-or mt-1 text-2xl font-extrabold">Clients</h1>
          <p className="mt-1 text-sm text-[#A7B7A8]">Fiches complètes : véhicules, ventes, interventions et crédit.</p>
        </div>
        <button type="button" onClick={() => { setFormOpen(true); setError(null); setNotice(null); }} className="btn-or px-5 py-2.5 text-sm">
          + Nouveau client
        </button>
      </div>

      <section className="carte overflow-hidden">
        <div className="border-b border-[#8FB59B]/10 p-4">
          <input
            type="search"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Rechercher : nom, code, téléphone, email…"
            className="champ min-h-11 w-full"
            aria-label="Rechercher un client"
          />
        </div>

        {loading ? (
          <p className="p-8 text-center text-sm text-[#A7B7A8]">Chargement des clients…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-[#344440]/50 text-xs uppercase text-[#A7B7A8]">
                <tr>
                  <th className="px-5 py-3">Client</th>
                  <th className="px-5 py-3">Contact</th>
                  <th className="px-5 py-3 text-right">Véhicules</th>
                  <th className="px-5 py-3 text-right">Solde dû</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#8FB59B]/10">
                {clientsFiltres.map((c) => {
                  const solde = Number(c.balance_due ?? 0);
                  const typeLabel: Record<ClientType, string> = {
                    particulier: "Particulier",
                    entreprise: "Entreprise",
                    flotte: "Flotte",
                    professionnel: "Professionnel",
                    occasionnel: "Occasionnel",
                  };
                  const segmentLabel: Record<"nouveau" | "regulier" | "fidele" | "inactif", string> = {
                    nouveau: "Nouveau",
                    regulier: "Régulier",
                    fidele: "Fidèle",
                    inactif: "Inactif",
                  };
                  return (
                    <tr key={c.id}>
                      <td className="px-5 py-4">
                        <p className="font-semibold text-[#E8ECE8]">{c.full_name}</p>
                        <p className="text-[11px] text-[#A7B7A8]">{c.code}</p>
                        <p className="text-[10px] text-[#8FB59B]">{typeLabel[c.client_type ?? "particulier"]}</p>
                        <p className="text-[10px] text-[#7FBF9E]">{segmentLabel[c.segment ?? "nouveau"]}</p>
                      </td>
                      <td className="px-5 py-4 text-[#A7B7A8]">
                        {c.phone ?? "—"}
                        {c.email && <span className="block text-[11px]">{c.email}</span>}
                      </td>
                      <td className="px-5 py-4 text-right text-[#DFE7E2]">{c.vehicles?.length ?? 0}</td>
                      <td className={`px-5 py-4 text-right font-bold ${solde > 0.001 ? "text-[#8FB59B]" : "text-[#5D9E7F]"}`}>
                        {formatMad(solde)}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <span className="text-[10px] uppercase text-[#A7B7A8]">{segmentLabel[c.segment ?? "nouveau"]}</span>
                        <button type="button" onClick={() => void ouvrirFiche(c)} className="rounded-lg border border-[#8FB59B]/40 px-3 py-1.5 text-xs text-[#DFE7E2] mt-1">
                          Ouvrir la fiche
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!clientsFiltres.length && (
              <p className="p-8 text-center text-sm text-[#A7B7A8]">Aucun client ne correspond — créez-le avec « + Nouveau client ».</p>
            )}
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------- */}
      {/* Fiche client                                                   */}
      {/* ------------------------------------------------------------- */}
      {selection && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-5">
          <div className="carte my-4 w-full max-w-4xl p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[#A7B7A8]">Fiche client</p>
                <h2 className="titre-or mt-1 text-xl font-extrabold">{selection.full_name}</h2>
                <p className="mt-1 text-sm text-[#A7B7A8]">
                  {selection.code} · {selection.phone ?? "téléphone non renseigné"}
                  {selection.email ? ` · ${selection.email}` : ""}
                </p>
                {selection.phone && (
                  <a
                    href={`https://wa.me/${selection.phone.replace(/\D/g, "").replace(/^0/, "212")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-block rounded-lg border border-[#8DA298]/40 px-3 py-1.5 text-xs text-[#8DA298]"
                  >
                    Ouvrir WhatsApp (conversation réelle)
                  </a>
                )}
              </div>
              <button type="button" onClick={() => setSelection(null)} className="text-2xl text-[#A7B7A8]" aria-label="Fermer">×</button>
            </div>

            {/* Solde */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#8FB59B]/20 bg-[#344440]/40 p-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.15em] text-[#A7B7A8]">Solde client</p>
                <p className={`titre-or mt-1 text-2xl font-extrabold ${Number(selection.balance_due) > 0.001 ? "text-[#8FB59B]" : "text-[#5D9E7F]"}`}>
                  {formatMad(Number(selection.balance_due ?? 0))}
                </p>
              </div>
              {Number(selection.balance_due) > 0.001 && (
                <button type="button" onClick={() => { setEncaissement(true); setMontantRecu(String(Number(selection.balance_due).toFixed(2))); setError(null); }} className="btn-or px-4 py-2 text-sm">
                  Encaisser le crédit
                </button>
              )}
            </div>

            {encaissement && (
              <div className="mt-3 flex flex-wrap items-end gap-3 rounded-xl border border-[#5D9E7F]/30 bg-[#5D9E7F]/10 p-4">
                <label className="text-xs text-[#A7B7A8]">
                  Montant reçu (MAD)
                  <input type="number" min="0.01" step="0.01" className="champ mt-1 min-h-10 w-40" value={montantRecu} onChange={(e) => setMontantRecu(e.target.value)} />
                </label>
                <button type="button" onClick={() => void encaisserSolde()} disabled={saving} className="btn-or px-4 py-2 text-sm disabled:opacity-40">
                  {saving ? "Enregistrement…" : "Valider l’encaissement"}
                </button>
                <button type="button" onClick={() => setEncaissement(false)} className="px-3 py-2 text-sm text-[#A7B7A8]">Annuler</button>
                <p className="w-full text-[11px] text-[#A7B7A8]">
                  Le paiement est enregistré sur la vente à crédit la plus ancienne et le solde est recalculé.
                </p>
              </div>
            )}

            {chargementFiche ? (
              <p className="py-8 text-center text-sm text-[#A7B7A8]">Chargement de la fiche…</p>
            ) : (
              <div className="mt-5 grid gap-5 lg:grid-cols-3">
                {/* Alertes entretien */}
                <section>
                  <p className="text-[10px] uppercase tracking-[0.15em] text-[#A7B7A8]">Rappels entretien</p>
                  <div className="alert-box">
                    {selection.prochaineEcheance ? (
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[#D6B66F]/20 flex items-center justify-center shrink-0">
                          <svg className="w-4 h-4 text-[#D6B66F]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path d="M12 2v2M12 22v2M4.93 4.93l2.83 2.83a1 1 0 0 1 0 1.41l-2.83 2.83a1 1 0 1 1-1.41-1.41L12 9l2.66 1.33a2 2 0 0 1 1.42 1.77l-2.59 2.85a1 1 0 0 1-1.06 0l-2.71-2.7a2 2 0 0 1 0-2.98 2.2 2 0 0 0-2.79-.04m5.66 0a1 1 0 1 1 0 2h-.01M12 14l-1.41-1.41m-5.66 0a1 1 0 1 1 0-2h.01M12 14l1.41-1.41m5.66 0a1 1 0 1 1 0 2h-.01"/>
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] uppercase tracking-[0.15em] text-[#D6B66F] mb-1">Prochaine échéance</p>
                          <p className="text-[12px] font-medium text-[#E8ECE8]">{new Date(selection.prochaineEcheance).toLocaleDateString("fr-FR")}</p>
                          <p className="text-[10px] text-[#A7B7A8]">{selection.prochaineEcheance ? `3 mois après ${selection.full_name === "" ? "la dernière intervention" : ""}` : ""}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 text-center text-[#7FBF9E]">
                        <p className="text-[10px] uppercase tracking-[0.15em] text-[#7FBF9E]">Pas d&apos;échéance</p>
                        <p className="text-[12px] text-[#E8ECE8]">Aucune intervention récente pour calculer la prochaine échéance.</p>
                      </div>
                    )}
                  </div>
                </section>

                {/* Véhicules */}
                <section>
                  <p className="text-[10px] uppercase tracking-[0.15em] text-[#A7B7A8]">Véhicules ({vehicules.length})</p>
                  <ul className="mt-2 space-y-2">
                    {vehicules.map((v) => (
                      <li key={v.id} className="flex items-center justify-between gap-2 rounded-lg bg-[#344440]/50 px-3 py-2 text-sm">
                        <span className="text-[#E8ECE8]">{v.brand} {v.model}</span>
                        <span className="font-mono text-xs text-[#DFE7E2]">{v.plate}</span>
                      </li>
                    ))}
                    {!vehicules.length && <li className="text-xs text-[#A7B7A8]">Aucun véhicule.</li>}
                  </ul>
                </section>

                {/* Ventes */}
                <section>
                  <p className="text-[10px] uppercase tracking-[0.15em] text-[#A7B7A8]">Ventes ({ventes.length})</p>
                  <ul className="mt-2 max-h-64 space-y-2 overflow-y-auto pr-1">
                    {ventes.map((v) => {
                      const reste = Math.max(0, Number(v.total) - Number(v.paid_total));
                      return (
                        <li key={v.id} className="rounded-lg bg-[#344440]/50 px-3 py-2 text-sm">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-[#DFE7E2]">{v.reference}</span>
                            <span className="text-xs font-bold text-[#E8ECE8]">{formatMad(Number(v.total))}</span>
                          </div>
                          <p className="mt-1 text-[11px] text-[#A7B7A8]">
                            {new Date(v.created_at).toLocaleDateString("fr-FR")}
                            {reste > 0.001 ? ` · reste ${formatMad(reste)}` : " · soldée"}
                          </p>
                        </li>
                      );
                    })}
                    {!ventes.length && <li className="text-xs text-[#A7B7A8]">Aucune vente.</li>}
                  </ul>
                </section>

                {/* Interventions */}
                <section>
                  <p className="text-[10px] uppercase tracking-[0.15em] text-[#A7B7A8]">Interventions ({interventions.length})</p>
                  <ul className="mt-2 max-h-64 space-y-2 overflow-y-auto pr-1">
                    {interventions.map((i) => (
                      <li key={i.id} className="rounded-lg bg-[#344440]/50 px-3 py-2 text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-[#DFE7E2]">{i.reference}</span>
                          <span className="rounded-full bg-[#344440] px-2 py-0.5 text-[10px] text-[#E8ECE8]">
                            {STATUTS_INTERVENTION[i.status] ?? i.status}
                          </span>
                        </div>
                        <p className="mt-1 truncate text-[11px] text-[#A7B7A8]">
                          {i.diagnosis ?? new Date(i.created_at).toLocaleDateString("fr-FR")}
                        </p>
                      </li>
                    ))}
                    {!interventions.length && <li className="text-xs text-[#A7B7A8]">Aucune intervention.</li>}
                  </ul>
                </section>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* Modale création                                                */}
      {/* ------------------------------------------------------------- */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-5" role="dialog" aria-modal="true" aria-labelledby="nouveau-client-titre">
          <form onSubmit={(e) => void createClient(e)} className="carte w-full max-w-md p-6">
            <h2 id="nouveau-client-titre" className="titre-or text-xl font-extrabold">Nouveau client</h2>
            <div className="mt-5 grid gap-3">
              <input required className="champ" placeholder="Code client (ex. CL-0006)" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} />
              <input required className="champ" placeholder="Nom complet" value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} />
              <input className="champ" type="tel" placeholder="Téléphone" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
              <input className="champ" type="email" placeholder="Email (facultatif)" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
              <select className="champ mt-1 min-h-11" value={form.clientType} onChange={(event) => setForm({ ...form, clientType: event.target.value as ClientType })} >
                <option value="particulier">Particulier</option>
                <option value="entreprise">Entreprise</option>
                <option value="flotte">Flotte</option>
                <option value="professionnel">Professionnel</option>
                <option value="occasionnel">Occasionnel</option>
              </select>
              <input className="champ" placeholder="ICE / RC (Entreprise)" value={form.ice} onChange={(event) => setForm({ ...form, ice: event.target.value })} />
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setFormOpen(false)} className="rounded-lg px-4 py-2 text-sm text-[#A7B7A8]">Annuler</button>
              <button disabled={saving} type="submit" className="btn-or px-4 py-2 text-sm">{saving ? "Enregistrement…" : "Enregistrer"}</button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
