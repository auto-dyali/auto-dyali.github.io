"use client";

/**
 * NEW POS — Mini-POS Rapide du Dashboard (maquette image 1).
 * Même moteur commercial que le POS complet (`usePos` / pricing-engine) :
 * recherche, ajout au panier,quantité et total partagent les mêmes calculs.
 * Le bouton « Encaisser » ouvre le POS complet pour le paiement détaillé.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePos } from "../hooks/use-pos";
import { afMAD } from "../core/money.ts";

export function MiniPos() {
  const { catalogue, panier, totaux, op, vider } = usePos();
  const [rech, setRech] = useState("");
  const [quantite, setQuantite] = useState(1);

  const resultat = useMemo(() => {
    const q = rech.trim().toLowerCase();
    if (!q) return catalogue.produits[0] ?? null;
    return catalogue.produits.find((p) => (
      `${p.nom} ${p.marque ?? ""} ${p.reference ?? ""} ${p.codeBarres ?? ""}`.toLowerCase().includes(q)
    )) ?? null;
  }, [catalogue.produits, rech]);

  return (
    <section aria-label="Mini-POS Rapide" className="neon-panel flex h-full min-h-72 flex-col p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-extrabold text-[#F2F7F3]">
          <span className="text-lg text-[#F2D58A]" aria-hidden>🛒</span>
          Mini-POS Rapide
        </h2>
        <span className="text-[10px] font-bold text-[#8dffce]">Moteur POS unique</span>
      </div>

      <label className="flex min-h-12 items-center gap-2 rounded-xl border border-[#31ffb0]/25 bg-black/35 px-3">
        <span aria-hidden className="text-[#A7B7A8]">⌕</span>
        <input
          value={rech}
          onChange={(e) => setRech(e.target.value)}
          placeholder="Rechercher un article..."
          aria-label="Rechercher un article"
          className="w-full border-0 bg-transparent text-sm text-[#F2F7F3] outline-none placeholder:text-[#8da298]"
        />
      </label>

      {catalogue.erreur && (
        <p className="mt-2 text-[11px] text-[#F2D58A]">{catalogue.erreur}</p>
      )}

      {resultat ? (
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-white/5 bg-black/25 p-3">
          <span aria-hidden className="pos-product-media h-14 w-14 shrink-0">
            {(resultat.marque ?? "AD").slice(0, 2).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-[#F2F7F3]" title={resultat.nom}>{resultat.nom}</p>
            <p className="pos-price text-sm font-extrabold">{afMAD(resultat.prixUnitaireCent)}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1" aria-label="Quantité">
            <button type="button" onClick={() => setQuantite((q) => Math.max(1, q - 1))} aria-label="Diminuer la quantité" className="min-h-11 min-w-11 rounded-lg border border-[#31ffb0]/25 bg-black/30 text-lg font-bold text-[#D9F4E7]">−</button>
            <span className="w-8 text-center text-sm font-extrabold text-[#F2F7F3]">{quantite}</span>
            <button type="button" onClick={() => setQuantite((q) => q + 1)} aria-label="Augmenter la quantité" className="min-h-11 min-w-11 rounded-lg border border-[#31ffb0]/25 bg-black/30 text-lg font-bold text-[#D9F4E7]">+</button>
          </div>
          <button type="button" onClick={() => { op.ajouterProduit(resultat, quantite); setQuantite(1); }} className="neon-btn-gold min-h-11 shrink-0 px-4 text-xs">
            Ajouter
          </button>
        </div>
      ) : (
        <p className="mt-4 py-6 text-center text-xs text-[#A7B7A8]">Aucun article trouvé.</p>
      )}

      {panier.lignes.length > 0 && (
        <ul className="mt-3 space-y-1.5 text-xs" aria-label="Articles du Mini-POS">
          {panier.lignes.slice(0, 3).map((l) => (
            <li key={l.id} className="flex items-center justify-between gap-2 rounded-lg border border-white/5 bg-black/20 px-2 py-1.5">
              <span className="min-w-0 truncate text-[#E8ECE8]">{l.libelle} ×{l.quantite}</span>
              <span className="shrink-0 text-[#F2D58A]">{afMAD(Math.round(l.quantite * l.prixUnitaireCent))}</span>
              <button type="button" onClick={() => op.supprimerLigne(l.id)} aria-label={`Retirer ${l.libelle}`} className="min-h-8 min-w-8 text-[#F0A8A4]">✕</button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
        <p className="mr-auto text-sm font-bold text-[#F2F7F3]">Total : <span className="pos-price">{afMAD(totaux.ttcCent)}</span></p>
        <button type="button" onClick={vider} disabled={panier.lignes.length === 0} className="neon-btn-ghost min-h-11 px-3 text-xs">Vider</button>
        <Link href="/tableau-de-bord/point-de-vente" className="neon-btn-gold min-h-12 px-5 text-sm">🛒 Encaisser</Link>
      </div>
    </section>
  );
}
