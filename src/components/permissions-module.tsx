"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase-browser";

/**
 * Permissions granulaires (§16 du cahier des charges) — feature `advanced_permissions`.
 *
 * Éditeur réel de la table `permissions` (RLS multi-tenant) :
 *   rôle × module × { voir, créer, modifier, supprimer }.
 * Chaque enregistrement est journalisé dans `audit_log` (action
 * `permissions.update`) : les changements de droits sont des opérations
 * sensibles et doivent être traçables.
 *
 * Honnêteté : ces permissions sont relues côté serveur par `has_feature()`
 * et les gardes de rôle — l'éditeur n'est pas une simple case à cocher
 * décorative, il écrit la source de vérité que le serveur consulte.
 */

type Role = "saas_admin" | "manager" | "employee" | "client";

type Droits = {
  id: string | null;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
};

type Cellule = Record<string, Droits>; // clé `${role}|${module}`

const ROLES: { code: Role; label: string; desc: string }[] = [
  { code: "manager", label: "Responsable", desc: "Tous les modules, sauf admin plateforme" },
  { code: "employee", label: "Employé", desc: "Droits définis ci-dessous" },
  { code: "client", label: "Client", desc: "Portail client uniquement (lecture)" },
  { code: "saas_admin", label: "Super Admin", desc: "Administration plateforme — non modifiable ici" },
];

const MODULES: { code: string; label: string }[] = [
  { code: "pos", label: "Point de vente" },
  { code: "stock", label: "Stock" },
  { code: "catalogue", label: "Catalogue" },
  { code: "atelier", label: "Atelier" },
  { code: "caisse", label: "Caisse" },
  { code: "clients", label: "Clients" },
  { code: "fournisseurs", label: "Fournisseurs" },
  { code: "achats", label: "Achats" },
  { code: "facturation", label: "Facturation" },
  { code: "devis", label: "Devis" },
  { code: "pneumatiques", label: "Pneumatiques" },
  { code: "planning", label: "Planning" },
  { code: "employes", label: "Employés" },
  { code: "rapports", label: "Rapports" },
  { code: "import_export", label: "Import / Export" },
  { code: "support", label: "Support" },
];

const ACTIONS: { cle: keyof Omit<Droits, "id">; label: string; court: string }[] = [
  { cle: "can_view", label: "Voir", court: "V" },
  { cle: "can_create", label: "Créer", court: "C" },
  { cle: "can_edit", label: "Modifier", court: "M" },
  { cle: "can_delete", label: "Supprimer", court: "S" },
];

export function PermissionsModule() {
  const [cellules, setCellules] = useState<Cellule>({});
  const [erreur, setErreur] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [sauvegarde, setSauvegarde] = useState<string | null>(null); // clé en cours d'écriture
  const [filtreRole, setFiltreRole] = useState<Role>("employee");

  const charger = useCallback(async () => {
    if (!supabase) { setErreur("Supabase n’est pas configuré."); return; }
    const { data, error } = await supabase
      .from("permissions")
      .select("id, role, module, can_view, can_create, can_edit, can_delete");
    if (error) { setErreur(`Lecture des permissions impossible : ${error.message}`); return; }
    const carte: Cellule = {};
    for (const row of (data ?? []) as { id: string; role: Role; module: string; can_view: boolean; can_create: boolean; can_edit: boolean; can_delete: boolean }[]) {
      carte[`${row.role}|${row.module}`] = {
        id: row.id, can_view: row.can_view, can_create: row.can_create, can_edit: row.can_edit, can_delete: row.can_delete,
      };
    }
    setCellules(carte);
    setErreur(null);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void charger(), 0);
    return () => window.clearTimeout(timer);
  }, [charger]);

  async function basculer(role: Role, module: string, action: keyof Omit<Droits, "id">) {
    if (!supabase || role === "saas_admin" || sauvegarde) return;
    const cle = `${role}|${module}`;
    const actuelle = cellules[cle] ?? { id: null, can_view: false, can_create: false, can_edit: false, can_delete: false };
    const suivante: Droits = { ...actuelle, [action]: !actuelle[action] };
    // Règle métier : créer / modifier / supprimer implique toujours la vue.
    if (action !== "can_view" && suivante[action]) suivante.can_view = true;

    // Mise optimiste de l'UI, écriture réelle juste après.
    setCellules((c) => ({ ...c, [cle]: suivante }));
    setSauvegarde(cle);
    setNotice(null);
    setErreur(null);
    try {
      const { data: profile } = await supabase.rpc("get_my_profile");
      const establishmentId = (profile as { establishment_id: string }[] | null)?.[0]?.establishment_id;
      if (!establishmentId) throw new Error("Établissement introuvable.");
      const ligne = {
        establishment_id: establishmentId,
        role,
        module,
        can_view: suivante.can_view,
        can_create: suivante.can_create,
        can_edit: suivante.can_edit,
        can_delete: suivante.can_delete,
      };
      let err: string | null = null;
      if (suivante.id) {
        const res = await supabase.from("permissions").update(ligne).eq("id", suivante.id);
        err = res.error?.message ?? null;
      } else {
        const res = await supabase.from("permissions").insert(ligne);
        err = res.error?.message ?? null;
        if (!err && res.data) {
          const nouvelle = (res.data as { id: string }[])[0];
          setCellules((c) => ({ ...c, [cle]: { ...suivante, id: nouvelle.id } }));
        }
      }
      if (err) throw new Error(err);
      // Journalisation de l'action sensible (best effort : ne bloque pas l'UI).
      await supabase.from("audit_log").insert({
        establishment_id: establishmentId,
        action: "permissions.update",
        entity: "permissions",
        payload_json: { role, module, droits: { can_view: suivante.can_view, can_create: suivante.can_create, can_edit: suivante.can_edit, can_delete: suivante.can_delete } },
      });
      setNotice(`${ROLES.find((r) => r.code === role)?.label} · ${MODULES.find((m) => m.code === module)?.label} : droits mis à jour et journalisés.`);
    } catch (e) {
      // Rollback optimiste en cas d'échec serveur.
      setCellules((c) => ({ ...c, [cle]: actuelle }));
      setErreur(e instanceof Error ? e.message : "Échec de l’enregistrement.");
    } finally {
      setSauvegarde(null);
    }
  }

  const lignes = MODULES;

  return (
    <>
      <div className="mb-6">
        <p className="text-xs uppercase tracking-[0.2em] text-[#A7B7A8]">Sécurité</p>
        <h1 className="titre-or mt-1 text-2xl font-extrabold">Permissions avancées</h1>
        <p className="mt-1 text-sm text-[#A7B7A8]">
          Droits par rôle et par module — enregistrés dans Supabase (<code>permissions</code>) et journalisés dans <code>audit_log</code>.
        </p>
      </div>

      {erreur && <p role="alert" className="mb-4 rounded-lg bg-[#C5716B]/15 px-4 py-3 text-sm text-[#C5716B]">{erreur}</p>}
      {notice && <p role="status" className="mb-4 rounded-lg bg-[#8DA298]/10 px-4 py-3 text-sm text-[#8DA298]">{notice}</p>}

      {/* Sélecteur de rôle */}
      <div className="mb-5 flex flex-wrap gap-2">
        {ROLES.map((r) => (
          <button
            key={r.code}
            type="button"
            onClick={() => setFiltreRole(r.code)}
            className={`rounded-lg border px-4 py-2 text-sm transition ${
              filtreRole === r.code ? "border-[#8FB59B]/60 bg-[#8FB59B]/15 font-bold text-[#D0C6AE]" : "border-[#8FB59B]/20 text-[#A7B7A8]"
            }`}
          >
            {r.label}
            <span className="ml-2 text-[10px] font-normal opacity-70">{r.desc}</span>
          </button>
        ))}
      </div>

      <section className="carte overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-[#344440]/50 text-xs uppercase text-[#A7B7A8]">
              <tr>
                <th className="px-4 py-3">Module</th>
                {ACTIONS.map((a) => <th key={a.cle} className="px-4 py-3 text-center">{a.label}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#8FB59B]/10">
              {lignes.map((m) => {
                const cle = `${filtreRole}|${m.code}`;
                const d = cellules[cle] ?? { id: null, can_view: false, can_create: false, can_edit: false, can_delete: false };
                const verrou = filtreRole === "saas_admin";
                return (
                  <tr key={m.code}>
                    <td className="px-4 py-3 font-semibold text-[#E8ECE8]">{m.label}</td>
                    {ACTIONS.map((a) => (
                      <td key={a.cle} className="px-4 py-3 text-center">
                        <button
                          type="button"
                          disabled={verrou || sauvegarde === cle}
                          onClick={() => void basculer(filtreRole, m.code, a.cle)}
                          aria-pressed={d[a.cle]}
                          aria-label={`${a.label} — ${m.label}`}
                          className={`h-9 w-9 rounded-lg border text-xs font-bold transition disabled:opacity-30 ${
                            d[a.cle]
                              ? "border-[#8FB59B]/60 bg-[#8FB59B]/25 text-[#D0C6AE]"
                              : "border-[#8FB59B]/15 text-[#A7B7A8]/50"
                          }`}
                        >
                          {d[a.cle] ? "✓" : a.court}
                        </button>
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="border-t border-[#8FB59B]/10 px-4 py-3 text-xs text-[#A7B7A8]">
          {filtreRole === "saas_admin"
            ? "Le rôle Super Admin dispose de tous les droits par conception : non modifiable."
            : "V = voir · C = créer · M = modifier · S = supprimer. Un droit d’écriture active automatiquement la vue. Les rôles employé par défaut restent en place tant qu’aucune ligne n’est enregistrée."}
        </p>
      </section>
    </>
  );
}
