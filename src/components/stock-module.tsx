"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase-browser";
import { formatMad } from "@/lib/catalogue-test";
import { ScanChamp } from "@/components/scan-champ";

type Product = {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  category: string;
  sale_price: number;
  min_stock: number;
};

type Lot = { product_id: string; quantity: number };

export function StockModule() {
  const [products, setProducts] = useState<Product[]>([]);
  const [lots, setLots] = useState<Lot[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Toutes");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ sku: "", name: "", category: "piece", price: "", quantity: "" });

  async function loadStock() {
    if (!supabase) {
      setError("Supabase n’est pas configuré.");
      setLoading(false);
      return;
    }
    const [{ data: productData, error: productError }, { data: lotData, error: lotError }] = await Promise.all([
      supabase.from("products").select("id, sku, barcode, name, category, sale_price, min_stock").eq("is_active", true).order("name"),
      supabase.from("product_lots").select("product_id, quantity"),
    ]);
    if (productError || lotError) setError(productError?.message ?? lotError?.message ?? "Impossible de charger le stock.");
    else {
      setProducts((productData ?? []) as Product[]);
      setLots((lotData ?? []) as Lot[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void loadStock(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const quantityFor = (productId: string) => lots.filter((lot) => lot.product_id === productId).reduce((sum, lot) => sum + Number(lot.quantity), 0);
  const categories = useMemo(() => ["Toutes", ...Array.from(new Set(products.map((product) => product.category)))], [products]);
  const filtered = products.filter((product) => {
    const text = `${product.sku} ${product.barcode ?? ""} ${product.name} ${product.category}`.toLowerCase();
    return text.includes(query.toLowerCase()) && (category === "Toutes" || product.category === category);
  });

  async function addProduct(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    setSaving(true);
    setError(null);
    const { data: profileRows, error: profileError } = await supabase.rpc("get_my_profile");
    const establishmentId = profileRows?.[0]?.establishment_id;
    if (profileError || !establishmentId) {
      setError("Impossible de retrouver l’établissement du Manager.");
      setSaving(false);
      return;
    }
    const { data: product, error: insertError } = await supabase.from("products").insert({
      establishment_id: establishmentId,
      sku: form.sku.trim(),
      name: form.name.trim(),
      category: form.category,
      sale_price: Number(form.price),
      purchase_price: Number(form.price),
      min_stock: 2,
    }).select("id").single();
    if (insertError || !product) {
      setError(insertError?.message ?? "Le produit n’a pas pu être créé.");
      setSaving(false);
      return;
    }
    const { error: lotError } = await supabase.from("product_lots").insert({ establishment_id: establishmentId, product_id: product.id, quantity: Number(form.quantity || 0), unit_cost: Number(form.price) });
    if (lotError) setError(lotError.message);
    else {
      setForm({ sku: "", name: "", category: "piece", price: "", quantity: "" });
      setOpen(false);
      await loadStock();
    }
    setSaving(false);
  }

  return (
    <>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-xs uppercase tracking-[0.2em] text-[#A7B7A8]">Stock réel Supabase</p><h1 className="titre-or mt-1 text-2xl font-extrabold">Produits et pièces</h1><p className="mt-1 text-sm text-[#A7B7A8]">Suivi des filtres, lubrifiants et accessoires du garage.</p></div>
        <button type="button" onClick={() => setOpen(true)} className="btn-or min-h-11 px-5 text-sm">+ Nouveau produit</button>
      </div>
      {error && <p role="alert" className="mb-4 rounded-lg bg-[#C5716B]/15 px-4 py-3 text-sm text-[#C5716B]">{error}</p>}
      <section className="carte overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-[#8FB59B]/10 p-4 sm:flex-row">
          <div className="flex-1">
            <input className="champ min-h-11 w-full" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Référence, marque, produit…" />
            <div className="mt-2"><ScanChamp compact onCode={(code) => setQuery(code)} placeholder="Scanner pour localiser…" /></div>
          </div>
          <select className="champ min-h-11 sm:w-48" value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map((value) => <option key={value}>{value}</option>)}</select>
        </div>
        {loading ? <p className="p-8 text-center text-sm text-[#A7B7A8]">Chargement du stock…</p> : <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="bg-[#344440]/50 text-xs uppercase text-[#A7B7A8]"><tr><th className="px-4 py-3">Produit</th><th className="px-4 py-3">Catégorie</th><th className="px-4 py-3">Quantité</th><th className="px-4 py-3">Prix vente</th><th className="px-4 py-3">État</th></tr></thead><tbody className="divide-y divide-[#8FB59B]/10">{filtered.map((product) => { const quantity = quantityFor(product.id); const low = quantity <= product.min_stock; return <tr key={product.id}><td className="px-4 py-4"><p className="font-semibold text-[#E8ECE8]">{product.name}</p><p className="text-xs text-[#A7B7A8]">{product.sku}</p></td><td className="px-4 py-4 text-[#E8ECE8]/80">{product.category}</td><td className="px-4 py-4 text-[#E8ECE8]/80">{quantity}</td><td className="px-4 py-4 text-[#DFE7E2]">{formatMad(Number(product.sale_price))}</td><td className={`px-4 py-4 font-semibold ${low ? "text-[#C5716B]" : "text-[#5D9E7F]"}`}>{low ? "Stock faible" : "Normal"}</td></tr>; })}</tbody></table>{!filtered.length && <p className="p-8 text-center text-sm text-[#A7B7A8]">Aucun produit trouvé.</p>}</div>}
      </section>
      {open && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-5"><form onSubmit={addProduct} className="carte w-full max-w-md p-6"><h2 className="titre-or text-xl font-extrabold">Nouveau produit</h2><div className="mt-5 grid gap-3">
        <div><p className="mb-1 text-xs text-[#A7B7A8]">Scannez le code-barres pour remplir la référence :</p><ScanChamp onCode={(code) => setForm((f) => ({ ...f, sku: code }))} placeholder="EAN-13 du produit…" /></div>
        <input required className="champ min-h-11" placeholder="SKU / référence" value={form.sku} onChange={(event) => setForm({ ...form, sku: event.target.value })} /><input required className="champ min-h-11" placeholder="Nom du produit" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /><select className="champ min-h-11" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}><option value="piece">Pièce / filtre</option><option value="lubrifiant">Lubrifiant</option><option value="accessoire">Accessoire</option></select><input required min="0" step="0.01" type="number" className="champ min-h-11" placeholder="Prix de vente MAD" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} /><input min="0" step="1" type="number" className="champ min-h-11" placeholder="Quantité initiale" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} /></div><div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setOpen(false)} className="rounded-lg px-4 py-2 text-sm text-[#A7B7A8]">Annuler</button><button disabled={saving} type="submit" className="btn-or px-4 py-2 text-sm">{saving ? "Enregistrement…" : "Enregistrer"}</button></div></form></div>}
    </>
  );
}
