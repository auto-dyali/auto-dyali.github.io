"use client";

/**
 * AUTO DYALI — Super Admin › Sauvegarde & export
 * Exports CSV réels des données métier. Les sauvegardes complets
 * (Point-in-Time Recovery) restent du ressort de Supabase — cet
 * écran ne peut pas les déclencher sans accès privilégié.
 */

import { useState } from "react";
import { supabase } from "@/lib/supabase-browser";
import { ModulePage } from "@/components/super-admin-module-page";
import { ModuleHeader, Erreur } from "@/components/super-admin-page";
import { downloadCsv } from "@/lib/csv-export";

export default function SauvegardePage() {
  const [enCours, setEnCours] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function exporter(quoi: "entreprises" | "abonnements" | "audit" | "plans") {
    if (!supabase) return;
    setEnCours(quoi);
    setErreur(null);
    setNotice(null);
    try {
      if (quoi === "entreprises") {
        const { data, error } = await supabase.from("establishments").select("name, slug, city, phone, email, plan, is_active, created_at").order("created_at", { ascending: false });
        if (error) throw new Error(error.message);
        downloadCsv(`auto-dyali-entreprises-${new Date().toISOString().slice(0, 10)}.csv`, ["Nom", "Slug", "Ville", "Téléphone", "Email", "Forfait", "État", "Créé le"], (data ?? []).map((r) => [r.name, r.slug, r.city, r.phone, r.email, String(r.plan).toUpperCase(), r.is_active ? "Actif" : "Suspendu", new Date(r.created_at).toLocaleString("fr-FR")]));
      } else if (quoi === "abonnements") {
        const { data, error } = await supabase.from("subscriptions").select("establishment_id, plan_code, status, started_at, trial_ends_at, current_period_end").order("created_at", { ascending: false });
        if (error) throw new Error(error.message);
        downloadCsv(`auto-dyali-abonnements-${new Date().toISOString().slice(0, 10)}.csv`, ["Entreprise ID", "Forfait", "Statut", "Début", "Fin essai", "Échéance"], (data ?? []).map((r) => [r.establishment_id, String(r.plan_code).toUpperCase(), r.status, new Date(r.started_at).toLocaleString("fr-FR"), r.trial_ends_at ? new Date(r.trial_ends_at).toLocaleString("fr-FR") : "", r.current_period_end ? new Date(r.current_period_end).toLocaleString("fr-FR") : ""]));
      } else if (quoi === "audit") {
        const { data, error } = await supabase.from("audit_log").select("created_at, action, entity, entity_id").order("created_at", { ascending: false }).limit(5000);
        if (error) throw new Error(error.message);
        downloadCsv(`auto-dyali-audit-${new Date().toISOString().slice(0, 10)}.csv`, ["Date", "Action", "Entité", "ID"], (data ?? []).map((r) => [new Date(r.created_at).toLocaleString("fr-FR"), r.action, r.entity, r.entity_id ?? ""]));
      } else {
        const [p, f] = await Promise.all([
          supabase.from("plans").select("code, label, price_monthly, trial_days, max_users, max_sites, storage_mb"),
          supabase.from("plan_features").select("plan_code, feature_key, enabled"),
        ]);
        if (p.error) throw new Error(p.error.message);
        if (f.error) throw new Error(f.error.message);
        downloadCsv(`auto-dyali-plans-${new Date().toISOString().slice(0, 10)}.csv`, ["Forfait", "Libellé", "Prix mensuel", "Essai", "Utilisateurs max", "Sites max", "Stockage Mo"], (p.data ?? []).map((r) => [r.code, r.label, r.price_monthly ?? "", r.trial_days, r.max_users, r.max_sites, r.storage_mb]));
      }
      setNotice("Export terminé.");
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Export impossible.");
    } finally {
      setEnCours(null);
    }
  }

  const boutons = [
    { cle: "entreprises", label: "Exporter les entreprises (CSV)", description: "Établissements, forfaits, états — instantané courant." },
    { cle: "abonnements", label: "Exporter les abonnements (CSV)", description: "Cycle de vie complet des abonnements." },
    { cle: "audit", label: "Exporter le journal d’audit (CSV)", description: "5000 dernières entrées, sans secrets." },
    { cle: "plans", label: "Exporter plans & entitlements (CSV)", description: "Forfaits, prix, limites et durées d’essai." },
  ] as const;

  return (
    <ModulePage titre="Sauvegarde & export">
      <ModuleHeader
        surtitre="AUTO DYALI · Continuité d’activité"
        titre="Sauvegarde & export"
        description="Exports CSV instantanés des données métier. Les sauvegardes complètes restent du ressort de Supabase (PITR / backups planifiés)."
      />

      {notice && <p role="status" className="mt-4 rounded-lg bg-[#5D9E7F]/10 px-4 py-3 text-sm text-[#7FBF9E]">{notice}</p>}
      {erreur && <div className="mt-4"><Erreur message={erreur} /></div>}

      <section className="mt-6 grid gap-4 sm:grid-cols-2">
        {boutons.map((b) => (
          <article key={b.cle} className="carte-premium flex flex-col justify-between gap-3 p-5">
            <div>
              <h2 className="font-bold">{b.label}</h2>
              <p className="mt-1 text-xs text-[#A7B7A8]">{b.description}</p>
            </div>
            <button type="button" onClick={() => void exporter(b.cle)} disabled={enCours !== null} className="rounded-xl border border-[#8FB59B]/25 px-4 py-2 text-sm text-[#E8ECE8] hover:bg-[#344440] disabled:opacity-40">{enCours === b.cle ? "Export…" : "Télécharger"}</button>
          </article>
        ))}
      </section>

      <div className="carte-premium mt-6 p-5">
        <h2 className="font-bold">Sauvegardes complètes (Supabase)</h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-[#A7B7A8]">
          <li>Les backups complets (PITR, planifiés) sont gérés dans le tableau de bord Supabase — non modifiables depuis l’application.</li>
          <li>Les migrations SQL sont versionnées dans <code>supabase/migrations/</code> (0001 → 0028) ; la migration 0028 reste PRÉCÉDENTÉE et NON APPLIQUÉE.</li>
          <li>Toute suppression ciblée exige : export, contrôle des clés étrangères, autorisation explicite.</li>
          <li>Établissement partagé (<code>00000000-0000-0000-0000-000000000001</code>) et abonnement partagé (<code>47b1c71e-cf73-46a5-b0a4-b3f4ac762e22</code>) : ne jamais supprimer.</li>
        </ul>
      </div>
    </ModulePage>
  );
}
