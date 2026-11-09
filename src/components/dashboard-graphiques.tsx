"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase-browser";
import { CourbeCA, DonutServices } from "@/components/graphiques";

/**
 * Graphiques du tableau de bord — données 100 % réelles Supabase.
 * - Courbe : CA des 6 derniers mois (table sales).
 * - Donut : répartition du CA par catégorie de produit (sale_items → products).
 * Aucune donnée fictive : si la base est vide, on l’indique explicitement.
 */

const COULEURS = ["#31ffb0", "#d4b36a", "#5b8ee6", "#9aa5a0", "#00d084", "#f2d58a"];

const CATEGORIES_LABEL: Record<string, string> = {
  piece: "Pièces",
  accessoire: "Accessoires",
  lubrifiant: "Lubrifiants",
  merchandise: "Marchandises",
  pneumatique: "Pneumatiques",
  filtre: "Filtres",
  autrep: "Autres",
};

export function CourbeCAReelle() {
  const [series, setSeries] = useState<{ label: string; donnees: number[]; couleur: string }[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    let vivant = true;
    const charger = async () => {
      if (!supabase) { setErreur("Supabase non configuré."); return; }
      const depuis = new Date();
      depuis.setMonth(depuis.getMonth() - 5);
      depuis.setDate(1);
      depuis.setHours(0, 0, 0, 0);
      const [ventesReq, depensesReq] = await Promise.all([
        supabase.from("sales").select("total, created_at").gte("created_at", depuis.toISOString()),
        supabase.from("expenses").select("amount, created_at").gte("created_at", depuis.toISOString()),
      ]);
      if (!vivant) return;
      if (ventesReq.error) { setErreur(ventesReq.error.message); return; }

      const parMoisVentes = new Array(6).fill(0) as number[];
      for (const vente of ((ventesReq.data ?? []) as { total: number; created_at: string }[])) {
        const d = new Date(vente.created_at);
        const ecart = (new Date().getFullYear() - d.getFullYear()) * 12 + (new Date().getMonth() - d.getMonth());
        const index = 5 - ecart;
        if (index >= 0 && index < 6) parMoisVentes[index] += Number(vente.total) || 0;
      }
      const parMoisDepenses = new Array(6).fill(0) as number[];
      for (const dep of ((depensesReq.data ?? []) as { amount: number; created_at: string }[])) {
        const d = new Date(dep.created_at);
        const ecart = (new Date().getFullYear() - d.getFullYear()) * 12 + (new Date().getMonth() - d.getMonth());
        const index = 5 - ecart;
        if (index >= 0 && index < 6) parMoisDepenses[index] += Number(dep.amount) || 0;
      }
      const benefices = parMoisVentes.map((v, i) => v - parMoisDepenses[i]);
      setSeries([
        { label: "Chiffre d'affaires", donnees: parMoisVentes, couleur: "#31ffb0" },
        { label: "Dépenses", donnees: parMoisDepenses, couleur: "#d4b36a" },
        { label: "Bénéfices", donnees: benefices, couleur: "#5b8ee6" },
      ]);
    };
    const timer = window.setTimeout(() => void charger(), 0);
    return () => { vivant = false; window.clearTimeout(timer); };
  }, []);

  if (erreur) return <p className="text-xs text-[#C5716B]">{erreur}</p>;
  if (!series) return <p className="py-8 text-center text-xs text-[#A7B7A8]">Chargement des ventes…</p>;
  if (!series.some((s) => s.donnees.some((v) => v !== 0))) {
    return <p className="py-8 text-center text-xs text-[#A7B7A8]">Aucune vente enregistrée sur les 6 derniers mois — la courbe s’affichera dès la première vente.</p>;
  }
  return <CourbeCA series={series} />;
}

export function DonutCAReel() {
  const [parts, setParts] = useState<{ label: string; pourcent: number; couleur: string }[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    let vivant = true;
    const charger = async () => {
      if (!supabase) { setErreur("Supabase non configuré."); return; }
      const [lignesReq, produitsReq] = await Promise.all([
        supabase.from("sale_items").select("quantity, unit_price, product_id"),
        supabase.from("products").select("id, category"),
      ]);
      if (!vivant) return;
      if (lignesReq.error && !lignesReq.error.message.includes("does not exist")) { setErreur(lignesReq.error.message); return; }

      const catParProduit = new Map<string, string>();
      for (const p of (produitsReq.data ?? []) as { id: string; category: string }[]) {
        catParProduit.set(p.id, p.category);
      }

      const parCat = new Map<string, number>();
      let total = 0;
      for (const ligne of (lignesReq.data ?? []) as { quantity: number; unit_price: number; product_id: string | null }[]) {
        const montant = Number(ligne.quantity) * Number(ligne.unit_price);
        const categorie = ligne.product_id ? (catParProduit.get(ligne.product_id) ?? "autrep") : "autrep";
        parCat.set(categorie, (parCat.get(categorie) ?? 0) + montant);
        total += montant;
      }

      if (total <= 0) { setParts([]); return; }
      const tri = Array.from(parCat.entries()).sort((a, b) => b[1] - a[1]);
      setParts(
        tri.slice(0, 6).map(([cat, montant], index) => ({
          label: CATEGORIES_LABEL[cat] ?? cat,
          pourcent: Math.round((montant / total) * 100),
          couleur: COULEURS[index % COULEURS.length],
        })),
      );
    };
    const timer = window.setTimeout(() => void charger(), 0);
    return () => { vivant = false; window.clearTimeout(timer); };
  }, []);

  if (erreur) return <p className="text-xs text-[#C5716B]">{erreur}</p>;
  if (parts === null) return <p className="py-8 text-center text-xs text-[#A7B7A8]">Chargement des ventes…</p>;
  if (!parts.length) return <p className="py-8 text-center text-xs text-[#A7B7A8]">Aucune vente détaillée — la répartition apparaîtra après les premières ventes.</p>;
  return <DonutServices parts={parts} />;
}
