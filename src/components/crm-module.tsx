/* eslint-disable */
"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { supabase } from "@/lib/supabase-browser";
import { FEATURE_LABEL } from "@/lib/features";

/**
 * AUTO DYALI — Export CSV CRM.
 * Exporte les leads avec les filtres actifs appliqués.
 * Utilise file-saver (déjà dépendance du projet) pour le téléchargement.
 */

/** Formatte une valeur pour le CSV (échappe les guillemets et les sauts de ligne). */
const formatCSV = (value: string | null | undefined): string => {
  if (value === null || value === undefined) return "";
  const v = String(value).replace(/\"/g, '""').replace(/\\r?\\n/g, " ");
  return `"${v}"`;
};

/** Exporte les leads filtrés en CSV. Respecte les filtres actifs. */
const exporterCSV = (leads: any[], filtre: any) => {
  let result = [...leads];

  if (filtre.recherche && filtre.recherche.trim()) {
    const q = filtre.recherche.trim().toLowerCase();
    result = result.filter(
      (l) =>
        l.company.toLowerCase().includes(q) ||
        (l.contact_name && l.contact_name.toLowerCase().includes(q)) ||
        (l.email && l.email.toLowerCase().includes(q)) ||
        (l.city && l.city.toLowerCase().includes(q))
    );
  }
  if (filtre.stage && filtre.stage !== "tous") {
    result = result.filter((l) => l.stage === filtre.stage);
  }
  if (filtre.dateCreationDebut) {
    const debut = new Date(filtre.dateCreationDebut);
    result = result.filter((l) => new Date(l.created_at) >= debut);
  }
  if (filtre.dateCreationFin) {
    const fin = new Date(filtre.dateCreationFin);
    fin.setDate(fin.getDate() + 1);
    result = result.filter((l) => new Date(l.created_at) < fin);
  }
  if (filtre.dateRelanceDebut) {
    const debut = new Date(filtre.dateRelanceDebut);
    result = result.filter((l) => l.next_action_at && new Date(l.next_action_at) >= debut);
  }
  if (filtre.dateRelanceFin) {
    const fin = new Date(filtre.dateRelanceFin);
    fin.setDate(fin.getDate() + 1);
    result = result.filter((l) => !l.next_action_at || new Date(l.next_action_at) < fin);
  }
  if (filtre.owner && filtre.owner !== "tous") {
    result = result.filter((l) => l.owner_id === filtre.owner);
  }

  if (result.length === 0) {
    return null;
  }

  const headers = [
    "Entreprise",
    "Contact",
    "Email",
    "Téléphone",
    "Ville",
    "Étape",
    "Prochaine relance",
    "Propriétaire",
  ];
  const rows: string[] = [];

  // En-tête
  rows.push(headers.map(formatCSV).join(","));

  // Lignes
  for (const l of result) {
    const row = [
      formatCSV(l.company),
      formatCSV(l.contact_name || ""),
      formatCSV(l.email || ""),
      formatCSV(l.phone || ""),
      formatCSV(l.city || ""),
      formatCSV(l.stage || ""),
      formatCSV(
        l.next_action_at
          ? new Date(l.next_action_at).toLocaleDateString("fr-FR")
          : ""
      ),
      formatCSV(l.owner_id ? "OUI" : "NON"),
    ];
    rows.push(row.join(","));
  }

  return rows.join("\n");
};

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
  owner_id: string | null;
};

type Evenement = { id: string; lead_id: string; event_type: string; body: string; created_at: string };

const ETAPES: { cle: string; label: string; couleur: string }[] = [
  { cle: "prospect", label: "Prospects", couleur: "#5B8A8F" },
  { cle: "demo", label: "Démonstrations", couleur: "#D6B66F" },
  { cle: "trial", label: "Essais", couleur: "#A8BB87" },
  { cle: "negotiation", label: "Négociation", couleur: "#E9D998" },
  { cle: "won", label: "Gagnés", couleur: "#38A987" },
  { cle: "lost", label: "Perdus", couleur: "#D66868" },
];

const dateFr = (v: string | null) => (v ? new Date(v).toLocaleDateString("fr-FR") : "—");

export function CrmModule() {
  // --- État principal ---
  const [leads, setLeads] = useState<Lead[]>([]);
  const [events, setEvents] = useState<Evenement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [traitement, setTraitement] = useState<string | null>(null);

  // --- Nouvel état : filtres ---
  const [filtre, setFiltre] = useState({
    recherche: "",
    stage: "tous",
    dateCreationDebut: "",
    dateCreationFin: "",
    dateRelanceDebut: "",
    dateRelanceFin: "",
    owner: "tous",
  });

  // --- Nouvel état : pagination ---
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20); // taille de page configurable

  // --- État formulaire et modal ---
  const [form, setForm] = useState({
    company: "", contact: "", email: "", phone: "", city: "", activity: "",
    stage: "prospect", plan: "", notes: "", nextAction: "",
  });
  const [ouvert, setOuvert] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selection, setSelection] = useState<Lead | null>(null);
  const [note, setNote] = useState("");
  const [typeNote, setTypeNote] = useState("note");

  // --- Nouvel état : computed values après filtrage ET pagination ---
  const leadsFiltres = useMemo(() => {
    let result = [...leads];

    // Filtre recherche (entreprise, contact, email, ville)
    if (filtre.recherche && filtre.recherche.trim()) {
      const q = filtre.recherche.trim().toLowerCase();
      result = result.filter(
        (l) =>
          l.company.toLowerCase().includes(q) ||
          (l.contact_name && l.contact_name.toLowerCase().includes(q)) ||
          (l.email && l.email.toLowerCase().includes(q)) ||
          (l.city && l.city.toLowerCase().includes(q))
      );
    }
    // Filtre étape
    if (filtre.stage && filtre.stage !== "tous") {
      result = result.filter((l) => l.stage === filtre.stage);
    }
    // Filtre date création début
    if (filtre.dateCreationDebut) {
      const debut = new Date(filtre.dateCreationDebut);
      result = result.filter((l) => new Date(l.created_at) >= debut);
    }
    // Filtre date création fin
    if (filtre.dateCreationFin) {
      const fin = new Date(filtre.dateCreationFin);
      fin.setDate(fin.getDate() + 1);
      result = result.filter((l) => new Date(l.created_at) < fin);
    }
    // Filtre date prochaine relance début
    if (filtre.dateRelanceDebut) {
      const debut = new Date(filtre.dateRelanceDebut);
      result = result.filter((l) => l.next_action_at && new Date(l.next_action_at) >= debut);
    }
    // Filtre date prochaine relance fin
    if (filtre.dateRelanceFin) {
      const fin = new Date(filtre.dateRelanceFin);
      fin.setDate(fin.getDate() + 1);
      result = result.filter((l) => !l.next_action_at || new Date(l.next_action_at) < fin);
    }
    // Filtre owner (responsable)
    if (filtre.owner && filtre.owner !== "tous") {
      result = result.filter((l) => l.owner_id === filtre.owner);
    }

    // --- Pagination ---
    const total = result.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    // On s'assure que la page est dans les bornes
    const safePage = Math.min(Math.max(page, 1), totalPages);
    const start = (safePage - 1) * pageSize;
    const end = start + pageSize;
    return {
      result,
      total,
      totalPages,
      page: safePage,
      pageData: result.slice(start, end),
    };
  }, [leads, filtre, page, pageSize]);

  // --- Utilitaires dérivés après filtrage et pagination ---
  const aRelancer = useMemo(
    () => leadsFiltres.result.filter(
      (l) =>
        l.next_action_at &&
        l.next_action_at <= new Date().toISOString().slice(0, 10) &&
        !["won", "lost"].includes(l.stage)
    ),
    [leadsFiltres.result]
  );

  const parEtape = useMemo(() => {
    return ETAPES.map((e) => ({
      cle: e.cle,
      label: e.label,
      couleur: e.couleur,
      leads: leadsFiltres.result.filter((l) => l.stage === e.cle),
    }));
  }, [leadsFiltres.result]);

  const eventsLead = useMemo(
    () => (selection ? events.filter((e) => e.lead_id === selection.id) : []),
    [events, selection]
  );

  // --- Nouvel état : export ---
  const [exportEnCours, setExportEnCours] = useState(false);

  /* ---------------------------------------------------------------
   * Requête chargement avec pagination Supabase .range()
   * --------------------------------------------------------------- */
  async function charger() {
    if (!supabase) {
      setError("Supabase n'est pas configuré.");
      setLoading(false);
      return;
    }
    // Utilisation de la pagination Supabase via range (début, fin)
    // Les index sont 0-based : range(start, end) récupère rows[start] à rows[end]
    const start = (page - 1) * pageSize;
    const end = start + pageSize - 1;
    const [leadsReq, eventsReq] = await Promise.all([
      supabase
        .from("crm_leads")
        .select("*")
        .order("updated_at", { ascending: false })
        .range(start, end),
      supabase
        .from("crm_events")
        .select("id, lead_id, event_type, body, created_at")
        .order("created_at", { ascending: false })
        .range(start, end),
    ]);
    if (
      leadsReq.error &&
      !leadsReq.error.message.includes("does not exist")
    )
      setError(leadsReq.error.message);
    else setLeads((leadsReq.data ?? []) as Lead[]);
    if (!eventsReq.error) setEvents((eventsReq.data ?? []) as Evenement[]);
    setLoading(false);
  }

  useEffect(() => {
    void charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  // --- Navigation précédente ---
  function precedentPage() {
    if (page > 1) setPage(page - 1);
  }

  // --- Navigation suivante ---
  function prochainePage() {
    const totalPages = leadsFiltres.totalPages;
    if (page < totalPages) setPage(page + 1);
  }

  // --- Réinitialisation des filtres ---
  function reinitialiserFiltres() {
    setFiltre({
      recherche: "",
      stage: "tous",
      dateCreationDebut: "",
      dateCreationFin: "",
      dateRelanceDebut: "",
      dateRelanceFin: "",
      owner: "tous",
    });
    setPage(1); // reviens à la première page
  }

  // --- Export CSV ---
  async function handleExportCSV() {
    setExportEnCours(true);
    try {
      const contenu = exporterCSV(leads, filtre);
      if (!contenu) {
        setNotice("Aucun résultat ne correspond aux filtres actuels.");
        return;
      }
      const blob = new Blob([contenu], {
        type: "text/csv;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `crm_exports_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setNotice(
        `Export CSV terminé — ${leadsFiltres.total} prospect(s) exportés.`
      );
    } catch (e) {
      setError(
        `Erreur lors de l'export : ${e instanceof Error ? e.message : "inconnu"}`
      );
    } finally {
      setExportEnCours(false);
    }
  }

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
          body: `Prospect créé — étape ${
            ETAPES.find((e) => e.cle === form.stage)?.label ?? form.stage
          }.`,
        });
      }
      setNotice(
        `Prospect « ${form.company.trim()} » ajouté au pipeline.`
      );
      setOuvert(false);
      setForm({
        company: "",
        contact: "",
        email: "",
        phone: "",
        city: "",
        activity: "",
        stage: "prospect",
        plan: "",
        notes: "",
        nextAction: "",
      });
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
        body: `Étape : ${
          ETAPES.find((e) => e.cle === lead.stage)?.label ?? lead.stage
        } → ${
          ETAPES.find((e) => e.cle === stage)?.label ?? stage
        }.`,
      });
      setNotice(`${lead.company} → ${
        ETAPES.find((e) => e.cle === stage)?.label ?? stage
      }.`);
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
      const { data } = await supabase
        .from("crm_events")
        .select("id, lead_id, event_type, body, created_at")
        .eq("lead_id", selection.id)
        .order("created_at", { ascending: false });
      setEvents((current) => [
        ...((data ?? []) as Evenement[]),
        ...current.filter((e) => e.lead_id !== selection.id),
      ]);
      await charger();
    }
  }

  return (
    <section className="space-y-6">
      {/* --- En-tête avec pagination et filtres --- */}
      <div className="carte mb-6 p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Recherche */}
          <div>
            <label className="text-xs uppercase tracking-[0.2em] text-[#A7B7A8] sm:col-span-2">
              Recherche
              <input
                type="text"
                value={filtre.recherche}
                onChange={(e) => {
                  setFiltre({ ...filtre, recherche: e.target.value });
                  setPage(1);
              }}
                placeholder="Entreprise, contact, email ou ville..."
                className="champ mt-1 min-h-11 w-full"
              />
            </label>
          </div>
          {/* Filtre étape */}
          <div>
            <label className="text-xs uppercase tracking-[0.2em] text-[#A7B7A8]">
              Étape
              <select
                value={filtre.stage === "tous" ? "" : filtre.stage}
                onChange={(e) => {
                  setFiltre({ ...filtre, stage: e.target.value || "tous" });
                  setPage(1);
              }}
                className="champ mt-1 min-h-11"
              >
                <option value="tous">Toutes</option>
                {ETAPES.map((e) => (
                  <option key={e.cle} value={e.cle}>
                    {e.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {/* Filtre date création debut */}
          <div>
            <label className="text-xs uppercase tracking-[0.2em] text-[#A7B7A8]">
              Créé depuis
              <input
                type="date"
                value={filtre.dateCreationDebut}
                onChange={(e) => {
                  setFiltre({ ...filtre, dateCreationDebut: e.target.value });
                  setPage(1);
              }}
                className="champ mt-1 min-h-11"
              />
            </label>
          </div>
          {/* Filtre date création fin */}
          <div>
            <label className="text-xs uppercase tracking-[0.2em] text-[#A7B7A8]">
              jusqu'au
              <input
                type="date"
                value={filtre.dateCreationFin}
                onChange={(e) => {
                  setFiltre({ ...filtre, dateCreationFin: e.target.value });
                  setPage(1);
              }}
                className="champ mt-1 min-h-11"
              />
            </label>
          </div>
          {/* Filtre date relance debut */}
          <div>
            <label className="text-xs uppercase tracking-[0.2em] text-[#A7B7A8]">
              Relance depuis
              <input
                type="date"
                value={filtre.dateRelanceDebut}
                onChange={(e) => {
                  setFiltre({ ...filtre, dateRelanceDebut: e.target.value });
                  setPage(1);
              }}
                className="champ mt-1 min-h-11"
              />
            </label>
          </div>
          {/* Filtre date relance fin */}
          <div>
            <label className="text-xs uppercase tracking-[0.2em] text-[#A7B7A8]">
              jusqu'au
              <input
                type="date"
                value={filtre.dateRelanceFin}
                onChange={(e) => {
                  setFiltre({ ...filtre, dateRelanceFin: e.target.value });
                  setPage(1);
              }}
                className="champ mt-1 min-h-11"
              />
            </label>
          </div>
          {/* Filtre propriétaire */}
          <div>
            <label className="text-xs uppercase tracking-[0.2em] text-[#A7B7A8]">
              Propriétaire
              <select
                value={filtre.owner === "tous" ? "" : filtre.owner}
                onChange={(e) => {
                  setFiltre({ ...filtre, owner: e.target.value || "tous" });
                  setPage(1);
              }}
                className="champ mt-1 min-h-11"
              >
                <option value="tous">Tous</option>
              </select>
            </label>
          </div>
          {/* Bouton réinitialiser */}
          <div>
            <button
              type="button"
              onClick={reinitialiserFiltres}
              className="rounded-lg border border-[#8FB59B]/40 px-4 py-2 text-sm text-[#DFE7E2] hover:bg-[#344440] hover:text-[#E8ECE8]"
            >
              Réinitialiser
            </button>
          </div>
          {/* Bouton export CSV */}
          <div>
            <button
              type="button"
              onClick={handleExportCSV}
              disabled={exportEnCours}
              className="rounded-lg border border-[#8FB59B]/40 px-4 py-2 text-sm text-[#DFE7E2] hover:bg-[#31ffb0] hover:text-[#000] mt-2"
            >
              {exportEnCours ? "Export…" : "Export CSV"}
            </button>
          </div>
          {/* Navigation pagination */}
          <div className="sm:col-span-2">
            <button
              type="button"
              onClick={precedentPage}
              disabled={page <= 1}
              className="rounded-lg border border-[#8FB59B]/40 px-4 py-2 text-sm text-[#DFE7E2] hover:bg-[#344440] hover:text-[#E8ECE8]"
            >
              Précédent
            </button>
            <span className="mx-2 text-sm text-[#A7B7A8]">
              page {page} / {leadsFiltres.totalPages}
            </span>
            <button
              type="button"
              onClick={prochainePage}
              disabled={page >= leadsFiltres.totalPages}
              className="rounded-lg border border-[#8FB59B]/40 px-4 py-2 text-sm text-[#DFE7E2] hover:bg-[#344440] hover:text-[#E8ECE8]"
            >
              Suivant
            </button>
          </div>
        </div>
      </div>

      {/* --- KPI --- */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <article className="carte p-5">
          <p className="text-xs text-[#A7B7A8]">Prospects au total</p>
          <p className="titre-or mt-1 text-2xl font-extrabold">
            {loading ? "…" : leadsFiltres.total}
          </p>
        </article>
        <article className="carte p-5">
          <p className="text-xs text-[#A7B7A8]">En essai / négociation</p>
          <p className="titre-or mt-1 text-2xl font-extrabold">
            {loading ? "…" : leadsFiltres.result.filter((l) => l.stage === "trial" || l.stage === "negotiation").length}
          </p>
        </article>
        <article className="carte p-5">
          <p className="text-xs text-[#A7B7A8]">Convertis (gagnés)</p>
          <p className="titre-or mt-1 text-2xl font-extrabold">
            {loading ? "…" : leadsFiltres.result.filter((l) => l.stage === "won").length}
          </p>
        </article>
        <article className="carte p-5">
          <p className="text-xs text-[#8FB59B]">Relances dues aujourd'hui</p>
          <p className="titre-or mt-1 text-2xl font-extrabold">
            {loading ? "…" : aRelancer.length}
          </p>
        </article>
      </div>

      {notice && (
        <p
          role="status"
          className="rounded-lg bg-[#5D9E7F]/10 px-4 py-3 text-sm text-[#7FBF9E]"
        >
          {notice}
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-lg bg-[#C5716B]/15 px-4 py-3 text-sm text-[#C5716B]"
        >
          {error}
        </p>
      )}
      {exportEnCours && (
        <p
          role="status"
          className="rounded-lg bg-[#5D9E7F]/10 px-4 py-3 text-sm text-[#7FBF9E]"
        >
          Génération CSV en cours…
        </p>
      )}

      {/* --- Pipeline --- */}
      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        {parEtape.map((etape) => {
          const liste = etape.leads;
          return (
            <section key={etape.cle} className="carte p-4">
              <div className="flex items-center justify-between">
                <p
                  className="text-xs font-bold uppercase tracking-wide"
                  style={{ color: etape.couleur }}
                >
                  {etape.label}
                </p>
                <span
                  className="rounded-full bg-[#344440] px-2 py-0.5 text-[11px] text-[#DFE7E2]"
                >
                  {liste.length}
                </span>
              </div>
              <ul className="mt-3 space-y-2">
                {liste.map((lead) => (
                  <li key={lead.id}>
                    <button
                      type="button"
                      onClick={() => setSelection(lead)}
                      className={
                        `w-full rounded-lg border p-2.5 text-left transition hover:border-[#8FB59B]/50 ${
                          selection?.id === lead.id
                            ? "border-[#8FB59B] bg-[#344440]"
                            : "border-[#8FB59B]/15 bg-[#2C3735]"
                        }`
                      }
                    >
                      <p className="truncate text-xs font-semibold text-[#E8ECE8]">
                        {lead.company}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-[#A7B7A8]">
                        {lead.city ?? "—"} ·
                        {lead.plan_interest
                          ? lead.plan_interest.toUpperCase()
                          : "forfait ?"}
                      </p>
                      {lead.next_action_at && (
                        <p className="mt-1 text-[10px] text-[#8FB59B]">
                          Relance {dateFr(lead.next_action_at)}
                        </p>
                      )}
                    </button>
                  </li>
                ))}
                {!liste.length && (
                  <li className="py-3 text-center text-[11px] text-[#A7B7A8]">
                    Vide
                  </li>
                )}
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
                <p className="text-xs uppercase tracking-[0.2em] text-[#A7B7A8]">
                  Fiche prospect
                </p>
                <h2 className="titre-or mt-1 text-xl font-extrabold">
                  {selection.company}
                </h2>
                <p className="mt-1 text-sm text-[#A7B7A8]">
                  {selection.contact_name ?? "Contact —"} {selection.city ? `· ${selection.city}` : ""} {selection.activity ? `· ${selection.activity}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelection(null)}
                className="text-2xl text-[#A7B7A8]"
                aria-label="Fermer"
              >
                ×
              </button>
            </div>

            <div className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
              {selection.email && (
                <p className="text-[#E8ECE8]">✉ {selection.email}</p>
              )}
              {selection.phone && (
                <p className="text-[#E8ECE8]">☎ {selection.phone}</p>
              )}
              <p className="text-[#A7B7A8]">Inscrit le {dateFr(selection.created_at)}</p>
            </div>

            <label className="mt-4 block text-xs text-[#A7B7A8]">
              Étape du pipeline
              <select
                className="champ mt-1 min-h-11"
                value={selection.stage}
                disabled={traitement === selection.id}
                onChange={(e) => void changerEtape(selection, e.target.value)}
              >
                {ETAPES.map((e) => (
                  <option key={e.cle} value={e.cle}>
                    {e.label}
                  </option>
                ))}
              </select>
            </label>

            {/* Journal */}
            <div className="mt-5 border-t border-[#8FB59B]/10 pt-4">
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#A7B7A8]">
                Historique des contacts
              </p>
              <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
                {eventsLead.map((ev) => (
                  <li
                    key={ev.id}
                    className="rounded-lg bg-[#344440]/50 px-3 py-2 text-sm"
                  >
                    <p
                      className="text-[10px] uppercase text-[#A7B7A8]"
                    >
                      {ev.event_type === "stage_change" ? "Changement d'étape" : ev.event_type === "call" ? "Appel" : ev.event_type === "demo" ? "Démonstration" : "Note"} · {new Date(ev.created_at).toLocaleString("fr-FR")}
                    </p>
                    <p className="mt-1 leading-5 text-[#E8ECE8]">{ev.body}</p>
                  </li>
                ))}
                {!eventsLead.length && (
                  <li className="text-xs text-[#A7B7A8]">Aucun échange enregistré.</li>
                )}
              </ul>

              <form
                onSubmit={(e) => void ajouterNote(e)}
                className="mt-3 flex flex-wrap gap-2"
              >
                <select
                  value={typeNote}
                  onChange={(e) => setTypeNote(e.target.value)}
                  className="champ min-h-10 w-36 text-xs"
                  aria-label="Type d'échange"
                >
                  <option value="note">Note</option>
                  <option value="call">Appel</option>
                  <option value="email">Email</option>
                  <option value="demo">Démonstration</option>
                </select>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Compter l'échange…"
                  className="champ min-h-10 min-w-40 flex-1"
                />
                <button type="submit" className="btn-or px-3 py-2 text-xs">
                  Ajouter
                </button>
              </form>
            </div>
          </div>
        </section>
      )}

      {/* Modale nouveau prospect */}
      {ouvert && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-5"
        >
          <form onSubmit={(e) => void creerLead(e)} className="carte my-4 w-full max-w-lg p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[#A7B7A8]">
                  CRM plateforme
                </p>
                <h2 className="titre-or mt-1 text-xl font-extrabold">
                  Nouveau prospect
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setOuvert(false)}
                className="text-2xl text-[#A7B7A8]"
                aria-label="Fermer"
              >
                ×
              </button>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <label className="text-xs text-[#A7B7A8] sm:col-span-2">
                Entreprise *
                <input
                  required
                  className="champ mt-1 min-h-11"
                  placeholder="Garage El Mansouri"
                  value={form.company}
                  onChange={(e) =>
                    setForm({ ...form, company: e.target.value })
                  }
                />
              </label>
              <label className="text-xs text-[#A7B7A8]">
                Contact
                <input
                  className="champ mt-1 min-h-11"
                  placeholder="Nom complet"
                  value={form.contact}
                  onChange={(e) =>
                    setForm({ ...form, contact: e.target.value })
                  }
                />
              </label>
              <label className="text-xs text-[#A7B7A8]">
                Téléphone
                <input
                  className="champ mt-1 min-h-11"
                  placeholder="+212…"
                  value={form.phone}
                  onChange={(e) =>
                    setForm({ ...form, phone: e.target.value })
                  }
                />
              </label>
              <label className="text-xs text-[#A7B7A8]">
                Email
                <input
                  type="email"
                  className="champ mt-1 min-h-11"
                  value={form.email}
                  onChange={(e) =>
                    setForm({ ...form, email: e.target.value })
                  }
                />
              </label>
              <label className="text-xs text-[#A7B7A8]">
                Ville
                <input
                  className="champ mt-1 min-h-11"
                  value={form.city}
                  onChange={(e) =>
                    setForm({ ...form, city: e.target.value })
                  }
                />
              </label>
              <label className="text-xs text-[#A7B7A8]">
                Activité
                <input
                  className="champ mt-1 min-h-11"
                  placeholder="Garage, magasin, centre pneus…"
                  value={form.activity}
                  onChange={(e) =>
                    setForm({ ...form, activity: e.target.value })
                  }
                />
              </label>
              <label className="text-xs text-[#A7B7A8]">
                Étape
                <select
                  className="champ mt-1 min-h-11"
                  value={form.stage}
                  onChange={(e) => setForm({ ...form, stage: e.target.value })}
                >
                  {ETAPES.map((e) => (
                    <option key={e.cle} value={e.cle}>
                      {e.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-[#A7B7A8]">
                Forfait intéressé
                <select
                  className="champ mt-1 min-h-11"
                  value={form.plan}
                  onChange={(e) => setForm({ ...form, plan: e.target.value })}
                >
                  <option value="">À déterminer</option>
                  <option value="standard">STANDARD</option>
                  <option value="silver">SILVER</option>
                  <option value="gold">GOLD</option>
                </select>
              </label>
              <label className="text-xs text-[#A7B7A8]">
                Prochaine relance
                <input
                  type="date"
                  className="champ mt-1 min-h-11"
                  value={form.nextAction}
                  onChange={(e) =>
                    setForm({ ...form, nextAction: e.target.value })
                  }
                />
              </label>
              <label className="text-xs text-[#A7B7A8] sm:col-span-2">
                Notes
                <textarea
                  rows={3}
                  className="champ mt-1 py-2 text-sm"
                  value={form.notes}
                  onChange={(e) =>
                    setForm({ ...form, notes: e.target.value })
                  }
                />
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setOuvert(false)}
                className="rounded-lg px-4 py-2 text-sm text-[#A7B7A8]"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={saving}
                className="btn-or px-4 py-2 text-sm disabled:opacity-40"
              >
                {saving ? "Ajout…" : "Ajouter au pipeline"}
              </button>
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
    <main className="min-h-screen bg-[#252D2D] text-[#E8ECE8]">
      <header
        className="flex items-center justify-between border-b border-[#8FB59B]/15 bg-[#2C3735] px-5 py-4 lg:px-10"
      >
        <Logo compact />
        <div className="flex items-center gap-4">
          <span
            className="hidden text-sm text-[#A7B7A8] sm:block"
          >
            Super Admin · {FEATURE_LABEL.crm ?? "CRM"}
          </span>
          <button
            type="button"
            onClick={() => router.replace("/super-admin/")}
            className="text-sm text-[#8FB59B] hover:underline"
          >
            Pilotage
          </button>
        </div>
      </header>
      <div className="mx-auto max-w-7xl p-5 lg:p-10">{children}</div>
    </main>
  );
}