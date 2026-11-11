"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase-browser";
import { formatMad } from "@/lib/catalogue-test";
import { modeleBonInterventionHtml, libelleStatut, type DonneesBon, type Etablissement } from "@/lib/print-pro";
import {
  chargerImprimantes,
  compterImpressions,
  etablissementCourant,
  imprimanteParDefaut,
  journaliserImpression,
  ouvrirImpressionNavigateur,
} from "@/lib/print-pro-client";

/**
 * Atelier & interventions — §9 du cahier des charges.
 * Ordres de réparation avec statut évolutif, affectation technicien,
 * validation client, KPI réels (en cours, terminés, chiffre d’affaires).
 */

type WorkOrder = {
  id: string;
  reference: string;
  status: string;
  diagnosis: string | null;
  due_at?: string | null;
  client_id: string;
  approved_by_client: boolean;
  total_amount: number;
  assigned_to: string | null;
  vehicle_id: string | null;
  created_at: string;
  vehicles: { plate: string; brand: string; model: string } | null;
  clients: { full_name: string } | null;
  employees: { full_name: string } | null;
};

type Employe = { id: string; full_name: string; job_title: string };

type Tache = {
  id: string;
  label: string;
  status: string;
  technician_id: string | null;
  price: number;
  quality_checked: boolean;
};

type Entretien = {
  id: string;
  reference: string;
  status: string;
  created_at: string;
  diagnosis: string | null;
  total_amount: number;
};

const STATUTS: { cle: string; label: string }[] = [
  { cle: "pending", label: "À faire" },
  { cle: "devis_en_attente", label: "Devis en attente client" },
  { cle: "in_progress", label: "En cours" },
  { cle: "waiting_parts", label: "Pièces en attente" },
  { cle: "done", label: "Terminé" },
  { cle: "delivered", label: "Livré" },
  { cle: "cancelled", label: "Annulé" },
];

const STATUT_COULEUR: Record<string, string> = {
  pending: "bg-[#8FB59B]/15 text-[#DFE7E2]",
  in_progress: "bg-[#8DA298]/15 text-[#8DA298]",
  waiting_parts: "bg-[#8FB59B]/15 text-[#DFE7E2]",
  devis_en_attente: "bg-[#C5B01A]/15 text-[#252D2D]",
  done: "bg-[#8DA298]/20 text-[#8DA298]",
  delivered: "bg-[#8DA298]/25 text-[#8DA298]",
  cancelled: "bg-[#C5716B]/15 text-[#C5716B]",
};

export function AtelierModule() {
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [employes, setEmployes] = useState<Employe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [traitement, setTraitement] = useState<string | null>(null);

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [vehicles, setVehicles] = useState<{ id: string; plate: string; brand: string; model: string; client_id: string }[]>([]);
  const [clients, setClients] = useState<{ id: string; full_name: string }[]>([]);
  const [form, setForm] = useState({ vehicleId: "", clientId: "", diagnosis: "" });
  const [filtreStatut, setFiltreStatut] = useState("actifs");
  const [openDevis, setOpenDevis] = useState(false);
  const [devisForm, setDevisForm] = useState({ clientId: "", vehicleId: "", diagnosis: "", reference: "" });

  // Détail d’un ordre : tâches + historique du véhicule
  const [selection, setSelection] = useState<WorkOrder | null>(null);
  const [taches, setTaches] = useState<Tache[]>([]);
  const [historique, setHistorique] = useState<Entretien[]>([]);
  const [chargementDetail, setChargementDetail] = useState(false);
  const [nouvelleTache, setNouvelleTache] = useState("");
  const [prixTache, setPrixTache] = useState("");

  async function loadOrders() {
    if (!supabase) {
      setError("Supabase n’est pas configuré.");
      setLoading(false);
      return;
    }
    const [{ data: ordersData, error: ordersError }, { data: vehiclesData }, { data: clientsData }, { data: employesData }] = await Promise.all([
      supabase
        .from("work_orders")
        .select("id, reference, status, diagnosis, approved_by_client, total_amount, assigned_to, vehicle_id, client_id, created_at, due_at, vehicles(plate, brand, model), clients(full_name), employees(full_name)")
        .order("created_at", { ascending: false }),
      supabase.from("vehicles").select("id, plate, brand, model, client_id").order("plate"),
      supabase.from("clients").select("id, full_name").order("full_name"),
      supabase.from("employees").select("id, full_name, job_title").eq("active_permanent", true).order("full_name"),
    ]);
    if (ordersError) setError(ordersError.message);
    else setOrders((ordersData ?? []) as unknown as WorkOrder[]);
    setVehicles((vehiclesData ?? []) as typeof vehicles);
    setClients((clientsData ?? []) as typeof clients);
    setEmployes((employesData ?? []) as Employe[]);
    setLoading(false);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void loadOrders(), 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------------------------------------------------------
   * KPI réels
   * --------------------------------------------------------------- */
  const kpis = [
    { label: "En cours", value: String(orders.filter((o) => o.status === "in_progress" || o.status === "waiting_parts").length) },
    { label: "À faire", value: String(orders.filter((o) => o.status === "pending").length) },
    { label: "Terminés / livrés", value: String(orders.filter((o) => o.status === "done" || o.status === "delivered").length) },
    {
      label: "CA interventions",
      value: formatMad(orders.filter((o) => o.status !== "cancelled").reduce((s, o) => s + Number(o.total_amount || 0), 0)),
    },
  ];

  const ordersFiltres = useMemo(() => {
    if (filtreStatut === "tous") return orders;
    if (filtreStatut === "actifs") return orders.filter((o) => ["pending", "in_progress", "waiting_parts"].includes(o.status));
    return orders.filter((o) => o.status === filtreStatut);
  }, [orders, filtreStatut]);

  /* ---------------------------------------------------------------
   * Détail : tâches de l’ordre + historique d’entretien du véhicule
   * --------------------------------------------------------------- */
  async function ouvrirDetail(order: WorkOrder) {
    if (!supabase) return;
    setSelection(order);
    setChargementDetail(true);
    setTaches([]);
    setHistorique([]);

    const [tachesReq, histoReq] = await Promise.all([
      supabase
        .from("work_order_tasks")
        .select("id, label, status, technician_id, price, quality_checked")
        .eq("work_order_id", order.id),
      order.vehicle_id
        ? supabase
            .from("work_orders")
            .select("id, reference, status, created_at, diagnosis, total_amount")
            .eq("vehicle_id", order.vehicle_id)
            .neq("id", order.id)
            .order("created_at", { ascending: false })
            .limit(15)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (!tachesReq.error) setTaches((tachesReq.data ?? []) as Tache[]);
    if (!histoReq.error) setHistorique((histoReq.data ?? []) as Entretien[]);
    setChargementDetail(false);
  }

  async function changerStatutTache(tache: Tache, statut: string) {
    if (!supabase || !selection) return;
    const { error: majError } = await supabase
      .from("work_order_tasks")
      .update({ status: statut })
      .eq("id", tache.id);
    if (majError) setError(majError.message);
    else {
      setNotice(`${tache.label} → ${statut === "done" ? "terminée" : statut === "in_progress" ? "en cours" : statut === "cancelled" ? "annulée" : "à faire"}.`);
      await ouvrirDetail(selection);
      await loadOrders();
    }
  }

  async function basculerControleQualite(tache: Tache) {
    if (!supabase || !selection) return;
    const { error: majError } = await supabase
      .from("work_order_tasks")
      .update({ quality_checked: !tache.quality_checked })
      .eq("id", tache.id);
    if (majError) setError(majError.message);
    else await ouvrirDetail(selection);
  }

  async function ajouterTache(event: FormEvent) {
    event.preventDefault();
    if (!supabase || !selection || !nouvelleTache.trim()) return;
    const { error: insertError } = await supabase.from("work_order_tasks").insert({
      establishment_id: (await supabase.rpc("get_my_profile")).data?.[0]?.establishment_id,
      work_order_id: selection.id,
      label: nouvelleTache.trim(),
      price: Number(prixTache) || 0,
      status: "pending",
      technician_id: selection.assigned_to,
    });
    if (insertError) setError(insertError.message);
    else {
      setNouvelleTache("");
      setPrixTache("");
      await ouvrirDetail(selection);
      await loadOrders();
    }
  }

  async function supprimerTache(tache: Tache) {
    if (!supabase || !selection) return;
    const { error: delError } = await supabase.from("work_order_tasks").delete().eq("id", tache.id);
    if (delError) setError(delError.message);
    else await ouvrirDetail(selection);
  }

  /* ---------------------------------------------------------------
   * Actions
   * --------------------------------------------------------------- */
  async function changerStatut(order: WorkOrder, statut: string) {
    if (!supabase) return;
    setTraitement(order.id);
    setError(null);
    const { error: majError } = await supabase
      .from("work_orders")
      .update({
        status: statut,
        closed_at: ["done", "delivered"].includes(statut) ? new Date().toISOString() : null,
      })
      .eq("id", order.id);
    if (majError) setError(majError.message);
    else {
      setNotice(`${order.reference} → ${STATUTS.find((s) => s.cle === statut)?.label ?? statut}.`);
      await loadOrders();
    }
    setTraitement(null);
  }

  async function affecterTechnicien(order: WorkOrder, employeId: string) {
    if (!supabase) return;
    setTraitement(order.id);
    setError(null);
    const { error: majError } = await supabase
      .from("work_orders")
      .update({ assigned_to: employeId || null })
      .eq("id", order.id);
    if (majError) setError(majError.message);
    else {
      const nom = employes.find((e) => e.id === employeId)?.full_name ?? "non affecté";
      setNotice(`${order.reference} → ${nom}.`);
      await loadOrders();
    }
    setTraitement(null);
  }

  async function basculerValidation(order: WorkOrder) {
    if (!supabase) return;
    setTraitement(order.id);
    const { error: majError } = await supabase
      .from("work_orders")
      .update({ approved_by_client: !order.approved_by_client })
      .eq("id", order.id);
    if (majError) setError(majError.message);
    else {
      setNotice(order.approved_by_client ? "Validation client retirée." : "Devis validé par le client.");
      await loadOrders();
    }
    setTraitement(null);
  }

  async function addOrder(event: FormEvent) {
    event.preventDefault();
    if (!supabase || !form.vehicleId || !form.clientId) return;
    setSaving(true);
    setError(null);
    const { data: profile } = await supabase.rpc("get_my_profile");
    const establishmentId = profile?.[0]?.establishment_id;
    const reference = `OR-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;
    const { error: insertError } = await supabase
      .from("work_orders")
      .insert({
        establishment_id: establishmentId,
        vehicle_id: form.vehicleId,
        client_id: form.clientId,
        reference,
        diagnosis: form.diagnosis.trim() || null,
        status: "pending",
        total_amount: 0,
      });
    if (insertError) setError(insertError.message);
    else {
      setNotice(`Ordre ${reference} créé.`);
      setOpen(false);
      setForm({ vehicleId: "", clientId: "", diagnosis: "" });
      await loadOrders();
    }
    setSaving(false);
  }

  /* ---------------------------------------------------------------
   * Workflow Devis → Ordre de réparation
   * --------------------------------------------------------------- */
  async function creerDevis(event: FormEvent) {
    event.preventDefault();
    if (!supabase || !devisForm.clientId || !devisForm.vehicleId) return;
    setSaving(true);
    setError(null);
    const { data: profile } = await supabase.rpc("get_my_profile");
    const establishmentId = profile?.[0]?.establishment_id;
    const reference = `DEV-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;
    const { error: insertError } = await supabase
      .from("work_orders")
      .insert({
        establishment_id: establishmentId,
        vehicle_id: devisForm.vehicleId,
        client_id: devisForm.clientId,
        reference,
        diagnosis: devisForm.diagnosis.trim() || null,
        status: "devis_en_attente",
        total_amount: 0,
      });
    if (insertError) setError(insertError.message);
    else {
      setNotice(`Devis ${reference} créé, en attente de validation client.`);
      setOpenDevis(false);
      setDevisForm({ clientId: "", vehicleId: "", diagnosis: "", reference: "" });
      await loadOrders();
    }
    setSaving(false);
  }

  async function accepterDevis(order: WorkOrder) {
    if (!supabase || !order) return;
    setTraitement(order.id);
    setError(null);
    
    // Mise à jour du statut en pending (ordre de réparation actif)
    const { error: majError } = await supabase
      .from("work_orders")
      .update({ status: "pending" })
      .eq("id", order.id);
    
    if (majError) {
      setError(majError.message);
    } else {
      setNotice(`Ordre ${order.reference} créé, devis validé.`);
      // Note : consommation de stock peut être déclenchée séparément
      // ou via l'interface de gestion de pièces
    }
    setTraitement(null);
    await loadOrders();
  }

  async function refuserDevis(order: WorkOrder) {
    if (!supabase || !order) return;
    setTraitement(order.id);
    setError(null);
    const { error: majError } = await supabase
      .from("work_orders")
      .update({ status: "pending" })
      .eq("id", order.id);
    if (majError) setError(majError.message);
    else setNotice(`Devis ${order.reference} refusé, retour à l'état précédent.`);
    setTraitement(null);
    await loadOrders();
  }

  /** Bon d'intervention imprimable — thermique (58/80) ou A4/PDF.
   *  Ce document N'EST NI une facture NI un ticket de paiement (mention
   *  en pied de page). Imprimable à l'ouverture, en suivi comme à la
   *  clôture : le statut courant figure sur le document. */
  async function imprimerBon(order: WorkOrder, format: "80mm" | "A4") {
    if (!supabase || traitement === order.id) return;
    setTraitement(order.id);
    setError(null);
    try {
      const [etab, tasksReq, ventesReq, vehiculeReq, clientReq] = await Promise.all([
        etablissementCourant(),
        supabase.from("work_order_tasks").select("label, status, price").eq("work_order_id", order.id).order("created_at"),
        supabase.from("sales").select("id, reference").eq("work_order_id", order.id),
        supabase.from("vehicles").select("mileage").eq("id", order.vehicle_id).single(),
        supabase.from("clients").select("phone").eq("id", order.client_id).single(),
      ]);
      if (tasksReq.error && !tasksReq.error.message.includes("does not exist")) throw new Error(tasksReq.error.message);

      // Pièces réellement consommées : lignes produits des ventes liées à l'ordre.
      const pieces: DonneesBon["pieces"] = [];
      const ventesLiees: string[] = [];
      for (const v of ventesReq.data ?? []) {
        ventesLiees.push(v.reference);
        const { data: items } = await supabase.from("sale_items").select("label, quantity, unit_price, product_id").eq("sale_id", v.id);
        for (const it of items ?? []) {
          if (!it.product_id) continue;
          pieces.push({ label: it.label, prix: Math.round(Number(it.quantity) * Number(it.unit_price) * 100) / 100 });
        }
      }

      const travaux: DonneesBon["travaux"] = (tasksReq.data ?? []).map((t) => ({ label: t.label, statut: libelleStatut(t.status, "fr") }));
      const mainOeuvre: DonneesBon["mainOeuvre"] = (tasksReq.data ?? [])
        .filter((t) => Number(t.price) > 0)
        .map((t) => ({ label: t.label, prix: Number(t.price) }));

      const donnees: DonneesBon = {
        reference: order.reference,
        dateOuverture: new Date(order.created_at).toLocaleString("fr-FR"),
        client: order.clients?.full_name ?? null,
        telephoneClient: clientReq.data?.phone ?? null,
        vehicule: {
          marque: order.vehicles?.brand ?? null,
          modele: order.vehicles?.model ?? null,
          plaque: order.vehicles?.plate ?? null,
          kilometrage: vehiculeReq.data?.mileage ?? null,
        },
        motif: null, // champ « motif » absent du schéma (non destructif) : le diagnostic décrit la visite
        diagnostic: order.diagnosis ?? null,
        travaux,
        pieces,
        mainOeuvre,
        technicien: order.employees?.full_name ?? null,
        statut: order.status,
        livraisonPrevue: order.due_at ? new Date(order.due_at).toLocaleDateString("fr-FR") : null,
        observations: null,
        clientApprouve: order.approved_by_client,
        ventesLiees: ventesLiees.length ? ventesLiees : undefined,
      };

      const etabSource: Etablissement = etab
        ? { nom: etab.nom, adresse: etab.adresse, ville: etab.ville, telephone: etab.telephone, email: etab.email }
        : { nom: "AUTO DYALI", adresse: null, ville: null, telephone: null, email: null };

      const reimpression = await compterImpressions(order.reference, "bon_intervention");
      const imprimantesListe = etab ? await chargerImprimantes(etab.id) : [];
      const imprimante = format === "A4" ? null : imprimanteParDefaut(imprimantesListe, "bon_intervention");

      const html = modeleBonInterventionHtml(donnees, etabSource, "fr", format, { copies: 1 });
      const res = ouvrirImpressionNavigateur(html);
      if (!res.ok) throw new Error(res.message ?? "Impression impossible.");
      setNotice(
        reimpression > 0
          ? `Bon d'intervention ${order.reference} réimprimé (n°${reimpression + 1}) — numéro initial conservé.`
          : `Bon d'intervention ${order.reference} envoyé au dialogue d'impression.`,
      );
      if (etab) {
        await journaliserImpression(
          etab.id, imprimante,
          { documentType: "bon_intervention", reference: order.reference, workOrderId: order.id, reimpression: reimpression > 0 ? reimpression + 1 : 0 },
          format, "fr", 1,
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impression du bon impossible.");
    } finally {
      setTraitement(null);
    }
  }

  return (
    <section className="space-y-6">
      {/* KPI réels */}
      <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <article key={k.label} className="carte p-3">
            <p className="text-xs text-[#A7B7A8]">{k.label}</p>
            <p className="titre-or mt-1 text-xl font-extrabold">{loading ? "…" : k.value}</p>
          </article>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-2 sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[#A7B7A8]">Production Supabase</p>
          <h1 className="titre-or mt-1 text-2xl font-extrabold">{loading ? "…" : /* k.value non utilisé ici, affiché ailleurs */ ''}</h1>
          <p className="mt-1 text-sm text-[#A7B7A8]">Statuts, techniciens affectés et validation client.</p>
        </div>
        <button type="button" onClick={() => setOpen(true)} className="btn-or min-h-11 px-4 text-sm">+ Nouvel ordre</button>
      </div>

      {notice && <p role="status" className="rounded-lg bg-[#8DA298]/10 px-4 py-3 text-sm text-[#8DA298]">{notice}</p>}
      {error && <p role="alert" className="rounded-lg bg-[#C5716B]/15 px-4 py-3 text-sm text-[#C5716B]">{error}</p>}

      <section className="carte overflow-hidden">
        <div className="flex flex-wrap gap-2 border-b border-[#8FB59B]/10 p-4">
          {[
            { cle: "actifs", label: "Interventions actives" },
            { cle: "tous", label: "Tous" },
            ...STATUTS.filter((s) => s.cle !== "pending").map((s) => ({ cle: s.cle, label: s.label })),
          ].map((f) => (
            <button
              key={f.cle}
              type="button"
              onClick={() => setFiltreStatut(f.cle)}
              className={`rounded-lg px-3 py-1.5 text-xs transition ${
                filtreStatut === f.cle ? "bg-[#8FB59B] font-bold text-[#252D2D]" : "bg-[#344440] text-[#8FB59B]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="p-8 text-center text-sm text-[#A7B7A8]">Chargement des ordres…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#344440]/50 text-xs uppercase text-[#A7B7A8]">
                <tr>
                  <th className="px-4 py-3">Référence</th>
                  <th className="px-4 py-3">Client / véhicule</th>
                  <th className="px-4 py-3">Diagnostic</th>
                  <th className="px-4 py-3">Technicien</th>
                  <th className="px-4 py-3">Validation</th>
                  <th className="px-4 py-3">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#8FB59B]/10">
                {ordersFiltres.map((order) => (
                  <tr key={order.id}>
                    <td className="px-4 py-4 font-semibold text-[#DFE7E2]">
                      <button type="button" onClick={() => void ouvrirDetail(order)} className="text-left hover:underline">
                        {order.reference}
                      </button>
                      <span className="block text-[11px] font-normal text-[#A7B7A8]">
                        {new Date(order.created_at).toLocaleDateString("fr-FR")}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-[#E8ECE8]">{order.clients?.full_name ?? "Client non lié"}</p>
                      <p className="text-xs text-[#A7B7A8]">
                        {order.vehicles ? `${order.vehicles.brand} ${order.vehicles.model} · ${order.vehicles.plate}` : "Véhicule non lié"}
                      </p>
                    </td>
                    <td className="max-w-52 px-4 py-4 text-[#E8ECE8]/80">{order.diagnosis ?? "—"}</td>
                    <td className="px-4 py-4">
                      <select
                        aria-label={`Technicien affecté à ${order.reference}`}
                        className="champ min-h-9 py-1 text-xs"
                        value={order.assigned_to ?? ""}
                        disabled={traitement === order.id}
                        onChange={(e) => void affecterTechnicien(order, e.target.value)}
                      >
                        <option value="">Non affecté</option>
                        {employes.map((emp) => <option key={emp.id} value={emp.id}>{emp.full_name}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-4">
                      <button
                        type="button"
                        disabled={traitement === order.id}
                        onClick={() => void basculerValidation(order)}
                        className={`rounded-lg px-2.5 py-1.5 text-[11px] font-semibold disabled:opacity-40 ${
                          order.approved_by_client ? "bg-[#8DA298]/20 text-[#8DA298]" : "border border-[#8FB59B]/30 text-[#A7B7A8]"
                        }`}
                      >
                        {order.approved_by_client ? "✓ Validé client" : "En attente client"}
                      </button>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-col gap-1.5">
                        <span className={`w-fit rounded-full px-3 py-1 text-[11px] font-semibold ${STATUT_COULEUR[order.status] ?? "bg-[#344440] text-[#DFE7E2]"}`}>
                          {STATUTS.find((s) => s.cle === order.status)?.label ?? order.status}
                        </span>
                        <select
                          aria-label={`Changer le statut de ${order.reference}`}
                          className="champ min-h-8 py-1 text-[11px]"
                          value=""
                          disabled={traitement === order.id}
                          onChange={(e) => { if (e.target.value) void changerStatut(order, e.target.value); }}
                        >
                          <option value="">Changer…</option>
                          {STATUTS.filter((s) => s.cle !== order.status).map((s) => <option key={s.cle} value={s.cle}>{s.label}</option>)}
                        </select>
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            disabled={traitement === order.id}
                            onClick={() => void imprimerBon(order, "80mm")}
                            title="Bon d'intervention thermique (80 mm par défaut, ou format de l'imprimante configurée)"
                            className="min-h-9 flex-1 touch-manipulation rounded-lg border border-[#8FB59B]/40 px-2 py-1 text-[11px] text-[#DFE7E2] disabled:opacity-40"
                          >
                            Bon
                          </button>
                          <button
                            type="button"
                            disabled={traitement === order.id}
                            onClick={() => void imprimerBon(order, "A4")}
                            title="Bon d'intervention A4 / PDF (avec zone de signature client)"
                            className="min-h-9 flex-1 touch-manipulation rounded-lg border border-[#8FB59B]/40 px-2 py-1 text-[11px] text-[#DFE7E2] disabled:opacity-40"
                          >
                            A4
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!ordersFiltres.length && <p className="p-8 text-center text-sm text-[#A7B7A8]">Aucun ordre dans cette vue.</p>}
          </div>
        )}
      </section>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-5">
          <form onSubmit={(e) => void addOrder(e)} className="carte w-full max-w-md p-6">
            <h2 className="titre-or text-xl font-extrabold">Nouvel ordre de réparation</h2>
            <div className="mt-5 grid gap-3">
              <select
                required
                className="champ min-h-11"
                value={form.vehicleId}
                onChange={(event) => {
                  const vehicleId = event.target.value;
                  const vehicle = vehicles.find((item) => item.id === vehicleId);
                  setForm({ ...form, vehicleId, clientId: vehicle?.client_id ?? form.clientId });
                }}
              >
                <option value="">Sélectionner le véhicule</option>
                {vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>{vehicle.brand} {vehicle.model} · {vehicle.plate}</option>
                ))}
              </select>
              <select required className="champ min-h-11" value={form.clientId} onChange={(event) => setForm({ ...form, clientId: event.target.value })}>
                <option value="">Sélectionner le client</option>
                {clients.map((client) => <option key={client.id} value={client.id}>{client.full_name}</option>)}
              </select>
              <textarea
                className="champ min-h-28"
                placeholder="Diagnostic ou besoin du client"
                value={form.diagnosis}
                onChange={(event) => setForm({ ...form, diagnosis: event.target.value })}
              />
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-4 py-2 text-sm text-[#A7B7A8]">Annuler</button>
              <button disabled={saving} type="submit" className="btn-or px-4 py-2 text-sm">{saving ? "Enregistrement…" : "Enregistrer"}</button>
            </div>
          </form>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* Détail : tâches + historique entretien                          */}
      {/* ------------------------------------------------------------- */}
      {selection && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-5">
          <div className="carte my-4 w-full max-w-4xl p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[#A7B7A8]">Ordre de réparation</p>
                <h2 className="titre-or mt-1 text-xl font-extrabold">{selection.reference}</h2>
                <p className="mt-1 text-sm text-[#A7B7A8]">
                  {selection.clients?.full_name ?? "Client non lié"}
                  {selection.vehicles ? ` · ${selection.vehicles.brand} ${selection.vehicles.model} · ${selection.vehicles.plate}` : ""}
                </p>
              </div>
              <button type="button" onClick={() => setSelection(null)} className="text-2xl text-[#A7B7A8]" aria-label="Fermer">×</button>
            </div>

            {chargementDetail ? (
              <p className="py-8 text-center text-sm text-[#A7B7A8]">Chargement du détail…</p>
            ) : (
              <div className="mt-5 grid gap-6 lg:grid-cols-2">
                {/* Tâches */}
                <section>
                  <p className="text-[10px] uppercase tracking-[0.15em] text-[#A7B7A8]">Tâches d’intervention ({taches.length})</p>

                  <form onSubmit={(e) => void ajouterTache(e)} className="mt-2 flex flex-wrap gap-2">
                    <input
                      value={nouvelleTache}
                      onChange={(e) => setNouvelleTache(e.target.value)}
                      placeholder="Nouvelle tâche (ex. Vidange moteur)"
                      className="champ min-h-10 min-w-40 flex-1"
                      aria-label="Libellé de la tâche"
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={prixTache}
                      onChange={(e) => setPrixTache(e.target.value)}
                      placeholder="Prix"
                      className="champ min-h-10 w-24"
                      aria-label="Prix de la tâche"
                    />
                    <button type="submit" className="btn-or px-3 py-2 text-xs">Ajouter</button>
                  </form>

                  <ul className="mt-3 space-y-2">
                    {taches.map((t) => (
                      <li key={t.id} className="rounded-lg border border-[#8FB59B]/10 bg-[#344440]/40 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-[#E8ECE8]">{t.label}</p>
                          <span className="text-xs font-bold text-[#DFE7E2]">{Number(t.price) > 0 ? formatMad(Number(t.price)) : "—"}</span>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <select
                            aria-label={`Statut de la tâche ${t.label}`}
                            className="champ min-h-8 w-36 py-1 text-[11px]"
                            value={t.status}
                            onChange={(e) => void changerStatutTache(t, e.target.value)}
                          >
                            <option value="pending">À faire</option>
                            <option value="in_progress">En cours</option>
                            <option value="done">Terminée</option>
                            <option value="cancelled">Annulée</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => void basculerControleQualite(t)}
                            className={`rounded-lg px-2.5 py-1.5 text-[11px] font-semibold ${
                              t.quality_checked ? "bg-[#8DA298]/20 text-[#8DA298]" : "border border-[#8FB59B]/30 text-[#A7B7A8]"
                            }`}
                          >
                            {t.quality_checked ? "✓ Contrôle qualité" : "Contrôle qualité"}
                          </button>
                          <button
                            type="button"
                            onClick={() => void supprimerTache(t)}
                            className="ml-auto rounded-lg border border-[#C5716B]/40 px-2.5 py-1.5 text-[11px] text-[#C5716B]"
                          >
                            Supprimer
                          </button>
                        </div>
                      </li>
                    ))}
                    {!taches.length && (
                      <li className="py-4 text-center text-sm text-[#A7B7A8]">
                        Aucune tâche — décomposez l’intervention pour suivi et contrôle qualité.
                      </li>
                    )}
                  </ul>
                </section>

                {/* Historique entretien du véhicule */}
                <section>
                  <p className="text-[10px] uppercase tracking-[0.15em] text-[#A7B7A8]">
                    Historique d’entretien du véhicule ({historique.length})
                  </p>
                  <ul className="mt-2 space-y-2">
                    {historique.map((h) => (
                      <li key={h.id} className="rounded-lg bg-[#344440]/40 px-3 py-2.5 text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-[#DFE7E2]">{h.reference}</span>
                          <span className="text-[11px] text-[#A7B7A8]">{new Date(h.created_at).toLocaleDateString("fr-FR")}</span>
                        </div>
                        <p className="mt-1 truncate text-[11px] text-[#A7B7A8]">
                          {h.diagnosis ?? "Sans diagnostic"} · {formatMad(Number(h.total_amount))}
                        </p>
                      </li>
                    ))}
                    {!historique.length && (
                      <li className="py-4 text-center text-sm text-[#A7B7A8]">
                        Première intervention de ce véhicule — l’historique se construit ici.
                      </li>
                    )}
                  </ul>
                  <p className="mt-3 text-[11px] leading-4 text-[#A7B7A8]">
                    Kilométrage déclaré : voir la fiche Véhicules. Les prochaines interventions s’ajouteront automatiquement.
                  </p>
                </section>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
