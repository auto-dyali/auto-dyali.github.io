"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase-browser";
import { genererEan13 } from "@/lib/scan-pro";
import JSBarcode from "jsbarcode";

/**
 * AUTO DYALI SCAN PRO — administration des codes-barres et QR codes.
 *
 * - Génère un code EAN-13 valide (chiffre de contrôle calculé) depuis un
 *   préfixe GS1 ; sans préfixe, le code est explicitement marqué TEST.
 * - Dessine le code-barres côté client (JSBarcode, sans appel réseau).
 * - Associe le code à un produit via le RPC `add_product_barcode`
 *   (migration 0023 — plusieurs codes par produit : variante, lot, OEM…).
 * - Affiche les codes déjà associés au produit sélectionné.
 */

type ProductLight = { id: string; sku: string; name: string; barcode: string | null };

type BarcodeRow = {
  id: string;
  barcode: string;
  type: string;
  variant: string | null;
  lot_id: string | null;
  is_primary: boolean;
  created_at: string;
  product_id: string;
};

export function ScanProModule() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [products, setProducts] = useState<ProductLight[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [barcodes, setBarcodes] = useState<BarcodeRow[]>([]);

  const [genPrefix, setGenPrefix] = useState("");
  const [genNumber, setGenNumber] = useState("");
  const [genResult, setGenResult] = useState<{ code: string; test: boolean } | null>(null);

  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => void charger(), 0);
    return () => window.clearTimeout(t);
  }, []);

  /** Dessine le code-barres EAN-13 dès qu'un code est généré. */
  useEffect(() => {
    if (!svgRef.current || !genResult) return;
    try {
      JSBarcode(svgRef.current, genResult.code, {
        format: "EAN13",
        width: 2,
        height: 70,
        displayValue: true,
        fontSize: 14,
        textMargin: 2,
        margin: 8,
      });
    } catch {
      /* code non représentable en EAN-13 : le texte reste affiché */
    }
  }, [genResult]);

  async function charger() {
    if (!supabase) {
      setError("Supabase n'est pas configuré — connexion à la base impossible.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data: produits, error: errP } = await supabase
        .from("products")
        .select("id, sku, name, barcode")
        .eq("is_active", true)
        .order("name")
        .limit(300);
      if (errP) throw new Error(errP.message);
      setProducts(produits ?? []);

      let codes: BarcodeRow[] = [];
      const { data: rows, error: errB } = await supabase
        .from("product_barcodes")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (errB) {
        // Migration 0023 pas encore exécutée : on continue avec une liste vide.
        if (!errB.message.includes("does not exist")) throw new Error(errB.message);
      } else {
        codes = rows ?? [];
      }
      setBarcodes(codes);
      setNotice(`${(produits ?? []).length} produit(s) · ${codes.length} code(s) associé(s).`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chargement impossible.");
    } finally {
      setLoading(false);
    }
  }

  function genererCode() {
    setError(null);
    setNotice(null);
    const prefixe = genPrefix.trim();
    const numero = genNumber.trim() || String(Date.now()).slice(-6);
    const { code, test, valide } = genererEan13(prefixe, numero);
    if (!valide || !code) {
      setError("Préfixe/numéro invalides — préfixe GS1 numérique (3 à 12 chiffres) attendu, ou laissez vide pour un code de test.");
      return;
    }
    setGenResult({ code, test });
    if (test) setNotice("Code de TEST généré (sans préfixe GS1) — ne jamais l'imprimer comme code réel.");
  }

  async function enregistrerGenere() {
    if (!genResult) {
      setError("Générez d'abord un code.");
      return;
    }
    if (!selectedId) {
      setError("Sélectionnez un produit avant d'enregistrer.");
      return;
    }
    if (!supabase) {
      setError("Supabase n'est pas configuré — enregistrement impossible.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { error: errRpc } = await supabase.rpc("add_product_barcode", {
        p_product_id: selectedId,
        p_barcode: genResult.code,
        p_type: "ean13",
        p_variant: null,
        p_lot_id: null,
        p_is_primary: false,
      });
      if (errRpc) throw new Error(errRpc.message);
      setNotice(`Code ${genResult.code} enregistré sur le produit.`);
      setGenResult(null);
      setGenPrefix("");
      setGenNumber("");
      await charger();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Échec de l'enregistrement.");
    } finally {
      setSaving(false);
    }
  }

  const codesDuProduit = selectedId ? barcodes.filter((b) => b.product_id === selectedId) : [];

  return (
    <div className="space-y-6">
      {error && <p role="alert" className="rounded-lg bg-[#d66868]/15 px-4 py-3 text-sm text-[#d66868]">{error}</p>}
      {notice && <p role="status" className="rounded-lg bg-[#38a987]/10 px-4 py-3 text-sm text-[#69d3a8]">{notice}</p>}
      {loading && <p className="text-sm text-[#a8bb87]">Chargement…</p>}

      {/* 1 — Génération EAN-13 */}
      <section className="carte p-5">
        <p className="text-xs uppercase tracking-[0.15em] text-[#a8bb87]">1 · Générer un code EAN-13</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <input
            type="text"
            inputMode="numeric"
            placeholder="Préfixe GS1 (vide = code de test)"
            value={genPrefix}
            onChange={(e) => setGenPrefix(e.target.value)}
            className="champ min-h-10"
          />
          <input
            type="text"
            inputMode="numeric"
            placeholder="Numéro (vide = automatique)"
            value={genNumber}
            onChange={(e) => setGenNumber(e.target.value)}
            className="champ min-h-10"
          />
          <button onClick={genererCode} className="btn-or min-h-10 text-sm">Générer</button>
        </div>

        {genResult && (
          <div className="mt-4 rounded-lg border border-[#d6b66f]/20 bg-[#21464b]/30 p-4">
            <div className="text-center">
              <div className="text-[10px] uppercase tracking-[0.15em] text-[#a8bb87]">Code généré</div>
              <div className="mt-1 font-mono text-lg font-bold text-[#f8ecc9]">{genResult.code}</div>
              {genResult.test && <div className="mt-1 text-[10px] font-semibold uppercase text-[#d66868]">Code de test — ne pas imprimer</div>}
            </div>
            <div className="mt-3 flex justify-center rounded bg-white p-2">
              <svg ref={svgRef} />
            </div>
            <button
              onClick={() => void enregistrerGenere()}
              disabled={saving || !selectedId}
              className="btn-or mt-3 w-full px-4 py-2 text-sm disabled:opacity-40"
            >
              {saving ? "Enregistrement…" : selectedId ? "Enregistrer sur le produit sélectionné" : "Sélectionnez d'abord un produit"}
            </button>
          </div>
        )}
      </section>

      {/* 2 — Produit */}
      <section className="carte p-5">
        <p className="text-xs uppercase tracking-[0.15em] text-[#a8bb87]">2 · Produit concerné</p>
        <select
          value={selectedId ?? ""}
          onChange={(e) => setSelectedId(e.target.value || null)}
          className="champ mt-3 min-h-10 w-full"
        >
          <option value="">Sélectionner un produit…</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.sku} — {p.name}
            </option>
          ))}
        </select>
      </section>

      {/* 3 — Codes associés */}
      <section className="carte p-5">
        <p className="text-xs uppercase tracking-[0.15em] text-[#a8bb87]">3 · Codes associés au produit</p>
        {selectedId ? (
          codesDuProduit.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {codesDuProduit.map((b) => (
                <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 rounded bg-[#21464b]/30 px-3 py-2">
                  <span className="font-mono text-sm text-[#f8ecc9]">{b.barcode}</span>
                  <span className="text-xs text-[#a8bb87]">
                    {b.type}
                    {b.variant ? ` · variante ${b.variant}` : ""}
                    {b.is_primary ? " · code principal" : ""}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-[#a8bb87]">Aucun code associé — générez puis enregistrez un code ci-dessus.</p>
          )
        ) : (
          <p className="mt-3 text-sm text-[#a8bb87]">Sélectionnez un produit pour voir ses codes.</p>
        )}
      </section>
    </div>
  );
}
