"use client";

/**
 * NEW POS — Panier. Toutes les valeurs viennent du pricing-engine :
 * aucune somme calculée ici. Cibles tactiles ≥ 48px.
 */

import { afMAD } from "../core/money.ts";
import type { LignePanier, RemiseGlobale } from "../types";
import { TAUX_TVA_STANDARDS } from "../core/tax-engine.ts";

const TVA_OPTIONS: number[] = [...TAUX_TVA_STANDARDS];
const REMISE_OPTS = [0, 5, 10, 15, 20, 25];

export function PanierVentes({
  lignes, remiseGlobale, totaux,
  surQuantite, surRemiseLigne, surTvaLigne, surPrixUnitaire, surSupprimerLigne,
  surRemiseGlobale, surVider,
  posEdit,
}: {
  lignes: LignePanier[];
  remiseGlobale: RemiseGlobale;
  totaux: {
    brutCent: number; remiseTotalCent: number; baseHtNetCent: number;
    tvaTotalCent: number; ttcCent: number;
    tvaParTaux: { taux: number; baseCent: number; tvaCent: number }[];
  };
  surQuantite: (id: string, q: number) => void;
  surRemiseLigne: (id: string, o: { pourcent?: number; montantCent?: number }) => void;
  surTvaLigne: (id: string, t: number) => void;
  surPrixUnitaire: (id: string, c: number) => void;
  surSupprimerLigne: (id: string) => void;
  surRemiseGlobale: (r: RemiseGlobale) => void;
  surVider: () => void;
  posEdit: boolean;
}) {
  return (
    <section aria-label="Panier" className="flex min-h-0 flex-1 flex-col gap-3">
      {lignes.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-10 text-center">
          <p className="text-sm font-semibold text-[#A7B7A8]">Panier vide</p>
          <p className="max-w-[240px] text-xs text-[#8da298]">
            Ajoutez des produits depuis le catalogue, scannez un code-barres ou saisissez une prestation libre.
          </p>
        </div>
      ) : (
        <ul className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-0.5">
          {lignes.map((l) => {
            const brutL = Math.round(l.quantite * l.prixUnitaireCent);
            return (
              <li key={l.id} className="rounded-xl border border-[#46524D] bg-[#303A38] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[#E8ECE8]" title={l.libelle}>{l.libelle}</p>
                    <p className="mt-0.5 text-[11px] text-[#8da298]">
                      U. {afMAD(l.prixUnitaireCent)}
                      {l.productId ? " · stocké" : " · prestation"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => surSupprimerLigne(l.id)}
                    aria-label={`Retirer ${l.libelle} du panier`}
                    className="min-h-12 min-w-12 rounded-lg px-2 text-lg text-[#C66A68] hover:bg-[#C66A68]/10"
                  >
                    ✕
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <div className="flex items-center overflow-hidden rounded-lg border border-[#46524D]">
                    <button type="button" onClick={() => surQuantite(l.id, Math.max(0.01, Math.round((l.quantite - 1) * 100) / 100))} aria-label={`Diminuer quantité ${l.libelle}`} className="min-h-12 min-w-12 text-lg font-bold text-[#A7B7A8] hover:bg-[#49675B]/30">−</button>
                    <input
                      type="number" min={0} step={1} value={l.quantite}
                      onChange={(e) => surQuantite(l.id, Number(e.target.value) || 0)}
                      onKeyDown={(e) => { if (e.key === "Enter") surQuantite(l.id, Math.max(1, l.quantite)); }}
                      aria-label={`Quantité ${l.libelle}`}
                      inputMode="decimal"
                      className="w-14 border-0 bg-transparent py-1 text-center text-sm font-bold text-[#E8ECE8] outline-none"
                    />
                    <button type="button" onClick={() => surQuantite(l.id, l.quantite + 1)} aria-label={`Augmenter quantité ${l.libelle}`} className="min-h-12 min-w-12 text-lg font-bold text-[#A7B7A8] hover:bg-[#49675B]/30">+</button>
                  </div>
                  {posEdit && (
                    <select
                      value={l.remisePourcent} onChange={(e) => surRemiseLigne(l.id, { pourcent: Number(e.target.value) })}
                      aria-label={`Remise % ${l.libelle}`}
                      className="min-h-12 rounded-lg border border-[#46524D] bg-[#344440] px-2 text-sm text-[#E8ECE8]"
                    >
                      {REMISE_OPTS.map((r) => <option key={r} value={r}>{r === 0 ? "remise —" : `−${r}%`}</option>)}
                    </select>
                  )}
                  <select
                    value={l.tauxTva} onChange={(e) => surTvaLigne(l.id, Number(e.target.value))}
                    aria-label={`TVA ${l.libelle}`}
                    className="min-h-12 rounded-lg border border-[#46524D] bg-[#344440] px-2 text-sm text-[#E8ECE8]"
                  >
                    {TVA_OPTIONS.map((t) => <option key={t} value={t}>{t === 0 ? "exonérée" : `TVA ${t}%`}</option>)}
                  </select>
                  {posEdit && (
                    <label className="flex min-h-12 items-center gap-1 rounded-lg border border-[#46524D] bg-[#344440] px-2 text-[11px] text-[#A7B7A8]">
                      Prix
                      <input
                        type="number" min={0} step={0.01} inputMode="decimal"
                        defaultValue={(l.prixUnitaireCent / 100).toFixed(2)}
                        onBlur={(e) => {
                          const v = (e.target as HTMLInputElement).value.replace(",", ".");
                          surPrixUnitaire(l.id, Math.round(Number(v) * 100) || l.prixUnitaireCent);
                        }}
                        aria-label={`Prix unitaire ${l.libelle}`}
                        className="w-20 border-0 bg-transparent text-right text-sm font-bold text-[#E8ECE8] outline-none"
                      />
                    </label>
                  )}
                  <b className="ml-auto text-sm text-[#D0C6AE]">{afMAD(brutL)}</b>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* RÉCAP DU TICKET (valeurs du moteur de tarification, jamais recalculées ici) */}
      <div className="neon-panel space-y-2 rounded-xl p-3 text-sm">
        {lignes.length > 0 && (
          <>
            <label className="flex items-center gap-2 text-xs text-[#A7B7A8]">
              Remise ticket
              <select
                value={remiseGlobale.pourcent}
                disabled={!posEdit}
                onChange={(e) => surRemiseGlobale({ pourcent: Number(e.target.value), montantCent: remiseGlobale.montantCent })}
                aria-label="Remise ticket en pourcentage"
                className="min-h-12 flex-1 rounded-lg border border-[#46524D] bg-[#344440] px-2 text-sm text-[#E8ECE8]"
              >
                {REMISE_OPTS.map((r) => <option key={r} value={r}>{r === 0 ? "aucune" : `−${r}%`}</option>)}
              </select>
            </label>
            {posEdit && (
              <label className="flex items-center gap-2 text-xs text-[#A7B7A8]">
                Remise fixe (MAD)
                <input
                  type="number" min={0} step={0.01} inputMode="decimal"
                  defaultValue={(remiseGlobale.montantCent / 100).toFixed(2)}
                  onBlur={(e) => {
                    const v = (e.target as HTMLInputElement).value.replace(",", ".");
                    surRemiseGlobale({ pourcent: remiseGlobale.pourcent, montantCent: Math.max(0, Math.round(Number(v) * 100) || remiseGlobale.montantCent) });
                  }}
                  aria-label="Remise ticket fixe en MAD"
                  className="min-h-12 min-w-0 flex-1 rounded-lg border border-[#46524D] bg-[#344440] px-2 text-right text-sm text-[#E8ECE8]"
                />
              </label>
            )}
          </>
        )}
        <dl className="space-y-1.5 border-t border-[#46524D]/60 pt-2 text-xs">
          <div className="flex justify-between text-[#A7B7A8]"><dt>Sous-total HT</dt><dd>{afMAD(totaux.baseHtNetCent)}</dd></div>
          <div className="flex justify-between text-[#4D9B73]"><dt>Remises</dt><dd>−{afMAD(totaux.remiseTotalCent)}</dd></div>
          {totaux.tvaParTaux.map((g) => (
            <div key={g.taux} className="flex justify-between text-[#A7B7A8]">
              <dt>TVA {g.taux === 0 ? "(exonérée)" : `${g.taux}%`}</dt>
              <dd>{afMAD(g.tvaCent)}</dd>
            </div>
          ))}
          <div className="pos-total-ttc flex items-baseline justify-between rounded-xl px-3 py-2 text-base">
            <dt className="font-bold">Total TTC</dt>
            <dd className="font-extrabold">{afMAD(totaux.ttcCent)}</dd>
          </div>
        </dl>
        {lignes.length > 0 && (
          <button type="button" onClick={surVider} className="btn-sec mt-1 min-h-12 w-full text-xs">
            Vider le panier
          </button>
        )}
      </div>
    </section>
  );
}
