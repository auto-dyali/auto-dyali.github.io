"use client";

import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase-browser";
import { ModuleTable, type ModuleRow } from "@/components/module-table";

type ClientRecord = {
  id: string;
  code: string;
  full_name: string;
  phone: string | null;
  balance_due: number;
  vehicles: { id: string }[] | null;
};

export function ClientsModule() {
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ fullName: "", phone: "", code: "" });

  async function loadClients() {
    if (!supabase) {
      setError("Supabase n’est pas configuré.");
      setLoading(false);
      return;
    }
    const { data, error: queryError } = await supabase
      .from("clients")
      .select("id, code, full_name, phone, balance_due, vehicles(id)")
      .order("created_at", { ascending: false });
    if (queryError) setError(queryError.message);
    else setClients((data ?? []) as ClientRecord[]);
    setLoading(false);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void loadClients(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function createClient(event: FormEvent) {
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

    const { error: insertError } = await supabase.from("clients").insert({
      establishment_id: establishmentId,
      code: form.code.trim(),
      full_name: form.fullName.trim(),
      phone: form.phone.trim() || null,
    });
    if (insertError) setError(insertError.message);
    else {
      setForm({ fullName: "", phone: "", code: "" });
      setFormOpen(false);
      await loadClients();
    }
    setSaving(false);
  }

  const rows: ModuleRow[] = clients.map((client) => ({
    id: client.id,
    primary: client.full_name,
    secondary: `${client.code} · ${client.phone ?? "Téléphone non renseigné"}`,
    cells: [String(client.vehicles?.length ?? 0), `${Number(client.balance_due ?? 0).toLocaleString("fr-FR")} MAD`, "Actif"],
    status: "Actif",
  }));

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[#a8bb87]">CRM garage</p>
          <h1 className="titre-or mt-1 text-2xl font-extrabold">Clients</h1>
          <p className="mt-1 text-sm text-[#a8bb87]">Les fiches sont maintenant chargées depuis l’établissement du Manager.</p>
        </div>
        <button type="button" onClick={() => setFormOpen(true)} className="btn-or px-5 py-2.5 text-sm">+ Nouveau client</button>
      </div>

      {error && <p role="alert" className="mb-4 rounded-lg bg-[#d66868]/15 px-4 py-3 text-sm text-[#d66868]">{error}</p>}
      {loading ? <div className="carte p-8 text-center text-sm text-[#a8bb87]">Chargement des clients…</div> : <ModuleTable rows={rows} headers={["Véhicules", "Solde", "Statut"]} placeholder="Rechercher un client…" actionLabel="Nouveau client" />}

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-5" role="dialog" aria-modal="true" aria-labelledby="nouveau-client-titre">
          <form onSubmit={createClient} className="carte w-full max-w-md p-6">
            <h2 id="nouveau-client-titre" className="titre-or text-xl font-extrabold">Nouveau client</h2>
            <p className="mt-1 text-sm text-[#a8bb87]">La fiche sera enregistrée dans le garage AUTO DYALI d’Agadir.</p>
            <div className="mt-5 grid gap-3">
              <input required className="champ" placeholder="Code client (ex. CL-0006)" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} />
              <input required className="champ" placeholder="Nom complet" value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} />
              <input className="champ" type="tel" placeholder="Téléphone" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setFormOpen(false)} className="rounded-lg px-4 py-2 text-sm text-[#a8bb87] hover:bg-[#21464b]">Annuler</button>
              <button disabled={saving} type="submit" className="btn-or px-4 py-2 text-sm">{saving ? "Enregistrement…" : "Enregistrer"}</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
