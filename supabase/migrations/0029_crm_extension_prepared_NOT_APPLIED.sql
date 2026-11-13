-- =====================================================================
-- AUTO DYALI — 0029 : CRM enrichi (source / priorité / valeur potentielle)
-- STATUT : PRÉPARÉE — NON APPLIQUÉE.
--
-- PRÉREQUIS : 0018 appliquée (tables crm_leads / crm_events présentes).
-- Ne pas exécuter sans sauvegarde/PITR vérifiée et autorisation explicite.
-- Aucune donnée existante n'est supprimée ou modifiée ; colonnes ajoutées
-- avec valeurs par défaut sûres (nullable ou défaut 'normal').
-- =====================================================================

alter table public.crm_leads
  add column if not exists source          text,              -- site web, salon, recommandation, cold call, autre
  add column if not exists priority        text not null default 'normal'
            check (priority in ('low','normal','high','urgent')),
  add column if not exists estimated_value numeric(10,2);     -- valeur potentielle en MAD (contrôle côté app)

create index if not exists crm_leads_source_idx   on public.crm_leads (source);
create index if not exists crm_leads_priority_idx on public.crm_leads (priority);

comment on column public.crm_leads.source is 'Source du prospect (site web, salon, recommandation…).';
comment on column public.crm_leads.priority is 'Priorité commerciale : low|normal|high|urgent.';
comment on column public.crm_leads.estimated_value is 'Valeur potentielle du prospect (MAD) — NULL si inconnue.';
