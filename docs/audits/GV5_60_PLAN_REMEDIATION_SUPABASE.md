# GV5 §60 — Plan d'application contrôlé Supabase (NON EXÉCUTÉ)

Date : 17 novembre 2026. Ce plan nécessite une autorisation explicite distincte. Aucune étape ci-dessous n'a été exécutée.

## Conditions préalables

1. Autorisation écrite du propriétaire pour toute opération distante.
2. Sauvegarde/PITR vérifiée et restaurable du projet nxmsqqoflskfajqrqddw.
3. Idéalement : projet de staging pour le premier passage.
4. Diagnostic §60 à jour (les SELECT ci-dessus à rejouer juste avant).

## Étapes

1. **0036** : appliquer ; vérifier `select to_regclass('public.invitations')` non NULL + 0 ligne PUBLIC sur les RPC.
2. **0037** : appliquer ; vérifier `grantee=0` → 0 ligne sur les fonctions listées ; **vérifier que authenticated conserve EXECUTE** (test de non-régression : connexion + appel admin_onboard_tenant_v2 après 0039).
3. **0038** : appliquer ; vérifier policies restrictives + nombre d'index FK couverts.
4. **0039** : appliquer ; vérifier colonnes professional_id/login_id/must_change_password + RPC v2 présentes.
5. Déployer les 3 Edge Functions (onboard-tenant, activate-manager, send-invitation) avec secrets serveur.
6. Tests fonctionnels contrôlés sur un compte de test (aucune donnée réelle modifiée).

## Critères d'arrêt immédiat

- Erreur SQL à une étape → arrêt, ne pas appliquer la suite.
- Plus de ligne `grantee=0` attendue après 0037 mais perte d'accès authenticated → corriger avant de continuer.
- Anomalie de données historiques → arrêt.

## Reprise

Après échec : collecter l'erreur exacte, auditer l'état réel du schéma (objets créés par la migration partielle), préparer une procédure adaptée (souvent : rejouer la migration — les objets sont `if not exists`/`create or replace`). Ne jamais supprimer d'objet créé.

## Limites du rollback

Pas de DOWN destructif. Restauration PITR = unique vrai retour arrière, mais elle efface les données créées **après** la migration → à éviter si possible. Privilégier la correction en avant. Ne jamais proposer un rollback qui supprime des données post-migration.

