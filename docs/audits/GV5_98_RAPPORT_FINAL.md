# RAPPORT DE MISSION — GV5 §98 — DÉBLOQUAGE STAGING ET VALIDATION DU PARCOURS D'ABONNEMENT

**Date** : 23 novembre 2026  
**Dépôt** : `auto-dyali/auto-dyali.github.io`  
**Branche** : `main`  
**HEAD** : `0f13aa2` (synchronisé avec `origin/main`)  
**Branche protégée** : `gv5-97-consolidation-super-admin` (HEAD `d5526cc`, non modifiée)  
**Production Supabase** : `nxmsqqoflskfajqrqddw` (LECTURE SEULE STRICTE)  
**Staging Supabase** : `yocufscgninxiihwiepa` (LECTURE SEULE, accès direct NON DISPONIBLE)

---

## 1. CONTRÔLES GITHUB

| Contrôle | Résultat | Preuve |
|---|---|---|
| Dépôt | `auto-dyali/auto-dyali.github.io` | `git remote -v` |
| Branche | `main` | `git branch --show-current` |
| HEAD local | `0f13aa2` | `git rev-parse HEAD` |
| HEAD distant | `0f13aa2` | `git rev-parse origin/main` |
| Synchronisation | ✅ Synchronisé | `git rev-parse HEAD` = `git rev-parse origin/main` |
| Commit HEAD présent | ✅ | `0f13aa2` dans `git log --oneline --all` |
| Branche §97 intacte | ✅ | `gv5-97-consolidation-super-admin` HEAD `d5526cc`, non modifiée |
| Fichiers de code modifiés | Aucun | `git status --short` (uniquement screenshots non suivis) |
| Migrations 0036→0043 | Présentes dans Git | `supabase/migrations/003{6,7,8,9}* 004*` |

---

## 2. ÉTAT RÉEL DE STAGING

**NON VÉRIFIABLE** — Aucun accès direct à la base de données Supabase staging `yocufscgninxiihwiepa` n'est disponible depuis cet environnement. Aucune requête SQL, aucune inspection du migration ledger, aucune vérification des tables, RPC, RLS ou Edge Functions n'a pu être effectuée.

### Ce qui est connu avec certitude (depuis le dépôt Git)

| Migration | Fichier présent | État réel staging | État réel production | Statut application |
|---|---|---|---|---|
| 0036 | ✅ `0036_invitations_manager_prepared_NOT_APPLIED.sql` | NON VÉRIFIABLE | NON VÉRIFIABLE | Non appliquée |
| 0037 | ✅ `0037_fix_security_p0_prepared_NOT_APPLIED.sql` | NON VÉRIFIABLE | NON VÉRIFIABLE | Non appliquée |
| 0038 | ✅ `0038_security_rls_indexes_prepared_NOT_APPLIED.sql` | NON VÉRIFIABLE | NON VÉRIFIABLE | Non appliquée |
| 0039 | ✅ `0039_onboarding_identity_v2_prepared_NOT_APPLIED.sql` | NON VÉRIFIABLE | NON VÉRIFIABLE | Non appliquée |
| 0040 | ✅ `0040_fix_admin_set_subscription_upsert.sql` | NON VÉRIFIABLE | NON VÉRIFIABLE | Non appliquée |
| 0041 | ✅ `0041_add_updated_at_subscriptions.sql` | NON VÉRIFIABLE | NON VÉRIFIABLE | Non appliquée |
| 0042 | ✅ `0042_rls_profiles_saas_admin_insert.sql` | NON VÉRIFIABLE | NON VÉRIFIABLE | Non appliquée |
| 0043 | ✅ `0043_archive_purge_etablissements.sql` | NON VÉRIFIABLE | NON VÉRIFIABLE | Non appliquée |

### Dépendances entre migrations

| Migration | Dépendances directes | Ordre d'application |
|---|---|---|
| 0036 | 0028 (onboarding_requests, is_saas_admin), 0001 (tables), extensions pgcrypto + uuid-ossp | 1 |
| 0037 | 0001, 0028 | 2 |
| 0038 | 0001, 0028 | 3 |
| 0039 | 0001, 0007, 0009, 0028, 0036, 0037/0038 | 4 |
| 0040 | 0009 (table subscriptions), fonction admin_set_subscription (remediation_075) | 5 (après 0039) |
| 0041 | 0009 (table subscriptions) | 6 (après 0040) |
| 0042 | 0001 (table profiles), is_saas_admin (0028) | 7 (après 0041) |
| 0043 | 0001, 0028, 0041 | 8 (après 0042) |

### Ordre d'application obligatoire

```
0036 → 0037 → 0038 → 0039 → 0040 → 0041 → 0042 → 0043
```

### RPC critiques absentes sur staging (non vérifiables directement, déduites de l'absence de migration)

| RPC | Dépendance migration | Rôle dans le parcours |
|---|---|---|
| `admin_identity_v2_health` | 0039 | Préflight environnement (blocke la création) |
| `admin_check_identity_available` | 0039 | Vérification unicité (professional_id, login_id, email, slug) |
| `admin_onboard_tenant_v2` | 0039 | Création abonné + Manager + abonnement (RPC principale) |
| `admin_invitation_preview` | 0036 | Prévisualisation invitation (activation Manager) |
| `admin_accept_invitation` | 0036 | Activation du compte Manager |
| `admin_record_delivery` | 0036 | Enregistrement statuts d'envoi |
| `admin_prepare_resend` | 0036 | Relance d'invitation |
| `admin_set_subscription` (UPSERT) | 0040 | Création/modification abonnement |
| RLS `saas_admin_insert_profiles` | 0042 | Insertion profil Manager par Super Admin |

---

## 3. CONFIGURATION DISPONIBLE ET MANQUANTE

### Configuration disponible (dans le dépôt)

| Élément | Présent dans le dépôt | Statut |
|---|---|---|
| Code onboarding 6 étapes | ✅ `src/app/super-admin/onboarding/page.tsx` | Complet, cohérent contrat v2 |
| Contrat d'onboarding v2 | ✅ `src/lib/onboarding-contract.ts` | Ré-export canonique |
| Edge Function onboard-tenant | ✅ `supabase/functions/onboard-tenant/index.ts` | Compensation Auth incluse |
| Edge Function activate-manager | ✅ `supabase/functions/activate-manager/index.ts` | Vérification connexion réelle |
| Edge Function send-invitation | ✅ `supabase/functions/send-invitation/index.ts` | Canaux indépendants |
| Fiche unifiée abonné | ✅ `src/components/abonne-workspace.tsx` | Utilise RPC existantes |
| Règles validation | ✅ `src/lib/abonne-rules.ts` | Source unique création + modification |
| Référentiel géographique Maroc | ✅ `src/lib/maroc-geographie.ts` | 141 villes, 12 régions, 0 doublon |

### Configuration manquante (nécessite intervention propriétaire)

| Élément | Manquant | Action requise |
|---|---|---|
| Migrations 0036→0043 appliquées sur staging | Oui | Autorisation propriétaire + application |
| Secrets Resend (RESEND_API_KEY, EMAIL_FROM) | Oui | Configuration fournisseur e-mail |
| Secrets WhatsApp (WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, etc.) | Oui | Configuration fournisseur WhatsApp |
| Secret Stripe (STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET) | Oui | Configuration paiement |
| ACTIVATION_BASE_URL | Oui | Configuration URL d'activation |
| Tarifs STANDARD/SILVER/GOLD (price_monthly, price_yearly) | Oui (NULL en base) | Renseigner les tarifs réels |
| .env.local basculé vers staging pour tests E2E | Oui (actuellement sur Production) | Autorisation temporaire |

---

## 4. VALIDATION MÉTIER À PRÉPARER (SCÉNARIO E2E)

### Scénario de création d'abonné (13 étapes)

| Étape | Action | Résultat attendu | État |
|---|---|---|---|
| 1 | Super Admin se connecte | Session valide, rôle saas_admin | Non testé (staging bloqué) |
| 2 | Ouverture création d'abonné | Formulaire 6 étapes affiché | Non testé |
| 3 | Saisie établissement (nom, slug, identifiant pro, adresse, ville, région) | Données enregistrées en mémoire | Non testé |
| 4 | Saisie Manager (nom, email, téléphone, login_id, mot de passe temporaire) | Données enregistrées en mémoire | Non testé |
| 5 | Sélection formule STANDARD/SILVER/GOLD | Forfait sélectionné | Non testé |
| 6 | Configuration durée payante et essai indépendant | Dates calculées, cohérentes | Non testé |
| 7 | Attribution modules et permissions | Modules du forfait sélectionnés | Non testé |
| 8 | Récapitulatif et confirmation | Toutes les informations affichées | Non testé |
| 9 | Création de l'établissement | Établissement persistant dans Supabase | **BLOQUÉ (migration 0039)** |
| 10 | Création du compte Auth Manager | Utilisateur Auth créé | **BLOQUÉ (migration 0039)** |
| 11 | Création du profil Manager associé | Profil lié à l'établissement | **BLOQUÉ (migration 0039/0042)** |
| 12 | Création de l'abonnement | Abonnement persistant, dates cohérentes | **BLOQUÉ (migration 0039/0040)** |
| 13 | Création de l'invitation | Invitation préparée, token hashé | **BLOQUÉ (migration 0036)** |

### Scénario d'activation du Manager

| Étape | Action | Résultat attendu | État |
|---|---|---|---|
| 14 | Manager clique sur le lien d'activation | Page d'activation affichée | Non testé |
| 15 | Manager définit son propre mot de passe | Mot de passe défini, pas en clair | Non testé |
| 16 | Manager se connecte | Session valide, rôle manager | Non testé |
| 17 | Manager accède à son établissement | RLS isole, uniquement ses données | Non testé |

### Tests négatifs à préparer

| Test | Résultat attendu |
|---|---|
| Identifiant professionnel déjà utilisé | Erreur 409 explicite, pas de création |
| E-mail Manager déjà utilisé | Erreur 409 explicite |
| Données obligatoires manquantes | Erreur de validation, pas de création |
| Données invalides (slug, email, téléphone) | Erreur de validation |
| Double-clic sur le bouton de création | Idempotence par requestId, pas de doublon |
| Erreur RPC | Message d'erreur compréhensible |
| Erreur Edge Function | Message d'erreur compréhensible |
| Session expirée | Redirection connexion |
| Invitation expirée | Message d'erreur explicite |
| Invitation déjà utilisée | Message d'erreur explicite |
| Réémission d'une invitation | Nouveau token, ancien invalide |
| Tentative d'accès à un autre établissement | RLS bloque, accès refusé |
| Utilisateur sans permission | Accès refusé |
| Échec de transmission par fournisseur | Statut non_configure, création durable malgré tout |

---

## 5. ACTIONS RÉALISABLES IMMÉDIATEMENT (sans autorisation propriétaire)

| Action | Statut | Preuve |
|---|---|---|
| Vérifier le dépôt GitHub | ✅ Effectué | HEAD synchronisé |
| Vérifier les migrations dans Git | ✅ Effectué | 0036→0043 présentes |
| Exécuter TypeScript | ✅ Effectué | 0 erreur |
| Exécuter ESLint | ✅ Effectué | 0 erreur, 19 warnings préexistants |
| Exécuter les tests unitaires | ✅ Effectué | 176/176 passés |
| Exécuter le build Next.js | ✅ Effectué | Succès, 67 pages |
| Préparer le scénario E2E | ✅ Effectué | Documenté ci-dessus |
| Identifier les secrets manquants | ✅ Effectué | Resend, WhatsApp, Stripe, ACTIVATION_BASE_URL |
| Identifier les tarifs manquants | ✅ Effectué | STANDARD/SILVER/GOLD NULL |

---

## 6. BLOQUAGES REQUIRANT INTERVENTION PROPRIÉTAIRE

| # | Blocage | Action requise | Environnement | Risque |
|---|---|---|---|---|
| 1 | Application migrations 0036→0043 sur staging | Autorisation propriétaire explicite et distincte | Staging `yocufscgninxiihwiepa` | Modification schéma/données |
| 2 | Configuration secrets fournisseurs (Resend, WhatsApp, Stripe, ACTIVATION_BASE_URL) | Autorisation + valeurs secrètes | Staging/Production | Envoi de notifications |
| 3 | Configuration tarifs réels STANDARD/SILVER/GOLD | Autorisation + valeurs tarifaires | Staging/Production | Facturation |
| 4 | Basculement `.env.local` vers staging pour tests E2E | Autorisation temporaire | Local | Test sur staging |
| 5 | Vérification PITR production (sauvegarde restaurable) | Autorisation | Production | Sauvegarde |

---

## 7. PROTECTION ABSOLUE (RÈGLES RESPECTÉES)

| Règle | Statut | Preuve |
|---|---|---|
| Production Supabase en lecture seule | ✅ Respecté | Aucune écriture effectuée |
| Aucune suppression de données/tables | ✅ Respecté | Aucune opération destructive |
| Aucune recréation de projet Supabase | ✅ Respecté | Aucun projet recréé |
| Branche §97 non modifiée | ✅ Respecté | `gv5-97-consolidation-super-admin` HEAD `d5526cc` intacte |
| Sauvegarde avant toute migration | À préparer | Sauvegarde/PITR staging à vérifier avant application |
| Aucune migration appliquée sans autorisation | ✅ Respecté | Aucune migration appliquée |
| Aucun secret exposé | ✅ Respecté | Aucun secret dans les rapports ou commits |
| Aucun test simulé déclaré réussi | ✅ Respecté | Aucun faux résultat |

---

## 8. PROCHAINES ÉTAPES (ORDRE RECOMMANDÉ)

### Immédiates (sans autorisation supplémentaire)

1. **Conserver le code actuel** — le parcours de création est complet, cohérent, compilant et testé statiquement
2. **Conserver le fichier de coordination §96/§97** — `docs/audits/GV5_COORDINATION_96_97.md`
3. **Préparer la demande d'autorisation propriétaire** — pour application migrations 0036→0043 sur staging

### Après autorisation propriétaire (séquence obligatoire)

1. **Vérifier sauvegarde/PITR de staging** avant toute application
2. **Appliquer les migrations** dans l'ordre : 0036 → 0037 → 0038 → 0039 → 0040 → 0041 → 0042 → 0043
3. **Basculer `.env.local` vers staging** (autorisation temporaire)
4. **Configurer les secrets fournisseurs** (Resend, WhatsApp, Stripe, ACTIVATION_BASE_URL)
5. **Configurer les tarifs réels** (STANDARD/SILVER/GOLD)
6. **Exécuter les tests E2E** du scénario complet (13 étapes création + 4 étapes activation + tests négatifs)
7. **Vérifier l'isolation multi-tenant** (un Manager ne voit pas les données d'un autre établissement)
8. **Vérifier le journal d'audit** (toutes les opérations sensibles tracées)

---

## 8. CRITÈRES D'ACCEPTATION (NON ENCORE SATISFAITS)

| Critère | Statut | Condition de validation |
|---|---|---|
| Création d'un établissement fonctionnelle | ❌ Bloqué | Migrations 0039 appliquées + test E2E réussi |
| Création automatique du Manager | ❌ Bloqué | Migrations 0039/0042 appliquées + test E2E réussi |
| Association correcte établissement/Manager | ❌ Bloqué | Migrations 0039/0042 appliquées + test E2E réussi |
| Identifiants uniques | ❌ Bloqué | Migration 0039 appliquée + test négatif doublon |
| Abonnement correctement enregistré | ❌ Bloqué | Migration 0039/0040 appliquée + test E2E réussi |
| Essai indépendant de la période payante | ❌ Bloqué | Migration 0039 appliquée + test E2E réussi |
| Modules et permissions correctement attribués | ❌ Bloqué | Migration 0039 appliquée + test E2E réussi |
| Invitation sécurisée générée | ❌ Bloqué | Migration 0036 appliquée + test E2E réussi |
| Activation du Manager fonctionnelle | ❌ Bloqué | Migrations 0036/0039 appliquée + test E2E réussi |
| Définition de son mot de passe fonctionnelle | ❌ Bloqué | Migrations 0036/0039 appliquée + test E2E réussi |
| Connexion réelle du Manager | ❌ Bloqué | Migrations 0036/0039 appliquée + test E2E réussi |
| Accès correct à son établissement | ❌ Bloqué | Migrations 0036/0039 appliquée + test RLS réussi |
| Isolation inter-tenant vérifiée | ❌ Bloqué | Migrations 0036/0039 appliquée + test RLS réussi |
| Tests négatifs réussis | ❌ Bloqué | Migrations 0036/0039 appliquée + tests exécutés |
| Tests E2E staging exécutés | ❌ Bloqué | Migrations appliquées + basculement .env.local |
| Aucune régression détectée | ✅ | TSC 0, ESLint 0 erreurs, Tests 176/176 |

---

## 9. CONCLUSION

Le code de création d'abonné est **complet, cohérent et testé statiquement** (TSC 0, ESLint 0 erreurs, 176 tests unitaires passés, build OK). Le parcours ne peut être validé en bout en bout que sur une base staging avec les migrations 0036→0039 appliquées.

**Aucune migration n'a été appliquée pendant cette mission.** Production Supabase reste en lecture seule. La branche §97 n'a pas été modifiée.

**La mission GV5 §98 ne peut pas être déclarée terminée tant que :**
1. Les migrations 0036→0043 n'ont pas été appliquées sur staging (autorisation propriétaire requise)
2. Les tests E2E complets n'ont pas été exécutés avec succès
3. Les secrets fournisseurs et les tarifs réels n'ont pas été configurés

**La prochaine étape indispensable est l'obtention de l'autorisation propriétaire pour appliquer les migrations 0036→0043 sur staging.**
