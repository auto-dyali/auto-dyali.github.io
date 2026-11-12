"use client";















import { useCallback, useEffect, useState, type FormEvent } from "react";







import { useRouter } from "next/navigation";







import Link from "next/link";







import { Logo } from "@/components/logo";







import { Icone } from "@/components/icones";







import { supabase } from "@/lib/supabase-browser";







import { FEATURE_LABEL } from "@/lib/features";















type Establishment = {







  id: string;







  name: string;







  city: string | null;







  plan: string;







  is_active: boolean;







  created_at: string;







  suspended_at: string | null;







};







type ClientForm = { fullName: string; email: string; phone: string; password: string };







type EmployeeForm = { fullName: string; email: string; phone: string; password: string; jobTitle: string };







type PlanRow = {







  code: string;







  label: string;







  description: string;







  price_monthly: number | null;







  price_yearly: number | null;







  trial_days: number;







  max_users: number;







  max_sites: number;







  storage_mb: number;







};







type FeatureRow = { plan_code: string; feature_key: string; enabled: boolean };







type AuditRow = { id: string; action: string; entity: string; payload_json: unknown; created_at: string };







type ClientRow = {







  id: string;







  full_name: string;







  email: string | null;







  phone: string | null;







  code: string | null;







  establishment_id: string | null;







  role: string;







  is_active: boolean;







  created_at: string | null;







};















/** Fonctionnalités pilotées depuis l'écran commercial (moteur de droits). */







const FEATURES_PILOTEES = [







  "workshop", "appointments", "tires", "barcode", "excel", "purchasing",







  "employees", "stock_advanced", "reports_finance", "cheques", "alerts", "crm",







  "ai", "automation", "analytics", "multisite", "whatsapp", "custom_reports",







  "advanced_permissions", "advanced_suppliers",







];















const dateCourte = (v: unknown) => (v ? new Date(String(v)).toLocaleDateString("fr-FR") : "—");















export default function SuperAdminPage() {







  const [establishments, setEstablishments] = useState<Establishment[]>([]);







  const [plans, setPlans] = useState<PlanRow[]>([]);







  const [features, setFeatures] = useState<FeatureRow[]>([]);







  const [audit, setAudit] = useState<AuditRow[]>([]);







  const [loading, setLoading] = useState(true);







  const [error, setError] = useState<string | null>(null);







  const [notice, setNotice] = useState<string | null>(null);







  const [traitement, setTraitement] = useState<string | null>(null);















  const [clientOpen, setClientOpen] = useState(false);







  const [savingClient, setSavingClient] = useState(false);







  const [clientForm, setClientForm] = useState<ClientForm>({ fullName: "", email: "", phone: "", password: "" });







  const [employeeOpen, setEmployeeOpen] = useState(false);







  const [employeeSaving, setEmployeeSaving] = useState(false);







  const [employeeForm, setEmployeeForm] = useState<EmployeeForm>({ fullName: "", email: "", phone: "", password: "", jobTitle: "Mécanicien" });







  const [etabOpen, setEtabOpen] = useState(false);







  const [etabSaving, setEtabSaving] = useState(false);







  const [etabForm, setEtabForm] = useState({ name: "", slug: "", city: "", phone: "", email: "", plan: "standard" });















  const [clientDeleteOpen, setClientDeleteOpen] = useState(false);







  const [clientToDelete, setClientToDelete] = useState<string | null>(null);







  const [clientDeleting, setClientDeleting] = useState(false);







  const [clients, setClients] = useState<ClientRow[]>([]);















  /* --- Gestion détaillée des clients --- */







  const [clientDetailOpen, setClientDetailOpen] = useState(false);







  const [clientDetail, setClientDetail] = useState<ClientRow | null>(null);















  const [resetPwdOpen, setResetPwdOpen] = useState(false);







  const [resetPwdTarget, setResetPwdTarget] = useState<{ id: string; email: string | null } | null>(null);







  const [resetPwdSending, setResetPwdSending] = useState(false);















  const [editCodeOpen, setEditCodeOpen] = useState(false);







  const [editCodeTarget, setEditCodeTarget] = useState<{ id: string; code: string | null } | null>(null);







  const [editCodeValue, setEditCodeValue] = useState("");







  const [editCodeSaving, setEditCodeSaving] = useState(false);















  const [editEmailOpen, setEditEmailOpen] = useState(false);







  const [editEmailTarget, setEditEmailTarget] = useState<{ id: string; email: string | null } | null>(null);







  const [editEmailValue, setEditEmailValue] = useState("");







  const [editEmailSaving, setEditEmailSaving] = useState(false);















  const [toggleActiveOpen, setToggleActiveOpen] = useState(false);







  const [toggleActiveTarget, setToggleActiveTarget] = useState<{ id: string; is_active: boolean; role?: string } | null>(null);







  const [toggleActiveSaving, setToggleActiveSaving] = useState(false);















  const router = useRouter();







  const [estConnecte, setEstConnecte] = useState(false);







  const [accesRefuse, setAccesRefuse] = useState(false);







  /** Horodatage figé au chargement : Date.now() est impur au render (React Compiler). */







  const [maintenant, setMaintenant] = useState<number | null>(null);















  const charger = useCallback(async () => {







    if (!supabase) { setError("Supabase n’est pas configuré."); setLoading(false); return; }







    const [etabs, plansData, featuresData, auditData, clientsData, clientCodesData] = await Promise.all([







      supabase.from("establishments").select("id, name, city, plan, is_active, created_at, suspended_at").order("created_at", { ascending: false }),







      supabase.from("plans").select("code, label, description, price_monthly, price_yearly, trial_days, max_users, max_sites, storage_mb").order("price_monthly"),







      supabase.from("plan_features").select("plan_code, feature_key, enabled"),







      supabase.from("audit_log").select("id, action, entity, payload_json, created_at").order("created_at", { ascending: false }).limit(12),







      supabase.from("profiles").select("id, full_name, email, phone, establishment_id, role, is_active").eq("role", "manager"),







      supabase.from("clients").select("code, full_name, phone, email"),







    ]);







    if (etabs.error) setError(etabs.error.message);
    if (clientsData.error) setError(`Erreur chargement des profils managers : ${clientsData.error.message}`);







    else setEstablishments((etabs.data ?? []) as Establishment[]);







    setPlans((plansData.data ?? []) as PlanRow[]);







    setFeatures((featuresData.data ?? []) as FeatureRow[]);







    setAudit((auditData.data ?? []) as AuditRow[]);







    // Fusionner profiles avec clients pour avoir le code client







    const clientCodesMap = new Map<string, string>();







    (clientsData.data ?? []).forEach((c) => {







      if ((c as any).email) clientCodesMap.set((c as any).email.toLowerCase(), (c as any).code);







      if ((c as any).phone) clientCodesMap.set((c as any).phone, (c as any).code);







    });







    setClients((clientsData.data ?? [] as any[]).map((c) => ({







      id: (c as any).id,







      full_name: (c as any).full_name,







      email: (c as any).email,







      phone: (c as any).phone,







      code: clientCodesMap.get((c as any).email?.toLowerCase()) || clientCodesMap.get((c as any).phone) || null,







      establishment_id: (c as any).establishment_id,







      role: (c as any).role,







      is_active: (c as any).is_active,







      created_at: null,







    })));







    setLoading(false);







  }, []);















  useEffect(() => {







    async function load() {







      if (!supabase) { setError("Supabase n’est pas configuré."); setLoading(false); return; }







      const { data: sessionData } = await supabase.auth.getSession();







      if (!sessionData.session) { router.replace("/connexion/"); return; }







      const { data: roleData } = await supabase.rpc("get_my_profile");







      if (roleData?.[0]?.role && roleData[0].role !== "saas_admin") {







        setAccesRefuse(true);







        setLoading(false);







        return;







      }







      setMaintenant(Date.now());







      await charger();







      setEstConnecte(true);







    }







    void load();







  }, [router, charger]);















  async function logout() {







    await supabase?.auth.signOut();







    router.replace("/connexion/");







  }















  /* -----------------------------------------------------------------







   * KPI réels calculés depuis les données Supabase







   * ----------------------------------------------------------------- */







  const kpis = [







    { label: "Total entreprises", value: establishments.length, icon: "client" as const },







    { label: "Entreprises actives", value: establishments.filter((e) => e.is_active).length, icon: "benefice" as const },







    {







      label: "En essai",







      value: maintenant === null ? "…" : establishments.filter((e) => {







        if (!e.is_active) return false;







        const fin = new Date(e.created_at).getTime() + 14 * 86400_000;







        return fin > maintenant;







      }).length,







      icon: "planning" as const,







    },







    { label: "Suspendues", value: establishments.filter((e) => !e.is_active).length, icon: "deconnexion" as const },







    { label: "Offres STANDARD", value: establishments.filter((e) => e.plan === "standard").length, icon: "carton" as const },







    { label: "Offres SILVER", value: establishments.filter((e) => e.plan === "silver").length, icon: "carton" as const },







    { label: "Offres GOLD", value: establishments.filter((e) => e.plan === "gold").length, icon: "ca" as const },







    {







      label: "Nouveaux inscrits (30 j)",







      value: maintenant === null ? "…" : establishments.filter((e) => maintenant - new Date(e.created_at).getTime() < 30 * 86400_000).length,







      icon: "rapport" as const,







    },







  ];















  /* -----------------------------------------------------------------







   * Actions sensibles (toutes journalisées via RPC)







   * ----------------------------------------------------------------- */







  async function changerForfait(id: string, plan: string) {







    if (!supabase) return;







    setTraitement(id);







    setError(null);







    const { error: rpcError } = await supabase.rpc("admin_change_plan", { p_establishment_id: id, p_plan: plan });







    if (rpcError) setError(rpcError.message);







    else setNotice("Forfait mis à jour et journalisé.");







    await charger();







    setTraitement(null);







  }















  async function basculerEtat(etab: Establishment) {







    if (!supabase) return;







    setTraitement(etab.id);







    setError(null);







    const { error: rpcError } = await supabase.rpc("admin_set_establishment_status", {







      p_establishment_id: etab.id,







      p_active: !etab.is_active,







    });







    if (rpcError) setError(rpcError.message);







    else setNotice(etab.is_active ? "Établissement suspendu (données conservées)." : "Établissement réactivé.");







    await charger();







    setTraitement(null);







  }















  async function creerEtablissement(event: FormEvent) {







    event.preventDefault();







    if (!supabase) return;







    setEtabSaving(true);







    setError(null);







    setNotice(null);







    const slugBase = (etabForm.slug || etabForm.name)







      .toLowerCase()







      .normalize("NFD")







      .replace(/[\u0300-\u036f]/g, "")







      .replace(/[^a-z0-9]+/g, "-")







      .replace(/(^-|-$)/g, "");







    const { data, error: rpcError } = await supabase.rpc("admin_create_establishment", {







      p_name: etabForm.name.trim(),







      p_slug: `${slugBase}-${String(Date.now()).slice(-4)}`,







      p_city: etabForm.city.trim() || null,







      p_phone: etabForm.phone.trim() || null,







      p_email: etabForm.email.trim() || null,







      p_plan: etabForm.plan,







    });







    if (rpcError) setError(rpcError.message);







    else {







      setNotice(`Établissement créé (id ${String(data).slice(0, 8)}…). Essai 14 jours ouvert.`);







      setEtabForm({ name: "", slug: "", city: "", phone: "", email: "", plan: "standard" });







      setEtabOpen(false);







      await charger();







    }







    setEtabSaving(false);







  }















  async function enregistrerPlan(plan: PlanRow) {







    if (!supabase) return;







    setTraitement(`plan-${plan.code}`);







    setError(null);







    const champ = (id: string) => {







      const el = document.getElementById(id) as HTMLInputElement | null;







      return el;







    };







    const mensuel = champ(`price-m-${plan.code}`)?.value ?? "";







    const annuel = champ(`price-y-${plan.code}`)?.value ?? "";







    const { error: rpcError } = await supabase.rpc("admin_save_plan", {







      p_code: plan.code,







      p_price_monthly: mensuel === "" ? null : Number(mensuel),







      p_price_yearly: annuel === "" ? null : Number(annuel),







      p_trial_days: Number(champ(`trial-${plan.code}`)?.value ?? plan.trial_days),







      p_max_users: Number(champ(`users-${plan.code}`)?.value ?? plan.max_users),







      p_max_sites: Number(champ(`sites-${plan.code}`)?.value ?? plan.max_sites),







      p_storage_mb: Number(champ(`storage-${plan.code}`)?.value ?? plan.storage_mb),







    });







    if (rpcError) setError(rpcError.message);







    else {







      setNotice(`Offre ${plan.label} enregistrée.`);







      await charger();







    }







    setTraitement(null);







  }















  async function basculerFeature(planCode: string, feature: string, enabled: boolean) {







    if (!supabase) return;







    setError(null);







    const { error: rpcError } = await supabase.rpc("admin_set_feature", {







      p_plan_code: planCode,







      p_feature: feature,







      p_enabled: enabled,







    });







    if (rpcError) setError(rpcError.message);







    else {







      setFeatures((current) =>







        current.map((f) => (f.plan_code === planCode && f.feature_key === feature ? { ...f, enabled } : f)),







      );







    }







  }















  const estActive = (planCode: string, feature: string) =>







    features.find((f) => f.plan_code === planCode && f.feature_key === feature)?.enabled ?? false;















  /* -----------------------------------------------------------------







   * Création de comptes Client / Employé (existante, conservée)







   * ----------------------------------------------------------------- */







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







    setEmployeeSaving(true);







    setError(null);







    setNotice(null);







    const admin = await supabase.auth.getSession();







    const adminSession = admin.data.session;







    const { data, error: signupError } = await supabase.auth.signUp({







      email: employeeForm.email.trim().toLowerCase(),







      password: employeeForm.password,







      options: { data: { full_name: employeeForm.fullName.trim(), role: "employee" } },







    });







    if (adminSession) await supabase.auth.setSession({ access_token: adminSession.access_token, refresh_token: adminSession.refresh_token });







    if (signupError || !data.user) {







      setError(signupError?.message ?? "Impossible de créer le compte Employé.");







      setEmployeeSaving(false);







      return;







    }







    const { error: completeError } = await supabase.rpc("complete_employee_account", {







      p_user_id: data.user.id,







      p_full_name: employeeForm.fullName,







      p_email: employeeForm.email,







      p_phone: employeeForm.phone || null,







      p_job_title: employeeForm.jobTitle,







    });







    if (completeError) setError(completeError.message);







    else {







      setNotice(data.session ? "Compte Employé créé et prêt." : "Compte Employé créé. Confirmation email envoyée.");







      setEmployeeForm({ fullName: "", email: "", phone: "", password: "", jobTitle: "Mécanicien" });







      setEmployeeOpen(false);







    }







    setEmployeeSaving(false);







  }















  /* -----------------------------------------------------------------







   * Supprimer un compte client







   * ----------------------------------------------------------------- */







  async function deleteClientAccount(userId: string) {







    if (!supabase) return;







    setClientDeleting(true);







    setError(null);







    try {







      const { error } = await supabase.rpc("admin_delete_client_account", {







        p_user_id: userId,







      });







      if (error) throw new Error(error.message);







      setClientDeleteOpen(false);







      setClientToDelete(null);







      setClientDeleting(false);







      await charger();







      setNotice("Compte client supprimé.");







    } catch (e) {







      setClientDeleting(false);







      setError(e instanceof Error ? e.message : "Suppression impossible.");







    }







  }















  /* -----------------------------------------------------------------







   * Réinitialisation du mot de passe client







   * ----------------------------------------------------------------- */







  async function resetClientPassword(userId: string, email: string | null) {







    if (!supabase || !email) return;







    setResetPwdSending(true);







    setError(null);







    try {







      // Déclencher l'email de réinitialisation via Supabase Auth







      const { error } = await supabase.auth.resetPasswordForEmail(email, {







        redirectTo: `${window.location.origin}/mot-de-passe-traite`,







      });







      if (error) throw new Error(error.message);







      setResetPwdOpen(false);







      setResetPwdTarget(null);







      setResetPwdSending(false);







      setNotice("Email de réinitialisation envoyé.");







    } catch (e) {







      setResetPwdSending(false);







      setError(e instanceof Error ? e.message : "Réinitialisation impossible.");







    }







  }















  /* -----------------------------------------------------------------







   * Modification du code client







   * ----------------------------------------------------------------- */







  async function editClientCode(clientId: string, newCode: string) {







    if (!supabase) return;







    const codeExists = clients.some((c) => c.id !== clientId && c.code === newCode.trim());
    if (codeExists) {
      setError("Ce code client est déjà utilisé par un autre client.");
      return;
    }







    setEditCodeSaving(true);







    setError(null);







    try {







      const { error } = await supabase







        .from("clients")







        .update({ code: newCode.trim() })







        .eq("id", clientId);







      if (error) throw new Error(error.message);







      setEditCodeOpen(false);







      setEditCodeTarget(null);







      setEditCodeValue("");







      setEditCodeSaving(false);







      await charger();







      setNotice("Code client mis à jour.");







    } catch (e) {







      setEditCodeSaving(false);







      setError(e instanceof Error ? e.message : "Modification du code impossible.");







    }







  }















  /* -----------------------------------------------------------------







   * Modification de l'email client







   * ----------------------------------------------------------------- */







  async function editClientEmail(clientId: string, newEmail: string) {







    if (!supabase) return;







    setEditEmailSaving(true);







    setError(null);







    try {







      const { error } = await supabase.from("profiles").update({ email: newEmail.trim() }).eq("id", clientId);







      if (error) throw new Error(error.message);







      setEditEmailOpen(false);







      setEditEmailTarget(null);







      setEditEmailValue("");







      setEditEmailSaving(false);







      await charger();







      setNotice("Email client mis à jour.");







    } catch (e) {







      setEditEmailSaving(false);







      setError(e instanceof Error ? e.message : "Modification de l'email impossible.");







    }







  }















  /* -----------------------------------------------------------------







   * Activation / désactivation d'un compte client







   * ----------------------------------------------------------------- */







  async function toggleClientActive(userId: string, isActive: boolean) {







    if (!supabase) return;







    if (toggleActiveTarget?.role === "saas_admin") {
      setError("Impossible de désactiver un compte Super Admin.");
      return;
    }







    setToggleActiveSaving(true);







    setError(null);







    try {







      const { error } = await supabase.from("profiles").update({ is_active: !isActive }).eq("id", userId);







      if (error) throw new Error(error.message);







      setToggleActiveOpen(false);







      setToggleActiveTarget(null);







      setToggleActiveSaving(false);







      await charger();







      setNotice(isActive ? "Compte désactivé." : "Compte réactivé.");







    } catch (e) {







      setToggleActiveSaving(false);







      setError(e instanceof Error ? e.message : "Modification du statut impossible.");







    }







  }















  if (accesRefuse) return (







    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#252D2D] p-6 text-center">







      <p className="text-sm text-[#C5716B]">Accès refusé : l’espace Super Admin est réservé à l’administrateur de la plateforme.</p>







      <button type="button" onClick={() => router.replace("/connexion/")} className="btn-or px-5 py-2 text-sm">Revenir à la connexion</button>







    </main>







  );















  if (!estConnecte) return <main className="flex min-h-screen items-center justify-center bg-[#252D2D] text-sm text-[#A7B7A8]">Vérification de la session…</main>;















  return (







    <main className="min-h-screen bg-[#252D2D] text-[#E8ECE8]">







      <header className="flex items-center justify-between border-b border-[#8FB59B]/15 bg-[#2C3735] px-5 py-4 lg:px-10">







        <Logo compact />







        <div className="flex items-center gap-4"><span className="hidden text-sm text-[#A7B7A8] sm:block">Super Admin · AUTO DYALI</span><button onClick={() => void logout()} className="text-sm text-[#8FB59B] hover:underline">Déconnexion</button></div>







      </header>







      <div className="mx-auto max-w-7xl p-5 lg:p-10">







        <p className="text-xs uppercase tracking-[0.2em] text-[#A7B7A8]">Administration centrale</p>







        <h1 className="titre-or mt-2 text-3xl font-extrabold">Pilotage de la plateforme</h1>







        <p className="mt-2 text-sm text-[#A7B7A8]">Entreprises, forfaits, droits et journal d’audit AUTO DYALI.</p>















        {notice && <p role="status" className="mt-5 rounded-lg bg-[#5D9E7F]/10 px-4 py-3 text-sm text-[#7FBF9E]">{notice}</p>}







        {error && <p role="alert" className="mt-5 rounded-lg bg-[#C5716B]/15 px-4 py-3 text-sm text-[#C5716B]">{error}</p>}















        {/* KPI réels */}







        <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">







          {kpis.map((card) => (







            <article key={card.label} className="carte flex items-center gap-4 p-5">







              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#344440]"><Icone nom={card.icon} taille={24} /></span>







              <div>







                <p className="text-xs text-[#A7B7A8]">{card.label}</p>







                <p className="titre-or mt-1 text-2xl font-extrabold">{loading ? "…" : card.value}</p>







              </div>







            </article>







          ))}







        </section>















        {/* Entreprises */}







        <section className="carte mt-6 overflow-hidden">







          <div className="flex flex-col gap-3 border-b border-[#8FB59B]/10 p-5 sm:flex-row sm:items-center sm:justify-between">







            <div><h2 className="font-bold">Entreprises et établissements</h2><p className="mt-1 text-xs text-[#A7B7A8]">Données Supabase — toute action sensible est journalisée.</p></div>







            <div className="flex flex-wrap gap-2">







              <Link href="/super-admin/crm" className="rounded-lg border border-[#8FB59B]/40 px-4 py-2 text-sm text-[#DFE7E2]">CRM commercial</Link>







              <button type="button" onClick={() => { setNotice(null); setError(null); setEtabOpen(true); }} className="btn-or px-4 py-2 text-sm">+ Nouvel établissement</button>







              <button type="button" onClick={() => { setNotice(null); setError(null); setEmployeeOpen(true); }} className="rounded-lg border border-[#8FB59B]/40 px-4 py-2 text-sm text-[#DFE7E2]">+ Nouvel Employé</button>







              <button type="button" onClick={() => { setNotice(null); setError(null); setClientOpen(true); }} className="rounded-lg border border-[#8FB59B]/40 px-4 py-2 text-sm text-[#DFE7E2]">+ Nouveau Client</button>







            </div>







          </div>







          {loading && <p className="p-6 text-sm text-[#A7B7A8]">Chargement…</p>}







          {!loading && <div className="overflow-x-auto">







            <table className="w-full min-w-[840px] text-left text-sm">







              <thead className="bg-[#344440]/50 text-xs uppercase text-[#A7B7A8]">







                <tr>







                  <th className="px-5 py-3">Établissement</th>







                  <th className="px-5 py-3">Ville</th>







                  <th className="px-5 py-3">Inscrit le</th>







                  <th className="px-5 py-3">Forfait</th>







                  <th className="px-5 py-3">État</th>







                  <th className="px-5 py-3 text-right">Actions</th>







                </tr>







              </thead>







              <tbody className="divide-y divide-[#8FB59B]/10">







                {establishments.map((establishment) => (







                  <tr key={establishment.id}>







                    <td className="px-5 py-4 font-semibold">{establishment.name}</td>







                    <td className="px-5 py-4 text-[#A7B7A8]">{establishment.city ?? "—"}</td>







                    <td className="px-5 py-4 text-[#A7B7A8]">{dateCourte(establishment.created_at)}</td>







                    <td className="px-5 py-4">







                      <select







                        aria-label={`Forfait de ${establishment.name}`}







                        className="champ min-h-9 py-1 text-xs uppercase"







                        value={establishment.plan}







                        disabled={traitement === establishment.id}







                        onChange={(e) => void changerForfait(establishment.id, e.target.value)}







                      >







                        <option value="standard">STANDARD</option>







                        <option value="silver">SILVER</option>







                        <option value="gold">GOLD</option>







                      </select>







                    </td>







                    <td className={`px-5 py-4 font-semibold ${establishment.is_active ? "text-[#5D9E7F]" : "text-[#C5716B]"}`}>







                      {establishment.is_active ? "Actif" : "Suspendu"}







                    </td>







                    <td className="px-5 py-4 text-right">







                      <button







                        type="button"







                        disabled={traitement === establishment.id}







                        onClick={() => void basculerEtat(establishment)}







                        className={`rounded-lg border px-3 py-1.5 text-xs ${establishment.is_active ? "border-[#C5716B]/40 text-[#C5716B] hover:bg-[#C5716B]/10" : "border-[#5D9E7F]/40 text-[#5D9E7F] hover:bg-[#5D9E7F]/10"} disabled:opacity-40`}







                      >







                        {traitement === establishment.id ? "…" : establishment.is_active ? "Suspendre" : "Réactiver"}







                      </button>







                    </td>







                  </tr>







                ))}







              </tbody>







            </table>







            {!establishments.length && <p className="p-8 text-center text-sm text-[#A7B7A8]">Aucun établissement enregistré.</p>}







          </div>}







        </section>















        {/* Comptes clients */}







        <section className="mt-6 overflow-hidden">







          <div className="flex flex-col gap-3 border-b border-[#8FB59B]/10 p-5 sm:flex-row sm:items-center sm:justify-between">







            <div><h2 className="font-bold">Comptes clients</h2><p className="mt-1 text-xs text-[#A7B7A8]">Gestion des comptes clients — modification, réinitialisation, suspension.</p></div>







          </div>







          {!loading && <div className="overflow-x-auto">







            <table className="w-full min-w-[840px] text-left text-sm">







              <thead className="bg-[#344440]/50 text-xs uppercase text-[#A7B7A8]">







                <tr>







                  <th className="px-5 py-3">Client</th>







                  <th className="px-5 py-3">Email</th>







                  <th className="px-5 py-3">Téléphone</th>







                  <th className="px-5 py-3">Code client</th>







                  <th className="px-5 py-3">Statut</th>







                  <th className="px-5 py-3 text-right">Actions</th>







                </tr>







              </thead>







              <tbody className="divide-y divide-[#8FB59B]/10">







                {clients.map((client) => (







                  <tr key={client.id}>







                    <td className="px-5 py-4 font-semibold">{client.full_name}</td>







                    <td className="px-5 py-4 text-[#A7B7A8]">{client.email ?? "—"}</td>







                    <td className="px-5 py-4 text-[#A7B7A8]">{client.phone ?? "—"}</td>







                    <td className="px-5 py-4 text-[#A7B7A8]">{client.code ?? "—"}</td>







                    <td className={`px-5 py-4 font-semibold ${client.is_active ? "text-[#5D9E7F]" : "text-[#C5716B]"}`}>







                      {client.is_active ? "Actif" : "Suspendu"}







                    </td>







                    <td className="px-5 py-4 text-right">







                      <div className="flex gap-1">







                        <button







                          type="button"







                          disabled={clientDeleting}







                          onClick={() => {







                            setClientDetail(client);







                            setClientDetailOpen(true);







                          }}







                          className="rounded-lg border border-[#8FB59B]/40 px-3 py-1.5 text-xs text-[#8FB59B] hover:bg-[#8FB59B]/10 disabled:opacity-40"







                          title="Voir les détails"







                        >







                          Voir







                        </button>







                        <button







                          type="button"







                          disabled={clientDeleting || !client.is_active}







                          onClick={() => {







                            setResetPwdTarget({ id: client.id, email: client.email });







                            setResetPwdOpen(true);







                          }}







                          className="rounded-lg border border-[#8FB59B]/40 px-3 py-1.5 text-xs text-[#8FB59B] hover:bg-[#8FB59B]/10 disabled:opacity-40"







                          title="Réinitialiser le mot de passe"







                        >







                          Mot de passe







                        </button>







                        <button







                          type="button"







                          disabled={clientDeleting}







                          onClick={() => {







                            setEditCodeTarget({ id: client.id, code: client.code });







                            setEditCodeValue(client.code ?? "");







                            setEditCodeOpen(true);







                          }}







                          className="rounded-lg border border-[#8FB59B]/40 px-3 py-1.5 text-xs text-[#8FB59B] hover:bg-[#8FB59B]/10 disabled:opacity-40"







                          title="Modifier le code client"







                        >







                          Code







                        </button>







                        <button







                          type="button"







                          disabled={clientDeleting}







                          onClick={() => {







                            setEditEmailTarget({ id: client.id, email: client.email });







                            setEditEmailValue(client.email ?? "");







                            setEditEmailOpen(true);







                          }}







                          className="rounded-lg border border-[#8FB59B]/40 px-3 py-1.5 text-xs text-[#8FB59B] hover:bg-[#8FB59B]/10 disabled:opacity-40"







                          title="Modifier l&apos;email"







                        >







                          Email







                        </button>







                        <button







                          type="button"







                          disabled={clientDeleting}







                          onClick={() => {







                            setToggleActiveTarget({ id: client.id, is_active: client.is_active, role: client.role });







                            setToggleActiveOpen(true);







                          }}







                          className={`rounded-lg border border-[#C5716B]/40 px-3 py-1.5 text-xs ${client.is_active ? "text-[#C5716B] hover:bg-[#C5716B]/10" : "text-[#5D9E7F] hover:bg-[#5D9E7F]/10"} disabled:opacity-40`}







                          title={client.is_active ? "Désactiver" : "Réactiver"}







                        >







                          {client.is_active ? "Désactiver" : "Réactiver"}







                        </button>







                        <button







                          type="button"







                          disabled={clientDeleting}







                          onClick={() => {







                            setClientToDelete(client.id);







                            setClientDeleteOpen(true);







                          }}







                          className="rounded-lg border border-[#C5716B]/40 px-3 py-1.5 text-xs text-[#C5716B] hover:bg-[#C5716B]/10 disabled:opacity-40"







                          title="Supprimer"







                        >







                          Supprimer







                        </button>







                      </div>







                    </td>







                  </tr>







                ))}







                {!clients.length && <tr><td className="px-5 py-8 text-center text-sm text-[#A7B7A8]" colSpan={6}>Aucun client enregistré.</td></tr>}







              </tbody>







            </table>







          </div>}







        </section>















        {/* Configuration commerciale des forfaits */}







        <section className="mt-6 grid gap-4 lg:grid-cols-3">







          {plans.map((plan) => (







            <article key={plan.code} className="carte p-5">







              <div className="flex items-center justify-between">







                <h2 className="titre-or text-lg font-extrabold">{plan.label}</h2>







                <span className="rounded-full bg-[#344440] px-2 py-1 text-[10px] uppercase text-[#DFE7E2]">{plan.code}</span>







              </div>







              <p className="mt-2 text-xs leading-5 text-[#A7B7A8]">{plan.description}</p>















              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">







                <label className="text-[#A7B7A8]">Prix mensuel (MAD)







                  <input id={`price-m-${plan.code}`} type="number" min="0" step="0.01" defaultValue={plan.price_monthly ?? ""} placeholder="non défini" className="champ mt-1 min-h-9 py-1" />







                </label>







                <label className="text-[#A7B7A8]">Prix annuel (MAD)







                  <input id={`price-y-${plan.code}`} type="number" min="0" step="0.01" defaultValue={plan.price_yearly ?? ""} placeholder="non défini" className="champ mt-1 min-h-9 py-1" />







                </label>







                <label className="text-[#A7B7A8]">Essai (jours)







                  <input id={`trial-${plan.code}`} type="number" min="0" defaultValue={plan.trial_days} className="champ mt-1 min-h-9 py-1" />







                </label>







                <label className="text-[#A7B7A8]">Utilisateurs max







                  <input id={`users-${plan.code}`} type="number" min="1" defaultValue={plan.max_users} className="champ mt-1 min-h-9 py-1" />







                </label>







                <label className="text-[#A7B7A8]">Sites max







                  <input id={`sites-${plan.code}`} type="number" min="1" defaultValue={plan.max_sites} className="champ mt-1 min-h-9 py-1" />







                </label>







                <label className="text-[#A7B7A8]">Stockage (Mo)







                  <input id={`storage-${plan.code}`} type="number" min="1" defaultValue={plan.storage_mb} className="champ mt-1 min-h-9 py-1" />







                </label>







              </div>















              <button







                type="button"







                onClick={() => void enregistrerPlan(plan)}







                disabled={traitement === `plan-${plan.code}`}







                className="btn-or mt-4 w-full px-4 py-2 text-sm disabled:opacity-40"







              >







                {traitement === `plan-${plan.code}` ? "Enregistrement…" : "Enregistrer l’offre"}







              </button>















              <div className="mt-4 border-t border-[#8FB59B]/10 pt-3">







                <p className="text-[10px] uppercase tracking-[0.2em] text-[#A7B7A8]">Modules inclus</p>







                <div className="mt-2 grid grid-cols-1 gap-1.5 max-h-56 overflow-y-auto pr-1">







                  {FEATURES_PILOTEES.map((feature) => {







                    const actif = estActive(plan.code, feature);







                    return (







                      <label key={feature} className="flex items-center justify-between gap-2 text-xs text-[#E8ECE8]/85">







                        <span>{FEATURE_LABEL[feature] ?? feature}</span>







                        <input







                          type="checkbox"







                          checked={actif}







                          onChange={(e) => void basculerFeature(plan.code, feature, e.target.checked)}







                          className="h-4 w-4 accent-[#8FB59B]"







                        />







                      </label>







                    );







                  })}







                </div>







              </div>







            </article>







          ))}







          {!plans.length && !loading && (







            <p className="carte p-6 text-sm text-[#A7B7A8] lg:col-span-3">







              Offres indisponibles — exécutez la migration <code>0009_plans_features_subscriptions.sql</code> dans Supabase.







            </p>







          )}







        </section>















        {/* Journal d'audit */}







        <section className="carte mt-6 overflow-hidden">







          <div className="border-b border-[#8FB59B]/10 p-5"><h2 className="font-bold">Journal d’audit</h2><p className="mt-1 text-xs text-[#A7B7A8]">Dernières actions sensibles (créations, changements de forfait, suspensions).</p></div>







          {audit.length === 0 ? (







            <p className="p-6 text-sm text-[#A7B7A8]">Aucune action journalisée pour l’instant.</p>







          ) : (







            <ul className="divide-y divide-[#8FB59B]/10 text-sm">







              {audit.map((ligne) => (







                <li key={ligne.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">







                  <span className="font-semibold text-[#DFE7E2]">{ligne.action}</span>







                  <span className="text-[#A7B7A8]">{ligne.entity}</span>







                  <span className="text-xs text-[#A7B7A8]">{new Date(ligne.created_at).toLocaleString("fr-FR")}</span>







                </li>







              ))}







            </ul>







          )}







        </section>







      </div>















      {/* Modale nouvel établissement */}







      {etabOpen && (







        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-5">







          <form onSubmit={(e) => void creerEtablissement(e)} className="carte max-h-[90vh] w-full max-w-lg overflow-y-auto p-6">







            <div className="flex items-start justify-between gap-4">







              <div><p className="text-xs uppercase tracking-[0.2em] text-[#A7B7A8]">Multi-tenant</p><h2 className="titre-or mt-1 text-xl font-extrabold">Nouvel établissement</h2></div>







              <button type="button" onClick={() => setEtabOpen(false)} className="text-2xl text-[#A7B7A8]" aria-label="Fermer">×</button>







            </div>







            <div className="mt-5 grid gap-3">







              <input required className="champ min-h-11" placeholder="Nom de l’entreprise" value={etabForm.name} onChange={(e) => setEtabForm({ ...etabForm, name: e.target.value })} />







              <input className="champ min-h-11" placeholder="Slug (optionnel, généré sinon)" value={etabForm.slug} onChange={(e) => setEtabForm({ ...etabForm, slug: e.target.value })} />







              <div className="grid grid-cols-2 gap-3">







                <input className="champ min-h-11" placeholder="Ville" value={etabForm.city} onChange={(e) => setEtabForm({ ...etabForm, city: e.target.value })} />







                <input className="champ min-h-11" placeholder="Téléphone" value={etabForm.phone} onChange={(e) => setEtabForm({ ...etabForm, phone: e.target.value })} />







              </div>







              <input type="email" className="champ min-h-11" placeholder="Email" value={etabForm.email} onChange={(e) => setEtabForm({ ...etabForm, email: e.target.value })} />







              <label className="text-xs text-[#A7B7A8]">Offre d’entrée







                <select className="champ mt-1 min-h-11" value={etabForm.plan} onChange={(e) => setEtabForm({ ...etabForm, plan: e.target.value })}>







                  <option value="standard">STANDARD</option>







                  <option value="silver">SILVER</option>







                  <option value="gold">GOLD</option>







                </select>







              </label>







            </div>







            <div className="mt-6 flex justify-end gap-3">







              <button type="button" onClick={() => setEtabOpen(false)} className="rounded-lg px-4 py-2 text-sm text-[#A7B7A8]">Annuler</button>







              <button disabled={etabSaving} type="submit" className="btn-or px-4 py-2 text-sm">{etabSaving ? "Création…" : "Créer l’établissement"}</button>







            </div>







          </form>







        </div>







      )}















      {/* Modale employé */}







      {employeeOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-5"><form onSubmit={(e) => void createEmployee(e)} className="carte w-full max-w-lg p-6"><div className="flex justify-between"><div><p className="text-xs uppercase tracking-[0.2em] text-[#A7B7A8]">Équipe atelier</p><h2 className="titre-or mt-1 text-xl font-extrabold">Créer un compte Employé</h2></div><button type="button" onClick={() => setEmployeeOpen(false)} className="text-2xl text-[#A7B7A8]">×</button></div><div className="mt-5 grid gap-3"><input required className="champ" placeholder="Nom complet" value={employeeForm.fullName} onChange={(e) => setEmployeeForm({ ...employeeForm, fullName: e.target.value })} /><input required type="email" className="champ" placeholder="Email" value={employeeForm.email} onChange={(e) => setEmployeeForm({ ...employeeForm, email: e.target.value })} /><input className="champ" placeholder="Téléphone" value={employeeForm.phone} onChange={(e) => setEmployeeForm({ ...employeeForm, phone: e.target.value })} /><input required className="champ" placeholder="Poste" value={employeeForm.jobTitle} onChange={(e) => setEmployeeForm({ ...employeeForm, jobTitle: e.target.value })} /><input required minLength={6} type="password" className="champ" placeholder="Mot de passe temporaire" value={employeeForm.password} onChange={(e) => setEmployeeForm({ ...employeeForm, password: e.target.value })} /></div><div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setEmployeeOpen(false)} className="rounded-lg px-4 py-2 text-sm text-[#A7B7A8]">Annuler</button><button disabled={employeeSaving} type="submit" className="btn-or px-4 py-2 text-sm">{employeeSaving ? "Création…" : "Créer le compte"}</button></div></form></div>}















      {/* Modale client */}







      {clientOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-5"><form onSubmit={(e) => void createClient(e)} className="carte w-full max-w-lg p-6"><div className="flex items-start justify-between gap-4"><div><p className="text-xs uppercase tracking-[0.2em] text-[#A7B7A8]">Accès immédiat</p><h2 className="titre-or mt-1 text-xl font-extrabold">Créer un compte Client</h2></div><button type="button" onClick={() => setClientOpen(false)} className="text-2xl text-[#A7B7A8]" aria-label="Fermer">×</button></div><div className="mt-5 grid gap-3"><input required className="champ min-h-11" placeholder="Nom complet" value={clientForm.fullName} onChange={(event) => setClientForm({ ...clientForm, fullName: event.target.value })} /><input required type="email" className="champ min-h-11" placeholder="Email de connexion" value={clientForm.email} onChange={(event) => setClientForm({ ...clientForm, email: event.target.value })} /><input className="champ min-h-11" placeholder="Téléphone" value={clientForm.phone} onChange={(event) => setClientForm({ ...clientForm, phone: event.target.value })} /><input required minLength={6} type="password" className="champ min-h-11" placeholder="Mot de passe temporaire (6 caractères minimum)" value={clientForm.password} onChange={(event) => setClientForm({ ...clientForm, password: event.target.value })} /></div><div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setClientOpen(false)} className="rounded-lg px-4 py-2 text-sm text-[#A7B7A8]">Annuler</button><button disabled={savingClient} type="submit" className="btn-or px-4 py-2 text-sm">{savingClient ? "Création…" : "Créer le compte"}</button></div></form></div>}















      {/* Modale détail client */}







      {clientDetailOpen && clientDetail && (







        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-5">







          <div className="bg-[#2C3735] rounded-lg p-6 max-w-lg w-full">







            <div className="flex items-start justify-between gap-4">







              <div><p className="text-xs uppercase tracking-[0.2em] text-[#A7B7A8]">Fiche client</p><h2 className="titre-or mt-1 text-xl font-extrabold">{clientDetail.full_name}</h2></div>







              <button type="button" onClick={() => setClientDetailOpen(false)} className="text-2xl text-[#A7B7A8]" aria-label="Fermer">×</button>







            </div>







            <div className="mt-5 grid gap-4">







              <div className="bg-[#252D2D] p-4 rounded-lg">







                <p className="text-xs text-[#A7B7A8] uppercase">ID</p>







                <p className="text-[#DFE7E2] font-mono text-sm">{clientDetail.id}</p>







              </div>







              <div className="bg-[#252D2D] p-4 rounded-lg">







                <p className="text-xs text-[#A7B7A8] uppercase">Email</p>







                <p className="text-[#DFE7E2] text-sm">{clientDetail.email ?? "—"}</p>







              </div>







              <div className="bg-[#252D2D] p-4 rounded-lg">







                <p className="text-xs text-[#A7B7A8] uppercase">Téléphone</p>







                <p className="text-[#DFE7E2] text-sm">{clientDetail.phone ?? "—"}</p>







              </div>







              <div className="bg-[#252D2D] p-4 rounded-lg">







                <p className="text-xs text-[#A7B7A8] uppercase">Code client</p>







                <p className="text-[#DFE7E2] font-mono text-sm">{clientDetail.code ?? "—"}</p>







              </div>







              <div className="bg-[#252D2D] p-4 rounded-lg">







                <p className="text-xs text-[#A7B7A8] uppercase">Statut</p>







                <p className={`text-[#DFE7E2] font-semibold text-sm ${clientDetail.is_active ? "text-[#5D9E7F]" : "text-[#C5716B]"}`}>







                  {clientDetail.is_active ? "Actif" : "Suspendu"}







                </p>







              </div>







              <div className="bg-[#252D2D] p-4 rounded-lg">







                <p className="text-xs text-[#A7B7A8] uppercase">Rôle</p>







                <p className="text-[#DFE7E2] text-sm capitalize">{clientDetail.role}</p>







              </div>







              <div className="bg-[#252D2D] p-4 rounded-lg">







                <p className="text-xs text-[#A7B7A8] uppercase">Établissement</p>







                <p className="text-[#DFE7E2] text-sm">{clientDetail.establishment_id ?? "—"}</p>







              </div>







            </div>







            <div className="mt-6 flex justify-end gap-3">







              <button type="button" onClick={() => setClientDetailOpen(false)} className="rounded-lg px-4 py-2 text-sm text-[#A7B7A8]">Fermer</button>







            </div>







          </div>







        </div>







      )}















      {/* Modale réinitialisation mot de passe */}







      {resetPwdOpen && resetPwdTarget && (







        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-5">







          <div className="bg-[#2C3735] rounded-lg p-6 max-w-md w-full">







            <div className="flex items-start justify-between gap-4">







              <div><p className="text-xs uppercase tracking-[0.2em] text-[#A7B7A8]">Réinitialisation mot de passe</p><h2 className="titre-or mt-1 text-xl font-extrabold">{resetPwdTarget.email}</h2></div>







              <button type="button" onClick={() => setResetPwdOpen(false)} className="text-2xl text-[#A7B7A8]" aria-label="Fermer">×</button>







            </div>







            <div className="mt-5">







              <p className="text-sm text-[#A7B7A8]">Un email de réinitialisation sera envoyé à cette adresse. Le client pourra définir un nouveau mot de passe.</p>







            </div>







            <div className="mt-6 flex justify-end gap-3">







              <button type="button" onClick={() => setResetPwdOpen(false)} className="rounded-lg px-4 py-2 text-sm text-[#A7B7A8]">Annuler</button>







              <button disabled={resetPwdSending} onClick={() => void resetClientPassword(resetPwdTarget.id, resetPwdTarget.email)} className="rounded-lg px-4 py-2 text-sm text-white bg-[#8FB59B] hover:bg-[#5D9E7F] disabled:opacity-40">







                {resetPwdSending ? "Envoi…" : "Envoyer l'email"}







              </button>







            </div>







          </div>







        </div>







      )}















      {/* Modale modification code client */}







      {editCodeOpen && editCodeTarget && (







        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-5">







          <div className="bg-[#2C3735] rounded-lg p-6 max-w-md w-full">







            <div className="flex items-start justify-between gap-4">







              <div><p className="text-xs uppercase tracking-[0.2em] text-[#A7B7A8]">Modifier le code client</p><h2 className="titre-or mt-1 text-xl font-extrabold">{editCodeTarget.code ?? "—"}</h2></div>







              <button type="button" onClick={() => setEditCodeOpen(false)} className="text-2xl text-[#A7B7A8]" aria-label="Fermer">×</button>







            </div>







            <div className="mt-5">







              <div className="mt-2">







                <label className="block text-xs text-[#A7B7A8] mb-1">Nouveau code client</label>







                <input required className="champ min-h-11 w-full" value={editCodeValue} onChange={(e) => setEditCodeValue(e.target.value)} placeholder="Code client" />







              </div>







              <p className="text-xs text-[#A7B7A8] mt-1">Le code client est un identifiant unique utilis&apos;e pour l&apos;identif&apos;ication rapide du client.</p>



            </div>







            <div className="mt-6 flex justify-end gap-3">







              <button type="button" onClick={() => setEditCodeOpen(false)} className="rounded-lg px-4 py-2 text-sm text-[#A7B7A8]">Annuler</button>







              <button disabled={editCodeSaving} onClick={() => void editClientCode(editCodeTarget.id, editCodeValue)} className="rounded-lg px-4 py-2 text-sm text-white bg-[#8FB59B] hover:bg-[#5D9E7F] disabled:opacity-40">







                {editCodeSaving ? "Enregistrement…" : "Enregistrer"}







              </button>







            </div>







          </div>







        </div>







      )}















      {/* Modale modification email client */}







      {editEmailOpen && editEmailTarget && (







        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-5">







          <div className="bg-[#2C3735] rounded-lg p-6 max-w-md w-full">







            <div className="flex items-start justify-between gap-4">







              <div><p className="text-xs uppercase tracking-[0.2em] text-[#A7B7A8]">Modifier l&apos;email</p><h2 className="titre-or mt-1 text-xl font-extrabold">{editEmailTarget.email ?? "—"}</h2></div>







              <button type="button" onClick={() => setEditEmailOpen(false)} className="text-2xl text-[#A7B7A8]" aria-label="Fermer">×</button>







            </div>







            <div className="mt-5">







              <div className="mt-2">







                <label className="block text-xs text-[#A7B7A8] mb-1">Nouvelle adresse email</label>







                <input required type="email" className="champ min-h-11 w-full" value={editEmailValue} onChange={(e) => setEditEmailValue(e.target.value)} placeholder="email@example.com" />







              </div>







              <p className="text-xs text-[#A7B7A8] mt-1">L&apos;email sera mis à jour dans le profil client.</p>







            </div>







            <div className="mt-6 flex justify-end gap-3">







              <button type="button" onClick={() => setEditEmailOpen(false)} className="rounded-lg px-4 py-2 text-sm text-[#A7B7A8]">Annuler</button>







              <button disabled={editEmailSaving} onClick={() => void editClientEmail(editEmailTarget.id, editEmailValue)} className="rounded-lg px-4 py-2 text-sm text-white bg-[#8FB59B] hover:bg-[#5D9E7F] disabled:opacity-40">







                {editEmailSaving ? "Enregistrement…" : "Enregistrer"}







              </button>







            </div>







          </div>







        </div>







      )}















      {/* Modale activation/désactivation */}







      {toggleActiveOpen && toggleActiveTarget && (







        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-5">







          <div className="bg-[#2C3735] rounded-lg p-6 max-w-md w-full">







            <div className="flex items-start justify-between gap-4">







              <div><p className="text-xs uppercase tracking-[0.2em] text-[#A7B7A8]">Modifier le statut</p><h2 className="titre-or mt-1 text-xl font-extrabold">{toggleActiveTarget.is_active ? "Désactiver" : "Réactiver"} le compte</h2></div>







              <button type="button" onClick={() => setToggleActiveOpen(false)} className="text-2xl text-[#A7B7A8]" aria-label="Fermer">×</button>







            </div>







            <div className="mt-5">







              <p className="text-sm text-[#A7B7A8]">







                {toggleActiveTarget.is_active







                  ? "La désactivation empêchera le client de se connecter. Ses données seront conservées."







                  : "La réactivation permettra au client de se connecter à nouveau."}







              </p>







            </div>







            <div className="mt-6 flex justify-end gap-3">







              <button type="button" onClick={() => setToggleActiveOpen(false)} className="rounded-lg px-4 py-2 text-sm text-[#A7B7A8]">Annuler</button>







              <button disabled={toggleActiveSaving} onClick={() => void toggleClientActive(toggleActiveTarget.id, toggleActiveTarget.is_active)} className="rounded-lg px-4 py-2 text-sm text-white bg-[#C5716B] hover:bg-[#9A4C44] disabled:opacity-40">







                {toggleActiveSaving ? "Modification…" : toggleActiveTarget.is_active ? "Désactiver" : "Réactiver"}







              </button>







            </div>







          </div>







        </div>







      )}







    </main>







  );







}
