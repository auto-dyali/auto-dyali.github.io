"use client";

/**
 * NEW POS — Contrôleur central du moteur de vente.
 * État unique partagé Mini-POS / POS complet : catalogue, panier (cart-engine),
 * clients, véhicules, règlements, permissions, validation serveur + offline.
 * AUCUN calcul de vente ici : tout vient des moteurs purs du core
 * (pricing-engine, payment-engine, sales-engine).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase-browser";
import { useProfil } from "@/lib/features";
import { versCentimes } from "../core/money.ts";
import { calculerTicket } from "../core/pricing-engine.ts";
import type { Client, LignePanier, ModePaiement, Prestation, Produit, Reglement, Totalities, Vehicule } from "../types";
import {
  panierVide, ajouterProduit, ajouterPrestation, ajouterPrestationLibre,
  incrementerQuantite, majQuantite, majRemiseLigne, majLigneTva, majPrixUnitaire,
  supprimerLigne, majRemiseGlobale, majClient, majVehicule,
  type EtatPanier,
} from "../core/cart-engine.ts";
import {
  totalEncaisseCertainCent, monnaieARendreCent, validerReglements,
} from "../core/payment-engine.ts";
import { construirePayloadVente, tailleFile } from "../core/sales-engine.ts";
import { chargerCatalogue, rechercherProduits, type ResultatCatalogue } from "../services/products.service.ts";
import { listerClients, creerClient, listerVehicules, creerVehicule } from "../services/customers.service.ts";
import { validerVente, synchroniserFile } from "../services/sales.service.ts";

/** Photographie complète d'un ticket pour l'affichage/impression. */
export type TicketTermine = {
  reference: string;
  statut: string;
  date: string;
  lignes: LignePanier[];
  totaux: Totalities;
  reglements: Reglement[];
  client: Client | null;
  vehicule: Vehicule | null;
};

export function usePos() {
  const profil = useProfil();
  const estGestionnaire = profil.is(["manager", "saas_admin"]);

  // ---- catalogue ---------------------------------------------------------
  const [catalogue, setCatalogue] = useState<ResultatCatalogue>({
    produits: [], prestations: [], mode: "test", familles: [], erreur: null,
  });
  const [chargementCat, setChargementCat] = useState(true);

  const recataloguer = useCallback(async () => {
    setChargementCat(true);
    const r = await chargerCatalogue();
    setCatalogue(r);
    setChargementCat(false);
  }, []);

  useEffect(() => { const t = window.setTimeout(() => void recataloguer(), 0); return () => window.clearTimeout(t); }, [recataloguer]);

  // ---- panier ------------------------------------------------------------
  const [panier, setPanier] = useState<EtatPanier>(panierVide);
  const [reglements, setReglements] = useState<Reglement[]>([]);

  // ---- droits (permissions serveur, complément de RLS) --------------------
  const [permPosEdit, setPermPosEdit] = useState(true);
  useEffect(() => {
    if (estGestionnaire || profil.role === null) return; // manager = tout
    let vivant = true;
    void supabase?.from("permissions").select("module, can_edit")
      .eq("role", profil.role).then(({ data }) => {
        if (!vivant) return;
        setPermPosEdit((data ?? []).some((r) => r.module === "pos" && r.can_edit));
      });
    return () => { vivant = false; };
  }, [profil.role, estGestionnaire]);

  // ---- clients / véhicules ----------------------------------------------
  const [clients, setClients] = useState<Client[]>([]);
  const [erreurClients, setErreurClients] = useState<string | null>(null);
  const [vehicules, setVehicules] = useState<Vehicule[]>([]);
  const [chargementVehicules, setChargementVehicules] = useState(false);

  const rechargerClients = useCallback(async (q = "") => {
    const r = await listerClients(q);
    setClients(r.clients);
    setErreurClients(r.erreur);
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => void rechargerClients(), 0);
    return () => window.clearTimeout(t);
  }, [rechargerClients]);

  const choisirClient = useCallback(async (c: Client | null) => {
    setPanier((p) => majClient(p, c));
    setVehicules([]);
    if (!c) return;
    setChargementVehicules(true);
    const r = await listerVehicules(c.id);
    setChargementVehicules(false);
    setVehicules(r.vehicules);
  }, []);

  // ---- moteurs (pricing unique — Mini-POS et POS identiques) -------------
  const totaux = useMemo(
    () => calculerTicket(panier.lignes, panier.remiseGlobale),
    [panier.lignes, panier.remiseGlobale],
  );


  // ---- file offline -------------------------------------------------------
  const [fileRetard, setFileRetard] = useState(() => {
    if (typeof localStorage === "undefined") return 0;
    return tailleFile();
  });
  const [syncInfo, setSyncInfo] = useState<string | null>(null);

  const rafraichirFile = useCallback(async () => {
    const r = await synchroniserFile();
    setFileRetard(tailleFile());
    if (r.synchronisees.length > 0) {
      setSyncInfo(`${r.synchronisees.length} vente(s) hors ligne synchronisée(s) : ${r.synchronisees.join(", ")}`);
    }
    if (r.echecs.length > 0) {
      setSyncInfo(`Échec synchronisation : ${r.echecs.map((e) => `${e.reference} (${e.erreur})`).join(", ")}`);
    }
    if (r.synchronisees.length === 0 && r.echecs.length === 0) {
      setSyncInfo("Aucune vente en attente de synchronisation.");
    }
  }, [synchroniserFile]);

  // Retour réseau : synchronise automatiquement (pas de setState dans l'effet
  // proprement dit : la mise à jour d'état se fait dans le gestionnaire d'événement).
  useEffect(() => {
    const sync = async () => { await rafraichirFile(); };
    window.addEventListener("online", sync);
    return () => window.removeEventListener("online", sync);
  }, [rafraichirFile]);

  // ---- validation ----------------------------------------------------------
  const [erreurBandeau, setErreurBandeau] = useState<string | null>(null);
  const [ticketTermine, setTicketTermine] = useState<TicketTermine | null>(null);
  const [infoValidation, setInfoValidation] = useState<string | null>(null);
  const enCours = useRef(false);

  const validerVenteCourante = useCallback(async (
    payeCent: number,
    regs: Reglement[],
  ): Promise<TicketTermine | null> => {
    setErreurBandeau(null);
    setInfoValidation(null);
    if (enCours.current) return null; // anti double-clic strict
    if (panier.lignes.length === 0) { setErreurBandeau("Le panier est vide."); return null; }
    enCours.current = true;
    try {
      const totauxTicket = calculerTicket(panier.lignes, panier.remiseGlobale, payeCent);
      const erreurs = validerReglements(
        totauxTicket, regs,
        {
          clientPresente: !!panier.client,
          autoriseCredit: permPosEdit || estGestionnaire,
          soldeAvoirCent: 0, // solde avoir réel inconnu côté client : le serveur recontrôle
        },
      );
      if (erreurs.length > 0) { setErreurBandeau(erreurs.join(" ")); return null; }

      const construit = construirePayloadVente(panier, regs, { payeCent, soldeAvoirCent: 0 });
      if ("erreur" in construit) { setErreurBandeau(construit.erreur); return null; }

      const res = await validerVente(construit.payload);
      // fileRetard se rafraîchit via rafraichirFile() (bouton / retour réseau)
      if (!res.ok) {
        setErreurBandeau(res.enAttenteSync
          ? `Ticket ${construit.reference} conservé hors ligne — synchronisation automatique dès le retour du réseau.`
          : res.erreur ?? "Validation refusée par le serveur.");
        return null;
      }
      if (res.enAttenteSync) {
        setInfoValidation(`Ticket ${construit.reference} en attente de synchronisation — il est conservé localement et partira automatiquement.`);
      } else {
        setInfoValidation(`Vente ${res.reference} enregistrée (${res.statut ?? "ok"}).`);
      }
      const photo: TicketTermine = {
        reference: construit.reference,
        statut: res.statut ?? "paid",
        date: new Date().toLocaleString("fr-FR"),
        lignes: panier.lignes,
        totaux: totauxTicket,
        reglements: regs,
        client: panier.client,
        vehicule: panier.vehicule,
      };
      setTicketTermine(photo);
      // Reset contrôlé : panier neuf pour la vente suivante.
      setPanier(panierVide());
      setReglements([]);
      setVehicules([]);
      return photo;
    } finally {
      enCours.current = false;
    }
  }, [panier, permPosEdit, estGestionnaire]);

  // ---- opérations panier (déléguées au cart-engine) -----------------------
  const op = useMemo(() => ({
    ajouterProduit: (p: Produit, q = 1) => setPanier((e) => ajouterProduit(e, p, q)),
    ajouterPrestation: (p: Prestation, q = 1) => setPanier((e) => ajouterPrestation(e, p, q)),
    ajouterPrestationLibre: (n: string, prixMad: number, tva = 0) =>
      setPanier((e) => ajouterPrestationLibre(e, n, versCentimes(prixMad), tva)),
    majQuantite: (id: string, q: number) => setPanier((e) => majQuantite(e, id, q)),
    incrementerQuantite: (id: string, d = 1) => setPanier((e) => incrementerQuantite(e, id, d)),
    majRemiseLigne: (id: string, o: { pourcent?: number; montantCent?: number }) => setPanier((e) => majRemiseLigne(e, id, o)),
    majLigneTva: (id: string, t: number) => setPanier((e) => majLigneTva(e, id, t)),
    majPrixUnitaire: (id: string, c: number) => setPanier((e) => majPrixUnitaire(e, id, c)),
    supprimerLigne: (id: string) => setPanier((e) => supprimerLigne(e, id)),
    majRemiseGlobale: (r: { pourcent: number; montantCent: number }) => setPanier((e) => majRemiseGlobale(e, r)),
    majVehicule: (v: Vehicule | null) => setPanier((e) => majVehicule(e, v)),
  }), []);

  const vider = useCallback(() => {
    setPanier(panierVide());
    setReglements([]);
    setVehicules([]);
  }, []);

  return {
    // identité + droits
    profil, estGestionnaire, permPosEdit, role: profil.role,
    // catalogue
    catalogue, chargementCat, recataloguer, rechercher: rechercherProduits,
    // panier
    panier, totaux, reglements, op, vider,
    setReglements: (rs: Reglement[]) => setReglements(rs),
    // clients / véhicules
    clients, erreurClients, rechargerClients, choisirClient,
    vehicules, chargementVehicules, creerClient, creerVehicule,
    // offline
    fileRetard, syncInfo,
    // validation
    validerVenteCourante, erreurBandeau, infoValidation, ticketTermine,
  };
}
