/**
 * NEW POS — Service caisse.
 * Ouverture / clôture, dépenses contrôlées, encaissements du jour.
 * Réutilise les tables existantes (cash_sessions, expenses, payments) :
 * aucune deuxième source de vérité, aucune opération invisible.
 */

import { supabase } from "@/lib/supabase-browser";

export type SessionCaisse = {
  id: string;
  ouvertLe: string;
  fermeeLe: string | null;
  fondsCent: number;
  clotureCent: number | null;
  attenduCent: number | null;
};

export async function sessionOuverte(): Promise<{ session: SessionCaisse | null; erreur: string | null }> {
  if (!supabase) return { session: null, erreur: "Supabase non configuré." };
  const { data, error } = await supabase
    .from("cash_sessions")
    .select("id, opened_at, closed_at, opening_amount, closing_amount, expected_amount")
    .is("closed_at", null)
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return { session: null, erreur: error.message };
  if (!data) return { session: null, erreur: null };
  return {
    session: {
      id: String(data.id), ouvertLe: String(data.opened_at ?? ""), fermeeLe: data.closed_at ? String(data.closed_at) : null,
      fondsCent: Math.round(Number(data.opening_amount ?? 0) * 100),
      clotureCent: data.closing_amount == null ? null : Math.round(Number(data.closing_amount ?? 0) * 100),
      attenduCent: data.expected_amount == null ? null : Math.round(Number(data.expected_amount ?? 0) * 100),
    },
    erreur: null,
  };
}

export async function ouvrirCaisse(fondsCent: number): Promise<{ ok: boolean; erreur?: string }> {
  if (!supabase) return { ok: false, erreur: "Supabase non configuré." };
  if (fondsCent < 0) return { ok: false, erreur: "Fonds initial invalide." };
  const { error } = await supabase.from("cash_sessions").insert({
    opening_amount: fondsCent / 100,
  });
  if (error) return { ok: false, erreur: error.message };
  return { ok: true };
}

export async function cloturerCaisse(
  sessionId: string,
  clitureCent: number,
  attenduCent: number,
): Promise<{ ok: boolean; ecart?: number; erreur?: string }> {
  if (!supabase) return { ok: false, erreur: "Supabase non configuré." };
  const { error } = await supabase.from("cash_sessions").update({
    closing_amount: clitureCent / 100,
    expected_amount: attenduCent / 100,
    closed_at: new Date().toISOString(),
  }).eq("id", sessionId);
  if (error) return { ok: false, erreur: error.message };
  return { ok: true, ecart: clitureCent - attenduCent };
}

/** dépense du jour (loyer, salaires…). Toujours tracée avec son motif. */
export async function ajouterDepense(categorie: string, libelle: string, cent: number, jour: string): Promise<{ ok: boolean; erreur?: string }> {
  if (!supabase) return { ok: false, erreur: "Supabase non configuré." };
  if (!libelle.trim()) return { ok: false, erreur: "Motif obligatoire." };
  if (cent <= 0) return { ok: false, erreur: "Montant invalide." };
  const { error } = await supabase.from("expenses").insert({
    category: categorie || "autre",
    label: libelle.trim(),
    amount: cent / 100,
    spent_at: jour,
  });
  if (error) return { ok: false, erreur: error.message };
  return { ok: true };
}

/** Encaissements + dépenses du jour, par mode, pour la clôture. */
export async function resumeJour(): Promise<{
  parMode: { method: string; total: number }[];
  depenses: number;
  erreur: string | null;
}> {
  if (!supabase) return { parMode: [], depenses: 0, erreur: "Supabase non configuré." };
  const auj = new Date().toISOString().slice(0, 10);
  const [reqPayes, reqDespenses] = await Promise.all([
    supabase.from("payments").select("method, amount").gte("paid_at", `${auj}T00:00:00.000Z`).lt("paid_at", `${auj}T23:59:59.999Z`),
    supabase.from("expenses").select("amount").eq("spent_at", auj),
  ]);
  if (reqPayes.error) return { parMode: [], depenses: 0, erreur: reqPayes.error.message };
  const map = new Map<string, number>();
  for (const p of (reqPayes.data ?? []) as { method: string; amount: number }[]) {
    map.set(p.method, (map.get(p.method) ?? 0) + Number(p.amount ?? 0));
  }
  return {
    parMode: [...map.entries()].map(([method, total]) => ({ method, total })),
    depenses: (reqDespenses.data ?? []).reduce((s, e) => s + Number(e.amount ?? 0), 0),
    erreur: null,
  };
}
