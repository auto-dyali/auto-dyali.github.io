"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase-browser";

/**
 * Compléments achats (§12) : retours fournisseurs & factures fournisseurs.
 *
 * Tables `supplier_returns` / `supplier_return_items` / `supplier_invoices`
 * (migration 0020). Si la migration n'est pas encore appliquée, les modules
 * l'affichent honnêtement au lieu de planter.
 *
 * Retour fournisseur : sortie de stock tracée (`stock_movements` direction
 * `out`) + décrément `products.stock` — jamais de suppression de ligne.
 */

type Retour = {
  id: string;
  reference: string;
  supplier_id: string | null;
  reason: string;
  total_amount: number;
  status: string;
  created_at: string;
  suppliers?: { name: string } | null;
};

type Facture = {
  id: string;
  number: string;
  supplier_id: string | null;
  invoice_date: string;
  due_date: string | null;
  total: number;
  paid_amount: number;
  status: string;
  suppliers?: { name: string } | null;
};

type Produit = { id: string; name: string; sku: string; stock: number };

const STATUTS_RETOUR: Record<string, { label: string; classe: string }> = {
  en_attente: { label: "En attente", classe: "bg-[#3ECF6A]/15 text-[#DFE7E2]" },
  expedie: { label: "Expédié", classe: "bg-[#8DA298]/20 text-[#8DA298]" },
  rembourse: { label: "Remboursé", classe: "bg-[#8DA298]/25 text-[#DFE7E2]" },
  annule: { label: "Annulé", classe: "bg-[#344440] text-[#A7B7A8]" },
};

const STATUTS_FACTURE: Record<string, { label: string; classe: string }> = {
  a_payer: { label: "À payer", classe: "bg-[#C5716B]/15 text-[#C5716B]" },
  partiellement_payee: { label: "Partielle", classe: "bg-[#3ECF6A]/15 text-[#DFE7E2]" },
  payee: { label: "Payée", classe: "bg-[#8DA298]/20 text-[#DFE7E2]" },
  contestee: { label: "Contestée", classe: "bg-[#C79A6B]/20 text-[#C79A6B]" },
  annulee: { label: "Annulée", classe: "bg-[#344440] text-[#A7B7A8]" },
};

const money = (v: unknown) => `${Number(v ?? 0).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MAD`;
const date = (v: string | null | undefined) => (v ? new Date(v).toLocaleDateString("fr-FR") : "—");
const migrationManquante = (m: string) => m.includes("does not exist") || m.includes("relation");

export function AchatsComplementsModule() {
  const [retours, setRetours] = useState<Retour[]>([]);
  const [factures, setFactures] = useState<Facture[]>([]);
  const [fournisseurs, setFournisseurs] = useState<{ id: string; name: string }[]>([]);
  const [produits, setProduits] = useState<Produit[]>([]);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [infoMigration, setInfoMigration] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Formulaire retour
  const [formRetour, setFormRetour] = useState({ supplier_id: "", reason: "", product_id: "", quantite: "", prix: "" });
  // Formulaire facture
  const [formFacture, setFormFacture] = useState({ supplier_id: "", number: "", invoice_date: "", due_date: "", total: "" });
  const [saving, setSaving] = useState(false);

  const charger = useCallback(async () => {
    if (!supabase) { setErreur("Supabase n’est pas configuré."); setLoading(false); return; }
    const [retoursRes, facturesRes, foursRes, prodsRes] = await Promise.all([
      supabase.from("supplier_returns").select("*, suppliers(name)").order("created_at", { ascending: false }).limit(100),
      supabase.from("supplier_invoices").select("*, suppliers(name)").order("invoice_date", { ascending: false }).limit(100),
      supabase.from("suppliers").select("id, name").order("name"),
      supabase.from("products").select("id, name, sku, stock").eq("is_active", true).order("name").limit(500),
    ]);
    if (migrationManquante(retoursRes.error?.message ?? "") || migrationManquante(facturesRes.error?.message ?? "")) {
      setInfoMigration("Tables retours/factures fournisseurs absentes : appliquez la migration 0020 dans le SQL Editor Supabase (script fourni).");
    } else if (retoursRes.error ?? facturesRes.error) {
      setErreur((retoursRes.error ?? facturesRes.error)?.message ?? "Lecture impossible.");
    } else {
      setRetours((retoursRes.data ?? []) as unknown as Retour[]);
      setFactures((facturesRes.data ?? []) as unknown as Facture[]);
      setErreur(null);
    }
    if (!foursRes.error) setFournisseurs((foursRes.data ?? []) as { id: string; name: string }[]);
    if (!prodsRes.error) setProduits((prodsRes.data ?? []) as unknown as Produit[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void charger(), 0);
    return () => window.clearTimeout(timer);
  }, [charger]);

  async function profilEtablissement(): Promise<string> {
    const { data } = await supabase!.rpc("get_my_profile");
    const id = (data as { establishment_id: string }[] | null)?.[0]?.establishment_id;
    if (!id) throw new Error("Établissement introuvable.");
    return id;
  }

  /* ---------------------------------------------------------------
   * Retour fournisseur : ligne + sortie de stock tracée
   * --------------------------------------------------------------- */
  async function creerRetour(event: FormEvent) {
    event.preventDefault();
    if (!supabase || saving) return;
    setSaving(true); setErreur(null); setNotice(null);
    try {
      const establishmentId = await profilEtablissement();
      const produit = produits.find((p) => p.id === formRetour.product_id);
      if (!produit) throw new Error("Produit introuvable.");
      const quantite = Number(formRetour.quantite);
      if (!(quantite > 0)) throw new Error("Quantité invalide.");
      const { data: sessionData } = await supabase.auth.getSession();

      const reference = `RET-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;
      const { data: retour, error: errRetour } = await supabase.from("supplier_returns").insert({
        establishment_id: establishmentId,
        supplier_id: formRetour.supplier_id || null,
        reference,
        reason: formRetour.reason.trim() || "Retour fournisseur",
        total_amount: quantite * Number(formRetour.prix || 0),
        status: "en_attente",
        created_by: sessionData.session?.user.id ?? null,
      }).select("id").single();
      if (errRetour) throw new Error(errRetour.message);

      const { error: errLigne } = await supabase.from("supplier_return_items").insert({
        establishment_id: establishmentId,
        return_id: retour.id,
        product_id: produit.id,
        label: `${produit.name} (${produit.sku})`,
        quantity: quantite,
        unit_price: Number(formRetour.prix || 0),
      });
      if (errLigne) throw new Error(errLigne.message);

      // Sortie de stock tracée + décrément (jamais de suppression).
      const { error: errMove } = await supabase.from("stock_movements").insert({
        establishment_id: establishmentId,
        product_id: produit.id,
        direction: "out",
        quantity: quantite,
        reference,
        actor_id: sessionData.session?.user.id ?? null,
      });
      if (errMove) throw new Error(errMove.message);
      const { data: prod } = await supabase.from("products").select("stock").eq("id", produit.id).single();
      if (prod) await supabase.from("products").update({ stock: Math.max(0, Number(prod.stock) - quantite) }).eq("id", produit.id);

      setNotice(`Retour ${reference} créé — ${quantite} × ${produit.name} sortis du stock (tracés).`);
      setFormRetour({ supplier_id: "", reason: "", product_id: "", quantite: "", prix: "" });
      await charger();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Création impossible.");
    } finally {
      setSaving(false);
    }
  }

  /* ---------------------------------------------------------------
   * Facture fournisseur
   * --------------------------------------------------------------- */
  async function creerFacture(event: FormEvent) {
    event.preventDefault();
    if (!supabase || saving) return;
    setSaving(true); setErreur(null); setNotice(null);
    try {
      const establishmentId = await profilEtablissement();
      const total = Number(formFacture.total);
      if (!(total > 0)) throw new Error("Montant invalide.");
      const { data: sessionData } = await supabase.auth.getSession();
      const { error } = await supabase.from("supplier_invoices").insert({
        establishment_id: establishmentId,
        supplier_id: formFacture.supplier_id || null,
        number: formFacture.number.trim(),
        invoice_date: formFacture.invoice_date || new Date().toISOString().slice(0, 10),
        due_date: formFacture.due_date || null,
        total,
        status: "a_payer",
        created_by: sessionData.session?.user.id ?? null,
      });
      if (error) throw new Error(error.message);
      setNotice(`Facture ${formFacture.number} enregistrée (à payer).`);
      setFormFacture({ supplier_id: "", number: "", invoice_date: "", due_date: "", total: "" });
      await charger();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  }

  async function majStatutFacture(f: Facture, statut: string) {
    if (!supabase) return;
    const paiement = statut === "payee" ? Number(f.total) : statut === "partiellement_payee" ? Math.min(Number(f.paid_amount), Number(f.total)) : Number(f.paid_amount);
    const { error } = await supabase.from("supplier_invoices")
      .update({ status: statut, paid_amount: statut === "payee" ? Number(f.total) : paiement })
      .eq("id", f.id);
    if (error) setErreur(error.message);
    else { setNotice(`Facture ${f.number} → ${STATUTS_FACTURE[statut]?.label ?? statut}.`); await charger(); }
  }

  return (
    <>
      {erreur && <p role="alert" className="mb-4 rounded-lg bg-[#C5716B]/15 px-4 py-3 text-sm text-[#C5716B]">{erreur}</p>}
      {infoMigration && <p role="status" className="mb-4 rounded-lg bg-[#3ECF6A]/15 px-4 py-3 text-sm text-[#DFE7E2]">{infoMigration}</p>}
      {notice && <p role="status" className="mb-4 rounded-lg bg-[#8DA298]/10 px-4 py-3 text-sm text-[#8DA298]">{notice}</p>}

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Retours */}
        <section className="carte p-5">
          <h2 className="font-bold text-[#E8ECE8]">Retour fournisseur (sortie de stock tracée)</h2>
          <form onSubmit={creerRetour} className="mt-4 grid gap-3">
            <select required className="champ min-h-11" value={formRetour.supplier_id} onChange={(e) => setFormRetour({ ...formRetour, supplier_id: e.target.value })}>
              <option value="">Fournisseur (optionnel)…</option>
              {fournisseurs.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
            <select required className="champ min-h-11" value={formRetour.product_id} onChange={(e) => {
              const p = produits.find((x) => x.id === e.target.value);
              setFormRetour({ ...formRetour, product_id: e.target.value, prix: p ? "" : formRetour.prix });
            }}>
              <option value="">Produit à retourner…</option>
              {produits.map((p) => <option key={p.id} value={p.id}>{p.name} — stock {p.stock}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-3">
              <input required min="1" step="1" type="number" className="champ min-h-11" placeholder="Quantité" value={formRetour.quantite} onChange={(e) => setFormRetour({ ...formRetour, quantite: e.target.value })} />
              <input min="0" step="0.01" type="number" className="champ min-h-11" placeholder="Prix unitaire" value={formRetour.prix} onChange={(e) => setFormRetour({ ...formRetour, prix: e.target.value })} />
            </div>
            <input className="champ min-h-11" placeholder="Motif (défaut : Retour fournisseur)" value={formRetour.reason} onChange={(e) => setFormRetour({ ...formRetour, reason: e.target.value })} />
            <button type="submit" disabled={saving} className="btn-or min-h-11 text-sm">{saving ? "Enregistrement…" : "Créer le retour"}</button>
          </form>

          <ul className="mt-4 max-h-64 divide-y divide-[#3ECF6A]/10 overflow-y-auto">
            {retours.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 py-3 text-sm">
                <div>
                  <p className="font-semibold text-[#E8ECE8]">{r.reference}</p>
                  <p className="text-xs text-[#A7B7A8]">{r.suppliers?.name ?? "—"} · {r.reason} · {date(r.created_at)}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-[#DFE7E2]">{money(r.total_amount)}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] ${STATUTS_RETOUR[r.status]?.classe ?? ""}`}>{STATUTS_RETOUR[r.status]?.label ?? r.status}</span>
                </div>
              </li>
            ))}
          </ul>
          {!loading && !retours.length && !infoMigration && <p className="py-6 text-center text-sm text-[#A7B7A8]">Aucun retour enregistré.</p>}
        </section>

        {/* Factures */}
        <section className="carte p-5">
          <h2 className="font-bold text-[#E8ECE8]">Factures fournisseurs</h2>
          <form onSubmit={creerFacture} className="mt-4 grid gap-3">
            <select required className="champ min-h-11" value={formFacture.supplier_id} onChange={(e) => setFormFacture({ ...formFacture, supplier_id: e.target.value })}>
              <option value="">Fournisseur…</option>
              {fournisseurs.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-3">
              <input required className="champ min-h-11" placeholder="N° de facture" value={formFacture.number} onChange={(e) => setFormFacture({ ...formFacture, number: e.target.value })} />
              <input required min="0.01" step="0.01" type="number" className="champ min-h-11" placeholder="Montant total" value={formFacture.total} onChange={(e) => setFormFacture({ ...formFacture, total: e.target.value })} />
              <label className="text-xs text-[#A7B7A8]">Date<input type="date" className="champ mt-1 min-h-11" value={formFacture.invoice_date} onChange={(e) => setFormFacture({ ...formFacture, invoice_date: e.target.value })} /></label>
              <label className="text-xs text-[#3ECF6A]">Échéance<input type="date" className="champ mt-1 min-h-11" value={formFacture.due_date} onChange={(e) => setFormFacture({ ...formFacture, due_date: e.target.value })} /></label>
            </div>
            <button type="submit" disabled={saving} className="btn-or min-h-11 text-sm">{saving ? "Enregistrement…" : "Enregistrer la facture"}</button>
          </form>

          <ul className="mt-4 max-h-64 divide-y divide-[#3ECF6A]/10 overflow-y-auto">
            {factures.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <div>
                  <p className="font-semibold text-[#E8ECE8]">{f.number} · {f.suppliers?.name ?? "—"}</p>
                  <p className="text-xs text-[#A7B7A8]">émise le {date(f.invoice_date)}{f.due_date ? ` · échéance ${date(f.due_date)}` : " · échéance non renseignée"} · payé {money(f.paid_amount)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[#DFE7E2]">{money(f.total)}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] ${STATUTS_FACTURE[f.status]?.classe ?? ""}`}>{STATUTS_FACTURE[f.status]?.label ?? f.status}</span>
                  {f.status !== "payee" && f.status !== "annulee" && (
                    <button type="button" onClick={() => void majStatutFacture(f, "payee")} className="rounded-lg border border-[#3ECF6A]/30 px-2 py-1 text-[11px] text-[#DFE7E2]">Marquer payée</button>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {!loading && !factures.length && !infoMigration && <p className="py-6 text-center text-sm text-[#A7B7A8]">Aucune facture fournisseur.</p>}
        </section>
      </div>

      <p className="mt-4 text-[11px] text-[#A7B7A8]">
        Aucune ligne n’est supprimée : un retour crée un mouvement de stock <code>out</code> tracé, une facture se marque payée.
        Échéances affichées uniquement si renseignées.
      </p>
    </>
  );
}
