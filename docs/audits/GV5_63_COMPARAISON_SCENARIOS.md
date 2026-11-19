# GV5 §63 — Comparaison des scénarios d'application

Date : 17 novembre 2026. Aucun scénario exécuté. Décision à prendre par le propriétaire.

## Scénario A — Migrations 0036 → 0037 → 0038 → 0039

Contenu déjà intégré :
- 0036 : tables invitations, token hashé, statuts par canal, idempotence.
- 0037 : durcissement is_manager (DEFINER + search_path=public + appel qualifié) ET revoke PUBLIC sur ~18 fonctions dont open_ticket_count.
- 0038 : policies restrictives + index FK.
- 0039 : professional_id/login_id/must_change_password, RPC v2, permissions, rotation mot de passe.

Avantages : dossier complet et cohérent ; corrige LE FOND (colonnes, RPC, invitations) en plus de la sécurité. Risques : volume plus important (4 migrations, ~1500 lignes SQL) ; 0037 utilise search_path=public (moins strict que pg_catalog,public de §62) mais reste sûr. Préconditions : sauvegarde/PITR, ordre strict, contrôles après chaque étape. Rollback : restauration PITR (pas de DOWN destructif). **Ne pas réappliquer 062/001 tel quel** (redondance avec 0037 ; préférer 0037). **Appliquer 062/002 après 0039** (garde tenant open_ticket_count absente de 0037).

## Scénario B — Remédiation §62 seule

Contenu : 062/001 (is_manager DEFINER + pg_catalog,public) + 062/002 (open_ticket_count garde) + 061/002 (revoke PUBLIC des 15).

Avantages : ciblé, faible volume, corrige les 2 vulnérabilités P0/P1 et le PUBLIC EXECUTE. Risques : **ne corrige pas le retard de schéma** (professional_id, RPC v2, invitations restent absents) → onboarding/activation restent non opérationnels. Préconditions : aucune colonne requise par les scripts 062 (vérifié : is_manager et open_ticket_count existent, profiles.support_tickets existent). Rollback : sections commentées dans chaque script. Non-régression : aucun appel légitime cassé (vérifié §62).

## Comparaison et recommandation

| Critère | A | B |
|---|---|---|
| Corrige P0/P1 is_manager/open_ticket_count | oui (0037 + 062/002) | oui |
| Corrige PUBLIC EXECUTE | oui (0037) | oui (061/002) |
| Corrige retard schéma 0036-0039 | oui | non |
| Volume / complexité | élevé | faible |
| Doublons à éviter | ne pas réappliquer 062/001 après 0037 | aucun |

**Recommandation : Scénario A** (traiter le fond du retard de schéma), avec application de 062/002 après 0039 pour la garde manquante de open_ticket_count. Le Scénario B est une option de dépannage si une fenêtre courte ne permet que la sécurité immédiate, à condition de planifier A ensuite. Le choix ne doit pas être motivé par le seul nombre de scripts.

