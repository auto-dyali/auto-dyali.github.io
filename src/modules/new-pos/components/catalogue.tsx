"use client";

/**
 * NEW POS — Catalogue produit (identique Mini-POS et POS complet).
 * Recherche instantanée, familles automobiles, cibles tactiles ≥ 48px,
 * badges de stock honnêtes (réel ou test — jamais de fausse donnée).
 */

import { useMemo, useState } from "react";
import { afMAD } from "../core/money.ts";
import type { Produit } from "../types";
import { ScanChamp } from "@/components/scan-champ";

export function CatalogueVentes({
  produits, familles, surAjouter, surScan, modeTest, desactive = false,
}: {
  produits: Produit[];
  familles: { cle: string; libelle: string }[];
  surAjouter: (p: Produit) => void;
  surScan: (code: string) => void;
  modeTest: boolean;
  desactive?: boolean;
}) {
  const [rech, setRech] = useState("");
  const [famille, setFamille] = useState<string | null>(null);

  const visibles = useMemo(() => {
    let ls = produits;
    if (famille) ls = ls.filter((p) => p.categorie === famille);
    const t = rech.trim().toLowerCase();
    if (t) {
      ls = ls.filter((p) => (
        `${p.nom} ${p.marque ?? ""} ${p.reference ?? ""} ${p.referenceOem ?? ""} ${p.codeBarres ?? ""}`
      ).toLowerCase().includes(t));
    }
    return ls.slice(0, 120); // plafond DOM fluide
  }, [produits, famille, rech]);

  return (
    <section aria-label="Catalogue" className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="carte flex min-w-0 flex-1 items-center gap-2 px-3 py-1">
          <span aria-hidden className="shrink-0 text-xs uppercase tracking-wide text-[#8da298]">Recherche</span>
          <input
            className="min-h-12 w-full border-0 bg-transparent text-sm text-[#E8ECE8] outline-none placeholder:text-[#8da298]"
            placeholder="Nom, marque, réf. fabricant, réf. OEM, EAN…"
            value={rech}
            onChange={(e) => setRech(e.target.value)}
            aria-label="Rechercher un produit"
          />
        </label>
        <div className="min-w-[240px]">
          <ScanChamp onCode={surScan} compact />
        </div>
      </div>

      {modeTest && (
        <p role="status" className="rounded-xl border border-[#46524D] bg-[#303A38] px-3 py-2 text-xs text-[#D6A34D]">
          Catalogue de démonstration — la base réelle n&apos;est pas joignable. Aucun prix affiché n&apos;est un prix réel.
        </p>
      )}

      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Familles">
        <button
          role="tab" aria-selected={famille === null}
          onClick={() => setFamille(null)}
          className={`min-h-12 shrink-0 rounded-full px-4 text-sm font-semibold transition ${famille === null ? "bg-[#49675B] text-[#E8ECE8]" : "bg-[#303A38] text-[#A7B7A8] hover:bg-[#37433E]"}`}
        >
          Tout
        </button>
        {familles.map((f) => (
          <button
            key={f.cle} role="tab" aria-selected={famille === f.cle}
            onClick={() => setFamille(famille === f.cle ? null : f.cle)}
            className={`min-h-12 shrink-0 rounded-full px-4 text-sm font-semibold transition ${famille === f.cle ? "bg-[#49675B] text-[#E8ECE8]" : "bg-[#303A38] text-[#A7B7A8] hover:bg-[#37433E]"}`}
          >
            {f.libelle}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {visibles.map((p) => (
          <button
            key={p.id}
            disabled={desactive}
            onClick={() => surAjouter(p)}
            title={desactive ? "Permissions POS insuffisantes." : `Ajouter ${p.nom} au panier`}
            className="carte-premium group flex min-h-28 min-w-0 flex-col justify-between gap-1 rounded-xl p-3 text-left transition hover:-translate-y-0.5 disabled:opacity-40"
          >
            <span className="min-h-10 text-[13px] font-semibold leading-snug text-[#E8ECE8] line-clamp-2">
              {p.nom}
            </span>
            <span className="text-[10px] uppercase tracking-wide text-[#8da298]">
              {p.marque ?? "—"}
              {p.reference ? ` · ${p.reference}` : ""}
            </span>
            <span className="mt-auto flex items-center justify-between gap-2">
              <b className="text-sm text-[#D0C6AE]">{afMAD(p.prixUnitaireCent)}</b>
              <i
                className={
                  p.source === "test"
                    ? "text-[10px] text-[#D6A34D]"
                    : p.stock > 0 ? "text-[10px] text-[#4D9B73]" : "text-[10px] text-[#C66A68]"
                }
              >
                {p.source === "test" ? "démo" : p.stock > 0 ? `stock ${p.stock}` : "épuisé"}
              </i>
            </span>
          </button>
        ))}
        {visibles.length === 0 && (
          <p className="col-span-full py-8 text-center text-sm text-[#8da298]">
            Aucun produit pour cette recherche.
          </p>
        )}
      </div>
    </section>
  );
}
