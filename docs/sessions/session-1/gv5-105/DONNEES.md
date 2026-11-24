# GV5 §105 — Confirmations de données (STAGING, lecture seule)

## Écart « 52 managers actifs » (§102) vs « 50 » (§104)

Requête du tableau de bord §102 (`src/app/super-admin/page.tsx`) :
```
supabase.from("profiles").select(...).eq("role", "manager")
managersCount = managers.length
managersActifs = managers.filter((m) => m.is_active).length
```
Au moment de la capture §102, deux comptes Manager de test venaient d'être créés par le parcours navigateur : total 52, actifs 52.

Requête SQL §104 après nettoyage de ces comptes de test :
```sql
select count(*) filter (where role='manager') as managers,
       count(*) filter (where role='manager' and is_active) as actifs,
       (select count(*) from auth.users) as auth_users
from public.profiles;
```
Résultat rejoué le 24/11/2026 : `managers = 50`, `actifs = 50`, `auth_users = 52`.

**Explication : 52 = 50 comptes de test historiques + 2 comptes temporaires créés pour le test §102, supprimés ensuite.** Aucune donnée réelle concernée. Preuve : captures §102 et script de nettoyage §102 (0 résidu).

## Comptes dont l'e-mail ne finit pas par `.local` et ne contient pas « Test »

```sql
select u.email, p.full_name, p.is_active, u.created_at
from public.profiles p join auth.users u on u.id=p.id
where p.role='manager'
  and lower(u.email) not like '%.local'
  and lower(u.email) not like '%test%'
order by u.created_at;
```
Résultat : **0 ligne**. Aucun compte à signaler comme non-test. Rien n'a été supprimé.

## Adresse `test.manager.complet@gmail.com`

Bloc AUTORISATIONS du propriétaire §105 : « m'appartient = OUI ». Le compte est donc confirmé comme appartenant au propriétaire et utilisé uniquement pour des tests.

Vérification d'absence d'envoi (STAGING) :
```sql
select i.id, i.email, i.status, i.email_status, i.whatsapp_status, i.last_error
from public.invitations i where i.email='test.manager.complet@gmail.com';
```
Résultat : `status=prepared`, `email_status=en_attente`, `last_error=NULL`.

```sql
select e.event_type, e.channel, e.provider_error, e.created_at
from public.invitation_events e
where e.invitation_id='c928526c-562f-4c63-a9aa-ad04dd476493'
order by e.created_at;
```
Résultat : **0 ligne** — aucun envoi n'a été tenté ni accepté pour cette adresse. Aucun secret d'e-mail n'a été utilisé.

## Compteur « abonnements actifs » à 0 malgré 52 essais

Code (`src/app/super-admin/page.tsx`) :
```
abonnementsActifs = subscriptions.filter(s => s.status === "active").length
abonnementsEssai  = subscriptions.filter(s => s.status === "trial").length
```
Il s'agit d'une **définition** : « actifs » = abonnements payants, les essais (`trial`) sont des abonnements distincts affichés dans le sous-libellé (« 52 en essai »). Ce n'est pas une erreur de requête. Le libellé a été clarifié en §103 en « Abonnements payants actifs » (commit `18848c8`) sans modifier le calcul.
