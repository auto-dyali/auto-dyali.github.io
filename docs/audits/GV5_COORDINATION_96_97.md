# COORDINATION GV5 §96 et §97 — AUTO DYALI

**Date** : 23 novembre 2026  
**Dépôt** : `auto-dyali/auto-dyali.github.io`  
**Branche** : `main`  
**HEAD** : `c635ec2` (synchronisé avec `origin/main`)

---

## 1. OBJECTIF DU DOCUMENT

Ce document sert de coordination entre deux missions parallèles :

- **GV5 §96** : Correction définitive et validation complète de la création des abonnés et des Managers (établissement, Manager, abonnement, invitation, activation, connexion).
- **GV5 §97** : Consolidation des 16 modules Super Admin (dashboard, gestion établissements, Managers, rôles, permissions, plans, abonnements, CRM, support, communications, WhatsApp, intégrations, audit, rapports, paramètres).

---

## 2. PÉRIMÈTRE DE CHAQUE MISSION

### GV5 §96 — Création des abonnés et des Managers

| Domaine | Fichiers prioritaires | Statut |
|---|---|---|
| Parcours création 6 étapes | `src/app/super-admin/onboarding/page.tsx` | Présent, cohérent contrat v2 |
| Contrat d'onboarding v2 | `src/lib/onboarding-contract.ts`, `supabase/functions/_shared/contract.ts` | Présent |
| Edge Function onboard-tenant | `supabase/functions/onboard-tenant/index.ts` | Présent |
| Edge Function activate-manager | `supabase/functions/activate-manager/index.ts` | Présent |
| Edge Function send-invitation | `supabase/functions/send-invitation/index.ts` | Présent |
| Fiche unifiée abonné | `src/components/abonne-workspace.tsx` | Présent |
| Règles validation | `src/lib/abonne-rules.ts` | Présent |
| Migrations 0036→0043 | `supabase/migrations/003{6,7,8,9}* 004*` | Présentes dans Git, non appliquées |
| Rapport §96 | `docs/audits/GV5_96_RAPPORT_FINAL.md` | Présent |

### GV5 §97 — Consolidation des 16 modules Super Admin

| Domaine | Fichiers prioritaires | Statut |
|---|---|---|
| Branche dédiée | `gv5-97-consolidation-super-admin` | Existe, à protéger |
| Dashboard Super Admin | `src/app/super-admin/page.tsx` | Présent |
| Entreprises / abonnés | `src/app/super-admin/entreprises/page.tsx` | Présent |
| Garages | `src/app/super-admin/garages/page.tsx` | Présent |
| Managers | `src/app/super-admin/managers/page.tsx` | Présent |
| Abonnements | `src/app/super-admin/abonnements/page.tsx` | Présent |
| Plans et tarifs | `src/app/super-admin/plans/page.tsx` | Présent |
| Rôles et permissions | `src/app/super-admin/roles/page.tsx` | Présent |
| Invitations | `src/app/super-admin/invitations/page.tsx` | Présent |
| Demandes de souscription | `src/app/super-admin/pre-achats/page.tsx` | Présent |
| Paiements | `src/app/super-admin/paiements/page.tsx` | Présent |
| WhatsApp | `src/app/super-admin/whatsapp/page.tsx` | Présent |
| Communications | `src/app/super-admin/communications/page.tsx` | Présent |
| CRM | `src/app/super-admin/crm/page.tsx` | Présent |
| Support | `src/app/super-admin/support/page.tsx` | Présent |
| Intégrations | `src/app/super-admin/integrations/page.tsx` | Présent |
| Journal d'audit | `src/app/super-admin/audit/page.tsx` | Présent |
| Sauvegarde | `src/app/super-admin/sauvegarde/page.tsx` | Présent |
| Rapports | `src/app/super-admin/rapports/page.tsx` | Présent |
| Paramètres | `src/app/super-admin/parametres/page.tsx` | Présent |
| Souscription | `src/app/super-admin/souscription/page.tsx` | Présent |
| Chatbot | `src/app/super-admin/chatbot/page.tsx` | Présent |
| Rapport §97 | `docs/audits/GV5_97_RAPPORT_FINAL.md` | À créer |

---

## 3. RÈGLES DE PROTECTION

### Règles impératives pour GV5 §96

1. **Ne pas écraser les modifications de §97** — la branche `gv5-97-consolidation-super-admin` doit rester intacte.
2. **Ne pas supprimer les commits de §97** — aucun `reset` ou `rebase` destructif.
3. **Ne pas modifier les fichiers réservés à §97 sans coordination** — en cas de chevauchement, analyser les deux implémentations et définir un contrat commun.
4. **Ne pas créer de fonctions concurrentes** — réutiliser les contrats et composants partagés existants (`onboarding-contract.ts`, `abonne-workspace.tsx`, etc.).
5. **Ne pas faire de fusion automatique des branches** — toute intégration doit être contrôlée et documentée.
6. **Ne pas abandonner §96 à cause d'un conflit isolé** — continuer tous les travaux indépendants.

### Règles impératives pour les deux missions

1. **Aucune modification de production** — Supabase Production (`nxmsqqoflskfajqrqddw`) reste en lecture seule.
2. **Aucune migration appliquée sans autorisation** — les migrations 0036→0043 sont présentes dans Git mais non appliquées sur staging.
3. **Aucun mot de passe en clair** — jamais stocké, transmis ou affiché.
4. **Aucun faux résultat** — pas de test simulé, pas de fausse déclaration de succès.
5. **Tous les tests doivent être exécutés réellement** — TSC, ESLint, tests unitaires, build.

---

## 4. ÉTAT ACTUEL DES TRAVAUX

### GV5 §96 (sur `main`, HEAD `c635ec2`)

- Code de création d'abonné : complet, cohérent contrat v2, compilant, testé statiquement
- Migrations 0036→0043 : préparées dans Git, non appliquées sur staging
- Blocage critique : RPC `admin_identity_v2_health`, `admin_check_identity_available`, `admin_onboard_tenant_v2`, `admin_invitation_preview`, `admin_accept_invitation` absentes sur staging
- Rapport final : `docs/audits/GV5_96_RAPPORT_FINAL.md`
- Pourcentage développement : 87 %
- Pourcentage validation staging : ~40 % (bloqué par migrations)

### GV5 §97 (branche `gv5-97-consolidation-super-admin`)

- Branche dédiée existante
- À examiner pour comprendre le périmètre et les fichiers réservés
- Aucun rapport final existant

---

## 5. POINTS DE CHEVAUCHEMENT POTENTIELS

| Domaine | Fichier partagé | Risque de conflit | Action |
|---|---|---|---|
| Contrat d'onboarding v2 | `src/lib/onboarding-contract.ts`, `supabase/functions/_shared/contract.ts` | Moyen | Réutiliser, ne pas dupliquer |
| Fiche unifiée abonné | `src/components/abonne-workspace.tsx` | Moyen | Réutiliser, ne pas dupliquer |
| Menu Super Admin | `src/components/super-admin-shell.tsx` | Moyen | Ne pas écraser les ajouts de §97 |
| Garde d'accès | `src/components/super-admin-guard.tsx` | Moyen | Ne pas modifier sans coordination |
| Communications | `src/app/super-admin/communications/page.tsx` | Faible | §97 peut l'utiliser tel quel |
| Invitations | `src/app/super-admin/invitations/page.tsx` | Moyen | §96 prépare, §97 consomme |

---

## 6. PROCHAINES ÉTAPES COORDONNÉES

1. **GV5 §96** : Continuer les corrections de code possibles sans migration (interface, validation, ergonomie).
2. **GV5 §97** : Examiner la branche `gv5-97-consolidation-super-admin` pour comprendre son périmètre.
3. **Coordination** : En cas de chevauchement de fichiers, définir un contrat commun avant toute modification.
4. **Migration** : Préparer (ne pas appliquer sans autorisation propriétaire) les migrations 0036→0043.
5. **Tests** : Exécuter TSC, ESLint, tests unitaires, build sur `main`.

---

## 7. BLOQUAGES IDENTIFIÉS

| Blocage | Dépendance | Action requise |
|---|---|---|
| Migrations 0036→0043 sur staging | Autorisation propriétaire | À demander |
| Secrets fournisseurs (Resend, WhatsApp, Stripe, ACTIVATION_BASE_URL) | Configuration serveur | À demander |
| Tarifs réels en base | Données métier | À demander |
| Tests E2E sur staging | Migrations appliquées + basculement .env.local | À demander |

---

*Ce document doit être mis à jour à chaque étape significative des deux missions.*