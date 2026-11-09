"use client";

/**
 * NEW POS — Mini-POS intégré au Dashboard.
 * Version compacte de l'écran de vente : même moteur, même calculs,
 * même panier que le POS complet. Une vente faite ici apparaît dans le
 * POS complet (et inversement) car le moteur est unique.
 */

import { PosEcran } from "../components/pos-ecran";

export function MiniPos() {
  return (
    <section aria-label="Mini-POS" className="rounded-xl border border-[#46524D] bg-[#303A38] p-3">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs uppercase tracking-widest text-[#8da298]">Mini-POS</p>
        <span className="text-[10px] font-semibold text-[#49675B]">Vente rapide</span>
      </div>
      <PosEcran compact />
    </section>
  );
}
