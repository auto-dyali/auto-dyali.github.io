"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase-browser";
import { formatMad } from "@/lib/catalogue-test";

/**
 * Clients — fiche complète (§5 du cahier des charges).
 * - Liste réelle avec solde (balance_due) et nombre de véhicules.
 * - Fiche détaillée : véhicules, ventes (dont reste dû), interventions.
 * - Encaissement du crédit client (paiement tracé dans payments).
 */

type Client = {
  id: string;
  code: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  balance_due: number;
  vehicles: { id: string }[] | null;
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
  const [form, setForm] = useState({ fullName: "", phone: "", email: "", code: "" });
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
    const [vehReq, ventesReq, interReq] = await Promise.all([
      supabase.from("vehicles").select("id, plate, brand, model, year").eq("client_id", client.id).order("brand"),
      supabase.from("sales").select("id, reference, status, total, paid_total, created_at").eq("client_id", client.id).order("created_at", { ascending: false }).limit(30),
      supabase.from("work_orders").select("id, reference, status, created_at, diagnosis").eq("client_id", client.id).order("created_at", { ascending: false }).limit(20),
    ]);
    if (!vehReq.error) setVehicules((vehReq.data ?? []) as VehiculeClient[]);
    if (!ventesReq.error) setVentes((ventesReq.data ?? []) as VenteClient[]);
    if (!interReq.error) setInterventions((interReq.data ?? []) as InterventionClient[]);
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

    const { error: insertError } = await supabase.from("clients").insert({
      establishment_id: establishmentId,
      code: form.code.trim(),
      full_name: form.fullName.trim(),
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
    });
    if (insertError) setError(insertError.message);
    else {
      setNotice(`Client « ${form.fullName.trim()} » créé.`);
      setForm({ fullName: "", phone: "", email: "", code: "" });
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
          <p className="text-xs text-[#a8bb87]">Clients</p>
          <p className="titre-or mt-1 text-2xl font-extrabold">{loading ? "…" : clients.length}</p>
        </article>
        <article className="carte p-5">
          <p className="text-xs text-[#a8bb87]">Créances clients (solde dû)</p>
          <p className="titre-or mt-1 text-2xl font-extrabold">{loading ? "…" : formatMad(totalCreances)}</p>
        </article>
        <article className="carte p-5">
          <p className="text-xs text-[#a8bb87]">Avec véhicule suivi</p>
          <p className="titre-or mt-1 text-2xl font-extrabold">
            {loading ? "…" : clients.filter((c) => (c.vehicles?.length ?? 0) > 0).length}
          </p>
        </article>
      </div>

      {notice && <p role="status" className="rounded-lg bg-[#38a987]/10 px-4 py-3 text-sm text-[#69d3a8]">{notice}</p>}
      {error && <p role="alert" className="rounded-lg bg-[#d66868]/15 px-4 py-3 text-sm text-[#d66868]">{error}</p>}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[#a8bb87]">CRM garage</p>
          <h1 className="titre-or mt-1 text-2xl font-extrabold">Clients</h1>
          <p className="mt-1 text-sm text-[#a8bb87]">Fiches complètes : véhicules, ventes, interventions et crédit.</p>
        </div>
        <button type="button" onClick={() => { setFormOpen(true); setError(null); setNotice(null); }} className="btn-or px-5 py-2.5 text-sm">
          + Nouveau client
        </button>
      </div>

      <section className="carte overflow-hidden">
        <div className="border-b border-[#d6b66f]/10 p-4">
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
          <p className="p-8 text-center text-sm text-[#a8bb87]">Chargement des clients…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-[#21464b]/50 text-xs uppercase text-[#a8bb87]">
                <tr>
                  <th className="px-5 py-3">Client</th>
                  <th className="px-5 py-3">Contact</th>
                  <th className="px-5 py-3 text-right">Véhicules</th>
                  <th className="px-5 py-3 text-right">Solde dû</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#d6b66f]/10">
                {clientsFiltres.map((c) => {
                  const solde = Number(c.balance_due ?? 0);
                  return (
                    <tr key={c.id}>
                      <td className="px-5 py-4">
                        <p className="font-semibold text-[#f8ecc9]">{c.full_name}</p>
                        <p className="text-[11px] text-[#a8bb87]">{c.code}</p>
                      </td>
                      <td className="px-5 py-4 text-[#a8bb87]">
                        {c.phone ?? "—"}
                        {c.email && <span className="block text-[11px]">{c.email}</span>}
                      </td>
                      <td className="px-5 py-4 text-right text-[#e9d998]">{c.vehicles?.length ?? 0}</td>
                      <td className={`px-5 py-4 text-right font-bold ${solde > 0.001 ? "text-[#d6b66f]" : "text-[#38a987]"}`}>
                        {formatMad(solde)}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button type="button" onClick={() => void ouvrirFiche(c)} className="rounded-lg border border-[#d6b66f]/40 px-3 py-1.5 text-xs text-[#e9d998]">
                          Ouvrir la fiche
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!clientsFiltres.length && (
              <p className="p-8 text-center text-sm text-[#a8bb87]">Aucun client ne correspond — créez-le avec « + Nouveau client ».</p>
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
                <p className="text-xs uppercase tracking-[0.2em] text-[#a8bb87]">Fiche client</p>
                <h2 className="titre-or mt-1 text-xl font-extrabold">{selection.full_name}</h2>
                <p className="mt-1 text-sm text-[#a8bb87]">
                  {selection.code} · {selection.phone ?? "téléphone non renseigné"}
                  {selection.email ? ` · ${selection.email}` : ""}
                </p>
              </div>
              <button type="button" onClick={() => setSelection(null)} className="text-2xl text-[#a8bb87]" aria-label="Fermer">×</button>
            </div>

            {/* Solde */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#d6b66f]/20 bg-[#21464b]/40 p-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.15em] text-[#a8bb87]">Solde client</p>
                <p className={`titre-or mt-1 text-2xl font-extrabold ${Number(selection.balance_due) > 0.001 ? "text-[#d6b66f]" : "text-[#38a987]"}`}>
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
              <div className="mt-3 flex flex-wrap items-end gap-3 rounded-xl border border-[#38a987]/30 bg-[#38a987]/10 p-4">
                <label className="text-xs text-[#a8bb87]">
                  Montant reçu (MAD)
                  <input type="number" min="0.01" step="0.01" className="champ mt-1 min-h-10 w-40" value={montantRecu} onChange={(e) => setMontantRecu(e.target.value)} />
                </label>
                <button type="button" onClick={() => void encaisserSolde()} disabled={saving} className="btn-or px-4 py-2 text-sm disabled:opacity-40">
                  {saving ? "Enregistrement…" : "Valider l’encaissement"}
                </button>
                <button type="button" onClick={() => setEncaissement(false)} className="px-3 py-2 text-sm text-[#a8bb87]">Annuler</button>
                <p className="w-full text-[11px] text-[#a8bb87]">
                  Le paiement est enregistré sur la vente à crédit la plus ancienne et le solde est recalculé.
                </p>
              </div>
            )}

            {chargementFiche ? (
              <p className="py-8 text-center text-sm text-[#a8bb87]">Chargement de la fiche…</p>
            ) : (
              <div className="mt-5 grid gap-5 lg:grid-cols-3">
                {/* Véhicules */}
                <section>
                  <p className="text-[10px] uppercase tracking-[0.15em] text-[#a8bb87]">Véhicules ({vehicules.length})</p>
                  <ul className="mt-2 space-y-2">
                    {vehicules.map((v) => (
                      <li key={v.id} className="flex items-center justify-between gap-2 rounded-lg bg-[#21464b]/50 px-3 py-2 text-sm">
                        <span className="text-[#f8ecc9]">{v.brand} {v.model}</span>
                        <span className="font-mono text-xs text-[#e9d998]">{v.plate}</span>
                      </li>
                    ))}
                    {!vehicules.length && <li className="text-xs text-[#a8bb87]">Aucun véhicule.</li>}
                  </ul>
                </section>

                {/* Ventes */}
                <section>
                  <p className="text-[10px] uppercase tracking-[0.15em] text-[#a8bb87]">Ventes ({ventes.length})</p>
                  <ul className="mt-2 max-h-64 space-y-2 overflow-y-auto pr-1">
                    {ventes.map((v) => {
                      const reste = Math.max(0, Number(v.total) - Number(v.paid_total));
                      return (
                        <li key={v.id} className="rounded-lg bg-[#21464b]/50 px-3 py-2 text-sm">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-[#e9d998]">{v.reference}</span>
                            <span className="text-xs font-bold text-[#f8ecc9]">{formatMad(Number(v.total))}</span>
                          </div>
                          <p className="mt-1 text-[11px] text-[#a8bb87]">
                            {new Date(v.created_at).toLocaleDateString("fr-FR")}
                            {reste > 0.001 ? ` · reste ${formatMad(reste)}` : " · soldée"}
                          </p>
                        </li>
                      );
                    })}
                    {!ventes.length && <li className="text-xs text-[#a8bb87]">Aucune vente.</li>}
                  </ul>
                </section>

                {/* Interventions */}
                <section>
                  <p className="text-[10px] uppercase tracking-[0.15em] text-[#a8bb87]">Interventions ({interventions.length})</p>
                  <ul className="mt-2 max-h-64 space-y-2 overflow-y-auto pr-1">
                    {interventions.map((i) => (
                      <li key={i.id} className="rounded-lg bg-[#21464b]/50 px-3 py-2 text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-[#e9d998]">{i.reference}</span>
                          <span className="rounded-full bg-[#21464b] px-2 py-0.5 text-[10px] text-[#f8ecc9]">
                            {STATUTS_INTERVENTION[i.status] ?? i.status}
                          </span>
                        </div>
                        <p className="mt-1 truncate text-[11px] text-[#a8bb87]">
                          {i.diagnosis ?? new Date(i.created_at).toLocaleDateString("fr-FR")}
                        </p>
                      </li>
                    ))}
                    {!interventions.length && <li className="text-xs text-[#a8bb87]">Aucune intervention.</li>}
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
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setFormOpen(false)} className="rounded-lg px-4 py-2 text-sm text-[#a8bb87]">Annuler</button>
              <button disabled={saving} type="submit" className="btn-or px-4 py-2 text-sm">{saving ? "Enregistrement…" : "Enregistrer"}</button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
