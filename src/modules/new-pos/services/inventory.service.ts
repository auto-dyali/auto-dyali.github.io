/** 
 * NEW POS — Service de stock (inventaire). 
 * Gère les produits, leurs quantités, les mouvements de stock et les alertes de stock bas. 
 * Chaque produit appartient à un établissement (isolation multi-établissement). 
 * Aucune donnée n'est supprimée : les mouvements sont traçables. 
 */

import { supabase } from "@/lib/supabase-browser";

export type Product = {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  category: string;
  brand?: string | null;
  manufacturer_ref?: string | null;
  image_url?: string | null;
  sale_price: number;
  stock: number;
  min_stock: number;
  tax_rate: number;
  unit?: string;
  establishment_id: string;
  created_at: string;
};

export type StockMovement = {
  id: string;
  establishment_id: string;
  product_id: string;
  direction: "in" | "out" | "transfer" | "adjustment";
  quantity: number;
  reference: string; // référence de vente, réception, ajustement, retour
  actor_id: string | null;
  created_at: string;
  product?: { id: string; name: string; sku: string; category: string };
};

export type InventoryAlert = {
  product_id: string;
  product_name: string;
  current_stock: number;
  min_stock: number;
  is_low_stock: boolean;
};

export type CatalogueResultat = {
  produits: Product[];
  erreur: string | null;
};

/** 
 * Charge le catalogue des produits avec leur stock actuel. 
 */
export async function chargerCatalogue(): Promise<{ produits: Product[]; erreur: string | null }> {
  if (!supabase) {
    return { produits: [], erreur: "Supabase non configuré." };
  }

  try {
    const { data, error } = await supabase
      .from("products")
      .select("id, sku, barcode, name, category, brand, manufacturer_ref, image_url, sale_price, stock, min_stock, tax_rate, unit, establishment_id, created_at")
      .eq("is_active", true)
      .order("name");

    if (error) {
      return { produits: [], erreur: error.message };
    }

    const produits: Product[] = (data ?? []).map((p) => ({
      id: p.id,
      sku: p.sku,
      barcode: p.barcode,
      name: p.name,
      category: p.category,
      brand: p.brand ?? null,
      manufacturer_ref: p.manufacturer_ref ?? null,
      image_url: p.image_url ?? null,
      sale_price: Number(p.sale_price ?? 0),
      stock: Number(p.stock ?? 0),
      min_stock: Number(p.min_stock ?? 0),
      tax_rate: Number(p.tax_rate ?? 20),
      unit: p.unit ?? undefined,
      establishment_id: p.establishment_id,
      created_at: p.created_at,
    }));

    return { produits, erreur: null };
  } catch (e) {
    return { produits: [], erreur: e instanceof Error ? e.message : "Erreur inconnue" };
  }
}

/** 
 * Charge l'historique des mouvements de stock pour un produit. 
 */
export async function loadStockMovements(productId: string): Promise<{ mouvements: StockMovement[]; erreur: string | null }> {
  if (!supabase) {
    return { mouvements: [], erreur: "Supabase non configuré." };
  }

  try {
    const { data, error } = await supabase
      .from("stock_movements")
      .select("id, establishment_id, product_id, direction, quantity, reference, actor_id, created_at")
      .eq("product_id", productId)
      .order("created_at", { ascending: false });

    if (error) {
      return { mouvements: [], erreur: error.message };
    }

    const mouvements: StockMovement[] = (data ?? []).map((m) => ({
      id: m.id,
      establishment_id: m.establishment_id,
      product_id: m.product_id,
      direction: m.direction as "in" | "out" | "transfer" | "adjustment",
      quantity: Number(m.quantity ?? 0),
      reference: m.reference ?? "",
      actor_id: m.actor_id ?? null,
      created_at: m.created_at ?? "",
    }));

    return { mouvements, erreur: null };
  } catch (e) {
    return { mouvements: [], erreur: e instanceof Error ? e.message : "Erreur inconnue" };
  }
}

/** 
 * Charge les alertes de stock bas (quantité <= min_stock). 
 */
export async function loadLowStockAlerts(): Promise<{ alertes: InventoryAlert[]; erreur: string | null }> {
  if (!supabase) {
    return { alertes: [], erreur: "Supabase non configuré." };
  }

  try {
    const { data, error } = await supabase
      .from("products")
      .select("id, name, sku, stock, min_stock")
      .eq("is_active", true)
      .lte("stock", "min_stock")
      .order("name");

    if (error) {
      return { alertes: [], erreur: error.message };
    }

    const alertes: InventoryAlert[] = (data ?? []).map((p) => ({
      product_id: p.id,
      product_name: p.name,
      current_stock: Number(p.stock ?? 0),
      min_stock: Number(p.min_stock ?? 0),
      is_low_stock: Number(p.stock ?? 0) <= Number(p.min_stock ?? 0),
    }));

    return { alertes, erreur: null };
  } catch (e) {
    return { alertes: [], erreur: e instanceof Error ? e.message : "Erreur inconnue" };
  }
}

/** 
 * Calcule la valeur totale du stock (somme de stock × prix d'achat). 
 */
export async function calculerValeurStock(): Promise<{ valeur: number; erreur: string | null }> {
  if (!supabase) {
    return { valeur: 0, erreur: "Supabase non configuré." };
  }

  try {
    const { data, error } = await supabase
      .from("products")
      .select("stock, purchase_price")
      .eq("is_active", true);

    if (error) {
      return { valeur: 0, erreur: error.message };
    }

    const valeur = (data ?? []).reduce((s, p) => s + Number(p.stock ?? 0) * Number(p.purchase_price ?? 0), 0);
    return { valeur, erreur: null };
  } catch (e) {
    return { valeur: 0, erreur: e instanceof Error ? e.message : "Erreur inconnue" };
  }
}

/** 
 * Calcule le nombre de produits en alerte de stock. 
 */
export async function compterAlertesStock(): Promise<{ nombre: number; erreur: string | null }> {
  if (!supabase) {
    return { nombre: 0, erreur: "Supabase non configuré." };
  }

  try {
    const { data, error } = await supabase
      .from("products")
      .select("id")
      .eq("is_active", true)
      .lte("stock", "min_stock");

    if (error) {
      return { nombre: 0, erreur: error.message };
    }

    return { nombre: (data ?? []).length, erreur: null };
  } catch (e) {
    return { nombre: 0, erreur: e instanceof Error ? e.message : "Erreur inconnue" };
  }
}

/** 
 * Consomme des pièces du stock suite à la réalisation d'un ordre de réparation.
 * Décrémente le stock pour chaque produit concerné par les tâches terminées.
 * À appeler quand une tâche est validée (quality_checked = true).
 * 
 * @param orderId ID de l'ordre de réparation
 * @param taskIds IDs des tâches terminées incluant les pièces utilisées
 * @param productMap MapproductId → quantité à consommer { [productId]: quantity }
 */
export async function consommerPiecesCommandees(
  orderId: string, 
  taskIds: string[], 
  productMap?: Record<string, number>
): Promise<{ success: boolean; erreur: string | null }> {
  if (!supabase) {
    return { success: false, erreur: "Supabase non configuré." };
  }

  try {
    // Si aucune map fournie, on tente une recherche simple par label de tâche
    if (!productMap) {
      const { data: tasks, error: tasksError } = await supabase
        .from("work_order_tasks")
        .select("id, label, price, quality_checked")
        .eq("work_order_id", orderId)
        .in("id", taskIds);

      if (tasksError) {
        return { success: false, erreur: tasksError.message };
      }

      // Pour chaque tâche qualité vérifiée avec un prix, on cherche un produit correspondant
      const productMap: Record<string, number> = {};

      for (const task of tasks ?? []) {
        if (!task.quality_checked || Number(task.price) <= 0) continue;

        // Recherche simple : on associe 1 unité à un produit dont le nom contient le label de la tâche
        const { data: allProducts } = await supabase
          .from("products")
          .select("id, name")
          .eq("is_active", true);

        if (!allProducts || allProducts.length === 0) continue;

        const matchedProduct = allProducts.find((p) =>
          p.name.toLowerCase().includes(task.label.toLowerCase())
        );

        if (matchedProduct) {
          productMap[matchedProduct.id] = (productMap[matchedProduct.id] ?? 0) + 1;
        }
      }

      // Appliquer la consommation avec la map construite
      return await appliquerConsommationPieces(orderId, productMap);
    }

    // Si map fournie, l'appliquer directement
    return await appliquerConsommationPieces(orderId, productMap);
  } catch (e) {
    return { success: false, erreur: e instanceof Error ? e.message : "Erreur inconnue" };
  }
}

/** 
 * Fonction interne d'application de consommation de pièces.
 */
async function appliquerConsommationPieces(orderId: string, productMap: Record<string, number>): Promise<{ success: boolean; erreur: string | null }> {
  if (!supabase) return { success: false, erreur: "Supabase non configuré." };
  try {
    for (const [productId, quantity] of Object.entries(productMap)) {
      if (quantity <= 0) continue;

      // Récupérer le produit actuel
      const { data: productData, error: fetchError } = await supabase
        .from("products")
        .select("stock")
        .eq("id", productId)
        .single();

      if (fetchError) {
        // Log mais on continue avec les autres produits
        continue;
      }

      const currentStock = Number(productData?.stock ?? 0);
      const newStock = Math.max(0, currentStock - quantity);

      // Mise à jour du stock
      const { error: updateError } = await supabase
        .from("products")
        .update({ stock: newStock })
        .eq("id", productId);

      if (updateError) {
        // On note l'erreur mais on continue
        continue;
      }

      // Enregistrer le mouvement de consommation
      await supabase.from("stock_movements").insert({
        establishment_id: (await supabase.rpc("get_my_profile")).data?.[0]?.establishment_id || '',
        product_id: productId,
        direction: "out",
        quantity: quantity,
        reference: `repair_order_${orderId}`,
        actor_id: null,
      });
    }

    return { success: true, erreur: null };
  } catch (e) {
    return { success: false, erreur: e instanceof Error ? e.message : "Erreur inconnue" };
  }
}

/** 
 * Réserve des pièces du stock pour une tâche spécifique.
 * Le stock est décrémenté mais peut être restitué si la tâche est annulée.
 * 
 * @param taskId ID de la tâche
 * @param productId ID du produit à réserver
 * @param quantity Quantité à réserver (défaut: 1)
 */
export async function reserverPieces(taskId: string, productId: string, quantity: number = 1): Promise<{ success: boolean; erreur: string | null }> {
  if (!supabase) {
    return { success: false, erreur: "Supabase non configuré." };
  }

  try {
    // Récupérer le produit actuel
    const { data: productData, error: fetchError } = await supabase
      .from("products")
      .select("stock")
      .eq("id", productId)
      .single();

    if (fetchError) {
      return { success: false, erreur: fetchError.message };
    }

    const currentStock = Number(productData?.stock ?? 0);

    if (currentStock < quantity) {
      return { success: false, erreur: "Stock insuffisant pour réserver." };
    }

    // Mise à jour du stock (réservation = décrément)
    const { error: updateError } = await supabase
      .from("products")
      .update({ stock: currentStock - quantity })
      .eq("id", productId);

    if (updateError) {
      return { success: false, erreur: updateError.message };
    }

    // Enregistrer le mouvement de réservation
    await supabase.from("stock_movements").insert({
      establishment_id: (await supabase.rpc("get_my_profile")).data?.[0]?.establishment_id || '',
      product_id: productId,
      direction: "out",
      quantity: quantity,
      reference: `task_reserve_${taskId}`,
      actor_id: null,
    });

    return { success: true, erreur: null };
  } catch (e) {
    return { success: false, erreur: e instanceof Error ? e.message : "Erreur inconnue" };
  }
}

/** 
 * Retourne des pièces au stock (non utilisées dans la tâche).
 * Incrémente le stock et enregistre le mouvement de retour.
 * 
 * @param taskId ID de la tâche dont on retourne les pièces
 * @param productId ID du produit à retourner
 * @param quantity Quantité à retourner (défaut: 1)
 */
export async function retournerPieces(taskId: string, productId: string, quantity: number = 1): Promise<{ success: boolean; erreur: string | null }> {
  if (!supabase) {
    return { success: false, erreur: "Supabase non configuré." };
  }

  try {
    // Récupérer le produit actuel
    const { data: productData, error: fetchError } = await supabase
      .from("products")
      .select("stock")
      .eq("id", productId)
      .single();

    if (fetchError) {
      return { success: false, erreur: fetchError.message };
    }

    const currentStock = Number(productData?.stock ?? 0);

    // Mise à jour du stock (retour = incrément)
    const { error: updateError } = await supabase
      .from("products")
      .update({ stock: currentStock + quantity })
      .eq("id", productId);

    if (updateError) {
      return { success: false, erreur: updateError.message };
    }

    // Enregistrer le mouvement de retour
    await supabase.from("stock_movements").insert({
      establishment_id: (await supabase.rpc("get_my_profile")).data?.[0]?.establishment_id || '',
      product_id: productId,
      direction: "in",
      quantity: quantity,
      reference: `task_return_${taskId}`,
      actor_id: null,
    });

    return { success: true, erreur: null };
  } catch (e) {
    return { success: false, erreur: e instanceof Error ? e.message : "Erreur inconnue" };
  }
}