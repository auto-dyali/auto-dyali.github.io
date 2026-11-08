"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { ReactNode } from "react";
import { supabase } from "@/lib/supabase-browser";

type Row = Record<string, unknown>;
const money = (value: unknown) => `${Number(value ?? 0).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} MAD`;
const date = (value: unknown) => value ? new Date(String(value)).toLocaleDateString("fr-FR") : "—";

function useRows(table: string, select: string, order = "created_at") {
  const [rows, setRows] = useState<Row[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null);
  useEffect(() => { const timer = window.setTimeout(async () => { if (!supabase) { setError("Supabase n’est pas configuré."); setLoading(false); return; } const { data, error: queryError } = await supabase.from(table).select(select).order(order, { ascending: false }); if (queryError) setError(queryError.message); else setRows((data ?? []) as unknown as Row[]); setLoading(false); }, 0); return () => window.clearTimeout(timer); }, [table, select, order]);
  return { rows, setRows, loading, error };
}

function Header({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) { return <div className="mb-6"><p className="text-xs uppercase tracking-[0.2em] text-[#A7B7A8]">{eyebrow}</p><h1 className="titre-or mt-1 text-2xl font-extrabold">{title}</h1><p className="mt-1 text-sm text-[#A7B7A8]">{description}</p></div>; }
function ErrorBox({ error }: { error: string | null }) { return error ? <p role="alert" className="mb-4 rounded-lg bg-[#C5716B]/15 px-4 py-3 text-sm text-[#C5716B]">{error}</p> : null; }
function Loading({ loading }: { loading: boolean }) { return loading ? <p className="p-8 text-center text-sm text-[#A7B7A8]">Chargement des données…</p> : null; }


function Modal({ title, close, children }: { title: string; close: () => void; children: ReactNode }) { return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-5"><div className="carte w-full max-w-md p-6"><div className="flex justify-between"><h2 className="titre-or text-xl font-extrabold">{title}</h2><button onClick={close} className="text-2xl text-[#A7B7A8]" aria-label="Fermer">×</button></div><div className="mt-5">{children}</div></div></div>; }
function Submit({ saving }: { saving: boolean }) { return <div className="mt-3 flex justify-end"><button disabled={saving} className="btn-or px-4 py-2 text-sm">{saving ? "Enregistrement…" : "Enregistrer"}</button></div>; }

type SessionCaisse = { id: string; opening_amount: number; closing_amount: number | null; expected_amount: number | null; opened_at: string; closed_at: string | null };
type Depense = { id: string; category: string; label: string; amount: number; spent_at: string };
type Encaissement = { id: string; method: string; amount: number; paid_at: string };

const heure = (value: unknown) => (value ? new Date(String(value)).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "—");

const CATEGORIES_DEPENSE: Record<string, string> = {
  fournisseurs: "Fournisseurs",
  salaires: "Salaires",
  loyer: "Loyer",
  "impôts": "Impôts",
  autre: "Autre",
};

export function CaisseModule() {
  const [sessions, setSessions] = useState<SessionCaisse[]>([]);
  const [depenses, setDepenses] = useState<Depense[]>([]);
  const [encaissements, setEncaissements] = useState<Encaissement[]>([]);
  const [jour, setJour] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [opening, setOpening] = useState("");
  const [expense, setExpense] = useState({ label: "", category: "autre", amount: "" });
  const [saving, setSaving] = useState(false);
  const [clotureOuverte, setClotureOuverte] = useState(false);
  const [montantCompte, setMontantCompte] = useState("");

  async function charger() {
    if (!supabase) { setErreur("Supabase n’est pas configuré."); setLoading(false); return; }
    const debutJour = new Date();
    debutJour.setHours(0, 0, 0, 0);
    const cle = `${debutJour.getFullYear()}-${String(debutJour.getMonth() + 1).padStart(2, "0")}-${String(debutJour.getDate()).padStart(2, "0")}`;
    setJour(cle);
    const [resSessions, resDepenses, resEncaissements] = await Promise.all([
      supabase.from("cash_sessions").select("id, opening_amount, closing_amount, expected_amount, opened_at, closed_at").order("opened_at", { ascending: false }).limit(12),
      supabase.from("expenses").select("id, category, label, amount, spent_at").order("spent_at", { ascending: false }).limit(80),
      supabase.from("payments").select("id, method, amount, paid_at").gte("paid_at", debutJour.toISOString()),
    ]);
    const erreurDb = resSessions.error ?? resDepenses.error ?? resEncaissements.error;
    if (erreurDb) setErreur(erreurDb.message);
    else {
      setSessions((resSessions.data ?? []) as SessionCaisse[]);
      setDepenses((resDepenses.data ?? []) as Depense[]);
      setEncaissements((resEncaissements.data ?? []) as Encaissement[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void charger(), 0);
    return () => window.clearTimeout(timer);
    // Rechargement initial unique ; charger() est rappelé après chaque opération.
  }, []);

  const active = sessions.find((s) => !s.closed_at) ?? null;
  const encaisseJour = encaissements.reduce((total, p) => total + Number(p.amount), 0);
  const depensesDuJour = depenses.filter((d) => d.spent_at >= jour);
  const depenseJour = depensesDuJour.reduce((total, d) => total + Number(d.amount), 0);
  const soldeTheorique = Number(active?.opening_amount ?? 0) + encaisseJour - depenseJour;

  async function ouvrirCaisse() {
    if (!supabase || saving) return;
    setSaving(true); setErreur(null); setMessage(null);
    try {
      const { data: profile } = await supabase.rpc("get_my_profile");
      const establishmentId = profile?.[0]?.establishment_id;
      if (!establishmentId) throw new Error("Établissement introuvable.");
      const { data, error } = await supabase
        .from("cash_sessions")
        .insert({ establishment_id: establishmentId, opening_amount: Number(opening || 0) })
        .select("id, opening_amount, closing_amount, expected_amount, opened_at, closed_at")
        .single();
      if (error) throw new Error(error.message);
      setSessions((r) => [data as SessionCaisse, ...r]);
      setOpening("");
      setMessage(`Caisse ouverte — fond ${money(data.opening_amount)}.`);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Ouverture impossible.");
    } finally {
      setSaving(false);
    }
  }

  async function enregistrerDepense(event: FormEvent) {
    event.preventDefault();
    if (!supabase || saving) return;
    setSaving(true); setErreur(null); setMessage(null);
    try {
      const { data: profile } = await supabase.rpc("get_my_profile");
      const establishmentId = profile?.[0]?.establishment_id;
      if (!establishmentId) throw new Error("Établissement introuvable.");
      const { data, error } = await supabase
        .from("expenses")
        .insert({ establishment_id: establishmentId, category: expense.category, label: expense.label.trim(), amount: Number(expense.amount), spent_at: jour || undefined })
        .select("id, category, label, amount, spent_at")
        .single();
      if (error) throw new Error(error.message);
      setDepenses((r) => [data as Depense, ...r]);
      setExpense({ label: "", category: "autre", amount: "" });
      setMessage("Dépense enregistrée.");
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  }

  async function cloreCaisse() {
    if (!supabase || !active || saving) return;
    setSaving(true); setErreur(null); setMessage(null);
    try {
      // Théorique recalculé juste avant la clôture : fond + encaissements réels − dépenses du jour.
      const debutSession = new Date(active.opened_at);
      debutSession.setHours(0, 0, 0, 0);
      const cleSession = `${debutSession.getFullYear()}-${String(debutSession.getMonth() + 1).padStart(2, "0")}-${String(debutSession.getDate()).padStart(2, "0")}`;
      const [resEncaisse, resDepenses] = await Promise.all([
        supabase.from("payments").select("amount").gte("paid_at", active.opened_at),
        supabase.from("expenses").select("amount").gte("spent_at", cleSession),
      ]);
      if (resEncaisse.error) throw new Error(resEncaisse.error.message);
      if (resDepenses.error) throw new Error(resDepenses.error.message);
      const encaisse = ((resEncaisse.data ?? []) as { amount: number }[]).reduce((total, p) => total + Number(p.amount), 0);
      const depense = ((resDepenses.data ?? []) as { amount: number }[]).reduce((total, d) => total + Number(d.amount), 0);
      const theorique = Number(active.opening_amount) + encaisse - depense;
      const compte = montantCompte === "" ? theorique : Number(montantCompte);
      const { data, error } = await supabase
        .from("cash_sessions")
        .update({ expected_amount: theorique, closing_amount: compte, closed_at: new Date().toISOString() })
        .eq("id", active.id)
        .select("id, opening_amount, closing_amount, expected_amount, opened_at, closed_at")
        .single();
      if (error) throw new Error(error.message);
      const ecart = Number(compte) - theorique;
      setSessions((r) => r.map((s) => (s.id === active.id ? (data as SessionCaisse) : s)));
      setClotureOuverte(false);
      setMontantCompte("");
      setMessage(
        ecart === 0
          ? `Caisse clôturée — théorique ${money(theorique)}, compté ${money(compte)} : aucun écart.`
          : `Caisse clôturée — théorique ${money(theorique)}, compté ${money(compte)} : écart de ${ecart > 0 ? "+" : "−"}${money(Math.abs(ecart))} (${ecart > 0 ? "excédent" : "manquant"}).`,
      );
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Clôture impossible.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Header eyebrow="Finance Supabase" title="Caisse" description="Fond, encaissements réels et dépenses du jour." />
      <ErrorBox error={erreur} />
      {message && <p role="status" className="mb-4 rounded-lg bg-[#5D9E7F]/10 px-4 py-3 text-sm text-[#7FBF9E]">{message}</p>}
      <Loading loading={loading} />
      {!loading && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <article className="carte p-5">
              <p className="text-xs text-[#A7B7A8]">Fond de caisse</p>
              <p className="titre-or mt-2 text-2xl font-extrabold">{active ? money(active.opening_amount) : "—"}</p>
              {active && <p className="mt-1 text-xs text-[#A7B7A8]">Ouverte à {heure(active.opened_at)}</p>}
            </article>
            <article className="carte p-5">
              <p className="text-xs text-[#A7B7A8]">Encaissé aujourd’hui</p>
              <p className="titre-or mt-2 text-2xl font-extrabold">{money(encaisseJour)}</p>
              <p className="mt-1 text-xs text-[#A7B7A8]">{encaissements.length} paiement{encaissements.length > 1 ? "s" : ""} réel{encaissements.length > 1 ? "s" : ""}</p>
            </article>
            <article className="carte p-5">
              <p className="text-xs text-[#A7B7A8]">Dépenses du jour</p>
              <p className="titre-or mt-2 text-2xl font-extrabold">{money(depenseJour)}</p>
              <p className="mt-1 text-xs text-[#A7B7A8]">{depensesDuJour.length} ligne{depensesDuJour.length > 1 ? "s" : ""}</p>
            </article>
            <article className="carte p-5">
              <p className="text-xs text-[#A7B7A8]">Solde théorique</p>
              <p className="titre-or mt-2 text-2xl font-extrabold">{active ? money(soldeTheorique) : "—"}</p>
              <p className="mt-1 text-xs text-[#A7B7A8]">{active ? "Fond + encaissé − dépenses" : "Aucune session ouverte"}</p>
            </article>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <section className="carte p-5">
              <h2 className="font-bold">Session de caisse</h2>
              {active ? (
                <>
                  <p className="mt-4 text-sm text-[#A7B7A8]">Ouverte depuis {heure(active.opened_at)} — solde théorique {money(soldeTheorique)}.</p>
                  <button
                    type="button"
                    onClick={() => { setMontantCompte(String(Math.max(soldeTheorique, 0))); setClotureOuverte(true); }}
                    className="btn-or mt-5 px-4 py-2 text-sm"
                  >
                    Clôturer la caisse
                  </button>
                </>
              ) : (
                <>
                  <input type="number" min="0" step="0.01" className="champ mt-4" placeholder="Fond de caisse initial (MAD)" value={opening} onChange={(e) => setOpening(e.target.value)} />
                  <button type="button" onClick={() => void ouvrirCaisse()} disabled={saving} className="btn-or mt-4 px-4 py-2 text-sm">Ouvrir la caisse</button>
                </>
              )}
            </section>

            <section className="carte p-5">
              <h2 className="font-bold">Nouvelle dépense</h2>
              <form onSubmit={enregistrerDepense} className="mt-4 grid gap-3">
                <input required className="champ" placeholder="Libellé" value={expense.label} onChange={(e) => setExpense({ ...expense, label: e.target.value })} />
                <select className="champ" value={expense.category} onChange={(e) => setExpense({ ...expense, category: e.target.value })}>
                  {Object.entries(CATEGORIES_DEPENSE).map(([cle, label]) => <option key={cle} value={cle}>{label}</option>)}
                </select>
                <input required type="number" min="0" step="0.01" className="champ" placeholder="Montant MAD" value={expense.amount} onChange={(e) => setExpense({ ...expense, amount: e.target.value })} />
                <Submit saving={saving} />
              </form>
            </section>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <section className="carte overflow-hidden">
              <h2 className="border-b border-[#8FB59B]/10 p-5 font-bold">
                Dépenses du jour <span className="ml-2 text-xs font-normal text-[#A7B7A8]">− {money(depenseJour)}</span>
              </h2>
              <ul className="divide-y divide-[#8FB59B]/10">
                {depensesDuJour.map((d) => (
                  <li key={d.id} className="flex items-center justify-between px-5 py-3 text-sm">
                    <span>
                      {d.label}
                      <span className="ml-2 text-xs text-[#A7B7A8]">{CATEGORIES_DEPENSE[d.category] ?? d.category}</span>
                    </span>
                    <span className="font-semibold text-[#DFE7E2]">− {money(d.amount)}</span>
                  </li>
                ))}
                {!depensesDuJour.length && <li className="px-5 py-6 text-center text-sm text-[#A7B7A8]">Aucune dépense aujourd’hui.</li>}
              </ul>
            </section>

            <section className="carte overflow-hidden">
              <h2 className="border-b border-[#8FB59B]/10 p-5 font-bold">Historique des sessions</h2>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-sm">
                  <thead className="bg-[#344440]/50 text-xs uppercase text-[#A7B7A8]">
                    <tr><th className="px-4 py-3">Ouverture</th><th className="px-4 py-3">Fond</th><th className="px-4 py-3">Théorique</th><th className="px-4 py-3">Clôturé</th><th className="px-4 py-3">Écart</th></tr>
                  </thead>
                  <tbody className="divide-y divide-[#8FB59B]/10">
                    {sessions.map((s) => {
                      const ecart = s.closing_amount != null && s.expected_amount != null ? Number(s.closing_amount) - Number(s.expected_amount) : null;
                      return (
                        <tr key={s.id}>
                          <td className="px-4 py-3">{date(s.opened_at)}<p className="text-xs text-[#A7B7A8]">{heure(s.opened_at)}</p></td>
                          <td className="px-4 py-3">{money(s.opening_amount)}</td>
                          <td className="px-4 py-3 text-[#A7B7A8]">{s.expected_amount != null ? money(s.expected_amount) : "—"}</td>
                          <td className="px-4 py-3 text-[#DFE7E2]">{s.closing_amount != null ? money(s.closing_amount) : "En cours"}</td>
                          <td className={`px-4 py-3 font-semibold ${ecart == null ? "text-[#A7B7A8]" : ecart === 0 ? "text-[#5D9E7F]" : "text-[#C79A6B]"}`}>
                            {ecart == null ? "—" : `${ecart > 0 ? "+" : "−"}${money(Math.abs(ecart))}`}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {!sessions.length && <p className="p-6 text-center text-sm text-[#A7B7A8]">Aucune session enregistrée.</p>}
              </div>
            </section>
          </div>
        </>
      )}

      {clotureOuverte && active && (
        <Modal title="Clôturer la caisse" close={() => setClotureOuverte(false)}>
          <p className="text-sm text-[#A7B7A8]">
            Solde théorique calculé à l’instant : <span className="font-bold text-[#DFE7E2]">{money(soldeTheorique)}</span> (fond + encaissements − dépenses du jour).
          </p>
          <label className="mt-4 grid gap-2 text-sm text-[#A7B7A8]">
            Montant compté en caisse (MAD)
            <input type="number" min="0" step="0.01" className="champ" value={montantCompte} onChange={(e) => setMontantCompte(e.target.value)} />
          </label>
          <div className="mt-4 flex justify-end gap-3">
            <button type="button" onClick={() => setClotureOuverte(false)} className="rounded-lg border border-[#8FB59B]/30 px-4 py-2 text-sm text-[#A7B7A8]">Annuler</button>
            <button type="button" disabled={saving} onClick={() => void cloreCaisse()} className="btn-or px-4 py-2 text-sm">{saving ? "Enregistrement…" : "Valider la clôture"}</button>
          </div>
        </Modal>
      )}
    </>
  );
}

type Rdv = {
  id: string;
  slot_start: string;
  slot_end: string;
  status: string;
  channel: string;
  notes: string | null;
  clients: { full_name: string } | null;
  vehicles: { plate: string; brand: string; model: string } | null;
  employees: { full_name: string } | null;
};

const STATUT_RDV: Record<string, { label: string; classe: string }> = {
  confirmed: { label: "Confirmé", classe: "bg-[#8DA298]/15 text-[#8DA298]" },
  done: { label: "Terminé", classe: "bg-[#A7B7A8]/20 text-[#A7B7A8]" },
  no_show: { label: "Absent", classe: "bg-[#C79A6B]/15 text-[#C79A6B]" },
  cancelled: { label: "Annulé", classe: "bg-[#C5716B]/15 text-[#C5716B]" },
};

const CANAUX_RDV: Record<string, string> = {
  counter: "Comptoir",
  phone: "Téléphone",
  online: "En ligne",
  walkin: "Sans rendez-vous",
};

export function PlanningModule() {
  const [rdvs, setRdvs] = useState<Rdv[]>([]);
  const [clients, setClients] = useState<Row[]>([]);
  const [vehicles, setVehicles] = useState<Row[]>([]);
  const [employees, setEmployees] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [filtreStatut, setFiltreStatut] = useState("tous");
  const [filtrePeriode, setFiltrePeriode] = useState<"jour" | "semaine" | "tous">("jour");
  const [bornes, setBornes] = useState({ jour: "", finJour: "", finSemaine: "" });
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ clientId: "", vehicleId: "", start: "", employeeId: "", canal: "phone", notes: "" });

  async function charger() {
    if (!supabase) { setErreur("Supabase n’est pas configuré."); setLoading(false); return; }
    const debutJour = new Date();
    debutJour.setHours(0, 0, 0, 0);
    const finJour = new Date(debutJour); finJour.setDate(finJour.getDate() + 1);
    const finSemaine = new Date(debutJour); finSemaine.setDate(finSemaine.getDate() + 7);
    setBornes({ jour: debutJour.toISOString(), finJour: finJour.toISOString(), finSemaine: finSemaine.toISOString() });
    const [resRdv, resClients, resVehicles, resEmployees] = await Promise.all([
      supabase.from("appointments").select("id, slot_start, slot_end, status, channel, notes, clients(full_name), vehicles(plate, brand, model), employees(full_name)").order("slot_start", { ascending: false }).limit(150),
      supabase.from("clients").select("id, full_name").order("full_name"),
      supabase.from("vehicles").select("id, plate, brand, model, client_id").order("plate"),
      supabase.from("employees").select("id, full_name").eq("active_permanent", true).order("full_name"),
    ]);
    const erreurDb = resRdv.error ?? resClients.error ?? resVehicles.error ?? resEmployees.error;
    if (erreurDb) setErreur(erreurDb.message);
    else {
      setRdvs((resRdv.data ?? []) as unknown as Rdv[]);
      setClients((resClients.data ?? []) as Row[]);
      setVehicles((resVehicles.data ?? []) as Row[]);
      setEmployees((resEmployees.data ?? []) as Row[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void charger(), 0);
    return () => window.clearTimeout(timer);
    // Rechargement initial unique ; charger() est rappelé après chaque opération.
  }, []);

  const visibles = rdvs
    .filter((r) => (filtreStatut === "tous" ? true : r.status === filtreStatut))
    .filter((r) => {
      const t = new Date(r.slot_start).getTime();
      if (filtrePeriode === "jour") return t >= new Date(bornes.jour).getTime() && t < new Date(bornes.finJour).getTime();
      if (filtrePeriode === "semaine") return t >= new Date(bornes.jour).getTime() && t < new Date(bornes.finSemaine).getTime();
      return true;
    })
    .sort((a, b) => new Date(a.slot_start).getTime() - new Date(b.slot_start).getTime());

  async function changerStatut(rdv: Rdv, statut: string) {
    if (!supabase || saving) return;
    setSaving(true); setErreur(null); setMessage(null);
    const { error } = await supabase.from("appointments").update({ status: statut }).eq("id", rdv.id);
    if (error) setErreur(error.message);
    else {
      setRdvs((r) => r.map((x) => (x.id === rdv.id ? { ...x, status: statut } : x)));
      setMessage(`Rendez-vous marqué « ${STATUT_RDV[statut]?.label ?? statut} ».`);
    }
    setSaving(false);
  }

  async function ajouterRdv(event: FormEvent) {
    event.preventDefault();
    if (!supabase || saving || !form.start) return;
    setSaving(true); setErreur(null); setMessage(null);
    try {
      const { data: profile } = await supabase.rpc("get_my_profile");
      const establishmentId = profile?.[0]?.establishment_id;
      if (!establishmentId) throw new Error("Établissement introuvable.");
      const debut = new Date(form.start);
      const { data, error } = await supabase
        .from("appointments")
        .insert({
          establishment_id: establishmentId,
          client_id: form.clientId || null,
          vehicle_id: form.vehicleId || null,
          slot_start: debut.toISOString(),
          slot_end: new Date(debut.getTime() + 60 * 60 * 1000).toISOString(),
          mechanic_id: form.employeeId || null,
          channel: form.canal,
          notes: form.notes.trim() || null,
          status: "confirmed",
        })
        .select("id, slot_start, slot_end, status, channel, notes, clients(full_name), vehicles(plate, brand, model), employees(full_name)")
        .single();
      if (error) throw new Error(error.message);
      setRdvs((current) => [data as unknown as Rdv, ...current]);
      setOpen(false);
      setForm({ clientId: "", vehicleId: "", start: "", employeeId: "", canal: "phone", notes: "" });
      setMessage("Rendez-vous créé.");
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Création impossible.");
    } finally {
      setSaving(false);
    }
  }

  const vehiculesFiltres = vehicles.filter((v) => !form.clientId || v.client_id === form.clientId);

  return (
    <>
      <Header eyebrow="Organisation Supabase" title="Planning" description="Rendez-vous du jour, statuts réels et affectations." />
      <ErrorBox error={erreur} />
      {message && <p role="status" className="mb-4 rounded-lg bg-[#5D9E7F]/10 px-4 py-3 text-sm text-[#7FBF9E]">{message}</p>}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {([["jour", "Aujourd’hui"], ["semaine", "Cette semaine"], ["tous", "Tous"]] as const).map(([cle, label]) => (
            <button
              key={cle}
              type="button"
              onClick={() => setFiltrePeriode(cle)}
              className={`rounded-lg border px-3 py-1.5 text-xs ${filtrePeriode === cle ? "border-[#8FB59B]/50 bg-[#8FB59B]/15 text-[#DFE7E2]" : "border-[#8FB59B]/20 text-[#A7B7A8]"}`}
            >
              {label}
            </button>
          ))}
          <select className="champ w-auto" value={filtreStatut} onChange={(e) => setFiltreStatut(e.target.value)}>
            <option value="tous">Tous les statuts</option>
            {Object.entries(STATUT_RDV).map(([cle, s]) => <option key={cle} value={cle}>{s.label}</option>)}
          </select>
        </div>
        <button type="button" className="btn-or px-4 py-2 text-sm" onClick={() => setOpen(true)}>+ Nouveau rendez-vous</button>
      </div>

      <section className="carte overflow-hidden">
        <p className="border-b border-[#8FB59B]/10 p-5 text-xs text-[#A7B7A8]">{visibles.length} rendez-vous affichés</p>
        <Loading loading={loading} />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="bg-[#344440]/50 text-xs uppercase text-[#A7B7A8]">
              <tr><th className="px-4 py-3">Horaire</th><th className="px-4 py-3">Client</th><th className="px-4 py-3">Véhicule</th><th className="px-4 py-3">Technicien</th><th className="px-4 py-3">Canal</th><th className="px-4 py-3">Statut</th><th className="px-4 py-3">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-[#8FB59B]/10">
              {visibles.map((rdv) => {
                const statut = STATUT_RDV[rdv.status] ?? { label: rdv.status, classe: "bg-[#8FB59B]/15 text-[#DFE7E2]" };
                return (
                  <tr key={rdv.id}>
                    <td className="px-4 py-4">
                      <p className="font-semibold text-[#DFE7E2]">{date(rdv.slot_start)}</p>
                      <p className="text-xs text-[#A7B7A8]">{heure(rdv.slot_start)} → {heure(rdv.slot_end)}</p>
                    </td>
                    <td className="px-4 py-4">
                      {rdv.clients?.full_name ?? "Client au comptoir"}
                      {rdv.notes && <p className="mt-1 max-w-[200px] text-xs text-[#A7B7A8]">{rdv.notes}</p>}
                    </td>
                    <td className="px-4 py-4 text-[#A7B7A8]">{rdv.vehicles ? `${rdv.vehicles.brand} ${rdv.vehicles.model} · ${rdv.vehicles.plate}` : "—"}</td>
                    <td className="px-4 py-4 text-[#A7B7A8]">{rdv.employees?.full_name ?? "Non affecté"}</td>
                    <td className="px-4 py-4 text-xs text-[#A7B7A8]">{CANAUX_RDV[rdv.channel] ?? rdv.channel}</td>
                    <td className="px-4 py-4">
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statut.classe}`}>{statut.label}</span>
                    </td>
                    <td className="px-4 py-4">
                      {rdv.status === "confirmed" ? (
                        <div className="flex flex-wrap gap-2">
                          <button type="button" disabled={saving} onClick={() => void changerStatut(rdv, "done")} className="rounded-lg border border-[#8FB59B]/30 px-2.5 py-1.5 text-xs text-[#DFE7E2] hover:bg-[#8FB59B]/10">Terminé</button>
                          <button type="button" disabled={saving} onClick={() => void changerStatut(rdv, "no_show")} className="rounded-lg border border-[#C79A6B]/30 px-2.5 py-1.5 text-xs text-[#C79A6B] hover:bg-[#C79A6B]/10">Absent</button>
                          <button type="button" disabled={saving} onClick={() => void changerStatut(rdv, "cancelled")} className="rounded-lg border border-[#C5716B]/30 px-2.5 py-1.5 text-xs text-[#C5716B] hover:bg-[#C5716B]/10">Annuler</button>
                        </div>
                      ) : (
                        <span className="text-xs text-[#A7B7A8]">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!loading && !visibles.length && <p className="p-8 text-center text-sm text-[#A7B7A8]">Aucun rendez-vous pour ce filtre.</p>}
        </div>
      </section>

      {open && (
        <Modal title="Nouveau rendez-vous" close={() => setOpen(false)}>
          <form onSubmit={ajouterRdv} className="grid gap-3">
            <select className="champ" value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value, vehicleId: "" })}>
              <option value="">Client au comptoir</option>
              {clients.map((c) => <option key={String(c.id)} value={String(c.id)}>{String(c.full_name)}</option>)}
            </select>
            <select className="champ" value={form.vehicleId} onChange={(e) => setForm({ ...form, vehicleId: e.target.value })}>
              <option value="">Aucun véhicule</option>
              {vehiculesFiltres.map((v) => <option key={String(v.id)} value={String(v.id)}>{String(v.brand)} {String(v.model)} · {String(v.plate)}</option>)}
            </select>
            <input required type="datetime-local" className="champ" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} />
            <select className="champ" value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })}>
              <option value="">Technicien — non affecté</option>
              {employees.map((emp) => <option key={String(emp.id)} value={String(emp.id)}>{String(emp.full_name)}</option>)}
            </select>
            <select className="champ" value={form.canal} onChange={(e) => setForm({ ...form, canal: e.target.value })}>
              {Object.entries(CANAUX_RDV).map(([cle, label]) => <option key={cle} value={cle}>{label}</option>)}
            </select>
            <input className="champ" placeholder="Notes (panne décrite, pièces…)" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            <Submit saving={saving} />
          </form>
        </Modal>
      )}
    </>
  );
}

export function AchatsModule() {
  const { rows, setRows, loading, error } = useRows("purchase_orders", "id, reference, status, ordered_at, expected_at, total_amount, paid_amount, suppliers(name)");
  const { rows: suppliers } = useRows("suppliers", "id, name", "name");
  const [open, setOpen] = useState(false); const [saving, setSaving] = useState(false); const [form, setForm] = useState({ supplierId: "", total: "", expected: "" });
  async function add(event: FormEvent) { event.preventDefault(); if (!supabase) return; setSaving(true); const { data: profile } = await supabase.rpc("get_my_profile"); const reference = `ACH-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`; const { data, error: insertError } = await supabase.from("purchase_orders").insert({ establishment_id: profile?.[0]?.establishment_id, supplier_id: form.supplierId, reference, expected_at: form.expected || null, total_amount: Number(form.total), status: "draft" }).select("id, reference, status, ordered_at, expected_at, total_amount, paid_amount, suppliers(name)").single(); if (insertError) { setSaving(false); return; } setRows((current) => [data as Row, ...current]); setOpen(false); setForm({ supplierId: "", total: "", expected: "" }); setSaving(false); }
  return <><Header eyebrow="Approvisionnement Supabase" title="Achats" description="Commandes fournisseurs et suivi des réceptions." /><ErrorBox error={error} /><div className="mb-5 flex justify-end"><button className="btn-or px-4 py-2 text-sm" onClick={() => setOpen(true)}>+ Nouvelle commande</button></div><section className="carte overflow-hidden"><Loading loading={loading} /><div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead className="bg-[#344440]/50 text-xs uppercase text-[#A7B7A8]"><tr><th className="px-4 py-3">Référence</th><th className="px-4 py-3">Fournisseur</th><th className="px-4 py-3">Commande</th><th className="px-4 py-3">Total</th><th className="px-4 py-3">Statut</th></tr></thead><tbody className="divide-y divide-[#8FB59B]/10">{rows.map((row) => <tr key={String(row.id)}><td className="px-4 py-4 font-semibold text-[#DFE7E2]">{String(row.reference)}</td><td className="px-4 py-4">{String((row.suppliers as Row | null)?.name ?? "—")}</td><td className="px-4 py-4 text-[#A7B7A8]">{date(row.ordered_at)}</td><td className="px-4 py-4 text-[#DFE7E2]">{money(row.total_amount)}</td><td className="px-4 py-4 text-[#A7B7A8]">{String(row.status)}</td></tr>)}</tbody></table>{!loading && !rows.length && <p className="p-8 text-center text-sm text-[#A7B7A8]">Aucune commande fournisseur.</p>}</div></section>{open && <Modal title="Nouvelle commande" close={() => setOpen(false)}><form onSubmit={add} className="grid gap-3"><select required className="champ" value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })}><option value="">Sélectionner le fournisseur</option>{suppliers.map((supplier) => <option key={String(supplier.id)} value={String(supplier.id)}>{String(supplier.name)}</option>)}</select><input required type="number" min="0" step="0.01" className="champ" placeholder="Montant estimé MAD" value={form.total} onChange={(e) => setForm({ ...form, total: e.target.value })} /><input type="date" className="champ" value={form.expected} onChange={(e) => setForm({ ...form, expected: e.target.value })} /><Submit saving={saving} /></form></Modal>}</>;
}

export function FacturationModule() {
  const { rows, loading, error } = useRows("invoices", "id, number, issued_at, total, sales(reference, status, paid_total)", "issued_at");

  // Génère un PDF réel via la boîte d'impression du navigateur (Enregistrer en PDF).
  function imprimerFacture(row: Row) {
    const sale = row.sales as Row | null;
    const fenetre = window.open("", "_blank", "width=620,height=820");
    if (!fenetre) return;
    fenetre.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Facture ${String(row.number)}</title>
<style>body{font-family:Arial,sans-serif;font-size:13px;color:#111;margin:24px auto;max-width:600px}
h1{font-size:20px;margin:0}table{width:100%;border-collapse:collapse;margin-top:16px}td{padding:6px 0;border-bottom:1px solid #ddd}
.total{font-weight:bold;font-size:16px;margin-top:12px}.muted{color:#555;font-size:12px}</style></head><body>
<h1>AUTO DYALI</h1><p class="muted">Garage AUTO DYALI — Agadir</p>
<h2 style="font-size:16px">Facture ${String(row.number)}</h2>
<table><tbody>
<tr><td>Date d’émission</td><td style="text-align:right">${date(row.issued_at)}</td></tr>
<tr><td>Vente liée</td><td style="text-align:right">${String(sale?.reference ?? "—")}</td></tr>
<tr><td>Statut vente</td><td style="text-align:right">${String(sale?.status ?? "—")}</td></tr>
<tr><td>Encaissé</td><td style="text-align:right">${money(sale?.paid_total)}</td></tr>
</tbody></table>
<div class="total">Total : ${money(row.total)}</div>
<p class="muted">Document généré le ${new Date().toLocaleString("fr-FR")} — AUTO DYALI</p>
</body></html>`);
    fenetre.document.close();
    fenetre.focus();
    fenetre.print();
  }

  return <><Header eyebrow="Documents Supabase" title="Facturation" description="Factures générées à partir des ventes — PDF via impression navigateur." /><ErrorBox error={error} /><section className="carte overflow-hidden"><Loading loading={loading} /><div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead className="bg-[#344440]/50 text-xs uppercase text-[#A7B7A8]"><tr><th className="px-4 py-3">Facture</th><th className="px-4 py-3">Vente</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Total</th><th className="px-4 py-3">Paiement</th><th className="px-4 py-3">Document</th></tr></thead><tbody className="divide-y divide-[#8FB59B]/10">{rows.map((row) => { const sale = row.sales as Row | null; return <tr key={String(row.id)}><td className="px-4 py-4 font-semibold text-[#DFE7E2]">{String(row.number)}</td><td className="px-4 py-4">{String(sale?.reference ?? "—")}</td><td className="px-4 py-4 text-[#A7B7A8]">{date(row.issued_at)}</td><td className="px-4 py-4 text-[#DFE7E2]">{money(row.total)}</td><td className="px-4 py-4 text-[#A7B7A8]">{money(sale?.paid_total)}</td><td className="px-4 py-4"><button type="button" onClick={() => imprimerFacture(row)} className="rounded-lg border border-[#8FB59B]/40 px-2.5 py-1.5 text-xs text-[#DFE7E2]">PDF / Imprimer</button></td></tr>; })}</tbody></table>{!loading && !rows.length && <p className="p-8 text-center text-sm text-[#A7B7A8]">Aucune facture générée.</p>}</div></section></>;
}

export function RapportsModule() { const { rows, loading, error } = useRows("sales", "id, reference, status, total, paid_total, created_at", "created_at"); const total = rows.reduce((sum, row) => sum + Number(row.total ?? 0), 0); const paid = rows.reduce((sum, row) => sum + Number(row.paid_total ?? 0), 0); return <><Header eyebrow="Pilotage Supabase" title="Rapports" description="Indicateurs calculés à partir des ventes enregistrées." /><ErrorBox error={error} /><div className="grid gap-4 sm:grid-cols-3"><article className="carte p-5"><p className="text-xs text-[#A7B7A8]">Chiffre d’affaires</p><p className="titre-or mt-2 text-2xl font-extrabold">{money(total)}</p></article><article className="carte p-5"><p className="text-xs text-[#A7B7A8]">Encaissé</p><p className="titre-or mt-2 text-2xl font-extrabold">{money(paid)}</p></article><article className="carte p-5"><p className="text-xs text-[#A7B7A8]">Ventes</p><p className="titre-or mt-2 text-2xl font-extrabold">{rows.length}</p></article></div><section className="carte mt-5 overflow-hidden"><Loading loading={loading} /><div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="bg-[#344440]/50 text-xs uppercase text-[#A7B7A8]"><tr><th className="px-4 py-3">Référence</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Statut</th><th className="px-4 py-3">Total</th></tr></thead><tbody className="divide-y divide-[#8FB59B]/10">{rows.map((row) => <tr key={String(row.id)}><td className="px-4 py-4">{String(row.reference)}</td><td className="px-4 py-4 text-[#A7B7A8]">{date(row.created_at)}</td><td className="px-4 py-4 text-[#DFE7E2]">{String(row.status)}</td><td className="px-4 py-4 text-[#DFE7E2]">{money(row.total)}</td></tr>)}</tbody></table></div></section></>; }

export function RecentSalesModule() {
  const { rows, loading, error } = useRows("sales", "id, reference, status, total, paid_total, created_at");
  return <section className="carte mt-6 overflow-hidden"><div className="flex items-center justify-between border-b border-[#8FB59B]/10 p-5"><div><h2 className="font-bold">Dernières ventes</h2><p className="mt-1 text-xs text-[#A7B7A8]">Ventes enregistrées dans Supabase.</p></div><span className="text-xs text-[#A7B7A8]">{rows.length} vente{rows.length > 1 ? "s" : ""}</span></div><ErrorBox error={error} /><Loading loading={loading} />{!loading && <div className="overflow-x-auto"><table className="w-full min-w-[580px] text-left text-sm"><thead className="bg-[#344440]/50 text-xs uppercase text-[#A7B7A8]"><tr><th className="px-5 py-3">Référence</th><th className="px-5 py-3">Statut</th><th className="px-5 py-3">Total</th><th className="px-5 py-3">Encaissé</th><th className="px-5 py-3">Date</th></tr></thead><tbody className="divide-y divide-[#8FB59B]/10">{rows.map((row) => <tr key={String(row.id)}><td className="px-5 py-4 font-semibold text-[#DFE7E2]">{String(row.reference)}</td><td className="px-5 py-4 text-[#A7B7A8]">{String(row.status)}</td><td className="px-5 py-4 text-[#E8ECE8]">{money(row.total)}</td><td className="px-5 py-4 text-[#A7B7A8]">{money(row.paid_total)}</td><td className="px-5 py-4 text-[#A7B7A8]">{date(row.created_at)}</td></tr>)}</tbody></table>{!rows.length && <p className="p-8 text-center text-sm text-[#A7B7A8]">Aucune vente enregistrée.</p>}</div>}</section>;
}

export function ParametresModule() {
  const [data, setData] = useState<Row | null>(null); const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [message, setMessage] = useState<string | null>(null);
  useEffect(() => { const timer = window.setTimeout(async () => { if (!supabase) { setLoading(false); return; } const { data: profile } = await supabase.rpc("get_my_profile"); const { data: establishment } = await supabase.from("establishments").select("id, name, slug, address, city, phone, email, currency, timezone, plan").eq("id", profile?.[0]?.establishment_id).single(); setData(establishment as Row | null); setLoading(false); }, 0); return () => window.clearTimeout(timer); }, []);
  async function save(event: FormEvent) { event.preventDefault(); if (!supabase || !data) return; setSaving(true); const { error } = await supabase.from("establishments").update({ name: data.name, address: data.address, city: data.city, phone: data.phone, email: data.email }).eq("id", data.id); setMessage(error?.message ?? "Paramètres enregistrés."); setSaving(false); }
  return <><Header eyebrow="Configuration Supabase" title="Paramètres" description="Identité et coordonnées de l’établissement AUTO DYALI." />{loading ? <section className="carte p-8"><Loading loading /></section> : data ? <form onSubmit={save} className="carte max-w-2xl p-6"><div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-2 text-sm text-[#A7B7A8]">Nom de l’établissement<input className="champ" value={String(data.name ?? "")} onChange={(e) => setData({ ...data, name: e.target.value })} /></label><label className="grid gap-2 text-sm text-[#A7B7A8]">Ville<input className="champ" value={String(data.city ?? "")} onChange={(e) => setData({ ...data, city: e.target.value })} /></label><label className="grid gap-2 text-sm text-[#A7B7A8]">Téléphone<input className="champ" value={String(data.phone ?? "")} onChange={(e) => setData({ ...data, phone: e.target.value })} /></label><label className="grid gap-2 text-sm text-[#A7B7A8]">Email<input className="champ" type="email" value={String(data.email ?? "")} onChange={(e) => setData({ ...data, email: e.target.value })} /></label><label className="grid gap-2 text-sm text-[#A7B7A8] sm:col-span-2">Adresse<input className="champ" value={String(data.address ?? "")} onChange={(e) => setData({ ...data, address: e.target.value })} /></label></div>{message && <p className="mt-4 text-sm text-[#7FBF9E]">{message}</p>}<button disabled={saving} className="btn-or mt-6 px-5 py-2 text-sm">{saving ? "Enregistrement…" : "Enregistrer les paramètres"}</button></form> : <p className="carte p-6 text-sm text-[#C5716B]">Établissement introuvable.</p>}</>;
}
