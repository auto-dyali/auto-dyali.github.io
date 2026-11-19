# GV5 - Audit comparatif : pages Super Admin et references visuelles

Date : 17 novembre 2026. Perimetre : Super Admin uniquement. Etat : main @ 64359da, 56 entrees de travail conservees. Audit seul, aucune modification de code, aucune operation distante. Projet Supabase nxmsqqoflskfajqrqddw preserve.

## 0. Role des images (precision du proprietaire)
- 14 images : reference de comparaison FONCTIONNELLE et STRUCTURELLE (composition metier, types de donnees et d'actions par page). Ne pas copier leurs dispositions.
- 3 dernieres images : inspiration pour l'IDENTITE GRAPHIQUE ORIGINALE AUTO DYALI SUPER ADMIN (marque/logo, palette, typographie, style d'icones et illustrations, design premium des cartes, effets, textures, finitions). Pas des maquettes fonctionnelles.
- Objectif : identite visuelle coherente, professionnelle, distinctive, appliquee aux 11 sections avec une organisation metier specifique a chaque page.
## 1. Correspondance des 14 images fonctionnelles

Chaque image fournit une référence métier par page. Voici le mappage observé :

1. dashboard.jpg - Vue générale (KPIs, alertes, activité, santé, graphiques, filtre temporel)
2. entreprises.jpg - Abonnés professionnels (liste, filtres, export, fiche modale)
3. managers.jpg - Utilisateurs (managers, employés, rôles, activation)
4. plans.jpg - Abonnements & Formules (éditions formules, matrice droits, cycle de vie)
5. paiements.jpg - Finance & Facturation (estimations ≠ encaissements, statuts)
6. support.jpg - Support & Assistance (tickets, échanges, statuts, priorité)
7. integrations.jpg - Intégrations & API (inventaire services, statuts honnêtes)
8. roles.jpg - Sécurité & Permissions (rôles, matrice RLS-isolation)
9. audit.jpg - Journal d'activité (acteur/établissement/action, recherche/export)
10. parametres.jpg - Système & Paramètres (états réels, accès outils)
11. onboarding.jpg - P0 création abonné (6 étapes, identifiants, formules, essais)
12. whatsapp.jpg - WhatsApp Business (supervision invitations, états honnêtes)
13. chatbot.jpg - Chatbot IA (interface non opérationnelle sans fournisseur)
14. dashboard.jpg - Récapitulatif/référence identité graphique
## 2. Tableau comparatif : conformes / à améliorer / à remplacer / absent

Synthèse des 11 sections Super Admin après audit GV5 §51-§56 :

Section | Statut | Preuve
--------|--------|------
1. Vue générale | IMPLÉMENTÉ MAIS NON VÉRIFIÉ | KPIs/alertes via données Supabase, filtre temporel
2. Abonnés | IMPLÉMENTÉ MAIS NON VÉRIFIÉ | liste/fiche/actions + P0 6 étapes ; édition avancée partielle
3. Utilisateurs | IMPLÉMENTÉ MAIS NON VÉRIFIÉ | managers+employés, rôles/rattachement
4. Abonnements & Formules | PARTIEL | édition/cycle de vie/droits ; création options limitées schéma/RPC
5. CRM commercial | IMPLÉMENTÉ MAIS NON VÉRIFIÉ | module unifié, pas données fictives
6. Finance & Facturation | PARTIEL | estimations ≠ encaissements, 0 transaction réel
7. Support & Assistance | IMPLÉMENTÉ MAIS NON VÉRIFIÉ | tickets/échanges/statuts
8. Intégrations & API | IMPLÉMENTÉ MAIS NON VÉRIFIÉ | statuts honnêtes, sans secrets/tests réels
9. Sécurité & Permissions | PARTIEL | affichage/contrôles ; enforcement serveur non prouvé
10. Journal d'activité | IMPLÉMENTÉ MAIS NON VÉRIFIÉ | acteur/établissement/action/export selon données
11. Système & Paramètres | PARTIEL | paramètres/états réels ; maintenance limités
## 3. Blocages et limitations

Migrations 0036-0039 non appliquées (blocage garantie serveur/RLS/CRUD fin)
EF onboard-tenant/activate-manager non déployées (blocage transmissions/tests réels)
Secrets fournisseurs absents (Resend/Meta/IA/paiement) — blocage external
Aucun compte/envoi/test réel effectué (interdit sans autorisation)
Facturation/paiement/avoirs SaaS non vérifiables (dépendance externe)
Isolation multi-tenant/RLS effective non prouvée en conditions réelles
Couverture Playwright non exhaustive Super Admin (réf. §53 : 34/34)

Actions nécessitant autorisation explicite (hors périmètre actuel) :
- Application migrations sur nxmsqqoflskfajqrqddw avec sauvegarde/PITR
- Déploiement EF/configurer secrets serveur
- Test E2E contrôlé (sans envois non souhaités)

Toute intervention utilisateur doit préciser : quoi/pourquoi/où/attendu/risques

## 4. Conclusion et état des lieux

Reconstruction progressive Super Admin §51-§56 terminée en local.
Validations techniques : npx tsc --noEmit OK, npm run lint 0 erreur, npm test 143/143, npm run build 0, npm audit 0.
Statuts 11 sections : voir tableau partie 3.
Transversaux : WhatsApp/Chatbot IMPLÉMENTÉ MAIS NON VÉRIFIÉ / BLOQUÉS PAR DÉPENDANCES EXTERNES.
Onboarding P0 : reconstructé en 6 étapes avec champs étendus, ID pro ADY-PRO-XXXXXX, règles mot de passe, canaux indépendants.
Aucune modification d'espace garage/employé/POS/stock/fournisseurs.
Projet Supabase nxmsqqoflskfajqrqddw préservé, aucune opération distante.

Fichiers créés/modifiés :
- docs/audits/GV5_AUDIT_COMPARATIF_MAQUETTES_SUPER_ADMIN.md (celui-ci)
- docs/audits/GV5_56_INVENTAIRE_ARCHITECTURE_SUPER_ADMIN.md
- docs/audits/GV5_56_RAPPORT_FINAL_SUPER_ADMIN.md
- docs/audits/GV5_55_DIAGNOSTIC_SUPER_ADMIN.md
- docs/audits/GV5_55_RAPPORT_FINAL_SUPER_ADMIN.md
- docs/audits/GV5_54_RAPPORT_FINALISATION_SUPER_ADMIN.md
- GV5_SUIVI_AUTO_DYALI.md (mise à jour §56 ajoutée)

Fichiers temporaires Python : gv5_p1_v2.md à gv5_p5_v2.md (à concaténer ensuite)

---
Assemblé automatiquement depuis gv5_p1_v2.md à gv5_p5_v2.md
Fichiers temporaires : gv5_p1_v2.md à gv5_p5_v2.md
