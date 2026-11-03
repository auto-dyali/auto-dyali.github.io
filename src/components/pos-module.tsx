"use client";

import { useMemo, useState } from "react";
import { catalogueTest, formatMad, type ProduitTest } from "@/lib/catalogue-test";

type Ligne = { produit: ProduitTest; quantite: number };

export function PosModule() {
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const total = useMemo(() => lignes.reduce((sum, ligne) => sum + ligne.produit.prix * ligne.quantite, 0), [lignes]);

  function ajouter(produit: ProduitTest) {
    setLignes((courantes) => {
      const existante = courantes.find((ligne) => ligne.produit.sku === produit.sku);
      if (existante) return courantes.map((ligne) => ligne.produit.sku === produit.sku ? { ...ligne, quantite: ligne.quantite + 1 } : ligne);
      return [...courantes, { produit, quantite: 1 }];
    });
  }

  function retirer(sku: string) {
    setLignes((courantes) => courantes.flatMap((ligne) => ligne.produit.sku !== sku ? [ligne] : ligne.quantite > 1 ? [{ ...ligne, quantite: ligne.quantite - 1 }] : []));
  }

  return (
    <section className="grid gap-5 xl:grid-cols-[1fr_22rem]">
      <div className="carte p-4 sm:p-5">
        <div className="mb-4"><p className="text-xs uppercase tracking-[0.2em] text-[#a8bb87]">Vente tactile</p><h2 className="titre-or mt-1 text-xl font-extrabold">Catalogue rapide</h2><p className="mt-1 text-xs text-[#a8bb87]">Appuyez sur un produit pour l’ajouter au ticket.</p></div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {catalogueTest.map((produit) => <button key={produit.sku} type="button" onClick={() => ajouter(produit)} className="min-h-28 touch-manipulation rounded-xl border border-[#d6b66f]/15 bg-[#21464b]/60 p-3 text-left transition active:scale-[.98] hover:border-[#d6b66f]/60"><span className="text-[10px] uppercase text-[#a8bb87]">{produit.categorie}</span><strong className="mt-1 block text-sm text-[#f8ecc9]">{produit.marque}</strong><span className="mt-1 block text-xs leading-4 text-[#f8ecc9]/80">{produit.nom}</span><span className="mt-2 block text-sm font-bold text-[#e9d998]">{formatMad(produit.prix)}</span></button>)}
        </div>
      </div>
      <aside className="carte flex h-fit flex-col p-4 sm:p-5 xl:sticky xl:top-24">
        <div className="flex items-center justify-between"><h2 className="font-bold text-[#f8ecc9]">Ticket en cours</h2><span className="rounded-full bg-[#21464b] px-2 py-1 text-xs text-[#a8bb87]">{lignes.length} article{lignes.length > 1 ? "s" : ""}</span></div>
        <div className="mt-4 flex max-h-64 flex-col gap-3 overflow-y-auto">{lignes.length === 0 ? <p className="py-8 text-center text-sm text-[#a8bb87]">Aucun article sélectionné.</p> : lignes.map((ligne) => <div key={ligne.produit.sku} className="flex items-start justify-between gap-3 border-b border-[#d6b66f]/10 pb-3"><div className="min-w-0"><p className="truncate text-sm font-semibold text-[#f8ecc9]">{ligne.produit.nom}</p><p className="text-xs text-[#a8bb87]">{ligne.quantite} × {formatMad(ligne.produit.prix)}</p></div><button type="button" onClick={() => retirer(ligne.produit.sku)} className="min-h-9 min-w-9 rounded-lg bg-[#21464b] px-2 text-sm text-[#d6b66f]" aria-label={`Retirer ${ligne.produit.nom}`}>−</button></div>)}</div>
        <div className="mt-4 border-t border-[#d6b66f]/20 pt-4"><div className="flex items-center justify-between"><span className="text-sm text-[#a8bb87]">Total TTC indicatif</span><strong className="text-xl text-[#e9d998]">{formatMad(total)}</strong></div><button type="button" disabled={!lignes.length} className="btn-or mt-4 min-h-12 w-full touch-manipulation text-sm disabled:cursor-not-allowed disabled:opacity-40">Encaisser</button></div>
      </aside>
    </section>
  );
}
