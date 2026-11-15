/** 
 * NEW POS — Service d'achats et fournisseurs. 
 * Gère les fournisseurs, commandes d'achat, réceptions de marchandises 
 * et factures fournisseurs. 
 * 
 * Principe : aucune donnée n'est supprimée. Les mouvements de stock sont tracés. 
 * Chaque opération est liée à un établissement (multi-établissement). 
 */

import { supabase } from "@/lib/supabase-browser";

export type Supplier = {
  id: string;
  establishment_id: string;
  name: string;
  contact_name?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  balance_due: number;
  is_active: boolean;
  created_at: string;
};

export type PurchaseOrder = {
  id: string;
  establishment_id: string;
  supplier_id: string;
  reference: string;
  status: "draft" | "ordered" | "partially_received" | "received" | "cancelled";
  ordered_at: string;
  expected_at: string | null;
  received_at: string | null;
  total_amount: number;
  paid_amount: number;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  supplier?: { id: string; name: string };
};

export type PurchaseOrderItem = {
  id: string;
  purchase_order_id: string;
  product_id: string;
  product_name: string | null;
  product_sku: string | null;
  quantity: number;
  unit_price: number;
  received_quantity: number;
  received_at: string | null;
};

export type SupplierInvoice = {
  id: string;
  establishment_id: string;
  supplier_id: string;
  purchase_order_id: string | null;
  number: string;
  invoice_date: string;
  due_date: string | null;
  total: number;
  paid_amount: number;
  status: "a_payer" | "partiellement_payee" | "payee" | "contestee" | "annulee";
  notes?: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  supplier?: { id: string; name: string };
};

/** 
 * Charge tous les fournisseurs d'un établissement. 
 */
export async function loadSuppliers(): Promise<{ fournisseurs: Supplier[]; erreur: string | null }> {
  if (!supabase) {
    return { fournisseurs: [], erreur: "Supabase non configuré." };
  }

  try {
    const { data, error } = (await supabase
      .from("suppliers")
      .select("id, establishment_id, name, contact_name, phone, email, address, notes, balance_due, is_active, created_at")
      .eq("is_active", true)
      .order("name")) as { data: Supplier[] | null; error: { message: string } | null };

    if (error) {
      return { fournisseurs: [], erreur: error.message };
    }

    const fournisseurs: Supplier[] = (data ?? []).map((s) => ({
      id: String(s.id),
      establishment_id: String(s.establishment_id),
      name: String(s.name),
      contact_name: s.contact_name ?? null,
      phone: s.phone ?? null,
      email: s.email ?? null,
      address: s.address ?? null,
      notes: s.notes ?? null,
      balance_due: Number(s.balance_due ?? 0),
      is_active: Boolean(s.is_active),
      created_at: String(s.created_at ?? ""),
    }));

    return { fournisseurs, erreur: null };
  } catch (e) {
    return { fournisseurs: [], erreur: e instanceof Error ? e.message : "Erreur inconnue" };
  }
}

/** 
 * Crée un nouveau fournisseur. 
 */
export async function creerFournisseur(data: {
  name: string;
  contact_name?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
}): Promise<{ fournisseur: Supplier | null; erreur: string | null }> {
  if (!supabase) {
    return { fournisseur: null, erreur: "Supabase non configuré." };
  }

  try {
    // Récupérer l'établissement de l'utilisateur connecté
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { data: profileRows, error: profileError } = (await supabase.rpc("get_my_profile")) as { data: Array<{ establishment_id: string | null }> | null; error: { message: string } | null };

    const establishmentId = profileRows?.[0]?.establishment_id;

    if (!establishmentId) {
      return { fournisseur: null, erreur: "Établissement introuvable." };
    }

    const { data: supplierData, error: insertError } = (await supabase
      .from("suppliers")
      .insert({
        establishment_id: establishmentId,
        name: data.name.trim(),
        contact_name: data.contact_name?.trim() ?? null,
        phone: data.phone?.trim() ?? null,
        email: data.email?.trim() ?? null,
        address: data.address?.trim() ?? null,
        notes: data.notes?.trim() ?? null,
      })
      .select()
      .single()) as { data: Supplier | null; error: { message: string } | null };

    if (insertError) {
      return { fournisseur: null, erreur: insertError.message };
    }

    return { fournisseur: supplierData as unknown as Supplier, erreur: null };
  } catch (e) {
    return { fournisseur: null, erreur: e instanceof Error ? e.message : "Erreur inconnue" };
  }
}

/** 
 * Charge les commandes d'achat d'un établissement. 
 */
export async function loadPurchaseOrders(): Promise<{ commandes: PurchaseOrder[]; erreur: string | null }> {
  if (!supabase) {
    return { commandes: [], erreur: "Supabase non configuré." };
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { data: profileRows, error: profileError } = (await supabase.rpc("get_my_profile")) as { data: Array<{ establishment_id: string | null }> | null; error: { message: string } | null };

    const establishmentId = profileRows?.[0]?.establishment_id;

    if (!establishmentId) {
      return { commandes: [], erreur: "Établissement introuvable." };
    }

    const { data, error } = (await supabase
      .from("purchase_orders")
      .select("*, suppliers(name)")
      .eq("establishment_id", establishmentId)
      .order("created_at", { ascending: false })) as { data: PurchaseOrder[] | null; error: { message: string } | null };

    if (error) {
      return { commandes: [], erreur: error.message };
    }

    const commandes: PurchaseOrder[] = (data ?? []).map((o) => ({
      id: String(o.id),
      establishment_id: String(o.establishment_id),
      supplier_id: String(o.supplier_id),
      reference: String(o.reference),
      status: o.status as "draft" | "ordered" | "partially_received" | "received" | "cancelled",
      ordered_at: String(o.ordered_at ?? ""),
      expected_at: o.expected_at ?? null,
      received_at: o.received_at ?? null,
      total_amount: Number(o.total_amount ?? 0),
      paid_amount: Number(o.paid_amount ?? 0),
      notes: o.notes ?? null,
      created_at: String(o.created_at ?? ""),
      updated_at: String(o.updated_at ?? ""),
      supplier: o.supplier ? { id: String(o.supplier.id), name: String(o.supplier.name) } : undefined,
    }));

    return { commandes, erreur: null };
  } catch (e) {
    return { commandes: [], erreur: e instanceof Error ? e.message : "Erreur inconnue" };
  }
}

/** 
 * Crée une commande d'achat. 
 */
export async function createPurchaseOrder(data: {
  supplier_id: string;
  reference: string;
  expected_at?: string | null;
  total_amount?: number;
  items: { product_id: string; quantity: number; unit_price: number }[];
  notes?: string | null;
}): Promise<{ commande: PurchaseOrder | null; erreur: string | null }> {
  if (!supabase) {
    return { commande: null, erreur: "Supabase non configuré." };
  }

  try {
    // Récupérer l'établissement et la session de l'utilisateur connecté
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { data: profileRows, error: profileError } = (await supabase.rpc("get_my_profile")) as { data: Array<{ establishment_id: string | null }> | null; error: { message: string } | null };

    const establishmentId = profileRows?.[0]?.establishment_id;

    if (!establishmentId) {
      return { commande: null, erreur: "Établissement introuvable." };
    }

    const { data: sessionDonnee } = (await supabase.auth.getSession()) as { data: { user?: { id: string } | null } | null };

    const userId = sessionDonnee?.user?.id ?? null;

    const { data: order, error: insertError } = (await supabase
      .from("purchase_orders")
      .insert({
        establishment_id: establishmentId,
        supplier_id: data.supplier_id,
        reference: data.reference.trim(),
        expected_at: data.expected_at ?? null,
        total_amount: Number(data.total_amount || 0),
        paid_amount: 0,
        status: "draft",
        notes: data.notes?.trim() ?? null,
        created_by: userId,
      })
      .select()
      .single()) as { data: PurchaseOrder | null; error: { message: string } | null };

    if (insertError) {
      return { commande: null, erreur: insertError.message };
    }

    return { commande: order as PurchaseOrder, erreur: null };
  } catch (e) {
    return { commande: null, erreur: e instanceof Error ? e.message : "Erreur inconnue" };
  }
}

/** 
 * Reçoit une commande d'achat (marque la réception). 
 */
export async function recevoirCommande(orderId: string): Promise<{ success: boolean; erreur: string | null }> {
  if (!supabase) {
    return { success: false, erreur: "Supabase non configuré." };
  }

  try {
    const { error } = await supabase
      .from("purchase_orders")
      .update({ status: "received", received_at: new Date().toISOString() })
      .eq("id", orderId);

    if (error) {
      return { success: false, erreur: error.message };
    }

    return { success: true, erreur: null };
  } catch (e) {
    return { success: false, erreur: e instanceof Error ? e.message : "Erreur inconnue" };
  }
}

/** 
 * Reçoit une facture fournisseur. 
 */
export async function recevoirFacture(invoiceId: string): Promise<{ success: boolean; erreur: string | null }> {
  if (!supabase) {
    return { success: false, erreur: "Supabase non configuré." };
  }

  try {
    const { error } = await supabase
      .from("supplier_invoices")
      .update({ status: "payee" })
      .eq("id", invoiceId);

    if (error) {
      return { success: false, erreur: error.message };
    }

    return { success: true, erreur: null };
  } catch (e) {
    return { success: false, erreur: e instanceof Error ? e.message : "Erreur inconnue" };
  }
}
