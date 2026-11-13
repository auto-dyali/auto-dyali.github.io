/* eslint-disable */
"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { supabase } from "@/lib/supabase-browser";
import { FEATURE_LABEL } from "@/lib/features";
import { exporterCSV } from "@/lib/crm-csv";
import { useNotification } from "@/lib/use-notification";

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
  const { success: notifySuccess, error: notifyError, info: notifyInfo } = useNotification();

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

  // --- État serveur : total filtré, KPI, owners, comptes par étape ---
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [kpi, setKpi] = useState({ trialNegotiation: 0, won: 0, dueReminders: 0 });
  const [stageCounts, setStageCounts] = useState<Record<string, number>>({});
  const [owners, setOwners] = useState<{ id: string; full_name: string | null }[]>([]);
  const [exportEnCours, setExportEnCours] = useState(false);
  const [eventsChargement, setEventsChargement] = useState(false);

  // Recherche nettoyée pour ne pas casser la syntaxe `.or(...)` de PostgREST.
  const rechercheSanitisee = useMemo(
    () => filtre.recherche.trim().replace(/[,%()]/g, " ").replace(/\s+/g, " "),
    [filtre.recherche]
  );

  /** Construit une requête `crm_leads` avec tous les filtres actifs (côté serveur). */
  const requeteLeads = useCallback(
    (options?: { count?: "exact"; head?: boolean }) => {
      if (!supabase) return null;
      let q = supabase.from("crm_leads").select("*", options ?? { count: "exact" });
      if (rechercheSanitisee) {
        q = q.or(
          `company.ilike.%${rechercheSanitisee}%,contact_name.ilike.%${rechercheSanitisee}%,email.ilike.%${rechercheSanitisee}%,city.ilike.%${rechercheSanitisee}%`
        );
      }
      if (filtre.stage !== "tous") q = q.eq("stage", filtre.stage);
      if (filtre.dateCreationDebut) {
        q = q.gte("created_at", new Date(`${filtre.dateCreationDebut}T00:00:00`).toISOString());
      }
      if (filtre.dateCreationFin) {
        const fin = new Date(`${filtre.dateCreationFin}T00:00:00`);
        fin.setDate(fin.getDate() + 1);
        q = q.lt("created_at", fin.toISOString());
      }
      if (filtre.dateRelanceDebut) {
        q = q.gte("next_action_at", new Date(`${filtre.dateRelanceDebut}T00:00:00`).toISOString());
      }
      if (filtre.dateRelanceFin) {
        const fin = new Date(`${filtre.dateRelanceFin}T00:00:00`);
        fin.setDate(fin.getDate() + 1);
        q = q.lt("next_action_at", fin.toISOString());
      }
      if (filtre.owner !== "tous") q = q.eq("owner_id", filtre.owner);
      return q;
    },
    [
      rechercheSanitisee,
      filtre.stage,
      filtre.dateCreationDebut,
      filtre.dateCreationFin,
      filtre.dateRelanceDebut,
      filtre.dateRelanceFin,
      filtre.owner,
    ]
  );

  const charger = useCallback(async () => {
    if (!supabase) {
      setError("Supabase n'est pas configuré.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const start = (page - 1) * pageSize;
    const end = start + pageSize - 1;
    const aujourdHui = new Date().toISOString().slice(0, 10);

    const pageQuery = requeteLeads();
    if (!pageQuery) return;
    const { data, error: pageError, count } = await pageQuery
      .order("updated_at", { ascending: false })
      .range(start, end);

    if (pageError) {
      const manquant = /schema cache|PGRST205|Could not find/i.test(pageError.message);
      setError(
        manquant
          ? "Le CRM n'est pas activé sur la production : la table crm_leads est absente. Exécutez FINAL_0028_PREFLIGHT_READONLY.sql pour l'état exact, puis appliquez supabase/apply/0018_apply_minimal.sql dans le SQL Editor (sauvegarde requise)."
          : pageError.message
      );
      setLoading(false);
      return;
    }

    const rows = (data ?? []) as Lead[];
    const totalCount = count ?? rows.length;
    const pages = Math.max(1, Math.ceil(totalCount / pageSize));
    setLeads(rows);
    setTotal(totalCount);
    setTotalPages(pages);

    if (page > pages) {
      setPage(pages);
      return;
    }

    const baseCount = () => requeteLeads({ count: "exact", head: true });
    const [trialReq, wonReq, dueReq, stageReqs] = await Promise.all([
      baseCount()?.in("stage", ["trial", "negotiation"]),
      baseCount()?.eq("stage", "won"),
      baseCount()
        ?.lte("next_action_at", aujourdHui)
        .not("next_action_at", "is", null)
        .not("stage", "in", "(won,lost)"),
      Promise.all(
        ETAPES.map((e) => baseCount()?.eq("stage", e.cle) ?? Promise.resolve({ count: 0 }))
      ),
    ]);

    setKpi({
      trialNegotiation: trialReq?.count ?? 0,
      won: wonReq?.count ?? 0,
      dueReminders: dueReq?.count ?? 0,
    });

    const counts: Record<string, number> = {};
    ETAPES.forEach((e, index) => {
      counts[e.cle] = stageReqs[index]?.count ?? 0;
    });
    setStageCounts(counts);

    // Propriétaires réels (comptes plateforme/managers) pour le filtre.
    const { data: ownerData } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("role", ["saas_admin", "manager"])
      .order("full_name");
    setOwners((ownerData ?? []) as { id: string; full_name: string | null }[]);

    setLoading(false);
  }, [page, pageSize, requeteLeads]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void charger();
    }, 300);
    return () => window.clearTimeout(timer);
  }, [charger]);

  // Événements du prospect sélectionné (chargement indépendant de la page).
  const chargerEvenements = useCallback(async () => {
    if (!supabase || !selection) {
      setEvents([]);
      return;
    }
    setEventsChargement(true);
    const { data, error: eventsError } = await supabase
      .from("crm_events")
      .select("id, lead_id, event_type, body, created_at")
      .eq("lead_id", selection.id)
      .order("created_at", { ascending: false });
    if (eventsError) notifyError({ title: "Erreur événements", message: eventsError.message });
    else setEvents((data ?? []) as Evenement[]);
    setEventsChargement(false);
  }, [selection]);

  useEffect(() => {
    void chargerEvenements();
  }, [chargerEvenements]);

  const eventsLead = events;

  const parEtape = useMemo(
    () =>
      ETAPES.map((e) => ({
        cle: e.cle,
        label: e.label,
        couleur: e.couleur,
        count: stageCounts[e.cle] ?? 0,
        leads: leads.filter((l) => l.stage === e.cle),
      })),
    [leads, stageCounts]
  );

  // --- Navigation précédente ---
  function precedentPage() {
    if (page > 1) setPage(page - 1);
  }

  // --- Navigation suivante ---
  function prochainePage() {
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
    setPage(1);
  }

  // Récupère l'intégralité des résultats filtrés (par lots) pour l'export.
  async function recupererTousLesLeadsFiltres(): Promise<Lead[]> {
    if (!supabase) return [];
    const tailleLot = 1000;
    let tous: Lead[] = [];
    let offset = 0;
    for (;;) {
      const q = requeteLeads();
      if (!q) break;
      const { data, error: exportError } = await q
        .order("updated_at", { ascending: false })
        .range(offset, offset + tailleLot - 1);
      if (exportError) throw new Error(exportError.message);
      const rows = (data ?? []) as Lead[];
      tous = tous.concat(rows);
      if (rows.length < tailleLot) break;
      offset += tailleLot;
    }
    return tous;
  }

  // --- Export CSV (tous les résultats filtrés, pas seulement la page) ---
  async function handleExportCSV() {
    setExportEnCours(true);
    setError(null);
    try {
      const tous = await recupererTousLesLeadsFiltres();
      const contenu = exporterCSV(tous, owners);
      if (!contenu) {
        notifyInfo({ title: "Export", message: "Aucun résultat ne correspond aux filtres actuels." });
        return;
      }
      const blob = new Blob(["\ufeff" + contenu], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `crm_exports_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      notifySuccess({ title: "Export CSV terminé", message: `${tous.length} prospect(s) exportés.` });
    } catch (e) {
      notifyError({ title: "Erreur d'export", message: e instanceof Error ? e.message : "inconnu" });
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
      await chargerEvenements();
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
    if (insertError) notifyError({ title: "Erreur de création", message: insertError.message });
    else {
      setNote("");
      await chargerEvenements();
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
                <option value="">Tous</option>
                {owners.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.full_name?.trim() || o.id.slice(0, 8)}
                  </option>
                ))}
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
              page {page} / {totalPages}
            </span>
            <button
              type="button"
              onClick={prochainePage}
              disabled={page >= totalPages}
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
            {loading ? "…" : total}
          </p>
        </article>
        <article className="carte p-5">
          <p className="text-xs text-[#A7B7A8]">En essai / négociation</p>
          <p className="titre-or mt-1 text-2xl font-extrabold">
            {loading ? "…" : kpi.trialNegotiation}
          </p>
        </article>
        <article className="carte p-5">
          <p className="text-xs text-[#A7B7A8]">Convertis (gagnés)</p>
          <p className="titre-or mt-1 text-2xl font-extrabold">
            {loading ? "…" : kpi.won}
          </p>
        </article>
        <article className="carte p-5">
          <p className="text-xs text-[#8FB59B]">Relances dues aujourd'hui</p>
          <p className="titre-or mt-1 text-2xl font-extrabold">
            {loading ? "…" : kpi.dueReminders}
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
                  {etape.count}
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
                {eventsChargement && (
                  <li className="text-xs text-[#A7B7A8]">Chargement de l’historique…</li>
                )}
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
                {!eventsChargement && !eventsLead.length && (
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