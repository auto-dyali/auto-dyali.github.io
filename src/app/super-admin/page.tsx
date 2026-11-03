"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/logo";
import { Icone } from "@/components/icones";
import { supabase } from "@/lib/supabase-browser";

type Establishment = { id: string; name: string; city: string | null; plan: string; is_active: boolean };

export default function SuperAdminPage() {
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    async function load() {
      if (!supabase) { setError("Supabase n’est pas configuré."); setLoading(false); return; }
      const { data, error: queryError } = await supabase
        .from("establishments")
        .select("id, name, city, plan, is_active")
        .order("created_at", { ascending: false });
      if (queryError) setError(queryError.message);
      else setEstablishments(data ?? []);
      setLoading(false);
    }
    void load();
  }, []);

  async function logout() {
    await supabase?.auth.signOut();
    router.replace("/connexion/");
  }

  return (
    <main className="min-h-screen bg-[#102b32] text-[#f8ecc9]">
      <header className="flex items-center justify-between border-b border-[#d6b66f]/15 bg-[#193a40] px-5 py-4 lg:px-10">
        <Logo compact />
        <div className="flex items-center gap-4"><span className="hidden text-sm text-[#a8bb87] sm:block">Super Admin · ACH GROUP</span><button onClick={logout} className="text-sm text-[#d6b66f] hover:underline">Déconnexion</button></div>
      </header>
      <div className="mx-auto max-w-7xl p-5 lg:p-10">
        <p className="text-xs uppercase tracking-[0.2em] text-[#a8bb87]">Administration centrale</p>
        <h1 className="titre-or mt-2 text-3xl font-extrabold">Dashboard Super Admin</h1>
        <p className="mt-2 text-sm text-[#a8bb87]">Gérez les entreprises, les établissements, les éditions et les accès.</p>

        <section className="mt-8 grid gap-4 sm:grid-cols-3">
          {[{ label: "Établissements", value: establishments.length, icon: "client" as const }, { label: "Éditions actives", value: new Set(establishments.map((e) => e.plan)).size, icon: "rapport" as const }, { label: "État plateforme", value: "Actif", icon: "benefice" as const }].map((card) => <article key={card.label} className="carte flex items-center gap-4 p-5"><span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#21464b]"><Icone nom={card.icon} taille={24} /></span><div><p className="text-xs text-[#a8bb87]">{card.label}</p><p className="titre-or mt-1 text-2xl font-extrabold">{card.value}</p></div></article>)}
        </section>

        <section className="carte mt-6 overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#d6b66f]/10 p-5"><div><h2 className="font-bold">Entreprises et établissements</h2><p className="mt-1 text-xs text-[#a8bb87]">Les données proviennent de Supabase.</p></div><button type="button" className="btn-or px-4 py-2 text-sm">+ Nouvel établissement</button></div>
          {loading && <p className="p-6 text-sm text-[#a8bb87]">Chargement…</p>}
          {error && <p className="p-6 text-sm text-[#d66868]">{error}</p>}
          {!loading && !error && <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="bg-[#21464b]/50 text-xs uppercase text-[#a8bb87]"><tr><th className="px-5 py-3">Établissement</th><th className="px-5 py-3">Ville</th><th className="px-5 py-3">Édition</th><th className="px-5 py-3">État</th></tr></thead><tbody className="divide-y divide-[#d6b66f]/10">{establishments.map((establishment) => <tr key={establishment.id}><td className="px-5 py-4 font-semibold">{establishment.name}</td><td className="px-5 py-4 text-[#a8bb87]">{establishment.city ?? "—"}</td><td className="px-5 py-4 uppercase text-[#e9d998]">{establishment.plan}</td><td className="px-5 py-4 text-[#38a987]">{establishment.is_active ? "Actif" : "Suspendu"}</td></tr>)}</tbody></table>{!establishments.length && <p className="p-8 text-center text-sm text-[#a8bb87]">Aucun établissement enregistré.</p>}</div>}
        </section>
      </div>
    </main>
  );
}
