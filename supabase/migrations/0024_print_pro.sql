-- AUTO DYALI — 0024 : PRINT PRO — imprimantes par établissement + historique d'impressions
-- Non destructif : créations de tables uniquement, aucune suppression,
-- aucune modification des migrations précédentes.
--
-- Exécuter dans le SQL Editor Supabase (Dashboard).
--
-- Limite honnête du navigateur (rappel produit) :
-- - USB / Bluetooth : accessibles UNIQUEMENT via WebUSB / Web Bluetooth
--   (Chrome / Edge desktop) et avec accord explicite de l'utilisateur ;
-- - réseau local : pas de socket TCP depuis un navigateur — l'impression
--   réseau passe par le pilote du poste (dialogue d'impression système) ;
-- - la voie toujours disponible : impression navigateur + PDF.

-- ---------------------------------------------------------------------
-- 1. TABLE printer_configs — configuration par établissement
-- ---------------------------------------------------------------------
create table if not exists public.printer_configs (
  id                uuid primary key default uuid_generate_v4(),
  establishment_id  uuid not null references public.establishments(id) on delete cascade,
  label             text not null,                     -- « Caisse 1 — 80mm »
  connexion         text not null default 'navigateur' check (connexion in
                      ('navigateur','usb','reseau','bluetooth')),
  format            text not null default '80mm' check (format in
                      ('58mm','80mm','A4')),
  -- Imprimante par défaut PAR type de document (un seul défaut par type) :
  est_defaut_ticket_vente      boolean not null default false,
  est_defaut_bon_intervention  boolean not null default false,
  est_defaut_devis             boolean not null default false,
  est_defaut_facture           boolean not null default false,
  copies_par_defaut  integer not null default 1 check (copies_par_defaut between 1 and 5),
  langue_defaut      text not null default 'fr' check (langue_defaut in ('fr','ar')),
  -- USB : vendor/product id renseignés après appairage WebUSB (facultatif)
  usb_vendor_id      text,
  usb_product_id     text,
  -- Réseau : adresse indicative pour le pilote du poste (pas de socket navigateur)
  adresse_reseau     text,
  actif              boolean not null default true,
  notes              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (establishment_id, label)
);

create index if not exists printer_configs_etab_idx on public.printer_configs (establishment_id);

alter table public.printer_configs enable row level security;

drop policy if exists tenant_isolation on public.printer_configs;
create policy tenant_isolation on public.printer_configs
  using (establishment_id = public.current_establishment_id())
  with check (establishment_id = public.current_establishment_id());

drop policy if exists saas_admin_all_printer_configs on public.printer_configs;
create policy saas_admin_all_printer_configs on public.printer_configs
  for all
  using (public.is_saas_admin())
  with check (public.is_saas_admin());

grant select, insert, update, delete on public.printer_configs to authenticated;

-- Un seul défaut par (établissement, type de document) :
-- avant insertion/mise à jour d'un défaut, on désactive les autres.
create or replace function public.printer_configs_unique_defaut()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.est_defaut_ticket_vente then
    update public.printer_configs
      set est_defaut_ticket_vente = false
      where establishment_id = new.establishment_id and id <> new.id and est_defaut_ticket_vente;
  end if;
  if new.est_defaut_bon_intervention then
    update public.printer_configs
      set est_defaut_bon_intervention = false
      where establishment_id = new.establishment_id and id <> new.id and est_defaut_bon_intervention;
  end if;
  if new.est_defaut_devis then
    update public.printer_configs
      set est_defaut_devis = false
      where establishment_id = new.establishment_id and id <> new.id and est_defaut_devis;
  end if;
  if new.est_defaut_facture then
    update public.printer_configs
      set est_defaut_facture = false
      where establishment_id = new.establishment_id and id <> new.id and est_defaut_facture;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_printer_configs_unique_defaut on public.printer_configs;
create trigger trg_printer_configs_unique_defaut
  before insert or update on public.printer_configs
  for each row execute function public.printer_configs_unique_defaut();

-- ---------------------------------------------------------------------
-- 2. TABLE print_jobs — historique TRACÉ (réimpression incluse)
-- ---------------------------------------------------------------------
create table if not exists public.print_jobs (
  id                uuid primary key default uuid_generate_v4(),
  establishment_id  uuid not null references public.establishments(id) on delete cascade,
  document_type     text not null check (document_type in
                      ('ticket_vente','bon_intervention','devis','facture','test')),
  -- Numéro du document d'ORIGINE (jamais modifié par une réimpression) :
  reference         text not null,
  -- Vente / devis / ordre lié, quand il existe :
  sale_id           uuid references public.sales(id) on delete set null,
  quote_id          uuid references public.quotes(id) on delete set null,
  work_order_id     uuid references public.work_orders(id) on delete set null,
  printer_id        uuid references public.printer_configs(id) on delete set null,
  printer_label     text,
  format            text not null default '80mm' check (format in ('58mm','80mm','A4')),
  langue            text not null default 'fr' check (langue in ('fr','ar')),
  copies            integer not null default 1 check (copies between 1 and 5),
  voie              text not null default 'navigateur' check (voie in
                      ('navigateur','usb','reseau','bluetooth')),
  reimpression      integer not null default 0,      -- 0 = première impression
  status            text not null default 'ok' check (status in ('ok','erreur')),
  error_message     text,
  printed_by        uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now()
);

create index if not exists print_jobs_etab_idx on public.print_jobs (establishment_id, created_at desc);
create index if not exists print_jobs_reference_idx on public.print_jobs (establishment_id, reference);

alter table public.print_jobs enable row level security;

drop policy if exists tenant_isolation on public.print_jobs;
create policy tenant_isolation on public.print_jobs
  using (establishment_id = public.current_establishment_id())
  with check (establishment_id = public.current_establishment_id());

drop policy if exists saas_admin_all_print_jobs on public.print_jobs;
create policy saas_admin_all_print_jobs on public.print_jobs
  for all
  using (public.is_saas_admin())
  with check (public.is_saas_admin());

grant select, insert on public.print_jobs to authenticated;
-- L'historique est un journal : pas de mise à jour ni suppression côté client.

-- Compteur de réimpressions d'un document (lecture honnête pour le ticket).
create or replace function public.count_print_jobs(
  p_reference text,
  p_document_type text
)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.print_jobs
  where reference = p_reference
    and document_type = p_document_type
    and status = 'ok';
$$;

grant execute on function public.count_print_jobs(text, text) to authenticated;
