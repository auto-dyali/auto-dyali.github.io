# GV5 §60 — Décision sur professional_id et compatibilité historique

Date : 17 novembre 2026. Aucune donnée modifiée.

## 1. Formats réellement présents (SELECT distant)

- `establishments.professional_id` : colonne ABSENTE → aucune valeur historique de ce type.
- Identifiants existants : slug (`garage-atlas`, `auto-dyali-garage`) et UUID (`9b73d222-...`, `00000000-...-0001`).
- Le format `RC12345` apparaît dans les tests locaux du formulaire pré-achat (`scripts/test-pre-purchase.mjs`) et `test-onboarding.mjs` (RC123456) — il s'agit de valeurs de test, pas de données de production.

## 2. Format canonique attendu

`ADY-PRO-XXXXXX` (préfixe ADY-PRO + 6 caractères hexadécimaux majuscules), généré par `genererIdentifiantProfessionnel()` (src/lib/onboarding.ts). Contrat v2 : regex serveur actuelle `^[A-Z0-9][A-Z0-9._-]{2,39}$` (large, accepte aussi RC12345).

## 3. Stratégie à deux niveaux (recommandée, À DÉCIDER)

- **Nouveaux identifiants** : générés côté serveur (EF) au format canonique `^ADY-PRO-[0-9A-F]{6}$`, unicité garantie par l'index unique 0039 + RPC admin_check_identity_available. Renforcer la regex côté serveur pour les nouveaux uniquement.
- **Identifiants historiques** : aucun professional_id en base aujourd'hui. Si des identifiants RCxxxxx étaient saisis manuellement plus tard, les conserver tels quels (compatibilité) via une regex large en lecture, sans les réécrire.
- **Contrôle** : garder la regex large pour la validation d'entrée (compatibilité) mais ajouter une contrainte SQL/check ou une validation EF qui impose le format canonique uniquement sur les NOUVELLES créations.

## 4. Risques

- Collision : faible (hex aléatoire + index unique + RPC de contrôle), gérée côté serveur.
- Falsification : un identifiant non canonique pourrait être saisi si la regex reste large → atténué par génération serveur + index unique.
- Régression : renforcer la regex globalement casserait les tests utilisant RC123456 → ne PAS faire sans décision explicite.

## 5. Décision attendue du propriétaire

1. Confirmer le format canonique `^ADY-PRO-[0-9A-F]{6}$` pour les nouveaux identifiants.
2. Confirmer la conservation des identifiants historiques/RCxxxxx en lecture seule.
3. Autoriser (ou non) le renforcement de la regex serveur pour les nouvelles créations uniquement.
4. Décider si la génération doit être déplacée côté serveur (actuellement client + revalidation serveur).

Aucune contrainte UNIQUE/NOT NULL n'a été appliquée. La migration 0039 ajoute des colonnes nullables avec index unique (tolère NULL) : aucun impact sur les 2 établissements existants.

