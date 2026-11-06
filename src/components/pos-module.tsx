"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { catalogueTest, formatMad, type ProduitTest } from "@/lib/catalogue-test";
import { supabase } from "@/lib/supabase-browser";

/**
 * POS AUTO DYALI — architecture 3 zones :
 *   1. Navigation / catégories (gauche)
 *   2. Recherche + catalogue (centre)
 *   3. Ticket + paiement (panneau persistant à droite)
 *
 * Fonctionnalités : scan EAN-13 (douchette USB/Bluetooth = clavier),
 * recherche instantanée, remises (% et montant), TVA configurable,
 * 7 modes de paiement, paiement partiel (acompte), crédit différé,
 * anti double-encaissement (verrou), mise à jour du stock réel.
 */

type Produit = ProduitTest & { id: string };
type Ligne = { produit: Produit; quantite: number };
type ClientOption = { id: string; full_name: string };

type ModePaiement = "especes" | "carte" | "cheque" | "virement" | "mobile" | "credit" | "acompte";

/** Correspondance UI → enum payment_method de la base. */
const METHODE_BDD: Record<Exclude<ModePaiement, "acompte">, string> = {
  especes: "cash",
  carte: "card",
  cheque: "cheque",
  virement: "transfer",
  mobile: "mobile",
  credit: "credit",
};

const MODES: { cle: ModePaiement; label: string }[] = [
  { cle: "especes", label: "Espèces" },
  { cle: "carte", label: "Carte" },
  { cle: "cheque", label: "Chèque" },
  { cle: "virement", label: "Virement" },
  { cle: "mobile", label: "Mobile" },
  { cle: "credit", label: "Crédit" },
  { cle: "acompte", label: "Acompte" },
];

export function PosModule() {
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [produits, setProduits] = useState<Produit[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  // Recherche & filtres
  const [recherche, setRecherche] = useState("");
  const [categorie, setCategorie] = useState("Toutes");
  const rechercheRef = useRef<HTMLInputElement>(null);

  // Finances
  const [tauxTVA, setTauxTVA] = useState(20);
  const [pourcentageRemise, setPourcentageRemise] = useState(0);
  const [remiseMontant, setRemiseMontant] = useState(0);

  // Paiement
  const [modePaiement, setModePaiement] = useState<ModePaiement>("especes");
  const [montantRecu, setMontantRecu] = useState("");
  const [referencePaiement, setReferencePaiement] = useState("");
  const [clientId, setClientId] = useState("");

  /** Verrou anti double-encaissement (ventes en double). */
  const verrouEncaissement = useRef(false);

  /* ---------------------------------------------------------------
   * Chargements
   * --------------------------------------------------------------- */
  useEffect(() => {
    const timer = window.setTimeout(() => void charger(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function charger() {
    if (!supabase) {
      setProduits(catalogueTest.map((p) => ({ ...p, id: "" })));
      setLoading(false);
      return;
    }
    const [produitsReq, clientsReq] = await Promise.all([
      supabase.from("products").select("id, sku, name, category, sale_price, stock").eq("is_active", true).order("name"),
      supabase.from("clients").select("id, full_name").order("full_name").limit(200),
    ]);
    if (!produitsReq.error && produitsReq.data?.length) {
      setProduits(
        produitsReq.data.map((p) => ({
          id: p.id,
          sku: p.sku,
          nom: p.name,
          marque: p.name.split(" ")[0] || "Marque",
          categorie: categorieProduit(p.category),
          prix: Number(p.sale_price),
          stock: Number(p.stock) || 0,
        })),
      );
    } else {
      // Repli catalogue de test (hors ligne / aucun produit en base).
      setProduits(catalogueTest.map((p) => ({ ...p, id: "" })));
    }
    if (!clientsReq.error && clientsReq.data) setClients(clientsReq.data as ClientOption[]);
    setLoading(false);
  }

  /* ---------------------------------------------------------------
   * Catalogue : recherche, filtre, scan EAN-13
   * --------------------------------------------------------------- */
  const categories = useMemo(
    () => ["Toutes", ...Array.from(new Set(produits.map((p) => p.categorie)))],
    [produits],
  );

  const catalogueFiltre = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return produits.filter((p) => {
      const okCat = categorie === "Toutes" || p.categorie === categorie;
      const okQ = !q || p.nom.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.marque.toLowerCase().includes(q);
      return okCat && okQ;
    });
  }, [produits, recherche, categorie]);

  /** Scan douchette : la douchette envoie le code puis Entrée (ou un simple burst de touches). */
  useEffect(() => {
    let tampon = "";
    let minuteur: number | undefined;
    function onClavier(e: KeyboardEvent) {
      const cible = e.target as HTMLElement | null;
      const saisie = cible && (cible.tagName === "INPUT" || cible.tagName === "SELECT" || cible.tagName === "TEXTAREA");
      // Espace ou Entrée après un code complet → traitement.
      if (e.key === "Enter" && tampon.length >= 8) {
        traiterCode(tampon);
        tampon = "";
        return;
      }
      if (saisie) return; // la recherche gère les frappes manuelles
      if (/^[0-9]$/.test(e.key)) {
        tampon += e.key;
        window.clearTimeout(minuteur);
        minuteur = window.setTimeout(() => { tampon = ""; }, 80);
        if (tampon.length === 13) { traiterCode(tampon); tampon = ""; }
      }
    }
    document.addEventListener("keydown", onClavier);
    return () => {
      document.removeEventListener("keydown", onClavier);
      window.clearTimeout(minuteur);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [produits]);

  function traiterCode(code: string) {
    const propre = code.replace(/[^\dA-Za-z]/g, "");
    const produit = produits.find((p) => p.sku.toLowerCase() === propre.toLowerCase());
    if (produit) {
      ajouter(produit);
      setMessage(`Code ${propre} : ${produit.nom} ajouté au ticket.`);
      setErreur(null);
    } else {
      setErreur(`Code-barres ${propre} introuvable dans le catalogue.`);
    }
    rechercheRef.current?.focus();
  }

  /* ---------------------------------------------------------------
   * Ticket
   * --------------------------------------------------------------- */
  function ajouter(produit: Produit) {
    setErreur(null);
    const dansTicket = lignes.find((l) => l.produit.sku === produit.sku)?.quantite ?? 0;
    // Conflit de stock : on ne dépasse pas le stock disponible (si renseigné).
    if (produit.stock > 0 && dansTicket >= produit.stock) {
      setErreur(`Stock insuffisant pour « ${produit.nom} » : ${produit.stock} unité(s) disponible(s).`);
      return;
    }
    setLignes((courantes) => {
      const existante = courantes.find((l) => l.produit.sku === produit.sku);
      if (existante) return courantes.map((l) => (l.produit.sku === produit.sku ? { ...l, quantite: l.quantite + 1 } : l));
      return [...courantes, { produit, quantite: 1 }];
    });
  }

  function retirer(sku: string) {
    setLignes((courantes) =>
      courantes.flatMap((l) =>
        l.produit.sku !== sku ? [l] : l.quantite > 1 ? [{ ...l, quantite: l.quantite - 1 }] : [],
      ),
    );
  }

  function supprimerLigne(sku: string) {
    setLignes((courantes) => courantes.filter((l) => l.produit.sku !== sku));
  }

  /* ---------------------------------------------------------------
   * Totaux (sous-total, remise, TVA, TTC)
   * --------------------------------------------------------------- */
  const sousTotal = useMemo(() => lignes.reduce((s, l) => s + l.produit.prix * l.quantite, 0), [lignes]);
  const totalRemise = useMemo(() => {
    const pourcentage = Math.max(0, Math.min(pourcentageRemise, 100));
    const base = (sousTotal * pourcentage) / 100 + remiseMontant;
    return Math.max(0, Math.min(base, sousTotal));
  }, [sousTotal, pourcentageRemise, remiseMontant]);
  const totalHT = sousTotal - totalRemise;
  const montantTVA = Math.round((totalHT * tauxTVA) / 100 * 100) / 100;
  const totalTTC = Math.round((totalHT + montantTVA) * 100) / 100;
  const montantRecuNum = Number(montantRecu) || 0;
  const estPartiel = modePaiement === "acompte" || modePaiement === "credit";
  const montantRegle = modePaiement === "acompte" ? Math.min(montantRecuNum, totalTTC) : modePaiement === "credit" ? 0 : totalTTC;
  const renduMonnaie = Math.max(0, montantRecuNum - totalTTC);
  const resteAPayer = Math.max(0, totalTTC - montantRegle);

  function appliquerRemisePourcentage(pct: number) {
    setPourcentageRemise(pct);
    setRemiseMontant(0);
  }

  /* ---------------------------------------------------------------
   * Encaissement : vente + règlement + stock, en une seule passe.
   * --------------------------------------------------------------- */
  async function encaisser() {
    if (verrouEncaissement.current) return; // anti vente en double
    setErreur(null);
    setMessage(null);

    if (!supabase) { setErreur("Supabase n’est pas configuré : encaissement impossible."); return; }
    if (!lignes.length) { setErreur("Ticket vide."); return; }
    if (lignes.some((l) => !l.produit.id)) { setErreur("Produits hors ligne : reconnexion requise avant l’encaissement."); return; }
    if (modePaiement === "credit" && !clientId) { setErreur("Un client doit être sélectionné pour une vente à crédit."); return; }
    if (modePaiement === "acompte" && (montantRecuNum <= 0 || montantRecuNum >= totalTTC)) {
      setErreur("Saisissez un montant d’acompte strictement inférieur au total.");
      return;
    }
    if (modePaiement === "especes" && montantRecuNum > 0 && montantRecuNum < totalTTC) {
      setErreur(`Espèces insuffisantes : il manque ${formatMad(totalTTC - montantRecuNum)}.`);
      return;
    }

    verrouEncaissement.current = true;
    setSaving(true);

    try {
      const { data: profileRows, error: profileError } = await supabase.rpc("get_my_profile");
      const establishmentId = profileRows?.[0]?.establishment_id;
      if (profileError || !establishmentId) throw new Error("Établissement Manager introuvable.");

      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id ?? null;

      const reference = `VNT-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
      const status = modePaiement === "credit" ? "open" : montantRegle >= totalTTC ? "paid" : "partial";

      // 1) Vente (référence unique → contrainte DB anti-doublon)
      const { data: sale, error: saleError } = await supabase
        .from("sales")
        .insert({
          establishment_id: establishmentId,
          client_id: clientId || null,
          reference,
          status,
          subtotal: totalHT,
          discount: totalRemise,
          tax_total: montantTVA,
          total: totalTTC,
          paid_total: montantRegle,
        })
        .select("id")
        .single();
      if (saleError || !sale) throw new Error(saleError?.message ?? "La vente n’a pas pu être créée.");

      // 2) Lignes de vente
      const { error: linesError } = await supabase.from("sale_items").insert(
        lignes.map((l) => ({
          establishment_id: establishmentId,
          sale_id: sale.id,
          product_id: l.produit.id,
          label: l.produit.nom,
          quantity: l.quantite,
          unit_price: l.produit.prix,
          tax_rate: tauxTVA,
          discount: totalRemise > 0 ? Math.round((totalRemise / sousTotal) * 10000) / 100 : 0,
        })),
      );
      if (linesError) throw new Error(linesError.message);

      // 3) Règlement (aucune ligne de règlement pour le crédit différé)
      if (montantRegle > 0) {
        const methode = modePaiement === "acompte" ? METHODE_BDD.especes : METHODE_BDD[modePaiement as Exclude<ModePaiement, "acompte">];
        const { error: payError } = await supabase.from("payments").insert({
          establishment_id: establishmentId,
          sale_id: sale.id,
          method: methode,
          amount: montantRegle,
          received_by: userId,
        });
        if (payError) throw new Error(payError.message);
      }

      // 4) Mouvements de stock (sortie) + décrément du stock réel
      for (const ligne of lignes) {
        const { error: moveError } = await supabase.from("stock_movements").insert({
          establishment_id: establishmentId,
          product_id: ligne.produit.id,
          direction: "out",
          quantity: ligne.quantite,
          reference,
          actor_id: userId,
        });
        if (moveError) throw new Error(moveError.message);

        const { error: stockError } = await supabase.rpc("decrement_product_stock", {
          p_product_id: ligne.produit.id,
          p_quantity: ligne.quantite,
        });
        if (stockError && !stockError.message.includes("could not find function")) {
          // RPC absent (migration non appliquée) : mise à jour directe défensive.
          const nouveauStock = Math.max(0, ligne.produit.stock - ligne.quantite);
          await supabase.from("products").update({ stock: nouveauStock }).eq("id", ligne.produit.id);
        }
      }

      setMessage(`Vente ${reference} enregistrée — ${formatMad(totalTTC)}${resteAPayer > 0 ? `, reste à payer : ${formatMad(resteAPayer)}` : ""}.`);
      setLignes([]);
      setPourcentageRemise(0);
      setRemiseMontant(0);
      setMontantRecu("");
      setReferencePaiement("");
      setClientId("");
      setModePaiement("especes");
      void charger(); // recharger les stocks à jour
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Erreur lors de l’encaissement.");
    } finally {
      verrouEncaissement.current = false;
      setSaving(false);
    }
  }

  /* ---------------------------------------------------------------
   * Transformer le ticket en devis (sans toucher au stock)
   * --------------------------------------------------------------- */
  async function creerDevisDepuisTicket() {
    if (verrouEncaissement.current) return;
    setErreur(null);
    setMessage(null);
    if (!supabase) { setErreur("Supabase n’est pas configuré : devis impossible."); return; }
    if (!lignes.length) { setErreur("Ticket vide."); return; }

    verrouEncaissement.current = true;
    setSaving(true);
    try {
      const { data: profileRows, error: profileError } = await supabase.rpc("get_my_profile");
      const establishmentId = profileRows?.[0]?.establishment_id;
      if (profileError || !establishmentId) throw new Error("Établissement introuvable.");

      const identifiant = typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase()
        : `T${lignes.length}${lignes[0].produit.sku.slice(-3)}`;
      const reference = `DEV-${new Date().getFullYear()}-${identifiant}`;
      const { data: devis, error: devisError } = await supabase
        .from("quotes")
        .insert({
          establishment_id: establishmentId,
          client_id: clientId || null,
          reference,
          status: "draft",
          subtotal: totalHT,
          discount: totalRemise,
          tax_total: montantTVA,
          total: totalTTC,
          valid_until: new Date(Date.now() + 15 * 86400_000).toISOString().slice(0, 10),
        })
        .select("id")
        .single();
      if (devisError || !devis) throw new Error(devisError?.message ?? "Devis non créé.");

      const { error: itemsError } = await supabase.from("quote_items").insert(
        lignes.map((l, index) => ({
          establishment_id: establishmentId,
          quote_id: devis.id,
          product_id: l.produit.id || null,
          label: l.produit.nom,
          quantity: l.quantite,
          unit_price: l.produit.prix,
          tax_rate: tauxTVA,
          discount: 0,
          position: index,
        })),
      );
      if (itemsError) throw new Error(itemsError.message);

      setMessage(`Devis ${reference} créé — suivi et conversion depuis la page Devis.`);
      setLignes([]);
      setPourcentageRemise(0);
      setRemiseMontant(0);
      setMontantRecu("");
      setClientId("");
      setModePaiement("especes");
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Création du devis impossible.");
    } finally {
      verrouEncaissement.current = false;
      setSaving(false);
    }
  }

  /* ---------------------------------------------------------------
   * Impression du ticket (fenêtre d’impression légère)
   * --------------------------------------------------------------- */
  function imprimerTicket() {
    if (!lignes.length) return;
    const fenetre = window.open("", "_blank", "width=420,height=640");
    if (!fenetre) { setErreur("Autorisez les fenêtres pop-up pour imprimer le ticket."); return; }
    const lignesHtml = lignes
      .map((l) => `<tr><td>${l.produit.nom}</td><td style="text-align:center">${l.quantite}</td><td style="text-align:right">${formatMad(l.produit.prix * l.quantite)}</td></tr>`)
      .join("");
    fenetre.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Ticket AUTO DYALI</title>
<style>body{font-family:ui-monospace,Menlo,monospace;font-size:13px;width:300px;margin:16px auto;color:#000}
h1{font-size:16px;text-align:center;margin:0 0 4px}table{width:100%;border-collapse:collapse;margin-top:8px}
td{padding:3px 0;border-bottom:1px dashed #999}.total{font-weight:bold;font-size:15px;margin-top:8px}
.muted{color:#555;font-size:11px;text-align:center}</style></head><body>
<h1>AUTO DYALI</h1><p class="muted">Ticket de caisse — le ${new Date().toLocaleString("fr-FR")}</p>
<table><tbody>${lignesHtml}</tbody></table>
<div class="total">Total TTC : ${formatMad(totalTTC)}</div>
${totalRemise > 0 ? `<div class="muted">Remise : -${formatMad(totalRemise)} · TVA ${tauxTVA}% : ${formatMad(montantTVA)}</div>` : ""}
${estPartiel ? `<div class="muted">Réglé : ${formatMad(montantRegle)} — reste : ${formatMad(resteAPayer)}</div>` : ""}
<p class="muted">Merci de votre confiance — AUTO DYALI</p></body></html>`);
    fenetre.document.close();
    fenetre.focus();
    fenetre.print();
  }

  /* ---------------------------------------------------------------
   * Rendu — 3 zones
   * --------------------------------------------------------------- */
  return (
    <section className="grid gap-5 xl:grid-cols-[13rem_1fr_23rem]">
      {/* Zone 1 : navigation et catégories */}
      <aside className="carte h-fit p-4">
        <p className="text-[10px] uppercase tracking-[0.2em] text-[#a8bb87]">Catégories</p>
        <div className="mt-3 flex flex-col gap-1.5">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategorie(cat)}
              className={`rounded-lg px-3 py-2 text-left text-sm transition ${
                categorie === cat
                  ? "bg-[#d6b66f] font-bold text-[#102b32]"
                  : "text-[#f8ecc9]/80 hover:bg-[#21464b]"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
        <div className="mt-5 border-t border-[#d6b66f]/10 pt-4">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#a8bb87]">Scanner</p>
          <p className="mt-2 text-xs leading-5 text-[#a8bb87]">
            Douchette USB/Bluetooth ou caméra : scannez un <strong className="text-[#e9d998]">EAN-13</strong> — le produit est ajouté automatiquement.
          </p>
          <button type="button" onClick={() => rechercheRef.current?.focus()} className="mt-3 w-full rounded-lg border border-[#d6b66f]/40 px-3 py-2 text-xs text-[#e9d998]">
            Placer le curseur dans la recherche
          </button>
        </div>
      </aside>

      {/* Zone 2 : recherche + catalogue */}
      <div className="carte min-w-0 p-4 sm:p-5">
        <div className="mb-4">
          <p className="text-xs uppercase tracking-[0.2em] text-[#a8bb87]">Vente tactile</p>
          <h2 className="titre-or mt-1 text-xl font-extrabold">Catalogue</h2>
          <p className="mt-1 text-xs text-[#a8bb87]">
            {loading ? "Chargement du catalogue Supabase…" : `${catalogueFiltre.length} produit(s) — cliquez pour ajouter au ticket.`}
          </p>
        </div>

        <input
          ref={rechercheRef}
          type="search"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="Rechercher : nom, marque, EAN, référence…"
          className="champ min-h-11 w-full"
          aria-label="Rechercher un produit"
        />

        {erreur && <p role="alert" className="mt-3 rounded-lg bg-[#d66868]/15 px-3 py-2 text-xs text-[#d66868]">{erreur}</p>}

        <div className="mt-4 grid max-h-[52vh] grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3">
          {catalogueFiltre.map((produit) => (
            <button
              key={produit.sku}
              type="button"
              onClick={() => ajouter(produit)}
              className="min-h-28 touch-manipulation rounded-xl border border-[#d6b66f]/15 bg-[#21464b]/60 p-3 text-left transition hover:border-[#d6b66f]/60 active:scale-[.98]"
            >
              <span className="text-[10px] uppercase text-[#a8bb87]">{produit.categorie}</span>
              <strong className="mt-1 block text-sm text-[#f8ecc9]">{produit.marque}</strong>
              <span className="mt-1 block text-xs leading-4 text-[#f8ecc9]/80">{produit.nom}</span>
              <span className="mt-2 block text-sm font-bold text-[#e9d998]">
                {formatMad(produit.prix)}
                {produit.stock > 0 && <span className="ml-2 text-[10px] font-normal text-[#38a987]">stock {produit.stock}</span>}
              </span>
            </button>
          ))}
          {!catalogueFiltre.length && !loading && (
            <p className="col-span-full py-8 text-center text-sm text-[#a8bb87]">Aucun produit ne correspond à la recherche.</p>
          )}
        </div>
      </div>

      {/* Zone 3 : ticket + paiement (persistant) */}
      <aside className="carte flex h-fit flex-col p-4 sm:p-5 xl:sticky xl:top-24">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-[#f8ecc9]">Ticket en cours</h2>
          <span className="rounded-full bg-[#21464b] px-2 py-1 text-xs text-[#a8bb87]">
            {lignes.length} article{lignes.length > 1 ? "s" : ""}
          </span>
        </div>

        {/* Client optionnel (obligatoire pour le crédit) */}
        <label className="mt-3 block text-[10px] uppercase tracking-[0.15em] text-[#a8bb87]">
          Client {modePaiement === "credit" && <span className="text-[#d66868]">(obligatoire pour le crédit)</span>}
          <select value={clientId} onChange={(e) => setClientId(e.target.value)} className="champ mt-1 min-h-10 py-1 text-sm normal-case tracking-normal">
            <option value="">Client comptoir (anonyme)</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
          </select>
        </label>

        {/* Lignes du ticket */}
        <div className="mt-3 flex max-h-56 flex-col gap-2 overflow-y-auto">
          {lignes.length === 0 ? (
            <p className="py-6 text-center text-sm text-[#a8bb87]">Aucun article sélectionné.</p>
          ) : (
            lignes.map((ligne) => (
              <div key={ligne.produit.sku} className="border-b border-[#d6b66f]/10 pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#f8ecc9]">{ligne.produit.nom}</p>
                    <p className="text-xs text-[#a8bb87]">{ligne.quantite} × {formatMad(ligne.produit.prix)}</p>
                  </div>
                  <button type="button" onClick={() => supprimerLigne(ligne.produit.sku)} className="min-h-7 min-w-7 rounded bg-[#d66868]/15 text-xs text-[#d66868]" aria-label={`Supprimer ${ligne.produit.nom}`}>✕</button>
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <button type="button" onClick={() => retirer(ligne.produit.sku)} className="min-h-7 min-w-7 rounded-lg bg-[#21464b] text-sm text-[#d6b66f]" aria-label={`Retirer une unité de ${ligne.produit.nom}`}>−</button>
                  <span className="w-6 text-center text-sm text-[#f8ecc9]">{ligne.quantite}</span>
                  <button type="button" onClick={() => ajouter(ligne.produit)} className="min-h-7 min-w-7 rounded-lg bg-[#21464b] text-sm text-[#d6b66f]" aria-label={`Ajouter une unité de ${ligne.produit.nom}`}>+</button>
                  <span className="ml-auto text-sm font-bold text-[#e9d998]">{formatMad(ligne.produit.prix * ligne.quantite)}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* TVA & remise */}
        <div className="mt-3 space-y-2 border-t border-[#d6b66f]/20 pt-3">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="text-[#a8bb87]">TVA</span>
            <select value={tauxTVA} onChange={(e) => setTauxTVA(Number(e.target.value))} className="champ min-h-8 w-24 py-1 text-xs" aria-label="Taux de TVA">
              <option value={0}>0 %</option>
              <option value={7}>7 %</option>
              <option value={10}>10 %</option>
              <option value={14}>14 %</option>
              <option value={20}>20 %</option>
            </select>
          </div>
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="text-[#a8bb87]">Remise rapide</span>
            <div className="flex gap-1">
              {[0, 5, 10, 15].map((pct) => (
                <button key={pct} type="button" onClick={() => appliquerRemisePourcentage(pct)} className={`rounded px-2 py-1 text-xs ${pourcentageRemise === pct ? "bg-[#d6b66f] font-bold text-[#102b32]" : "bg-[#21464b] text-[#d6b66f]"}`}>
                  {pct}%
                </button>
              ))}
            </div>
          </div>
          <label className="flex items-center justify-between gap-2 text-xs">
            <span className="text-[#a8bb87]">Remise (MAD)</span>
            <input type="number" min="0" step="1" value={remiseMontant} onChange={(e) => setRemiseMontant(Math.max(0, Number(e.target.value) || 0))} className="champ min-h-8 w-24 py-1 text-xs" />
          </label>
        </div>

        {/* Récapitulatif */}
        <div className="mt-3 grid grid-cols-2 gap-1 border-t border-[#d6b66f]/20 pt-3 text-xs">
          <span className="text-[#a8bb87]">Sous-total</span><span className="text-right">{formatMad(sousTotal)}</span>
          {totalRemise > 0 && <><span className="text-[#a8bb87]">Remise</span><span className="text-right text-[#d6b66f]">− {formatMad(totalRemise)}</span></>}
          <span className="text-[#a8bb87]">TVA {tauxTVA} %</span><span className="text-right">{formatMad(montantTVA)}</span>
          <span className="text-sm font-bold text-[#f8ecc9]">Total TTC</span><span className="text-right text-lg font-extrabold text-[#e9d998]">{formatMad(totalTTC)}</span>
        </div>

        {/* Modes de paiement */}
        <div className="mt-3">
          <p className="text-[10px] uppercase tracking-[0.15em] text-[#a8bb87]">Mode de paiement</p>
          <div className="mt-2 grid grid-cols-4 gap-1.5">
            {MODES.map((m) => (
              <button
                key={m.cle}
                type="button"
                onClick={() => { setModePaiement(m.cle); setMontantRecu(""); setReferencePaiement(""); }}
                className={`rounded-lg px-1 py-1.5 text-[11px] transition ${
                  modePaiement === m.cle ? "bg-[#d6b66f] font-bold text-[#102b32]" : "bg-[#21464b] text-[#d6b66f] hover:bg-[#2a555b]"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {(modePaiement === "especes" || modePaiement === "acompte") && (
            <label className="mt-2 block text-xs text-[#a8bb87]">
              Montant reçu (MAD)
              <input type="number" min="0" step="0.5" value={montantRecu} onChange={(e) => setMontantRecu(e.target.value)} placeholder={String(totalTTC)} className="champ mt-1 min-h-10 py-1" />
            </label>
          )}
          {(modePaiement === "cheque" || modePaiement === "virement") && (
            <label className="mt-2 block text-xs text-[#a8bb87]">
              {modePaiement === "cheque" ? "Numéro de chèque" : "Référence du virement"}
              <input type="text" value={referencePaiement} onChange={(e) => setReferencePaiement(e.target.value)} className="champ mt-1 min-h-10 py-1" />
            </label>
          )}

          <div className="mt-2 space-y-1 text-xs">
            {(modePaiement === "especes" || modePaiement === "mobile" || modePaiement === "carte") && montantRecuNum > 0 && (
              <div className="flex justify-between"><span className="text-[#a8bb87]">Rendu monnaie</span><span className="font-bold text-[#e9d998]">{formatMad(renduMonnaie)}</span></div>
            )}
            {modePaiement === "acompte" && (
              <div className="flex justify-between"><span className="text-[#a8bb87]">Reste à payer</span><span className="font-bold text-[#d6b66f]">{formatMad(resteAPayer)}</span></div>
            )}
            {modePaiement === "credit" && (
              <p className="rounded-lg bg-[#d6b66f]/10 px-2 py-1.5 leading-4 text-[#e9d998]">Vente à crédit différé — encaissement ultérieur depuis l’historique des ventes.</p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={imprimerTicket} disabled={!lignes.length} className="min-h-11 flex-1 rounded-lg border border-[#d6b66f]/40 px-3 text-sm text-[#e9d998] disabled:cursor-not-allowed disabled:opacity-40">
            Imprimer
          </button>
          <button
            type="button"
            onClick={() => void creerDevisDepuisTicket()}
            disabled={saving || !lignes.length}
            className="min-h-11 flex-1 rounded-lg border border-[#d6b66f]/40 px-3 text-sm text-[#e9d998] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Devis
          </button>
          <button
            type="button"
            onClick={() => void encaisser()}
            disabled={saving || !lignes.length || totalTTC <= 0}
            className="btn-or min-h-11 flex-[2] text-sm font-bold disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? "Enregistrement…" : `Encaisser ${lignes.length ? formatMad(totalTTC) : ""}`}
          </button>
        </div>

        {message && <p role="status" className="mt-2 text-xs text-[#38a987]">{message}</p>}
        {erreur && <p role="alert" className="mt-2 text-xs text-[#d66868]">{erreur}</p>}
      </aside>
    </section>
  );
}

/** Traduction des catégories de la base vers les libellés du catalogue. */
function categorieProduit(catégorieBase: string): ProduitTest["categorie"] {
  switch (catégorieBase.toLowerCase()) {
    case "lubrifiant":
      return "Lubrifiant";
    case "accessoire":
      return "Accessoire";
    case "piece":
    case "pièce":
      return "Pièce";
    case "merchandise":
      return "Merchandising";
    case "pneumatique":
    case "pneus":
      return "Pièce";
    case "filtre":
      return "Filtre";
    default:
      return "Autre";
  }
}
