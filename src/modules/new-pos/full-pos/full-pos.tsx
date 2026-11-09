"use client";

/**
 * NEW POS — Point de vente complet (route dédiée).
 * Même moteur que le Mini-POS : un seul calcul de vente, un seul panier,
 * une seule validation transactionnelle. Adapté garage petite/moyenne/grande
 * taille via la disposition 3 zones (PC) et responsive (tablette/smartphone).
 */

import { PosMaquette } from "@/components/pos/PosMaquette";

export function FullPos() {
  return <PosMaquette />;
}
