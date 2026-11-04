"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/logo";
import { Icone } from "@/components/icones";
import { supabase } from "@/lib/supabase-browser";

type Establishment = { id: string; name: string; city: string | null; plan: string; is_active: boolean };
type ClientForm = { fullName: string; email: string; phone: string; password: string };
type EmployeeForm = { fullName: string; email: string; phone: string; password: string; jobTitle: string };

export default function SuperAdminPage() {
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [clientOpen, setClientOpen] = useState(false);
  const [savingClient, setSavingClient] = useState(false);
  const [clientForm, setClientForm] = useState<ClientForm>({ fullName: "", email: "", phone: "", password: "" });
  const [employeeOpen, setEmployeeOpen] = useState(false); const [employeeSaving, setEmployeeSaving] = useState(false); const [employeeForm, setEmployeeForm] = useState<EmployeeForm>({ fullName: "", email: "", phone: "", password: "", jobTitle: "Mécanicien" });
  const router = useRouter();
  const [estConnecte, setEstConnecte] = useState(false);

  useEffect(() => {
    async function load() {
      if (!supabase) { setError("Supabase n’est pas configuré."); setLoading(false); return; }
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) { router.replace("/connexion/"); return; }
      const { data, error: queryError } = await supabase
        .from("establishments")
        .select("id, name, city, plan, is_active")
        .order("created_at", { ascending: false });
      if (queryError) setError(queryError.message);
      else { setEstablishments(data ?? []); setEstConnecte(true); }
      setLoading(false);
    }
    void load();
  }, [router]);

  async function logout() {
    await supabase?.auth.signOut();
    router.replace("/connexion/");
  }

  async function createClient(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    setSavingClient(true);
    setError(null);
    setNotice(null);
    const { data: current } = await supabase.auth.getSession();
    const adminSession = current.session;
    const { data, error: signupError } = await supabase.auth.signUp({
      email: clientForm.email.trim().toLowerCase(),
      password: clientForm.password,
      options: { data: { full_name: clientForm.fullName.trim() } },
    });

    if (adminSession) await supabase.auth.setSession({ access_token: adminSession.access_token, refresh_token: adminSession.refresh_token });
    if (signupError || !data.user) {
      setError(signupError?.message === "User already registered" ? "Cette adresse email existe déjà." : signupError?.message ?? "Impossible de créer le compte Client.");
      setSavingClient(false);
      return;
    }

    const { error: completeError } = await supabase.rpc("complete_client_account", {
      p_user_id: data.user.id,
      p_full_name: clientForm.fullName,
      p_email: clientForm.email,
      p_phone: clientForm.phone || null,
    });
    if (completeError) setError(completeError.message);
    else {
      setNotice(data.session ? "Compte Client créé et prêt à se connecter." : "Compte Client créé. Un email de confirmation a été envoyé.");
      setClientForm({ fullName: "", email: "", phone: "", password: "" });
      setClientOpen(false);
    }
    setSavingClient(false);
  }

  async function createEmployee(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    setEmployeeSaving(true); setError(null); setNotice(null);
    const admin = await supabase.auth.getSession();
    const adminSession = admin.data.session;
    const { data, error: signupError } = await supabase.auth.signUp({ email: employeeForm.email.trim().toLowerCase(), password: employeeForm.password, options: { data: { full_name: employeeForm.fullName.trim(), role: "employee" } } });
    if (adminSession) await supabase.auth.setSession({ access_token: adminSession.access_token, refresh_token: adminSession.refresh_token });
    if (signupError || !data.user) { setError(signupError?.message ?? "Impossible de créer le compte Employé."); setEmployeeSaving(false); return; }
    const { error: completeError } = await supabase.rpc("complete_employee_account", { p_user_id: data.user.id, p_full_name: employeeForm.fullName, p_email: employeeForm.email, p_phone: employeeForm.phone || null, p_job_title: employeeForm.jobTitle });
    if (completeError) setError(completeError.message); else { setNotice(data.session ? "Compte Employé créé et prêt." : "Compte Employé créé. Confirmation email envoyée."); setEmployeeForm({ fullName: "", email: "", phone: "", password: "", jobTitle: "Mécanicien" }); setEmployeeOpen(false); }
    setEmployeeSaving(false);
  }

  if (!estConnecte) return <main className="flex min-h-screen items-center justify-center bg-[#102b32] text-sm text-[#a8bb87]">Vérification de la session…</main>;

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
          <div className="flex flex-col gap-3 border-b border-[#d6b66f]/10 p-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-bold">Entreprises et établissements</h2><p className="mt-1 text-xs text-[#a8bb87]">Les données proviennent de Supabase.</p></div><div className="flex flex-wrap gap-2"><button type="button" className="rounded-lg border border-[#d6b66f]/40 px-4 py-2 text-sm text-[#e9d998]">+ Nouvel établissement</button><button type="button" onClick={() => { setNotice(null); setError(null); setEmployeeOpen(true); }} className="rounded-lg border border-[#d6b66f]/40 px-4 py-2 text-sm text-[#e9d998]">+ Nouvel Employé</button><button type="button" onClick={() => { setNotice(null); setError(null); setClientOpen(true); }} className="btn-or px-4 py-2 text-sm">+ Nouveau Client</button></div></div>
          {notice && <p className="border-b border-[#38a987]/20 bg-[#38a987]/10 px-5 py-3 text-sm text-[#69d3a8]">{notice}</p>}
          {loading && <p className="p-6 text-sm text-[#a8bb87]">Chargement…</p>}
          {error && <p className="p-6 text-sm text-[#d66868]">{error}</p>}
          {!loading && !error && <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="bg-[#21464b]/50 text-xs uppercase text-[#a8bb87]"><tr><th className="px-5 py-3">Établissement</th><th className="px-5 py-3">Ville</th><th className="px-5 py-3">Édition</th><th className="px-5 py-3">État</th></tr></thead><tbody className="divide-y divide-[#d6b66f]/10">{establishments.map((establishment) => <tr key={establishment.id}><td className="px-5 py-4 font-semibold">{establishment.name}</td><td className="px-5 py-4 text-[#a8bb87]">{establishment.city ?? "—"}</td><td className="px-5 py-4 uppercase text-[#e9d998]">{establishment.plan}</td><td className="px-5 py-4 text-[#38a987]">{establishment.is_active ? "Actif" : "Suspendu"}</td></tr>)}</tbody></table>{!establishments.length && <p className="p-8 text-center text-sm text-[#a8bb87]">Aucun établissement enregistré.</p>}</div>}
        </section>
      </div>
      {employeeOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-5"><form onSubmit={createEmployee} className="carte w-full max-w-lg p-6"><div className="flex justify-between"><div><p className="text-xs uppercase tracking-[0.2em] text-[#a8bb87]">Équipe atelier</p><h2 className="titre-or mt-1 text-xl font-extrabold">Créer un compte Employé</h2></div><button type="button" onClick={() => setEmployeeOpen(false)} className="text-2xl text-[#a8bb87]">×</button></div><div className="mt-5 grid gap-3"><input required className="champ" placeholder="Nom complet" value={employeeForm.fullName} onChange={(e) => setEmployeeForm({ ...employeeForm, fullName: e.target.value })} /><input required type="email" className="champ" placeholder="Email" value={employeeForm.email} onChange={(e) => setEmployeeForm({ ...employeeForm, email: e.target.value })} /><input className="champ" placeholder="Téléphone" value={employeeForm.phone} onChange={(e) => setEmployeeForm({ ...employeeForm, phone: e.target.value })} /><input required className="champ" placeholder="Poste" value={employeeForm.jobTitle} onChange={(e) => setEmployeeForm({ ...employeeForm, jobTitle: e.target.value })} /><input required minLength={6} type="password" className="champ" placeholder="Mot de passe temporaire" value={employeeForm.password} onChange={(e) => setEmployeeForm({ ...employeeForm, password: e.target.value })} /></div><div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setEmployeeOpen(false)} className="rounded-lg px-4 py-2 text-sm text-[#a8bb87]">Annuler</button><button disabled={employeeSaving} type="submit" className="btn-or px-4 py-2 text-sm">{employeeSaving ? "Création…" : "Créer le compte"}</button></div></form></div>}
      {clientOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-5"><form onSubmit={createClient} className="carte w-full max-w-lg p-6"><div className="flex items-start justify-between gap-4"><div><p className="text-xs uppercase tracking-[0.2em] text-[#a8bb87]">Accès immédiat</p><h2 className="titre-or mt-1 text-xl font-extrabold">Créer un compte Client</h2></div><button type="button" onClick={() => setClientOpen(false)} className="text-2xl text-[#a8bb87]" aria-label="Fermer">×</button></div><div className="mt-5 grid gap-3"><input required className="champ min-h-11" placeholder="Nom complet" value={clientForm.fullName} onChange={(event) => setClientForm({ ...clientForm, fullName: event.target.value })} /><input required type="email" className="champ min-h-11" placeholder="Email de connexion" value={clientForm.email} onChange={(event) => setClientForm({ ...clientForm, email: event.target.value })} /><input className="champ min-h-11" placeholder="Téléphone" value={clientForm.phone} onChange={(event) => setClientForm({ ...clientForm, phone: event.target.value })} /><input required minLength={6} type="password" className="champ min-h-11" placeholder="Mot de passe temporaire (6 caractères minimum)" value={clientForm.password} onChange={(event) => setClientForm({ ...clientForm, password: event.target.value })} /></div><div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setClientOpen(false)} className="rounded-lg px-4 py-2 text-sm text-[#a8bb87]">Annuler</button><button disabled={savingClient} type="submit" className="btn-or px-4 py-2 text-sm">{savingClient ? "Création…" : "Créer le compte"}</button></div></form></div>}
    </main>
  );
}
