"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase-browser";
import { formatMad } from "@/lib/catalogue-test";

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
  { cle: "in_progress", label: "En cours" },
  { cle: "waiting_parts", label: "Pièces en attente" },
  { cle: "done", label: "Terminé" },
  { cle: "delivered", label: "Livré" },
  { cle: "cancelled", label: "Annulé" },
];

const STATUT_COULEUR: Record<string, string> = {
  pending: "bg-[#d6b66f]/15 text-[#e9d998]",
  in_progress: "bg-[#90a0b0]/15 text-[#90a0b0]",
  waiting_parts: "bg-[#d6b66f]/15 text-[#e9d998]",
  done: "bg-[#90a0b0]/20 text-[#90a0b0]",
  delivered: "bg-[#90a0b0]/25 text-[#90a0b0]",
  cancelled: "bg-[#d66868]/15 text-[#d66868]",
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
        .select("id, reference, status, diagnosis, approved_by_client, total_amount, assigned_to, vehicle_id, created_at, vehicles(plate, brand, model), clients(full_name), employees(full_name)")
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

  return (
    <section className="space-y-6">
      {/* KPI réels */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <article key={k.label} className="carte p-5">
            <p className="text-xs text-[#a8bb87]">{k.label}</p>
            <p className="titre-or mt-1 text-2xl font-extrabold">{loading ? "…" : k.value}</p>
          </article>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[#a8bb87]">Production Supabase</p>
          <h1 className="titre-or mt-1 text-2xl font-extrabold">Ordres de réparation</h1>
          <p className="mt-1 text-sm text-[#a8bb87]">Statuts, techniciens affectés et validation client.</p>
        </div>
        <button type="button" onClick={() => setOpen(true)} className="btn-or min-h-11 px-5 text-sm">+ Nouvel ordre</button>
      </div>

      {notice && <p role="status" className="rounded-lg bg-[#90a0b0]/10 px-4 py-3 text-sm text-[#90a0b0]">{notice}</p>}
      {error && <p role="alert" className="rounded-lg bg-[#d66868]/15 px-4 py-3 text-sm text-[#d66868]">{error}</p>}

      <section className="carte overflow-hidden">
        <div className="flex flex-wrap gap-2 border-b border-[#d6b66f]/10 p-4">
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
                filtreStatut === f.cle ? "bg-[#d6b66f] font-bold text-[#102b32]" : "bg-[#21464b] text-[#d6b66f]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="p-8 text-center text-sm text-[#a8bb87]">Chargement des ordres…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-[#21464b]/50 text-xs uppercase text-[#a8bb87]">
                <tr>
                  <th className="px-4 py-3">Référence</th>
                  <th className="px-4 py-3">Client / véhicule</th>
                  <th className="px-4 py-3">Diagnostic</th>
                  <th className="px-4 py-3">Technicien</th>
                  <th className="px-4 py-3">Validation</th>
                  <th className="px-4 py-3">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#d6b66f]/10">
                {ordersFiltres.map((order) => (
                  <tr key={order.id}>
                    <td className="px-4 py-4 font-semibold text-[#e9d998]">
                      <button type="button" onClick={() => void ouvrirDetail(order)} className="text-left hover:underline">
                        {order.reference}
                      </button>
                      <span className="block text-[11px] font-normal text-[#a8bb87]">
                        {new Date(order.created_at).toLocaleDateString("fr-FR")}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-[#f8ecc9]">{order.clients?.full_name ?? "Client non lié"}</p>
                      <p className="text-xs text-[#a8bb87]">
                        {order.vehicles ? `${order.vehicles.brand} ${order.vehicles.model} · ${order.vehicles.plate}` : "Véhicule non lié"}
                      </p>
                    </td>
                    <td className="max-w-52 px-4 py-4 text-[#f8ecc9]/80">{order.diagnosis ?? "—"}</td>
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
                          order.approved_by_client ? "bg-[#90a0b0]/20 text-[#90a0b0]" : "border border-[#d6b66f]/30 text-[#a8bb87]"
                        }`}
                      >
                        {order.approved_by_client ? "✓ Validé client" : "En attente client"}
                      </button>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-col gap-1.5">
                        <span className={`w-fit rounded-full px-3 py-1 text-[11px] font-semibold ${STATUT_COULEUR[order.status] ?? "bg-[#21464b] text-[#e9d998]"}`}>
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
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!ordersFiltres.length && <p className="p-8 text-center text-sm text-[#a8bb87]">Aucun ordre dans cette vue.</p>}
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
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-4 py-2 text-sm text-[#a8bb87]">Annuler</button>
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
                <p className="text-xs uppercase tracking-[0.2em] text-[#a8bb87]">Ordre de réparation</p>
                <h2 className="titre-or mt-1 text-xl font-extrabold">{selection.reference}</h2>
                <p className="mt-1 text-sm text-[#a8bb87]">
                  {selection.clients?.full_name ?? "Client non lié"}
                  {selection.vehicles ? ` · ${selection.vehicles.brand} ${selection.vehicles.model} · ${selection.vehicles.plate}` : ""}
                </p>
              </div>
              <button type="button" onClick={() => setSelection(null)} className="text-2xl text-[#a8bb87]" aria-label="Fermer">×</button>
            </div>

            {chargementDetail ? (
              <p className="py-8 text-center text-sm text-[#a8bb87]">Chargement du détail…</p>
            ) : (
              <div className="mt-5 grid gap-6 lg:grid-cols-2">
                {/* Tâches */}
                <section>
                  <p className="text-[10px] uppercase tracking-[0.15em] text-[#a8bb87]">Tâches d’intervention ({taches.length})</p>

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
                      <li key={t.id} className="rounded-lg border border-[#d6b66f]/10 bg-[#21464b]/40 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-[#f8ecc9]">{t.label}</p>
                          <span className="text-xs font-bold text-[#e9d998]">{Number(t.price) > 0 ? formatMad(Number(t.price)) : "—"}</span>
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
                              t.quality_checked ? "bg-[#90a0b0]/20 text-[#90a0b0]" : "border border-[#d6b66f]/30 text-[#a8bb87]"
                            }`}
                          >
                            {t.quality_checked ? "✓ Contrôle qualité" : "Contrôle qualité"}
                          </button>
                          <button
                            type="button"
                            onClick={() => void supprimerTache(t)}
                            className="ml-auto rounded-lg border border-[#d66868]/40 px-2.5 py-1.5 text-[11px] text-[#d66868]"
                          >
                            Supprimer
                          </button>
                        </div>
                      </li>
                    ))}
                    {!taches.length && (
                      <li className="py-4 text-center text-sm text-[#a8bb87]">
                        Aucune tâche — décomposez l’intervention pour suivi et contrôle qualité.
                      </li>
                    )}
                  </ul>
                </section>

                {/* Historique entretien du véhicule */}
                <section>
                  <p className="text-[10px] uppercase tracking-[0.15em] text-[#a8bb87]">
                    Historique d’entretien du véhicule ({historique.length})
                  </p>
                  <ul className="mt-2 space-y-2">
                    {historique.map((h) => (
                      <li key={h.id} className="rounded-lg bg-[#21464b]/40 px-3 py-2.5 text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-[#e9d998]">{h.reference}</span>
                          <span className="text-[11px] text-[#a8bb87]">{new Date(h.created_at).toLocaleDateString("fr-FR")}</span>
                        </div>
                        <p className="mt-1 truncate text-[11px] text-[#a8bb87]">
                          {h.diagnosis ?? "Sans diagnostic"} · {formatMad(Number(h.total_amount))}
                        </p>
                      </li>
                    ))}
                    {!historique.length && (
                      <li className="py-4 text-center text-sm text-[#a8bb87]">
                        Première intervention de ce véhicule — l’historique se construit ici.
                      </li>
                    )}
                  </ul>
                  <p className="mt-3 text-[11px] leading-4 text-[#a8bb87]">
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
