/**
 * NEW POS — Service clients.
 * Création réelle (INSERT Supabase), recherche, historique court.
 * Aucune donnée fabriquée : un client créé vient toujours de la base.
 */

import type { Client, Vehicule } from "../types";
import { supabase } from "@/lib/supabase-browser";

type LigneBdd = { id: string; code: string | null; full_name: string; phone: string | null; email: string | null; balance_due: number | null };

export async function listerClients(recherche = ""): Promise<{ clients: Client[]; erreur: string | null }> {
  if (!supabase) return { clients: [], erreur: "Supabase non configuré." };
  let req = supabase.from("clients").select("id, code, full_name, phone, email, balance_due").order("full_name").limit(200);
  if (recherche.trim()) {
    const filtre = `%${recherche.trim()}%`;
    req = supabase.from("clients").select("id, code, full_name, phone, email, balance_due").or(`full_name.ilike.${filtre},phone.ilike.${filtre},code.ilike.${filtre}`).limit(50);
  }
  const { data, error } = await req;
  if (error) return { clients: [], erreur: error.message };
  return {
    clients: (data as LigneBdd[]).map((c) => ({
      id: String(c.id),
      code: c.code,
      nomComplet: String(c.full_name ?? ""),
      telephone: c.phone,
      email: c.email,
      soldeDuCent: Math.round(Number(c.balance_due ?? 0) * 100),
    })),
    erreur: null,
  };
}

/** Création : 4 champs obligatoires + optionnels ; INSERT contrôlé via RPC serveur si présent, sinon insert direct. */
export async function creerClient(formulaire: {
  nom: string; prenom: string; telephone: string; genre: "particulier" | "professionnel";
  entreprise?: string; email?: string; adresse?: string; ville?: string; whatsapp?: string; notes?: string;
}): Promise<{ client: Client | null; erreur: string | null }> {
  if (!supabase) return { client: null, erreur: "Supabase non configuré." };
  const nomComplet = [formulaire.prenom.trim(), formulaire.nom.trim()].filter(Boolean).join(" ") || formulaire.nom.trim();
  if (!nomComplet.trim()) return { client: null, erreur: "Le nom est obligatoire." };
  const tel = formulaire.telephone.trim();
  if (!tel || tel.length < 6) return { client: null, erreur: "Téléphone invalide (6 chiffres minimum)." };

  // establishment_id vient du profil (RLS côté serveur une fois le RPC présent).
  const profilRpc = await supabase.rpc("get_my_profile");
  const establishmentId = profilRpc.data?.[0]?.establishment_id;
  if (!establishmentId) return { client: null, erreur: "Profil/établissement introuvable." };

  const code = `CLI-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 4).toUpperCase()}`;
  const nomFinale = formulaire.genre === "professionnel" && formulaire.entreprise?.trim()
    ? `${formulaire.entreprise.trim()} (${nomComplet})`
    : nomComplet;

  const { data, error } = await supabase
    .from("clients")
    .insert({
      establishment_id: establishmentId,
      code,
      full_name: nomFinale,
      phone: tel,
      email: formulaire.email?.trim() || null,
      address: formulaire.adresse?.trim() || null,
      city: formulaire.ville?.trim() || null,
      notes: formulaire.notes?.trim() || null,
    })
    .select("id, code, full_name, phone, email, balance_due")
    .single();

  if (error) return { client: null, erreur: `Création refusée : ${error.message}` };
  return {
    client: {
      id: String(data.id), code: code, nomComplet: String(data.full_name), telephone: data.phone ?? null,
      email: data.email ?? null, genre: formulaire.genre, soldeDuCent: 0,
    },
    erreur: null,
  };
}

export async function listerVehicules(clientId: string): Promise<{ vehicules: Vehicule[]; erreur: string | null }> {
  if (!supabase) return { vehicules: [], erreur: "Supabase non configuré." };
  const { data, error } = await supabase
    .from("vehicles")
    .select("id, client_id, plate, brand, model, year, mileage")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  if (error) return { vehicules: [], erreur: error.message };
  return {
    vehicules: (data as Record<string, unknown>[]).map((v) => ({
      id: String(v.id), clientId: String(v.client_id), plaque: String(v.plate ?? ""),
      marque: String(v.brand ?? ""), modele: String(v.model ?? ""),
      annee: v.year ? Number(v.year) : null,
      kilometrage: v.mileage ? Number(v.mileage) : null,
    })),
    erreur: null,
  };
}

/** Ajout véhicule à un client réel (plaque requise côté BDD). */
export async function creerVehicule(f: {
  clientId: string; plaque: string; marque: string; modele: string;
  annee?: number | null; mileage?: number | null;
}): Promise<{ vehicule: Vehicule | null; erreur: string | null }> {
  if (!supabase) return { vehicule: null, erreur: "Supabase non configuré." };
  if (!f.clientId) return { vehicule: null, erreur: "Choisissez d'abord le client." };
  const plaque = f.plaque.trim().toUpperCase();
  if (!plaque) return { vehicule: null, erreur: "Immatriculation obligatoire." };
  if (!f.marque.trim() || !f.modele.trim()) return { vehicule: null, erreur: "Marque et modèle obligatoires." };

  const profilRpc = await supabase.rpc("get_my_profile");
  const establishmentId = profilRpc.data?.[0]?.establishment_id;
  if (!establishmentId) return { vehicule: null, erreur: "Profil/établissement introuvable." };

  const { data, error } = await supabase
    .from("vehicles")
    .insert({
      establishment_id: establishmentId,
      client_id: f.clientId,
      plate: plaque,
      brand: f.marque.trim(),
      model: f.modele.trim(),
      year: f.annee ?? null,
      mileage: f.mileage ?? null,
      status: "active",
    })
    .select("id, client_id, plate, brand, model, year, mileage")
    .single();
  if (error) return { vehicule: null, erreur: `Création refusée : ${error.message}` };
  return {
    vehicule: {
      id: String(data.id), clientId: String(data.client_id), plaque: String(data.plate),
      marque: String(data.brand), modele: String(data.model),
      annee: data.year ? Number(data.year) : null,
      kilometrage: data.mileage ? Number(data.mileage) : null,
    },
    erreur: null,
  };
}
