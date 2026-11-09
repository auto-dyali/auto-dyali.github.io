"use client";

/**
 * NEW POS — Point de vente complet (route dédiée).
 * Même moteur que le Mini-POS : un seul calcul de vente, un seul panier,
 * une seule validation transactionnelle. Adapté garage petite/moyenne/grande
 * taille via la disposition 3 zones (PC) et responsive (tablette/smartphone).
 */

import { PosEcran } from "../components/pos-ecran";

export function FullPos() {
  return (
    <section aria-label="Point de vente complet" className="flex flex-1 min-h-0 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[#A7B7A8]">Commerce</p>
          <h1 className="text-2xl font-extrabold text-[#E8ECE8]">Point de vente</h1>
          <p className="mt-1 text-sm text-[#A7B7A8]">
            Pièces, accessoires, prestations, pneumatiques — paiements mixtes,
            TVA, remises, caisse, tickets et factures.
          </p>
        </div>
      </div>

      <PosEcran />
    </section>
  );
}
