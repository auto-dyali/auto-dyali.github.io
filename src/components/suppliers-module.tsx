"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase-browser";
import { formatMad } from "@/lib/catalogue-test";

/**
 * Fournisseurs — §5 du cahier des charges.
 * - Liste réelle avec solde dû (balance_due).
 * - Fiche détaillée : commandes d'achat (purchase_orders), statuts, montants.
 * - Réception d’une commande qui incrémente réellement le stock.
 */

type Fournisseur = {
  id: string;
  name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  balance_due: number;
};

type Commande = {
  id: string;
  reference: string;
  status: string;
  ordered_at: string;
  expected_at: string | null;
  received_at: string | null;
  total_amount: number;
  paid_amount: number;
};

const STATUTS_PO: Record<string, { label: string; classe: string }> = {
  draft: { label: "Brouillon", classe: "bg-[#344440] text-[#DFE7E2]" },
  ordered: { label: "Commandée", classe: "bg-[#8FB59B]/15 text-[#DFE7E2]" },
  partial: { label: "Réception partielle", classe: "bg-[#8FB59B]/20 text-[#DFE7E2]" },
  received: { label: "Reçue", classe: "bg-[#5D9E7F]/15 text-[#7FBF9E]" },
  cancelled: { label: "Annulée", classe: "bg-[#C5716B]/15 text-[#C5716B]" },
};

export function FournisseursModule() {
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [recherche, setRecherche] = useState("");
  const [ouvert, setOuvert] = useState(false);
  const [form, setForm] = useState({ name: "", contact: "", phone: "", email: "", notes: "" });

  const [selection, setSelection] = useState<Fournisseur | null>(null);
  const [commandes, setCommandes] = useState<Commande[]>([]);
  const [chargementFiche, setChargementFiche] = useState(false);
  const [traitement, setTraitement] = useState<string | null>(null);

  async function charger() {
    if (!supabase) {
      setError("Supabase n’est pas configuré.");
      setLoading(false);
      return;
    }
    const { data, error: queryError } = await supabase
      .from("suppliers")
      .select("id, name, contact_name, phone, email, notes, balance_due")
      .order("name");
    if (queryError && !queryError.message.includes("does not exist")) setError(queryError.message);
    else setFournisseurs((data ?? []) as Fournisseur[]);
    setLoading(false);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void charger(), 0);
    return () => window.clearTimeout(timer);
    // Rechargement initial unique.
  }, []);

  const filtres = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    if (!q) return fournisseurs;
    return fournisseurs.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        (f.contact_name ?? "").toLowerCase().includes(q) ||
        (f.phone ?? "").includes(q) ||
        (f.email ?? "").toLowerCase().includes(q),
    );
  }, [fournisseurs, recherche]);

  const totalDettes = fournisseurs.reduce((s, f) => s + Number(f.balance_due ?? 0), 0);

  async function ouvrirFiche(fournisseur: Fournisseur) {
    if (!supabase) return;
    setSelection(fournisseur);
    setChargementFiche(true);
    setCommandes([]);
    const { data, error: reqError } = await supabase
      .from("purchase_orders")
      .select("id, reference, status, ordered_at, expected_at, received_at, total_amount, paid_amount")
      .eq("supplier_id", fournisseur.id)
      .order("ordered_at", { ascending: false })
      .limit(30);
    if (!reqError) setCommandes((data ?? []) as Commande[]);
    setChargementFiche(false);
  }

  async function recevoirCommande(commande: Commande) {
    if (!supabase || !selection) return;
    setTraitement(commande.id);
    setError(null);
    try {
      const { data: profileRows } = await supabase.rpc("get_my_profile");
      const establishmentId = profileRows?.[0]?.establishment_id;
      if (!establishmentId) throw new Error("Établissement introuvable.");
      const { data: sessionData } = await supabase.auth.getSession();

      // Articles de la commande → réception + mise à jour du stock
      const { data: items, error: itemsError } = await supabase
        .from("purchase_order_items")
        .select("id, product_id, quantity, received_quantity")
        .eq("purchase_order_id", commande.id);
      if (itemsError) throw new Error(itemsError.message);

      let totalRecu = 0;
      for (const item of (items ?? []) as { id: string; product_id: string | null; quantity: number; received_quantity: number }[]) {
        const reste = Math.max(0, Number(item.quantity) - Number(item.received_quantity));
        if (reste <= 0) continue;
        totalRecu += reste;
        await supabase
          .from("purchase_order_items")
          .update({ received_quantity: Number(item.quantity) })
          .eq("id", item.id);
        if (item.product_id) {
          await supabase.from("stock_movements").insert({
            establishment_id: establishmentId,
            product_id: item.product_id,
            direction: "in",
            quantity: reste,
            reference: commande.reference,
            actor_id: sessionData.session?.user.id ?? null,
          });
          const { data: produit } = await supabase.from("products").select("stock").eq("id", item.product_id).single();
          if (produit) {
            await supabase.from("products").update({ stock: Number(produit.stock) + reste }).eq("id", item.product_id);
          }
        }
      }

      const { error: majError } = await supabase
        .from("purchase_orders")
        .update({ status: "received", received_at: new Date().toISOString() })
        .eq("id", commande.id);
      if (majError) throw new Error(majError.message);

      setNotice(
        totalRecu > 0
          ? `Commande ${commande.reference} reçue — ${totalRecu} unité(s) ajoutées au stock.`
          : `Commande ${commande.reference} marquée reçue (aucun article en attente).`,
      );
      await ouvrirFiche(selection);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Réception impossible.");
    } finally {
      setTraitement(null);
    }
  }

  async function creerFournisseur(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    setSaving(true);
    setError(null);
    try {
      const { data: profileRows } = await supabase.rpc("get_my_profile");
      const establishmentId = profileRows?.[0]?.establishment_id;
      if (!establishmentId) throw new Error("Établissement introuvable.");
      const { error: insertError } = await supabase.from("suppliers").insert({
        establishment_id: establishmentId,
        name: form.name.trim(),
        contact_name: form.contact.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        notes: form.notes.trim() || null,
      });
      if (insertError) throw new Error(insertError.message);
      setNotice(`Fournisseur « ${form.name.trim()} » créé.`);
      setOuvert(false);
      setForm({ name: "", contact: "", phone: "", email: "", notes: "" });
      await charger();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Création impossible.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-6">
      {/* KPI réels */}
      <div className="grid gap-4 sm:grid-cols-3">
        <article className="carte p-5">
          <p className="text-xs text-[#A7B7A8]">Fournisseurs</p>
          <p className="titre-or mt-1 text-2xl font-extrabold">{loading ? "…" : fournisseurs.length}</p>
        </article>
        <article className="carte p-5">
          <p className="text-xs text-[#A7B7A8]">Dettes fournisseurs</p>
          <p className="titre-or mt-1 text-2xl font-extrabold">{loading ? "…" : formatMad(totalDettes)}</p>
        </article>
        <article className="carte p-5">
          <p className="text-xs text-[#A7B7A8]">Commandes en attente</p>
          <p className="titre-or mt-1 text-2xl font-extrabold">
            {loading ? "…" : commandes.filter((c) => c.status === "ordered" || c.status === "partial").length}
          </p>
        </article>
      </div>

      {notice && <p role="status" className="rounded-lg bg-[#5D9E7F]/10 px-4 py-3 text-sm text-[#7FBF9E]">{notice}</p>}
      {error && <p role="alert" className="rounded-lg bg-[#C5716B]/15 px-4 py-3 text-sm text-[#C5716B]">{error}</p>}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[#A7B7A8]">Achats Supabase</p>
          <h1 className="titre-or mt-1 text-2xl font-extrabold">Fournisseurs</h1>
          <p className="mt-1 text-sm text-[#A7B7A8]">Contacts, commandes et dettes du garage.</p>
        </div>
        <button type="button" onClick={() => { setOuvert(true); setError(null); setNotice(null); }} className="btn-or px-5 py-2.5 text-sm">
          + Nouveau fournisseur
        </button>
      </div>

      <section className="carte overflow-hidden">
        <div className="border-b border-[#8FB59B]/10 p-4">
          <input
            type="search"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Rechercher : nom, contact, téléphone…"
            className="champ min-h-11 w-full"
            aria-label="Rechercher un fournisseur"
          />
        </div>

        {loading ? (
          <p className="p-8 text-center text-sm text-[#A7B7A8]">Chargement…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-[#344440]/50 text-xs uppercase text-[#A7B7A8]">
                <tr>
                  <th className="px-5 py-3">Fournisseur</th>
                  <th className="px-5 py-3">Contact</th>
                  <th className="px-5 py-3">Téléphone</th>
                  <th className="px-5 py-3 text-right">Solde dû</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#8FB59B]/10">
                {filtres.map((f) => {
                  const solde = Number(f.balance_due ?? 0);
                  return (
                    <tr key={f.id}>
                      <td className="px-5 py-4 font-semibold text-[#E8ECE8]">{f.name}</td>
                      <td className="px-5 py-4 text-[#A7B7A8]">{f.contact_name ?? "—"}</td>
                      <td className="px-5 py-4 text-[#A7B7A8]">{f.phone ?? "—"}</td>
                      <td className={`px-5 py-4 text-right font-bold ${solde > 0.001 ? "text-[#8FB59B]" : "text-[#5D9E7F]"}`}>
                        {formatMad(solde)}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button type="button" onClick={() => void ouvrirFiche(f)} className="rounded-lg border border-[#8FB59B]/40 px-3 py-1.5 text-xs text-[#DFE7E2]">
                          Ouvrir la fiche
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!filtres.length && (
              <p className="p-8 text-center text-sm text-[#A7B7A8]">Aucun fournisseur — créez le premier avec « + Nouveau fournisseur ».</p>
            )}
          </div>
        )}
      </section>

      {/* Fiche fournisseur */}
      {selection && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-5">
          <div className="carte my-4 w-full max-w-3xl p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[#A7B7A8]">Fiche fournisseur</p>
                <h2 className="titre-or mt-1 text-xl font-extrabold">{selection.name}</h2>
                <p className="mt-1 text-sm text-[#A7B7A8]">
                  {selection.contact_name ?? "Contact —"} · {selection.phone ?? "tél. —"} {selection.email ? `· ${selection.email}` : ""}
                </p>
                {selection.notes && <p className="mt-1 text-xs text-[#A7B7A8]">Notes : {selection.notes}</p>}
              </div>
              <button type="button" onClick={() => setSelection(null)} className="text-2xl text-[#A7B7A8]" aria-label="Fermer">×</button>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#8FB59B]/20 bg-[#344440]/40 p-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.15em] text-[#A7B7A8]">Solde dû</p>
                <p className={`titre-or mt-1 text-2xl font-extrabold ${Number(selection.balance_due) > 0.001 ? "text-[#8FB59B]" : "text-[#5D9E7F]"}`}>
                  {formatMad(Number(selection.balance_due ?? 0))}
                </p>
              </div>
              <p className="text-xs text-[#A7B7A8]">
                {commandes.length} commande(s) au total
              </p>
            </div>

            <p className="mt-5 text-[10px] uppercase tracking-[0.15em] text-[#A7B7A8]">Commandes d’achat</p>
            {chargementFiche ? (
              <p className="py-6 text-center text-sm text-[#A7B7A8]">Chargement…</p>
            ) : (
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="bg-[#344440]/50 text-xs uppercase text-[#A7B7A8]">
                    <tr>
                      <th className="px-4 py-3">Référence</th>
                      <th className="px-4 py-3">Commandée le</th>
                      <th className="px-4 py-3">Statut</th>
                      <th className="px-4 py-3 text-right">Total</th>
                      <th className="px-4 py-3 text-right">Payé</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#8FB59B]/10">
                    {commandes.map((c) => {
                      const info = STATUTS_PO[c.status] ?? STATUTS_PO.draft;
                      return (
                        <tr key={c.id}>
                          <td className="px-4 py-3 font-semibold text-[#DFE7E2]">{c.reference}</td>
                          <td className="px-4 py-3 text-[#A7B7A8]">{new Date(c.ordered_at).toLocaleDateString("fr-FR")}</td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${info.classe}`}>{info.label}</span>
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-[#E8ECE8]">{formatMad(Number(c.total_amount))}</td>
                          <td className="px-4 py-3 text-right text-[#A7B7A8]">{formatMad(Number(c.paid_amount))}</td>
                          <td className="px-4 py-3 text-right">
                            {(c.status === "ordered" || c.status === "partial") && (
                              <button
                                type="button"
                                disabled={traitement === c.id}
                                onClick={() => void recevoirCommande(c)}
                                className="btn-or px-2.5 py-1.5 text-xs disabled:opacity-40"
                              >
                                {traitement === c.id ? "Réception…" : "Réceptionner"}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {!commandes.length && (
                  <p className="p-6 text-center text-sm text-[#A7B7A8]">
                    Aucune commande — créez-en depuis la page Achats.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modale création */}
      {ouvert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-5" role="dialog" aria-modal="true" aria-labelledby="nouveau-four-titre">
          <form onSubmit={(e) => void creerFournisseur(e)} className="carte w-full max-w-md p-6">
            <h2 id="nouveau-four-titre" className="titre-or text-xl font-extrabold">Nouveau fournisseur</h2>
            <div className="mt-5 grid gap-3">
              <input required className="champ" placeholder="Nom du fournisseur" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <input className="champ" placeholder="Contact" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} />
              <input className="champ" type="tel" placeholder="Téléphone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              <input className="champ" type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <textarea className="champ py-2 text-sm" rows={2} placeholder="Notes (facultatif)" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setOuvert(false)} className="rounded-lg px-4 py-2 text-sm text-[#A7B7A8]">Annuler</button>
              <button disabled={saving} type="submit" className="btn-or px-4 py-2 text-sm">{saving ? "Enregistrement…" : "Enregistrer"}</button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
