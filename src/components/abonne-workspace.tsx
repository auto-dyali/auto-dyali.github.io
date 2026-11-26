"use client";
/* eslint-disable react/no-unescaped-entities */
/* eslint-disable react-hooks/set-state-in-effect */

/**
 * AUTO DYALI — GV5 §75
 * Fiche professionnelle unifiée du Super Admin : UNE seule expérience pour
 * consulter et modifier un abonné. Cinq espaces :
 *   1. Établissement  2. Manager  3. Abonnement
 *   4. Modules & permissions  5. Invitations & historique
 *
 * Toutes les écritures passent par des RPC SECURITY DEFINER journalisées.
 * Aucun mot de passe n'est lu, affiché ou stocké ici. Aucun envoi n'est
 * simulé : les statuts affichés sont ceux renvoyés par les fournisseurs.
 */

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase-browser";
import { classerErreur } from "@/lib/supabase-errors";
import { dateFrCourte } from "@/lib/csv-export";
import { useNotification } from "@/lib/use-notification";
import {
  Champ3D,
  Zone3D,
  Section3D,
  Ligne,
  Pastille,
  Recapitulatif3D,
} from "./abonne-form-primitives";
import { ChampGeographieMaroc } from "@/components/ChampGeographieMaroc";
import {
  DUREES_ESSAI,
  DUREES_PAYANTES,
  EMAIL_RE,
  PHONE_RE,
  calculerEcheances,
  lireChampsAdminDepuisNotes,
  validerCoordonnees,
  validerIdentite,
} from "@/lib/abonne-rules";

export type Espace = "etablissement" | "manager" | "abonnement" | "modules" | "invitations";

const ESPACES: { key: Espace; label: string; icone: string }[] = [
  { key: "etablissement", label: "Établissement", icone: "◆" },
  { key: "manager", label: "Manager", icone: "◉" },
  { key: "abonnement", label: "Abonnement", icone: "◇" },
  { key: "modules", label: "Modules & droits", icone: "▦" },
  { key: "invitations", label: "Invitations & historique", icone: "↗" },
];

export type AbonneRow = {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  phone: string | null;
  email: string | null;
  plan: string;
  is_active: boolean;
  created_at: string;
  suspended_at: string | null;
  archived_at?: string | null;
  professional_id?: string | null;
  legal_name?: string | null;
  activity_type?: string | null;
  region?: string | null;
  address?: string | null;
  notes?: string | null;
};

type Enregistrement = Record<string, unknown>;
type Permission = {
  module: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
};
type Feature = { feature_key: string; enabled: boolean };
type Manager = {
  id?: string;
  full_name?: string;
  login_id?: string;
  phone?: string;
  email?: string;
  is_active?: boolean;
  created_at?: string;
  last_activity?: string;
  must_change_password?: boolean;
  password_changed_at?: string;
};

type Details = {
  establishment: Enregistrement | null;
  subscription: Enregistrement | null;
  manager: Manager | null;
  permissions: Permission[];
  plan_features: Feature[];
  invitations: Enregistrement[];
  audit: Enregistrement[];
};

type EtabForm = {
  name: string;
  legal_name: string;
  professional_id: string;
  slug: string;
  activity_type: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  region: string;
  country: string;
  legal_info: string;
  fiscal_info: string;
  admin_info: string;
  dossier_state: string;
  complementary_contacts: string;
  notes: string;
};

/* GV5 §76 — primitives et règles désormais PARTAGÉES avec la création. */
export { Champ3D, Zone3D, Section3D, Ligne, Pastille, Recapitulatif3D } from "./abonne-form-primitives";

function txt(v: unknown): string {
  return v === null || v === undefined ? "" : String(v);
}
function vrai(v: unknown): boolean {
  return v === true;
}

function formEtab(d: Enregistrement | null, abonne: AbonneRow): EtabForm {
  const notes = txt(d?.notes ?? abonne.notes);
  const historique = lireChampsAdminDepuisNotes(notes);
  return {
    name: txt(d?.name ?? abonne.name),
    legal_name: txt(d?.legal_name ?? abonne.legal_name),
    professional_id: txt(d?.professional_id ?? abonne.professional_id),
    slug: txt(d?.slug ?? abonne.slug),
    activity_type: txt(d?.activity_type ?? abonne.activity_type),
    phone: txt(d?.phone ?? abonne.phone),
    email: txt(d?.email ?? abonne.email),
    address: txt(d?.address ?? abonne.address),
    city: txt(d?.city ?? abonne.city),
    region: txt(d?.region ?? abonne.region),
    country: (txt(d?.country) || historique.country || "") === "Maroc"
      ? "MA"
      : txt(d?.country) || historique.country || "",
    legal_info: txt(d?.legal_info) || historique.legalInfo || "",
    fiscal_info: txt(d?.fiscal_info) || historique.fiscalInfo || "",
    admin_info: txt(d?.admin_info) || historique.adminInfo || "",
    dossier_state: txt(d?.dossier_state) || historique.dossierState || "",
    complementary_contacts: txt(d?.complementary_contacts) || historique.complementaryContacts || "",
    notes: historique.notes || notes,
  };
}

/** Délègue au module de règles partagé — aucune validation dupliquée. */
function validerEtab(f: EtabForm): Record<string, string> {
  return {
    ...validerIdentite({ name: f.name, slug: f.slug, email: f.email, phone: f.phone }),
    ...validerCoordonnees({ address: f.address, city: f.city }, false),
  };
}

export function AbonneWorkspace({
  abonne,
  espace,
  setEspace,
  onClose,
  onSaved,
  openEditMode,
}: {
  abonne: AbonneRow;
  espace: Espace;
  setEspace: (e: Espace) => void;
  onClose: () => void;
  onSaved: () => void;
  /** Espace à ouvrir directement en mode édition à l'ouverture de la fiche. */
  openEditMode?: Espace | null;
}) {
  const { success, error: notifyError, warning } = useNotification();
  const [details, setDetails] = useState<Details>({
    establishment: null,
    subscription: null,
    manager: null,
    permissions: [],
    plan_features: [],
    invitations: [],
    audit: [],
  });
  const [chargement, setChargement] = useState(true);
  const [erreurChargement, setErreurChargement] = useState<string | null>(null);

  const [etab, setEtab] = useState<EtabForm>(() => formEtab(null, abonne));
  const [snapshotEtab, setSnapshotEtab] = useState<EtabForm>(() => formEtab(null, abonne));
  const [editEtab, setEditEtab] = useState(false);
  const [erreursEtab, setErreursEtab] = useState<Record<string, string>>({});

  const [manager, setManager] = useState({ full_name: "", login_id: "", phone: "", email: "", is_active: true });
  const [snapshotManager, setSnapshotManager] = useState({ full_name: "", login_id: "", phone: "", email: "", is_active: true });
  const [editManager, setEditManager] = useState(false);
  const [erreursManager, setErreursManager] = useState<Record<string, string>>({});

  const [plan, setPlan] = useState(abonne.plan);
  const [paidMonths, setPaidMonths] = useState(12);
  const [trialDays, setTrialDays] = useState(0);
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [editSub, setEditSub] = useState(false);
  const [traitement, setTraitement] = useState<string | null>(null);

  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [snapshotPermissions, setSnapshotPermissions] = useState<Permission[]>([]);
  const [editPerms, setEditPerms] = useState(false);

  const [canaux, setCanaux] = useState<string[]>(["email"]);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [copieLienEnCours, setCopieLienEnCours] = useState(false);

  /* Ouverture directe en mode édition depuis la liste (bouton "Modifier"). */
  useEffect(() => {
    if (!openEditMode) return;
    if (openEditMode === "etablissement") { setSnapshotEtab(etab); setEditEtab(true); }
    if (openEditMode === "manager") { setSnapshotManager(manager); setEditManager(true); }
    if (openEditMode === "abonnement") { setEditSub(true); }
    if (openEditMode === "modules") { setEditPerms(true); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openEditMode]);
  const [recap, setRecap] = useState<{
    titre: string;
    sousTitre: string;
    lignes: { label: string; valeur: string }[];
    onConfirmer: () => void;
  } | null>(null);

  const charger = useCallback(async () => {
    if (!supabase) {
      setErreurChargement("Supabase non configuré.");
      setChargement(false);
      return;
    }
    setChargement(true);
    setErreurChargement(null);
    const { data, error } = await supabase.rpc("admin_get_abonne_details", { p_id: abonne.id });
    if (error) {
      setErreurChargement(error.message);
      setChargement(false);
      return;
    }
    const d = (data ?? {}) as Details;
    const etabForm = formEtab(d.establishment, abonne);
    const perms = Array.isArray(d.permissions) ? d.permissions : [];
    const m = d.manager ?? {};
    const sub = d.subscription ?? {};
    setDetails(d);
    setEtab(etabForm);
    setSnapshotEtab(etabForm);
    setPermissions(perms);
    setSnapshotPermissions(perms.map((p) => ({ ...p })));
    setManager({
      full_name: txt(m.full_name),
      login_id: txt(m.login_id),
      phone: txt(m.phone),
      email: txt(m.email),
      is_active: m.is_active !== false,
    });
    setSnapshotManager({
      full_name: txt(m.full_name),
      login_id: txt(m.login_id),
      phone: txt(m.phone),
      email: txt(m.email),
      is_active: m.is_active !== false,
    });
    setPlan(txt(d.establishment?.plan ?? abonne.plan));
    setPaidMonths(1);
    setTrialDays(0);
    setStartDate(txt(sub.started_at).slice(0, 10) || new Date().toISOString().slice(0, 10));
    setChargement(false);
  }, [abonne]);

  useEffect(() => {
    void charger();
  }, [charger]);

  const sub = details.subscription ?? {};
  const managerInfo = details.manager;
  const modulesActifs = useMemo(
    () => details.plan_features.filter((f) => f.enabled).length,
    [details.plan_features]
  );
  const statutAbo = txt(sub.status) || (abonne.is_active ? "actif" : "suspendu");

  async function rpc(nom: string, args: Record<string, unknown>): Promise<Enregistrement | null> {
    if (!supabase) return null;
    const { data, error } = await supabase.rpc(nom, args);
    if (error) {
      notifyError({ title: "Opération refusée", message: error.message });
      return null;
    }
    return (data ?? null) as Enregistrement | null;
  }

  /** Lignes du récapitulatif : uniquement les valeurs réellement modifiées. */
  function changements(
    avant: Record<string, string>,
    apres: Record<string, string>,
    libelles: Record<string, string>,
  ): { label: string; valeur: string }[] {
    return Object.keys(libelles)
      .filter((c) => (avant[c] ?? "") !== (apres[c] ?? ""))
      .map((c) => ({
        label: libelles[c],
        valeur: `${avant[c] || "—"} → ${apres[c] || "—"}`,
      }));
  }

  function demanderConfirmation(
    titre: string,
    sousTitre: string,
    lignes: { label: string; valeur: string }[],
    action: () => void,
  ) {
    setRecap({
      titre,
      sousTitre,
      lignes: lignes.length > 0 ? lignes : [{ label: "Aucune valeur modifiée", valeur: "—" }],
      onConfirmer: () => {
        setRecap(null);
        action();
      },
    });
  }

  async function executerEtab() {
    const erreurs = validerEtab(etab);
    setErreursEtab(erreurs);
    if (Object.keys(erreurs).length > 0) {
      warning({ title: "Formulaire invalide", message: "Corrigez les champs signalés." });
      return;
    }
    setTraitement("etab");
    const resultat = await rpc("admin_update_establishment", {
      p_id: abonne.id,
      p_name: etab.name.trim(),
      p_legal_name: etab.legal_name.trim(),
      p_slug: etab.slug.trim(),
      p_activity_type: etab.activity_type.trim(),
      p_address: etab.address.trim(),
      p_city: etab.city.trim(),
      p_region: etab.region.trim(),
      p_phone: etab.phone.trim(),
      p_email: etab.email.trim(),
      p_notes: etab.notes.trim(),
      p_professional_id: etab.professional_id.trim(),
      p_country: etab.country.trim(),
      p_legal_info: etab.legal_info.trim(),
      p_fiscal_info: etab.fiscal_info.trim(),
      p_admin_info: etab.admin_info.trim(),
      p_dossier_state: etab.dossier_state.trim(),
      p_complementary_contacts: etab.complementary_contacts.trim(),
    });
    setTraitement(null);
    if (resultat) {
      success({ title: "Établissement enregistré", message: "Modification journalisée, sans recréation." });
      setEditEtab(false);
      onSaved();
      await charger();
    }
  }

  function enregistrerEtab(e: FormEvent) {
    e.preventDefault();
    const erreurs = validerEtab(etab);
    setErreursEtab(erreurs);
    if (Object.keys(erreurs).length > 0) {
      warning({ title: "Formulaire invalide", message: "Corrigez les champs signalés." });
      return;
    }
    const libelles: Record<string, string> = {
      name: "Nom commercial", legal_name: "Raison sociale", professional_id: "ID professionnel",
      slug: "Slug", activity_type: "Activité", phone: "Téléphone", email: "E-mail",
      address: "Adresse", city: "Ville", region: "Région", country: "Pays",
      legal_info: "Infos juridiques", fiscal_info: "Infos fiscales", admin_info: "Infos administratives",
      dossier_state: "État du dossier", complementary_contacts: "Coordonnées complémentaires", notes: "Notes",
    };
    const avant = Object.fromEntries(
      Object.keys(libelles).map((c) => [c, (snapshotEtab as unknown as Record<string, string>)[c] ?? ""]),
    );
    const apres = Object.fromEntries(
      Object.keys(libelles).map((c) => [c, (etab as unknown as Record<string, string>)[c] ?? ""]),
    );
    demanderConfirmation(
      "Confirmer la modification de l'établissement",
      "Les données sont conservées, le compte n'est pas recréé et l'opération sera journalisée.",
      changements(avant, apres, libelles),
      () => void executerEtab(),
    );
  }

  async function executerManager() {
    const erreurs: Record<string, string> = {};
    if (!manager.full_name.trim()) erreurs.full_name = "Le nom est obligatoire.";
    if (manager.email.trim() && !EMAIL_RE.test(manager.email.trim())) erreurs.email = "E-mail invalide.";
    if (manager.phone.trim() && !PHONE_RE.test(manager.phone.trim())) erreurs.phone = "Téléphone invalide.";
    setErreursManager(erreurs);
    if (Object.keys(erreurs).length > 0) return;
    if (!managerInfo?.id) {
      notifyError({ title: "Manager introuvable", message: "Aucun Manager rattaché à cet établissement." });
      return;
    }
    setTraitement("manager");
    const resultat = await rpc("admin_update_manager", {
      p_profile_id: managerInfo.id,
      p_full_name: manager.full_name.trim(),
      p_login_id: manager.login_id.trim(),
      p_phone: manager.phone.trim(),
      p_is_active: manager.is_active,
      p_email: manager.email.trim() || null,
    });
    setTraitement(null);
    if (resultat) {
      success({
        title: "Manager enregistré",
        message: vrai(resultat.email_changed)
          ? "Profil mis à jour, e-mail Auth modifié, mot de passe intact."
          : "Profil mis à jour sans recréer le compte.",
      });
      setEditManager(false);
      onSaved();
      await charger();
    }
  }

  function enregistrerManager(e: FormEvent) {
    e.preventDefault();
    const erreurs: Record<string, string> = {};
    if (!manager.full_name.trim()) erreurs.full_name = "Le nom est obligatoire.";
    if (manager.email.trim() && !EMAIL_RE.test(manager.email.trim())) erreurs.email = "E-mail invalide.";
    if (manager.phone.trim() && !PHONE_RE.test(manager.phone.trim())) erreurs.phone = "Téléphone invalide.";
    setErreursManager(erreurs);
    if (Object.keys(erreurs).length > 0) return;
    demanderConfirmation(
      "Confirmer la modification du Manager",
      "Le compte existant est conservé : aucun mot de passe n'est réécrit.",
      changements(
        Object.fromEntries(Object.entries(snapshotManager).map(([k, v]) => [k, String(v)])),
        Object.fromEntries(Object.entries(manager).map(([k, v]) => [k, String(v)])),
        { full_name: "Nom et prénom", login_id: "Identifiant de connexion", email: "E-mail", phone: "Téléphone", is_active: "Compte actif" },
      ).map((l) => ({ label: l.label, valeur: l.valeur.replace(/^true$/, "Actif").replace(/^false$/, "Inactif") })),
      () => void executerManager(),
    );
  }

  async function executerAbonnement() {
    if (paidMonths < 1 || paidMonths > 120) {
      warning({ title: "Durée invalide", message: "La durée payante doit être comprise entre 1 et 120 mois." });
      return;
    }
    if (trialDays < 0 || trialDays > 365) {
      warning({ title: "Essai invalide", message: "L'essai doit être compris entre 0 et 365 jours." });
      return;
    }
    setTraitement("abonnement");
    const resultat = await rpc("admin_set_subscription", {
      p_establishment_id: abonne.id,
      p_plan: plan,
      p_paid_months: paidMonths,
      p_trial_days: trialDays,
      p_start_date: startDate,
    });
    setTraitement(null);
    if (resultat) {
      success({
        title: "Abonnement enregistré",
        message: `Échéance au ${dateFrCourte(txt(resultat.current_period_end))} — essai indépendant de la durée payante.`,
      });
      setEditSub(false);
      onSaved();
      await charger();
    }
  }

  function enregistrerAbonnement(e: FormEvent) {
    e.preventDefault();
    if (paidMonths < 1 || paidMonths > 120 || trialDays < 0 || trialDays > 365) {
      warning({ title: "Durées invalides", message: "Vérifiez la durée payante (1–120 mois) et l'essai (0–365 jours)." });
      return;
    }
    const echeances = calculerEcheances(startDate, paidMonths, trialDays);
    demanderConfirmation(
      "Confirmer la modification de l'abonnement",
      "L'essai reste indépendant de la durée payante. Les dates sont recalculées côté serveur et journalisées.",
      [
        { label: "Formule", valeur: plan.toUpperCase() },
        { label: "Début", valeur: echeances.startDate },
        { label: "Durée payante", valeur: `${paidMonths} mois` },
        { label: "Période d'essai", valeur: trialDays > 0 ? `${trialDays} jours` : "Aucun essai" },
        { label: "Échéance calculée", valeur: echeances.paidEndDate },
        { label: "Fin d'essai", valeur: echeances.trialEndDate ?? "—" },
      ],
      () => void executerAbonnement(),
    );
  }

  async function actionCycle(nom: "admin_set_establishment_status" | "admin_renew_subscription", args: Record<string, unknown>, message: string) {
    setTraitement(nom);
    const resultat = await rpc(nom, args);
    setTraitement(null);
    if (resultat !== null) {
      success({ title: "Cycle de vie mis à jour", message });
      onSaved();
      await charger();
    }
  }

  async function executerPermissions() {
    const interdites = permissions.filter((p) => !details.plan_features.some((f) => f.feature_key === p.module && f.enabled));
    if (interdites.length > 0) {
      warning({ title: "Permissions non autorisées", message: `Modules hors formule : ${interdites.map((p) => p.module).join(", ")}.` });
      return;
    }
    setTraitement("permissions");
    const resultat = await rpc("admin_set_permissions", {
      p_establishment_id: abonne.id,
      p_role: "manager",
      p_permissions: permissions,
    });
    setTraitement(null);
    if (resultat) {
      success({ title: "Droits appliqués", message: `${vrai(resultat.ok) ? permissions.length : 0} module(s) enregistrés et journalisés.` });
      setEditPerms(false);
      await charger();
    }
  }

  function enregistrerPermissions(e: FormEvent) {
    e.preventDefault();
    const interdites = permissions.filter((p) => !details.plan_features.some((f) => f.feature_key === p.module && f.enabled));
    if (interdites.length > 0) {
      warning({ title: "Permissions non autorisées", message: `Modules hors formule : ${interdites.map((p) => p.module).join(", ")}.` });
      return;
    }
    const avantCarte = new Map(snapshotPermissions.map((p) => [p.module, p]));
    const lignes = permissions
      .filter((p) => {
        const a = avantCarte.get(p.module);
        return !a || a.can_view !== p.can_view || a.can_create !== p.can_create || a.can_edit !== p.can_edit || a.can_delete !== p.can_delete;
      })
      .map((p) => ({
        label: p.module,
        valeur: ["can_view", "can_create", "can_edit", "can_delete"]
          .filter((c) => p[c as keyof Permission] === true)
          .map((c) => c.replace("can_", ""))
          .join(" + ") || "aucun droit",
      }));
    demanderConfirmation(
      "Confirmer la modification des droits",
      "Les droits sont appliqués par le backend et vérifiés contre la formule avant enregistrement.",
      lignes.length > 0 ? lignes : [{ label: "Aucun droit modifié", valeur: "—" }],
      () => void executerPermissions(),
    );
  }

  function basculePermission(module: string, cle: keyof Omit<Permission, "module">) {
    setPermissions((p) => p.map((x) => (x.module === module ? { ...x, [cle]: !x[cle] } : x)));
  }

  async function relancer(invitationId: string) {
    if (!supabase) return;
    if (canaux.length === 0) {
      warning({ title: "Canal requis", message: "Sélectionnez WhatsApp, e-mail ou les deux." });
      return;
    }
    setEnvoiEnCours(true);
    const requestId = crypto.randomUUID();
    const { data, error } = await supabase.functions.invoke("send-invitation", {
      body: { invitationId, channels: canaux, requestId },
    });
    setEnvoiEnCours(false);
    if (error) {
      const c = classerErreur(error);
      let detail = c.message;
      try {
        const ctx = (error as { context?: { json?: () => Promise<unknown> } }).context;
        const corps = (await ctx?.json?.()) as { error?: string } | undefined;
        if (corps?.error) detail = `${c.message} — ${corps.error}`;
      } catch {
        /* corps indisponible : on conserve le message classé du client. */
      }
      const titre =
        c.famille === "autorisation"
          ? "Accès refusé"
          : c.famille === "reseau"
            ? "Réseau indisponible"
            : c.famille === "session"
              ? "Session expirée"
              : "Relance impossible";
      notifyError({ title: titre, message: detail });
      return;
    }
    const reponse = (data ?? {}) as { ok?: boolean; error?: string; delivery?: { channel: string; status: string; providerError?: string }[] };
    if (reponse.ok === false) {
      notifyError({ title: "Relance refusée", message: reponse.error ?? "Erreur inconnue." });
      return;
    }
    const livraisons = reponse.delivery ?? [];
    const nonConfigures = livraisons.filter((l) => l.status === "non_configure");
    const accepts = livraisons.filter((l) => l.status !== "non_configure" && l.status !== "failed");
    if (nonConfigures.length > 0) {
      warning({
        title: "Fournisseur non configuré",
        message: nonConfigures.map((l) => `${l.channel} : ${l.providerError ?? "secret absent"}`).join(" | "),
      });
    }
    if (accepts.length > 0) {
      success({ title: "Statut réel des canaux", message: accepts.map((l) => `${l.channel} : ${l.status}`).join(" · ") });
    }
    await charger();
  }

  /**
   * GV5 §107 — lien d'activation copiable depuis la fiche : le jeton est
   * généré côté serveur, seul son hash est stocké, et il n'est jamais
   * affiché ni journalisé. L'émission invalide le lien précédent.
   */
  async function copierLienActivation(invitationId: string) {
    if (!supabase) return;
    setCopieLienEnCours(true);
    const { data, error } = await supabase.rpc("admin_issue_activation_link", { p_invitation_id: invitationId });
    setCopieLienEnCours(false);
    if (error) {
      notifyError({ title: "Lien indisponible", message: classerErreur(error).message });
      return;
    }
    const chemin = (data as { url?: unknown } | null)?.url;
    if (typeof chemin !== "string" || !/^\/activer\/[#?]token=/.test(chemin)) {
      notifyError({ title: "Lien invalide", message: "Le serveur n'a pas renvoyé de lien exploitable." });
      return;
    }
    await navigator.clipboard.writeText(new URL(chemin, window.location.origin).href);
    success({
      title: "Lien d'activation copié",
      message: "Usage unique, expiration 7 jours. Le jeton n'est ni affiché ni journalisé.",
    });
    await charger();
  }

  async function revoquer(invitationId: string) {
    if (!window.confirm("Révoquer ce lien d'invitation ? L'invitation est conservée dans l'historique.")) return;
    const resultat = await rpc("admin_revoke_invitation", { p_invitation_id: invitationId });
    if (resultat) {
      success({ title: "Lien révoqué", message: "Le lien n'est plus utilisable ; l'invitation reste journalisée." });
      await charger();
    }
  }

  const statutManager = !managerInfo
    ? "Aucun Manager"
    : managerInfo.is_active === false
      ? "Compte désactivé"
      : vrai(managerInfo.must_change_password)
        ? "En attente d'activation"
        : "Actif";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`Fiche de ${abonne.name}`}
    >
      <div className="sa3d-root sa3d-panel flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden">
        {/* En-tête */}
        <div className="sa3d-hero flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="sa3d-surtitre">AUTO DYALI · Fiche abonné professionnel</p>
            <h2 className="sa3d-titre truncate">{abonne.name}</h2>
            <p className="mt-1 text-xs text-[#a9bdb1]">
              {txt(details.establishment?.professional_id ?? abonne.professional_id) || abonne.slug}
              {" · inscrit le "}
              {dateFrCourte(abonne.created_at)}
            </p>
          </div>
          <button type="button" onClick={onClose} className="sa3d-btn sa3d-btn-fantome shrink-0 px-3" aria-label="Fermer la fiche">
            ✕ <span className="hidden sm:inline">Fermer</span>
          </button>
        </div>

        {/* KPI à profondeur 3D */}
        <div className="grid grid-cols-2 gap-2 px-4 pt-4 lg:grid-cols-4">
          <div className="sa3d-kpi">
            <p className="text-[0.62rem] uppercase tracking-widest text-[#a9bdb1]">Abonnement</p>
            <p className="sa3d-kpi-valeur mt-1 text-sm font-extrabold capitalize">{statutAbo}</p>
          </div>
          <div className="sa3d-kpi">
            <p className="text-[0.62rem] uppercase tracking-widest text-[#a9bdb1]">Échéance</p>
            <p className="sa3d-kpi-valeur mt-1 text-sm font-extrabold">{dateFrCourte(txt(sub.current_period_end))}</p>
          </div>
          <div className="sa3d-kpi">
            <p className="text-[0.62rem] uppercase tracking-widest text-[#a9bdb1]">Manager</p>
            <p className="sa3d-kpi-valeur mt-1 text-sm font-extrabold">{statutManager}</p>
          </div>
          <div className="sa3d-kpi">
            <p className="text-[0.62rem] uppercase tracking-widest text-[#a9bdb1]">Modules formule</p>
            <p className="sa3d-kpi-valeur mt-1 text-sm font-extrabold">{modulesActifs}</p>
          </div>
        </div>

        {/* Navigation des cinq espaces */}
        <div className="px-4 pt-3">
          <nav className="sa3d-tabs" role="tablist" aria-label="Espaces de la fiche abonné">
            {ESPACES.map((e) => (
              <button
                key={e.key}
                type="button"
                role="tab"
                className="sa3d-tab"
                aria-selected={espace === e.key}
                onClick={() => setEspace(e.key)}
              >
                <span aria-hidden>{e.icone}</span>
                {e.label}
              </button>
            ))}
          </nav>
        </div>

        {erreurChargement && (
          <div className="mx-4 mt-3 sa3d-alert sa3d-alert--erreur">{erreurChargement}</div>
        )}

        {/* Contenu */}
        <div className="sa3d-scroll mt-3 flex-1 px-4 pb-5">
          {chargement ? (
            <div className="flex items-center gap-2 py-10 text-sm text-[#a9bdb1]">
              <span className="sa3d-spinner" aria-hidden /> Chargement de la fiche…
            </div>
          ) : (
            <>
              {/* ESPACE 1 — ÉTABLISSEMENT */}
              {espace === "etablissement" && (
                <form onSubmit={enregistrerEtab} noValidate className="grid gap-3">
                  <Section3D numero="01" titre="Identité" sousTitre="Identifiants professionnels et activité">
                    <div className="sa3d-grid">
                      <Champ3D label="Nom commercial" value={etab.name} onChange={(v) => setEtab({ ...etab, name: v })} disabled={!editEtab} obligatoire erreur={erreursEtab.name} />
                      <Champ3D label="Raison sociale" value={etab.legal_name} onChange={(v) => setEtab({ ...etab, legal_name: v })} disabled={!editEtab} />
                      <Champ3D label="Identifiant professionnel" value={etab.professional_id} onChange={(v) => setEtab({ ...etab, professional_id: v.toUpperCase() })} disabled={!editEtab} placeholder="ADY-PRO-XXXXXX" />
                      <Champ3D label="Slug" value={etab.slug} onChange={(v) => setEtab({ ...etab, slug: v.toLowerCase() })} disabled={!editEtab} obligatoire erreur={erreursEtab.slug} />
                      <Champ3D label="Type d'activité" value={etab.activity_type} onChange={(v) => setEtab({ ...etab, activity_type: v })} disabled={!editEtab} />
                      <div>
                        <span className="sa3d-label">Statut de l'établissement</span>
                        <div className="flex flex-wrap items-center gap-2">
                          <Pastille ton={abonne.is_active ? "ok" : "stop"} texte={abonne.is_active ? "Actif" : "Suspendu"} />
                          {abonne.archived_at && <Pastille ton="attente" texte="Archivé" />}
                        </div>
                      </div>
                    </div>
                  </Section3D>

                  <Section3D numero="02" titre="Coordonnées" sousTitre="Contact professionnel et localisation">
                    <div className="sa3d-grid">
                      <Champ3D label="Téléphone" value={etab.phone} onChange={(v) => setEtab({ ...etab, phone: v })} disabled={!editEtab} erreur={erreursEtab.phone} />
                      <Champ3D label="E-mail professionnel" value={etab.email} onChange={(v) => setEtab({ ...etab, email: v })} disabled={!editEtab} erreur={erreursEtab.email} type="email" />
                      <Champ3D label="Adresse" value={etab.address} onChange={(v) => setEtab({ ...etab, address: v })} disabled={!editEtab} plein />
                      <ChampGeographieMaroc
                        ville={etab.city}
                        region={etab.region}
                        country={etab.country}
                        disabled={!editEtab}
                        onChange={(champ, valeur) => setEtab({ ...etab, [champ]: valeur })}
                        erreur={erreursEtab.city || erreursEtab.region || erreursEtab.country}
                      />
                    </div>
                  </Section3D>

                  <Section3D numero="03" titre="Informations administratives" sousTitre="Champs dédiés — aucune donnée structurée dans Notes">
                    <div className="sa3d-grid">
                      <Champ3D label="Informations juridiques" value={etab.legal_info} onChange={(v) => setEtab({ ...etab, legal_info: v })} disabled={!editEtab} />
                      <Champ3D label="Informations fiscales" value={etab.fiscal_info} onChange={(v) => setEtab({ ...etab, fiscal_info: v })} disabled={!editEtab} />
                      <Champ3D label="État du dossier" value={etab.dossier_state} onChange={(v) => setEtab({ ...etab, dossier_state: v })} disabled={!editEtab} />
                      <Champ3D label="Coordonnées complémentaires" value={etab.complementary_contacts} onChange={(v) => setEtab({ ...etab, complementary_contacts: v })} disabled={!editEtab} />
                      <Zone3D label="Informations administratives" value={etab.admin_info} onChange={(v) => setEtab({ ...etab, admin_info: v })} disabled={!editEtab} plein />
                      <Zone3D label="Notes internes" value={etab.notes} onChange={(v) => setEtab({ ...etab, notes: v })} disabled={!editEtab} plein />
                    </div>
                  </Section3D>

                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {traitement === "etab" && <span className="sa3d-sauvegarde"><span className="sa3d-spinner" /> Enregistrement…</span>}
                    {!editEtab ? (
                      <button type="button" className="sa3d-btn" onClick={() => { setSnapshotEtab(etab); setEditEtab(true); }}>
                        Modifier l'établissement
                      </button>
                    ) : (
                      <>
                        <button type="button" className="sa3d-btn sa3d-btn-fantome" onClick={() => { setEtab(snapshotEtab); setErreursEtab({}); setEditEtab(false); }}>
                          Annuler
                        </button>
                        <button type="submit" className="sa3d-btn sa3d-btn-vert" disabled={traitement === "etab"}>
                          Enregistrer
                        </button>
                      </>
                    )}
                  </div>
                </form>
              )}

              {/* ESPACE 2 — MANAGER */}
              {espace === "manager" && (
                <form onSubmit={enregistrerManager} className="grid gap-3">
                  {!managerInfo ? (
                    <div className="sa3d-alert">Aucun Manager associé à cet établissement. La création d'un Manager se fait depuis le parcours « Nouvel abonné ».</div>
                  ) : (
                    <>
                      <Section3D numero="01" titre="Compte Manager" sousTitre="Identité et accès — le compte n'est jamais recréé">
                        <div className="sa3d-grid">
                          <Champ3D label="Nom et prénom" value={manager.full_name} onChange={(v) => setManager({ ...manager, full_name: v })} disabled={!editManager} obligatoire erreur={erreursManager.full_name} />
                          <Champ3D label="Identifiant de connexion" value={manager.login_id} onChange={(v) => setManager({ ...manager, login_id: v.toLowerCase() })} disabled={!editManager} />
                          <Champ3D label="E-mail" value={manager.email} onChange={(v) => setManager({ ...manager, email: v })} disabled={!editManager} erreur={erreursManager.email} type="email" />
                          <Champ3D label="Téléphone" value={manager.phone} onChange={(v) => setManager({ ...manager, phone: v })} disabled={!editManager} erreur={erreursManager.phone} />
                          <div>
                            <span className="sa3d-label">Statut du compte</span>
                            <div className="flex flex-wrap gap-2">
                              <Pastille ton={manager.is_active ? "ok" : "stop"} texte={manager.is_active ? "Actif" : "Désactivé"} />
                              <Pastille ton={vrai(managerInfo.must_change_password) ? "attente" : "ok"} texte={vrai(managerInfo.must_change_password) ? "Activation en attente" : "Activé"} />
                            </div>
                          </div>
                          <label className="flex items-center gap-2 self-end pb-2">
                            <input type="checkbox" className="h-4 w-4 accent-[#d8bd86]" checked={manager.is_active} disabled={!editManager} onChange={(e) => setManager({ ...manager, is_active: e.target.checked })} />
                            <span className="sa3d-label mb-0">Compte actif</span>
                          </label>
                        </div>
                      </Section3D>
                      <Section3D numero="02" titre="Suivi du compte" sousTitre="Horodatages réels — aucun secret n'est affiché">
                        <Ligne label="Créé le" valeur={dateFrCourte(txt(managerInfo.created_at))} />
                        <Ligne label="Dernière activité" valeur={managerInfo.last_activity ? dateFrCourte(managerInfo.last_activity) : "—"} />
                        <Ligne label="Mot de passe défini le" valeur={managerInfo.password_changed_at ? dateFrCourte(txt(managerInfo.password_changed_at)) : "Non (activation en attente)"} />
                        <Ligne label="Récupération d'accès" valeur={
                          <button type="button" className="text-[#d8bd86] underline" onClick={() => setEspace("invitations")}>
                            Relancer l'invitation depuis la fiche
                          </button>
                        } />
                      </Section3D>
                      <div className="flex flex-wrap justify-end gap-2">
                        {!editManager ? (
                          <button type="button" className="sa3d-btn" onClick={() => { setSnapshotManager(manager); setEditManager(true); }}>Modifier le Manager</button>
                        ) : (
                          <>
                            <button type="button" className="sa3d-btn sa3d-btn-fantome" onClick={() => { setManager(snapshotManager); setErreursManager({}); setEditManager(false); }}>Annuler</button>
                            <button type="submit" className="sa3d-btn sa3d-btn-vert" disabled={traitement === "manager"}>Enregistrer</button>
                          </>
                        )}
                      </div>
                    </>
                  )}
                </form>
              )}

              {/* ESPACE 3 — ABONNEMENT */}
              {espace === "abonnement" && (
                <form onSubmit={enregistrerAbonnement} className="grid gap-3">
                  <Section3D numero="01" titre="Formule et durées" sousTitre="L'essai est indépendant : il ne réduit jamais la durée payante">
                    <div className="sa3d-grid">
                      <label>
                        <span className="sa3d-label">Formule</span>
                        <select className="sa3d-champ" value={plan} disabled={!editSub} onChange={(e) => setPlan(e.target.value)} aria-label="Formule">
                          {["standard", "silver", "gold"].map((p) => <option key={p} value={p}>{p.toUpperCase()}</option>)}
                        </select>
                      </label>
                      <label>
                        <span className="sa3d-label">Date de début</span>
                        <input type="date" className="sa3d-champ" value={startDate} disabled={!editSub} onChange={(e) => setStartDate(e.target.value)} aria-label="Date de début" />
                      </label>
                      <label>
                        <span className="sa3d-label">Durée payante (mois)</span>
                        <input type="number" min={1} max={120} className="sa3d-champ" value={paidMonths} disabled={!editSub} onChange={(e) => setPaidMonths(Number(e.target.value))} aria-label="Durée payante en mois" />
                      </label>
                      <label>
                        <span className="sa3d-label">Période d'essai (jours)</span>
                        <input type="number" min={0} max={365} className="sa3d-champ" value={trialDays} disabled={!editSub} onChange={(e) => setTrialDays(Number(e.target.value))} aria-label="Période d'essai en jours" />
                      </label>
                      <div className="sa3d-plein flex flex-wrap gap-2">
                        {DUREES_PAYANTES.map((m) => (
                          <button key={m.valeur} type="button" className="sa3d-btn sa3d-btn-fantome" disabled={!editSub} onClick={() => setPaidMonths(m.valeur)}>
                            {m.libelle}
                          </button>
                        ))}
                        {DUREES_ESSAI.map((j) => (
                          <button key={j} type="button" className="sa3d-btn sa3d-btn-fantome" disabled={!editSub} onClick={() => setTrialDays(j)}>
                            {j === 0 ? "Aucun essai" : `${j} j`}
                          </button>
                        ))}
                      </div>
                    </div>
                  </Section3D>
                  <Section3D numero="02" titre="État réel" sousTitre="Valeurs calculées et enregistrées côté serveur">
                    <Ligne label="Statut" valeur={<Pastille ton={statutAbo === "active" || statutAbo === "trial" ? "ok" : "attente"} texte={statutAbo} />} />
                    <Ligne label="Début" valeur={dateFrCourte(txt(sub.started_at))} />
                    <Ligne label="Fin d'essai" valeur={dateFrCourte(txt(sub.trial_ends_at))} />
                    <Ligne label="Échéance payante" valeur={dateFrCourte(txt(sub.current_period_end))} />
                    {editSub && (
                      <Ligne
                        label="Aperçu (avant enregistrement)"
                        valeur={`échéance ${dateFrCourte(calculerEcheances(startDate, paidMonths, trialDays).paidEndDate)} · essai ${trialDays > 0 ? dateFrCourte(calculerEcheances(startDate, paidMonths, trialDays).trialEndDate) : "aucun"}`}
                      />
                    )}
                  </Section3D>
                  <div className="flex flex-wrap justify-end gap-2">
                    {!editSub ? (
                      <>
                        <button type="button" className="sa3d-btn sa3d-btn-fantome" disabled={traitement !== null} onClick={() => void actionCycle("admin_set_establishment_status", { p_establishment_id: abonne.id, p_active: !abonne.is_active }, abonne.is_active ? "Établissement suspendu, données conservées." : "Établissement réactivé.")}>
                          {abonne.is_active ? "Suspendre" : "Réactiver"}
                        </button>
                        <button type="button" className="sa3d-btn sa3d-btn-fantome" disabled={traitement !== null} onClick={() => void actionCycle("admin_renew_subscription", { p_establishment_id: abonne.id, p_months: 12 }, "Abonnement renouvelé de 12 mois.")}>
                          Renouveler 12 mois
                        </button>
                        <button type="button" className="sa3d-btn" onClick={() => setEditSub(true)}>Modifier l'abonnement</button>
                      </>
                    ) : (
                      <>
                        <button type="button" className="sa3d-btn sa3d-btn-fantome" onClick={() => { setEditSub(false); void charger(); }}>Annuler</button>
                        <button type="submit" className="sa3d-btn sa3d-btn-vert" disabled={traitement === "abonnement"}>Enregistrer</button>
                      </>
                    )}
                  </div>
                  <p className="text-xs text-[#a9bdb1]">
                    <Link href="/super-admin/abonnements/" className="underline">Gérer les formules et les prix</Link>
                  </p>
                </form>
              )}

              {/* ESPACE 4 — MODULES & PERMISSIONS */}
              {espace === "modules" && (
                <form onSubmit={enregistrerPermissions} className="grid gap-3">
                  <Section3D numero="01" titre="Modules compris dans la formule" sousTitre="Lectures seules : l'activation est gérée au niveau du forfait">
                    <div className="flex flex-wrap gap-2">
                      {details.plan_features.length === 0 && <span className="text-xs text-[#a9bdb1]">Aucune fonction référencée.</span>}
                      {details.plan_features.map((f) => (
                        <Pastille key={f.feature_key} ton={f.enabled ? "ok" : "neutre"} texte={f.feature_key} />
                      ))}
                    </div>
                  </Section3D>
                  <Section3D
                    numero="02"
                    titre="Permissions du Manager"
                    sousTitre="Refusées par le backend si le module n'est pas prévu par la formule"
                    action={<Pastille ton={editPerms ? "attente" : "neutre"} texte={editPerms ? "Édition" : "Lecture"} />}
                  >
                    <div className="space-y-2">
                      {permissions.length === 0 && <p className="text-xs text-[#a9bdb1]">Aucune permission enregistrée.</p>}
                      {permissions.map((p) => (
                        <div key={p.module} className="sa3d-ligne flex-wrap">
                          <span className="font-semibold">{p.module}</span>
                          <span className="flex flex-wrap gap-3">
                            {(["can_view", "can_create", "can_edit", "can_delete"] as const).map((cle) => (
                              <label key={cle} className="flex items-center gap-1 text-[0.7rem]">
                                <input
                                  type="checkbox"
                                  className="h-3.5 w-3.5 accent-[#d8bd86]"
                                  checked={p[cle]}
                                  disabled={!editPerms}
                                  onChange={() => basculePermission(p.module, cle)}
                                  aria-label={`${cle} pour ${p.module}`}
                                />
                                {cle.replace("can_", "")}
                              </label>
                            ))}
                          </span>
                        </div>
                      ))}
                    </div>
                  </Section3D>
                  <div className="flex flex-wrap justify-end gap-2">
                    {!editPerms ? (
                      <button type="button" className="sa3d-btn" onClick={() => { setSnapshotPermissions(permissions.map((p) => ({ ...p }))); setEditPerms(true); }}>Modifier les droits</button>
                    ) : (
                      <>
                        <button type="button" className="sa3d-btn sa3d-btn-fantome" onClick={() => { setPermissions(snapshotPermissions.map((p) => ({ ...p }))); setEditPerms(false); }}>Annuler</button>
                        <button type="submit" className="sa3d-btn sa3d-btn-vert" disabled={traitement === "permissions"}>Enregistrer les droits</button>
                      </>
                    )}
                  </div>
                </form>
              )}

              {/* ESPACE 5 — INVITATIONS & HISTORIQUE */}
              {espace === "invitations" && (
                <div className="grid gap-3">
                  <Section3D numero="01" titre="Remise des accès au Manager" sousTitre="Choix du canal — aucun envoi simulé si le fournisseur n'est pas configuré">
                    <div className="flex flex-wrap gap-2">
                      {[
                        { cle: "whatsapp", label: "WhatsApp" },
                        { cle: "email", label: "E-mail" },
                      ].map((c) => (
                        <label key={c.cle} className="flex items-center gap-2 rounded-lg border border-[#d8bd86]/25 px-3 py-2">
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-[#d8bd86]"
                            checked={canaux.includes(c.cle)}
                            onChange={(e) => setCanaux((v) => (e.target.checked ? [...new Set([...v, c.cle])] : v.filter((x) => x !== c.cle)))}
                          />
                          <span className="text-xs text-[#eef2ec]">{c.label}</span>
                        </label>
                      ))}
                      <button type="button" className="sa3d-btn sa3d-btn-fantome" onClick={() => setCanaux(["whatsapp", "email"])}>Les deux</button>
                    </div>
                    <p className="mt-2 text-[0.7rem] text-[#a9bdb1]">
                      Lien unique à usage unique, expiration 7 jours, hash du jeton uniquement. Le Manager choisit son mot de passe lors de l'activation.
                    </p>
                  </Section3D>

                  <Section3D numero="02" titre="Invitations enregistrées" sousTitre="Statuts indépendants WhatsApp / e-mail">
                    {details.invitations.length === 0 && <p className="text-xs text-[#a9bdb1]">Aucune invitation pour cet établissement.</p>}
                    <div className="space-y-2">
                      {details.invitations.map((i) => {
                        const id = txt(i.id);
                        const statut = txt(i.status);
                        return (
                          <div key={id} className="sa3d-panel rounded-xl p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-mono text-xs text-[#f0dcae]">{txt(i.email)}</span>
                              <Pastille ton={statut === "accepted" ? "ok" : statut === "cancelled" ? "stop" : "attente"} texte={statut || "—"} />
                            </div>
                            <div className="mt-2 grid gap-1 text-[0.72rem] text-[#a9bdb1] sm:grid-cols-2">
                              <span>E-mail : {txt(i.email_status) || "—"}</span>
                              <span>WhatsApp : {txt(i.whatsapp_status) || "—"}</span>
                              <span>Créée le : {dateFrCourte(txt(i.created_at))}</span>
                              <span>Expire le : {dateFrCourte(txt(i.expires_at))}</span>
                              {txt(i.last_error) && <span className="sa3d-plein text-[#e59b96]">Erreur : {txt(i.last_error)}</span>}
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <button type="button" className="sa3d-btn sa3d-btn-vert" disabled={envoiEnCours || statut === "accepted"} onClick={() => void relancer(id)}>
                                {envoiEnCours ? "…" : statut === "cancelled" ? "Renouveler" : "Envoyer / Renvoyer"}
                              </button>
                              <button type="button" className="sa3d-btn" disabled={copieLienEnCours || statut === "accepted" || statut === "cancelled"} onClick={() => void copierLienActivation(id)} title="Émet un nouveau lien et le copie (ancien lien invalidé)">
                                {copieLienEnCours ? "…" : "Copier le lien d'activation"}
                              </button>
                              <button type="button" className="sa3d-btn sa3d-btn-danger" disabled={statut === "accepted" || statut === "cancelled"} onClick={() => void revoquer(id)}>
                                Révoquer le lien
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Section3D>

                  <Section3D numero="03" titre="Journal d'audit" sousTitre="30 dernières opérations journalisées">
                    {details.audit.length === 0 && <p className="text-xs text-[#a9bdb1]">Aucune opération journalisée.</p>}
                    <div className="space-y-1">
                      {details.audit.map((a) => (
                        <Ligne key={txt(a.id)} label={`${txt(a.action)} · ${txt(a.entity)}`} valeur={dateFrCourte(txt(a.created_at))} />
                      ))}
                    </div>
                    <p className="mt-2 text-xs">
                      <Link href="/super-admin/audit/" className="text-[#d8bd86] underline">Ouvrir le journal complet</Link>
                    </p>
                  </Section3D>
                </div>
              )}
            </>
          )}
        </div>

        {/* Récapitulatif explicite avant toute modification définitive */}
        {recap && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
            <div className="w-full max-w-lg">
              <Recapitulatif3D
                titre={recap.titre}
                sousTitre={recap.sousTitre}
                lignes={recap.lignes}
                onConfirmer={recap.onConfirmer}
                onAnnuler={() => setRecap(null)}
                confirmLabel="Confirmer et enregistrer"
                chargement={traitement !== null}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
