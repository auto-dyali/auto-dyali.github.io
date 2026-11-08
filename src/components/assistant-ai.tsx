"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase-browser";

/**
 * AUTO DYALI AI — assistant central (§14 du cahier des charges).
 *
 * Principe d'honnêteté :
 * - Aucun LLM distant n'est configuré dans ce projet, on ne simule donc JAMAIS
 *   une génération de texte artificielle. L'assistant est un moteur de requêtes
 *   réelles : chaque réponse est construite à partir de données Supabase lues
 *   au moment de la question (isolation tenant garantie par RLS).
 * - Toute opération d'écriture (stock, financier, suppression, envoi externe)
 *   est refusée côté assistant : elle exige une action humaine dans le module
 *   dédié. L'assistant affiche un lien direct vers le module concerné.
 * - Rôles et forfaits : la page est protégée par ShellApp (feature "ai") et
 *   chaque lecture repasse par les politiques RLS de l'établissement.
 */

type Message = {
  id: number;
  role: "user" | "assistant";
  texte: string;
  lignes?: { gauche: string; droite: string }[];
  lien?: { label: string; href: string };
};

const ACTIONS_RAPIDES = [
  "Factures impayées",
  "Chèques proches de l'échéance",
  "Produits en rupture de stock",
  "Interventions en retard",
  "Résumé de l'activité",
  "Marges pneumatiques",
  "Anomalies",
] as const;

const money = (v: unknown) =>
  `${Number(v ?? 0).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MAD`;

/** Normalise une jointure Supabase (renvoyée en tableau) vers un objet unique. */
function premier<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

const date = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleDateString("fr-FR") : "—";

/** Moteur de requêtes : transforme une question en lecture Supabase réelle. */
async function repondre(question: string): Promise<Omit<Message, "id" | "role">> {
  if (!supabase) {
    return { texte: "Supabase n’est pas configuré : je ne peux lire aucune donnée." };
  }
  const q = question.toLowerCase();

  /* ---------------------------------------------------------- *
   * 1. Factures / ventes impayées
   * ---------------------------------------------------------- */
  if (q.includes("impay") || q.includes("facture") || q.includes("crédit") || q.includes("credit") || q.includes("doit")) {
    const res = await supabase
      .from("sales")
      .select("reference, created_at, total, paid_total, clients(full_name)")
      .in("status", ["open", "partial"])
      .order("created_at", { ascending: false })
      .limit(100);
    if (res.error) {
      return { texte: `Lecture des ventes impossible : ${res.error.message}` };
    }
    const impayees = ((res.data ?? []) as unknown as { reference: string; created_at: string; total: number; paid_total: number; clients: { full_name: string } | null }[])
      .filter((v) => Number(v.total) > Number(v.paid_total));
    const encours = impayees.reduce((s, v) => s + (Number(v.total) - Number(v.paid_total)), 0);
    if (!impayees.length) {
      return { texte: "Aucune facture impayée : toutes les ventes enregistrées sont réglées. 🎯" };
    }
    return {
      texte: `${impayees.length} facture(s) impayée(s) — encours total ${money(encours)}. Cliquez sur une vente pour encaisser un règlement.`,
      lignes: impayees.slice(0, 10).map((v) => ({
        gauche: `${v.reference} · ${premier(v.clients)?.full_name ?? "Client comptant"}`,
        droite: `${money(Number(v.total) - Number(v.paid_total))} (émise le ${date(v.created_at)})`,
      })),
      lien: { label: "Ouvrir l’historique des ventes", href: "/tableau-de-bord/historique-ventes/" },
    };
  }

  /* ---------------------------------------------------------- *
   * 2. Chèques proches de l'échéance
   * ---------------------------------------------------------- */
  if (q.includes("chèque") || q.includes("cheque") || q.includes("échéance") || q.includes("echeance")) {
    const { data, error } = await supabase.rpc("cheques_echeances_proches");
    if (error) {
      return {
        texte: `Module chèques non disponible : ${error.message}. La migration 0019 doit d’abord être appliquée dans le SQL Editor Supabase.`,
        lien: { label: "Ouvrir le module chèques", href: "/tableau-de-bord/cheques/" },
      };
    }
    const lignes = (data ?? []) as { bank: string; number: string; beneficiary: string; amount: number; due_date: string; urgence: string }[];
    if (!lignes.length) {
      return { texte: "Aucun chèque en attente à échéance dans les 7 prochains jours." };
    }
    return {
      texte: `${lignes.length} chèque(s) à surveiller (J-7 et moins). Aucun encaissement automatique : la validation reste humaine.`,
      lignes: lignes.map((c) => ({ gauche: `${c.bank} · ${c.number} · ${c.beneficiary}`, droite: `${money(c.amount)} — ${c.urgence}` })),
      lien: { label: "Ouvrir le module chèques", href: "/tableau-de-bord/cheques/" },
    };
  }

  /* ---------------------------------------------------------- *
   * 3. Ruptures / sous-stock
   * ---------------------------------------------------------- */
  if (q.includes("rupture") || q.includes("stock") || q.includes("manque") || q.includes("réappro") || q.includes("reappro")) {
    const { data, error } = await supabase
      .from("products")
      .select("sku, name, category, min_stock, stock, sale_price")
      .eq("is_active", true)
      .order("stock", { ascending: true })
      .limit(200);
    if (error) return { texte: `Lecture du stock impossible : ${error.message}` };
    const lignesP = (data ?? []) as { sku: string; name: string; min_stock: number; stock: number | null }[];
    const ruptures = lignesP.filter((p) => Number(p.stock ?? 0) <= 0);
    const alerts = lignesP.filter((p) => Number(p.stock ?? 0) > 0 && Number(p.stock ?? 0) <= Number(p.min_stock));
    return {
      texte: `${ruptures.length} produit(s) en rupture, ${alerts.length} sous le stock minimum. Je ne commande rien à votre place : passez par les achats pour valider.`,
      lignes: [...ruptures.slice(0, 6).map((p) => ({ gauche: `${p.sku} · ${p.name}`, droite: "RUPTURE (0 unité)" })),
        ...alerts.slice(0, 6).map((p) => ({ gauche: `${p.sku} · ${p.name}`, droite: `stock ${p.stock} / min ${p.min_stock}` }))],
      lien: { label: "Ouvrir le stock", href: "/tableau-de-bord/stock/" },
    };
  }

  /* ---------------------------------------------------------- *
   * 4. Interventions en retard
   * ---------------------------------------------------------- */
  if (q.includes("retard") || q.includes("intervention") || q.includes("atelier") || q.includes("réparation") || q.includes("reparation")) {
    const { data, error } = await supabase
      .from("work_orders")
      .select("reference, status, due_at, opened_at, total_amount, clients(full_name), vehicles(license_plate)")
      .not("status", "in", '("done","delivered","cancelled")')
      .order("due_at", { ascending: true, nullsFirst: false })
      .limit(100);
    if (error) return { texte: `Lecture des interventions impossible : ${error.message}` };
    const ors = (data ?? []) as unknown as { reference: string; status: string; due_at: string | null; total_amount: number; clients: { full_name: string } | null; vehicles: { license_plate: string } | null }[];
    const maintenant = Date.now();
    const retard = ors.filter((o) => o.due_at && new Date(o.due_at).getTime() < maintenant);
    if (!ors.length) return { texte: "Aucune intervention ouverte : tout est à jour. ✅" };
    return {
      texte: retard.length
        ? `${retard.length} ordre(s) de réparation en retard sur ${ors.length} ouvert(s).`
        : `${ors.length} ordre(s) ouvert(s), aucun en retard.`,
      lignes: ors.slice(0, 10).map((o) => ({
        gauche: `${o.reference} · ${premier(o.clients)?.full_name ?? "—"} · ${premier(o.vehicles)?.license_plate ?? ""}`,
        droite: `${o.due_at ? `échéance ${date(o.due_at)}` : "sans échéance"} · ${money(o.total_amount)}`,
      })),
      lien: { label: "Ouvrir l’atelier", href: "/tableau-de-bord/atelier/" },
    };
  }

  /* ---------------------------------------------------------- *
   * 5. Marges pneumatiques
   * ---------------------------------------------------------- */
  if (q.includes("pneu") && (q.includes("marge") || q.includes("profit") || q.includes("bénéfice") || q.includes("benefice"))) {
    const { data, error } = await supabase
      .from("sale_items")
      .select("quantity, unit_price, products!inner(purchase_price, name, category)")
      .eq("products.category", "pneumatique")
      .limit(500);
    if (error) return { texte: `Lecture des ventes pneus impossible : ${error.message}` };
    const items = (data ?? []) as unknown as { quantity: number; unit_price: number; products: { purchase_price: number; name: string } | { purchase_price: number; name: string }[] | null }[];
    const achat = (i: { products: { purchase_price: number } | { purchase_price: number }[] | null }) => Number(premier(i.products)?.purchase_price ?? 0);
    const ca = items.reduce((s, i) => s + Number(i.quantity) * Number(i.unit_price), 0);
    const cout = items.reduce((s, i) => s + Number(i.quantity) * achat(i), 0);
    const marge = ca - cout;
    if (!items.length) return { texte: "Aucune ligne pneumatique vendue pour l’instant — impossible de calculer une marge." };
    return {
      texte: `Marge pneumatique sur ${items.length} ligne(s) : ${money(marge)} (CA ${money(ca)} − coût d’achat ${money(cout)}) soit ${ca > 0 ? Math.round((marge / ca) * 100) : 0} % .`,
      lien: { label: "Ouvrir les rapports", href: "/tableau-de-bord/rapports/" },
    };
  }

  /* ---------------------------------------------------------- *
   * 6. Chèques (sans échéance) → fallback module
   * ---------------------------------------------------------- */
  if (q.includes("chèq") || q.includes("cheq")) {
    return {
      texte: "Pour les chèques, ouvrez le module dédié (capture, échéances, alertes J-7/J-3/J-1).",
      lien: { label: "Ouvrir le module chèques", href: "/tableau-de-bord/cheques/" },
    };
  }

  /* ---------------------------------------------------------- *
   * 7. Fournisseurs
   * ---------------------------------------------------------- */
  if (q.includes("fournisseur") || q.includes("achats")) {
    const { data, error } = await supabase
      .from("suppliers")
      .select("id, name, contact_name, phone")
      .order("name")
      .limit(50);
    if (error) return { texte: `Lecture des fournisseurs impossible : ${error.message}` };
    const fours = (data ?? []) as { name: string; contact_name: string | null; phone: string | null }[];
    if (!fours.length) return { texte: "Aucun fournisseur enregistré." };
    return {
      texte: `${fours.length} fournisseur(s) au catalogue.`,
      lignes: fours.slice(0, 10).map((f) => ({ gauche: f.name, droite: [f.contact_name, f.phone].filter(Boolean).join(" · ") || "coordonnées non renseignées" })),
      lien: { label: "Ouvrir les fournisseurs", href: "/tableau-de-bord/fournisseurs/" },
    };
  }

  /* ---------------------------------------------------------- *
   * 8. Anomalies (croisement de contrôles)
   * ---------------------------------------------------------- */
  if (q.includes("anomalie") || q.includes("problème") || q.includes("probleme") || q.includes("alerte")) {
    const [ventes, ors, produits] = await Promise.all([
      supabase.from("sales").select("reference, status, total, paid_total").order("created_at", { ascending: false }).limit(100),
      supabase.from("work_orders").select("reference, status").in("status", ["done"]).is("closed_at", null).limit(50),
      supabase.from("products").select("sku, name, stock, min_stock").eq("is_active", true).limit(200),
    ]);
    const constat: string[] = [];
    const ventesData = (ventes.data ?? []) as { reference: string; status: string; total: number; paid_total: number }[];
    const surpayees = ventesData.filter((v) => Number(v.paid_total) > Number(v.total) + 0.01);
    if (surpayees.length) constat.push(`${surpayees.length} vente(s) encaissée(s) au-delà du total (défaut de saisie).`);
    const orsData = (ors.data ?? []) as { reference: string }[];
    if (orsData.length) constat.push(`${orsData.length} ordre(s) marqué(s) terminé(s) sans date de clôture.`);
    const prodData = (produits.data ?? []) as { sku: string; name: string; stock: number | null }[];
    const negatifs = prodData.filter((p) => Number(p.stock ?? 0) < 0);
    if (negatifs.length) constat.push(`${negatifs.length} stock(s) négatif(s) : mouvement à corriger.`);
    if (!constat.length) return { texte: "Aucune anomalie détectée sur les 100 dernières ventes, les ordres terminés et les stocks. ✅" };
    return {
      texte: `${constat.length} anomalie(s) détectée(s) :`,
      lignes: constat.map((c) => ({ gauche: c, droite: "vérification manuelle requise" })),
      lien: { label: "Ouvrir les rapports", href: "/tableau-de-bord/rapports/" },
    };
  }

  /* ---------------------------------------------------------- *
   * 9. Résumé d'activité
   * ---------------------------------------------------------- */
  if (q.includes("résumé") || q.includes("resume") || q.includes("activité") || q.includes("activite") || q.includes("bilan") || q.includes("jour")) {
    const debut = new Date();
    debut.setHours(0, 0, 0, 0);
    const [ventes, ors, rdv, clients] = await Promise.all([
      supabase.from("sales").select("total, paid_total, created_at").gte("created_at", debut.toISOString()),
      supabase.from("work_orders").select("id, status").not("status", "in", '("done","delivered","cancelled")'),
      supabase.from("appointments").select("id, scheduled_at, status").gte("scheduled_at", new Date().toISOString()),
      supabase.from("clients").select("id", { count: "exact", head: true }),
    ]);
    const vData = (ventes.data ?? []) as { total: number; paid_total: number }[];
    const ca = vData.reduce((s, v) => s + Number(v.total), 0);
    const encaisse = vData.reduce((s, v) => s + Number(v.paid_total), 0);
    return {
      texte: `Résumé du jour — ${vData.length} vente(s) pour ${money(ca)} (encaissé ${money(encaisse)}), ${(ors.data ?? []).length} intervention(s) en cours, ${(rdv.data ?? []).length} rendez-vous à venir, ${clients.count ?? 0} client(s) au fichier.`,
      lignes: [
        { gauche: "Chiffre d’affaires du jour", droite: money(ca) },
        { gauche: "Encaissé", droite: money(encaisse) },
        { gauche: "Reste à recouvrer", droite: money(ca - encaisse) },
        { gauche: "Interventions ouvertes", droite: String((ors.data ?? []).length) },
        { gauche: "Rendez-vous à venir", droite: String((rdv.data ?? []).length) },
      ],
      lien: { label: "Ouvrir le tableau de bord", href: "/tableau-de-bord/" },
    };
  }

  /* ---------------------------------------------------------- *
   * Question inconnue : aide honnête
   * ---------------------------------------------------------- */
  return {
    texte:
      "Je n’ai pas compris cette demande. Je lis vos données réelles (pas de génération artificielle simulée) — essayez l’une de ces questions :",
    lignes: ACTIONS_RAPIDES.map((a) => ({ gauche: a, droite: "question prête à l’emploi" })),
  };
}

export function AssistantAI() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 0,
      role: "assistant",
      texte:
        "Bonjour. Je suis AUTO DYALI AI. Je réponds avec vos données réelles (ventes, stock, atelier, chèques), jamais avec des chiffres inventés. Toute action financière ou de stock reste entre vos mains.",
    },
  ]);
  const [saisie, setSaisie] = useState("");
  const [attente, setAttente] = useState(false);
  const compteur = useRef(1);
  const basDePage = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => basDePage.current?.scrollIntoView({ behavior: "smooth", block: "end" }), 50);
    return () => window.clearTimeout(timer);
  }, [messages, attente]);

  async function poser(question: string) {
    const q = question.trim();
    if (!q || attente) return;
    setSaisie("");
    setAttente(true);
    setMessages((m) => [...m, { id: compteur.current++, role: "user", texte: q }]);
    try {
      const reponse = await repondre(q);
      setMessages((m) => [...m, { id: compteur.current++, role: "assistant", ...reponse }]);
    } catch (e) {
      setMessages((m) => [
        ...m,
        { id: compteur.current++, role: "assistant", texte: `Erreur inattendue : ${e instanceof Error ? e.message : "requête impossible"}.` },
      ]);
    } finally {
      setAttente(false);
    }
  }

  function envoyer(event: FormEvent) {
    event.preventDefault();
    void poser(saisie);
  }

  return (
    <>
      <div className="mb-6">
        <p className="text-xs uppercase tracking-[0.2em] text-[#A7B7A8]">Assistant</p>
        <h1 className="titre-or mt-1 text-2xl font-extrabold">AUTO DYALI AI</h1>
        <p className="mt-1 text-sm text-[#A7B7A8]">
          Questions en langage naturel sur vos données réelles — aucune action destructive, confirmation humaine requise partout.
        </p>
      </div>

      {/* Actions rapides */}
      <div className="mb-4 flex flex-wrap gap-2">
        {ACTIONS_RAPIDES.map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => void poser(a)}
            disabled={attente}
            className="rounded-full border border-[#3ECF6A]/30 px-3 py-1.5 text-xs text-[#DFE7E2] transition hover:bg-[#3ECF6A]/15 disabled:opacity-40"
          >
            {a}
          </button>
        ))}
      </div>

      {/* Conversation */}
      <section className="carte flex max-h-[58vh] min-h-72 flex-col overflow-y-auto p-5">
        <ul className="space-y-4">
          {messages.map((m) => (
            <li key={m.id} className={m.role === "user" ? "text-right" : ""}>
              <div className={`inline-block max-w-3xl rounded-2xl px-4 py-3 text-left ${
                m.role === "user" ? "bg-[#3ECF6A]/20 text-[#E8ECE8]" : "bg-[#344440]/70 text-[#E8ECE8]"
              }`}>
                <p className="text-sm leading-6">{m.texte}</p>
                {m.lignes && m.lignes.length > 0 && (
                  <ul className="mt-3 divide-y divide-[#3ECF6A]/10 border-t border-[#3ECF6A]/10">
                    {m.lignes.map((l, i) => (
                      <li key={i} className="flex flex-wrap justify-between gap-2 py-2 text-xs">
                        <span className="text-[#E8ECE8]">{l.gauche}</span>
                        <span className="font-semibold text-[#DFE7E2]">{l.droite}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {m.lien && (
                  <a href={m.lien.href} className="mt-3 inline-block rounded-lg border border-[#8DA298]/40 px-3 py-1.5 text-xs text-[#8DA298]">
                    {m.lien.label} →
                  </a>
                )}
              </div>
            </li>
          ))}
          {attente && (
            <li className="text-sm italic text-[#A7B7A8]">Lecture de vos données en cours…</li>
          )}
        </ul>
        <div ref={basDePage} />
      </section>

      {/* Saisie */}
      <form onSubmit={envoyer} className="mt-4 flex gap-2">
        <input
          className="champ flex-1"
          placeholder="Ex. : quelles factures sont impayées ?"
          value={saisie}
          onChange={(e) => setSaisie(e.target.value)}
          aria-label="Votre question"
        />
        <button type="submit" disabled={attente || !saisie.trim()} className="btn-or px-5 py-2 text-sm disabled:opacity-40">
          {attente ? "Analyse…" : "Envoyer"}
        </button>
      </form>
      <p className="mt-2 text-[11px] text-[#A7B7A8]">
        Transparence : cet assistant interroge directement Supabase (moteur de requêtes, pas de modèle de langage distant).
        Aucune donnée n’est modifiée par ses réponses.
      </p>
    </>
  );
}
