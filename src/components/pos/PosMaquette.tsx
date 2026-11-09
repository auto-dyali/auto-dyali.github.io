"use client";

/**
 * POS MAQUETTE — Point de Vente fidèle à l'IMAGE 2.
 * Nouvelle couche visuelle uniquement : le moteur commercial reste `usePos`
 * (pricing-engine, payment-engine, sales-engine) et les données Supabase.
 * Aucun ancien composant POS (CatalogueVentes / PanierVentes / PosEcran)
 * n'est utilisé ici.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { ScanChamp } from "@/components/scan-champ";
import { ClientFormulaire } from "@/modules/new-pos/components/client-form";
import { TicketVente } from "@/modules/new-pos/components/ticket";
import { usePos } from "@/modules/new-pos/hooks/use-pos";
import { afMAD } from "@/modules/new-pos/core/money.ts";
import type { ModePaiement, Produit, Reglement } from "@/modules/new-pos/types";

type CategorieMaquette = {
  cle: string;
  label: string;
  icone: string;
  img: string;
};

const CATEGORIES: CategorieMaquette[] = [
  { cle: "tout", label: "Tout", icone: "⊞", img: "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=400&q=60&auto=format&fit=crop" },
  { cle: "pneumatiques", label: "Pneumatiques", icone: "🛞", img: "https://images.unsplash.com/photo-1578844251758-2f71da64c96f?w=400&q=60&auto=format&fit=crop" },
  { cle: "vidange", label: "Vidange", icone: "🛢️", img: "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=400&q=60&auto=format&fit=crop" },
  { cle: "freinage", label: "Freinage", icone: "⭕", img: "https://images.unsplash.com/photo-1600661653561-629509216228?w=400&q=60&auto=format&fit=crop" },
  { cle: "filtration", label: "Filtration", icone: "▦", img: "https://images.unsplash.com/photo-1613214149922-f1809c99b414?w=400&q=60&auto=format&fit=crop" },
  { cle: "lubrifiants", label: "Lubrifiants", icone: "🫗", img: "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=400&q=60&auto=format&fit=crop" },
  { cle: "accessoires", label: "Accessoires", icone: "🪑", img: "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=400&q=60&auto=format&fit=crop" },
];

const POOL_IMAGES_PRODUITS = [
  "https://images.unsplash.com/photo-1578844251758-2f71da64c96f?w=400&q=60&auto=format&fit=crop", // pneu
  "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=400&q=60&auto=format&fit=crop", // huile/moteur
  "https://images.unsplash.com/photo-1613214149922-f1809c99b414?w=400&q=60&auto=format&fit=crop", // filtre
  "https://images.unsplash.com/photo-1600661653561-629509216228?w=400&q=60&auto=format&fit=crop", // frein
  "https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=400&q=60&auto=format&fit=crop", // batterie
  "https://images.unsplash.com/photo-1625047509168-a7026f36de04?w=400&q=60&auto=format&fit=crop", // bougies
  "https://images.unsplash.com/photo-1601362840469-51e4d8d58785?w=400&q=60&auto=format&fit=crop", // balais
  "https://images.unsplash.com/photo-1580273916550-e323be2ae537?w=400&q=60&auto=format&fit=crop", // jante/pneu
];

function imgProduit(p: Produit): string {
  // Image propre et distincte par produit (stable via sa référence).
  const cle = `${p.reference ?? ""}${p.nom}`.toLowerCase();
  let h = 0;
  for (let i = 0; i < cle.length; i++) h = (h * 31 + cle.charCodeAt(i)) >>> 0;
  return POOL_IMAGES_PRODUITS[h % POOL_IMAGES_PRODUITS.length];
}

function iconeMetier(p: Produit): string {
  const cat = (p.categorie ?? "").toLowerCase();
  const nom = `${p.nom} ${p.marque ?? ""}`.toLowerCase();
  if (cat.includes("pneu") || nom.includes("pneu") || nom.includes("michelin")) return "🛞";
  if (cat.includes("freinage") || nom.includes("frein") || nom.includes("plaquette") || nom.includes("disque")) return "⭕";
  if (cat.includes("filtre") || nom.includes("filtre")) return "▦";
  if (cat.includes("batterie") || nom.includes("batterie") || nom.includes("varta")) return "🔋";
  if (cat.includes("lubrifiant") || nom.includes("huile") || nom.includes("quartz") || nom.includes("motul")) return "🫗";
  if (cat.includes("accessoire")) return "🪑";
  return "🔧";
}

function dansCategorie(p: Produit, cle: string): boolean {
  if (cle === "tout") return true;
  const cat = (p.categorie ?? "").toLowerCase();
  const nom = `${p.nom} ${p.marque ?? ""} ${p.reference ?? ""}`.toLowerCase();
  if (cle === "pneumatiques") return cat.includes("pneu") || nom.includes("pneu") || nom.includes("michelin") || nom.includes("205/55");
  if (cle === "vidange") return cat.includes("lubrifiant") || nom.includes("huile") || nom.includes("vidange") || nom.includes("quartz");
  if (cle === "freinage") return cat.includes("freinage") || nom.includes("frein") || nom.includes("plaquette") || nom.includes("disque");
  if (cle === "filtration") return cat.includes("filtre") || cat.includes("filtration") || nom.includes("filtre");
  if (cle === "lubrifiants") return cat.includes("lubrifiant") || nom.includes("huile") || nom.includes("quartz") || nom.includes("motul") || nom.includes("castrol") || nom.includes("elf");
  if (cle === "accessoires") return cat.includes("accessoire") || cat.includes("autres") || cat.includes("divers");
  return false;
}

export function PosMaquette() {
  const {
    catalogue, chargementCat,
    panier, totaux, reglements, op, vider, setReglements,
    clients, choisirClient, estGestionnaire, permPosEdit, role,
    fileRetard, syncInfo, validerVenteCourante, erreurBandeau, infoValidation, ticketTermine,
  } = usePos();

  const [recherche, setRecherche] = useState("");
  const [categorie, setCategorie] = useState("tout");
  const [modeChoisi, setModeChoisi] = useState<ModePaiement>("especes");
  const [carteType, setCarteType] = useState<"visa" | "mastercard">("visa");
  const [montant, setMontant] = useState("");
  const [cheque, setCheque] = useState({ numero: "", banque: "", echeance: "", statut: "en_attente" as const, date: new Date().toISOString().slice(0, 10) });
  const [refTpe, setRefTpe] = useState("");
  const [refVirement, setRefVirement] = useState("");
  const [remisePct, setRemisePct] = useState("0");
  const [clientFormOuvert, setClientFormOuvert] = useState(false);
  const [rechClient, setRechClient] = useState("");
  const [paiementOuvert, setPaiementOuvert] = useState(false);

  const produitsVisibles = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    let ls = catalogue.produits.filter((p) => dansCategorie(p, categorie));
    if (q) {
      ls = ls.filter((p) => `${p.nom} ${p.marque ?? ""} ${p.reference ?? ""} ${p.referenceOem ?? ""} ${p.codeBarres ?? ""}`.toLowerCase().includes(q));
    }
    // Affichage : 8 produits maximum, mélangés par métier (une part de chaque famille).
    if (q || categorie !== "tout") return ls.slice(0, 8);
    const parMetier = new Map<string, Produit[]>();
    for (const p of ls) {
      const k = (p.categorie ?? "divers").toLowerCase();
      parMetier.set(k, [...(parMetier.get(k) ?? []), p]);
    }
    const melange: Produit[] = [];
    let reste = true;
    while (reste && melange.length < 8) {
      reste = false;
      for (const liste of parMetier.values()) {
        if (liste.length > 0 && melange.length < 8) {
          melange.push(liste.shift()!);
          reste = true;
        }
      }
    }
    return melange;
  }, [catalogue.produits, categorie, recherche]);

  const dejaCouvert = reglements.reduce((s, r) => s + r.montantCent, 0);
  const resteACouvrir = Math.max(0, totaux.ttcCent - dejaCouvert);
  const monnaie = Math.max(0, dejaCouvert - totaux.ttcCent);
  const montantCent = Math.round(Number(montant.replace(",", ".")) * 100) || 0;
  const modeEffectif: ModePaiement = (modeChoisi === "visa" || modeChoisi === "mastercard") ? carteType : modeChoisi;

  function ajouterReglement() {
    if (montantCent <= 0) return;
    const r: Reglement = { mode: modeEffectif, montantCent };
    if (modeEffectif === "cheque") r.cheque = { ...cheque, date: new Date().toISOString().slice(0, 10) };
    if (modeEffectif === "visa" || modeEffectif === "mastercard") r.carte = { referenceTpe: refTpe.trim(), confirme: false };
    if (modeEffectif === "virement") r.virement = { reference: refVirement.trim(), confirme: false };
    setReglements([...reglements, r]);
    setMontant("");
    setRefTpe("");
    setRefVirement("");
  }

  async function valider() {
    if (panier.lignes.length === 0) return;
    if (reglements.length === 0 && !panier.client) return;
    await validerVenteCourante(dejaCouvert, reglements);
  }

  const peutValider = panier.lignes.length > 0 && (resteACouvrir === 0 || (reglements.length === 0 && panier.client && (estGestionnaire || permPosEdit)));
  const desactiveCatalogue = !estGestionnaire && role !== null && !permPosEdit;

  const MODES_IMAGE: { cle: ModePaiement; label: string; icone: string }[] = [
    { cle: "especes", label: "Espèces", icone: "💵" },
    { cle: "visa", label: "Carte Bancaire", icone: "💳" },
    { cle: "virement", label: "Virement", icone: "🏛" },
    { cle: "mobile", label: "Mobile", icone: "📱" },
    { cle: "cheque", label: "Chèque", icone: "🧾" },
  ];

  return (
    <section aria-label="Point de Vente — maquette" className="maquette-pos flex min-h-0 flex-col gap-4 md:h-full">

      {erreurBandeau && <div className="rounded-xl border border-[#C66A68]/60 bg-[#C66A68]/15 px-3 py-2 text-xs text-[#F0A8A4]">{erreurBandeau}</div>}
      {infoValidation && <div className="rounded-xl border border-[#31ffb0]/50 bg-[#31ffb0]/10 px-3 py-2 text-xs text-[#8dffce]">{infoValidation}</div>}
      {syncInfo && <div className="rounded-xl border border-[#31ffb0]/30 bg-black/30 px-3 py-2 text-xs text-[#A7B7A8]">{syncInfo}</div>}
      {fileRetard > 0 && <div className="rounded-xl border border-[#D6A34D]/50 bg-[#D6A34D]/10 px-3 py-2 text-xs text-[#F2D58A]">{fileRetard} vente(s) en attente de synchronisation (hors ligne).</div>}

      {/* Barre supérieure — image 2 */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="mr-auto flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#31ffb0]/30 bg-[#07180f]/85 text-xl text-[#F2D58A] shadow-[0_0_18px_rgba(49,255,176,0.14)]" aria-hidden>🛒</span>
          <span>
            <span className="block text-xl font-extrabold text-[#F2F7F3]">Point de Vente</span>
            <span className="block text-xs text-[#A7B7A8]">Vente rapide • Gestion intelligente</span>
          </span>
        </div>
        <label className="maquette-search flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-full px-4">
          <span aria-hidden className="text-[#D9F4E7]">⌕</span>
          <input
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Rechercher un produit... (nom, référence, code-barres)"
            aria-label="Rechercher un produit"
            className="w-full border-0 bg-transparent text-sm text-[#F2F7F3] outline-none placeholder:text-[#8da298]"
          />
          <span className="min-w-40">
            <ScanChamp compact onCode={(code) => {
              const p = catalogue.produits.find((x) => x.codeBarres === code || x.reference === code);
              if (p) op.ajouterProduit(p);
            }} />
          </span>
        </label>
        <button type="button" onClick={vider} className="neon-btn-gold min-h-11 shrink-0 px-4 text-sm">＋ Nouvelle Vente</button>
        <button type="button" onClick={() => window.print()} className="neon-btn-ghost min-h-11 shrink-0 px-4 text-sm">⎙ Imprimer</button>
      </div>

      {catalogue.mode === "test" && (
        <p role="status" className="rounded-xl border border-[#D6A34D]/40 bg-black/30 px-3 py-2 text-xs text-[#F2D58A]">
          Catalogue de démonstration — la base réelle n’est pas joignable. Aucun prix affiché n’est un prix réel.
        </p>
      )}

      {/* Corps : catalogue (8) + panier/paiement (4) */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 md:grid-cols-12">
        <div className="flex min-h-0 flex-col gap-3 md:col-span-8">
          {/* Catégories — image 2 */}
          <div className="pos-categories flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Catégories">
            {CATEGORIES.map((c) => (
              <button
                key={c.cle}
                type="button"
                role="tab"
                aria-selected={categorie === c.cle}
                onClick={() => setCategorie(c.cle)}
                className="pos-cat-pill relative flex min-h-20 min-w-28 flex-col items-center justify-center gap-1 overflow-hidden px-3 text-xs font-bold"
                data-actif={categorie === c.cle}
              >
                <img src={c.img} alt="" loading="eager" onError={(e) => { e.currentTarget.style.display = "none"; }} className="absolute inset-0 h-full w-full object-cover opacity-50" />
                <span aria-hidden className="relative flex h-8 w-8 items-center justify-center rounded-xl border border-[#31ffb0]/25 bg-black/60 text-xl">{c.icone}</span>
                {c.label}
              </button>
            ))}
          </div>

          {/* Grille produits — image 2 */}
          {chargementCat ? (
            <p className="py-10 text-center text-xs text-[#A7B7A8]">Chargement du catalogue…</p>
          ) : (
            <div className="pos-product-grid grid min-h-0 flex-1 grid-cols-2 gap-4 overflow-y-auto pb-1 sm:grid-cols-3 md:grid-cols-4">
              {produitsVisibles.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  disabled={desactiveCatalogue}
                  onClick={() => op.ajouterProduit(p)}
                  title={desactiveCatalogue ? "Permissions POS insuffisantes." : `Ajouter ${p.nom} au panier`}
                  className="pos-product-card group flex min-h-28 flex-col p-3 text-left transition hover:-translate-y-0.5 disabled:opacity-40"
                >
                  <span className="pos-product-media relative overflow-hidden" aria-hidden>
                    <img src={imgProduit(p)} alt="" loading="eager" onError={(e) => { e.currentTarget.style.display = "none"; }} className="absolute inset-0 h-full w-full object-cover" />
                    <span className="absolute bottom-1 left-1 rounded-md bg-black/60 px-1 py-0.5 text-sm">{iconeMetier(p)}</span>
                  </span>
                  <span className="mt-1 truncate text-[13px] font-bold leading-snug text-[#F2F7F3]" title={p.nom}>{p.nom}</span>
                  <span className="mt-auto flex items-center justify-between gap-2">
                    <span className="pos-price min-w-0 truncate text-base font-extrabold">{afMAD(p.prixUnitaireCent)}</span>
                    <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#F2D58A]/45 bg-[#F2D58A]/10 text-[#F2D58A]">🛒</span>
                  </span>
                  <span className="pos-stock mt-1 w-fit">{p.source === "test" ? "démo" : p.stock > 0 ? `Stock : ${p.stock}` : "épuisé"}</span>
                </button>
              ))}
              {produitsVisibles.length === 0 && <p className="col-span-full py-10 text-center text-sm text-[#A7B7A8]">Aucun produit pour cette recherche.</p>}
            </div>
          )}

          {/* Contrôles bas — image 2 : Remise / Client / Mode de Paiement */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="neon-panel p-3">
              <p className="mb-2 flex items-center gap-2 text-xs font-extrabold text-[#F2F7F3]"><span aria-hidden className="text-[#F2D58A]">%</span> Remise</p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  inputMode="numeric"
                  value={remisePct}
                  onChange={(e) => setRemisePct(e.target.value)}
                  aria-label="Remise en pourcentage"
                  className="min-h-11 w-full rounded-lg border border-[#31ffb0]/25 bg-black/40 px-3 text-right text-sm font-bold text-[#F2F7F3] outline-none"
                />
                <span className="text-xs text-[#A7B7A8]">%</span>
                <button type="button" disabled={!estGestionnaire && !permPosEdit} onClick={() => op.majRemiseGlobale({ pourcent: Number(remisePct) || 0, montantCent: panier.remiseGlobale.montantCent })} className="neon-btn-gold min-h-11 shrink-0 px-3 text-xs">Appliquer</button>
              </div>
            </div>

            <div className="neon-panel p-3">
              <p className="mb-2 flex items-center gap-2 text-xs font-extrabold text-[#F2F7F3]"><span aria-hidden className="text-[#F2D58A]">👤</span> Client <span className="font-normal text-[#A7B7A8]">(Optionnel)</span></p>
              <div className="flex items-center gap-2">
                <select
                  value={panier.client?.id ?? ""}
                  onChange={(e) => {
                    const c = clients.find((x) => x.id === e.target.value) ?? null;
                    choisirClient(c);
                  }}
                  aria-label="Sélectionner un client"
                  className="min-h-11 w-full rounded-lg border border-[#31ffb0]/25 bg-black/40 px-3 text-sm text-[#F2F7F3] outline-none"
                >
                  <option value="">Sélectionner un client...</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.nomComplet}{c.telephone ? ` — ${c.telephone}` : ""}</option>)}
                </select>
                <button type="button" onClick={() => setClientFormOuvert((v) => !v)} aria-label="Nouveau client" className="neon-btn-gold min-h-11 min-w-11 px-0 text-base">＋</button>
              </div>
              {panier.client && <p className="mt-1 text-[11px] text-[#8dffce]">Client sélectionné : {panier.client.nomComplet}</p>}
            </div>

            <div className="neon-panel p-3">
              <p className="mb-2 flex items-center gap-2 text-xs font-extrabold text-[#F2F7F3]"><span aria-hidden className="text-[#F2D58A]">💳</span> Mode de Paiement</p>
              <select
                value={modeEffectif}
                onChange={(e) => setModeChoisi(e.target.value as ModePaiement)}
                aria-label="Mode de paiement"
                className="min-h-11 w-full rounded-lg border border-[#31ffb0]/25 bg-black/40 px-3 text-sm text-[#F2F7F3] outline-none"
              >
                <option value="especes">Espèces</option>
                <option value="visa">Carte Bancaire — Visa</option>
                <option value="mastercard">Carte Bancaire — Mastercard</option>
                <option value="virement">Virement</option>
                <option value="mobile">Mobile</option>
                <option value="cheque">Chèque</option>
                <option value="credit">Crédit client</option>
                <option value="avoir">Avoir client</option>
              </select>
            </div>
          </div>

          {clientFormOuvert && (
            <ClientFormulaire
              surCreer={(c) => { choisirClient(c); setClientFormOuvert(false); }}
              surSelectionner={choisirClient}
              clients={clients}
              recherche={rechClient}
              surRecherche={setRechClient}
            />
          )}
        </div>

        {/* Panier + paiement — image 2 */}
        <aside aria-label="Panier de Vente" className="flex min-h-0 flex-col gap-3 md:col-span-4">
          <section className="pos-cart-panel p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-base font-extrabold text-[#F2F7F3]"><span aria-hidden className="text-[#F2D58A]">🛒</span> Panier de Vente</h2>
              <span className="flex h-8 min-w-8 items-center justify-center rounded-full bg-[#31ffb0] px-2 text-xs font-extrabold text-[#04120c]" aria-label={`${panier.lignes.length} articles`}>{panier.lignes.length}</span>
            </div>

            {panier.lignes.length === 0 ? (
              <p className="py-8 text-center text-xs text-[#A7B7A8]">Panier vide — ajoutez des produits depuis le catalogue.</p>
            ) : (
              <ul className="flex max-h-32 flex-col gap-2 overflow-y-auto pr-1">
                {panier.lignes.map((l) => (
                  <li key={l.id} className="flex items-center gap-3 rounded-xl border border-white/5 bg-black/25 p-2.5">
                    <span aria-hidden className="pos-product-media h-12 w-12 shrink-0">{l.libelle.slice(0, 2).toUpperCase()}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold text-[#F2F7F3]" title={l.libelle}>{l.libelle}</p>
                      <div className="mt-1 flex items-center gap-1.5">
                        <button type="button" onClick={() => (l.quantite <= 1 ? op.supprimerLigne(l.id) : op.majQuantite(l.id, l.quantite - 1))} aria-label={`Diminuer ${l.libelle}`} className="flex h-8 w-8 items-center justify-center rounded-md border border-[#31ffb0]/25 bg-black/40 font-bold text-[#D9F4E7]">−</button>
                        <span className="w-6 text-center text-xs font-extrabold text-[#F2F7F3]">{l.quantite}</span>
                        <button type="button" onClick={() => op.majQuantite(l.id, l.quantite + 1)} aria-label={`Augmenter ${l.libelle}`} className="flex h-8 w-8 items-center justify-center rounded-md border border-[#31ffb0]/25 bg-black/40 font-bold text-[#D9F4E7]">+</button>
                      </div>
                    </div>
                    <span className="pos-price shrink-0 text-xs font-extrabold">{afMAD(Math.round(l.quantite * l.prixUnitaireCent))}</span>
                    <button type="button" onClick={() => op.supprimerLigne(l.id)} aria-label={`Retirer ${l.libelle}`} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm text-[#F0A8A4] hover:bg-[#C66A68]/10">🗑</button>
                  </li>
                ))}
              </ul>
            )}

            <dl className="mt-3 space-y-1.5 border-t border-[#31ffb0]/15 pt-3 text-xs">
              <div className="flex justify-between text-[#CDE6DA]"><dt>Sous-total :</dt><dd className="font-bold text-[#F2F7F3]">{afMAD(totaux.baseHtNetCent)}</dd></div>
              {totaux.tvaParTaux.map((g) => (
                <div key={g.taux} className="flex justify-between text-[#CDE6DA]"><dt>TVA ({g.taux}%) :</dt><dd className="font-bold text-[#F2F7F3]">{afMAD(g.tvaCent)}</dd></div>
              ))}
              <div className="pos-total-ttc flex items-center justify-between rounded-xl px-3 py-2.5 text-base">
                <dt className="font-extrabold">Total TTC :</dt><dd className="font-black">{afMAD(totaux.ttcCent)}</dd>
              </div>
            </dl>
          </section>

          <section aria-label="Paiement" className="pos-payment-panel p-4">
            <div className="grid grid-cols-5 gap-2">
              {MODES_IMAGE.map((m) => {
                const actif = (m.cle === "visa" || m.cle === "mastercard")
                  ? (modeChoisi === "visa" || modeChoisi === "mastercard")
                  : modeChoisi === m.cle;
                return (
                  <button
                    key={m.cle + m.label}
                    type="button"
                    onClick={() => {
                      if (m.cle === "visa") { setModeChoisi(carteType); } else { setModeChoisi(m.cle); }
                      setPaiementOuvert(true);
                    }}
                    aria-pressed={actif}
                    className="pos-pay-btn flex min-h-16 flex-col items-center justify-center gap-1 px-1 text-[11px] font-bold"
                  >
                    <span aria-hidden className="text-lg">{m.icone}</span>
                    {m.label}
                  </button>
                );
              })}
            </div>

            <p className="mt-3 text-center text-[11px] text-[#A7B7A8]">
              Cliquez un moyen de paiement pour saisir le montant — la fenêtre de paiement s’ouvre, l’écran principal reste propre comme la maquette.
            </p>

            <button type="button" disabled={!peutValider} onClick={valider} className="pos-final-btn mt-3 flex min-h-14 w-full items-center justify-center gap-2 rounded-xl text-base font-black">
              <span aria-hidden>✓</span> Finaliser la Vente <span aria-hidden>›</span>
            </button>
            <div className="mt-2 flex items-center justify-between gap-2">
              <Link href="/tableau-de-bord/historique-ventes" className="text-[11px] font-bold text-[#8dffce] hover:underline">Historique / Retours</Link>
              <span className="text-[10px] text-[#A7B7A8]">Crédit et avoir via « Mode de Paiement » ci-dessus.</span>
            </div>
          </section>
        </aside>
      </div>

      {paiementOuvert && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center" role="dialog" aria-modal="true" aria-label="Fenêtre de paiement">
          <div className="neon-panel w-full max-w-md p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-base font-extrabold text-[#F2F7F3]">Paiement — {modeEffectif}</h2>
              <button type="button" onClick={() => setPaiementOuvert(false)} aria-label="Fermer la fenêtre de paiement" className="min-h-11 min-w-11 rounded-xl border border-[#31ffb0]/25 bg-black/30 text-lg text-[#F2F7F3]">✕</button>
            </div>

            {(modeEffectif === "visa" || modeEffectif === "mastercard") && (
              <div className="mb-3 grid grid-cols-2 gap-2" role="group" aria-label="Type de carte">
                {(["visa", "mastercard"] as const).map((t) => (
                  <button key={t} type="button" onClick={() => { setCarteType(t); setModeChoisi(t); }} aria-pressed={carteType === t} className={`min-h-11 rounded-lg border text-xs font-bold ${carteType === t ? "border-[#31ffb0]/60 bg-[#31ffb0]/15 text-white" : "border-[#31ffb0]/20 bg-black/30 text-[#A7B7A8]"}`}>
                    {t === "visa" ? "Visa" : "Mastercard"}
                  </button>
                ))}
                <input value={refTpe} onChange={(e) => setRefTpe(e.target.value)} placeholder="Référence TPE" aria-label="Référence TPE" className="col-span-2 min-h-11 rounded-lg border border-[#31ffb0]/25 bg-black/40 px-3 text-sm text-[#F2F7F3] outline-none placeholder:text-[#8da298]" />
              </div>
            )}
            {modeEffectif === "cheque" && (
              <div className="mb-3 grid grid-cols-2 gap-2">
                <input value={cheque.numero} onChange={(e) => setCheque({ ...cheque, numero: e.target.value })} placeholder="N° chèque" aria-label="N° chèque" className="min-h-11 rounded-lg border border-[#31ffb0]/25 bg-black/40 px-3 text-sm text-[#F2F7F3] outline-none" />
                <input value={cheque.banque} onChange={(e) => setCheque({ ...cheque, banque: e.target.value })} placeholder="Banque" aria-label="Banque" className="min-h-11 rounded-lg border border-[#31ffb0]/25 bg-black/40 px-3 text-sm text-[#F2F7F3] outline-none" />
                <input type="date" value={cheque.echeance} onChange={(e) => setCheque({ ...cheque, echeance: e.target.value })} aria-label="Échéance" className="min-h-11 rounded-lg border border-[#31ffb0]/25 bg-black/40 px-3 text-sm text-[#F2F7F3] outline-none" />
                <p className="col-span-2 text-[10px] text-[#F2D58A]">Chèque = encaissement différé, jamais espèces.</p>
              </div>
            )}
            {modeEffectif === "virement" && (
              <input value={refVirement} onChange={(e) => setRefVirement(e.target.value)} placeholder="Référence du virement" aria-label="Référence du virement" className="mb-3 min-h-11 w-full rounded-lg border border-[#31ffb0]/25 bg-black/40 px-3 text-sm text-[#F2F7F3] outline-none placeholder:text-[#8da298]" />
            )}

            <div className="flex items-end gap-2">
              <label className="flex min-w-0 flex-1 flex-col gap-1 text-[11px] font-bold text-[#A7B7A8]">
                Montant (MAD)
                <input value={montant} onChange={(e) => setMontant(e.target.value)} inputMode="decimal" placeholder={((resteACouvrir) / 100).toFixed(2)} aria-label="Montant du règlement" className="min-h-11 rounded-lg border border-[#31ffb0]/25 bg-black/40 px-3 text-right text-base font-bold text-[#F2F7F3] outline-none" />
              </label>
              <button type="button" disabled={montantCent <= 0} onClick={ajouterReglement} className="neon-btn-gold min-h-11 shrink-0 px-4 text-xs">Ajouter</button>
            </div>

            {reglements.length > 0 && (
              <ul className="mt-3 space-y-1.5 text-xs" aria-label="Règlements ajoutés">
                {reglements.map((r, i) => (
                  <li key={`${r.mode}-${i}`} className="flex items-center gap-2 rounded-lg border border-white/5 bg-black/30 px-2 py-1.5">
                    <span className="font-bold text-[#F2F7F3]">{r.mode}</span>
                    <span className="ml-auto font-mono text-[#F2D58A]">{afMAD(r.montantCent)}</span>
                    {r.mode === "cheque" && r.cheque?.statut === "en_attente" && <span className="text-[10px] text-[#F2D58A]">en attente</span>}
                    <button type="button" onClick={() => setReglements(reglements.filter((_, j) => j !== i))} aria-label="Retirer ce règlement" className="min-h-8 min-w-8 text-[#F0A8A4]">✕</button>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-3 flex justify-between border-t border-[#31ffb0]/15 pt-2 text-xs font-bold text-[#F2F7F3]">
              <span>{monnaie > 0 ? "Monnaie à rendre" : "Reste à payer"}</span>
              <span className={monnaie > 0 ? "text-[#8dffce]" : "text-[#F2D58A]"}>{afMAD(monnaie > 0 ? monnaie : resteACouvrir)}</span>
            </div>

            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => setPaiementOuvert(false)} className="neon-btn-ghost min-h-12 flex-1 text-xs">Fermer</button>
              <button type="button" disabled={!peutValider} onClick={() => { void valider(); setPaiementOuvert(false); }} className="pos-final-btn min-h-12 flex-1 rounded-xl text-sm font-black">✓ Finaliser la Vente</button>
            </div>
          </div>
        </div>
      )}

      {ticketTermine && <TicketVente ticket={ticketTermine} />}
    </section>
  );
}
