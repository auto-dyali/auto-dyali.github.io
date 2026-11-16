---

# GV5 — SECTION 44 — RAPPORT D’AUDIT DIRECT SUPABASE APRÈS AUTHENTIFICATION (MCP)

**Date** : 2026-11-16 (session GV5 §44 — continuation de GV5 §43).
**Projet** : AUTO DYALI.
**Supabase** : projet existant `nxmsqqoflskfajqrqddw` (`https://nxmsqqoflskfajqrqddw.supabase.co`).
**Dépôt** : `/Users/hind/Documents/Default Project/auto-plus`.
**Branche** : `main`.
**Commit de référence** : `f6c7212562754b32afcda99b06884ea2d44ad2c6`.

---

## 1. Phase 1 — Confirmation de connexion (MCP)

| Contrôle | Résultat |
|---|---|
| Outil MCP Supabase (`mcp.supabase.*`) callable dans ce runtime | ❌ **NON VÉRIFIABLE** — tentative : `Error: Unknown tool 'mcp.supabase.listProjects'` |
| Outils MCP Supabase détectés via `search` / catalogue Code Mode | ❌ **ABSENTS** du catalogue des outils disponibles dans ce contexte (browser + opencode uniquement) |
| Accès réel évalué par canaux non privilégiés (REST / config locale) | ✅ connectivité OK (REST/auth répondent ; 401 attendus sans clé service) ; clés privilégiées absentes de l’environnement |

**Conclusion Phase 1** : la connexion MCP annoncée par l’opérateur n’a pas pu être interrogée directement depuis cet exécution ; les vérifications d’accès réel se poursuivent via les canaux locaux/rest publics et restent **BLOQUÉES** pour les opérations privilégiées.

## 2. Phase 2 — Audit des migrations 0028 → 0036

| N° | Fichier local | Source Git | Objet | État distant | Remarque |
|---|---|---|---|---|---|
| 0028 | `supabase/migrations/0028_mission_2_15_onboarding_prepared_NOT_APPLIED.sql` | ✅ présent | Onboarding entreprise+Manager. | ❌ **NON VÉRIFIABLE** sans accès DB. | Préparée — non appliquée. |
| 0029 | `supabase/migrations/0029_crm_extension_prepared_NOT_APPLIED.sql` | ✅ présent | CRM enrichi. | ❌ **NON VÉRIFIABLE**. | Préparée — non appliquée. |
| 0030 | `supabase/migrations/0030_super_admin_security_hardening.sql` | ✅ présent | Hardening `admin_delete_client_account`. | ❌ **NON VÉRIFIABLE**. | Phase 2 — état distant à confirmer. |
| 0031 | `supabase/migrations/0031_profiles_rls_admin_access.sql` | ✅ présent | Policies RLS profiles/clients. | ❌ **NON VÉRIFIABLE**. | Phase 2 — état distant à confirmer. |
| 0032 | `supabase/apply/0032_PLAN_PENDING_MIGRATIONS.sql` | ✅ présent | **Fichier de plan** (sources 0010/0015/0018/0026/0029 + 0030/0031). | ❌ **NON VÉRIFIABLE**. | **Jamais exécuté** — plan non appliqué. |
| 0033 | `supabase/migrations/0033_pre_purchase_requests_prepared_NOT_APPLIED.sql` | ✅ présent | Table `pre_purchase_requests`. | ❌ **NON VÉRIFIABLE**. | Préparée — non appliquée. |
| 0034 | `supabase/migrations/0034_harden_admin_p0_rpcs_prepared_NOT_APPLIED.sql` | ✅ présent | Durcissement RPC admin P0. | ❌ **NON VÉRIFIABLE**. | Préparée — non appliquée. |
| 0035 | `supabase/migrations/0035_pre_purchase_submit_rpc_prepared_NOT_APPLIED.sql` | ✅ présent | RPC public `submit_pre_purchase_request`. | ❌ **NON VÉRIFIABLE**. | Préparée — non appliquée. |
| 0036 | `supabase/migrations/0036_invitations_manager_prepared_NOT_APPLIED.sql` | ✅ présent | Tables/RPC invitations manager. | ❌ **NON VÉRIFIABLE**. | Préparée — non appliquée. |

## 3. Phase 3 — Audit base de données et RLS

- Audit basé sur sources locales (read-only) : policies et fonctions identifiées dans les migrations locales.
- État réel de la base distante : ❌ **NON VÉRIFIABLE** sans accès privilégié / MCP opérationnel.
- Risques d’accès croisé : identifiés côté code SQL local (multi-tenant via `current_establishment_id()` / `is_saas_admin()`) ; confirmation distante **NON VÉRIFIABLE**.

## 4. Phase 4 — Edge Functions

| Élément | Résultat |
|---|---|
| Source locale `supabase/functions/onboard-tenant/index.ts` | ✅ présente (~9,7 Ko), architecture sécurité identifiée |
| Déploiement réel / version distante | ❌ **NON VÉRIFIABLE** (outil MCP indisponible, pas d’accès Edge deploy sans privilège) |

## 5. Phase 5 — Sauvegardes

| Élément | Résultat |
|---|---|
| Dump local `backups/2026-11-09/auto_dyali_avant_migration_0025.dump` | ✅ présent (413 872 octets, 2026-11-09) |
| Couverture | ⚠️ partielle (pré-migration 0025) |
| PITR | ❌ **NON VÉRIFIABLE** |

## 6. Phase 6 — Bilan et décisions

- Accès Supabase réellement disponibles : **BLOQUÉ** pour opérations privilégiées (aucune clé service / MCP opérationnel depuis cet exécution).
- Migrations : audit local complète ; état distant **NON VÉRIFIABLE** — aucune application effectuée.
- Situation 0032 : **plan non exécuté** (fichier `0032_PLAN_PENDING_MIGRATIONS.sql`).
- Opérations réalisables : audits locaux read-only, vérifs Git/GitHub/build/tests (terminées).
- Opérations nécessitant une autorisation supplémentaire : toute opération de production Supabase (migrations, EF deploy, onboarding réel, RLS réel).

---

## Synthèse GV5 §44

1. **MCP Supabase** : ❌ **NON VÉRIFIABLE** via outils de ce runtime — les phases d’audit distaut via MCP ne peuvent pas être exécutées depuis cet agent dans ce contexte.
2. **Accès privilégié Supabase** : ❌ **BLOQUÉ** (bloquant historique, confirmé par canaux non privilégiés).
3. **Migrations 0028–0036** : audit local ✅ ; état distant ❌ **NON VÉRIFIABLE** ; aucune application effectuée.
4. **RLS / EF / sauvegardes** : audits partiels locaux ; états distants/EF/PITR **NON VÉRIFIABLES** dans ce contexte.
5. **Aucune modification de production** : ✅ effectuée (conformément aux interdictions).

---

## Actions suivantes recommandées

1. **Via l’interface OpenCode (TUI/desktop)** : vérifier la connexion MCP `supabase` (commande `/mcps` → sélection serveur → sign in) pour rendre les outils MCP opérationnels.
2. **Fournir l’accès privilégié Supabase** (Dashboard owner / `service_role`) si l’opérateur souhaite lever le blocage.
3. Réitérer l’audit §44 via MCP une fois l’accès agent disponible.

---

**Rapport final GV5 §44 — audit direct Supabase après authentification (MCP) : PARTIEL — les contrôles MCP non exécutables rendent les états Supabase « NON VÉRIFIABLES » depuis cet agent ; aucun changement de production n’a été effectué.**
