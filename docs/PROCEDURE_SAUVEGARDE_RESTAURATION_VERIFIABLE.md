# Procédure de sauvegarde et restauration vérifiable (préparation — gel P0)

> **Statut : PRÉPARÉ / NON EXÉCUTÉ.** Aucune opération distante, aucune restauration, aucune suppression, aucune mutation de données, aucune modification d’infrastructure n’a été réalisée. Toute exécution requiert une **autorisation explicite et distincte** et la **levée ciblée** du gel P0 pour l’action concernée. **Aucun secret** (clés, mots de passe, tokens, chaînes de connexion, identifiants sensibles) n’est consigné ici.

## 1. Objectif et périmètre
- Garantir qu’une sauvegarde exploitable existe **avant** toute migration, correction RLS/RPC, déploiement Edge Function, modification Auth/SMTP/secrets ou opération sensible.
- Garantir qu’une **restauration est vérifiable** (preuve documentée) avant de considérer un environnement comme récupérable.
- Cibles : base Postgres Supabase (schéma `public`, `auth` si applicable), politiques RLS, fonctions/RPC, triggers, données métier, objets de stockage si utilisés, configuration applicative critique (sans secrets).

## 2. Prérequis (à confirmer sans exposer de secrets)
| Prérequis | Vérification attendue | Preuve attendue | Statut actuel |
|---|---|---|---|
| Accès projet Supabase (Dashboard/CLI/DB owner selon besoin) | Rôle/permission suffisante confirmé hors rapport | Capture/trace interne (sans secret) | BLOQUÉ PAR AUTORISATION (non vérifié ici) |
| Sauvegarde automatique / PITR activé | Paramètres plan/projet vérifiés | Capture paramètres + politique de rétention | NON VÉRIFIABLE SANS ACCÈS DISTANT |
| Rétention et fenêtre de restauration | Durée/point de restauration connu | Documentation fournisseur/projet | NON VÉRIFIABLE SANS ACCÈS DISTANT |
| Capacité d’export manuel (pg_dump/snapshot contrôlé) | Procédure/outil disponible | Commande/outil validé (sans identifiants) | NON VÉRIFIÉ |
| Environnement de restauration de test (staging/clone) | Disponible et isolé des données réelles | Identifiant d’environnement (non sensible) | BLOQUÉ PAR DÉPENDANCE EXTERNE (si absent) |
| Fenêtre de maintenance et responsables | Validée | Accord documenté | BLOQUÉ PAR AUTORISATION |

## 3. Inventaire des éléments à protéger (localement connu)
| Élément | Sources locales | Criticité | Remarques |
|---|---|---|---|
| Schéma/migrations 0001–0031 + préparées/NOT_APPLIED | `supabase/migrations/*.sql` | Élevée | Écarts possibles avec l’état distant (non vérifiable sans accès read-only distant) |
| RPC/fonctions (SECURITY DEFINER/INVOKER, guards `is_saas_admin`/`auth.uid()`) | Migrations + `supabase/apply/*.sql` | Élevée | Inclut RPC historiques P0 (0010) et corrections préparées (0028/0030/0031/0032) |
| Politiques RLS par table | Migrations/apply | Élevée | Isolation inter-entreprises/établissements critique |
| Edge Function onboarding | `supabase/functions/onboard-tenant/index.ts` | Élevée | Source prête, non déployée |
| Scripts apply/verification (read-only/mutatifs) | `supabase/apply/*`, `supabase/verification/*` | Élevée | Mutatifs uniquement après autorisation |
| Données métier (établissements, profils, abonnements, audit, CRM, support, etc.) | Base distante (état inconnu) | Élevée | **Aucune donnée réelle ne doit être altérée pendant les tests** |
| Auth utilisateurs/sessions/invitations | Supabase Auth (distant) | Élevée | Hors périmètre de lecture locale ; secrets/config non exposés |
| Objets Stockage (logos, PJ éventuelles) | Non inventorié localement | À confirmer | Dépend de l’usage réel |

## 4. Procédure de sauvegarde (avant toute action sensible) — À EXÉCUTER UNIQUEMENT APRÈS AUTORISATION
1. **Figer le périmètre** : lister exactement les migrations/scripts/actions prévues, le SHA/état local (`git rev-parse HEAD`, modifications locales) et la date/heure.
2. **Vérifier PITR/sauvegarde automatique** : confirmer qu’un point de restauration antérieur à l’action existe et noter sa référence (sans secret).
3. **Export complémentaire contrôlé (si autorisé)** :
   - Export schéma + données des tables critiques (et `auth` si pertinent/autorisé) vers un emplacement sécurisé interne.
   - Inclure : tables, séquences, fonctions, triggers, policies, grants (selon capacités).
   - Ne pas stocker d’identifiants/secrets dans les artefacts ni dans GV5.
4. **Contrôles d’intégrité de la sauvegarde** :
   - Vérifier la complétude (absence d’erreur d’export), taille/horodatage, lisibilité.
   - Échantillon de comptages de lignes par table critique (avant action) à consigner.
5. **Preuve** : consigner en GV5 (append-only) : date/heure, type de sauvegarde, référence de point de restauration, périmètre couvert, contrôles effectués, résultat (sans secrets).

## 5. Procédure de restauration vérifiable — À EXÉCUTER UNIQUEMENT APRÈS AUTORISATION (idéalement sur environnement de test isolé)
1. **Choisir la cible** : restauration sur **environnement isolé/staging** en priorité ; restauration production uniquement si incident avéré et autorisé.
2. **Restaurer** depuis le point/sauvegarde identifié (PITR ou import contrôlé) selon la procédure fournisseur/outillage validé.
3. **Vérifications post-restauration (obligatoires)** :
   - Schéma : tables/colonnes/index/contraintes/FK présents.
   - Fonctions/RPC : présence, signatures, `SECURITY DEFINER/INVOKER`, `search_path`, grants (notamment absence d’`EXECUTE` public/anon non désiré).
   - RLS : activée sur les tables sensibles, policies attendues, isolation par établissement/entreprise.
   - Données : comptages par table critique cohérents avec le point restauré ; intégrité référentielle.
   - Accès : comptes/rôles applicatifs fonctionnels selon attentes (sans utiliser de données réelles en test destructif).
   - Audit : tables/journaux cohérents si inclus.
4. **Preuve** : consigner résultats (OK/écart), horodatage, référence du point restauré, vérifications effectuées. Toute divergence = incident à analyser avant poursuite.
5. **Rollback de décision** : si une migration/correction échoue, revenir au point de restauration validé et documenter l’écart.

## 6. Règles de sécurité et de non-régression
- **Aucune restauration/modification/suppression sans preuve et autorisation explicite.**
- **Jamais de données réelles de production pour des tests destructifs** ; utiliser des comptes/données de test isolés après autorisation.
- Toute action distante doit être précédée d’une sauvegarde vérifiée et suivie de contrôles avant/après consignés en GV5.
- Ne pas supposer que les migrations locales reflètent l’état distant : réconcilier par audit read-only autorisé avant application.

## 7. État actuel (factuel)
| Élément | Statut |
|---|---|
| Procédure documentée localement | FAIT ET VÉRIFIÉ (ce document) |
| Existence/rétention/PITR réel Supabase | NON VÉRIFIABLE SANS ACCÈS DISTANT — BLOQUÉ PAR AUTORISATION/DÉPENDANCE |
| Sauvegarde exécutée | NON EXÉCUTÉ (gel P0) |
| Restauration testée/prouvée | NON EXÉCUTÉ (gel P0) — BLOQUÉ PAR AUTORISATION/DÉPENDANCE EXTERNE |

**Conclusion** : sauvegarde/restaurabilité **non prouvées** tant qu’aucune vérification/exécution contrôlée autorisée n’a été réalisée et consignée.
