#!/usr/bin/env bash
# =====================================================================
# AUTO DYALI — Script d'exécution P0 : Création des 6 comptes de test
# STATUT : À EXÉCUTER DÈS QU'UN ACCÈS SUPABASE PRIVILÉGIÉ EST DISPONIBLE
# =====================================================================
# Ce script documente et automatise les étapes à suivre dans le Supabase
# Dashboard → SQL Editor (rôle owner/service) ou via CLI supabase.
#
# PRÉREQUIS (à obtenir AVANT exécution) :
#   1. Accès réseau vers https://nxmsqqoflskfajqrqddw.supabase.co
#   2. Accès privilégié (service_role ou Dashboard owner)
#   3. Sauvegarde / PITR vérifiée (conformément aux protections Supabase)
#
# AUCUNE DONNÉE EXISTANTE N'EST SUPPRIMÉE OU MODIFIÉE.
# =====================================================================

set -euo pipefail

SUPABASE_URL="https://nxmsqqoflskfajqrqddw.supabase.co"

echo "============================================================"
echo "  AUTO DYALI — Création des 6 comptes de test (P0)"
echo "  Projet : nxmsqqoflskfajqrqddw"
echo "  Date   : $(date)"
echo "============================================================"
echo ""

# ---------------------------------------------------------------------
# ÉTAPE 0 : Vérifications préliminaires
# ---------------------------------------------------------------------
echo "[0/6] Pré-contrôles..."
echo "  - Vérifier que la sauvegarde/PITR est validée."
echo "  - Vérifier l'accès au SQL Editor du projet nxmsqqoflskfajqrqddw."
echo ""

# ---------------------------------------------------------------------
# ÉTAPE 1 : Créer les 6 utilisateurs Auth
# ---------------------------------------------------------------------
echo "[1/6] Création des 6 comptes Auth (Supabase Dashboard → Authentication → Users)"
echo "  OU via service_role (auth.admin.createUser, côté serveur uniquement)"
echo ""
echo "  Comptes à créer :"
echo "    1. admin.saas@autodyali.test        — rôle saas_admin"
echo "    2. manager.garage1@autodyali.test   — rôle manager, Garage 1"
echo "    3. manager.garage2@autodyali.test   — rôle manager, Garage 2"
echo "    4. caisse.garage1@autodyali.test    — rôle employee, Garage 1"
echo "    5. stock.garage1@autodyali.test     — rôle employee, Garage 1"
echo "    6. caisse-stock.garage1@autodyali.test — rôle employee, Garage 1"
echo ""
echo "  Générer un mot de passe temporaire unique pour chaque compte."
echo "  Conserver les mots de passe dans la fiche confidentielle (hors dépôt)."
echo ""

# ---------------------------------------------------------------------
# ÉTAPE 2 : Appliquer le SQL de préparation
# ---------------------------------------------------------------------
echo "[2/6] Application du SQL de préparation (supabase/00_test_comptes_preparation.sql)"
echo "  → Ouvrir Supabase Dashboard → SQL Editor"
echo "  → Copier-coller le contenu de : supabase/00_test_comptes_preparation.sql"
echo "  → Exécuter (créera établissements, profils, employés, permissions)"
echo "  → Ce script est idempotent et non destructif."
echo ""

# ---------------------------------------------------------------------
# ÉTAPE 3 : Appliquer les migrations préparées (si non appliquées)
# ---------------------------------------------------------------------
echo "[3/6] Vérification et application des migrations préparées"
echo ""
echo "  Migrations à vérifier dans Supabase SQL Editor :"
echo "    - 0034_harden_admin_p0_rpcs_prepared_NOT_APPLIED.sql  (durcissement RPC admin)"
echo "    - 0033_pre_purchase_requests_prepared_NOT_APPLIED.sql  (pré-achat)"
echo "    - 0035_pre_purchase_submit_rpc_prepared_NOT_APPLIED.sql (RPC pré-achat)"
echo "    - 0028_mission_2_15_onboarding_prepared_NOT_APPLIED.sql (onboarding)"
echo ""
echo "  Ordre recommandé : 0028 → 0034 → 0033 → 0035"
echo "  Puis : déploiement Edge Function onboard-tenant"
echo ""

# ---------------------------------------------------------------------
# ÉTAPE 4 : Déployer l'Edge Function onboard-tenant
# ---------------------------------------------------------------------
echo "[4/6] Déploiement Edge Function onboard-tenant"
echo "  → CLI : supabase functions deploy --name onboard-tenant"
echo "  → Ou Dashboard → Edge Functions → onboard-tenant"
echo "  → Secrets requis : SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY"
echo ""

# ---------------------------------------------------------------------
# ÉTAPE 5 : Tester les 6 connexions
# ---------------------------------------------------------------------
echo "[5/6] Tests réels des 6 comptes (à consigner dans la fiche confidentielle)"
echo ""
echo "  Pour chaque compte :"
echo "    1. Connexion sur l'URL de l'application"
echo "    2. Vérifier redirection vers le bon espace"
echo "    3. Vérifier rôle et modules accessibles"
echo "    4. Vérifier refus des opérations interdites"
echo "    5. Vérifier isolation Garage 1 vs Garage 2"
echo "    6. Déconnexion et reconnexion"
echo ""

# ---------------------------------------------------------------------
# ÉTAPE 6 : Pousser et déployer sur GitHub Pages
# ---------------------------------------------------------------------
echo "[6/6] Push GitHub et déploiement Pages"
echo "  → git push origin main"
echo "  → Vérifier exécution CI .github/workflows/deploy-pages.yml"
echo "  → Vérifier site publié et commit déployé"
echo ""

echo "============================================================"
echo "  FIN DU SCRIPT D'EXÉCUTION P0"
echo "============================================================"
